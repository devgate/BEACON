"""
Vision API endpoints for BEACON
Provides REST API for PDF vision analysis and graph-based RAG
"""

import os
import json
import logging
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import tempfile
from datetime import datetime

from vision_service import VisionService

# Set up logging
logger = logging.getLogger(__name__)

# Create Blueprint
vision_bp = Blueprint('vision', __name__, url_prefix='/api/vision')

# Allowed file extensions
ALLOWED_EXTENSIONS = {'pdf'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_vision_service():
    """Get configured vision service instance"""
    openai_key = os.getenv('OPENAI_API_KEY')
    bedrock_region = os.getenv('BEDROCK_REGION', 'ap-northeast-2')
    
    return VisionService(openai_api_key=openai_key, bedrock_region=bedrock_region)

@vision_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'vision_api',
        'timestamp': datetime.now().isoformat(),
        'openai_configured': bool(os.getenv('OPENAI_API_KEY')),
        'bedrock_configured': bool(os.getenv('AWS_ACCESS_KEY_ID'))
    })

@vision_bp.route('/upload', methods=['POST'])
def upload_pdf():
    """
    Upload PDF file for vision analysis
    """
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({
                'error': 'No file provided',
                'code': 'NO_FILE'
            }), 400

        file = request.files['file']
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({
                'error': 'No file selected',
                'code': 'NO_FILE_SELECTED'
            }), 400

        # Check file type
        if not (file and allowed_file(file.filename)):
            return jsonify({
                'error': 'Invalid file type. Only PDF files are allowed.',
                'code': 'INVALID_FILE_TYPE'
            }), 400

        # Save file temporarily
        filename = secure_filename(file.filename)
        
        # Create uploads directory if it doesn't exist
        upload_dir = os.path.join(current_app.root_path, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        safe_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(upload_dir, safe_filename)
        
        file.save(file_path)
        
        logger.info(f"File uploaded successfully: {safe_filename}")
        
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': safe_filename,
            'file_path': file_path,
            'file_size': os.path.getsize(file_path),
            'upload_time': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        return jsonify({
            'error': 'File upload failed',
            'code': 'UPLOAD_ERROR',
            'details': str(e)
        }), 500

@vision_bp.route('/analyze', methods=['POST'])
def analyze_pdf():
    """
    Analyze uploaded PDF with vision API
    
    Request body:
    {
        "filename": "uploaded_file.pdf",
        "options": {
            "extract_text": true,
            "extract_images": true,
            "analyze_images": true
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'filename' not in data:
            return jsonify({
                'error': 'Filename is required',
                'code': 'FILENAME_REQUIRED'
            }), 400
        
        filename = data['filename']
        options = data.get('options', {})
        
        # Construct file path
        upload_dir = os.path.join(current_app.root_path, 'uploads')
        file_path = os.path.join(upload_dir, filename)
        
        if not os.path.exists(file_path):
            return jsonify({
                'error': 'File not found',
                'code': 'FILE_NOT_FOUND'
            }), 404
        
        # Get vision service
        vision_service = get_vision_service()
        
        logger.info(f"Starting vision analysis for: {filename}")
        
        # Process PDF with vision analysis
        result = vision_service.process_pdf_with_vision(file_path)
        
        # Check if analysis was successful
        if 'error' in result:
            return jsonify({
                'error': 'Vision analysis failed',
                'code': 'ANALYSIS_ERROR',
                'details': result['error']
            }), 500
        
        logger.info(f"Vision analysis completed for: {filename}")
        
        return jsonify({
            'message': 'Vision analysis completed',
            'filename': filename,
            'analysis': result,
            'processed_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Vision analysis failed: {e}")
        return jsonify({
            'error': 'Vision analysis failed',
            'code': 'ANALYSIS_ERROR',
            'details': str(e)
        }), 500

@vision_bp.route('/extract-images', methods=['POST'])
def extract_images_only():
    """
    Extract images from PDF without vision analysis
    """
    try:
        data = request.get_json()
        
        if not data or 'filename' not in data:
            return jsonify({
                'error': 'Filename is required',
                'code': 'FILENAME_REQUIRED'
            }), 400
        
        filename = data['filename']
        
        # Construct file path
        upload_dir = os.path.join(current_app.root_path, 'uploads')
        file_path = os.path.join(upload_dir, filename)
        
        if not os.path.exists(file_path):
            return jsonify({
                'error': 'File not found',
                'code': 'FILE_NOT_FOUND'
            }), 404
        
        # Get vision service
        vision_service = get_vision_service()
        
        # Extract images only
        images = vision_service.extract_images_from_pdf(file_path)
        
        # Remove base64 data for response (to reduce size)
        images_info = []
        for img in images:
            img_info = {k: v for k, v in img.items() if k != 'base64'}
            img_info['has_image_data'] = 'base64' in img
            images_info.append(img_info)
        
        return jsonify({
            'message': 'Images extracted successfully',
            'filename': filename,
            'total_images': len(images),
            'images': images_info,
            'extracted_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Image extraction failed: {e}")
        return jsonify({
            'error': 'Image extraction failed',
            'code': 'EXTRACTION_ERROR',
            'details': str(e)
        }), 500

@vision_bp.route('/graph-search', methods=['POST'])
def graph_search():
    """
    Search through analyzed PDF using graph-based approach
    
    Request body:
    {
        "filename": "analyzed_file.pdf",
        "query": "search query",
        "options": {
            "include_images": true,
            "include_text": true,
            "max_results": 10
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'filename' not in data or 'query' not in data:
            return jsonify({
                'error': 'Filename and query are required',
                'code': 'MISSING_PARAMETERS'
            }), 400
        
        filename = data['filename']
        query = data['query']
        options = data.get('options', {})
        
        # For now, return mock graph search results
        # In a real implementation, you would:
        # 1. Load analyzed PDF data from database/storage
        # 2. Perform semantic search on entities and relationships
        # 3. Return relevant graph nodes and edges
        
        mock_results = {
            'query': query,
            'filename': filename,
            'results': [
                {
                    'node_id': 'entity_1',
                    'node_type': 'diagram',
                    'name': 'System Architecture',
                    'description': 'Main system architecture diagram',
                    'relevance_score': 0.95,
                    'source_page': 2,
                    'related_entities': ['entity_2', 'entity_3']
                },
                {
                    'node_id': 'entity_2',
                    'node_type': 'text',
                    'name': 'Database Configuration',
                    'description': 'Configuration details for database setup',
                    'relevance_score': 0.87,
                    'source_page': 3,
                    'related_entities': ['entity_1']
                }
            ],
            'total_results': 2,
            'search_time_ms': 45
        }
        
        return jsonify({
            'message': 'Graph search completed',
            'search_results': mock_results,
            'searched_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Graph search failed: {e}")
        return jsonify({
            'error': 'Graph search failed',
            'code': 'SEARCH_ERROR',
            'details': str(e)
        }), 500

@vision_bp.route('/config', methods=['GET'])
def get_config():
    """Get vision service configuration"""
    return jsonify({
        'openai_configured': bool(os.getenv('OPENAI_API_KEY')),
        'bedrock_configured': bool(os.getenv('AWS_ACCESS_KEY_ID')),
        'upload_max_size': '16MB',
        'supported_formats': ['pdf'],
        'features': {
            'image_extraction': True,
            'vision_analysis': bool(os.getenv('OPENAI_API_KEY')),
            'graph_search': True
        }
    })

@vision_bp.errorhandler(413)
def too_large(e):
    return jsonify({
        'error': 'File too large',
        'code': 'FILE_TOO_LARGE',
        'max_size': '16MB'
    }), 413