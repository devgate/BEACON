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
        self.collections = {}  # Store multiple collections by index_id
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Chroma client with persistent storage"""
        try:
            # Create persist directory if it doesn't exist
            os.makedirs(self.persist_directory, exist_ok=True)
            
            # Initialize Chroma client with persistence
            self.client = chromadb.PersistentClient(path=self.persist_directory)
            
            # Don't automatically create default collection
            self.collection = None
            
            logger.info("Chroma DB client initialized")
            
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
        Add document chunks to default collection (legacy support)
        
        Args:
            chunks: List of text chunks
            embeddings: List of embedding vectors
            document_id: Unique document identifier
            document_name: Original document name
            metadata: Additional metadata for the document
            
        Returns:
            bool: Success status
        """
        logger.warning(f"Using legacy add_document_chunks for {document_name}. Consider using add_document_to_kb instead.")
        
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
            # Determine which collection to search
            collection_to_search = self.collection  # Default collection
            where_filter = None
            
            if document_filter:
                # Check if it's a knowledge base filter
                if document_filter.startswith("kb_") and "_doc_" in document_filter:
                    # Extract knowledge base ID
                    kb_id = document_filter.split("_doc_")[0].replace("kb_", "")
                    logger.info(f"Searching in knowledge base collection: {kb_id}")
                    
                    # Get or create the specific collection
                    collection_to_search = self.get_or_create_collection(kb_id)
                    if not collection_to_search:
                        logger.warning(f"Collection {kb_id} not found, using default collection")
                        collection_to_search = self.collection
                        where_filter = {"index_id": kb_id}
                elif document_filter.endswith("_doc_"):
                    # For prefix matching in default collection
                    kb_id = document_filter.replace("kb_", "").replace("_doc_", "")
                    where_filter = {"index_id": kb_id}
                else:
                    # Exact matching for specific document
                    where_filter = {"document_id": document_filter}
            
            # Perform similarity search on the appropriate collection
            results = collection_to_search.query(
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
            # Check if document_id contains knowledge base prefix
            if document_id.startswith("kb_") and "_doc_" in document_id:
                # Extract knowledge base ID
                parts = document_id.split("_doc_")
                kb_id = parts[0].replace("kb_", "")
                
                # Get or create the specific collection
                try:
                    collection = self.client.get_collection(name=kb_id)
                    if collection:
                        # Delete from specific collection
                        results = collection.get(
                            where={"document_id": document_id},
                            include=["metadatas"]
                        )
                        
                        if results and results.get("ids"):
                            collection.delete(ids=results["ids"])
                            logger.info(f"Deleted {len(results['ids'])} chunks for document {document_id} from KB {kb_id}")
                            return True
                except Exception as e:
                    logger.debug(f"Failed to get collection {kb_id}: {e}")
                    
                # Also try deleting with direct ID pattern matching
                try:
                    collection = self.client.get_collection(name=kb_id)
                    if collection:
                        # Try to delete by direct ID match
                        collection.delete(ids=[document_id])
                        logger.info(f"Deleted document {document_id} directly from KB {kb_id}")
                        return True
                except Exception as e:
                    logger.debug(f"Direct deletion failed for {document_id}: {e}")
            
            # Fall back to default collection
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
        Get information about a specific document across all collections
        
        Args:
            document_id: Document ID to query
            
        Returns:
            Dict containing document information
        """
        try:
            # Check if document_id contains knowledge base prefix
            if document_id.startswith("kb_") and "_doc_" in document_id:
                # Extract knowledge base ID
                parts = document_id.split("_doc_")
                kb_id = parts[0].replace("kb_", "")
                
                # Get the specific collection
                collection = self.collections.get(kb_id)
                if collection:
                    results = collection.get(
                        where={"document_id": document_id},
                        include=["metadatas"]
                    )
                    
                    if results["ids"]:
                        metadatas = results["metadatas"]
                        return {
                            "exists": True,
                            "chunk_count": len(results["ids"]),
                            "document_name": metadatas[0].get("document_name", "Unknown"),
                            "created_at": metadatas[0].get("created_at", "Unknown"),
                            "total_size": sum(meta.get("chunk_size", 0) for meta in metadatas),
                            "knowledge_base_id": kb_id
                        }
            
            # Fall back to default collection
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
    
    def get_document_chunks(self, document_id: str) -> List[str]:
        """
        Get all text chunks for a specific document
        
        Args:
            document_id: Document ID to query
            
        Returns:
            List of text chunks for the document
        """
        try:
            chunks = []
            
            # Check if document_id contains knowledge base prefix
            if document_id.startswith("kb_") and "_doc_" in document_id:
                # Extract knowledge base ID
                parts = document_id.split("_doc_")
                kb_id = parts[0].replace("kb_", "")
                
                # Get the specific collection
                collection = self.collections.get(kb_id)
                if collection:
                    results = collection.get(
                        where={"document_id": document_id},
                        include=["documents", "metadatas"]
                    )
                    
                    if results["ids"]:
                        # Sort by chunk_index if available
                        chunk_data = list(zip(
                            results["documents"], 
                            results["metadatas"]
                        ))
                        chunk_data.sort(key=lambda x: x[1].get("chunk_index", 0))
                        chunks = [chunk[0] for chunk in chunk_data]
                        return chunks
            
            # Fall back to default collection
            results = self.collection.get(
                where={"document_id": document_id},
                include=["documents", "metadatas"]
            )
            
            if results["ids"]:
                # Sort by chunk_index if available
                chunk_data = list(zip(
                    results["documents"], 
                    results["metadatas"]
                ))
                chunk_data.sort(key=lambda x: x[1].get("chunk_index", 0))
                chunks = [chunk[0] for chunk in chunk_data]
            
            return chunks
            
        except Exception as e:
            logger.error(f"Failed to get document chunks for {document_id}: {str(e)}")
            return []
    
    def list_all_documents(self) -> Dict[str, Dict[str, Any]]:
        """
        List all documents across all collections
        
        Returns:
            Dict of document information keyed by document_id
        """
        try:
            all_docs = {}
            
            # Get documents from default collection (if exists)
            if self.collection:
                try:
                    results = self.collection.get(include=["metadatas"])
                    if results["ids"]:
                        for metadata in results["metadatas"]:
                            doc_id = metadata.get("document_id")
                            if doc_id and doc_id not in all_docs:
                                all_docs[doc_id] = {
                                    "document_id": doc_id,
                                    "document_name": metadata.get("document_name", "Unknown"),
                                    "created_at": metadata.get("created_at", "Unknown"),
                                    "chunk_count": 0,
                                    "total_size": 0,
                                    "collection": "documents"
                                }
                            
                            if doc_id:
                                all_docs[doc_id]["chunk_count"] += 1
                                all_docs[doc_id]["total_size"] += metadata.get("chunk_size", 0)
                except Exception as e:
                    logger.warning(f"Could not access default collection: {e}")
            
            # Get documents from knowledge base collections (refresh collections first)
            all_collections = self.list_all_collections()
            for collection_info in all_collections:
                collection_name = collection_info['name']
                try:
                    # Get or create collection reference
                    collection = self.client.get_collection(collection_name)
                    
                    kb_results = collection.get(include=["metadatas"])
                    if kb_results["ids"]:
                        for metadata in kb_results["metadatas"]:
                            doc_id = metadata.get("document_id")
                            if doc_id and doc_id not in all_docs:
                                all_docs[doc_id] = {
                                    "document_id": doc_id,
                                    "document_name": metadata.get("document_name", "Unknown"),
                                    "created_at": metadata.get("created_at", "Unknown"),
                                    "chunk_count": 0,
                                    "total_size": 0,
                                    "collection": collection_name
                                }
                            
                            if doc_id:
                                all_docs[doc_id]["chunk_count"] += 1
                                all_docs[doc_id]["total_size"] += metadata.get("chunk_size", 0)
                except Exception as e:
                    logger.warning(f"Could not access collection {collection_name}: {e}")
            
            logger.info(f"Found {len(all_docs)} documents across all collections")
            return all_docs
            
        except Exception as e:
            logger.error(f"Failed to list documents: {str(e)}")
            return {}
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """
        Get statistics about all collections
        
        Returns:
            Dict containing collection statistics
        """
        try:
            # Count from default collection
            default_count = self.collection.count()
            
            # Count from knowledge base collections
            kb_stats = {}
            total_kb_chunks = 0
            
            for kb_id, collection in self.collections.items():
                try:
                    kb_count = collection.count()
                    kb_stats[kb_id] = kb_count
                    total_kb_chunks += kb_count
                except Exception as e:
                    logger.warning(f"Could not get stats for collection {kb_id}: {e}")
                    kb_stats[kb_id] = 0
            
            documents = self.list_all_documents()
            
            stats = {
                "total_chunks": default_count + total_kb_chunks,
                "default_collection_chunks": default_count,
                "knowledge_base_collections": kb_stats,
                "total_knowledge_bases": len(self.collections),
                "total_documents": len(documents),
                "average_chunks_per_document": (default_count + total_kb_chunks) / len(documents) if documents else 0,
                "total_text_size": sum(doc.get("total_size", 0) for doc in documents)
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get collection stats: {str(e)}")
            return {"total_chunks": 0, "total_documents": 0}
    
    def clear_collection(self) -> bool:
        """
        Clear all documents from default collection only (for testing purposes)
        
        Returns:
            bool: Success status
        """
        logger.warning("Clearing default collection only. Knowledge base collections remain intact.")
        try:
            # Get all document IDs from default collection
            all_results = self.collection.get(include=[])
            
            if all_results["ids"]:
                # Delete all documents
                self.collection.delete(ids=all_results["ids"])
                logger.info(f"Cleared {len(all_results['ids'])} documents from default collection")
                return True
            else:
                logger.info("Default collection is already empty")
                return True
                
        except Exception as e:
            logger.error(f"Failed to clear collection: {str(e)}")
            return False
    
    def reset_collection(self) -> bool:
        """
        Reset default collection only (for testing purposes)
        
        Returns:
            bool: Success status
        """
        logger.warning("Resetting default collection only. Knowledge base collections remain intact.")
        try:
            # Delete existing default collection if it exists
            try:
                self.client.delete_collection("documents")
                logger.info("Deleted existing default collection")
            except:
                logger.info("No default collection to delete")
            
            # Don't recreate default collection
            self.collection = None
            logger.info("Default collection removed, no automatic recreation")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to reset collection: {str(e)}")
            return False
    
    def create_collection_for_kb(self, index_id: str) -> bool:
        """
        Create a dedicated collection for a knowledge base
        
        Args:
            index_id: Knowledge base index ID
            
        Returns:
            bool: Success status
        """
        try:
            # Create collection with index_id as name
            collection = self.client.get_or_create_collection(
                name=index_id,
                metadata={"description": f"Document embeddings for knowledge base {index_id}"}
            )
            
            # Store collection reference
            self.collections[index_id] = collection
            logger.info(f"Created ChromaDB collection for knowledge base: {index_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to create collection for {index_id}: {str(e)}")
            return False
    
    def delete_collection_for_kb(self, index_id: str) -> bool:
        """
        Delete a knowledge base collection
        
        Args:
            index_id: Knowledge base index ID
            
        Returns:
            bool: Success status
        """
        try:
            # Delete collection
            self.client.delete_collection(index_id)
            
            # Remove from collections dict
            if index_id in self.collections:
                del self.collections[index_id]
            
            logger.info(f"Deleted ChromaDB collection for knowledge base: {index_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete collection for {index_id}: {str(e)}")
            return False
    
   
    def get_or_create_collection(self, index_id: str):
        """
        Get or create a collection for a knowledge base
        
        Args:
            index_id: Knowledge base index ID
            
        Returns:
            Collection object or None
        """
        try:
            if index_id not in self.collections:
                collection = self.client.get_or_create_collection(
                    name=index_id,
                    metadata={"description": f"Document embeddings for knowledge base {index_id}"}
                )
                self.collections[index_id] = collection
            
            return self.collections[index_id]
            
        except Exception as e:
            logger.error(f"Failed to get/create collection for {index_id}: {str(e)}")
            return None
    
    def add_document_to_kb(self, chunks: List[str], embeddings: List[List[float]], 
                           document_id: str, document_name: str, index_id: str,
                           metadata: Dict[str, Any] = None) -> bool:
        """
        Add document to a specific knowledge base collection
        
        Args:
            chunks: List of text chunks
            embeddings: List of embedding vectors
            document_id: Unique document identifier
            document_name: Original document name
            index_id: Knowledge base index ID
            metadata: Additional metadata for the document
            
        Returns:
            bool: Success status
        """
        try:
            # Get or create collection for this knowledge base
            collection = self.get_or_create_collection(index_id)
            if not collection:
                return False
            
            # Prepare chunk IDs and metadata
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
                    "chunk_hash": hashlib.md5(chunk.encode()).hexdigest(),
                    "index_id": index_id
                }
                
                # Add custom metadata if provided
                if metadata:
                    chunk_metadata.update(metadata)
                
                chunk_metadatas.append(chunk_metadata)
            
            # Add to collection
            collection.add(
                embeddings=embeddings,
                documents=chunks,
                metadatas=chunk_metadatas,
                ids=chunk_ids
            )
            
            logger.info(f"Added {len(chunks)} chunks for document {document_name} to KB {index_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add document chunks to KB {index_id}: {str(e)}")
            return False
    
    def list_all_collections(self) -> List[Dict[str, Any]]:
        """
        List all ChromaDB collections with their statistics
        
        Returns:
            List of dictionaries containing collection info
        """
        try:
            # Get all collections from ChromaDB client
            collections_list = self.client.list_collections()
            
            collection_info = []
            for coll in collections_list:
                try:
                    # Get collection details
                    collection = self.client.get_collection(coll.name)
                    count = collection.count()
                    
                    # Get sample metadata to determine if it's a knowledge base collection
                    sample_docs = collection.peek(1)
                    is_kb_collection = False
                    kb_id = None
                    
                    if sample_docs and sample_docs.get('metadatas') and sample_docs['metadatas']:
                        meta = sample_docs['metadatas'][0]
                        if 'index_id' in meta:
                            is_kb_collection = True
                            kb_id = meta['index_id']
                    
                    # Format collection info
                    info = {
                        'name': coll.name,
                        'id': coll.name,  # Use name as ID for consistency
                        'document_count': count,
                        'is_knowledge_base': is_kb_collection,
                        'knowledge_base_id': kb_id,
                        'metadata': coll.metadata or {},
                        'created_at': coll.metadata.get('created_at', 'Unknown') if coll.metadata else 'Unknown'
                    }
                    
                    collection_info.append(info)
                    
                except Exception as e:
                    logger.error(f"Failed to get info for collection {coll.name}: {e}")
                    continue
            
            logger.info(f"Found {len(collection_info)} ChromaDB collections")
            return collection_info
            
        except Exception as e:
            logger.error(f"Failed to list collections: {str(e)}")
            return []
    
    def get_collection_stats_by_kb(self, index_id: str) -> Dict[str, Any]:
        """
        Get detailed statistics for a specific knowledge base collection
        
        Args:
            index_id: Knowledge base index ID
            
        Returns:
            Dict containing collection statistics
        """
        try:
            collection = self.get_or_create_collection(index_id)
            if not collection:
                return {'exists': False, 'document_count': 0}
            
            count = collection.count()
            
            if count > 0:
                # Get sample of documents to analyze
                sample_size = min(count, 10)
                sample_docs = collection.peek(sample_size)
                
                # Analyze metadata
                unique_docs = set()
                total_chunks = 0
                
                if sample_docs.get('metadatas'):
                    for meta in sample_docs['metadatas']:
                        if 'document_id' in meta:
                            unique_docs.add(meta['document_id'])
                        total_chunks += 1
                
                return {
                    'exists': True,
                    'collection_name': index_id,
                    'total_chunks': count,
                    'estimated_documents': len(unique_docs) if sample_size < count else len(unique_docs),
                    'sample_size': sample_size,
                    'is_sample': sample_size < count
                }
            else:
                return {
                    'exists': True,
                    'collection_name': index_id,
                    'total_chunks': 0,
                    'estimated_documents': 0
                }
                
        except Exception as e:
            logger.error(f"Failed to get stats for collection {index_id}: {str(e)}")
            return {'exists': False, 'document_count': 0}
    
    def delete_collection_by_name(self, collection_name: str) -> bool:
        """
        Delete a collection by its name
        
        Args:
            collection_name: Collection name to delete
            
        Returns:
            bool: Success status
        """
        try:
            # Delete collection
            self.client.delete_collection(collection_name)
            
            # Remove from collections dict if it exists
            if collection_name in self.collections:
                del self.collections[collection_name]
            
            # Clear default collection reference if it matches
            if self.collection and hasattr(self.collection, 'name') and self.collection.name == collection_name:
                self.collection = None
            
            logger.info(f"Deleted ChromaDB collection: {collection_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete collection {collection_name}: {str(e)}")
            return False
    
    def reinitialize_client(self) -> bool:
        """
        Reinitialize ChromaDB client and clear memory cache
        
        Returns:
            bool: Success status
        """
        try:
            # Clear collections cache
            self.collections.clear()
            
            # Reinitialize client
            self._initialize_client()
            
            logger.info("ChromaDB client reinitialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to reinitialize ChromaDB client: {str(e)}")
            return False


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
    
    def reinitialize_client(self) -> bool:
        """
        Reinitialize ChromaDB client and clear memory cache
        
        Returns:
            bool: Success status
        """
        try:
            # Clear collections cache
            self.collections.clear()
            
            # Reinitialize client
            self._initialize_client()
            
            logger.info("ChromaDB client reinitialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to reinitialize ChromaDB client: {str(e)}")
            return False