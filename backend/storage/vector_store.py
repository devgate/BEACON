"""
DynamoDB-based vector store implementation for BEACON RAG system
Handles document chunks, embeddings, and similarity search
"""

import boto3
import numpy as np
import json
import logging
import time
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class DocumentChunk:
    """Document chunk with metadata"""
    document_id: str
    chunk_index: int
    content: str
    embedding: List[float]
    metadata: Dict[str, Any]
    category_id: Optional[int] = None


@dataclass
class SearchResult:
    """Search result with similarity score"""
    document_id: str
    chunk_index: int
    content: str
    similarity_score: float
    metadata: Dict[str, Any]
    category_id: Optional[int] = None


class VectorStore:
    """
    DynamoDB-based vector store with FAISS-like similarity search
    Stores document embeddings and provides semantic search capabilities
    """
    
    def __init__(self, 
                 table_name: str = "prod-beacon-vectors",
                 region_name: str = "ap-northeast-2",
                 embedding_dimension: int = 1536):
        """
        Initialize vector store
        
        Args:
            table_name: DynamoDB table name for vector storage
            region_name: AWS region
            embedding_dimension: Dimension of embeddings (Titan: 1536)
        """
        self.table_name = table_name
        self.region_name = region_name
        self.embedding_dimension = embedding_dimension
        
        # Initialize DynamoDB
        self.dynamodb = boto3.resource('dynamodb', region_name=region_name)
        self.table = self.dynamodb.Table(table_name)
        
        # Verify table exists
        try:
            self.table.table_status
            logger.info(f"Connected to DynamoDB table: {table_name}")
        except ClientError as e:
            logger.error(f"Error connecting to DynamoDB table {table_name}: {e}")
            raise
    
    def add_document_chunks(self, chunks: List[DocumentChunk]) -> None:
        """
        Add multiple document chunks to the vector store
        
        Args:
            chunks: List of DocumentChunk objects to store
        """
        try:
            # Batch write chunks
            with self.table.batch_writer() as batch:
                for chunk in chunks:
                    # Convert numpy arrays to lists for JSON serialization
                    embedding = chunk.embedding.tolist() if isinstance(chunk.embedding, np.ndarray) else chunk.embedding
                    
                    # Create item for DynamoDB
                    item = {
                        'document_id': f"{chunk.document_id}_chunk_{chunk.chunk_index}",
                        'base_document_id': chunk.document_id,
                        'chunk_index': chunk.chunk_index,
                        'content': chunk.content,
                        'embedding': embedding,
                        'category_id': chunk.category_id or 0,
                        'metadata': self._convert_to_dynamodb_format(chunk.metadata),
                        'created_at': int(time.time()),
                        'embedding_model': chunk.metadata.get('embedding_model', 'amazon.titan-embed-text-v1')
                    }
                    
                    batch.put_item(Item=item)
            
            logger.info(f"Added {len(chunks)} chunks to vector store")
            
        except ClientError as e:
            logger.error(f"Error adding chunks to DynamoDB: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error adding chunks: {e}")
            raise
    
    def search_similar(self, 
                      query_embedding: np.ndarray,
                      category_id: Optional[int] = None,
                      top_k: int = 5,
                      similarity_threshold: float = 0.0) -> List[SearchResult]:
        """
        Search for similar document chunks using cosine similarity
        
        Args:
            query_embedding: Query embedding vector
            category_id: Optional category filter
            top_k: Number of results to return
            similarity_threshold: Minimum similarity score
            
        Returns:
            List of SearchResult objects sorted by similarity
        """
        try:
            # Convert query embedding to list
            query_vector = query_embedding.tolist() if isinstance(query_embedding, np.ndarray) else query_embedding
            
            # Scan table with optional category filter
            if category_id is not None:
                response = self.table.scan(
                    FilterExpression=Attr('category_id').eq(category_id)
                )
            else:
                response = self.table.scan()
            
            results = []
            
            # Calculate similarity for each item
            for item in response.get('Items', []):
                try:
                    # Get stored embedding
                    stored_embedding = item.get('embedding', [])
                    if not stored_embedding:
                        continue
                    
                    # Calculate cosine similarity
                    similarity = self._cosine_similarity(query_vector, stored_embedding)
                    
                    # Apply threshold filter
                    if similarity < similarity_threshold:
                        continue
                    
                    # Create search result
                    result = SearchResult(
                        document_id=item.get('base_document_id', ''),
                        chunk_index=item.get('chunk_index', 0),
                        content=item.get('content', ''),
                        similarity_score=float(similarity),
                        metadata=self._convert_from_dynamodb_format(item.get('metadata', {})),
                        category_id=item.get('category_id')
                    )
                    
                    results.append(result)
                    
                except Exception as e:
                    logger.warning(f"Error processing search result: {e}")
                    continue
            
            # Sort by similarity score (highest first)
            results.sort(key=lambda x: x.similarity_score, reverse=True)
            
            # Return top-k results
            return results[:top_k]
            
        except ClientError as e:
            logger.error(f"Error searching DynamoDB: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error during search: {e}")
            raise
    
    def get_document_chunks(self, document_id: str) -> List[SearchResult]:
        """
        Get all chunks for a specific document
        
        Args:
            document_id: Base document identifier
            
        Returns:
            List of SearchResult objects for the document
        """
        try:
            response = self.table.scan(
                FilterExpression=Attr('base_document_id').eq(document_id)
            )
            
            results = []
            for item in response.get('Items', []):
                result = SearchResult(
                    document_id=item.get('base_document_id', ''),
                    chunk_index=item.get('chunk_index', 0),
                    content=item.get('content', ''),
                    similarity_score=1.0,  # Not applicable for direct retrieval
                    metadata=self._convert_from_dynamodb_format(item.get('metadata', {})),
                    category_id=item.get('category_id')
                )
                results.append(result)
            
            # Sort by chunk index
            results.sort(key=lambda x: x.chunk_index)
            return results
            
        except ClientError as e:
            logger.error(f"Error retrieving document chunks: {e}")
            raise
    
    def delete_document(self, document_id: str) -> int:
        """
        Delete all chunks for a specific document
        
        Args:
            document_id: Base document identifier
            
        Returns:
            Number of chunks deleted
        """
        try:
            # Find all chunks for the document
            response = self.table.scan(
                FilterExpression=Attr('base_document_id').eq(document_id)
            )
            
            deleted_count = 0
            
            # Delete each chunk
            for item in response.get('Items', []):
                chunk_id = item.get('document_id')
                if chunk_id:
                    self.table.delete_item(
                        Key={'document_id': chunk_id}
                    )
                    deleted_count += 1
            
            logger.info(f"Deleted {deleted_count} chunks for document {document_id}")
            return deleted_count
            
        except ClientError as e:
            logger.error(f"Error deleting document chunks: {e}")
            raise
    
    def get_category_stats(self, category_id: int) -> Dict[str, Any]:
        """
        Get statistics for a specific category
        
        Args:
            category_id: Category identifier
            
        Returns:
            Dictionary with category statistics
        """
        try:
            response = self.table.scan(
                FilterExpression=Attr('category_id').eq(category_id)
            )
            
            items = response.get('Items', [])
            
            # Get unique documents in category
            unique_documents = set(item.get('base_document_id') for item in items)
            
            stats = {
                'category_id': category_id,
                'total_chunks': len(items),
                'unique_documents': len(unique_documents),
                'avg_chunks_per_document': len(items) / len(unique_documents) if unique_documents else 0
            }
            
            return stats
            
        except ClientError as e:
            logger.error(f"Error getting category stats: {e}")
            return {'category_id': category_id, 'error': str(e)}
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            Cosine similarity score (0-1)
        """
        try:
            # Convert to numpy arrays
            a = np.array(vec1, dtype=np.float32)
            b = np.array(vec2, dtype=np.float32)
            
            # Calculate cosine similarity
            dot_product = np.dot(a, b)
            norm_a = np.linalg.norm(a)
            norm_b = np.linalg.norm(b)
            
            if norm_a == 0 or norm_b == 0:
                return 0.0
            
            similarity = dot_product / (norm_a * norm_b)
            
            # Ensure result is between 0 and 1
            return max(0.0, min(1.0, float(similarity)))
            
        except Exception as e:
            logger.warning(f"Error calculating cosine similarity: {e}")
            return 0.0
    
    def _convert_to_dynamodb_format(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert data to DynamoDB-compatible format
        Handles float conversion to Decimal for DynamoDB
        
        Args:
            data: Dictionary to convert
            
        Returns:
            DynamoDB-compatible dictionary
        """
        if not isinstance(data, dict):
            return data
        
        converted = {}
        for key, value in data.items():
            if isinstance(value, float):
                converted[key] = Decimal(str(value))
            elif isinstance(value, dict):
                converted[key] = self._convert_to_dynamodb_format(value)
            elif isinstance(value, list):
                converted[key] = [
                    Decimal(str(item)) if isinstance(item, float) else item 
                    for item in value
                ]
            else:
                converted[key] = value
        
        return converted
    
    def _convert_from_dynamodb_format(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert DynamoDB format back to regular Python types
        
        Args:
            data: DynamoDB data dictionary
            
        Returns:
            Regular Python dictionary
        """
        if not isinstance(data, dict):
            return data
        
        converted = {}
        for key, value in data.items():
            if isinstance(value, Decimal):
                converted[key] = float(value)
            elif isinstance(value, dict):
                converted[key] = self._convert_from_dynamodb_format(value)
            elif isinstance(value, list):
                converted[key] = [
                    float(item) if isinstance(item, Decimal) else item 
                    for item in value
                ]
            else:
                converted[key] = value
        
        return converted
    
    def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on the vector store
        
        Returns:
            Health status dictionary
        """
        try:
            # Get table status
            table_status = self.table.table_status
            
            # Count total items (sample scan)
            response = self.table.scan(
                Select='COUNT',
                Limit=100
            )
            
            return {
                'status': 'healthy',
                'table_name': self.table_name,
                'table_status': table_status,
                'sample_item_count': response.get('Count', 0),
                'scanned_count': response.get('ScannedCount', 0)
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'table_name': self.table_name,
                'error': str(e)
            }


# Utility functions for integration
def create_vector_store(table_name: str = None) -> VectorStore:
    """
    Factory function to create VectorStore instance
    
    Args:
        table_name: Optional custom table name
        
    Returns:
        VectorStore instance
    """
    if table_name is None:
        # Use environment variable or default
        import os
        table_name = os.getenv('DYNAMODB_VECTORS_TABLE', 'prod-beacon-vectors')
    
    return VectorStore(table_name=table_name)


if __name__ == "__main__":
    # Test the vector store
    try:
        store = create_vector_store()
        
        # Health check
        health = store.health_check()
        print(f"Vector Store Health: {json.dumps(health, indent=2)}")
        
        # Test with dummy data
        test_embedding = np.random.rand(1536).astype(np.float32)
        
        test_chunk = DocumentChunk(
            document_id="test_doc_1",
            chunk_index=0,
            content="This is a test document chunk for vector store testing.",
            embedding=test_embedding,
            metadata={
                "title": "Test Document",
                "source": "unit_test",
                "chunk_size": 50
            },
            category_id=1
        )
        
        # Add test chunk
        print("Adding test chunk...")
        store.add_document_chunks([test_chunk])
        
        # Search for similar chunks
        print("Searching for similar chunks...")
        results = store.search_similar(
            query_embedding=test_embedding,
            top_k=5
        )
        
        print(f"Found {len(results)} similar chunks:")
        for result in results:
            print(f"  - Document: {result.document_id}")
            print(f"    Similarity: {result.similarity_score:.4f}")
            print(f"    Content: {result.content[:100]}...")
        
        # Clean up test data
        print("Cleaning up test data...")
        deleted = store.delete_document("test_doc_1")
        print(f"Deleted {deleted} test chunks")
        
    except Exception as e:
        print(f"Test failed: {e}")