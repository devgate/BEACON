"""
Test suite for Arena API endpoints
Tests dual-model comparison functionality following TDD principles
"""
import pytest
import json
import time
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

from app import create_app
from api.arena import arena_bp


class TestArenaAPI:
    """Test class for Arena API endpoints"""
    
    @pytest.fixture
    def app(self):
        """Create test app with mock services"""
        with patch('services.bedrock_service.create_bedrock_service') as mock_bedrock:
            with patch('storage.vector_store.create_vector_store') as mock_vector:
                with patch('services.rag_engine.create_rag_engine') as mock_rag:
                    # Mock bedrock service with sample models
                    mock_bedrock_service = Mock()
                    mock_bedrock_service.get_available_models.return_value = [
                        Mock(model_id="anthropic.claude-3-haiku", name="Claude 3 Haiku"),
                        Mock(model_id="anthropic.claude-3-sonnet", name="Claude 3 Sonnet"),
                        Mock(model_id="anthropic.claude-3-opus", name="Claude 3 Opus")
                    ]
                    mock_bedrock.return_value = mock_bedrock_service
                    
                    mock_vector.return_value = Mock()
                    mock_rag.return_value = Mock()
                    
                    app = create_app()
                    app.config['TESTING'] = True
                    yield app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_arena_chat_endpoint_exists(self, client):
        """Test that /api/arena/chat endpoint exists"""
        response = client.post('/api/arena/chat', 
                             json={'message': 'test'})
        # Should not return 404 (endpoint exists)
        assert response.status_code != 404
    
    def test_arena_chat_requires_message(self, client):
        """Test that arena chat requires a message parameter"""
        response = client.post('/api/arena/chat', json={})
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
        # The exact error could vary, just ensure it mentions the issue
        assert 'message' in data['error'].lower() or 'required' in data['error'].lower()
    
    def test_arena_chat_requires_two_models(self, client):
        """Test that arena chat requires two different model IDs"""
        response = client.post('/api/arena/chat', json={
            'message': 'Hello, world!',
            'model_a': 'anthropic.claude-3-haiku'
            # Missing model_b
        })
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
        assert 'model' in data['error'].lower()
    
    def test_arena_chat_rejects_same_models(self, client):
        """Test that arena chat rejects identical model IDs"""
        response = client.post('/api/arena/chat', json={
            'message': 'Hello, world!',
            'model_a': 'anthropic.claude-3-haiku',
            'model_b': 'anthropic.claude-3-haiku'
        })
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
        assert 'different' in data['error'].lower()
    
    @patch('api.arena.bedrock_service')
    def test_arena_chat_successful_dual_response(self, mock_bedrock_service, client):
        """Test successful dual model response"""
        # Mock successful responses from both models
        mock_bedrock_service.invoke_model.side_effect = [
            {
                'text': 'Response from model A',
                'usage': {'input_tokens': 10, 'output_tokens': 20},
                'cost': {'total': 0.001}
            },
            {
                'text': 'Response from model B',
                'usage': {'input_tokens': 10, 'output_tokens': 25},
                'cost': {'total': 0.002}
            }
        ]
        
        response = client.post('/api/arena/chat', json={
            'message': 'Hello, world!',
            'model_a': 'anthropic.claude-3-haiku',
            'model_b': 'anthropic.claude-3-sonnet',
            'settings': {
                'temperature': 0.7,
                'max_tokens': 2048
            }
        })
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify structure
        assert 'arena_id' in data
        assert 'timestamp' in data
        assert 'message' in data
        assert data['message'] == 'Hello, world!'
        
        # Verify responses structure
        assert 'responses' in data
        assert len(data['responses']) == 2
        
        # Verify response A
        response_a = data['responses']['model_a']
        assert response_a['model_id'] == 'anthropic.claude-3-haiku'
        assert response_a['text'] == 'Response from model A'
        assert 'response_time' in response_a
        assert 'tokens_used' in response_a
        assert 'cost_estimate' in response_a
        
        # Verify response B
        response_b = data['responses']['model_b']
        assert response_b['model_id'] == 'anthropic.claude-3-sonnet'
        assert response_b['text'] == 'Response from model B'
        assert 'response_time' in response_b
        assert 'tokens_used' in response_b
        assert 'cost_estimate' in response_b
    
    @patch('api.arena.bedrock_service')
    def test_arena_chat_handles_model_failure(self, mock_bedrock_service, client):
        """Test handling when one model fails"""
        # Mock one successful response and one failure
        mock_bedrock_service.invoke_model.side_effect = [
            {
                'text': 'Response from model A',
                'usage': {'input_tokens': 10, 'output_tokens': 20},
                'cost': {'total': 0.001}
            },
            Exception("Model B unavailable")
        ]
        
        response = client.post('/api/arena/chat', json={
            'message': 'Hello, world!',
            'model_a': 'anthropic.claude-3-haiku',
            'model_b': 'anthropic.claude-3-sonnet'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify successful response A
        response_a = data['responses']['model_a']
        assert response_a['text'] == 'Response from model A'
        assert 'error' not in response_a
        
        # Verify failed response B
        response_b = data['responses']['model_b']
        assert 'error' in response_b
        assert 'Model B unavailable' in response_b['error']
    
    @patch('api.arena.bedrock_service')  
    def test_arena_chat_parallel_execution(self, mock_bedrock_service, client):
        """Test that models are invoked in parallel for performance"""
        # Mock responses with delays to test parallelism
        def mock_invoke_with_delay(*args, **kwargs):
            time.sleep(0.1)  # Simulate API call delay
            if kwargs.get('model_id') == 'anthropic.claude-3-haiku':
                return {
                    'text': 'Fast response',
                    'usage': {'input_tokens': 5, 'output_tokens': 10},
                    'cost': {'total': 0.0005}
                }
            else:
                return {
                    'text': 'Slower response',
                    'usage': {'input_tokens': 5, 'output_tokens': 15},
                    'cost': {'total': 0.001}
                }
        
        mock_bedrock_service.invoke_model.side_effect = mock_invoke_with_delay
        
        start_time = time.time()
        response = client.post('/api/arena/chat', json={
            'message': 'Test parallel execution',
            'model_a': 'anthropic.claude-3-haiku',
            'model_b': 'anthropic.claude-3-sonnet'
        })
        end_time = time.time()
        
        # If executed in parallel, total time should be ~0.1s not ~0.2s
        total_time = end_time - start_time
        assert total_time < 0.15, f"Expected parallel execution, took {total_time}s"
        
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['responses']) == 2
    
    def test_arena_vote_endpoint_exists(self, client):
        """Test that /api/arena/vote endpoint exists"""
        response = client.post('/api/arena/vote')
        # Should not return 404 (endpoint exists)
        assert response.status_code != 404
    
    def test_arena_vote_requires_arena_id(self, client):
        """Test that vote requires arena_id"""
        response = client.post('/api/arena/vote', json={
            'winner': 'model_a'
        })
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
        assert 'arena_id' in data['error'].lower()
    
    def test_arena_vote_requires_valid_winner(self, client):
        """Test that vote requires valid winner choice"""
        response = client.post('/api/arena/vote', json={
            'arena_id': 'test_arena_123',
            'winner': 'invalid_choice'
        })
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
        assert 'winner' in data['error'].lower()
    
    def test_arena_vote_successful_submission(self, client):
        """Test successful vote submission"""
        response = client.post('/api/arena/vote', json={
            'arena_id': 'test_arena_123',
            'winner': 'model_a',
            'reason': 'Better response quality'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'vote_id' in data
        assert 'timestamp' in data
        assert data['arena_id'] == 'test_arena_123'
        assert data['winner'] == 'model_a'
    
    def test_arena_vote_allows_tie(self, client):
        """Test that tie votes are allowed"""
        response = client.post('/api/arena/vote', json={
            'arena_id': 'test_arena_123',
            'winner': 'tie',
            'reason': 'Both responses were equally good'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['winner'] == 'tie'
    
    def test_arena_vote_optional_reason(self, client):
        """Test that reason is optional for votes"""
        response = client.post('/api/arena/vote', json={
            'arena_id': 'test_arena_123',
            'winner': 'model_b'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
    
    def test_arena_vote_stores_metadata(self, client):
        """Test that vote stores relevant metadata"""
        response = client.post('/api/arena/vote', json={
            'arena_id': 'test_arena_123',
            'winner': 'model_a',
            'reason': 'More helpful response',
            'user_id': 'test_user_456'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        # Should include metadata in response
        assert 'metadata' in data
        metadata = data['metadata']
        assert 'user_agent' in metadata or 'ip_address' in metadata


class TestArenaAPIEdgeCases:
    """Test edge cases and error handling"""
    
    @pytest.fixture
    def app(self):
        """Create test app"""
        with patch('services.bedrock_service.create_bedrock_service'):
            with patch('storage.vector_store.create_vector_store'):
                with patch('services.rag_engine.create_rag_engine'):
                    app = create_app()
                    app.config['TESTING'] = True
                    yield app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_arena_chat_invalid_json(self, client):
        """Test handling of invalid JSON input"""
        response = client.post('/api/arena/chat',
                             data='invalid json',
                             content_type='application/json')
        assert response.status_code == 400
    
    def test_arena_chat_missing_content_type(self, client):
        """Test handling when content-type header is missing"""
        response = client.post('/api/arena/chat')
        assert response.status_code in [400, 415]  # Bad Request or Unsupported Media Type
    
    def test_arena_chat_extremely_long_message(self, client):
        """Test handling of extremely long messages"""
        long_message = "x" * 100000  # 100k characters
        response = client.post('/api/arena/chat', json={
            'message': long_message,
            'model_a': 'anthropic.claude-3-haiku',
            'model_b': 'anthropic.claude-3-sonnet'
        })
        # Should handle gracefully (either success or controlled error)
        assert response.status_code in [200, 400, 413]  # OK, Bad Request, or Payload Too Large
    
    def test_arena_chat_empty_message(self, client):
        """Test handling of empty message"""
        response = client.post('/api/arena/chat', json={
            'message': '',
            'model_a': 'anthropic.claude-3-haiku',
            'model_b': 'anthropic.claude-3-sonnet'
        })
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
    
    def test_arena_vote_duplicate_submission(self, client):
        """Test handling of duplicate vote submissions"""
        vote_data = {
            'arena_id': 'test_arena_123',
            'winner': 'model_a',
            'user_id': 'test_user'
        }
        
        # First vote
        response1 = client.post('/api/arena/vote', json=vote_data)
        assert response1.status_code == 200
        
        # Duplicate vote (should be handled gracefully)
        response2 = client.post('/api/arena/vote', json=vote_data)
        # Implementation dependent: could be 200 (update), 409 (conflict), or 400 (error)
        assert response2.status_code in [200, 400, 409]


if __name__ == '__main__':
    pytest.main([__file__, '-v'])