"""
Test suite for Morphik API Blueprint
Tests Morphik REST API endpoints following TDD principles
"""
import pytest
import json
import time
from unittest.mock import Mock, patch, MagicMock

from app import create_app
from api.morphik import morphik_bp, init_morphik_module
from services.morphik_service import MorphikService, MorphikConnectionError, MorphikQueryError


class TestMorphikAPIInitialization:
    """Test module initialization"""
    
    def test_init_morphik_module_with_service(self):
        """Test module initialization with service"""
        mock_service = Mock(spec=MorphikService)
        context = {'morphik_service': mock_service}
        
        init_morphik_module(context)
        
        # Should set global variables
        from api.morphik import morphik_service
        assert morphik_service == mock_service
    
    def test_init_morphik_module_without_service(self):
        """Test module initialization without service"""
        context = {}
        
        init_morphik_module(context)
        
        # Should handle missing service gracefully
        from api.morphik import morphik_service
        assert morphik_service is None


class TestMorphikHealthEndpoint:
    """Test /api/morphik/health endpoint"""
    
    @pytest.fixture
    def app(self):
        """Create test app"""
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_health_endpoint_service_unavailable(self, client):
        """Test health endpoint when service is unavailable"""
        # Initialize with no service
        init_morphik_module({})
        
        response = client.get('/api/morphik/health')
        
        assert response.status_code == 503
        data = response.get_json()
        assert data['status'] == 'unavailable'
        assert data['morphik_enabled'] is False
        assert 'Morphik service not configured' in data['message']
    
    def test_health_endpoint_service_healthy(self, client):
        """Test health endpoint when service is healthy"""
        mock_service = Mock(spec=MorphikService)
        mock_service.ping.return_value = {'status': 'ok', 'message': 'Service operational'}
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.get('/api/morphik/health')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'healthy'
        assert data['morphik_enabled'] is True
        assert 'Morphik service is operational' in data['message']
        assert 'morphik_response' in data
        assert 'timestamp' in data
    
    def test_health_endpoint_service_unhealthy(self, client):
        """Test health endpoint when service ping fails"""
        mock_service = Mock(spec=MorphikService)
        mock_service.ping.return_value = {'status': 'error', 'message': 'Connection failed'}
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.get('/api/morphik/health')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'unhealthy'
        assert data['morphik_enabled'] is True
    
    def test_health_endpoint_service_exception(self, client):
        """Test health endpoint when service throws exception"""
        mock_service = Mock(spec=MorphikService)
        mock_service.ping.side_effect = Exception("Service error")
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.get('/api/morphik/health')
        
        assert response.status_code == 500
        data = response.get_json()
        assert data['status'] == 'error'
        assert data['morphik_enabled'] is False
        assert 'Health check failed' in data['message']


class TestMorphikQueryEndpoint:
    """Test /api/morphik/query endpoint"""
    
    @pytest.fixture
    def app(self):
        """Create test app"""
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_query_endpoint_service_unavailable(self, client):
        """Test query endpoint when service is unavailable"""
        init_morphik_module({})
        
        response = client.post('/api/morphik/query', json={'query': 'Test question'})
        
        assert response.status_code == 503
        data = response.get_json()
        assert 'Morphik service unavailable' in data['error']
        assert data['morphik_enabled'] is False
        assert 'I apologize, but the Morphik AI service is currently unavailable' in data['response']
    
    def test_query_endpoint_no_json(self, client):
        """Test query endpoint without JSON data"""
        mock_service = Mock(spec=MorphikService)
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.post('/api/morphik/query')
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'No JSON data provided' in data['error']
    
    def test_query_endpoint_empty_query(self, client):
        """Test query endpoint with empty query"""
        mock_service = Mock(spec=MorphikService)
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.post('/api/morphik/query', json={'query': ''})
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'Query text is required' in data['error']
    
    def test_query_endpoint_missing_query(self, client):
        """Test query endpoint without query parameter"""
        mock_service = Mock(spec=MorphikService)
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.post('/api/morphik/query', json={})
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'Query text is required' in data['error']
    
    def test_query_endpoint_successful_query(self, client):
        """Test successful query execution"""
        mock_service = Mock(spec=MorphikService)
        mock_service.query.return_value = {
            'response': 'This is the AI response',
            'model_used': 'morphik-ai',
            'processing_time': 1.5,
            'tokens_used': {'input_tokens': 10, 'output_tokens': 20, 'total_tokens': 30},
            'morphik_metadata': {'chunks_retrieved': 4, 'min_score': 0.0},
            'confidence_score': 0.85,
            'morphik_response': True,
            'timestamp': '2024-01-01 12:00:00'
        }
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.post('/api/morphik/query', json={
            'query': 'What is artificial intelligence?',
            'k': 4,
            'min_score': 0.5,
            'temperature': 0.7,
            'max_tokens': 2048,
            'use_reranking': True,
            'use_colpali': False
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['response'] == 'This is the AI response'
        assert data['model_used'] == 'morphik-ai'
        assert data['morphik_enabled'] is True
        assert 'processing_time' in data
        assert 'request_params' in data
        
        # Verify service was called with correct parameters
        mock_service.query.assert_called_once_with(
            query='What is artificial intelligence?',
            filters=None,
            k=4,
            min_score=0.5,
            max_tokens=2048,
            temperature=0.7,
            use_reranking=True,
            use_colpali=False
        )
    
    def test_query_endpoint_with_filters(self, client):
        """Test query with filters"""
        mock_service = Mock(spec=MorphikService)
        mock_service.query.return_value = {
            'response': 'Filtered response',
            'morphik_response': True
        }
        init_morphik_module({'morphik_service': mock_service})
        
        filters = {'category': 'technical', 'language': 'en'}
        response = client.post('/api/morphik/query', json={
            'query': 'Technical question',
            'filters': filters
        })
        
        assert response.status_code == 200
        mock_service.query.assert_called_once_with(
            query='Technical question',
            filters=filters,
            k=4,
            min_score=0.0,
            max_tokens=None,
            temperature=0.7,
            use_reranking=False,
            use_colpali=False
        )
    
    def test_query_endpoint_parameter_validation(self, client):
        """Test parameter validation"""
        mock_service = Mock(spec=MorphikService)
        init_morphik_module({'morphik_service': mock_service})
        
        # Test invalid k value
        response = client.post('/api/morphik/query', json={
            'query': 'Test',
            'k': 25  # Should be <= 20
        })
        assert response.status_code == 400
        assert 'k must be between 1 and 20' in response.get_json()['error']
        
        # Test invalid min_score
        response = client.post('/api/morphik/query', json={
            'query': 'Test',
            'min_score': 1.5  # Should be <= 1.0
        })
        assert response.status_code == 400
        assert 'min_score must be between 0.0 and 1.0' in response.get_json()['error']
        
        # Test invalid temperature
        response = client.post('/api/morphik/query', json={
            'query': 'Test',
            'temperature': 3.0  # Should be <= 2.0
        })
        assert response.status_code == 400
        assert 'temperature must be between 0.0 and 2.0' in response.get_json()['error']
    
    def test_query_endpoint_service_error(self, client):
        """Test query endpoint when service throws error"""
        mock_service = Mock(spec=MorphikService)
        mock_service.query.side_effect = MorphikQueryError("Query failed")
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.post('/api/morphik/query', json={'query': 'Test query'})
        
        assert response.status_code == 500
        data = response.get_json()
        assert data['error'] == 'Query processing failed'
        assert 'Query failed' in data['message']
        assert data['morphik_enabled'] is False
        assert 'I apologize, but I encountered an error' in data['response']


class TestMorphikRetrieveEndpoint:
    """Test /api/morphik/retrieve endpoint"""
    
    @pytest.fixture
    def app(self):
        """Create test app"""
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_retrieve_endpoint_success(self, client):
        """Test successful chunk retrieval"""
        mock_chunks = [
            {
                'content': 'First chunk content',
                'score': 0.95,
                'document_id': 'doc1',
                'chunk_number': 1,
                'metadata': {'section': 'intro'}
            },
            {
                'content': 'Second chunk content',
                'score': 0.87,
                'document_id': 'doc2',
                'chunk_number': 2,
                'metadata': {'section': 'body'}
            }
        ]
        
        mock_service = Mock(spec=MorphikService)
        mock_service.retrieve_chunks.return_value = mock_chunks
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.post('/api/morphik/retrieve', json={
            'query': 'Search query',
            'k': 5,
            'min_score': 0.8
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['chunks']) == 2
        assert data['total_retrieved'] == 2
        assert data['query'] == 'Search query'
        assert data['morphik_enabled'] is True
        assert 'timestamp' in data
        
        # Verify first chunk
        chunk1 = data['chunks'][0]
        assert chunk1['content'] == 'First chunk content'
        assert chunk1['score'] == 0.95
    
    def test_retrieve_endpoint_with_filters(self, client):
        """Test retrieve with filters"""
        mock_service = Mock(spec=MorphikService)
        mock_service.retrieve_chunks.return_value = []
        init_morphik_module({'morphik_service': mock_service})
        
        filters = {'document_type': 'pdf'}
        response = client.post('/api/morphik/retrieve', json={
            'query': 'Test query',
            'filters': filters,
            'k': 3,
            'min_score': 0.5
        })
        
        assert response.status_code == 200
        mock_service.retrieve_chunks.assert_called_once_with(
            query='Test query',
            filters=filters,
            k=3,
            min_score=0.5
        )
    
    def test_retrieve_endpoint_parameter_validation(self, client):
        """Test parameter validation for retrieve endpoint"""
        mock_service = Mock(spec=MorphikService)
        init_morphik_module({'morphik_service': mock_service})
        
        # Test invalid k value
        response = client.post('/api/morphik/retrieve', json={
            'query': 'Test',
            'k': 100  # Should be <= 50
        })
        assert response.status_code == 400
        assert 'k must be between 1 and 50' in response.get_json()['error']
    
    def test_retrieve_endpoint_service_unavailable(self, client):
        """Test retrieve endpoint when service is unavailable"""
        init_morphik_module({})
        
        response = client.post('/api/morphik/retrieve', json={'query': 'Test'})
        
        assert response.status_code == 503
        data = response.get_json()
        assert data['error'] == 'Morphik service unavailable'
        assert data['chunks'] == []
        assert data['morphik_enabled'] is False


class TestMorphikModelsEndpoint:
    """Test /api/morphik/models endpoint"""
    
    @pytest.fixture
    def app(self):
        """Create test app"""
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_models_endpoint_success(self, client):
        """Test successful models retrieval"""
        mock_models = [
            {
                'model_id': 'morphik-gpt4',
                'name': 'Morphik GPT-4',
                'description': 'Advanced AI model',
                'provider': 'morphik'
            },
            {
                'model_id': 'morphik-claude',
                'name': 'Morphik Claude',
                'description': 'Anthropic Claude model',
                'provider': 'morphik'
            }
        ]
        
        mock_service = Mock(spec=MorphikService)
        mock_service.get_available_models.return_value = mock_models
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.get('/api/morphik/models')
        
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['models']) == 2
        assert data['total_models'] == 2
        assert data['morphik_enabled'] is True
        assert 'timestamp' in data
        
        # Check that models are marked as available
        for model in data['models']:
            assert model['available'] is True
        
        # Check first model
        model1 = data['models'][0]
        assert model1['model_id'] == 'morphik-gpt4'
        assert model1['name'] == 'Morphik GPT-4'
    
    def test_models_endpoint_service_unavailable(self, client):
        """Test models endpoint when service is unavailable"""
        init_morphik_module({})
        
        response = client.get('/api/morphik/models')
        
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['models']) == 1
        assert data['models'][0]['model_id'] == 'morphik-unavailable'
        assert data['models'][0]['available'] is False
        assert data['morphik_enabled'] is False
    
    def test_models_endpoint_service_error(self, client):
        """Test models endpoint when service throws error"""
        mock_service = Mock(spec=MorphikService)
        mock_service.get_available_models.side_effect = Exception("Service error")
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.get('/api/morphik/models')
        
        assert response.status_code == 500
        data = response.get_json()
        assert len(data['models']) == 1
        assert data['models'][0]['model_id'] == 'morphik-error'
        assert data['models'][0]['available'] is False
        assert data['morphik_enabled'] is False


class TestMorphikDocumentsEndpoint:
    """Test /api/morphik/documents endpoint"""
    
    @pytest.fixture
    def app(self):
        """Create test app"""
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_documents_endpoint_success(self, client):
        """Test successful documents listing"""
        mock_result = {
            'documents': [
                {
                    'id': 'doc1',
                    'filename': 'document1.pdf',
                    'content_type': 'pdf',
                    'metadata': {'category': 'finance'},
                    'status': 'completed',
                    'created_at': '2024-01-01T00:00:00Z'
                }
            ],
            'total_count': 1,
            'has_more': False
        }
        
        mock_service = Mock(spec=MorphikService)
        mock_service.list_documents.return_value = mock_result
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.get('/api/morphik/documents?limit=10&offset=0')
        
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['documents']) == 1
        assert data['total_count'] == 1
        assert data['has_more'] is False
        assert data['morphik_enabled'] is True
        assert 'timestamp' in data
        
        # Verify service was called with correct parameters
        mock_service.list_documents.assert_called_once_with(
            filters=None,
            limit=10,
            offset=0
        )
    
    def test_documents_endpoint_with_filters(self, client):
        """Test documents endpoint with filters"""
        mock_service = Mock(spec=MorphikService)
        mock_service.list_documents.return_value = {'documents': [], 'total_count': 0, 'has_more': False}
        init_morphik_module({'morphik_service': mock_service})
        
        filters_json = '{"category": "technical"}'
        response = client.get(f'/api/morphik/documents?filters={filters_json}')
        
        assert response.status_code == 200
        mock_service.list_documents.assert_called_once_with(
            filters={"category": "technical"},
            limit=50,  # default
            offset=0   # default
        )
    
    def test_documents_endpoint_parameter_validation(self, client):
        """Test parameter validation for documents endpoint"""
        mock_service = Mock(spec=MorphikService)
        init_morphik_module({'morphik_service': mock_service})
        
        # Test invalid limit
        response = client.get('/api/morphik/documents?limit=500')  # Should be <= 200
        assert response.status_code == 400
        assert 'limit must be between 1 and 200' in response.get_json()['error']
        
        # Test negative offset
        response = client.get('/api/morphik/documents?offset=-1')
        assert response.status_code == 400
        assert 'offset must be non-negative' in response.get_json()['error']
        
        # Test invalid filters JSON
        response = client.get('/api/morphik/documents?filters=invalid-json')
        assert response.status_code == 400
        assert 'Invalid filters JSON' in response.get_json()['error']
    
    def test_documents_endpoint_service_unavailable(self, client):
        """Test documents endpoint when service is unavailable"""
        init_morphik_module({})
        
        response = client.get('/api/morphik/documents')
        
        assert response.status_code == 503
        data = response.get_json()
        assert data['documents'] == []
        assert data['total_count'] == 0
        assert data['morphik_enabled'] is False


class TestMorphikIngestEndpoint:
    """Test /api/morphik/ingest endpoint"""
    
    @pytest.fixture
    def app(self):
        """Create test app"""
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_ingest_endpoint_success(self, client):
        """Test successful text ingestion"""
        mock_result = {
            'success': True,
            'document_id': 'doc_123',
            'status': 'completed',
            'message': 'Text ingested successfully'
        }
        
        mock_service = Mock(spec=MorphikService)
        mock_service.ingest_text.return_value = mock_result
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.post('/api/morphik/ingest', json={
            'text': 'This is test content to ingest',
            'metadata': {'source': 'test'},
            'filename': 'test.txt'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['document_id'] == 'doc_123'
        assert data['morphik_enabled'] is True
        assert 'timestamp' in data
        
        # Verify service was called correctly
        mock_service.ingest_text.assert_called_once_with(
            text='This is test content to ingest',
            metadata={'source': 'test'},
            filename='test.txt'
        )
    
    def test_ingest_endpoint_minimal_data(self, client):
        """Test ingestion with minimal data"""
        mock_result = {'success': True, 'document_id': 'doc_456'}
        mock_service = Mock(spec=MorphikService)
        mock_service.ingest_text.return_value = mock_result
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.post('/api/morphik/ingest', json={'text': 'Simple text'})
        
        assert response.status_code == 200
        mock_service.ingest_text.assert_called_once_with(
            text='Simple text',
            metadata=None,
            filename=None
        )
    
    def test_ingest_endpoint_no_text(self, client):
        """Test ingestion without text"""
        mock_service = Mock(spec=MorphikService)
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.post('/api/morphik/ingest', json={'metadata': {'source': 'test'}})
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'Text content is required' in data['error']
    
    def test_ingest_endpoint_empty_text(self, client):
        """Test ingestion with empty text"""
        mock_service = Mock(spec=MorphikService)
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.post('/api/morphik/ingest', json={'text': '   '})
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'Text content is required' in data['error']
    
    def test_ingest_endpoint_service_unavailable(self, client):
        """Test ingestion when service is unavailable"""
        init_morphik_module({})
        
        response = client.post('/api/morphik/ingest', json={'text': 'Test content'})
        
        assert response.status_code == 503
        data = response.get_json()
        assert data['error'] == 'Morphik service unavailable'
        assert data['success'] is False
        assert data['morphik_enabled'] is False


class TestMorphikAPIErrorHandlers:
    """Test API error handlers"""
    
    @pytest.fixture
    def app(self):
        """Create test app"""
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_404_error_handler(self, client):
        """Test 404 error handler"""
        response = client.get('/api/morphik/nonexistent-endpoint')
        
        assert response.status_code == 404
        data = response.get_json()
        assert data['error'] == 'Endpoint not found'
        assert 'available_endpoints' in data
        
        # Check that all expected endpoints are listed
        expected_endpoints = [
            '/api/morphik/health',
            '/api/morphik/query',
            '/api/morphik/retrieve',
            '/api/morphik/models',
            '/api/morphik/documents',
            '/api/morphik/ingest'
        ]
        for endpoint in expected_endpoints:
            assert endpoint in data['available_endpoints']


class TestMorphikAPIEdgeCases:
    """Test edge cases and error scenarios"""
    
    @pytest.fixture
    def app(self):
        """Create test app"""
        app = create_app()
        app.config['TESTING'] = True
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_invalid_json_request(self, client):
        """Test handling of invalid JSON"""
        mock_service = Mock(spec=MorphikService)
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.post('/api/morphik/query',
                             data='invalid json',
                             content_type='application/json')
        
        assert response.status_code == 400
    
    def test_missing_content_type(self, client):
        """Test handling when content-type is missing"""
        mock_service = Mock(spec=MorphikService)
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.post('/api/morphik/query',
                             data='{"query": "test"}')
        
        # Should handle gracefully
        assert response.status_code in [400, 415]
    
    def test_extremely_long_query(self, client):
        """Test handling of extremely long queries"""
        mock_service = Mock(spec=MorphikService)
        mock_service.query.return_value = {'response': 'Response', 'morphik_response': True}
        init_morphik_module({'morphik_service': mock_service})
        
        long_query = "x" * 50000  # 50k characters
        response = client.post('/api/morphik/query', json={'query': long_query})
        
        # Should handle gracefully (either success or controlled error)
        assert response.status_code in [200, 400, 413]
    
    def test_concurrent_requests(self, client):
        """Test handling of concurrent requests"""
        mock_service = Mock(spec=MorphikService)
        mock_service.query.return_value = {'response': 'Concurrent response', 'morphik_response': True}
        init_morphik_module({'morphik_service': mock_service})
        
        # This is a simplified test - in a real scenario, you'd use threading
        response1 = client.post('/api/morphik/query', json={'query': 'Query 1'})
        response2 = client.post('/api/morphik/query', json={'query': 'Query 2'})
        
        assert response1.status_code == 200
        assert response2.status_code == 200
    
    def test_service_timeout_handling(self, client):
        """Test handling when service times out"""
        mock_service = Mock(spec=MorphikService)
        mock_service.query.side_effect = MorphikConnectionError("Request timed out")
        init_morphik_module({'morphik_service': mock_service})
        
        response = client.post('/api/morphik/query', json={'query': 'Test query'})
        
        assert response.status_code == 500
        data = response.get_json()
        assert 'Request timed out' in data['message']


if __name__ == '__main__':
    pytest.main([__file__, '-v'])