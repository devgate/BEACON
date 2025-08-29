"""
Chat API module for BEACON
Handles all chat-related endpoints and AI interactions
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
import random
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

# Create Blueprint
chat_bp = Blueprint('chat', __name__)

# Mock AI responses (for fallback)
MOCK_RESPONSES = [
    "안녕하세요! BEACON AI 어시스턴트입니다. 업로드하신 문서에 대해 질문해주시면 도움을 드리겠습니다.",
    "문서 내용을 분석한 결과, 관련 정보를 찾았습니다. 구체적으로 어떤 부분에 대해 더 자세히 알고 싶으신가요?",
    "업로드된 문서를 검토해보니 흥미로운 내용이 많네요. 특정 섹션에 대해 질문해주시면 더 정확한 답변을 드릴 수 있습니다.",
    "문서 분석이 완료되었습니다. 요약하자면, 핵심 내용은 다음과 같습니다. 추가로 궁금한 점이 있으시면 언제든 질문해주세요.",
    "해당 문서에서 관련 정보를 찾아보겠습니다. 잠시만 기다려주세요... 네, 찾았습니다! 상세한 설명을 드리겠습니다."
]

# Storage for chat history
chat_history = []

def init_chat_module(app_context):
    """Initialize chat module with app context"""
    global bedrock_service, vector_store, rag_engine, chroma_service
    global documents, generate_embeddings
    global RAG_ENABLED, CHROMA_ENABLED
    
    bedrock_service = app_context['bedrock_service']
    vector_store = app_context['vector_store']
    rag_engine = app_context['rag_engine']
    chroma_service = app_context.get('chroma_service')
    documents = app_context['documents']
    generate_embeddings = app_context['generate_embeddings']
    RAG_ENABLED = app_context['RAG_ENABLED']
    CHROMA_ENABLED = app_context['CHROMA_ENABLED']

@chat_bp.route('/api/chat', methods=['POST'])
def chat():
    """
    Enhanced chat API endpoint with Bedrock RAG integration
    Supports model selection, cost tracking, and real AI responses
    """
    logger.info("📞 Chat API 호출됨 - 요청 데이터 처리 시작")
    data = request.get_json()
    user_message = data.get('message', '')
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
            # Check if ChromaDB RAG should be used
            logger.info("🔍 RAG 조건 체크: use_rag=%s, knowledge_base_id=%s, CHROMA_ENABLED=%s, chroma_service=%s", 
                       use_rag, knowledge_base_id, CHROMA_ENABLED, chroma_service is not None)
            use_chroma_rag = use_rag and knowledge_base_id and CHROMA_ENABLED and chroma_service
            logger.info("🎯 ChromaDB RAG 사용 여부: %s", use_chroma_rag)
            
            if use_chroma_rag:
                return _handle_chroma_rag(
                    user_message, model_id, temperature, max_tokens,
                    knowledge_base_id, top_k_documents
                )
            elif use_rag and documents:
                return _handle_legacy_rag(
                    user_message, model_id,
                    top_k_documents, temperature, max_tokens
                )
            else:
                return _handle_general_conversation(
                    user_message, model_id, temperature, max_tokens
                )
        else:
            # RAG_ENABLED is False - fallback to mock responses
            logger.warning("❌ RAG_ENABLED가 False입니다 - Mock 응답 시스템 사용")
            return _generate_mock_response(user_message)
            
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        return _generate_mock_response(user_message, error=str(e))

def _handle_chroma_rag(user_message, model_id, temperature, max_tokens,
                      knowledge_base_id, top_k_documents):
    """Handle ChromaDB RAG system"""
    logger.info("=== RAG 질문 처리 시작 ===")
    logger.info("1. ✅ 질문 입력: %s", user_message[:50] + "..." if len(user_message) > 50 else user_message)
    
    start_time = time.time()
    
    # Generate embedding for the user query
    logger.info("2. 🔄 질문 Bedrock 임베딩 생성 시작")
    query_embeddings = generate_embeddings([user_message])
    if not query_embeddings or len(query_embeddings) == 0:
        raise Exception("Failed to generate query embedding")
    
    query_embedding = query_embeddings[0]
    logger.info("2. ✅ 질문 Bedrock 임베딩 생성 완료")
    
    # Search similar chunks in ChromaDB
    logger.info("3. 🔄 ChromaDB 유사도 검색 시작 - 지식베이스: %s", knowledge_base_id)
    search_results = chroma_service.search_similar_chunks(
        query_embedding=query_embedding,
        n_results=top_k_documents,
        document_filter=f"kb_{knowledge_base_id}_doc_"
    )
    
    if search_results['total_results'] > 0:
        logger.info("3. ✅ ChromaDB 유사도 검색 완료 - %d개 관련 청크 발견", search_results['total_results'])
        
        # Build context from retrieved chunks
        context_chunks = search_results['chunks']
        metadatas = search_results['metadatas']
        distances = search_results['distances']
        
        logger.info("4. 🔄 검색된 청크로 LLM 컨텍스트 구성 시작")
        context = "\n\n".join([
            f"문서 '{meta.get('document_name', 'Unknown')}' - 관련도: {1-distance:.3f}\n{chunk}"
            for chunk, meta, distance in zip(context_chunks, metadatas, distances)
        ])
        
        # Set default model if not specified
        if not model_id:
            model_id = _get_default_text_model()
        
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
        
        # Generate response using Bedrock
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
        # No relevant documents found
        logger.warning(f"No relevant documents found in ChromaDB for query: {user_message[:50]}...")
        return _handle_no_documents_found(
            user_message, model_id, temperature, max_tokens,
            knowledge_base_id
        )

def _handle_legacy_rag(user_message, model_id,
                       top_k_documents, temperature, max_tokens):
    """Handle legacy RAG system"""
    logger.info(f"Processing legacy RAG query: {user_message[:50]}... with model: {model_id}")
    
    response_data = rag_engine.query(
        query_text=user_message,
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
        doc_info = next((doc for doc in documents if str(doc['id']) == source.document_id), None)
        
        referenced_docs.append({
            'id': source.document_id,
            'title': source.metadata.get('title', 'Unknown Document'),
            'has_file': bool(doc_info and doc_info.get('file_path')),
            'relevance_score': source.similarity_score,
            'chunk_index': source.chunk_index
        })
        
        if doc_info and doc_info.get('images'):
            images.extend(doc_info['images'][:2])
    
    # Save to chat history
    chat_entry = {
        'timestamp': datetime.now().isoformat(),
        'user_message': user_message,
        'ai_response': response_data.response,
        'model_used': response_data.model_used,
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
        'images': images[:5],
        'referenced_docs': referenced_docs[:3],
        'rag_enabled': True
    })

def _handle_general_conversation(user_message, model_id, temperature, max_tokens):
    """Handle general conversation without RAG"""
    logger.info(f"Processing general conversation with Bedrock: {user_message[:50]}... with model: {model_id}")
    
    start_time = time.time()
    
    # Set default model if not specified
    if not model_id:
        model_id = _get_default_text_model()
    
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
        'tokens_used': response_data.get('usage', {}),
        'cost_estimate': response_data.get('cost', {}),
        'confidence_score': 1.0,
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

def _handle_no_documents_found(user_message, model_id, temperature, max_tokens,
                              knowledge_base_id):
    """Handle case when no relevant documents are found"""
    logger.info(f"Falling back to general conversation with Bedrock: {user_message[:50]}...")
    
    start_time = time.time()
    
    # Set default model if not specified
    if not model_id:
        model_id = _get_default_text_model()
    
    # Create a system prompt for no documents found
    system_prompt = """당신은 BEACON AI입니다. 사용자와 자연스럽고 도움이 되는 대화를 나누세요. 
한국어로 응답하되, 사용자가 다른 언어를 사용하면 해당 언어로 응답해주세요.
정확한 정보를 제공하고, 모르는 것은 솔직히 모른다고 말씀해주세요.

사용자가 문서나 자료에 대해 질문했지만, 업로드된 문서에서 관련 정보를 찾을 수 없었습니다. 
이 경우 찾을 수 없다는 것을 알려주고 일반적인 정보나 조언을 제공해주세요."""
    
    # Invoke Bedrock model
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
        'knowledge_base_id': knowledge_base_id,
        'tokens_used': response_data.get('usage', {}),
        'cost_estimate': response_data.get('cost', {}),
        'confidence_score': 0.5,
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

def _get_default_text_model():
    """Get default text generation model"""
    available_models = bedrock_service.get_available_models()
    text_models = [
        model for model in available_models 
        if 'TEXT' in model.output_modalities and 'EMBEDDING' not in model.output_modalities
    ]
    if text_models:
        claude_models = [m for m in text_models if 'claude' in m.model_id.lower()]
        nova_models = [m for m in text_models if 'nova' in m.model_id.lower()]
        
        if claude_models:
            return claude_models[0].model_id
        elif nova_models:
            return nova_models[0].model_id
        else:
            return text_models[0].model_id
    else:
        raise Exception("No text generation models available")

def _generate_mock_response(user_message: str, error: str = None):
    """Generate mock response for fallback mode"""
    try:
        if error:
            logger.warning(f"Generating mock response due to error: {error}")
        
        relevant_docs = []
        relevant_images = []
        
        search_documents = documents
        
        if len(search_documents) == 0:
            response = "현재 업로드된 문서가 없습니다. PDF 파일을 먼저 업로드한 후 문서에 대해 질문해주세요."
        else:
            greeting_words = ['안녕', 'hello', 'hi', '반가워', '잘지내', '어떻게']
            simple_questions = ['뭐야', '뭔가', '어떻게', '왜', '언제', '어디서']
            
            user_message_lower = user_message.lower()
            is_greeting = any(word in user_message_lower for word in greeting_words)
            is_simple = len(user_message.split()) <= 3 and any(word in user_message_lower for word in simple_questions)
            
            if not is_greeting and not is_simple:
                search_keywords = [word.strip() for word in user_message.lower().split() if len(word.strip()) > 1]
                
                for doc in search_documents:
                    doc_text = (doc['title'] + ' ' + doc['content']).lower()
                    match_count = sum(1 for keyword in search_keywords if keyword in doc_text)
                    match_ratio = match_count / len(search_keywords) if search_keywords else 0
                    
                    if match_ratio >= 0.3 or any(keyword in doc_text for keyword in search_keywords if len(keyword) >= 3):
                        relevant_docs.append(doc)
                        if doc.get('images'):
                            relevant_images.extend(doc['images'])
                        print(f"관련 문서 발견: {doc['title']} (매칭률: {match_ratio:.2f})")
            
            if relevant_docs:
                doc_titles = [doc['title'] for doc in relevant_docs[:3]]
                response = f"업로드하신 문서 '{', '.join(doc_titles)}'를 분석한 결과, '{user_message}'에 대한 관련 정보를 찾았습니다. {random.choice(MOCK_RESPONSES)}"
            else:
                if is_greeting:
                    response = "안녕하세요! BEACON AI 어시스턴트입니다. 업로드하신 문서에 대해 궁금한 점이 있으시면 언제든 질문해주세요."
                elif '문서' in user_message:
                    response = f"현재 {len(documents)}개의 문서가 업로드되어 있습니다. 구체적인 질문을 해주시면 문서 내용을 바탕으로 답변해드리겠습니다."
                else:
                    response = random.choice(MOCK_RESPONSES)
        
    except Exception as e:
        logger.error(f"Mock AI 처리 오류: {e}")
        response = random.choice(MOCK_RESPONSES)
    
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
        'images': relevant_images[:5] if relevant_images else [],
        'referenced_docs': [{'id': doc['id'], 'title': doc.get('original_filename', doc['title']), 'has_file': bool(doc.get('file_path'))} for doc in relevant_docs[:3]] if relevant_docs else []
    })

@chat_bp.route('/api/chat/history')
def get_chat_history():
    """Get chat history"""
    return jsonify(chat_history)