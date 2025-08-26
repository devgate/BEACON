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
    """Get available embedding models from AWS Bedrock with detailed configuration"""
    if RAG_ENABLED:
        try:
            logger.info("Attempting to fetch embedding models from Bedrock API")
            # Try to fetch actual models from Bedrock
            actual_models = bedrock_service.get_available_embedding_models()
            logger.info(f"Successfully fetched {len(actual_models)} models from Bedrock API")
            
            # Enhance with additional metadata
            enhanced_models = []
            for model in actual_models:
                model_id = model.get('modelId', '')
                
                # Map model IDs to enhanced metadata
                if 'titan-embed-text-v1' in model_id:
                    enhanced_models.append({
                        "id": model_id,
                        "name": "Titan Embeddings v1",
                        "provider": model.get('providerName', 'Amazon'),
                        "dimensions": 1536,
                        "maxTokens": 8000,
                        "description": "General purpose text embeddings with proven performance",
                        "cost": "$0.0001 per 1K tokens",
                        "language": "multilingual",
                        "features": ["Fixed dimensions", "Proven performance", "Stable"],
                        "status": model.get('modelStatus', 'ACTIVE'),
                        "recommended": False
                    })
                elif 'titan-embed-text-v2' in model_id:
                    enhanced_models.append({
                        "id": model_id,
                        "name": "Titan Embeddings v2",
                        "provider": model.get('providerName', 'Amazon'),
                        "dimensions": [256, 512, 1024],  # Variable dimensions
                        "defaultDimension": 512,
                        "maxTokens": 8000,
                        "description": "Advanced embeddings with variable dimensions for optimized storage",
                        "cost": "$0.00002 per 1K tokens (80% cheaper than v1)",
                        "language": "multilingual (100+ languages)",
                        "features": ["Variable dimensions", "Better multilingual", "Normalized outputs", "Cost-effective"],
                        "status": model.get('modelStatus', 'ACTIVE'),
                        "recommended": True
                    })
                elif 'titan-embed-image-v1' in model_id:
                    enhanced_models.append({
                        "id": model_id,
                        "name": "Titan Multimodal Embeddings",
                        "provider": model.get('providerName', 'Amazon'),
                        "dimensions": 1024,
                        "maxTokens": 8000,
                        "description": "Text and image embeddings for multimodal search",
                        "cost": "$0.0008 per image, $0.00002 per 1K text tokens",
                        "language": "multilingual",
                        "features": ["Text & Image", "Cross-modal search", "Visual similarity"],
                        "status": model.get('modelStatus', 'ACTIVE'),
                        "recommended": False
                    })
                elif 'cohere.embed' in model_id.lower():
                    if 'multilingual' in model_id.lower():
                        enhanced_models.append({
                            "id": model_id,
                            "name": "Cohere Embed Multilingual",
                            "provider": model.get('providerName', 'Cohere'),
                            "dimensions": 1024,
                            "maxTokens": 512,
                            "description": "Multilingual embeddings supporting 100+ languages",
                            "cost": "$0.0001 per 1K tokens",
                            "language": "multilingual (100+ languages)",
                            "features": ["Wide language support", "Cross-lingual search", "Semantic search"],
                            "status": model.get('modelStatus', 'ACTIVE'),
                            "recommended": False
                        })
                    else:
                        enhanced_models.append({
                            "id": model_id,
                            "name": "Cohere Embed English",
                            "provider": model.get('providerName', 'Cohere'),
                            "dimensions": 1024,
                            "maxTokens": 512,
                            "description": "English-optimized embeddings for high accuracy",
                            "cost": "$0.0001 per 1K tokens",
                            "language": "english",
                            "features": ["English optimized", "High accuracy", "Fast inference"],
                            "status": model.get('modelStatus', 'ACTIVE'),
                            "recommended": False
                        })
            
            # If no models found from API, use defaults
            if not enhanced_models:
                enhanced_models = get_default_embedding_models()
            
            return jsonify({
                "models": enhanced_models,
                "total_count": len(enhanced_models),
                "rag_enabled": RAG_ENABLED,
                "bedrock_available": True,
                "source": "bedrock_api"
            })
            
        except Exception as e:
            logger.warning(f"Could not fetch embedding models from Bedrock API: {e}")
            # Fall back to default models
            models = get_default_embedding_models()
            return jsonify({
                "models": models,
                "total_count": len(models),
                "rag_enabled": RAG_ENABLED,
                "bedrock_available": True,
                "source": "default"
            })
    else:
        # Fallback models for when Bedrock is not available
        models = [
            {
                "id": "sentence-transformers/all-MiniLM-L6-v2",
                "name": "All-MiniLM-L6-v2",
                "provider": "Hugging Face",
                "dimensions": 384,
                "maxTokens": 256,
                "description": "Fast and efficient general-purpose model",
                "cost": "Free",
                "language": "multilingual",
                "features": ["Fast", "Lightweight", "Open source"],
                "status": "AVAILABLE",
                "recommended": False
            }
        ]
        
        return jsonify({
            "models": models,
            "total_count": len(models),
            "rag_enabled": False,
            "bedrock_available": False,
            "source": "fallback"
        })

def get_default_embedding_models():
    """Return default Bedrock embedding models when API is unavailable"""
    return [
        {
            "id": "amazon.titan-embed-text-v1",
            "name": "Titan Embeddings v1",
            "provider": "Amazon",
            "dimensions": 1536,
            "maxTokens": 8000,
            "description": "General purpose text embeddings with proven performance",
            "cost": "$0.0001 per 1K tokens",
            "language": "multilingual",
            "features": ["Fixed dimensions", "Proven performance", "Stable"],
            "status": "ACTIVE",
            "recommended": False
        },
        {
            "id": "amazon.titan-embed-text-v2:0",
            "name": "Titan Embeddings v2",
            "provider": "Amazon",
            "dimensions": [256, 512, 1024],
            "defaultDimension": 512,
            "maxTokens": 8000,
            "description": "Advanced embeddings with variable dimensions for optimized storage",
            "cost": "$0.00002 per 1K tokens (80% cheaper than v1)",
            "language": "multilingual (100+ languages)",
            "features": ["Variable dimensions", "Better multilingual", "Normalized outputs", "Cost-effective"],
            "status": "ACTIVE",
            "recommended": True
        },
        {
            "id": "amazon.titan-embed-image-v1",
            "name": "Titan Multimodal Embeddings",
            "provider": "Amazon",
            "dimensions": 1024,
            "maxTokens": 8000,
            "description": "Text and image embeddings for multimodal search",
            "cost": "$0.0008 per image, $0.00002 per 1K text tokens",
            "language": "multilingual",
            "features": ["Text & Image", "Cross-modal search", "Visual similarity"],
            "status": "ACTIVE",
            "recommended": False
        }
    ]