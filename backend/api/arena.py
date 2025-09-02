"""
Arena API module for BEACON
Handles dual-model comparison endpoints for LLM Arena functionality
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
import uuid
import logging
import time
import concurrent.futures
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

# Create Blueprint
arena_bp = Blueprint('arena', __name__)

# Storage for arena comparisons and votes
arena_history = []
arena_votes = []

# Module-level variables (initialized by init_arena_module)
bedrock_service = None
RAG_ENABLED = False


def init_arena_module(app_context):
    """Initialize arena module with app context"""
    global bedrock_service, RAG_ENABLED
    
    bedrock_service = app_context['bedrock_service']
    RAG_ENABLED = app_context['RAG_ENABLED']
    logger.info(f"Arena module initialized - RAG_ENABLED: {RAG_ENABLED}")


@arena_bp.route('/api/arena/chat', methods=['POST'])
def arena_chat():
    """
    Arena chat endpoint - sends message to two different models in parallel
    
    Expected JSON payload:
    {
        "message": "User message text",
        "model_a": "model_id_1",
        "model_b": "model_id_2", 
        "settings": {
            "temperature": 0.7,
            "max_tokens": 2048,
            "system_prompt": "Optional system prompt"
        }
    }
    
    Returns:
    {
        "arena_id": "unique_identifier",
        "timestamp": "ISO timestamp",
        "message": "Original user message",
        "responses": {
            "model_a": {
                "model_id": "model_id_1",
                "text": "AI response text",
                "response_time": 1.23,
                "tokens_used": {...},
                "cost_estimate": {...}
            },
            "model_b": {
                "model_id": "model_id_2", 
                "text": "AI response text",
                "response_time": 1.45,
                "tokens_used": {...},
                "cost_estimate": {...}
            }
        }
    }
    """
    logger.info("Arena chat endpoint called")
    
    # Validate request data
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'Invalid JSON data'}), 400
    
    # Validate required fields
    user_message = data.get('message', '').strip()
    if not user_message:
        return jsonify({'error': 'Message is required and cannot be empty'}), 400
    
    model_a = data.get('model_a', '').strip()
    model_b = data.get('model_b', '').strip()
    
    if not model_a or not model_b:
        return jsonify({'error': 'Both model_a and model_b are required'}), 400
    
    if model_a == model_b:
        return jsonify({'error': 'Models must be different for comparison'}), 400
    
    # Extract settings
    settings = data.get('settings', {})
    temperature = float(settings.get('temperature', 0.7))
    max_tokens = int(settings.get('max_tokens', 2048))
    system_prompt = settings.get('system_prompt')
    
    # Generate unique arena ID
    arena_id = f"arena_{uuid.uuid4().hex[:12]}"
    timestamp = datetime.now().isoformat()
    
    logger.info(f"Arena comparison: {model_a} vs {model_b}")
    
    if not RAG_ENABLED or not bedrock_service:
        return jsonify({'error': 'Arena service not available - Bedrock not configured'}), 503
    
    # Invoke both models in parallel
    responses = _invoke_models_parallel(
        user_message=user_message,
        model_a=model_a,
        model_b=model_b,
        system_prompt=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens
    )
    
    # Store arena comparison
    arena_entry = {
        'arena_id': arena_id,
        'timestamp': timestamp,
        'message': user_message,
        'model_a': model_a,
        'model_b': model_b,
        'settings': settings,
        'responses': responses
    }
    arena_history.append(arena_entry)
    
    logger.info(f"Arena comparison completed: {arena_id}")
    
    return jsonify({
        'arena_id': arena_id,
        'timestamp': timestamp,
        'message': user_message,
        'responses': responses
    })


@arena_bp.route('/api/arena/vote', methods=['POST'])
def arena_vote():
    """
    Arena vote endpoint - records user preference between two model responses
    
    Expected JSON payload:
    {
        "arena_id": "arena_unique_id",
        "winner": "model_a" | "model_b" | "tie",
        "reason": "Optional reason for choice",
        "user_id": "Optional user identifier"
    }
    
    Returns:
    {
        "success": true,
        "vote_id": "unique_vote_id",
        "timestamp": "ISO timestamp",
        "arena_id": "arena_unique_id",
        "winner": "model_a" | "model_b" | "tie",
        "metadata": {
            "user_agent": "...",
            "ip_address": "..."
        }
    }
    """
    logger.info("Arena vote endpoint called")
    
    # Validate request data
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
    
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'Invalid JSON data'}), 400
    
    # Validate required fields
    arena_id = data.get('arena_id', '').strip()
    if not arena_id:
        return jsonify({'error': 'arena_id is required'}), 400
    
    winner = data.get('winner', '').strip()
    if winner not in ['model_a', 'model_b', 'tie']:
        return jsonify({'error': 'winner must be one of: model_a, model_b, tie'}), 400
    
    # Optional fields
    reason = data.get('reason', '').strip()
    user_id = data.get('user_id', '').strip()
    
    # Generate unique vote ID
    vote_id = f"vote_{uuid.uuid4().hex[:12]}"
    timestamp = datetime.now().isoformat()
    
    # Collect metadata
    metadata = {
        'user_agent': request.headers.get('User-Agent', 'Unknown'),
        'ip_address': request.remote_addr or 'Unknown'
    }
    
    # Check for duplicate votes (simple implementation)
    # In production, this would use a database with proper constraints
    existing_vote = None
    if user_id:
        existing_vote = next(
            (vote for vote in arena_votes 
             if vote['arena_id'] == arena_id and vote.get('user_id') == user_id),
            None
        )
    
    if existing_vote:
        logger.warning(f"Duplicate vote attempt for arena {arena_id} by user {user_id}")
        # For now, we'll allow it but could implement different policies
    
    # Store vote
    vote_entry = {
        'vote_id': vote_id,
        'arena_id': arena_id,
        'winner': winner,
        'reason': reason,
        'user_id': user_id,
        'timestamp': timestamp,
        'metadata': metadata
    }
    arena_votes.append(vote_entry)
    
    logger.info(f"Vote recorded: {vote_id} - Arena {arena_id} - Winner: {winner}")
    
    return jsonify({
        'success': True,
        'vote_id': vote_id,
        'timestamp': timestamp,
        'arena_id': arena_id,
        'winner': winner,
        'metadata': metadata
    })


def _invoke_models_parallel(user_message: str, model_a: str, model_b: str,
                           system_prompt: Optional[str] = None,
                           temperature: float = 0.7,
                           max_tokens: int = 2048) -> Dict[str, Dict[str, Any]]:
    """
    Invoke two models in parallel and return their responses
    
    Args:
        user_message: The user's message
        model_a: First model ID
        model_b: Second model ID
        system_prompt: Optional system prompt
        temperature: Temperature setting
        max_tokens: Max tokens setting
    
    Returns:
        Dictionary with model_a and model_b response data
    """
    def invoke_single_model(model_id: str) -> Dict[str, Any]:
        """Invoke a single model and return response data"""
        start_time = time.time()
        
        try:
            logger.info(f"Invoking model: {model_id}")
            
            response_data = bedrock_service.invoke_model(
                model_id=model_id,
                prompt=user_message,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            response_time = time.time() - start_time
            
            return {
                'model_id': model_id,
                'text': response_data.get('text', ''),
                'response_time': round(response_time, 3),
                'tokens_used': response_data.get('usage', {}),
                'cost_estimate': response_data.get('cost', {})
            }
            
        except Exception as e:
            response_time = time.time() - start_time
            error_msg = str(e)
            logger.error(f"Model {model_id} invocation failed: {error_msg}")
            
            return {
                'model_id': model_id,
                'text': '',
                'response_time': round(response_time, 3),
                'tokens_used': {},
                'cost_estimate': {},
                'error': error_msg
            }
    
    # Use ThreadPoolExecutor for parallel execution
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        # Submit both model invocations
        future_a = executor.submit(invoke_single_model, model_a)
        future_b = executor.submit(invoke_single_model, model_b)
        
        # Wait for both to complete and get results
        response_a = future_a.result()
        response_b = future_b.result()
    
    return {
        'model_a': response_a,
        'model_b': response_b
    }


@arena_bp.route('/api/arena/history')
def get_arena_history():
    """Get arena comparison history"""
    return jsonify({
        'comparisons': arena_history[-50:],  # Last 50 comparisons
        'votes': arena_votes[-50:]  # Last 50 votes
    })


@arena_bp.route('/api/arena/stats')
def get_arena_stats():
    """Get arena statistics"""
    if not arena_votes:
        return jsonify({
            'total_votes': 0,
            'model_wins': {},
            'tie_rate': 0.0
        })
    
    # Calculate basic statistics
    total_votes = len(arena_votes)
    model_wins = {}
    tie_count = 0
    
    for vote in arena_votes:
        winner = vote['winner']
        if winner == 'tie':
            tie_count += 1
        else:
            # Count wins per actual model (would need arena lookup for real implementation)
            model_wins[winner] = model_wins.get(winner, 0) + 1
    
    tie_rate = tie_count / total_votes if total_votes > 0 else 0.0
    
    return jsonify({
        'total_votes': total_votes,
        'model_wins': model_wins,
        'tie_rate': round(tie_rate, 3),
        'total_comparisons': len(arena_history)
    })