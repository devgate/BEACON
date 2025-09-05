"""
Test suite for MorphikService class
Tests Morphik API integration service following TDD principles
"""
import pytest
import json
import time
from unittest.mock import Mock, patch, MagicMock, call
import requests
from requests.exceptions import ConnectionError, Timeout, HTTPError

from services.morphik_service import (
    MorphikService, 
    MorphikError, 
    MorphikConnectionError, 
    MorphikQueryError, 
    create_morphik_service
)


class TestMorphikServiceUriParsing:
    """Test URI parsing functionality"""
    
    def test_parse_valid_uri(self):
        """Test parsing valid Morphik URI"""
        uri = "morphik://sdu-test-app:token123@api.morphik.ai"
        
        with patch.object(MorphikService, '_configure_session'), \
             patch.object(MorphikService, '_test_connection'):
            service = MorphikService(uri=uri)
            
            assert service.owner_id == "sdu-test-app"
            assert service.token == "token123"
            assert service.host == "api.morphik.ai"
            assert service.base_url == "https://api.morphik.ai"
    
    def test_parse_uri_with_custom_host(self):
        """Test parsing URI with custom host"""
        uri = "morphik://owner:token@custom.host.com"
        
        with patch.object(MorphikService, '_configure_session'), \
             patch.object(MorphikService, '_test_connection'):
            service = MorphikService(uri=uri)
            
            assert service.owner_id == "owner"
            assert service.token == "token"
            assert service.host == "custom.host.com"
            assert service.base_url == "http://custom.host.com"
    
    def test_parse_uri_with_port(self):
        """Test parsing URI with custom port"""
        uri = "morphik://owner:token@api.morphik.ai:8080"
        
        with patch.object(MorphikService, '_configure_session'), \
             patch.object(MorphikService, '_test_connection'):
            service = MorphikService(uri=uri)
            
            assert service.port == 8080
    
    def test_parse_uri_invalid_scheme(self):
        """Test parsing URI with invalid scheme"""
        uri = "http://owner:token@api.morphik.ai"
        
        with pytest.raises(MorphikConnectionError, match="Invalid Morphik URI"):
            MorphikService(uri=uri)
    
    def test_parse_uri_missing_owner(self):
        """Test parsing URI without owner ID"""
        uri = "morphik://:token@api.morphik.ai"
        
        with pytest.raises(MorphikConnectionError, match="Invalid Morphik URI"):
            MorphikService(uri=uri)
    
    def test_parse_uri_missing_token(self):
        """Test parsing URI without token"""
        uri = "morphik://owner:@api.morphik.ai"
        
        with pytest.raises(MorphikConnectionError, match="Invalid Morphik URI"):
            MorphikService(uri=uri)
    
    def test_parse_uri_missing_host(self):
        """Test parsing URI without host"""
        uri = "morphik://owner:token@"
        
        with pytest.raises(MorphikConnectionError, match="Invalid Morphik URI"):
            MorphikService(uri=uri)
    
    def test_parse_uri_malformed(self):
        """Test parsing malformed URI"""
        uri = "not-a-valid-uri"
        
        with pytest.raises(MorphikConnectionError, match="Invalid Morphik URI"):
            MorphikService(uri=uri)
    
    def test_requires_uri(self):
        """Test that URI is required"""
        with pytest.raises(MorphikError, match="Morphik URI is required"):
            MorphikService(uri=None)


class TestMorphikServiceSession:
    """Test HTTP session configuration"""
    
    @pytest.fixture
    def mock_service(self):
        """Create mock service with valid URI"""
        uri = "morphik://owner:token123@api.morphik.ai"
        with patch.object(MorphikService, '_test_connection'):
            service = MorphikService(uri=uri)
            return service
    
    def test_session_configuration(self, mock_service):
        """Test HTTP session is configured properly"""
        session = mock_service.session
        
        assert session.headers['Authorization'] == 'Bearer token123'
        assert session.headers['Content-Type'] == 'application/json'
        assert session.headers['Accept'] == 'application/json'
        assert session.headers['User-Agent'] == 'BEACON-Backend/1.0'
        assert session.timeout == 30  # default timeout
    
    def test_custom_timeout(self):
        """Test custom timeout configuration"""
        uri = "morphik://owner:token@api.morphik.ai"
        with patch.object(MorphikService, '_test_connection'):
            service = MorphikService(uri=uri, timeout=60)
            assert service.timeout == 60
            assert service.session.timeout == 60


class TestMorphikServiceConnection:
    """Test connection and health check functionality"""
    
    @pytest.fixture
    def mock_service(self):
        """Create mock service without connection test"""
        uri = "morphik://owner:token@api.morphik.ai"
        with patch.object(MorphikService, '_test_connection'):
            return MorphikService(uri=uri)
    
    @patch('requests.Session.get')
    def test_ping_success(self, mock_get, mock_service):
        """Test successful ping response"""
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"status": "ok", "message": "Service healthy"}
        mock_get.return_value = mock_response
        
        result = mock_service.ping()
        
        assert result["status"] == "ok"
        assert result["message"] == "Service healthy"
        mock_get.assert_called_once_with('https://api.morphik.ai/ping-health', params=None)
    
    @patch('requests.Session.get')
    def test_ping_connection_error(self, mock_get, mock_service):
        """Test ping with connection error"""
        mock_get.side_effect = ConnectionError("Connection failed")
        
        result = mock_service.ping()
        
        assert result["status"] == "error"
        assert "Connection failed" in result["message"]
    
    @patch('requests.Session.get')
    def test_ping_timeout_error(self, mock_get, mock_service):
        """Test ping with timeout error"""
        mock_get.side_effect = Timeout("Request timed out")
        
        result = mock_service.ping()
        
        assert result["status"] == "error"
        assert "Request timed out" in result["message"]
    
    @patch('requests.Session.get')
    def test_test_connection_success(self, mock_get):
        """Test successful connection test during initialization"""
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"status": "ok"}
        mock_get.return_value = mock_response
        
        uri = "morphik://owner:token@api.morphik.ai"
        service = MorphikService(uri=uri)  # Should not raise exception
        
        assert service.owner_id == "owner"
    
    @patch('requests.Session.get')
    def test_test_connection_failure_warning_only(self, mock_get):
        """Test that connection test failure only logs warning"""
        mock_get.side_effect = ConnectionError("Connection failed")
        
        uri = "morphik://owner:token@api.morphik.ai"
        # Should create service despite connection failure
        service = MorphikService(uri=uri)
        
        assert service.owner_id == "owner"


class TestMorphikServiceRequests:
    """Test HTTP request handling"""
    
    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        uri = "morphik://owner:token@api.morphik.ai"
        with patch.object(MorphikService, '_test_connection'):
            return MorphikService(uri=uri)
    
    @patch('requests.Session.get')
    def test_make_request_get(self, mock_get, mock_service):
        """Test making GET request"""
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"result": "success"}
        mock_get.return_value = mock_response
        
        result = mock_service._make_request('GET', '/test-endpoint', params={"key": "value"})
        
        assert result == {"result": "success"}
        mock_get.assert_called_once_with('https://api.morphik.ai/test-endpoint', params={"key": "value"})
    
    @patch('requests.Session.post')
    def test_make_request_post(self, mock_post, mock_service):
        """Test making POST request"""
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"result": "created"}
        mock_post.return_value = mock_response
        
        data = {"message": "test"}
        result = mock_service._make_request('POST', '/test-endpoint', data=data)
        
        assert result == {"result": "created"}
        mock_post.assert_called_once_with('https://api.morphik.ai/test-endpoint', json=data, params=None)
    
    @patch('requests.Session.get')
    def test_make_request_connection_error(self, mock_get, mock_service):
        """Test connection error handling"""
        mock_get.side_effect = ConnectionError("Network error")
        
        with pytest.raises(MorphikConnectionError, match="Failed to connect to Morphik API"):
            mock_service._make_request('GET', '/test-endpoint')
    
    @patch('requests.Session.get')
    def test_make_request_timeout_error(self, mock_get, mock_service):
        """Test timeout error handling"""
        mock_get.side_effect = Timeout("Request timeout")
        
        with pytest.raises(MorphikConnectionError, match="Morphik API request timed out"):
            mock_service._make_request('GET', '/test-endpoint')
    
    @patch('requests.Session.get')
    def test_make_request_http_error(self, mock_get, mock_service):
        """Test HTTP error handling"""
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.raise_for_status.side_effect = HTTPError("400 Client Error")
        mock_response.json.return_value = {"message": "Bad request"}
        mock_get.return_value = mock_response
        
        with pytest.raises(MorphikError, match="Morphik API error \\(400\\): Bad request"):
            mock_service._make_request('GET', '/test-endpoint')
    
    @patch('requests.Session.get')
    def test_make_request_json_decode_error(self, mock_get, mock_service):
        """Test JSON decode error fallback"""
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)
        mock_response.text = "Plain text response"
        mock_get.return_value = mock_response
        
        result = mock_service._make_request('GET', '/test-endpoint')
        
        assert result == {"message": "Plain text response"}
    
    def test_make_request_unsupported_method(self, mock_service):
        """Test unsupported HTTP method"""
        with pytest.raises(ValueError, match="Unsupported HTTP method: PATCH"):
            mock_service._make_request('PATCH', '/test-endpoint')


class TestMorphikServiceQuery:
    """Test query functionality"""
    
    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        uri = "morphik://owner:token@api.morphik.ai"
        with patch.object(MorphikService, '_test_connection'):
            return MorphikService(uri=uri)
    
    @patch('requests.Session.post')
    def test_query_success(self, mock_post, mock_service):
        """Test successful query"""
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "completion": "This is the AI response",
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30,
            "chunks_used": 4,
            "average_score": 0.8
        }
        mock_post.return_value = mock_response
        
        result = mock_service.query(
            query="What is AI?",
            k=4,
            min_score=0.5,
            temperature=0.7
        )
        
        assert result["response"] == "This is the AI response"
        assert result["model_used"] == "morphik-ai"
        assert result["tokens_used"]["input_tokens"] == 10
        assert result["tokens_used"]["output_tokens"] == 20
        assert result["tokens_used"]["total_tokens"] == 30
        assert result["morphik_metadata"]["chunks_retrieved"] == 4
        assert result["morphik_metadata"]["min_score"] == 0.5
        assert result["confidence_score"] == 1.0  # min(1.0, 0.8 + 0.2)
        assert result["morphik_response"] is True
        assert "processing_time" in result
        assert "timestamp" in result
        
        # Verify request data
        expected_data = {
            "query": "What is AI?",
            "k": 4,
            "min_score": 0.5,
            "temperature": 0.7,
            "use_reranking": False,
            "use_colpali": False
        }
        mock_post.assert_called_once_with('https://api.morphik.ai/query', json=expected_data, params=None)
    
    @patch('requests.Session.post')
    def test_query_with_all_parameters(self, mock_post, mock_service):
        """Test query with all optional parameters"""
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "completion": "Response with filters",
            "prompt_tokens": 15,
            "completion_tokens": 25,
            "total_tokens": 40,
            "chunks_used": 3
        }
        mock_post.return_value = mock_response
        
        filters = {"category": "technical"}
        result = mock_service.query(
            query="Technical question",
            filters=filters,
            k=3,
            min_score=0.7,
            max_tokens=1000,
            temperature=0.3,
            use_reranking=True,
            use_colpali=True
        )
        
        assert result["response"] == "Response with filters"
        
        # Verify request includes all parameters
        expected_data = {
            "query": "Technical question",
            "filters": {"category": "technical"},
            "k": 3,
            "min_score": 0.7,
            "max_tokens": 1000,
            "temperature": 0.3,
            "use_reranking": True,
            "use_colpali": True
        }
        mock_post.assert_called_once_with('https://api.morphik.ai/query', json=expected_data, params=None)
    
    @patch('requests.Session.post')
    def test_query_failure(self, mock_post, mock_service):
        """Test query failure handling"""
        mock_post.side_effect = ConnectionError("Network error")
        
        with pytest.raises(MorphikQueryError, match="Query failed"):
            mock_service.query(query="Test query")


class TestMorphikServiceRetrieveChunks:
    """Test chunk retrieval functionality"""
    
    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        uri = "morphik://owner:token@api.morphik.ai"
        with patch.object(MorphikService, '_test_connection'):
            return MorphikService(uri=uri)
    
    @patch('requests.Session.post')
    def test_retrieve_chunks_success(self, mock_post, mock_service):
        """Test successful chunk retrieval"""
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "chunks": [
                {
                    "content": "First chunk content",
                    "score": 0.95,
                    "document_id": "doc1",
                    "chunk_number": 1,
                    "metadata": {"section": "intro"}
                },
                {
                    "content": "Second chunk content",
                    "score": 0.87,
                    "document_id": "doc2",
                    "chunk_number": 3,
                    "metadata": {"section": "body"}
                }
            ]
        }
        mock_post.return_value = mock_response
        
        result = mock_service.retrieve_chunks(
            query="Search query",
            k=5,
            min_score=0.8
        )
        
        assert len(result) == 2
        
        # Check first chunk
        chunk1 = result[0]
        assert chunk1["content"] == "First chunk content"
        assert chunk1["score"] == 0.95
        assert chunk1["document_id"] == "doc1"
        assert chunk1["chunk_number"] == 1
        assert chunk1["metadata"]["section"] == "intro"
        
        # Check second chunk
        chunk2 = result[1]
        assert chunk2["content"] == "Second chunk content"
        assert chunk2["score"] == 0.87
        
        # Verify request
        expected_data = {
            "query": "Search query",
            "k": 5,
            "min_score": 0.8
        }
        mock_post.assert_called_once_with('https://api.morphik.ai/retrieve-chunks', json=expected_data, params=None)
    
    @patch('requests.Session.post')
    def test_retrieve_chunks_with_filters(self, mock_post, mock_service):
        """Test chunk retrieval with filters"""
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"chunks": []}
        mock_post.return_value = mock_response
        
        filters = {"document_type": "pdf"}
        mock_service.retrieve_chunks(
            query="Test",
            filters=filters,
            k=3,
            min_score=0.5
        )
        
        expected_data = {
            "query": "Test",
            "filters": {"document_type": "pdf"},
            "k": 3,
            "min_score": 0.5
        }
        mock_post.assert_called_once_with('https://api.morphik.ai/retrieve-chunks', json=expected_data, params=None)
    
    @patch('requests.Session.post')
    def test_retrieve_chunks_failure(self, mock_post, mock_service):
        """Test chunk retrieval failure"""
        mock_post.side_effect = ConnectionError("Network error")
        
        with pytest.raises(MorphikQueryError, match="Chunk retrieval failed"):
            mock_service.retrieve_chunks(query="Test")


class TestMorphikServiceIngestText:
    """Test text ingestion functionality"""
    
    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        uri = "morphik://owner:token@api.morphik.ai"
        with patch.object(MorphikService, '_test_connection'):
            return MorphikService(uri=uri)
    
    @patch('requests.Session.post')
    def test_ingest_text_success(self, mock_post, mock_service):
        """Test successful text ingestion"""
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "external_id": "doc_123",
            "status": "completed"
        }
        mock_post.return_value = mock_response
        
        result = mock_service.ingest_text(
            text="This is test content",
            metadata={"source": "test"},
            filename="test.txt"
        )
        
        assert result["success"] is True
        assert result["document_id"] == "doc_123"
        assert result["status"] == "completed"
        assert result["message"] == "Text ingested successfully"
        
        expected_data = {
            "text": "This is test content",
            "metadata": {"source": "test"},
            "filename": "test.txt"
        }
        mock_post.assert_called_once_with('https://api.morphik.ai/ingestion/ingest-text', json=expected_data, params=None)
    
    @patch('requests.Session.post')
    def test_ingest_text_minimal(self, mock_post, mock_service):
        """Test text ingestion with minimal parameters"""
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"external_id": "doc_456", "status": "completed"}
        mock_post.return_value = mock_response
        
        result = mock_service.ingest_text(text="Simple text")
        
        assert result["success"] is True
        assert result["document_id"] == "doc_456"
        
        expected_data = {"text": "Simple text"}
        mock_post.assert_called_once_with('https://api.morphik.ai/ingestion/ingest-text', json=expected_data, params=None)
    
    @patch('requests.Session.post')
    def test_ingest_text_failure(self, mock_post, mock_service):
        """Test text ingestion failure"""
        mock_post.side_effect = ConnectionError("Network error")
        
        result = mock_service.ingest_text(text="Test content")
        
        assert result["success"] is False
        assert "Network error" in result["error"]
        assert result["message"] == "Text ingestion failed"


class TestMorphikServiceOtherMethods:
    """Test other service methods"""
    
    @pytest.fixture
    def mock_service(self):
        """Create mock service"""
        uri = "morphik://owner:token@api.morphik.ai"
        with patch.object(MorphikService, '_test_connection'):
            return MorphikService(uri=uri)
    
    @patch('requests.Session.get')
    def test_get_available_models_success(self, mock_get, mock_service):
        """Test getting available models"""
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "models": [
                {"id": "model1", "name": "Model 1", "description": "First model"},
                {"id": "model2", "name": "Model 2", "description": "Second model"}
            ]
        }
        mock_get.return_value = mock_response
        
        result = mock_service.get_available_models()
        
        assert len(result) == 2
        assert result[0]["model_id"] == "model1"
        assert result[0]["name"] == "Model 1"
        assert result[0]["provider"] == "morphik"
        assert result[1]["model_id"] == "model2"
    
    @patch('requests.Session.get')
    def test_get_available_models_failure(self, mock_get, mock_service):
        """Test getting models when API fails"""
        mock_get.side_effect = ConnectionError("Network error")
        
        result = mock_service.get_available_models()
        
        assert len(result) == 1
        assert result[0]["model_id"] == "morphik-default"
        assert result[0]["name"] == "Morphik AI"
    
    @patch('requests.Session.post')
    def test_list_documents_success(self, mock_post, mock_service):
        """Test listing documents"""
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "documents": [
                {
                    "external_id": "doc1",
                    "filename": "test1.pdf",
                    "content_type": "pdf",
                    "metadata": {"category": "finance"},
                    "status": "completed",
                    "created_at": "2024-01-01T00:00:00Z"
                }
            ],
            "total_count": 1,
            "has_more": False
        }
        mock_post.return_value = mock_response
        
        result = mock_service.list_documents(limit=10, offset=0)
        
        assert len(result["documents"]) == 1
        assert result["total_count"] == 1
        assert result["has_more"] is False
        
        doc = result["documents"][0]
        assert doc["id"] == "doc1"
        assert doc["filename"] == "test1.pdf"
    
    def test_close_session(self, mock_service):
        """Test closing HTTP session"""
        session_mock = Mock()
        mock_service.session = session_mock
        
        mock_service.close()
        
        session_mock.close.assert_called_once()


class TestMorphikServiceFactory:
    """Test factory function"""
    
    @patch.object(MorphikService, '__init__', return_value=None)
    def test_create_morphik_service_success(self, mock_init):
        """Test successful service creation"""
        config = {
            'MORPHIK_URI': 'morphik://owner:token@api.morphik.ai',
            'MORPHIK_TIMEOUT': 45
        }
        
        result = create_morphik_service(config)
        
        assert result is not None
        mock_init.assert_called_once_with(uri='morphik://owner:token@api.morphik.ai', timeout=45)
    
    def test_create_morphik_service_no_uri(self):
        """Test service creation without URI"""
        config = {}
        
        result = create_morphik_service(config)
        
        assert result is None
    
    @patch.object(MorphikService, '__init__', side_effect=Exception("Connection failed"))
    def test_create_morphik_service_failure(self, mock_init):
        """Test service creation failure"""
        config = {'MORPHIK_URI': 'invalid://uri'}
        
        result = create_morphik_service(config)
        
        assert result is None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])