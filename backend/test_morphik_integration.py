"""
Integration tests for Morphik API integration
Tests complete flow from API endpoints through service layer following TDD principles
"""
import pytest
import json
import time
import requests
from unittest.mock import Mock, patch, MagicMock, call
from requests.exceptions import ConnectionError, Timeout, HTTPError

from app import create_app
from api.morphik import init_morphik_module
from services.morphik_service import MorphikService, create_morphik_service


class TestMorphikIntegrationFlow:
    """Test complete integration flow"""
    
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
    
    @patch('requests.Session.get')
    @patch('requests.Session.post')
    def test_complete_query_flow(self, mock_post, mock_get, client):
        """Test complete query flow from API to service"""
        # Mock health check response for service initialization
        health_response = Mock()
        health_response.raise_for_status.return_value = None
        health_response.json.return_value = {"status": "ok"}
        mock_get.return_value = health_response
        
        # Mock query response
        query_response = Mock()
        query_response.raise_for_status.return_value = None
        query_response.json.return_value = {
            "completion": "This is the AI response to your query",
            "prompt_tokens": 15,
            "completion_tokens": 25,
            "total_tokens": 40,
            "chunks_used": 3,
            "average_score": 0.85
        }
        mock_post.return_value = query_response
        
        # Create real service instance
        uri = "morphik://test-owner:test-token@api.morphik.ai"
        service = MorphikService(uri=uri)
        init_morphik_module({'morphik_service': service})
        
        # Make API request
        response = client.post('/api/morphik/query', json={
            'query': 'What is the future of AI?',
            'k': 3,
            'min_score': 0.7,
            'temperature': 0.8,
            'use_reranking': True
        })
        
        # Verify API response
        assert response.status_code == 200
        data = response.get_json()
        assert data['response'] == "This is the AI response to your query"
        assert data['model_used'] == "morphik-ai"
        assert data['tokens_used']['input_tokens'] == 15
        assert data['tokens_used']['output_tokens'] == 25
        assert data['morphik_metadata']['chunks_retrieved'] == 3
        assert data['morphik_enabled'] is True
        
        # Verify HTTP calls were made correctly
        assert mock_get.call_count >= 1  # Health check
        mock_post.assert_called_with(
            'https://api.morphik.ai/query',
            json={
                'query': 'What is the future of AI?',
                'k': 3,
                'min_score': 0.7,
                'temperature': 0.8,
                'use_reranking': True,
                'use_colpali': False
            },
            params=None
        )
    
    @patch('requests.Session.get')
    @patch('requests.Session.post')
    def test_complete_retrieve_flow(self, mock_post, mock_get, client):
        """Test complete chunk retrieval flow"""
        # Mock health check
        health_response = Mock()
        health_response.raise_for_status.return_value = None
        health_response.json.return_value = {"status": "ok"}
        mock_get.return_value = health_response
        
        # Mock retrieve response
        retrieve_response = Mock()
        retrieve_response.raise_for_status.return_value = None
        retrieve_response.json.return_value = {
            "chunks": [
                {
                    "content": "AI will transform healthcare by enabling personalized medicine",
                    "score": 0.92,
                    "document_id": "doc_healthcare_ai",
                    "chunk_number": 5,
                    "metadata": {"section": "healthcare", "author": "Dr. Smith"}
                },
                {
                    "content": "Machine learning algorithms will revolutionize data analysis",
                    "score": 0.88,
                    "document_id": "doc_ml_future",
                    "chunk_number": 2,
                    "metadata": {"section": "technology", "year": "2024"}
                }
            ]
        }
        mock_post.return_value = retrieve_response
        
        # Create service and make API request
        uri = "morphik://test-owner:test-token@api.morphik.ai"
        service = MorphikService(uri=uri)
        init_morphik_module({'morphik_service': service})
        
        response = client.post('/api/morphik/retrieve', json={
            'query': 'AI in healthcare',
            'k': 5,
            'min_score': 0.8,
            'filters': {'category': 'medical'}
        })
        
        # Verify API response
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['chunks']) == 2
        assert data['total_retrieved'] == 2
        assert data['query'] == 'AI in healthcare'
        assert data['morphik_enabled'] is True
        
        # Verify chunk data
        chunk1 = data['chunks'][0]
        assert chunk1['content'] == "AI will transform healthcare by enabling personalized medicine"
        assert chunk1['score'] == 0.92
        assert chunk1['document_id'] == "doc_healthcare_ai"
        assert chunk1['metadata']['author'] == "Dr. Smith"
        
        # Verify HTTP call
        mock_post.assert_called_with(
            'https://api.morphik.ai/retrieve-chunks',
            json={
                'query': 'AI in healthcare',
                'k': 5,
                'min_score': 0.8,
                'filters': {'category': 'medical'}
            },
            params=None
        )
    
    @patch('requests.Session.get')
    @patch('requests.Session.post')
    def test_error_propagation_flow(self, mock_post, mock_get, client):
        """Test error propagation from service to API"""
        # Mock health check
        health_response = Mock()
        health_response.raise_for_status.return_value = None
        health_response.json.return_value = {"status": "ok"}
        mock_get.return_value = health_response
        
        # Mock HTTP error
        mock_post.side_effect = HTTPError("400 Bad Request")
        
        # Create service
        uri = "morphik://test-owner:test-token@api.morphik.ai"
        service = MorphikService(uri=uri)
        init_morphik_module({'morphik_service': service})
        
        # Make API request
        response = client.post('/api/morphik/query', json={'query': 'Test query'})
        
        # Verify error response
        assert response.status_code == 500
        data = response.get_json()
        assert data['error'] == 'Query processing failed'
        assert data['morphik_enabled'] is False
        assert 'I apologize, but I encountered an error' in data['response']


class TestMorphikServiceConfiguration:
    """Test service configuration and initialization"""
    
    def test_service_factory_with_valid_config(self):
        """Test creating service with valid configuration"""
        config = {
            'MORPHIK_URI': 'morphik://test-app:token123@api.morphik.ai',
            'MORPHIK_TIMEOUT': 45
        }
        
        with patch.object(MorphikService, '_test_connection'):
            service = create_morphik_service(config)
            
            assert service is not None
            assert service.owner_id == 'test-app'
            assert service.token == 'token123'
            assert service.host == 'api.morphik.ai'
            assert service.timeout == 45
    
    def test_service_factory_with_missing_uri(self):
        """Test creating service without URI"""
        config = {'MORPHIK_TIMEOUT': 30}
        
        service = create_morphik_service(config)
        
        assert service is None
    
    def test_service_factory_with_invalid_uri(self):
        """Test creating service with invalid URI"""
        config = {'MORPHIK_URI': 'invalid://uri/format'}
        
        service = create_morphik_service(config)
        
        assert service is None


class TestMorphikRealWorldScenarios:
    """Test realistic usage scenarios"""
    
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
    
    @patch('requests.Session.get')
    @patch('requests.Session.post')
    def test_rag_query_scenario(self, mock_post, mock_get, client):
        """Test realistic RAG query scenario"""
        # Mock health check
        health_response = Mock()
        health_response.raise_for_status.return_value = None
        health_response.json.return_value = {"status": "ok"}
        mock_get.return_value = health_response
        
        # Mock RAG query response
        rag_response = Mock()
        rag_response.raise_for_status.return_value = None
        rag_response.json.return_value = {
            "completion": "Based on the provided documents, artificial intelligence is rapidly advancing in several key areas including natural language processing, computer vision, and machine learning. The documents suggest that AI will have significant impacts on healthcare, finance, and transportation industries over the next decade.",
            "prompt_tokens": 150,
            "completion_tokens": 75,
            "total_tokens": 225,
            "chunks_used": 5,
            "average_score": 0.76
        }
        mock_post.return_value = rag_response
        
        # Create service
        uri = "morphik://sdu-test-app:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9@api.morphik.ai"
        service = MorphikService(uri=uri)
        init_morphik_module({'morphik_service': service})
        
        # Simulate complex RAG query
        response = client.post('/api/morphik/query', json={
            'query': 'What are the current trends in AI development and their potential impact on various industries?',
            'k': 5,
            'min_score': 0.6,
            'max_tokens': 4000,
            'temperature': 0.3,
            'use_reranking': True,
            'use_colpali': False,
            'filters': {
                'document_type': 'research_paper',
                'published_after': '2023-01-01',
                'language': 'en'
            }
        })
        
        # Verify response structure
        assert response.status_code == 200
        data = response.get_json()
        assert 'artificial intelligence is rapidly advancing' in data['response']
        assert data['tokens_used']['total_tokens'] == 225
        assert data['morphik_metadata']['chunks_retrieved'] == 5
        assert data['confidence_score'] > 0.8  # Should be calculated as min(1.0, 0.76 + 0.2)
        
        # Verify complex query was sent correctly
        expected_query_data = {
            'query': 'What are the current trends in AI development and their potential impact on various industries?',
            'k': 5,
            'min_score': 0.6,
            'max_tokens': 4000,
            'temperature': 0.3,
            'use_reranking': True,
            'use_colpali': False,
            'filters': {
                'document_type': 'research_paper',
                'published_after': '2023-01-01',
                'language': 'en'
            }
        }
        mock_post.assert_called_with('https://api.morphik.ai/query', json=expected_query_data, params=None)
    
    @patch('requests.Session.get')
    @patch('requests.Session.post')
    def test_document_ingestion_scenario(self, mock_post, mock_get, client):
        """Test document ingestion workflow"""
        # Mock health check
        health_response = Mock()
        health_response.raise_for_status.return_value = None
        health_response.json.return_value = {"status": "ok"}
        mock_get.return_value = health_response
        
        # Mock ingestion response
        ingest_response = Mock()
        ingest_response.raise_for_status.return_value = None
        ingest_response.json.return_value = {
            "external_id": "doc_ai_trends_2024_001",
            "status": "processing"
        }
        mock_post.return_value = ingest_response
        
        # Create service
        uri = "morphik://sdu-test-app:token@api.morphik.ai"
        service = MorphikService(uri=uri)
        init_morphik_module({'morphik_service': service})
        
        # Simulate document ingestion
        document_text = """
        Artificial Intelligence Trends 2024
        
        Executive Summary:
        The field of artificial intelligence continues to evolve rapidly in 2024, with significant 
        advancements in large language models, computer vision, and robotics. This report analyzes 
        current trends and future projections for AI technology adoption across industries.
        
        Key Findings:
        1. Large language models have achieved unprecedented capabilities in reasoning and code generation
        2. Multimodal AI systems are becoming more sophisticated and practical
        3. AI governance and ethics are receiving increased attention from regulators
        """
        
        response = client.post('/api/morphik/ingest', json={
            'text': document_text,
            'metadata': {
                'title': 'AI Trends 2024 Report',
                'author': 'Tech Research Institute',
                'document_type': 'research_report',
                'publication_date': '2024-01-15',
                'category': 'artificial_intelligence',
                'language': 'en',
                'tags': ['AI', 'trends', '2024', 'technology']
            },
            'filename': 'ai_trends_2024.txt'
        })
        
        # Verify ingestion response
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['document_id'] == 'doc_ai_trends_2024_001'
        assert data['status'] == 'processing'
        assert data['morphik_enabled'] is True
        
        # Verify ingestion request
        mock_post.assert_called_with(
            'https://api.morphik.ai/ingestion/ingest-text',
            json={
                'text': document_text,
                'metadata': {
                    'title': 'AI Trends 2024 Report',
                    'author': 'Tech Research Institute',
                    'document_type': 'research_report',
                    'publication_date': '2024-01-15',
                    'category': 'artificial_intelligence',
                    'language': 'en',
                    'tags': ['AI', 'trends', '2024', 'technology']
                },
                'filename': 'ai_trends_2024.txt'
            },
            params=None
        )
    
    @patch('requests.Session.get')
    def test_service_health_monitoring_scenario(self, mock_get, client):
        """Test service health monitoring workflow"""
        # Mock varying health responses
        health_responses = [
            {"status": "ok", "message": "Service operational", "response_time": 0.15},
            {"status": "degraded", "message": "High load detected", "response_time": 0.85},
            {"status": "ok", "message": "Service recovered", "response_time": 0.22}
        ]
        
        mock_responses = []
        for health_data in health_responses:
            response = Mock()
            response.raise_for_status.return_value = None
            response.json.return_value = health_data
            mock_responses.append(response)
        
        mock_get.side_effect = mock_responses
        
        # Create service
        uri = "morphik://sdu-test-app:token@api.morphik.ai"
        service = MorphikService(uri=uri)
        init_morphik_module({'morphik_service': service})
        
        # Test multiple health checks
        health_statuses = []
        for i in range(3):
            response = client.get('/api/morphik/health')
            assert response.status_code == 200
            
            data = response.get_json()
            health_statuses.append(data['status'])
        
        # Verify health status progression
        assert health_statuses[0] == 'healthy'   # ok status
        assert health_statuses[1] == 'unhealthy' # degraded status  
        assert health_statuses[2] == 'healthy'   # recovered
        
        # Verify all health checks were made
        assert mock_get.call_count >= 3
    
    @patch('requests.Session.get')
    @patch('requests.Session.post')  
    def test_connection_resilience_scenario(self, mock_post, mock_get, client):
        """Test connection resilience and retry scenarios"""
        # Mock connection failures followed by success
        health_response = Mock()
        health_response.raise_for_status.return_value = None
        health_response.json.return_value = {"status": "ok"}
        mock_get.return_value = health_response
        
        # First query fails, second succeeds
        query_failure = ConnectionError("Network unavailable")
        query_success = Mock()
        query_success.raise_for_status.return_value = None
        query_success.json.return_value = {
            "completion": "Query succeeded after retry",
            "prompt_tokens": 10,
            "completion_tokens": 15,
            "total_tokens": 25
        }
        
        mock_post.side_effect = [query_failure, query_success]
        
        # Create service
        uri = "morphik://sdu-test-app:token@api.morphik.ai"
        service = MorphikService(uri=uri)
        init_morphik_module({'morphik_service': service})
        
        # First query should fail
        response1 = client.post('/api/morphik/query', json={'query': 'First attempt'})
        assert response1.status_code == 500
        data1 = response1.get_json()
        assert 'Network unavailable' in data1['message']
        
        # Second query should succeed (simulating retry or recovery)
        response2 = client.post('/api/morphik/query', json={'query': 'Second attempt'})
        assert response2.status_code == 200
        data2 = response2.get_json()
        assert data2['response'] == "Query succeeded after retry"
        
        # Verify both calls were made
        assert mock_post.call_count == 2


class TestMorphikPerformanceScenarios:
    """Test performance-related scenarios"""
    
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
    
    @patch('requests.Session.get')
    @patch('requests.Session.post')
    def test_query_performance_tracking(self, mock_post, mock_get, client):
        """Test query performance tracking"""
        # Mock health check
        health_response = Mock()
        health_response.raise_for_status.return_value = None
        health_response.json.return_value = {"status": "ok"}
        mock_get.return_value = health_response
        
        # Mock query with processing delay
        def slow_query_response(*args, **kwargs):
            time.sleep(0.1)  # Simulate processing time
            response = Mock()
            response.raise_for_status.return_value = None
            response.json.return_value = {
                "completion": "Response after processing delay",
                "prompt_tokens": 20,
                "completion_tokens": 30,
                "total_tokens": 50
            }
            return response
        
        mock_post.side_effect = slow_query_response
        
        # Create service
        uri = "morphik://sdu-test-app:token@api.morphik.ai"
        service = MorphikService(uri=uri)
        init_morphik_module({'morphik_service': service})
        
        # Measure query time
        start_time = time.time()
        response = client.post('/api/morphik/query', json={'query': 'Performance test query'})
        end_time = time.time()
        
        # Verify response includes timing information
        assert response.status_code == 200
        data = response.get_json()
        assert 'processing_time' in data
        assert data['processing_time'] >= 0.1  # Should include our simulated delay
        
        # Verify total request time
        total_time = end_time - start_time
        assert total_time >= 0.1  # Should account for processing delay
    
    @patch('requests.Session.get') 
    @patch('requests.Session.post')
    def test_concurrent_query_handling(self, mock_post, mock_get, client):
        """Test handling of concurrent queries (simplified)"""
        # Mock health check
        health_response = Mock()
        health_response.raise_for_status.return_value = None
        health_response.json.return_value = {"status": "ok"}
        mock_get.return_value = health_response
        
        # Mock concurrent query responses
        def query_response_generator(call_count=[0]):
            call_count[0] += 1
            response = Mock()
            response.raise_for_status.return_value = None
            response.json.return_value = {
                "completion": f"Response to concurrent query {call_count[0]}",
                "prompt_tokens": 10,
                "completion_tokens": 15,
                "total_tokens": 25
            }
            return response
        
        mock_post.side_effect = query_response_generator
        
        # Create service
        uri = "morphik://sdu-test-app:token@api.morphik.ai"
        service = MorphikService(uri=uri)
        init_morphik_module({'morphik_service': service})
        
        # Simulate concurrent requests (sequential for testing)
        queries = ['Query 1', 'Query 2', 'Query 3']
        responses = []
        
        for query in queries:
            response = client.post('/api/morphik/query', json={'query': query})
            responses.append(response)
        
        # Verify all requests succeeded
        for i, response in enumerate(responses):
            assert response.status_code == 200
            data = response.get_json()
            assert f'concurrent query {i+1}' in data['response']
        
        # Verify all requests were processed
        assert mock_post.call_count == len(queries)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])