"""
Chroma DB Service for Vector Storage and Retrieval
Handles document embeddings, storage, and similarity search
"""

import os
import chromadb
from chromadb.config import Settings
import numpy as np
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChromaService:
    def __init__(self, persist_directory: str = "chroma_data"):
        """
        Initialize Chroma DB service with persistent storage
        
        Args:
            persist_directory: Directory to store Chroma DB data
        """
        self.persist_directory = persist_directory
        self.client = None
        self.collection = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Chroma client with persistent storage"""
        try:
            # Create persist directory if it doesn't exist
            os.makedirs(self.persist_directory, exist_ok=True)
            
            # Initialize Chroma client with persistence
            self.client = chromadb.PersistentClient(path=self.persist_directory)
            
            # Get or create collection for documents
            self.collection = self.client.get_or_create_collection(
                name="documents",
                metadata={"description": "Document embeddings for RAG system"}
            )
            
            logger.info(f"Chroma DB initialized with {self.collection.count()} existing documents")
            
        except Exception as e:
            logger.error(f"Failed to initialize Chroma DB: {str(e)}")
            raise
    
    def add_document_chunks(
        self, 
        chunks: List[str], 
        embeddings: List[List[float]], 
        document_id: str,
        document_name: str,
        metadata: Dict[str, Any] = None
    ) -> bool:
        """
        Add document chunks with embeddings to Chroma DB
        
        Args:
            chunks: List of text chunks
            embeddings: List of embedding vectors
            document_id: Unique document identifier
            document_name: Original document name
            metadata: Additional metadata for the document
            
        Returns:
            bool: Success status
        """
        try:
            if len(chunks) != len(embeddings):
                raise ValueError("Number of chunks must match number of embeddings")
            
            # Prepare chunk IDs
            chunk_ids = []
            chunk_metadatas = []
            
            for i, chunk in enumerate(chunks):
                chunk_id = f"{document_id}_chunk_{i}"
                chunk_ids.append(chunk_id)
                
                # Create metadata for each chunk
                chunk_metadata = {
                    "document_id": document_id,
                    "document_name": document_name,
                    "chunk_index": i,
                    "chunk_size": len(chunk),
                    "created_at": datetime.now().isoformat(),
                    "chunk_hash": hashlib.md5(chunk.encode()).hexdigest()
                }
                
                # Add custom metadata if provided
                if metadata:
                    chunk_metadata.update(metadata)
                
                chunk_metadatas.append(chunk_metadata)
            
            # Add to collection
            self.collection.add(
                embeddings=embeddings,
                documents=chunks,
                metadatas=chunk_metadatas,
                ids=chunk_ids
            )
            
            logger.info(f"Added {len(chunks)} chunks for document {document_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add document chunks: {str(e)}")
            return False
    
    def search_similar_chunks(
        self, 
        query_embedding: List[float], 
        n_results: int = 5,
        document_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search for similar chunks using vector similarity
        
        Args:
            query_embedding: Query embedding vector
            n_results: Number of results to return
            document_filter: Optional document ID to filter results
            
        Returns:
            Dict containing search results
        """
        try:
            # Prepare query filter
            where_filter = None
            if document_filter:
                # Support prefix matching for knowledge base filtering
                if document_filter.endswith("_doc_"):
                    # For prefix matching, we'll need to get all results first and filter manually
                    # Or use knowledge base ID in metadata instead
                    logger.info(f"Using knowledge base prefix filter: {document_filter}")
                    # Extract knowledge base ID from filter
                    kb_id = document_filter.replace("kb_", "").replace("_doc_", "")
                    where_filter = {"index_id": kb_id}
                else:
                    # Exact matching for specific document
                    where_filter = {"document_id": document_filter}
            
            # Perform similarity search
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where_filter if where_filter else None,
                include=["documents", "metadatas", "distances"]
            )
            
            # Format results
            formatted_results = {
                "chunks": results["documents"][0] if results["documents"] else [],
                "metadatas": results["metadatas"][0] if results["metadatas"] else [],
                "distances": results["distances"][0] if results["distances"] else [],
                "total_results": len(results["documents"][0]) if results["documents"] else 0
            }
            
            logger.info(f"Found {formatted_results['total_results']} similar chunks")
            return formatted_results
            
        except Exception as e:
            logger.error(f"Failed to search similar chunks: {str(e)}")
            return {"chunks": [], "metadatas": [], "distances": [], "total_results": 0}
    
    def delete_document(self, document_id: str) -> bool:
        """
        Delete all chunks for a specific document
        
        Args:
            document_id: Document ID to delete
            
        Returns:
            bool: Success status
        """
        try:
            # Get all chunks for this document
            results = self.collection.get(
                where={"document_id": document_id},
                include=["metadatas"]
            )
            
            if results["ids"]:
                # Delete all chunks for this document
                self.collection.delete(ids=results["ids"])
                logger.info(f"Deleted {len(results['ids'])} chunks for document {document_id}")
                return True
            else:
                logger.warning(f"No chunks found for document {document_id}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to delete document {document_id}: {str(e)}")
            return False
    
    def get_document_info(self, document_id: str) -> Dict[str, Any]:
        """
        Get information about a specific document
        
        Args:
            document_id: Document ID to query
            
        Returns:
            Dict containing document information
        """
        try:
            results = self.collection.get(
                where={"document_id": document_id},
                include=["metadatas"]
            )
            
            if not results["ids"]:
                return {"exists": False, "chunk_count": 0}
            
            metadatas = results["metadatas"]
            
            # Extract document information
            doc_info = {
                "exists": True,
                "chunk_count": len(results["ids"]),
                "document_name": metadatas[0].get("document_name", "Unknown"),
                "created_at": metadatas[0].get("created_at", "Unknown"),
                "total_size": sum(meta.get("chunk_size", 0) for meta in metadatas)
            }
            
            return doc_info
            
        except Exception as e:
            logger.error(f"Failed to get document info for {document_id}: {str(e)}")
            return {"exists": False, "chunk_count": 0}
    
    def list_all_documents(self) -> List[Dict[str, Any]]:
        """
        List all documents in the collection
        
        Returns:
            List of document information
        """
        try:
            # Get all documents
            results = self.collection.get(include=["metadatas"])
            
            if not results["ids"]:
                return []
            
            # Group by document_id
            docs_by_id = {}
            for metadata in results["metadatas"]:
                doc_id = metadata.get("document_id")
                if doc_id not in docs_by_id:
                    docs_by_id[doc_id] = {
                        "document_id": doc_id,
                        "document_name": metadata.get("document_name", "Unknown"),
                        "created_at": metadata.get("created_at", "Unknown"),
                        "chunk_count": 0,
                        "total_size": 0
                    }
                
                docs_by_id[doc_id]["chunk_count"] += 1
                docs_by_id[doc_id]["total_size"] += metadata.get("chunk_size", 0)
            
            return list(docs_by_id.values())
            
        except Exception as e:
            logger.error(f"Failed to list documents: {str(e)}")
            return []
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the collection
        
        Returns:
            Dict containing collection statistics
        """
        try:
            total_count = self.collection.count()
            documents = self.list_all_documents()
            
            stats = {
                "total_chunks": total_count,
                "total_documents": len(documents),
                "average_chunks_per_document": total_count / len(documents) if documents else 0,
                "total_text_size": sum(doc.get("total_size", 0) for doc in documents)
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get collection stats: {str(e)}")
            return {"total_chunks": 0, "total_documents": 0}


class DocumentChunker:
    """
    Document chunking utility with multiple strategies
    """
    
    @staticmethod
    def chunk_by_sentences(text: str, max_chunk_size: int = 1000, overlap: int = 100) -> List[str]:
        """
        Split text into chunks by sentences with overlap
        
        Args:
            text: Input text
            max_chunk_size: Maximum characters per chunk
            overlap: Overlap between chunks in characters
            
        Returns:
            List of text chunks
        """
        import re
        
        # Split by sentences
        sentences = re.split(r'(?<=[.!?])\s+', text)
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            # Check if adding this sentence would exceed max size
            if len(current_chunk) + len(sentence) <= max_chunk_size:
                current_chunk += sentence + " "
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    
                    # Create overlap
                    if overlap > 0:
                        words = current_chunk.split()
                        overlap_words = words[-min(overlap//5, len(words)):]  # Approximate word overlap
                        current_chunk = " ".join(overlap_words) + " " + sentence + " "
                    else:
                        current_chunk = sentence + " "
                else:
                    current_chunk = sentence + " "
        
        # Add final chunk
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    @staticmethod
    def chunk_by_paragraphs(text: str, max_chunk_size: int = 1500) -> List[str]:
        """
        Split text into chunks by paragraphs
        
        Args:
            text: Input text
            max_chunk_size: Maximum characters per chunk
            
        Returns:
            List of text chunks
        """
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = ""
        
        for paragraph in paragraphs:
            if len(current_chunk) + len(paragraph) <= max_chunk_size:
                current_chunk += paragraph + "\n\n"
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = paragraph + "\n\n"
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    @staticmethod
    def chunk_by_tokens(text: str, max_tokens: int = 500, overlap_tokens: int = 50) -> List[str]:
        """
        Split text into chunks by approximate token count
        
        Args:
            text: Input text
            max_tokens: Maximum tokens per chunk
            overlap_tokens: Overlap between chunks in tokens
            
        Returns:
            List of text chunks
        """
        # Approximate tokens by splitting on whitespace
        words = text.split()
        chunks = []
        
        for i in range(0, len(words), max_tokens - overlap_tokens):
            chunk_words = words[i:i + max_tokens]
            chunks.append(" ".join(chunk_words))
        
        return chunks