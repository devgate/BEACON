from flask import Flask, render_template, request, jsonify
from datetime import datetime
import json
import os

app = Flask(__name__)

# 샘플 데이터
documents = [
    {"id": 1, "title": "test"},
    {"id": 2, "title": "SK 쩜드스 - Test - JJI - 비정형"},
    {"id": 3, "title": "SK쩜드스-고객센터"},
    {"id": 4, "title": "SK 쩜드스 - 비정형(PDF)"}
]

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
    
    # 간단한 응답 로직 (실제 RAG 시스템으로 대체 가능)
    if '안녕' in user_message or 'hello' in user_message.lower():
        response = "안녕하세요! 무엇을 도와드릴까요?"
    elif '문서' in user_message:
        response = f"현재 {len(documents)}개의 문서가 등록되어 있습니다. 어떤 문서에 대해 질문하시겠습니까?"
    else:
        response = "죄송합니다. 더 구체적인 질문을 해주시면 도움을 드릴 수 있습니다."
    
    # 채팅 기록 저장
    chat_entry = {
        'timestamp': datetime.now().isoformat(),
        'user_message': user_message,
        'ai_response': response
    }
    chat_history.append(chat_entry)
    
    return jsonify({
        'response': response,
        'timestamp': chat_entry['timestamp']
    })

@app.route('/api/chat/history')
def get_chat_history():
    return jsonify(chat_history)

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