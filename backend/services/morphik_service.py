"""
Morphik API Integration Service
Provides integration with Morphik AI platform for multimodal document processing and querying
"""

import requests
import json
import logging
import os
from typing import Dict, List, Optional, Any, Union
from urllib.parse import urlparse
import time

logger = logging.getLogger(__name__)

class MorphikError(Exception):
    """Base exception for Morphik service errors"""
    pass

class MorphikConnectionError(MorphikError):
    """Connection or authentication errors"""
    pass

class MorphikQueryError(MorphikError):
    """Query execution errors"""
    pass

class MorphikService:
    """
    Morphik AI API Integration Service
    
    Provides connection and query functionality for Morphik AI platform
    supporting multimodal document analysis and retrieval.
    Implements SDK-style interface similar to official Morphik SDK.
    """
    
    def __init__(self, uri: str = None, timeout: int = 30):
        """
        Initialize Morphik service
        
        Args:
            uri: Morphik URI in format "morphik://<owner_id>:<token>@<host>"
            timeout: Request timeout in seconds
        """
        self.uri = uri
        self.timeout = timeout
        self.session = requests.Session()
        self.documents = {}  # Cache for document metadata
        
        # Parse URI and extract components
        if uri:
            self._parse_uri(uri)
        else:
            raise MorphikError("Morphik URI is required")
            
        # Configure session with authentication
        self._configure_session()
        
        # Test connection
        self._test_connection()
    
    def _parse_uri(self, uri: str):
        """Parse Morphik URI and extract connection parameters"""
        try:
            if not uri.startswith('morphik://'):
                raise ValueError("URI must start with 'morphik://'")
            
            # Parse the URI: morphik://owner_id:token@host
            parsed = urlparse(uri)
            
            if not parsed.username or not parsed.password or not parsed.hostname:
                raise ValueError("URI must include owner_id, token, and host")
            
            self.owner_id = parsed.username
            self.token = parsed.password
            self.host = parsed.hostname
            self.port = parsed.port if parsed.port else (443 if parsed.scheme == 'https' else 80)
            
            # Construct base API URL
            protocol = 'https' if 'api.morphik.ai' in self.host else 'http'
            self.base_url = f"{protocol}://{self.host}"
            
            logger.info(f"Initialized Morphik connection to {self.host}")
            
        except Exception as e:
            logger.error(f"Failed to parse Morphik URI: {e}")
            raise MorphikConnectionError(f"Invalid Morphik URI: {e}")
    
    def _configure_session(self):
        """Configure HTTP session with authentication and headers"""
        self.session.headers.update({
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'BEACON-Backend/1.0'
        })
        self.session.timeout = self.timeout
    
    def _test_connection(self):
        """Test connection to Morphik API"""
        try:
            response = self._make_request('GET', '/ping-health')
            if response.get('status') != 'ok':
                raise MorphikConnectionError("Health check failed")
            logger.info("Morphik API connection verified")
        except Exception as e:
            logger.warning(f"Morphik connection test failed: {e}")
            # Don't raise error here - allow service to be created but mark as unavailable
    
    def _make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> Dict:
        """
        Make HTTP request to Morphik API
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            data: Request body data
            params: Query parameters
            
        Returns:
            Response data as dictionary
        """
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, params=params)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, params=params)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, params=params)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, params=params)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            # Check for HTTP errors
            response.raise_for_status()
            
            # Parse JSON response
            try:
                return response.json()
            except json.JSONDecodeError:
                return {"message": response.text}
                
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error: {e}")
            raise MorphikConnectionError(f"Failed to connect to Morphik API: {e}")
        except requests.exceptions.Timeout as e:
            logger.error(f"Request timeout: {e}")
            raise MorphikConnectionError(f"Morphik API request timed out: {e}")
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error: {e}")
            error_msg = f"Morphik API error ({response.status_code})"
            
            # Check for token/quota limit errors
            if response.status_code == 429:  # Too Many Requests
                raise MorphikError("Morphik AI 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요.")
            elif response.status_code == 402:  # Payment Required
                raise MorphikError("Morphik AI 토큰이 부족합니다. 계정의 사용 한도를 확인해주세요.")
            elif response.status_code == 403:  # Forbidden
                try:
                    error_data = response.json()
                    error_text = error_data.get('message', '').lower()
                    if any(keyword in error_text for keyword in ['token', 'quota', 'limit', 'exceeded', 'usage']):
                        raise MorphikError("Morphik AI 사용 한도가 초과되었습니다. 계정 설정을 확인해주세요.")
                except:
                    pass
                raise MorphikError("Morphik AI 서비스에 대한 접근이 거부되었습니다. 인증 정보를 확인해주세요.")
            
            try:
                error_data = response.json()
                if 'message' in error_data:
                    error_text = error_data['message'].lower()
                    # Check for common quota/limit error messages
                    if any(keyword in error_text for keyword in ['token limit', 'quota exceeded', 'usage limit', 'rate limit']):
                        raise MorphikError("Morphik AI의 사용 한도를 초과했습니다. 계정의 토큰 한도를 확인하고 잠시 후 다시 시도해주세요.")
                    error_msg += f": {error_data['message']}"
            except:
                error_msg += f": {response.text}"
                # Check response text for quota indicators
                if any(keyword in response.text.lower() for keyword in ['token', 'quota', 'limit', 'exceeded']):
                    raise MorphikError("Morphik AI 서비스의 사용 한도가 초과되었습니다. 계정 상태를 확인해주세요.")
                    
            raise MorphikError(error_msg)
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            raise MorphikError(f"Unexpected error: {e}")
    
    def ping(self) -> Dict:
        """
        Ping Morphik service for health check
        
        Returns:
            Health status response
        """
        try:
            return self._make_request('GET', '/ping-health')
        except Exception as e:
            logger.error(f"Morphik ping failed: {e}")
            return {"status": "error", "message": str(e)}
    
    def query(self, 
              query: str,
              filters: Optional[Dict] = None,
              k: int = 4,
              min_score: float = 0.0,
              max_tokens: Optional[int] = None,
              temperature: float = 0.7,
              use_reranking: bool = False,
              use_colpali: bool = False,
              document_ids: Optional[List[str]] = None) -> Dict:
        """
        Query Morphik for completion with context retrieval
        
        Args:
            query: Query text
            filters: Optional metadata filters
            k: Number of chunks to use as context
            min_score: Minimum similarity threshold
            max_tokens: Maximum tokens in completion
            temperature: Model temperature
            use_reranking: Whether to use reranking
            use_colpali: Whether to use ColPali-style embedding
            
        Returns:
            Query response with completion and metadata
        """
        try:
            start_time = time.time()
            
            request_data = {
                "query": query,
                "k": k,
                "min_score": min_score,
                "temperature": temperature,
                "use_reranking": use_reranking,
                "use_colpali": use_colpali
            }
            
            if filters:
                request_data["filters"] = filters
            if max_tokens:
                request_data["max_tokens"] = max_tokens
            if document_ids:
                request_data["document_ids"] = document_ids
            
            logger.info(f"Sending Morphik query: {query[:100]}...")
            
            response = self._make_request('POST', '/query', data=request_data)
            
            processing_time = time.time() - start_time
            
            # Format response for BEACON compatibility
            formatted_response = {
                "response": response.get("completion", ""),
                "model_used": "morphik-ai",
                "processing_time": processing_time,
                "tokens_used": {
                    "input_tokens": response.get("usage", {}).get("prompt_tokens", 0),
                    "output_tokens": response.get("usage", {}).get("completion_tokens", 0),
                    "total_tokens": response.get("usage", {}).get("total_tokens", 0)
                },
                "morphik_metadata": {
                    "chunks_retrieved": len(response.get("sources", [])),
                    "min_score": min_score,
                    "use_reranking": use_reranking,
                    "use_colpali": use_colpali,
                    "sources_found": response.get("sources", [])
                },
                "confidence_score": min(1.0, len(response.get("sources", [])) * 0.2 + 0.3),
                "morphik_response": True,
                "timestamp": time.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            logger.info(f"Morphik query completed in {processing_time:.2f}s")
            return formatted_response
            
        except Exception as e:
            logger.error(f"Morphik query failed: {e}")
            raise MorphikQueryError(f"Query failed: {e}")
    
    def retrieve_chunks(self,
                       query: str,
                       filters: Optional[Dict] = None,
                       k: int = 5,
                       min_score: float = 0.0) -> List[Dict]:
        """
        Retrieve relevant document chunks without completion
        
        Args:
            query: Query text
            filters: Optional metadata filters
            k: Number of chunks to retrieve
            min_score: Minimum similarity threshold
            
        Returns:
            List of relevant chunks with metadata
        """
        try:
            request_data = {
                "query": query,
                "k": k,
                "min_score": min_score
            }
            
            if filters:
                request_data["filters"] = filters
            
            response = self._make_request('POST', '/retrieve-chunks', data=request_data)
            
            # Format chunks for consistency
            chunks = []
            for chunk in response.get("chunks", []):
                formatted_chunk = {
                    "content": chunk.get("content", ""),
                    "score": chunk.get("score", 0.0),
                    "document_id": chunk.get("document_id", ""),
                    "chunk_number": chunk.get("chunk_number", 0),
                    "metadata": chunk.get("metadata", {})
                }
                chunks.append(formatted_chunk)
            
            return chunks
            
        except Exception as e:
            logger.error(f"Morphik chunk retrieval failed: {e}")
            raise MorphikQueryError(f"Chunk retrieval failed: {e}")
    
    def ingest_text(self,
                   text: str,
                   metadata: Optional[Dict] = None,
                   filename: Optional[str] = None) -> Dict:
        """
        Ingest text content into Morphik
        
        Args:
            text: Text content to ingest
            metadata: Optional metadata
            filename: Optional filename
            
        Returns:
            Ingestion result with document ID
        """
        try:
            request_data = {
                "text": text
            }
            
            if metadata:
                request_data["metadata"] = metadata
            if filename:
                request_data["filename"] = filename
            
            response = self._make_request('POST', '/ingestion/ingest-text', data=request_data)
            
            return {
                "success": True,
                "document_id": response.get("external_id", ""),
                "status": response.get("status", "completed"),
                "message": "Text ingested successfully"
            }
            
        except Exception as e:
            logger.error(f"Morphik text ingestion failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Text ingestion failed"
            }
    
    def get_available_models(self) -> List[Dict]:
        """
        Get available models from Morphik
        
        Returns:
            List of available models
        """
        try:
            response = self._make_request('GET', '/get-available-models')
            
            models = []
            for model in response.get("models", []):
                models.append({
                    "model_id": model.get("id", "morphik-default"),
                    "name": model.get("name", "Morphik AI"),
                    "description": model.get("description", "Morphik AI Model"),
                    "provider": "morphik"
                })
            
            return models
            
        except Exception as e:
            logger.error(f"Failed to get Morphik models: {e}")
            return [{
                "model_id": "morphik-default",
                "name": "Morphik AI",
                "description": "Morphik AI Default Model",
                "provider": "morphik"
            }]
    
    def list_documents(self, 
                      filters: Optional[Dict] = None,
                      limit: int = 50,
                      offset: int = 0) -> Dict:
        """
        List documents in Morphik
        
        Args:
            filters: Optional metadata filters
            limit: Maximum number of documents to return
            offset: Number of documents to skip
            
        Returns:
            List of documents with metadata
        """
        try:
            request_data = {
                "limit": limit,
                "offset": offset
            }
            
            if filters:
                request_data["filters"] = filters
            
            response = self._make_request('POST', '/list-documents', data=request_data)
            
            documents = []
            for doc in response.get("documents", []):
                documents.append({
                    "id": doc.get("external_id", ""),
                    "filename": doc.get("filename", ""),
                    "content_type": doc.get("content_type", ""),
                    "metadata": doc.get("metadata", {}),
                    "status": doc.get("status", "completed"),
                    "created_at": doc.get("created_at", "")
                })
            
            return {
                "documents": documents,
                "total_count": response.get("total_count", len(documents)),
                "has_more": response.get("has_more", False)
            }
            
        except Exception as e:
            logger.error(f"Failed to list Morphik documents: {e}")
            return {"documents": [], "total_count": 0, "has_more": False}
    
    def close(self):
        """Close the HTTP session"""
        if self.session:
            self.session.close()
            logger.info("Morphik session closed")

def create_morphik_service(config: Dict) -> Optional[MorphikService]:
    """
    Factory function to create Morphik service
    
    Args:
        config: Configuration dictionary with Morphik settings
        
    Returns:
        MorphikService instance or None if configuration is invalid
    """
    try:
        uri = config.get('MORPHIK_URI')
        timeout = config.get('MORPHIK_TIMEOUT', 30)
        
        if not uri:
            logger.warning("Morphik URI not provided, service unavailable")
            return None
        
        service = MorphikService(uri=uri, timeout=timeout)
        logger.info("Morphik service created successfully")
        return service
        
    except Exception as e:
        logger.error(f"Failed to create Morphik service: {e}")
        return None