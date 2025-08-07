from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
from datetime import datetime
import random
import os
from werkzeug.utils import secure_filename
import PyPDF2
import io
from pdf2image import convert_from_bytes
import logging
import time
import json
from typing import Optional

# Import our RAG components
from bedrock_service import BedrockService, create_bedrock_service
from vector_store import VectorStore, create_vector_store
from rag_engine import RAGEngine, create_rag_engine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins=['http://localhost:3000', 'http://localhost:8080'])
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB 최대 파일 크기
app.config['UPLOAD_FOLDER'] = 'uploads'

# Initialize RAG system
try:
    logger.info("Initializing RAG system...")
    
    # Initialize Bedrock service
    bedrock_service = create_bedrock_service({
        'BEDROCK_REGION': os.getenv('BEDROCK_REGION', 'ap-northeast-2'),
        'AWS_PROFILE': os.getenv('AWS_PROFILE')
    })
    
    # Initialize vector store
    vector_store = create_vector_store(
        table_name=os.getenv('DYNAMODB_VECTORS_TABLE', 'prod-beacon-vectors')
    )
    
    # Initialize RAG engine
    rag_engine = create_rag_engine(bedrock_service, vector_store)
    
    logger.info("RAG system initialized successfully")
    RAG_ENABLED = True
    
except Exception as e:
    logger.error(f"Failed to initialize RAG system: {e}")
    logger.info("Running in mock mode")
    RAG_ENABLED = False
    bedrock_service = None
    vector_store = None
    rag_engine = None

# Mock AI 응답 데이터
MOCK_RESPONSES = [
    "안녕하세요! BEACON AI 어시스턴트입니다. 업로드하신 문서에 대해 질문해주시면 도움을 드리겠습니다.",
    "문서 내용을 분석한 결과, 관련 정보를 찾았습니다. 구체적으로 어떤 부분에 대해 더 자세히 알고 싶으신가요?",
    "업로드된 문서를 검토해보니 흥미로운 내용이 많네요. 특정 섹션에 대해 질문해주시면 더 정확한 답변을 드릴 수 있습니다.",
    "문서 분석이 완료되었습니다. 요약하자면, 핵심 내용은 다음과 같습니다. 추가로 궁금한 점이 있으시면 언제든 질문해주세요.",
    "해당 문서에서 관련 정보를 찾아보겠습니다. 잠시만 기다려주세요... 네, 찾았습니다! 상세한 설명을 드리겠습니다."
]

# 카테고리별 특화 응답
CATEGORY_RESPONSES = {
    1: ["재무 문서를 분석한 결과입니다.", "재정 상태가 양호해 보입니다.", "회계 기준에 따르면 다음과 같습니다."],
    2: ["맛집 정보를 확인했습니다.", "이 음식점의 특징은 다음과 같습니다.", "추천 메뉴와 가격 정보입니다."],
    3: ["매뉴얼을 참고한 결과입니다.", "사용법은 다음 단계를 따라주세요.", "주의사항을 확인해주세요."],
    4: ["문서 내용을 검토했습니다.", "관련 정보는 다음과 같습니다.", "추가 참고사항입니다."]
}

# 허용된 파일 확장자
ALLOWED_EXTENSIONS = {'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(file_stream):
    """PDF 파일에서 텍스트 추출"""
    try:
        pdf_reader = PyPDF2.PdfReader(file_stream)
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        print(f"PDF 텍스트 추출 오류: {e}")
        return None

def extract_images_from_pdf(file_stream, document_id):
    """
    PDF 파일에서 각 페이지를 이미지로 추출하는 함수
    
    Args:
        file_stream: PDF 파일의 바이트 스트림
        document_id: 문서 ID (디렉토리 구분용)
        
    Returns:
        list: 추출된 이미지 정보 리스트 (페이지 번호, 파일명, URL, 경로 포함)
    """
    images = []
    try:
        # PDF를 이미지로 변환 (pdf2image 사용)
        file_stream.seek(0)  # 스트림 위치 초기화
        pdf_images = convert_from_bytes(file_stream.read(), dpi=150, fmt='PNG')
        
        # 이미지 저장 디렉토리 생성 (문서별로 분리)
        image_dir = os.path.join('static', 'images', f'doc_{document_id}')
        os.makedirs(image_dir, exist_ok=True)
        
        # 각 페이지를 이미지 파일로 저장
        for page_num, image in enumerate(pdf_images, 1):
            # 이미지 파일명 생성 (페이지_번호.png)
            image_filename = f'page_{page_num}.png'
            image_path = os.path.join(image_dir, image_filename)
            
            # 이미지를 PNG 형식으로 저장
            image.save(image_path, 'PNG')
            
            # 웹에서 접근 가능한 URL 생성
            image_url = f'/static/images/doc_{document_id}/{image_filename}'
            
            # 이미지 정보를 리스트에 추가
            images.append({
                'page': page_num,
                'filename': image_filename,
                'url': image_url,
                'path': image_path
            })
            
        print(f"PDF {document_id}: {len(images)}개의 이미지를 추출했습니다.")
        return images
        
    except Exception as e:
        print(f"PDF 이미지 추출 오류: {e}")
        return []

# 문서 데이터 저장소 (메모리 기반)
# 업로드된 PDF 문서들의 메타데이터와 내용을 저장
documents = []

# 문서 카테고리 저장소
# 각 영역별로 문서를 분류하여 관리
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

# 문서 ID 자동 증가 카운터
# 새로운 문서 업로드 시 고유 ID 생성에 사용
document_counter = 0

# 카테고리 ID 자동 증가 카운터
category_counter = len(categories)

# 채팅 기록 저장소
# 사용자와 AI 간의 대화 내역을 시간순으로 저장
chat_history = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/documents')
def get_documents():
    """전체 문서 목록 조회"""
    return jsonify(documents)

@app.route('/api/categories')
def get_categories():
    """카테고리 목록 조회"""
    # 각 카테고리별 문서 개수 추가
    categories_with_count = []
    for category in categories:
        doc_count = len([doc for doc in documents if doc.get('category_id') == category['id']])
        category_with_count = category.copy()
        category_with_count['document_count'] = doc_count
        categories_with_count.append(category_with_count)
    
    return jsonify(categories_with_count)

@app.route('/api/categories/<int:category_id>/documents')
def get_documents_by_category(category_id):
    """특정 카테고리의 문서 목록 조회"""
    category_documents = [doc for doc in documents if doc.get('category_id') == category_id]
    return jsonify(category_documents)

@app.route('/api/categories', methods=['POST'])
def create_category():
    """새 카테고리 생성"""
    global category_counter
    
    data = request.get_json()
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    icon = data.get('icon', 'fas fa-folder')
    color = data.get('color', '#6B7280')
    
    if not name:
        return jsonify({'error': '카테고리 이름을 입력해주세요.'}), 400
    
    # 중복 이름 체크
    if any(cat['name'] == name for cat in categories):
        return jsonify({'error': '이미 존재하는 카테고리 이름입니다.'}), 400
    
    category_counter += 1
    new_category = {
        'id': category_counter,
        'name': name,
        'description': description,
        'icon': icon,
        'color': color
    }
    
    categories.append(new_category)
    
    return jsonify({
        'success': True,
        'category': new_category,
        'message': f'카테고리 "{name}"가 생성되었습니다.'
    })

@app.route('/api/categories/<int:category_id>/settings', methods=['PUT'])
def update_category_settings(category_id):
    """카테고리별 RAG 설정 업데이트"""
    data = request.get_json()
    
    # 카테고리 찾기
    category = next((cat for cat in categories if cat['id'] == category_id), None)
    if not category:
        return jsonify({'error': '카테고리를 찾을 수 없습니다.'}), 404
    
    # 설정 업데이트
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

@app.route('/api/bedrock/models')
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

@app.route('/api/bedrock/health')
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

@app.route('/api/embedding-models')
def get_embedding_models():
    """Get available embedding models (legacy endpoint)"""
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

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Enhanced chat API endpoint with Bedrock RAG integration
    Supports model selection, cost tracking, and real AI responses
    """
    data = request.get_json()
    user_message = data.get('message', '')
    selected_category_id = data.get('category_id', None)
    model_id = data.get('model_id', None)
    settings = data.get('settings', {})
    
    # Extract settings
    temperature = float(settings.get('temperature', 0.7))
    max_tokens = int(settings.get('max_tokens', 2048))
    use_rag = settings.get('use_rag', True)
    top_k_documents = int(settings.get('top_k_documents', 5))
    
    try:
        if RAG_ENABLED:
            if use_rag and documents:
                # Use RAG system with uploaded documents
                logger.info(f"Processing RAG query: {user_message[:50]}... with model: {model_id}")
                
                response_data = rag_engine.query(
                    query_text=user_message,
                    category_id=selected_category_id,
                    model_id=model_id,
                    top_k_documents=top_k_documents,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    include_sources=True
                )
                
                # Format sources for frontend
                referenced_docs = []
                images = []
                
                for source in response_data.sources:
                    # Find corresponding document for metadata
                    doc_info = next((doc for doc in documents if str(doc['id']) == source.document_id), None)
                    
                    referenced_docs.append({
                        'id': source.document_id,
                        'title': source.metadata.get('title', 'Unknown Document'),
                        'has_file': bool(doc_info and doc_info.get('file_path')),
                        'relevance_score': source.similarity_score,
                        'chunk_index': source.chunk_index
                    })
                    
                    # Add images if available
                    if doc_info and doc_info.get('images'):
                        images.extend(doc_info['images'][:2])  # Limit to 2 images per source
                
                # Save to chat history
                chat_entry = {
                    'timestamp': datetime.now().isoformat(),
                    'user_message': user_message,
                    'ai_response': response_data.response,
                    'model_used': response_data.model_used,
                    'category_id': selected_category_id,
                    'tokens_used': response_data.tokens_used,
                    'cost_estimate': response_data.cost_estimate,
                    'confidence_score': response_data.confidence_score,
                    'processing_time': response_data.processing_time,
                    'sources_count': len(response_data.sources)
                }
                chat_history.append(chat_entry)
                
                return jsonify({
                    'response': response_data.response,
                    'model_used': response_data.model_used,
                    'timestamp': chat_entry['timestamp'],
                    'tokens_used': response_data.tokens_used,
                    'cost_estimate': response_data.cost_estimate,
                    'confidence_score': response_data.confidence_score,
                    'processing_time': response_data.processing_time,
                    'images': images[:5],  # Limit to 5 images total
                    'referenced_docs': referenced_docs[:3],  # Limit to 3 documents
                    'rag_enabled': True
                })
            else:
                # Use Bedrock for general conversation without RAG
                logger.info(f"Processing general conversation with Bedrock: {user_message[:50]}... with model: {model_id}")
                
                import time
                start_time = time.time()
                
                # Set default model if not specified
                if not model_id:
                    available_models = bedrock_service.get_available_models()
                    # Filter for text generation models (exclude embedding models)
                    text_models = [
                        model for model in available_models 
                        if 'TEXT' in model.output_modalities and 'EMBEDDING' not in model.output_modalities
                    ]
                    if text_models:
                        # Prefer Claude models, then Amazon Nova, then others
                        claude_models = [m for m in text_models if 'claude' in m.model_id.lower()]
                        nova_models = [m for m in text_models if 'nova' in m.model_id.lower()]
                        
                        if claude_models:
                            model_id = claude_models[0].model_id
                        elif nova_models:
                            model_id = nova_models[0].model_id
                        else:
                            model_id = text_models[0].model_id
                    else:
                        raise Exception("No text generation models available")
                
                # Create a general conversation system prompt
                system_prompt = """당신은 BEACON AI입니다. 사용자와 자연스럽고 도움이 되는 대화를 나누세요. 
한국어로 응답하되, 사용자가 다른 언어를 사용하면 해당 언어로 응답해주세요.
정확한 정보를 제공하고, 모르는 것은 솔직히 모른다고 말씀해주세요."""
                
                # Invoke Bedrock model directly
                response_data = bedrock_service.invoke_model(
                    model_id=model_id,
                    prompt=user_message,
                    system_prompt=system_prompt,
                    max_tokens=max_tokens,
                    temperature=temperature
                )
                
                processing_time = time.time() - start_time
                
                # Save to chat history
                chat_entry = {
                    'timestamp': datetime.now().isoformat(),
                    'user_message': user_message,
                    'ai_response': response_data['text'],
                    'model_used': model_id,
                    'category_id': selected_category_id,
                    'tokens_used': response_data.get('usage', {}),
                    'cost_estimate': response_data.get('cost', {}),
                    'confidence_score': 1.0,  # General conversation doesn't have relevance score
                    'processing_time': processing_time,
                    'sources_count': 0
                }
                chat_history.append(chat_entry)
                
                return jsonify({
                    'response': response_data['text'],
                    'model_used': model_id,
                    'timestamp': chat_entry['timestamp'],
                    'tokens_used': response_data.get('usage', {}),
                    'cost_estimate': response_data.get('cost', {}),
                    'confidence_score': 1.0,
                    'processing_time': processing_time,
                    'images': [],
                    'referenced_docs': [],
                    'rag_enabled': False
                })
        else:
            # Fallback to mock responses when Bedrock not available
            logger.info("Using mock/fallback response system")
            return _generate_mock_response(user_message, selected_category_id)
            
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        # Fallback to mock response on error
        return _generate_mock_response(user_message, selected_category_id, error=str(e))

def _generate_mock_response(user_message: str, category_id: Optional[int] = None, error: str = None):
    """Generate mock response for fallback mode"""
    try:
        # Add error context if provided
        if error:
            logger.warning(f"Generating mock response due to error: {error}")
        
        # 관련 문서 및 이미지 저장소 초기화
        relevant_docs = []
        relevant_images = []
        
        # 검색 대상 문서 필터링 (카테고리가 선택된 경우 해당 카테고리만)
        search_documents = documents
        if category_id:
            search_documents = [doc for doc in documents if doc.get('category_id') == category_id]
            logger.info(f"선택된 카테고리 {category_id}의 문서 {len(search_documents)}개를 검색 대상으로 설정")
        
        # 업로드된 문서가 없는 경우 안내 메시지 반환
        if len(search_documents) == 0:
            if category_id:
                # 선택된 카테고리의 이름 찾기
                category_name = next((cat['name'] for cat in categories if cat['id'] == category_id), '선택된 카테고리')
                response = f"현재 '{category_name}' 카테고리에 업로드된 문서가 없습니다. 해당 카테고리에 PDF 파일을 먼저 업로드한 후 질문해주세요."
            else:
                response = "현재 업로드된 문서가 없습니다. PDF 파일을 먼저 업로드한 후 문서에 대해 질문해주세요."
        else:
            # 인사말 및 간단한 질문 필터링
            # 이런 경우에는 문서 검색을 하지 않고 일반적인 응답 생성
            greeting_words = ['안녕', 'hello', 'hi', '반가워', '잘지내', '어떻게']
            simple_questions = ['뭐야', '뭔가', '어떻게', '왜', '언제', '어디서']
            
            user_message_lower = user_message.lower()
            is_greeting = any(word in user_message_lower for word in greeting_words)
            is_simple = len(user_message.split()) <= 3 and any(word in user_message_lower for word in simple_questions)
            
            # 실제 문서 내용과 관련된 질문인 경우에만 문서 검색 수행
            if not is_greeting and not is_simple:
                # 검색 키워드 전처리 (1글자 이하 키워드 제외로 노이즈 감소)
                search_keywords = [word.strip() for word in user_message.lower().split() if len(word.strip()) > 1]
                
                # 각 문서에 대해 관련성 검사 (필터링된 문서만 대상)
                for doc in search_documents:
                    # 문서 제목과 내용을 합쳐서 검색 대상 텍스트 생성
                    doc_text = (doc['title'] + ' ' + doc['content']).lower()
                    
                    # 키워드 매칭 점수 계산
                    match_count = sum(1 for keyword in search_keywords if keyword in doc_text)
                    match_ratio = match_count / len(search_keywords) if search_keywords else 0
                    
                    # 관련성 판단 기준:
                    # 1) 30% 이상의 키워드가 매칭되거나
                    # 2) 3글자 이상의 중요한 키워드가 포함된 경우
                    if match_ratio >= 0.3 or any(keyword in doc_text for keyword in search_keywords if len(keyword) >= 3):
                        relevant_docs.append(doc)
                        # 관련 문서의 이미지도 함께 포함
                        if doc.get('images'):
                            relevant_images.extend(doc['images'])
                        
                        print(f"관련 문서 발견: {doc['title']} (매칭률: {match_ratio:.2f})")
            else:
                print(f"인사말 또는 간단한 질문으로 판단하여 문서 검색을 건너뜁니다: {user_message}")
            
            # 디버깅용 로그 출력
            if not is_greeting and not is_simple:
                print(f"검색 키워드: {search_keywords}")
            print(f"관련 문서 수: {len(relevant_docs)}")
            
            # Mock AI 응답 생성
            if relevant_docs:
                # 관련 문서가 있는 경우: 문서 기반 응답
                doc_titles = [doc['title'] for doc in relevant_docs[:3]]
                if category_id and category_id in CATEGORY_RESPONSES:
                    category_response = random.choice(CATEGORY_RESPONSES[category_id])
                    response = f"{category_response}\n\n참고 문서: {', '.join(doc_titles)}\n\n사용자 질문 '{user_message}'에 대한 상세한 답변을 드리겠습니다. 문서 내용을 바탕으로 다음과 같이 설명할 수 있습니다."
                else:
                    response = f"업로드하신 문서 '{', '.join(doc_titles)}'를 분석한 결과, '{user_message}'에 대한 관련 정보를 찾았습니다. {random.choice(MOCK_RESPONSES)}"
            else:
                # 관련 문서가 없는 경우: 일반적인 응답
                print("관련 문서를 찾을 수 없습니다.")
                if is_greeting:
                    response = "안녕하세요! BEACON AI 어시스턴트입니다. 업로드하신 문서에 대해 궁금한 점이 있으시면 언제든 질문해주세요."
                elif '문서' in user_message:
                    response = f"현재 {len(documents)}개의 문서가 업로드되어 있습니다. 구체적인 질문을 해주시면 문서 내용을 바탕으로 답변해드리겠습니다."
                else:
                    response = random.choice(MOCK_RESPONSES)
        
    except Exception as e:
        logger.error(f"Mock AI 처리 오류: {e}")
        # 오류 발생 시 기본 응답
        search_documents = documents
        if category_id:
            search_documents = [doc for doc in documents if doc.get('category_id') == category_id]
        
        if len(search_documents) == 0:
            if category_id:
                category_name = next((cat['name'] for cat in categories if cat['id'] == category_id), '선택된 카테고리')
                response = f"현재 '{category_name}' 카테고리에 업로드된 문서가 없습니다. 해당 카테고리에 PDF 파일을 먼저 업로드한 후 질문해주세요."
            else:
                response = "현재 업로드된 문서가 없습니다. PDF 파일을 먼저 업로드한 후 문서에 대해 질문해주세요."
        elif '안녕' in user_message or 'hello' in user_message.lower():
            response = "안녕하세요! BEACON AI 어시스턴트입니다. 무엇을 도와드릴까요?"
        elif '문서' in user_message:
            response = f"현재 {len(documents)}개의 문서가 등록되어 있습니다. 어떤 문서에 대해 질문하시겠습니까?"
        else:
            response = random.choice(MOCK_RESPONSES)
    
    # 채팅 기록 저장
    chat_entry = {
        'timestamp': datetime.now().isoformat(),
        'user_message': user_message,
        'ai_response': response
    }
    chat_history.append(chat_entry)
    
    return jsonify({
        'response': response,
        'timestamp': chat_entry['timestamp'],
        'images': relevant_images[:5] if relevant_images else [],  # 최대 5개 이미지
        'referenced_docs': [{'id': doc['id'], 'title': doc.get('original_filename', doc['title']), 'has_file': bool(doc.get('file_path'))} for doc in relevant_docs[:3]] if relevant_docs else []  # 참조된 문서 정보
    })

@app.route('/api/upload', methods=['POST'])
def upload_file():
    global document_counter
    
    if 'file' not in request.files:
        return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
    
    # 카테고리 ID 가져오기 (기본값: 일반 카테고리)
    category_id = int(request.form.get('category_id', 4))  # 기본값: 일반 카테고리
    
    if file and allowed_file(file.filename):
        try:
            # 파일 데이터를 메모리에 저장
            file_data = file.read()
            
            # 안전한 파일명 생성
            filename = secure_filename(file.filename)
            document_counter += 1
            
            # 파일을 uploads 디렉토리에 저장
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"doc_{document_counter}_{filename}")
            
            with open(file_path, 'wb') as f:
                f.write(file_data)
            
            # PDF 텍스트 추출
            text_stream = io.BytesIO(file_data)
            text_content = extract_text_from_pdf(text_stream)
            
            if text_content:
                # 이미지 추출 (새로운 스트림 사용)
                image_stream = io.BytesIO(file_data)
                images = extract_images_from_pdf(image_stream, document_counter)
                
                # 문서 리스트에 추가 (카테고리 정보 포함)
                new_doc = {
                    'id': document_counter,
                    'title': filename,
                    'content': text_content,
                    'type': 'uploaded',
                    'images': images,
                    'file_path': file_path,
                    'original_filename': file.filename,
                    'category_id': category_id
                }
                documents.append(new_doc)
                
                # Process document with RAG system if available
                processing_result = None
                if RAG_ENABLED:
                    try:
                        # Get category settings
                        category_settings = next(
                            (cat.get('settings', {}) for cat in categories if cat['id'] == category_id),
                            {'chunk_strategy': 'sentence', 'chunk_size': 512, 'chunk_overlap': 50}
                        )
                        
                        logger.info(f"Processing document with RAG: {filename}")
                        processing_result = rag_engine.process_document(
                            document_id=str(document_counter),
                            title=filename,
                            content=text_content,
                            category_id=category_id,
                            category_settings=category_settings
                        )
                        
                        logger.info(f"Document processed successfully: {processing_result.chunks_created} chunks created")
                        
                    except Exception as e:
                        logger.error(f"Failed to process document with RAG: {e}")
                        # Continue without RAG processing
                
                response_data = {
                    'success': True,
                    'message': f'"{file.filename}" 파일이 성공적으로 업로드되었습니다.',
                    'document': {
                        'id': new_doc['id'],
                        'title': new_doc['title'],
                        'preview': text_content[:200] + '...' if len(text_content) > 200 else text_content
                    },
                    'rag_enabled': RAG_ENABLED
                }
                
                # Add RAG processing info if available
                if processing_result:
                    response_data['processing'] = {
                        'chunks_created': processing_result.chunks_created,
                        'embeddings_generated': processing_result.embeddings_generated,
                        'processing_time': round(processing_result.processing_time, 2),
                        'total_tokens': processing_result.total_tokens
                    }
                
                return jsonify(response_data)
            else:
                return jsonify({'error': 'PDF에서 텍스트를 추출할 수 없습니다.'}), 400
                
        except Exception as e:
            return jsonify({'error': f'파일 처리 중 오류가 발생했습니다: {str(e)}'}), 500
    
    return jsonify({'error': 'PDF 파일만 업로드 가능합니다.'}), 400

@app.route('/api/chat/history')
def get_chat_history():
    return jsonify(chat_history)

@app.route('/api/download/<int:doc_id>')
def download_file(doc_id):
    """
    업로드된 PDF 파일 다운로드 엔드포인트
    
    Args:
        doc_id (int): 다운로드할 문서의 ID
        
    Returns:
        파일 또는 에러 메시지
    """
    # 문서 ID로 해당 문서 검색
    doc = next((d for d in documents if d['id'] == doc_id), None)
    
    # 문서가 존재하지 않거나 파일 경로가 없는 경우
    if not doc or not doc.get('file_path'):
        return jsonify({'error': '파일을 찾을 수 없습니다.'}), 404
    
    # 실제 파일이 디스크에 존재하는지 확인
    if not os.path.exists(doc['file_path']):
        return jsonify({'error': '파일이 존재하지 않습니다.'}), 404
    
    # 파일 다운로드 응답 생성 (원본 파일명으로 다운로드)
    return send_file(
        doc['file_path'], 
        as_attachment=True, 
        download_name=doc.get('original_filename', doc['title'])
    )

@app.route('/api/documents/<int:doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    """
    문서 삭제 엔드포인트
    
    Args:
        doc_id (int): 삭제할 문서의 ID
        
    Returns:
        성공/실패 메시지
    """
    global documents, document_counter
    
    # 삭제할 문서 찾기
    doc_to_delete = next((d for d in documents if d['id'] == doc_id), None)
    
    if not doc_to_delete:
        return jsonify({'error': '문서를 찾을 수 없습니다.'}), 404
    
    try:
        # 파일 삭제 (존재하는 경우)
        if doc_to_delete.get('file_path') and os.path.exists(doc_to_delete['file_path']):
            os.remove(doc_to_delete['file_path'])
            print(f"파일 삭제됨: {doc_to_delete['file_path']}")
        
        # 이미지 디렉토리 삭제 (존재하는 경우)
        image_dir = os.path.join('static', 'images', f'doc_{doc_id}')
        if os.path.exists(image_dir):
            import shutil
            shutil.rmtree(image_dir)
            print(f"이미지 디렉토리 삭제됨: {image_dir}")
        
        # Remove from RAG system if enabled
        rag_deleted_count = 0
        if RAG_ENABLED:
            try:
                rag_deleted_count = rag_engine.delete_document(str(doc_id))
                logger.info(f"Deleted {rag_deleted_count} chunks from RAG system for document {doc_id}")
            except Exception as e:
                logger.error(f"Failed to delete document from RAG system: {e}")
        
        # 문서 목록에서 제거
        documents = [d for d in documents if d['id'] != doc_id]
        
        return jsonify({
            'success': True,
            'message': f'문서 "{doc_to_delete["title"]}"가 삭제되었습니다.',
            'rag_chunks_deleted': rag_deleted_count if RAG_ENABLED else None
        })
        
    except Exception as e:
        print(f"문서 삭제 오류: {e}")
        return jsonify({'error': f'문서 삭제 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/weather')
def get_weather():
    # 샘플 날씨 데이터
    return jsonify({
        'temperature': '3°C',
        'location': '안양시 동구',
        'condition': '흐림',
        'range': '5°C/-1°C'
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)