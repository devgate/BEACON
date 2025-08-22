"""
Categories API module for BEACON
Handles category management and organization
"""
from flask import Blueprint, request, jsonify
import logging

logger = logging.getLogger(__name__)

# Create Blueprint
categories_bp = Blueprint('categories', __name__)

# Category storage
categories = [
    {
        "id": 1, 
        "name": "재무", 
        "description": "재무 관련 문서", 
        "icon": "fas fa-calculator", 
        "color": "#10B981",
        "settings": {
            "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
            "chunk_size": 512,
            "chunk_overlap": 50,
            "chunk_strategy": "sentence"
        }
    },
    {
        "id": 2, 
        "name": "맛집", 
        "description": "맛집 정보 문서", 
        "icon": "fas fa-utensils", 
        "color": "#F59E0B",
        "settings": {
            "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
            "chunk_size": 256,
            "chunk_overlap": 30,
            "chunk_strategy": "paragraph"
        }
    },
    {
        "id": 3, 
        "name": "매뉴얼", 
        "description": "사용 설명서 및 매뉴얼", 
        "icon": "fas fa-book", 
        "color": "#3B82F6",
        "settings": {
            "embedding_model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            "chunk_size": 1024,
            "chunk_overlap": 100,
            "chunk_strategy": "section"
        }
    },
    {
        "id": 4, 
        "name": "일반", 
        "description": "기타 문서", 
        "icon": "fas fa-file-alt", 
        "color": "#6B7280",
        "settings": {
            "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
            "chunk_size": 512,
            "chunk_overlap": 50,
            "chunk_strategy": "sentence"
        }
    }
]

category_counter = len(categories)

def init_categories_module(app_context):
    """Initialize categories module with app context"""
    global documents
    documents = app_context['documents']

@categories_bp.route('/api/categories')
def get_categories():
    """Get all categories with document counts"""
    categories_with_count = []
    for category in categories:
        doc_count = len([doc for doc in documents if doc.get('category_id') == category['id']])
        category_with_count = category.copy()
        category_with_count['document_count'] = doc_count
        categories_with_count.append(category_with_count)
    
    return jsonify(categories_with_count)

@categories_bp.route('/api/categories/<int:category_id>/documents')
def get_documents_by_category(category_id):
    """Get documents for a specific category"""
    category_documents = [doc for doc in documents if doc.get('category_id') == category_id]
    return jsonify(category_documents)

@categories_bp.route('/api/categories', methods=['POST'])
def create_category():
    """Create a new category"""
    global category_counter
    
    data = request.get_json()
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    icon = data.get('icon', 'fas fa-folder')
    color = data.get('color', '#6B7280')
    
    if not name:
        return jsonify({'error': '카테고리 이름을 입력해주세요.'}), 400
    
    # Check for duplicate names
    if any(cat['name'] == name for cat in categories):
        return jsonify({'error': '이미 존재하는 카테고리 이름입니다.'}), 400
    
    category_counter += 1
    new_category = {
        'id': category_counter,
        'name': name,
        'description': description,
        'icon': icon,
        'color': color,
        'settings': {
            'embedding_model': 'sentence-transformers/all-MiniLM-L6-v2',
            'chunk_size': 512,
            'chunk_overlap': 50,
            'chunk_strategy': 'sentence'
        }
    }
    
    categories.append(new_category)
    
    return jsonify({
        'success': True,
        'category': new_category,
        'message': f'카테고리 "{name}"가 생성되었습니다.'
    })

@categories_bp.route('/api/categories/<int:category_id>/settings', methods=['PUT'])
def update_category_settings(category_id):
    """Update category RAG settings"""
    data = request.get_json()
    
    # Find category
    category = next((cat for cat in categories if cat['id'] == category_id), None)
    if not category:
        return jsonify({'error': '카테고리를 찾을 수 없습니다.'}), 404
    
    # Update settings
    if 'embedding_model' in data:
        category['settings']['embedding_model'] = data['embedding_model']
    if 'chunk_size' in data:
        category['settings']['chunk_size'] = int(data['chunk_size'])
    if 'chunk_overlap' in data:
        category['settings']['chunk_overlap'] = int(data['chunk_overlap'])
    if 'chunk_strategy' in data:
        category['settings']['chunk_strategy'] = data['chunk_strategy']
    
    return jsonify({
        'success': True,
        'category': category,
        'message': f'카테고리 "{category["name"]}" 설정이 업데이트되었습니다.'
    })