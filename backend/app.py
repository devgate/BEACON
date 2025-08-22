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

# Configure logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import our RAG components
from services.bedrock_service import BedrockService, create_bedrock_service
from storage.vector_store import VectorStore, create_vector_store
from services.rag_engine import RAGEngine, create_rag_engine

# Import new document processing components (with fallback)
try:
    from core.document_processor import DocumentProcessor
    from storage.chroma_service import ChromaService, DocumentChunker
    ENHANCED_PROCESSING_AVAILABLE = True
    logger.info("Enhanced document processing modules loaded successfully")
except ImportError as e:
    logger.warning(f"Enhanced document processing not available: {e}")
    DocumentProcessor = None
    ChromaService = None
    DocumentChunker = None
    ENHANCED_PROCESSING_AVAILABLE = False

app = Flask(__name__)
CORS(app, origins=['http://localhost:3000', 'http://localhost:8080'])
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB 최대 파일 크기
app.config['UPLOAD_FOLDER'] = 'uploads'

# Initialize RAG system and new components
try:
    logger.info("Initializing enhanced document processing system...")
    
    # Initialize Bedrock service
    bedrock_service = create_bedrock_service({
        'BEDROCK_REGION': os.getenv('BEDROCK_REGION', 'ap-northeast-2'),
        'AWS_PROFILE': os.getenv('AWS_PROFILE')
    })
    
    # Initialize vector store (legacy)
    vector_store = create_vector_store(
        table_name=os.getenv('DYNAMODB_VECTORS_TABLE', 'prod-beacon-vectors')
    )
    
    # Initialize RAG engine (legacy)
    rag_engine = create_rag_engine(bedrock_service, vector_store)
    
    # Initialize new components (if available)
    document_processor = None
    chroma_service = None
    
    if ENHANCED_PROCESSING_AVAILABLE:
        try:
            document_processor = DocumentProcessor()
            chroma_service = ChromaService(persist_directory=os.getenv('CHROMA_DATA_DIR', 'chroma_data'))
            logger.info("Enhanced document processing system initialized successfully")
            CHROMA_ENABLED = True
        except Exception as e:
            logger.warning(f"Failed to initialize enhanced processing: {e}")
            CHROMA_ENABLED = False
    else:
        logger.info("Enhanced processing not available, using legacy mode")
        CHROMA_ENABLED = False
    
    RAG_ENABLED = True
    
except Exception as e:
    logger.error(f"Failed to initialize document processing system: {e}")
    logger.info("Running in mock mode")
    RAG_ENABLED = False
    CHROMA_ENABLED = False
    bedrock_service = None
    vector_store = None
    rag_engine = None
    document_processor = None
    chroma_service = None

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

# 허용된 파일 확장자 (확장됨)
ALLOWED_EXTENSIONS = {'pdf', 'txt', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'json', 'md', 'rtf'}

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

def generate_embeddings(texts, batch_size=10):
    """
    Generate embeddings for a list of texts using Bedrock
    
    Args:
        texts: List of text strings
        batch_size: Number of texts to process in each batch
        
    Returns:
        List of embedding vectors
    """
    if not RAG_ENABLED or not bedrock_service:
        logger.warning("Bedrock service not available, returning mock embeddings")
        return [[0.0] * 1536 for _ in texts]  # Mock embeddings
    
    try:
        embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = []
            
            for text in batch:
                # Truncate text if too long
                if len(text) > 8000:
                    text = text[:8000]
                
                embedding = bedrock_service.generate_embedding(text)
                batch_embeddings.append(embedding)
            
            embeddings.extend(batch_embeddings)
            
            # Add small delay to avoid rate limiting
            if i + batch_size < len(texts):
                time.sleep(0.1)
        
        logger.info(f"Generated {len(embeddings)} embeddings")
        return embeddings
        
    except Exception as e:
        logger.error(f"Failed to generate embeddings: {e}")
        # Return mock embeddings as fallback
        return [[0.0] * 1536 for _ in texts]

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
    logger.info("📞 Chat API 호출됨 - 요청 데이터 처리 시작")
    data = request.get_json()
    user_message = data.get('message', '')
    selected_category_id = data.get('category_id', None)
    model_id = data.get('model_id', None)
    settings = data.get('settings', {})
    
    # Extract settings
    temperature = float(settings.get('temperature', 0.7))
    max_tokens = int(settings.get('max_tokens', 2048))
    use_rag = settings.get('use_rag', True)
    knowledge_base_id = settings.get('knowledge_base_id', None)
    top_k_documents = int(settings.get('top_k_documents', 5))
    
    try:
        logger.info("🔍 RAG_ENABLED 상태: %s", RAG_ENABLED)
        if RAG_ENABLED:
            # Check if ChromaDB RAG should be used (when knowledge_base_id is provided)
            logger.info("🔍 RAG 조건 체크: use_rag=%s, knowledge_base_id=%s, CHROMA_ENABLED=%s, chroma_service=%s", 
                       use_rag, knowledge_base_id, CHROMA_ENABLED, chroma_service is not None)
            use_chroma_rag = use_rag and knowledge_base_id and CHROMA_ENABLED and chroma_service
            logger.info("🎯 ChromaDB RAG 사용 여부: %s", use_chroma_rag)
            
            if use_chroma_rag:
                # Use ChromaDB RAG system
                logger.info("=== RAG 질문 처리 시작 ===")
                logger.info("1. ✅ 질문 입력: %s", user_message[:50] + "..." if len(user_message) > 50 else user_message)
                
                import time
                start_time = time.time()
                
                # Generate embedding for the user query
                logger.info("2. 🔄 질문 Bedrock 임베딩 생성 시작")
                query_embeddings = generate_embeddings([user_message])
                if not query_embeddings or len(query_embeddings) == 0:
                    raise Exception("Failed to generate query embedding")
                
                query_embedding = query_embeddings[0]
                logger.info("2. ✅ 질문 Bedrock 임베딩 생성 완료")
                
                # Search similar chunks in ChromaDB filtered by knowledge base
                logger.info("3. 🔄 ChromaDB 유사도 검색 시작 - 지식베이스: %s", knowledge_base_id)
                search_results = chroma_service.search_similar_chunks(
                    query_embedding=query_embedding,
                    n_results=top_k_documents,
                    document_filter=f"kb_{knowledge_base_id}_doc_"  # Filter by knowledge base
                )
                
                # Check if we found relevant documents
                if search_results['total_results'] > 0:
                    logger.info("3. ✅ ChromaDB 유사도 검색 완료 - %d개 관련 청크 발견", search_results['total_results'])
                    
                    # Build context from retrieved chunks
                    context_chunks = search_results['chunks']
                    metadatas = search_results['metadatas']
                    distances = search_results['distances']
                    
                    logger.info("4. 🔄 검색된 청크로 LLM 컨텍스트 구성 시작")
                    # Format context for LLM
                    context = "\n\n".join([
                        f"문서 '{meta.get('document_name', 'Unknown')}' - 관련도: {1-distance:.3f}\n{chunk}"
                        for chunk, meta, distance in zip(context_chunks, metadatas, distances)
                    ])
                    
                    # Set default model if not specified
                    if not model_id:
                        available_models = bedrock_service.get_available_models()
                        # Filter for text generation models
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
                    
                    # Create RAG system prompt
                    system_prompt = f"""당신은 BEACON AI입니다. 사용자의 질문에 대해 제공된 문서 내용을 바탕으로 정확하고 도움이 되는 답변을 제공해주세요.

문서 내용:
{context}

지침:
1. 제공된 문서 내용을 바탕으로 답변하세요
2. 문서에 없는 정보는 추측하지 말고 "문서에서 해당 정보를 찾을 수 없습니다"라고 말씀해주세요
3. 답변은 한국어로 제공해주세요
4. 가능한 구체적이고 상세한 답변을 제공해주세요
5. 관련된 문서 섹션이나 내용을 인용할 때는 해당 문서명을 언급해주세요"""
                    
                    logger.info("4. ✅ LLM 컨텍스트 구성 완료")
                    logger.info("5. 🔄 Bedrock LLM 응답 생성 시작 - 모델: %s", model_id)
                    
                    # Generate response using Bedrock with context
                    response_data = bedrock_service.invoke_model(
                        model_id=model_id,
                        prompt=user_message,
                        system_prompt=system_prompt,
                        max_tokens=max_tokens,
                        temperature=temperature
                    )
                    
                    logger.info("5. ✅ Bedrock LLM 응답 생성 완료")
                    
                    processing_time = time.time() - start_time
                    
                    # Format referenced docs
                    referenced_docs = []
                    for meta, distance in zip(metadatas, distances):
                        referenced_docs.append({
                            'id': meta.get('document_id', 'unknown'),
                            'title': meta.get('document_name', 'Unknown Document'),
                            'has_file': True,
                            'relevance_score': 1 - distance,
                            'chunk_index': meta.get('chunk_index', 0)
                        })
                    
                    # Save to chat history
                    chat_entry = {
                        'timestamp': datetime.now().isoformat(),
                        'user_message': user_message,
                        'ai_response': response_data['text'],
                        'model_used': model_id,
                        'knowledge_base_id': knowledge_base_id,
                        'tokens_used': response_data.get('usage', {}),
                        'cost_estimate': response_data.get('cost', {}),
                        'confidence_score': sum(1-d for d in distances) / len(distances) if distances else 0.0,
                        'processing_time': processing_time,
                        'sources_count': len(context_chunks)
                    }
                    chat_history.append(chat_entry)
                    logger.info("6. ✅ 사용자에게 답변 전송 완료")
                    
                    return jsonify({
                        'response': response_data['text'],
                        'model_used': model_id,
                        'timestamp': chat_entry['timestamp'],
                        'tokens_used': response_data.get('usage', {}),
                        'cost_estimate': response_data.get('cost', {}),
                        'confidence_score': chat_entry['confidence_score'],
                        'processing_time': processing_time,
                        'images': [],
                        'referenced_docs': referenced_docs[:3],
                        'rag_enabled': True
                    })
                else:
                    # No relevant documents found in ChromaDB, fall back to general response
                    logger.warning(f"No relevant documents found in ChromaDB for query: {user_message[:50]}...")
                    
                    # Fall back to general conversation with Bedrock
                    logger.info(f"Falling back to general conversation with Bedrock: {user_message[:50]}...")
                    
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
정확한 정보를 제공하고, 모르는 것은 솔직히 모른다고 말씀해주세요.

사용자가 문서나 자료에 대해 질문했지만, 업로드된 문서에서 관련 정보를 찾을 수 없었습니다. 
이 경우 찾을 수 없다는 것을 알려주고 일반적인 정보나 조언을 제공해주세요."""
                    
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
                        'knowledge_base_id': knowledge_base_id,
                        'tokens_used': response_data.get('usage', {}),
                        'cost_estimate': response_data.get('cost', {}),
                        'confidence_score': 0.5,  # Lower confidence since no docs found
                        'processing_time': processing_time,
                        'rag_enabled': True,
                        'sources_count': 0
                    }
                    chat_history.append(chat_entry)
                    logger.info("6. ✅ 사용자에게 답변 전송 완료 (문서 없음 - 일반 응답)")
                    
                    return jsonify({
                        'response': response_data['text'],
                        'model_used': model_id,
                        'timestamp': chat_entry['timestamp'],
                        'tokens_used': response_data.get('usage', {}),
                        'cost_estimate': response_data.get('cost', {}),
                        'confidence_score': chat_entry['confidence_score'],
                        'processing_time': processing_time,
                        'images': [],
                        'referenced_docs': [],
                        'rag_enabled': True,
                        'sources_found': False
                    })
            
            elif use_rag and documents:
                # Use legacy RAG system with uploaded documents
                logger.info(f"Processing legacy RAG query: {user_message[:50]}... with model: {model_id}")
                
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
                logger.info("6. ✅ 사용자에게 답변 전송 완료 (RAG 비활성화)")
                
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
            # Use Bedrock for general conversation without RAG (or ChromaDB had no results)
            if not use_chroma_rag and not (use_rag and documents):
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
                logger.info("6. ✅ 사용자에게 답변 전송 완료 (이미지 포함)")
                
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
            # RAG_ENABLED is False - fallback to mock responses
            logger.warning("❌ RAG_ENABLED가 False입니다 - Mock 응답 시스템 사용")
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
    logger.info("6. ✅ 사용자에게 답변 전송 완료 (기본 채팅)")
    
    return jsonify({
        'response': response,
        'timestamp': chat_entry['timestamp'],
        'images': relevant_images[:5] if relevant_images else [],  # 최대 5개 이미지
        'referenced_docs': [{'id': doc['id'], 'title': doc.get('original_filename', doc['title']), 'has_file': bool(doc.get('file_path'))} for doc in relevant_docs[:3]] if relevant_docs else []  # 참조된 문서 정보
    })

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Enhanced file upload with multiple format support and Chroma DB integration"""
    global document_counter
    
    if 'file' not in request.files:
        return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
    
    # Get parameters
    category_id = int(request.form.get('category_id', 4))
    chunk_strategy = request.form.get('chunk_strategy', 'sentence')
    chunk_size = int(request.form.get('chunk_size', 1000))
    chunk_overlap = int(request.form.get('chunk_overlap', 100))
    
    if file and allowed_file(file.filename):
        processing_start_time = time.time()
        
        try:
            # Save file
            filename = secure_filename(file.filename)
            document_counter += 1
            
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"doc_{document_counter}_{filename}")
            file.save(file_path)
            
            # Extract text using enhanced document processor
            text_content = ""
            extraction_metadata = {}
            images = []
            
            if document_processor:
                try:
                    text_content, extraction_metadata = document_processor.extract_text(file_path)
                    logger.info(f"Text extracted using enhanced processor: {len(text_content)} characters")
                except Exception as e:
                    logger.warning(f"Enhanced extraction failed, falling back to PDF-only: {e}")
                    # Fallback to original PDF extraction for PDFs
                    if file.filename.lower().endswith('.pdf'):
                        with open(file_path, 'rb') as f:
                            text_content = extract_text_from_pdf(f)
                        if text_content:
                            with open(file_path, 'rb') as f:
                                images = extract_images_from_pdf(f, document_counter)
            else:
                # Fallback to original method if processor not available
                if file.filename.lower().endswith('.pdf'):
                    with open(file_path, 'rb') as f:
                        text_content = extract_text_from_pdf(f)
                    if text_content:
                        with open(file_path, 'rb') as f:
                            images = extract_images_from_pdf(f, document_counter)
            
            if not text_content or not text_content.strip():
                return jsonify({'error': '파일에서 텍스트를 추출할 수 없습니다.'}), 400
            
            # Create document entry
            new_doc = {
                'id': document_counter,
                'title': filename,
                'content': text_content,
                'type': 'uploaded',
                'images': images,
                'file_path': file_path,
                'original_filename': file.filename,
                'category_id': category_id,
                'extraction_metadata': extraction_metadata,
                'uploaded_at': datetime.now().isoformat(),
                'file_size': os.path.getsize(file_path)
            }
            documents.append(new_doc)
            
            # Enhanced document processing with chunking and embeddings
            chroma_processing_result = None
            legacy_rag_result = None
            
            if CHROMA_ENABLED and chroma_service:
                try:
                    logger.info(f"Processing document with Chroma DB: {filename}")
                    
                    # Generate chunks using configurable strategy (with fallback)
                    if DocumentChunker:
                        if chunk_strategy == 'sentence':
                            chunks = DocumentChunker.chunk_by_sentences(
                                text_content, max_chunk_size=chunk_size, overlap=chunk_overlap
                            )
                        elif chunk_strategy == 'paragraph':
                            chunks = DocumentChunker.chunk_by_paragraphs(
                                text_content, max_chunk_size=chunk_size
                            )
                        elif chunk_strategy == 'token':
                            chunks = DocumentChunker.chunk_by_tokens(
                                text_content, max_tokens=chunk_size//4, overlap_tokens=chunk_overlap//4
                            )
                        else:
                            chunks = DocumentChunker.chunk_by_sentences(text_content, chunk_size, chunk_overlap)
                    else:
                        # Simple fallback chunking
                        words = text_content.split()
                        chunks = []
                        current_chunk = ""
                        for word in words:
                            if len(current_chunk) + len(word) < chunk_size:
                                current_chunk += word + " "
                            else:
                                if current_chunk:
                                    chunks.append(current_chunk.strip())
                                current_chunk = word + " "
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                    
                    # Generate embeddings
                    embeddings = generate_embeddings(chunks)
                    
                    # Store in Chroma DB
                    document_id = f"doc_{document_counter}"
                    success = chroma_service.add_document_chunks(
                        chunks=chunks,
                        embeddings=embeddings,
                        document_id=document_id,
                        document_name=filename,
                        metadata={
                            'category_id': category_id,
                            'chunk_strategy': chunk_strategy,
                            'chunk_size': chunk_size,
                            'file_extension': extraction_metadata.get('file_extension', ''),
                            'original_filename': file.filename
                        }
                    )
                    
                    chroma_processing_result = {
                        'success': success,
                        'chunks_created': len(chunks),
                        'embeddings_generated': len(embeddings),
                        'chunk_strategy': chunk_strategy,
                        'average_chunk_size': sum(len(chunk) for chunk in chunks) // len(chunks) if chunks else 0
                    }
                    
                    new_doc['chunk_count'] = len(chunks)
                    
                    logger.info(f"Chroma DB processing completed: {len(chunks)} chunks created")
                    
                except Exception as e:
                    logger.error(f"Failed to process document with Chroma DB: {e}")
                    chroma_processing_result = {'success': False, 'error': str(e)}
            
            # Legacy RAG processing (keep for compatibility)
            if RAG_ENABLED and rag_engine:
                try:
                    category_settings = next(
                        (cat.get('settings', {}) for cat in categories if cat['id'] == category_id),
                        {'chunk_strategy': chunk_strategy, 'chunk_size': chunk_size, 'chunk_overlap': chunk_overlap}
                    )
                    
                    legacy_rag_result = rag_engine.process_document(
                        document_id=str(document_counter),
                        title=filename,
                        content=text_content,
                        category_id=category_id,
                        category_settings=category_settings
                    )
                    
                    logger.info(f"Legacy RAG processing completed")
                    
                except Exception as e:
                    logger.error(f"Failed to process document with legacy RAG: {e}")
            
            # Prepare response
            processing_time = time.time() - processing_start_time
            
            response_data = {
                'success': True,
                'message': f'"{file.filename}" 파일이 성공적으로 업로드되었습니다.',
                'document': {
                    'id': new_doc['id'],
                    'title': new_doc['title'],
                    'preview': text_content[:200] + '...' if len(text_content) > 200 else text_content,
                    'file_size': new_doc['file_size'],
                    'file_extension': extraction_metadata.get('file_extension', ''),
                    'extraction_method': extraction_metadata.get('extraction_method', 'unknown')
                },
                'processing_time': round(processing_time, 2),
                'chroma_enabled': CHROMA_ENABLED,
                'rag_enabled': RAG_ENABLED
            }
            
            # Add processing results
            if chroma_processing_result:
                response_data['chroma_processing'] = chroma_processing_result
            
            if legacy_rag_result:
                response_data['legacy_rag_processing'] = {
                    'chunks_created': legacy_rag_result.chunks_created,
                    'embeddings_generated': legacy_rag_result.embeddings_generated,
                    'processing_time': round(legacy_rag_result.processing_time, 2),
                    'total_tokens': legacy_rag_result.total_tokens
                }
            
            # Add extraction metadata
            if extraction_metadata:
                response_data['extraction_metadata'] = extraction_metadata
            
            return jsonify(response_data)
            
        except Exception as e:
            logger.error(f"Upload processing failed: {e}")
            return jsonify({'error': f'파일 처리 중 오류가 발생했습니다: {str(e)}'}), 500
    
    return jsonify({'error': f'지원되지 않는 파일 형식입니다. 지원 형식: {", ".join(ALLOWED_EXTENSIONS)}'}), 400

@app.route('/api/chat/history')
def get_chat_history():
    return jsonify(chat_history)

@app.route('/api/download/<doc_id>')
def download_file(doc_id):
    """
    업로드된 파일 다운로드 엔드포인트
    
    Args:
        doc_id (str): 다운로드할 문서의 ID (문자열)
        
    Returns:
        파일 또는 에러 메시지
    """
    logger.info(f"Download request for doc_id: {doc_id}")
    
    # ChromaDB에서 문서 정보 가져오기
    try:
        doc_info = chroma_service.get_document_info(doc_id)
        if not doc_info.get('exists'):
            logger.warning(f"Document not found in ChromaDB: {doc_id}")
            return jsonify({'error': '문서를 찾을 수 없습니다.'}), 404
        
        # 원본 파일 경로 구성 (업로드 시 저장된 경로)
        uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
        file_path = os.path.join(uploads_dir, f"{doc_id}.txt")
        
        # 파일이 존재하는지 확인
        if os.path.exists(file_path):
            logger.info(f"Serving file: {file_path}")
            return send_file(
                file_path,
                as_attachment=True,
                download_name=f"{doc_id}.txt"
            )
        else:
            logger.error(f"File not found on disk: {file_path}")
            return jsonify({'error': '파일이 디스크에 존재하지 않습니다.'}), 404
            
    except Exception as e:
        logger.error(f"Error in download_file: {e}")
        return jsonify({'error': f'다운로드 오류: {str(e)}'}), 500
    
    # 기존 documents 배열에서도 검색 (fallback)
    doc = next((d for d in documents if str(d.get('id')) == str(doc_id)), None)
    
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
        logger.info(f"Attempting to delete document {doc_id}: {doc_to_delete.get('title', 'Unknown')}")
        logger.info(f"File path in document: {doc_to_delete.get('file_path', 'No file path')}")
        
        if doc_to_delete.get('file_path'):
            file_path = doc_to_delete['file_path']
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"✅ 파일 삭제 성공: {file_path}")
            else:
                logger.warning(f"⚠️ 파일이 존재하지 않음: {file_path}")
        
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
                logger.info(f"Deleted {rag_deleted_count} chunks from legacy RAG system for document {doc_id}")
            except Exception as e:
                logger.error(f"Failed to delete document from legacy RAG system: {e}")
        
        # Remove from ChromaDB if enabled
        chroma_deleted = False
        if CHROMA_ENABLED and chroma_service:
            try:
                # Try different ID formats that might have been used
                possible_ids = [
                    str(doc_id),  # Simple ID
                    f"doc_{doc_id}",  # General upload format
                ]
                
                # If document has index_id, also try knowledge base format
                if doc_to_delete.get('index_id'):
                    possible_ids.append(f"kb_{doc_to_delete['index_id']}_doc_{doc_id}")
                
                for chroma_id in possible_ids:
                    try:
                        deleted = chroma_service.delete_document(chroma_id)
                        if deleted:
                            logger.info(f"✅ Deleted document from ChromaDB with ID: {chroma_id}")
                            chroma_deleted = True
                            break
                    except Exception as e:
                        logger.debug(f"Failed to delete with ID {chroma_id}: {e}")
                
                if not chroma_deleted:
                    logger.warning(f"⚠️ Document {doc_id} not found in ChromaDB with any tried ID format")
            except Exception as e:
                logger.error(f"Failed to delete document from ChromaDB: {e}")
        
        # 문서 목록에서 제거 (global 변수를 직접 수정)
        documents[:] = [d for d in documents if d['id'] != doc_id]
        
        return jsonify({
            'success': True,
            'message': f'문서 "{doc_to_delete["title"]}"가 삭제되었습니다.',
            'rag_chunks_deleted': rag_deleted_count if RAG_ENABLED else None
        })
        
    except Exception as e:
        print(f"문서 삭제 오류: {e}")
        return jsonify({'error': f'문서 삭제 중 오류가 발생했습니다: {str(e)}'}), 500

# Store knowledge bases in memory (in production, use a database)
# Initialize with default knowledge bases
knowledge_bases_storage = [
]

# Knowledge Base Management APIs
@app.route('/api/knowledge')
def get_knowledge_bases():
    """Get list of knowledge bases"""
    try:
        # Add document count for each knowledge base
        knowledge_bases_with_counts = []
        for kb in knowledge_bases_storage:
            kb_copy = kb.copy()
            kb_copy['document_count'] = len([d for d in documents if d.get('index_id') == kb['id']])
            knowledge_bases_with_counts.append(kb_copy)
        
        return jsonify({
            'success': True,
            'knowledge_bases': knowledge_bases_with_counts
        })
        
    except Exception as e:
        logger.error(f"Failed to get knowledge bases: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/knowledge', methods=['POST'])
def create_knowledge_base():
    """Create a new knowledge base"""
    try:
        data = request.json
        name = data.get('name')
        kb_id = data.get('id')
        description = data.get('description', '')
        
        if not name or not kb_id:
            return jsonify({'error': 'Name and ID are required'}), 400
        
        # Check if ID already exists
        if any(kb['id'] == kb_id for kb in knowledge_bases_storage):
            return jsonify({'error': 'Knowledge base ID already exists'}), 400
        
        new_kb = {
            'id': kb_id,
            'name': name,
            'description': description,
            'status': 'active',
            'created_at': datetime.now().isoformat()
        }
        
        knowledge_bases_storage.append(new_kb)
        
        return jsonify({
            'success': True,
            'knowledge_base': new_kb
        })
        
    except Exception as e:
        logger.error(f"Failed to create knowledge base: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/knowledge/<index_id>', methods=['PUT'])
def update_knowledge_base(index_id):
    """Update an existing knowledge base"""
    try:
        data = request.json
        
        # Find the knowledge base
        kb_index = next((i for i, kb in enumerate(knowledge_bases_storage) if kb['id'] == index_id), None)
        
        if kb_index is None:
            return jsonify({'error': 'Knowledge base not found'}), 404
        
        # Update fields
        if 'name' in data:
            knowledge_bases_storage[kb_index]['name'] = data['name']
        if 'description' in data:
            knowledge_bases_storage[kb_index]['description'] = data['description']
        if 'status' in data:
            knowledge_bases_storage[kb_index]['status'] = data['status']
        
        knowledge_bases_storage[kb_index]['updated_at'] = datetime.now().isoformat()
        
        return jsonify({
            'success': True,
            'knowledge_base': knowledge_bases_storage[kb_index]
        })
        
    except Exception as e:
        logger.error(f"Failed to update knowledge base: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/knowledge/<index_id>', methods=['DELETE'])
def delete_knowledge_base(index_id):
    """Delete a knowledge base"""
    try:
        # Check if there are documents in this knowledge base
        kb_documents = [d for d in documents if d.get('index_id') == index_id]
        if kb_documents:
            return jsonify({'error': 'Cannot delete knowledge base with documents'}), 400
        
        # Find and remove the knowledge base
        kb_index = next((i for i, kb in enumerate(knowledge_bases_storage) if kb['id'] == index_id), None)
        
        if kb_index is None:
            return jsonify({'error': 'Knowledge base not found'}), 404
        
        deleted_kb = knowledge_bases_storage.pop(kb_index)
        
        return jsonify({
            'success': True,
            'deleted': deleted_kb
        })
        
    except Exception as e:
        logger.error(f"Failed to delete knowledge base: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/knowledge/<index_id>/documents')
def get_knowledge_base_documents(index_id):
    """Get documents for a specific knowledge base"""
    try:
        # Filter documents by index_id
        kb_documents = [d for d in documents if d.get('index_id') == index_id]
        
        # Format documents for frontend
        formatted_docs = []
        for doc in kb_documents:
            formatted_docs.append({
                'id': doc['id'],
                'file_name': doc['title'],
                'file_size': doc.get('file_size', 0),
                'uploaded_at': doc.get('uploaded_at', datetime.now().isoformat()),
                'status': doc.get('status', 'Success'),
                'chunk_count': doc.get('chunk_count', 1),
                'index_id': index_id
            })
        
        return jsonify({
            'success': True,
            'documents': formatted_docs,
            'total': len(formatted_docs)
        })
        
    except Exception as e:
        logger.error(f"Failed to get documents for knowledge base {index_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/knowledge/upload', methods=['POST'])
def upload_to_knowledge_base():
    """Upload file to specific knowledge base"""
    if 'file' not in request.files:
        return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
    
    file = request.files['file']
    index_id = request.form.get('index_id')
    
    if file.filename == '':
        return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
        
    if not index_id:
        return jsonify({'error': 'Knowledge base ID가 필요합니다.'}), 400
    
    try:
        # Secure filename
        filename = secure_filename(file.filename)
        
        # Create unique filename
        timestamp = str(int(time.time()))
        unique_filename = f"{timestamp}_{filename}"
        
        # Ensure upload directory exists
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        
        # Save file
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Process file content
        content = ""
        try:
            if filename.lower().endswith('.pdf'):
                # PDF processing
                with open(file_path, 'rb') as pdf_file:
                    pdf_reader = PyPDF2.PdfReader(pdf_file)
                    for page in pdf_reader.pages:
                        content += page.extract_text() + "\n"
            elif filename.lower().endswith(('.txt', '.md')):
                # Text file processing
                with open(file_path, 'r', encoding='utf-8') as txt_file:
                    content = txt_file.read()
            else:
                content = f"File: {filename} (Content not extracted)"
                
        except Exception as e:
            logger.warning(f"Could not extract content from {filename}: {e}")
            content = f"File: {filename} (Content extraction failed)"
        
        # Create document record
        new_doc = {
            'id': len(documents) + 1,
            'title': filename,
            'content': content[:1000] + ('...' if len(content) > 1000 else ''),
            'file_path': file_path,
            'file_size': file_size,
            'uploaded_at': datetime.now().isoformat(),
            'category_id': None,
            'index_id': index_id,
            'status': 'Success',
            'chunk_count': max(1, len(content) // 1000)  # Estimate chunks
        }
        
        documents.append(new_doc)
        
        # Add to ChromaDB if enabled, otherwise fallback to legacy RAG
        chunks_added = 0
        if CHROMA_ENABLED and chroma_service and content.strip():
            try:
                logger.info("=== RAG 준비단계 시작 ===")
                logger.info("1. ✅ 파일 업로드 완료")
                logger.info("2. ✅ 텍스트 추출 완료 - %d 문자 추출", len(content))
                
                # Get processing parameters
                chunk_strategy = request.form.get('chunking_strategy', 'sentence')
                chunk_size = int(request.form.get('chunk_size', 1000))
                chunk_overlap = int(request.form.get('chunk_overlap', 100))
                
                logger.info("3. 🔄 청크 분할 시작 - 전략: %s, 크기: %d", chunk_strategy, chunk_size)
                
                # Generate chunks using DocumentChunker
                if DocumentChunker:
                    if chunk_strategy == 'sentence':
                        chunks = DocumentChunker.chunk_by_sentences(
                            content, max_chunk_size=chunk_size, overlap=chunk_overlap
                        )
                    elif chunk_strategy == 'paragraph':
                        chunks = DocumentChunker.chunk_by_paragraphs(
                            content, max_chunk_size=chunk_size
                        )
                    elif chunk_strategy == 'token':
                        chunks = DocumentChunker.chunk_by_tokens(
                            content, max_tokens=chunk_size//4, overlap_tokens=chunk_overlap//4
                        )
                    else:
                        chunks = DocumentChunker.chunk_by_sentences(content, chunk_size, chunk_overlap)
                else:
                    # Simple fallback chunking
                    words = content.split()
                    chunks = []
                    current_chunk = ""
                    for word in words:
                        if len(current_chunk) + len(word) < chunk_size:
                            current_chunk += word + " "
                        else:
                            if current_chunk:
                                chunks.append(current_chunk.strip())
                            current_chunk = word + " "
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                
                logger.info("3. ✅ 청크 분할 완료 - %d개 청크 생성", len(chunks))
                
                # Generate embeddings
                logger.info("4. 🔄 Bedrock 임베딩 생성 시작 - %d개 청크", len(chunks))
                embeddings = generate_embeddings(chunks)
                logger.info("4. ✅ Bedrock 임베딩 생성 완료")
                
                # Store in Chroma DB
                logger.info("5. 🔄 ChromaDB 저장 시작")
                document_id = f"kb_{index_id}_doc_{new_doc['id']}"
                success = chroma_service.add_document_chunks(
                    chunks=chunks,
                    embeddings=embeddings,
                    document_id=document_id,
                    document_name=filename,
                    metadata={
                        'index_id': index_id,
                        'chunk_strategy': chunk_strategy,
                        'chunk_size': chunk_size,
                        'original_filename': filename,
                        'file_path': file_path,
                        'uploaded_at': new_doc['uploaded_at']
                    }
                )
                
                if success:
                    chunks_added = len(chunks)
                    new_doc['chunk_count'] = len(chunks)
                    logger.info("5. ✅ ChromaDB 저장 완료 - %d개 청크 저장", chunks_added)
                    logger.info("=== RAG 준비단계 완료 ===")
                else:
                    logger.error("5. ❌ ChromaDB 저장 실패")
                    logger.error("=== RAG 준비단계 실패 ===")
                    
            except Exception as e:
                logger.error(f"Failed to add document to ChromaDB: {e}")
                # Fallback to legacy RAG system
                try:
                    chunks_added = rag_engine.add_document(
                        doc_id=str(new_doc['id']),
                        content=content,
                        metadata={
                            'title': filename,
                            'file_path': file_path,
                            'index_id': index_id,
                            'category_id': new_doc.get('category_id'),
                            'uploaded_at': new_doc['uploaded_at']
                        }
                    )
                    logger.info(f"Fallback: Added {chunks_added} chunks to legacy RAG system")
                except Exception as e2:
                    logger.error(f"Both ChromaDB and legacy RAG failed: {e2}")
                    
        elif RAG_ENABLED and content.strip():
            # Use legacy RAG system only
            try:
                chunks_added = rag_engine.add_document(
                    doc_id=str(new_doc['id']),
                    content=content,
                    metadata={
                        'title': filename,
                        'file_path': file_path,
                        'index_id': index_id,
                        'category_id': new_doc.get('category_id'),
                        'uploaded_at': new_doc['uploaded_at']
                    }
                )
                logger.info(f"Added {chunks_added} chunks to legacy RAG system for document {new_doc['id']}")
            except Exception as e:
                logger.error(f"Failed to add document to legacy RAG system: {e}")
        
        logger.info(f"파일 업로드 완료: {filename} (ID: {new_doc['id']}, Index: {index_id})")
        
        return jsonify({
            'success': True,
            'message': f'파일 "{filename}"이 성공적으로 업로드되었습니다.',
            'document_id': new_doc['id'],
            'chunks_added': chunks_added,
            'document': {
                'id': new_doc['id'],
                'file_name': new_doc['title'],
                'file_size': new_doc['file_size'],
                'uploaded_at': new_doc['uploaded_at'],
                'status': new_doc['status'],
                'chunk_count': new_doc['chunk_count'],
                'index_id': index_id
            }
        })
        
    except Exception as e:
        logger.error(f"파일 업로드 오류: {e}")
        return jsonify({'error': f'파일 업로드 중 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/documents/bulk', methods=['DELETE'])
def delete_multiple_documents():
    """Delete multiple documents"""
    global documents
    
    data = request.get_json()
    document_ids = data.get('document_ids', [])
    
    if not document_ids:
        return jsonify({'error': 'Document IDs are required'}), 400
    
    try:
        deleted_count = 0
        deleted_docs = []
        
        for doc_id in document_ids:
            # Find document
            doc_to_delete = next((d for d in documents if d['id'] == doc_id), None)
            if not doc_to_delete:
                continue
                
            deleted_docs.append(doc_to_delete['title'])
            
            # Delete file if exists
            try:
                if 'file_path' in doc_to_delete and os.path.exists(doc_to_delete['file_path']):
                    os.remove(doc_to_delete['file_path'])
            except Exception as e:
                logger.warning(f"Failed to delete file for document {doc_id}: {e}")
            
            # Delete from legacy RAG system
            if RAG_ENABLED:
                try:
                    rag_engine.delete_document(str(doc_id))
                    logger.info(f"Deleted document {doc_id} from legacy RAG system")
                except Exception as e:
                    logger.error(f"Failed to delete document {doc_id} from legacy RAG system: {e}")
            
            # Delete from ChromaDB
            if CHROMA_ENABLED and chroma_service:
                try:
                    # Try different ID formats
                    possible_ids = [
                        str(doc_id),
                        f"doc_{doc_id}"
                    ]
                    if doc_to_delete.get('index_id'):
                        possible_ids.append(f"kb_{doc_to_delete['index_id']}_doc_{doc_id}")
                    
                    for chroma_id in possible_ids:
                        try:
                            if chroma_service.delete_document(chroma_id):
                                logger.info(f"Deleted document {doc_id} from ChromaDB with ID: {chroma_id}")
                                break
                        except:
                            pass
                except Exception as e:
                    logger.error(f"Failed to delete document {doc_id} from ChromaDB: {e}")
            
            deleted_count += 1
        
        # Remove documents from list (global 변수를 직접 수정)
        documents[:] = [d for d in documents if d['id'] not in document_ids]
        
        return jsonify({
            'success': True,
            'message': f'{deleted_count} documents deleted successfully',
            'deleted_documents': deleted_docs,
            'deleted_count': deleted_count
        })
        
    except Exception as e:
        logger.error(f"Bulk delete error: {e}")
        return jsonify({'error': f'Failed to delete documents: {str(e)}'}), 500

@app.route('/api/documents/<int:doc_id>/reprocess', methods=['POST'])
def reprocess_document(doc_id):
    """Reprocess a document with new settings"""
    try:
        # Find document
        doc = next((d for d in documents if d['id'] == doc_id), None)
        if not doc:
            return jsonify({'error': 'Document not found'}), 404
        
        # Get processing options
        data = request.get_json() or {}
        
        # Update document status
        doc['status'] = 'Processing'
        
        # In a real implementation, you would:
        # 1. Re-extract content with new settings
        # 2. Re-chunk the document
        # 3. Update embeddings
        # 4. Update vector store
        
        # For now, simulate processing
        import time
        time.sleep(1)  # Simulate processing time
        
        # Update status
        doc['status'] = 'Success'
        doc['processed_at'] = datetime.now().isoformat()
        
        logger.info(f"Document {doc_id} reprocessed successfully")
        
        return jsonify({
            'success': True,
            'message': f'Document "{doc["title"]}" queued for reprocessing',
            'document_id': doc_id
        })
        
    except Exception as e:
        logger.error(f"Document reprocessing error: {e}")
        return jsonify({'error': f'Failed to reprocess document: {str(e)}'}), 500

# Enhanced Chroma DB API endpoints
@app.route('/api/chroma/search', methods=['POST'])
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

@app.route('/api/chroma/stats')
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

@app.route('/api/chroma/document/<document_id>')
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

@app.route('/api/chroma/document/<document_id>', methods=['DELETE'])
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

@app.route('/api/document/formats')
def get_supported_formats():
    """Get list of supported document formats"""
    formats = list(ALLOWED_EXTENSIONS)
    
    format_info = {}
    if document_processor:
        for fmt in formats:
            format_info[fmt] = {
                'supported': True,
                'description': f'{fmt.upper()} document format'
            }
    
    return jsonify({
        'success': True,
        'supported_formats': formats,
        'format_info': format_info,
        'chroma_enabled': CHROMA_ENABLED,
        'rag_enabled': RAG_ENABLED
    })

@app.route('/api/weather')
def get_weather():
    # 샘플 날씨 데이터
    return jsonify({
        'temperature': '3°C',
        'location': '안양시 동구',
        'condition': '흐림',
        'range': '5°C/-1°C'
    })

@app.route('/api/chroma/clear', methods=['POST'])
def clear_chroma():
    """Clear all documents from ChromaDB collection"""
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

@app.route('/api/chroma/reset', methods=['POST'])
def reset_chroma():
    """Reset ChromaDB collection by deleting and recreating it"""
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

@app.route('/api/chroma/stats', methods=['GET'])
def get_chroma_stats():
    """Get ChromaDB collection statistics"""
    try:
        stats = chroma_service.get_collection_stats()
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        logger.error(f"Error getting ChromaDB stats: {e}")
        return jsonify({
            'success': False,
            'message': f'Error getting ChromaDB stats: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)