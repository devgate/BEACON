from flask import Flask, render_template, request, jsonify, send_file
from datetime import datetime
import json
import requests
import os
from werkzeug.utils import secure_filename
import PyPDF2
import io
from pdf2image import convert_from_bytes
import base64

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB 최대 파일 크기
app.config['UPLOAD_FOLDER'] = 'uploads'

# Ollama API 설정
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:latest"  # 설치된 모델 사용

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

# 문서 ID 자동 증가 카운터
# 새로운 문서 업로드 시 고유 ID 생성에 사용
document_counter = 0

# 채팅 기록 저장소
# 사용자와 AI 간의 대화 내역을 시간순으로 저장
chat_history = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/documents')
def get_documents():
    return jsonify(documents)

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    채팅 API 엔드포인트
    사용자 메시지를 받아 관련 문서를 검색하고 AI 응답을 생성
    """
    data = request.get_json()
    user_message = data.get('message', '')
    
    try:
        # 관련 문서 및 이미지 저장소 초기화
        relevant_docs = []
        relevant_images = []
        
        # 업로드된 문서가 없는 경우 안내 메시지 반환
        if len(documents) == 0:
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
                
                # 각 문서에 대해 관련성 검사
                for doc in documents:
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
            
            # Ollama AI 모델을 통한 응답 생성
            if relevant_docs:
                # 관련 문서가 있는 경우: 문서 내용을 컨텍스트로 포함
                context = "\n".join([f"- {doc['title']}: {doc['content'][:200]}..." for doc in relevant_docs[:3]])
                prompt = f"관련 문서:\n{context}\n\n사용자 질문: {user_message}\n\n위 문서 내용을 참고하여 한국어로 정확하고 친절하게 답변해주세요."
            else:
                # 관련 문서가 없는 경우: 일반적인 질문으로 처리
                print("관련 문서를 찾을 수 없습니다.")
                prompt = f"사용자 질문: {user_message}\n\n업로드된 문서에서 관련 내용을 찾을 수 없습니다. 일반적인 질문으로 간주하여 한국어로 정확하고 간단하게 답변해주세요."
            
            # Ollama API 호출을 위한 페이로드 구성
            payload = {
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False
            }
            
            # Ollama API로 POST 요청 전송
            ollama_response = requests.post(OLLAMA_URL, json=payload, timeout=30)
            
            if ollama_response.status_code == 200:
                response_data = ollama_response.json()
                raw_response = response_data.get('response', '응답을 생성할 수 없습니다.')
                
                # 응답 텍스트 정리 (앞뒤 공백 제거)
                response = raw_response.strip()
                
                # 디버깅용 로그 (개발 시에만 사용)
                print(f"원본 응답: {repr(raw_response)}")
                print(f"정리된 응답: {repr(response)}")
                
            else:
                raise Exception(f"Ollama API 오류: {ollama_response.status_code}")
        
    except Exception as e:
        print(f"Ollama API 오류: {e}")
        # 오류 발생 시 기본 응답
        if len(documents) == 0:
            response = "현재 업로드된 문서가 없습니다. PDF 파일을 먼저 업로드한 후 문서에 대해 질문해주세요."
        elif '안녕' in user_message or 'hello' in user_message.lower():
            response = "안녕하세요! 무엇을 도와드릴까요? (현재 로컬 AI가 오프라인 상태입니다)"
        elif '문서' in user_message:
            response = f"현재 {len(documents)}개의 문서가 등록되어 있습니다. 어떤 문서에 대해 질문하시겠습니까? (현재 로컬 AI가 오프라인 상태입니다)"
        else:
            response = "죄송합니다. 현재 로컬 AI 서비스에 연결할 수 없습니다. Ollama가 실행 중인지 확인해주세요."
    
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
                
                # 문서 리스트에 추가
                new_doc = {
                    'id': document_counter,
                    'title': filename,
                    'content': text_content,
                    'type': 'uploaded',
                    'images': images,
                    'file_path': file_path,
                    'original_filename': file.filename
                }
                documents.append(new_doc)
                
                return jsonify({
                    'success': True,
                    'message': f'"{file.filename}" 파일이 성공적으로 업로드되었습니다.',
                    'document': {
                        'id': new_doc['id'],
                        'title': new_doc['title'],
                        'preview': text_content[:200] + '...' if len(text_content) > 200 else text_content
                    }
                })
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