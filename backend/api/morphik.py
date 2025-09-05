"""
Morphik API Blueprint
Provides REST endpoints for Morphik AI integration
"""

from flask import Blueprint, request, jsonify
import logging
import time
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Global variables for dependency injection
morphik_service = None
app_context = {}

# Create blueprint
morphik_bp = Blueprint('morphik', __name__, url_prefix='/api/morphik')

def init_morphik_module(context: Dict):
    """Initialize Morphik module with app context"""
    global morphik_service, app_context
    app_context = context
    morphik_service = context.get('morphik_service')
    
    if morphik_service:
        logger.info("Morphik API module initialized successfully")
    else:
        logger.warning("Morphik service not available - running in mock mode")

@morphik_bp.route('/health', methods=['GET'])
def get_morphik_health():
    """
    Get Morphik service health status
    
    Returns:
        JSON response with health status
    """
    try:
        if not morphik_service:
            return jsonify({
                'status': 'unavailable',
                'message': 'Morphik service not configured',
                'morphik_enabled': False
            }), 503
        
        # Ping Morphik service
        health_response = morphik_service.ping()
        
        return jsonify({
            'status': 'healthy' if health_response.get('status') == 'ok' else 'unhealthy',
            'message': 'Morphik service is operational',
            'morphik_enabled': True,
            'morphik_response': health_response,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        })
        
    except Exception as e:
        logger.error(f"Morphik health check failed: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Health check failed: {str(e)}',
            'morphik_enabled': False,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        }), 500

@morphik_bp.route('/query', methods=['POST'])
def morphik_query():
    """
    Query Morphik AI with text input
    
    Request Body:
        {
            "query": "Question text",
            "filters": {}, // Optional metadata filters
            "k": 4,        // Number of context chunks
            "min_score": 0.0,
            "max_tokens": 2048,
            "temperature": 0.7,
            "use_reranking": false,
            "use_colpali": false
        }
    
    Returns:
        JSON response with AI completion and metadata
    """
    try:
        if not morphik_service:
            return jsonify({
                'error': 'Morphik service unavailable',
                'message': 'Morphik service is not configured or available',
                'response': 'I apologize, but the Morphik AI service is currently unavailable. Please try again later.',
                'morphik_enabled': False
            }), 503
        
        # Parse request data
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        query = data.get('query')
        if not query or not query.strip():
            return jsonify({'error': 'Query text is required'}), 400
        
        # Extract optional parameters
        filters = data.get('filters', {})
        k = data.get('k', 4)
        min_score = data.get('min_score', 0.0)
        max_tokens = data.get('max_tokens')
        temperature = data.get('temperature', 0.7)
        use_reranking = data.get('use_reranking', False)
        use_colpali = data.get('use_colpali', False)
        
        # Validate parameters
        if k < 1 or k > 20:
            return jsonify({'error': 'k must be between 1 and 20'}), 400
        
        if min_score < 0.0 or min_score > 1.0:
            return jsonify({'error': 'min_score must be between 0.0 and 1.0'}), 400
        
        if temperature < 0.0 or temperature > 2.0:
            return jsonify({'error': 'temperature must be between 0.0 and 2.0'}), 400
        
        logger.info(f"Processing Morphik query: {query[:100]}...")
        
        # Query Morphik service
        start_time = time.time()
        
        response = morphik_service.query(
            query=query,
            filters=filters if filters else None,
            k=k,
            min_score=min_score,
            max_tokens=max_tokens,
            temperature=temperature,
            use_reranking=use_reranking,
            use_colpali=use_colpali
        )
        
        processing_time = time.time() - start_time
        
        # Add processing metadata
        response['processing_time'] = processing_time
        response['morphik_enabled'] = True
        response['request_params'] = {
            'k': k,
            'min_score': min_score,
            'max_tokens': max_tokens,
            'temperature': temperature,
            'use_reranking': use_reranking,
            'use_colpali': use_colpali
        }
        
        logger.info(f"Morphik query completed in {processing_time:.2f}s")
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Morphik query failed: {e}")
        return jsonify({
            'error': 'Query processing failed',
            'message': str(e),
            'response': 'I apologize, but I encountered an error processing your request. Please try again.',
            'morphik_enabled': False,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        }), 500

@morphik_bp.route('/retrieve', methods=['POST'])
def morphik_retrieve():
    """
    Retrieve relevant chunks from Morphik without completion
    
    Request Body:
        {
            "query": "Search query",
            "filters": {}, // Optional metadata filters
            "k": 5,        // Number of chunks to retrieve
            "min_score": 0.0
        }
    
    Returns:
        JSON response with retrieved chunks
    """
    try:
        if not morphik_service:
            return jsonify({
                'error': 'Morphik service unavailable',
                'chunks': [],
                'morphik_enabled': False
            }), 503
        
        # Parse request data
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        query = data.get('query')
        if not query or not query.strip():
            return jsonify({'error': 'Query text is required'}), 400
        
        # Extract optional parameters
        filters = data.get('filters', {})
        k = data.get('k', 5)
        min_score = data.get('min_score', 0.0)
        
        # Validate parameters
        if k < 1 or k > 50:
            return jsonify({'error': 'k must be between 1 and 50'}), 400
        
        logger.info(f"Retrieving Morphik chunks for: {query[:100]}...")
        
        # Retrieve chunks from Morphik
        chunks = morphik_service.retrieve_chunks(
            query=query,
            filters=filters if filters else None,
            k=k,
            min_score=min_score
        )
        
        return jsonify({
            'chunks': chunks,
            'total_retrieved': len(chunks),
            'query': query,
            'morphik_enabled': True,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        })
        
    except Exception as e:
        logger.error(f"Morphik chunk retrieval failed: {e}")
        return jsonify({
            'error': 'Chunk retrieval failed',
            'message': str(e),
            'chunks': [],
            'morphik_enabled': False
        }), 500

@morphik_bp.route('/models', methods=['GET'])
def get_morphik_models():
    """
    Get available Morphik models
    
    Returns:
        JSON response with available models
    """
    try:
        if not morphik_service:
            return jsonify({
                'models': [{
                    'model_id': 'morphik-unavailable',
                    'name': 'Morphik AI (Unavailable)',
                    'description': 'Morphik service is not available',
                    'provider': 'morphik',
                    'available': False
                }],
                'morphik_enabled': False
            })
        
        models = morphik_service.get_available_models()
        
        # Mark all models as available
        for model in models:
            model['available'] = True
        
        return jsonify({
            'models': models,
            'total_models': len(models),
            'morphik_enabled': True,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        })
        
    except Exception as e:
        logger.error(f"Failed to get Morphik models: {e}")
        return jsonify({
            'models': [{
                'model_id': 'morphik-error',
                'name': 'Morphik AI (Error)',
                'description': f'Error retrieving models: {str(e)}',
                'provider': 'morphik',
                'available': False
            }],
            'morphik_enabled': False
        }), 500

@morphik_bp.route('/documents', methods=['GET'])
def list_morphik_documents():
    """
    List documents in Morphik
    
    Query Parameters:
        limit: Maximum number of documents (default: 50)
        offset: Number of documents to skip (default: 0)
        filters: JSON string with metadata filters
    
    Returns:
        JSON response with document list
    """
    try:
        if not morphik_service:
            return jsonify({
                'documents': [],
                'total_count': 0,
                'morphik_enabled': False,
                'message': 'Morphik service unavailable'
            }), 503
        
        # Parse query parameters
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        filters_str = request.args.get('filters', '{}')
        
        # Validate parameters
        if limit < 1 or limit > 200:
            return jsonify({'error': 'limit must be between 1 and 200'}), 400
        
        if offset < 0:
            return jsonify({'error': 'offset must be non-negative'}), 400
        
        try:
            import json
            filters = json.loads(filters_str) if filters_str != '{}' else None
        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid filters JSON'}), 400
        
        # List documents from Morphik
        result = morphik_service.list_documents(
            filters=filters,
            limit=limit,
            offset=offset
        )
        
        result['morphik_enabled'] = True
        result['timestamp'] = time.strftime('%Y-%m-%d %H:%M:%S')
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Failed to list Morphik documents: {e}")
        return jsonify({
            'error': 'Document listing failed',
            'message': str(e),
            'documents': [],
            'total_count': 0,
            'morphik_enabled': False
        }), 500

@morphik_bp.route('/ingest', methods=['POST'])
def ingest_morphik_text():
    """
    Ingest text content into Morphik
    
    Request Body:
        {
            "text": "Content to ingest",
            "metadata": {}, // Optional metadata
            "filename": "optional_filename.txt"
        }
    
    Returns:
        JSON response with ingestion result
    """
    try:
        if not morphik_service:
            return jsonify({
                'error': 'Morphik service unavailable',
                'success': False,
                'morphik_enabled': False
            }), 503
        
        # Parse request data
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        text = data.get('text')
        if not text or not text.strip():
            return jsonify({'error': 'Text content is required'}), 400
        
        metadata = data.get('metadata', {})
        filename = data.get('filename')
        
        logger.info(f"Ingesting text into Morphik: {len(text)} characters")
        
        # Ingest text into Morphik
        result = morphik_service.ingest_text(
            text=text,
            metadata=metadata if metadata else None,
            filename=filename
        )
        
        result['morphik_enabled'] = True
        result['timestamp'] = time.strftime('%Y-%m-%d %H:%M:%S')
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Morphik text ingestion failed: {e}")
        return jsonify({
            'error': 'Text ingestion failed',
            'message': str(e),
            'success': False,
            'morphik_enabled': False
        }), 500

# Error handlers
@morphik_bp.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'error': 'Endpoint not found',
        'message': 'The requested Morphik API endpoint does not exist',
        'available_endpoints': [
            '/api/morphik/health',
            '/api/morphik/query',
            '/api/morphik/retrieve',
            '/api/morphik/models',
            '/api/morphik/documents',
            '/api/morphik/ingest'
        ]
    }), 404

@morphik_bp.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal server error in Morphik API: {error}")
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred in the Morphik API',
        'morphik_enabled': False,
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
    }), 500