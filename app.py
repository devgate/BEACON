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
    """PDF 파일에서 이미지 추출"""
    images = []
    try:
        # PDF를 이미지로 변환
        file_stream.seek(0)  # 스트림 위치 초기화
        pdf_images = convert_from_bytes(file_stream.read(), dpi=150, fmt='PNG')
        
        # 이미지 저장 디렉토리 생성  
        image_dir = os.path.join('static', 'images', f'doc_{document_id}')
        os.makedirs(image_dir, exist_ok=True)
        
        for page_num, image in enumerate(pdf_images, 1):
            # 이미지 파일명 생성
            image_filename = f'page_{page_num}.png'
            image_path = os.path.join(image_dir, image_filename)
            
            # 이미지 저장
            image.save(image_path, 'PNG')
            
            # 웹에서 접근 가능한 URL 생성
            image_url = f'/static/images/doc_{document_id}/{image_filename}'
            
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

# 문서 데이터 (메모리에 저장)
documents = []

# 문서 ID 카운터
document_counter = 0

chat_history = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/documents')
def get_documents():
    return jsonify(documents)

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_message = data.get('message', '')
    
    try:
        # 관련 문서 검색
        relevant_docs = []
        relevant_images = []
        
        # 문서가 없는 경우 안내
        if len(documents) == 0:
            response = "현재 업로드된 문서가 없습니다. PDF 파일을 먼저 업로드한 후 문서에 대해 질문해주세요."
        else:
            for doc in documents:
                if any(keyword in doc['content'].lower() for keyword in user_message.lower().split()):
                    relevant_docs.append(doc)
                    # 관련 문서의 이미지도 포함
                    if doc.get('images'):
                        relevant_images.extend(doc['images'])
            
            # Ollama API 호출
            if relevant_docs:
                context = "\n".join([f"- {doc['title']}: {doc['content'][:200]}..." for doc in relevant_docs[:3]])
                prompt = f"관련 문서:\n{context}\n\n사용자 질문: {user_message}\n\n위 문서 내용을 참고하여 한국어로 정확하고 친절하게 답변해주세요."
            else:
                prompt = f"사용자 질문: {user_message}\n\n업로드된 문서에서 관련 내용을 찾을 수 없습니다. 일반적인 질문으로 간주하여 한국어로 정확하고 간단하게 답변해주세요."
            
            payload = {
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False
            }
            
            ollama_response = requests.post(OLLAMA_URL, json=payload, timeout=30)
            
            if ollama_response.status_code == 200:
                response_data = ollama_response.json()
                raw_response = response_data.get('response', '응답을 생성할 수 없습니다.')
                
                # 응답 정리 및 포맷팅
                response = raw_response.strip()
                
                # 디버깅용 로그
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
        'referenced_docs': [{'id': doc['id'], 'title': doc.get('original_filename', doc['title']), 'has_file': bool(doc.get('file_path'))} for doc in relevant_docs[:3]]  # 참조된 문서 정보
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
    """문서 파일 다운로드"""
    doc = next((d for d in documents if d['id'] == doc_id), None)
    if not doc or not doc.get('file_path'):
        return jsonify({'error': '파일을 찾을 수 없습니다.'}), 404
    
    if not os.path.exists(doc['file_path']):
        return jsonify({'error': '파일이 존재하지 않습니다.'}), 404
    
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