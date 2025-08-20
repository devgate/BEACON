"""
RAG (Retrieval-Augmented Generation) Engine for BEACON
Combines document retrieval with Bedrock LLM generation
"""

import os
import json
import logging
import numpy as np
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize

from bedrock_service import BedrockService, BedrockModel
from vector_store import VectorStore, DocumentChunk, SearchResult

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Download required NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('punkt_tab', quiet=True)
except:
    pass


@dataclass
class RAGResponse:
    """RAG system response with metadata"""
    response: str
    sources: List[SearchResult]
    model_used: str
    tokens_used: Dict[str, int]
    cost_estimate: Dict[str, float]
    confidence_score: float
    processing_time: float


@dataclass
class ProcessedDocument:
    """Document processing result"""
    document_id: str
    title: str
    chunks_created: int
    embeddings_generated: bool
    processing_time: float
    total_tokens: int


class RAGEngine:
    """
    RAG Engine that combines vector search with Bedrock LLM generation
    Handles document processing, retrieval, and response generation
    """
    
    def __init__(self, 
                 bedrock_service: BedrockService,
                 vector_store: VectorStore,
                 default_model: str = "anthropic.claude-3-5-sonnet-20241022-v2:0",
                 embedding_model: str = "amazon.titan-embed-text-v1"):
        """
        Initialize RAG engine
        
        Args:
            bedrock_service: Bedrock service instance
            vector_store: Vector store instance
            default_model: Default LLM model for generation
            embedding_model: Model for generating embeddings
        """
        self.bedrock_service = bedrock_service
        self.vector_store = vector_store
        self.default_model = default_model
        self.embedding_model = embedding_model
        
        logger.info(f"RAG Engine initialized with model: {default_model}")
    
    def process_document(self, 
                        document_id: str,
                        title: str, 
                        content: str, 
                        category_id: int,
                        category_settings: Dict[str, Any]) -> ProcessedDocument:
        """
        Process a document: chunk, generate embeddings, and store
        
        Args:
            document_id: Unique document identifier
            title: Document title
            content: Document text content
            category_id: Document category ID
            category_settings: Category-specific processing settings
            
        Returns:
            ProcessedDocument with processing results
        """
        import time
        start_time = time.time()
        
        try:
            logger.info(f"Processing document {document_id} ({title})")
            
            # Apply category-specific chunking
            chunks = self._chunk_document(
                content=content,
                strategy=category_settings.get('chunk_strategy', 'sentence'),
                size=category_settings.get('chunk_size', 512),
                overlap=category_settings.get('chunk_overlap', 50)
            )
            
            logger.info(f"Created {len(chunks)} chunks for document {document_id}")
            
            # Generate embeddings for all chunks
            embeddings = self._generate_embeddings(chunks)
            
            if not embeddings:
                raise Exception("Failed to generate embeddings")
            
            # Create document chunks with embeddings
            document_chunks = []
            total_tokens = 0
            
            for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                chunk = DocumentChunk(
                    document_id=document_id,
                    chunk_index=i,
                    content=chunk_text,
                    embedding=embedding,
                    category_id=category_id,
                    metadata={
                        'title': title,
                        'chunk_strategy': category_settings.get('chunk_strategy', 'sentence'),
                        'chunk_size': category_settings.get('chunk_size', 512),
                        'embedding_model': self.embedding_model,
                        'total_chunks': len(chunks),
                        'word_count': len(chunk_text.split()),
                        'char_count': len(chunk_text)
                    }
                )
                document_chunks.append(chunk)
                total_tokens += len(chunk_text.split())
            
            # Store chunks in vector store
            self.vector_store.add_document_chunks(document_chunks)
            
            processing_time = time.time() - start_time
            
            result = ProcessedDocument(
                document_id=document_id,
                title=title,
                chunks_created=len(chunks),
                embeddings_generated=True,
                processing_time=processing_time,
                total_tokens=total_tokens
            )
            
            logger.info(f"Document {document_id} processed successfully in {processing_time:.2f}s")
            return result
            
        except Exception as e:
            logger.error(f"Error processing document {document_id}: {e}")
            raise
    
    def query(self, 
              query_text: str,
              category_id: Optional[int] = None,
              model_id: Optional[str] = None,
              top_k_documents: int = 5,
              temperature: float = 0.7,
              max_tokens: int = 2048,
              include_sources: bool = True) -> RAGResponse:
        """
        Query the RAG system with retrieval and generation
        
        Args:
            query_text: User query
            category_id: Optional category filter
            model_id: Optional model override
            top_k_documents: Number of relevant documents to retrieve
            temperature: Generation temperature
            max_tokens: Maximum tokens to generate
            include_sources: Whether to include source documents
            
        Returns:
            RAGResponse with generated answer and metadata
        """
        import time
        start_time = time.time()
        
        try:
            # Use default model if not specified
            if not model_id:
                model_id = self.default_model
            
            logger.info(f"Processing query with model {model_id}")
            
            # Generate query embedding
            query_embedding = self._generate_embeddings([query_text])
            if not query_embedding:
                raise Exception("Failed to generate query embedding")
            
            # Search for relevant documents
            search_results = self.vector_store.search_similar(
                query_embedding=query_embedding[0],
                category_id=category_id,
                top_k=top_k_documents,
                similarity_threshold=0.1
            )
            
            logger.info(f"Found {len(search_results)} relevant documents")
            
            # Generate response with context
            response_data = self._generate_response_with_context(
                query=query_text,
                search_results=search_results,
                model_id=model_id,
                temperature=temperature,
                max_tokens=max_tokens,
                category_id=category_id
            )
            
            # Calculate confidence score based on source relevance
            confidence_score = self._calculate_confidence_score(search_results)
            
            processing_time = time.time() - start_time
            
            rag_response = RAGResponse(
                response=response_data['text'],
                sources=search_results if include_sources else [],
                model_used=model_id,
                tokens_used=response_data.get('usage', {}),
                cost_estimate=response_data.get('cost', {}),
                confidence_score=confidence_score,
                processing_time=processing_time
            )
            
            logger.info(f"Query processed in {processing_time:.2f}s with confidence {confidence_score:.2f}")
            return rag_response
            
        except Exception as e:
            logger.error(f"Error processing query: {e}")
            raise
    
    def delete_document(self, document_id: str) -> int:
        """
        Delete a document and all its chunks from the vector store
        
        Args:
            document_id: Document identifier
            
        Returns:
            Number of chunks deleted
        """
        try:
            return self.vector_store.delete_document(document_id)
        except Exception as e:
            logger.error(f"Error deleting document {document_id}: {e}")
            raise
    
    def get_document_info(self, document_id: str) -> Dict[str, Any]:
        """
        Get information about a processed document
        
        Args:
            document_id: Document identifier
            
        Returns:
            Document information dictionary
        """
        try:
            chunks = self.vector_store.get_document_chunks(document_id)
            if not chunks:
                return {"error": "Document not found"}
            
            # Extract metadata from first chunk
            first_chunk = chunks[0]
            
            return {
                "document_id": document_id,
                "title": first_chunk.metadata.get('title', 'Unknown'),
                "total_chunks": len(chunks),
                "embedding_model": first_chunk.metadata.get('embedding_model', 'unknown'),
                "chunk_strategy": first_chunk.metadata.get('chunk_strategy', 'unknown'),
                "category_id": first_chunk.category_id,
                "total_words": sum(chunk.metadata.get('word_count', 0) for chunk in chunks),
                "total_characters": sum(chunk.metadata.get('char_count', 0) for chunk in chunks)
            }
            
        except Exception as e:
            logger.error(f"Error getting document info for {document_id}: {e}")
            return {"error": str(e)}
    
    def _chunk_document(self, 
                       content: str, 
                       strategy: str, 
                       size: int, 
                       overlap: int) -> List[str]:
        """
        Chunk document based on strategy
        
        Args:
            content: Document content
            strategy: Chunking strategy ('sentence', 'paragraph', 'fixed')
            size: Chunk size (tokens/sentences)
            overlap: Overlap between chunks
            
        Returns:
            List of text chunks
        """
        try:
            if strategy == 'sentence':
                return self._chunk_by_sentences(content, size, overlap)
            elif strategy == 'paragraph':
                return self._chunk_by_paragraphs(content, size, overlap)
            else:  # 'fixed' or default
                return self._chunk_by_tokens(content, size, overlap)
                
        except Exception as e:
            logger.error(f"Error chunking document: {e}")
            # Fallback to simple fixed chunking
            return self._chunk_by_tokens(content, size, overlap)
    
    def _chunk_by_sentences(self, content: str, size: int, overlap: int) -> List[str]:
        """Chunk by sentences"""
        sentences = sent_tokenize(content)
        chunks = []
        current_chunk = []
        current_word_count = 0
        
        for sentence in sentences:
            sentence_words = len(sentence.split())
            
            if current_word_count + sentence_words > size and current_chunk:
                chunks.append(' '.join(current_chunk))
                
                # Keep overlap sentences
                overlap_sentences = current_chunk[-overlap//10:] if overlap > 0 else []
                current_chunk = overlap_sentences + [sentence]
                current_word_count = sum(len(s.split()) for s in current_chunk)
            else:
                current_chunk.append(sentence)
                current_word_count += sentence_words
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    def _chunk_by_paragraphs(self, content: str, size: int, overlap: int) -> List[str]:
        """Chunk by paragraphs"""
        paragraphs = content.split('\n\n')
        chunks = []
        
        for paragraph in paragraphs:
            if not paragraph.strip():
                continue
                
            words = paragraph.split()
            if len(words) > size:
                # Split large paragraphs
                for i in range(0, len(words), size - overlap):
                    chunk_words = words[i:i + size]
                    if chunk_words:
                        chunks.append(' '.join(chunk_words))
            else:
                chunks.append(paragraph)
        
        return chunks
    
    def _chunk_by_tokens(self, content: str, size: int, overlap: int) -> List[str]:
        """Chunk by fixed token count"""
        words = content.split()
        chunks = []
        
        for i in range(0, len(words), size - overlap):
            chunk_words = words[i:i + size]
            if chunk_words:
                chunks.append(' '.join(chunk_words))
        
        return chunks
    
    def _generate_embeddings(self, texts: List[str]) -> List[np.ndarray]:
        """
        Generate embeddings for text chunks using Bedrock
        
        Args:
            texts: List of text strings
            
        Returns:
            List of embedding vectors
        """
        embeddings = []
        
        try:
            for text in texts:
                if not text.strip():
                    # Empty text, use zero vector
                    embeddings.append(np.zeros(1536))
                    continue
                
                # Generate embedding using Bedrock Titan
                embedding = self.bedrock_service.generate_embedding(
                    text=text,
                    model_id=self.embedding_model
                )
                
                if embedding:
                    embeddings.append(np.array(embedding, dtype=np.float32))
                else:
                    # Fallback to zero vector
                    embeddings.append(np.zeros(1536))
                    logger.warning(f"Failed to generate embedding for text: {text[:50]}...")
            
            return embeddings
            
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            # Return zero vectors as fallback
            return [np.zeros(1536) for _ in texts]
    
    def _generate_response_with_context(self, 
                                       query: str,
                                       search_results: List[SearchResult],
                                       model_id: str,
                                       temperature: float,
                                       max_tokens: int,
                                       category_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Generate response using retrieved context
        
        Args:
            query: User query
            search_results: Retrieved relevant documents
            model_id: Model to use for generation
            temperature: Generation temperature
            max_tokens: Maximum tokens
            category_id: Optional category for specialized prompts
            
        Returns:
            Response data from Bedrock
        """
        try:
            # Format context from search results
            context_parts = []
            for i, result in enumerate(search_results, 1):
                source_title = result.metadata.get('title', 'Unknown Document')
                context_parts.append(
                    f"[Source {i}: {source_title} (Relevance: {result.similarity_score:.2f})]\n"
                    f"{result.content}\n"
                )
            
            context_text = "\n---\n".join(context_parts)
            
            # Create category-specific system prompt
            system_prompt = self._get_system_prompt(category_id)
            
            # Create the prompt
            if context_text.strip():
                prompt = f"""Based on the following context from uploaded documents, please answer the user's question comprehensively and accurately.

Context:
{context_text}

User Question: {query}

Please provide a detailed answer based on the context provided. If the information is not fully available in the context, please indicate what information is missing. Always cite which sources you're referencing in your answer."""
            else:
                prompt = f"""I don't have specific documents uploaded that relate to your question: "{query}"

Please upload relevant PDF documents first, and then I can provide detailed answers based on that content. Is there anything else I can help you with?"""
            
            # Generate response using Bedrock
            response_data = self.bedrock_service.invoke_model(
                model_id=model_id,
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            return response_data
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            raise
    
    def _get_system_prompt(self, category_id: Optional[int] = None) -> str:
        """
        Get category-specific system prompt
        
        Args:
            category_id: Category identifier
            
        Returns:
            System prompt string
        """
        base_prompt = """You are BEACON AI, an intelligent document analysis assistant. You provide accurate, helpful responses based on uploaded documents."""
        
        category_prompts = {
            1: f"{base_prompt} You specialize in financial document analysis. Focus on financial metrics, trends, and implications when analyzing financial documents.",
            
            2: f"{base_prompt} You specialize in restaurant and food service information. Focus on menu items, pricing, location details, and customer experience aspects.",
            
            3: f"{base_prompt} You specialize in technical manuals and instructional content. Focus on step-by-step procedures, safety guidelines, and troubleshooting information.",
            
            4: f"{base_prompt} You provide general document analysis across various domains. Adapt your analysis style to the document type and content."
        }
        
        return category_prompts.get(category_id, base_prompt)
    
    def _calculate_confidence_score(self, search_results: List[SearchResult]) -> float:
        """
        Calculate confidence score based on search results
        
        Args:
            search_results: List of search results
            
        Returns:
            Confidence score (0.0-1.0)
        """
        if not search_results:
            return 0.0
        
        # Average similarity score weighted by rank
        weighted_scores = []
        for i, result in enumerate(search_results):
            # Higher weight for top results
            weight = 1.0 / (i + 1)
            weighted_scores.append(result.similarity_score * weight)
        
        if not weighted_scores:
            return 0.0
        
        # Normalize confidence score
        raw_confidence = sum(weighted_scores) / len(weighted_scores)
        
        # Apply sigmoid-like transformation for better distribution
        confidence = 2 / (1 + np.exp(-4 * (raw_confidence - 0.5)))
        
        return min(1.0, max(0.0, confidence))
    
    def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on RAG engine
        
        Returns:
            Health status dictionary
        """
        try:
            # Check vector store
            vector_health = self.vector_store.health_check()
            
            # Check Bedrock availability
            bedrock_models = len(self.bedrock_service.get_available_models())
            
            # Test embedding generation
            try:
                test_embedding = self.bedrock_service.generate_embedding(
                    "test", 
                    self.embedding_model
                )
                embedding_working = bool(test_embedding)
            except:
                embedding_working = False
            
            return {
                'status': 'healthy' if vector_health['status'] == 'healthy' and embedding_working else 'degraded',
                'vector_store': vector_health,
                'bedrock_models_available': bedrock_models,
                'embedding_service': 'working' if embedding_working else 'failed',
                'default_model': self.default_model,
                'embedding_model': self.embedding_model
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e)
            }


# Factory function for Flask integration
def create_rag_engine(bedrock_service: BedrockService, 
                     vector_store: VectorStore,
                     default_model: str = None) -> RAGEngine:
    """
    Factory function to create RAG engine
    
    Args:
        bedrock_service: Bedrock service instance
        vector_store: Vector store instance
        default_model: Optional default model override
        
    Returns:
        RAGEngine instance
    """
    if not default_model:
        # Try to use the best available model
        models = bedrock_service.get_available_models()
        
        # Prefer Claude 3.5 Sonnet, then Claude 3 Sonnet, then any Claude model
        for model in models:
            if 'claude-3-5-sonnet' in model.model_id.lower():
                default_model = model.model_id
                break
            elif 'claude-3' in model.model_id.lower() and 'sonnet' in model.model_id.lower():
                default_model = model.model_id
                break
        
        # Fallback to first available model
        if not default_model and models:
            default_model = models[0].model_id
        
        # Final fallback
        if not default_model:
            default_model = "anthropic.claude-3-5-sonnet-20241022-v2:0"
    
    return RAGEngine(
        bedrock_service=bedrock_service,
        vector_store=vector_store,
        default_model=default_model
    )


if __name__ == "__main__":
    # Test the RAG engine
    try:
        from bedrock_service import BedrockService
        from vector_store import VectorStore
        
        # Initialize services
        bedrock_service = BedrockService()
        vector_store = VectorStore()
        
        # Create RAG engine
        rag_engine = create_rag_engine(bedrock_service, vector_store)
        
        # Health check
        health = rag_engine.health_check()
        print(f"RAG Engine Health: {json.dumps(health, indent=2)}")
        
        # Test document processing
        test_content = """
        This is a sample document for testing the RAG engine.
        It contains multiple sentences that should be chunked appropriately.
        The RAG engine will process this document, create embeddings, and store them in DynamoDB.
        Later, it can retrieve relevant chunks and generate responses using Bedrock.
        """
        
        print("Processing test document...")
        result = rag_engine.process_document(
            document_id="rag_test_doc",
            title="RAG Test Document",
            content=test_content,
            category_id=4,
            category_settings={
                'chunk_strategy': 'sentence',
                'chunk_size': 100,
                'chunk_overlap': 20
            }
        )
        
        print(f"Document processed: {result.chunks_created} chunks created")
        
        # Test query
        print("Testing query...")
        response = rag_engine.query(
            query_text="What is this document about?",
            category_id=4,
            top_k_documents=3
        )
        
        print(f"Query response: {response.response}")
        print(f"Confidence: {response.confidence_score:.2f}")
        print(f"Sources: {len(response.sources)}")
        
        # Clean up
        print("Cleaning up...")
        deleted = rag_engine.delete_document("rag_test_doc")
        print(f"Deleted {deleted} chunks")
        
    except Exception as e:
        print(f"RAG Engine test failed: {e}")
        import traceback
        traceback.print_exc()