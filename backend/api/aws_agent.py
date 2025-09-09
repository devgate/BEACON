"""
AWS Bedrock Agent API endpoints
Handles communication with AWS Bedrock Agent Runtime
"""
from flask import Blueprint, request, jsonify
import boto3
import uuid
import logging
from datetime import datetime
from botocore.exceptions import ClientError
import os

# Setup logging
logger = logging.getLogger(__name__)

# Create blueprint
aws_agent_bp = Blueprint('aws_agent', __name__, url_prefix='/api/aws-agent')

# Default agent configuration
DEFAULT_AGENT_ID = 'QFZOZZY6LA'
DEFAULT_AGENT_ALIAS_ID = 'HZSY9X6YYZ'
DEFAULT_REGION = 'ap-northeast-2'

# Global bedrock client instance
bedrock_agent_runtime = None


def create_bedrock_agent_client():
    """Create Bedrock Agent Runtime client with proper AWS credential handling"""
    region_name = DEFAULT_REGION
    
    # Check environment variables for AWS credentials
    aws_key = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret = os.getenv('AWS_SECRET_ACCESS_KEY')
    aws_profile = os.getenv('AWS_PROFILE')
    
    logger.info(f"AWS_ACCESS_KEY_ID present: {bool(aws_key)}")
    logger.info(f"AWS_SECRET_ACCESS_KEY present: {bool(aws_secret)}")
    logger.info(f"AWS_PROFILE: {repr(aws_profile)}")
    
    session_kwargs = {'region_name': region_name}
    
    if aws_key and aws_secret:
        # Use environment variables (highest priority)
        # Remove AWS_PROFILE to avoid conflicts
        if 'AWS_PROFILE' in os.environ:
            del os.environ['AWS_PROFILE']
        logger.info("✅ Using AWS credentials from environment variables")
    elif aws_profile and aws_profile.strip():
        # Use profile if no environment variables
        session_kwargs['profile_name'] = aws_profile
        logger.info(f"Using AWS profile: {aws_profile}")
    else:
        # Use default credential chain
        logger.info("Using default AWS credentials (no profile)")
    
    session = boto3.Session(**session_kwargs)
    
    return session.client(
        service_name='bedrock-agent-runtime',
        region_name=region_name
    )


def init_aws_agent_module(context):
    """Initialize AWS Agent module with app context"""
    global bedrock_agent_runtime
    
    # Store context for later use if needed
    aws_agent_bp.context = context
    
    # Initialize bedrock client with proper credential handling
    try:
        bedrock_agent_runtime = create_bedrock_agent_client()
        logger.info("AWS Agent module initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize AWS Agent module: {e}")
        bedrock_agent_runtime = None


@aws_agent_bp.route('/chat', methods=['POST'])
def aws_agent_chat():
    """
    Handle chat with AWS Bedrock Agent
    
    Request Body:
        message (str, required): The user's message to send to the agent
        agent_id (str, optional): The agent ID (defaults to DEFAULT_AGENT_ID)
        agent_alias_id (str, optional): The agent alias ID (defaults to DEFAULT_AGENT_ALIAS_ID)
        session_id (str, optional): Session ID for conversation continuity (generates new if not provided)
    
    Returns:
        JSON response with agent's response and metadata
    """
    try:
        # Get request data
        data = request.get_json()
        
        # Validate required fields
        if not data:
            return jsonify({'error': 'Message is required'}), 400
        
        message = data.get('message', '').strip()
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Get agent configuration
        agent_id = data.get('agent_id', DEFAULT_AGENT_ID)
        agent_alias_id = data.get('agent_alias_id', DEFAULT_AGENT_ALIAS_ID)
        
        # Ensure session_id is always a string
        session_id = data.get('session_id')
        if not session_id or session_id == 'null' or session_id is None:
            session_id = str(uuid.uuid4())
        else:
            session_id = str(session_id)  # Convert to string if it's not None
        
        logger.info(f"AWS Agent chat request - Agent: {agent_id}, Session: {session_id}, Message: {message[:100]}...")
        
        # Record start time for response time calculation
        start_time = datetime.now()
        
        # Check if bedrock client is available
        global bedrock_agent_runtime
        if bedrock_agent_runtime is None:
            logger.error("Bedrock Agent Runtime client not initialized")
            return jsonify({
                'error': 'AWS Bedrock Agent service not available'
            }), 503
        
        # Invoke the agent
        response = bedrock_agent_runtime.invoke_agent(
            agentId=agent_id,
            agentAliasId=agent_alias_id,
            sessionId=session_id,
            inputText=message
        )
        
        # Process the streaming response
        agent_response = ""
        completion = response.get('completion', [])
        chunk_count = 0
        
        for chunk in completion:
            if 'chunk' in chunk:
                chunk_bytes = chunk['chunk'].get('bytes', b'')
                if chunk_bytes:
                    agent_response += chunk_bytes.decode('utf-8')
                    chunk_count += 1
        
        # Calculate response time
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        
        # Get agent name from available agents
        agent_name = '기본 Agent'  # Default name
        
        logger.info(f"AWS Agent response received - Length: {len(agent_response)} characters, Time: {processing_time:.2f}s")
        
        # Return the response with metadata
        return jsonify({
            'response': agent_response,
            'agent_id': agent_id,
            'agent_alias_id': agent_alias_id,
            'agent_name': agent_name,
            'session_id': session_id,
            'processing_time': round(processing_time, 2),
            'response_length': len(agent_response),
            'chunk_count': chunk_count,
            'timestamp': end_time.isoformat(),
            'agent_type': 'aws_bedrock_agent',
            'region': DEFAULT_REGION
        }), 200
        
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        error_message = e.response.get('Error', {}).get('Message', str(e))
        logger.error(f"AWS Agent error: {error_code} - {error_message}")
        return jsonify({
            'error': f'AWS Agent error: {error_message}'
        }), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in AWS Agent chat: {str(e)}")
        return jsonify({
            'error': f'Unexpected error: {str(e)}'
        }), 500


@aws_agent_bp.route('/agents', methods=['GET'])
def get_available_agents():
    """
    Get list of available agents
    For now, returns the default agent configuration
    
    Returns:
        JSON array of available agents
    """
    agents = [
        {
            'id': DEFAULT_AGENT_ID,
            'alias_id': DEFAULT_AGENT_ALIAS_ID,
            'name': '기본 Agent',
            'description': 'Default AWS Bedrock Agent'
        }
    ]
    
    return jsonify({'agents': agents}), 200