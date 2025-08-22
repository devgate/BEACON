"""
Bedrock API module for BEACON
Handles AWS Bedrock model management and health checks
"""
from flask import Blueprint, jsonify
import logging

logger = logging.getLogger(__name__)

# Create Blueprint
bedrock_bp = Blueprint('bedrock', __name__)

def init_bedrock_module(app_context):
    """Initialize bedrock module with app context"""
    global bedrock_service, rag_engine
    global RAG_ENABLED
    
    bedrock_service = app_context['bedrock_service']
    rag_engine = app_context['rag_engine']
    RAG_ENABLED = app_context['RAG_ENABLED']

@bedrock_bp.route('/api/bedrock/models')
def get_bedrock_models():
    """Get available Bedrock models"""
    if not RAG_ENABLED:
        return jsonify({
            'error': 'RAG system not available',
            'models': []
        }), 503
    
    try:
        models = bedrock_service.get_available_models(include_inference_profiles=True)
        model_list = []
        
        for model in models:
            model_dict = model.to_dict()
            model_list.append(model_dict)
        
        return jsonify({
            'models': model_list,
            'total_count': len(model_list),
            'inference_profiles_included': True
        })
        
    except Exception as e:
        logger.error(f"Error getting Bedrock models: {e}")
        return jsonify({
            'error': 'Failed to retrieve Bedrock models',
            'details': str(e)
        }), 500

@bedrock_bp.route('/api/bedrock/health')
def bedrock_health():
    """Health check for Bedrock and RAG system"""
    if not RAG_ENABLED:
        return jsonify({
            'status': 'unavailable',
            'message': 'RAG system not initialized',
            'rag_enabled': False
        })
    
    try:
        health_status = rag_engine.health_check()
        return jsonify({
            'status': health_status['status'],
            'rag_enabled': True,
            'details': health_status
        })
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'rag_enabled': False,
            'error': str(e)
        }), 500

@bedrock_bp.route('/api/embedding-models')
def get_embedding_models():
    """Get available embedding models"""
    if RAG_ENABLED:
        # Return Bedrock embedding models
        models = [
            {
                "id": "amazon.titan-embed-text-v1",
                "name": "Titan Text Embeddings v1",
                "description": "Amazon's high-quality text embedding model",
                "language": "multilingual",
                "dimension": 1536,
                "provider": "amazon"
            },
            {
                "id": "amazon.titan-embed-text-v2",
                "name": "Titan Text Embeddings v2",
                "description": "Improved Amazon text embedding model",
                "language": "multilingual", 
                "dimension": 1024,
                "provider": "amazon"
            }
        ]
    else:
        # Fallback to original models
        models = [
            {
                "id": "sentence-transformers/all-MiniLM-L6-v2",
                "name": "All-MiniLM-L6-v2",
                "description": "빠르고 효율적인 범용 모델",
                "language": "multilingual",
                "size": "80MB"
            },
            {
                "id": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                "name": "Paraphrase-Multilingual-MiniLM-L12-v2",
                "description": "다국어 지원 고품질 모델",
                "language": "multilingual",
                "size": "420MB"
            }
        ]
    
    return jsonify(models)