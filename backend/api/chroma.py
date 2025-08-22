"""
ChromaDB API module for BEACON
Handles ChromaDB operations and search functionality
"""
from flask import Blueprint, request, jsonify
import logging

logger = logging.getLogger(__name__)

# Create Blueprint
chroma_bp = Blueprint('chroma', __name__)

def init_chroma_module(app_context):
    """Initialize chroma module with app context"""
    global chroma_service, generate_embeddings
    global CHROMA_ENABLED
    
    chroma_service = app_context.get('chroma_service')
    generate_embeddings = app_context['generate_embeddings']
    CHROMA_ENABLED = app_context['CHROMA_ENABLED']

@chroma_bp.route('/api/chroma/search', methods=['POST'])
def chroma_search():
    """Search for similar documents using Chroma DB"""
    if not CHROMA_ENABLED or not chroma_service:
        return jsonify({'error': 'Chroma DB not available'}), 503
    
    try:
        data = request.get_json()
        query_text = data.get('query', '')
        n_results = min(data.get('n_results', 5), 20)  # Limit to 20 results
        document_filter = data.get('document_filter')
        
        if not query_text:
            return jsonify({'error': 'Query text is required'}), 400
        
        # Generate embedding for query
        query_embeddings = generate_embeddings([query_text])
        if not query_embeddings:
            return jsonify({'error': 'Failed to generate query embedding'}), 500
        
        # Search similar chunks
        search_results = chroma_service.search_similar_chunks(
            query_embedding=query_embeddings[0],
            n_results=n_results,
            document_filter=document_filter
        )
        
        return jsonify({
            'success': True,
            'query': query_text,
            'results': search_results
        })
        
    except Exception as e:
        logger.error(f"Chroma search failed: {e}")
        return jsonify({'error': f'Search failed: {str(e)}'}), 500

@chroma_bp.route('/api/chroma/stats')
def chroma_stats():
    """Get Chroma DB collection statistics"""
    if not CHROMA_ENABLED or not chroma_service:
        return jsonify({'error': 'Chroma DB not available'}), 503
    
    try:
        stats = chroma_service.get_collection_stats()
        documents_list = chroma_service.list_all_documents()
        
        return jsonify({
            'success': True,
            'stats': stats,
            'documents': documents_list
        })
        
    except Exception as e:
        logger.error(f"Failed to get Chroma stats: {e}")
        return jsonify({'error': f'Failed to get statistics: {str(e)}'}), 500

@chroma_bp.route('/api/chroma/document/<document_id>')
def get_chroma_document_info(document_id):
    """Get information about a specific document in Chroma DB"""
    if not CHROMA_ENABLED or not chroma_service:
        return jsonify({'error': 'Chroma DB not available'}), 503
    
    try:
        doc_info = chroma_service.get_document_info(document_id)
        return jsonify({
            'success': True,
            'document_info': doc_info
        })
        
    except Exception as e:
        logger.error(f"Failed to get document info: {e}")
        return jsonify({'error': f'Failed to get document info: {str(e)}'}), 500

@chroma_bp.route('/api/chroma/document/<document_id>', methods=['DELETE'])
def delete_chroma_document(document_id):
    """Delete a document from Chroma DB"""
    if not CHROMA_ENABLED or not chroma_service:
        return jsonify({'error': 'Chroma DB not available'}), 503
    
    try:
        success = chroma_service.delete_document(document_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Document {document_id} deleted from Chroma DB'
            })
        else:
            return jsonify({
                'success': False,
                'message': f'Document {document_id} not found in Chroma DB'
            }), 404
        
    except Exception as e:
        logger.error(f"Failed to delete document: {e}")
        return jsonify({'error': f'Failed to delete document: {str(e)}'}), 500

@chroma_bp.route('/api/chroma/clear', methods=['POST'])
def clear_chroma():
    """Clear all documents from ChromaDB collection"""
    if not CHROMA_ENABLED or not chroma_service:
        return jsonify({'error': 'Chroma DB not available'}), 503
    
    try:
        if chroma_service.clear_collection():
            logger.info("ChromaDB collection cleared successfully")
            return jsonify({
                'success': True,
                'message': 'ChromaDB collection cleared successfully'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to clear ChromaDB collection'
            }), 500
    except Exception as e:
        logger.error(f"Error clearing ChromaDB: {e}")
        return jsonify({
            'success': False,
            'message': f'Error clearing ChromaDB: {str(e)}'
        }), 500

@chroma_bp.route('/api/chroma/reset', methods=['POST'])
def reset_chroma():
    """Reset ChromaDB collection by deleting and recreating it"""
    if not CHROMA_ENABLED or not chroma_service:
        return jsonify({'error': 'Chroma DB not available'}), 503
    
    try:
        if chroma_service.reset_collection():
            logger.info("ChromaDB collection reset successfully")
            return jsonify({
                'success': True,
                'message': 'ChromaDB collection reset successfully'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to reset ChromaDB collection'
            }), 500
    except Exception as e:
        logger.error(f"Error resetting ChromaDB: {e}")
        return jsonify({
            'success': False,
            'message': f'Error resetting ChromaDB: {str(e)}'
        }), 500