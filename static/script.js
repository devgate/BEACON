class RAGManager {
    constructor() {
        this.init();
        this.loadDocuments();
        this.loadWeatherData();
    }

    init() {
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.documentList = document.getElementById('documentList');

        // 이벤트 리스너 설정
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // 날씨 위젯 클릭 이벤트
        document.querySelector('.weather-widget').addEventListener('click', () => {
            this.addSystemMessage('현재 안양시 동구의 날씨는 3°C이며 흐린 상태입니다.');
        });

        // 타로 위젯 클릭 이벤트
        document.querySelector('.tarot-widget').addEventListener('click', () => {
            this.addSystemMessage('오늘의 타로 카드를 확인해보세요. 당신의 길을 밝혀드립니다.');
        });

        // 이슈 위젯 클릭 이벤트
        document.querySelector('.issue-widget').addEventListener('click', () => {
            this.addSystemMessage('오늘의 주요 뉴스와 이슈를 확인해보세요.');
        });
    }

    async loadDocuments() {
        try {
            const response = await fetch('/api/documents');
            const documents = await response.json();
            
            this.renderDocuments(documents);
        } catch (error) {
            console.error('문서 로드 실패:', error);
        }
    }

    renderDocuments(documents) {
        this.documentList.innerHTML = '';
        
        documents.forEach(doc => {
            const docItem = document.createElement('div');
            docItem.className = 'document-item';
            docItem.innerHTML = `
                <div class="item-no">${doc.id}</div>
                <div class="item-title">${doc.title}</div>
            `;
            
            docItem.addEventListener('click', () => {
                this.selectDocument(doc);
            });
            
            this.documentList.appendChild(docItem);
        });
    }

    selectDocument(doc) {
        // 기존 선택 해제
        document.querySelectorAll('.document-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 새로운 선택 표시
        event.currentTarget.classList.add('selected');
        
        this.addSystemMessage(`문서 "${doc.title}"가 선택되었습니다. 이 문서에 대해 질문해보세요.`);
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        // 사용자 메시지 표시
        this.addMessage(message, 'user');
        this.chatInput.value = '';

        // 로딩 표시
        const loadingDiv = this.addMessage('답변을 생성하고 있습니다...', 'ai', true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();
            
            // 로딩 메시지 제거
            loadingDiv.remove();
            
            // AI 응답 표시
            this.addMessage(data.response, 'ai');
            
        } catch (error) {
            loadingDiv.remove();
            this.addMessage('죄송합니다. 오류가 발생했습니다.', 'ai');
            console.error('채팅 오류:', error);
        }
    }

    addMessage(content, type, isLoading = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageDiv.innerHTML = `
            <div class="message-content ${isLoading ? 'loading' : ''}">${content}</div>
            <div class="message-time">${timeString}</div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        return messageDiv;
    }

    addSystemMessage(content) {
        this.addMessage(content, 'ai');
    }

    async loadWeatherData() {
        try {
            const response = await fetch('/api/weather');
            const weather = await response.json();
            
            document.getElementById('temperature').textContent = weather.temperature;
            document.getElementById('location').textContent = weather.location;
            document.getElementById('condition').textContent = weather.condition;
            document.getElementById('range').textContent = weather.range;
        } catch (error) {
            console.error('날씨 데이터 로드 실패:', error);
        }
    }

    // 사이드바 토글 (모바일용)
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('open');
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.ragManager = new RAGManager();
});

// CSS에 로딩 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
    .document-item.selected {
        background: #00d4ff !important;
        color: #1a202c !important;
    }
    
    .document-item.selected .item-title,
    .document-item.selected .item-no {
        color: #1a202c !important;
    }
    
    .message-content.loading {
        opacity: 0.7;
        position: relative;
    }
    
    .message-content.loading::after {
        content: '';
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        width: 20px;
        height: 20px;
        border: 2px solid #4a5568;
        border-top: 2px solid #00d4ff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: translateY(-50%) rotate(0deg); }
        100% { transform: translateY(-50%) rotate(360deg); }
    }
    
    .chat-welcome {
        transition: opacity 0.3s ease-out;
    }
    
    .chat-welcome.hidden {
        opacity: 0;
        pointer-events: none;
    }
`;
document.head.appendChild(style);