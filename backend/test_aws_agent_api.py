"""
Test suite for AWS Bedrock Agent API endpoints
Tests AWS Agent chat functionality following TDD principles
"""
import pytest
import json
import uuid
from unittest.mock import Mock, patch, MagicMock, call
from datetime import datetime

from app import create_app


class TestAWSAgentAPI:
    """Test class for AWS Agent API endpoints"""
    
    @pytest.fixture
    def app(self):
        """Create test app with mock services"""
        with patch('services.bedrock_service.create_bedrock_service') as mock_bedrock:
            with patch('storage.vector_store.create_vector_store') as mock_vector:
                with patch('services.rag_engine.create_rag_engine') as mock_rag:
                    # Mock services
                    mock_bedrock.return_value = Mock()
                    mock_vector.return_value = Mock()
                    mock_rag.return_value = Mock()
                    
                    app = create_app()
                    app.config['TESTING'] = True
                    yield app
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    def test_aws_agent_chat_endpoint_exists(self, client):
        """Test that /api/aws-agent/chat endpoint exists"""
        response = client.post('/api/aws-agent/chat', 
                              json={'message': 'test'})
        # Should not return 404 (endpoint exists)
        assert response.status_code != 404
    
    def test_aws_agent_chat_missing_message(self, client):
        """Test AWS Agent chat with missing message parameter"""
        response = client.post('/api/aws-agent/chat', json={})
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
        assert 'message' in data['error'].lower()
    
    def test_aws_agent_chat_empty_message(self, client):
        """Test AWS Agent chat with empty message"""
        response = client.post('/api/aws-agent/chat', 
                              json={'message': ''})
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
    
    @patch('boto3.client')
    def test_aws_agent_chat_with_default_agent(self, mock_boto3_client, client):
        """Test AWS Agent chat with default agent configuration"""
        # Mock Bedrock Agent Runtime client
        mock_agent_client = Mock()
        mock_boto3_client.return_value = mock_agent_client
        
        # Mock agent response
        mock_response = {
            'sessionId': 'test-session-123',
            'completion': iter([
                {
                    'chunk': {
                        'bytes': b'This is a response from the AWS Agent.'
                    }
                }
            ])
        }
        mock_agent_client.invoke_agent.return_value = mock_response
        
        # Make request
        response = client.post('/api/aws-agent/chat', json={
            'message': 'What is the weather today?'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify response structure
        assert 'response' in data
        assert 'agent_id' in data
        assert 'agent_alias_id' in data
        assert 'session_id' in data
        assert 'timestamp' in data
        
        # Verify default agent values
        assert data['agent_id'] == 'QFZOZZY6LA'
        assert data['agent_alias_id'] == 'HZSY9X6YYZ'
        assert data['response'] == 'This is a response from the AWS Agent.'
        
        # Verify boto3 client was called correctly
        mock_boto3_client.assert_called_once_with(
            'bedrock-agent-runtime', 
            region_name='ap-northeast-2'
        )
        
        # Verify invoke_agent was called with correct parameters
        mock_agent_client.invoke_agent.assert_called_once()
        call_args = mock_agent_client.invoke_agent.call_args
        assert call_args.kwargs['agentId'] == 'QFZOZZY6LA'
        assert call_args.kwargs['agentAliasId'] == 'HZSY9X6YYZ'
        assert call_args.kwargs['inputText'] == 'What is the weather today?'
        assert 'sessionId' in call_args.kwargs
    
    @patch('boto3.client')
    def test_aws_agent_chat_with_custom_agent(self, mock_boto3_client, client):
        """Test AWS Agent chat with custom agent configuration"""
        # Mock Bedrock Agent Runtime client
        mock_agent_client = Mock()
        mock_boto3_client.return_value = mock_agent_client
        
        # Mock agent response
        mock_response = {
            'sessionId': 'custom-session-456',
            'completion': iter([
                {
                    'chunk': {
                        'bytes': b'Custom agent response.'
                    }
                }
            ])
        }
        mock_agent_client.invoke_agent.return_value = mock_response
        
        # Make request with custom agent configuration
        response = client.post('/api/aws-agent/chat', json={
            'message': 'Tell me about your capabilities',
            'agent_id': 'CUSTOM123',
            'agent_alias_id': 'ALIAS456',
            'session_id': 'existing-session-789'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify custom agent values
        assert data['agent_id'] == 'CUSTOM123'
        assert data['agent_alias_id'] == 'ALIAS456'
        assert data['response'] == 'Custom agent response.'
        
        # Verify invoke_agent was called with custom parameters
        mock_agent_client.invoke_agent.assert_called_once()
        call_args = mock_agent_client.invoke_agent.call_args
        assert call_args.kwargs['agentId'] == 'CUSTOM123'
        assert call_args.kwargs['agentAliasId'] == 'ALIAS456'
        assert call_args.kwargs['sessionId'] == 'existing-session-789'
    
    @patch('boto3.client')
    def test_aws_agent_chat_handles_multi_chunk_response(self, mock_boto3_client, client):
        """Test AWS Agent chat handles multi-chunk streaming response"""
        # Mock Bedrock Agent Runtime client
        mock_agent_client = Mock()
        mock_boto3_client.return_value = mock_agent_client
        
        # Mock multi-chunk response
        mock_response = {
            'sessionId': 'stream-session-123',
            'completion': iter([
                {'chunk': {'bytes': b'This is '}},
                {'chunk': {'bytes': b'a multi-chunk '}},
                {'chunk': {'bytes': b'response.'}}
            ])
        }
        mock_agent_client.invoke_agent.return_value = mock_response
        
        # Make request
        response = client.post('/api/aws-agent/chat', json={
            'message': 'Stream test'
        })
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify concatenated response
        assert data['response'] == 'This is a multi-chunk response.'
    
    @patch('boto3.client')
    def test_aws_agent_chat_handles_aws_error(self, mock_boto3_client, client):
        """Test AWS Agent chat handles AWS service errors gracefully"""
        # Mock Bedrock Agent Runtime client with error
        mock_agent_client = Mock()
        mock_boto3_client.return_value = mock_agent_client
        
        # Mock AWS error
        from botocore.exceptions import ClientError
        mock_agent_client.invoke_agent.side_effect = ClientError(
            {'Error': {'Code': 'ThrottlingException', 'Message': 'Rate exceeded'}},
            'invoke_agent'
        )
        
        # Make request
        response = client.post('/api/aws-agent/chat', json={
            'message': 'This will fail'
        })
        
        assert response.status_code == 500
        data = response.get_json()
        assert 'error' in data
        assert 'AWS Agent error' in data['error']
    
    @patch('boto3.client')
    def test_aws_agent_chat_new_session_generation(self, mock_boto3_client, client):
        """Test AWS Agent chat generates new session ID when not provided"""
        # Mock Bedrock Agent Runtime client
        mock_agent_client = Mock()
        mock_boto3_client.return_value = mock_agent_client
        
        # Mock agent response
        mock_response = {
            'sessionId': 'generated-session',
            'completion': iter([{'chunk': {'bytes': b'Response'}}])
        }
        mock_agent_client.invoke_agent.return_value = mock_response
        
        # Make request without session_id
        response = client.post('/api/aws-agent/chat', json={
            'message': 'New session test'
        })
        
        assert response.status_code == 200
        
        # Verify a session ID was generated
        call_args = mock_agent_client.invoke_agent.call_args
        session_id = call_args.kwargs['sessionId']
        assert session_id is not None
        assert len(session_id) > 0
        # Session ID should be a valid UUID format
        try:
            uuid.UUID(session_id)
        except ValueError:
            pytest.fail(f"Generated session ID {session_id} is not a valid UUID")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])