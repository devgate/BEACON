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

        // 파일 업로드 초기화
        this.initFileUpload();
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
            
            docItem.addEventListener('click', (e) => {
                this.selectDocument(doc, e);
            });
            
            this.documentList.appendChild(docItem);
        });
    }

    selectDocument(doc, event) {
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
            this.addMessage(data.response, 'ai', false, data.images);
            
        } catch (error) {
            loadingDiv.remove();
            this.addMessage('죄송합니다. 오류가 발생했습니다.', 'ai');
            console.error('채팅 오류:', error);
        }
    }

    addMessage(content, type, isLoading = false, images = []) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // 디버깅 로그
        console.log('원본 content:', JSON.stringify(content));
        console.log('content 문자열:', content);
        console.log('개행 문자 포함 여부:', content.includes('\n'));
        
        // DOM 요소를 직접 생성
        const contentDiv = document.createElement('div');
        contentDiv.className = `message-content ${isLoading ? 'loading' : ''}`;
        
        // 강제로 CSS 스타일 적용
        contentDiv.style.whiteSpace = 'pre-wrap';
        contentDiv.style.whiteSpaceCollapse = 'preserve';
        contentDiv.style.textWrap = 'wrap';
        
        // textContent로 원본 텍스트 보존
        contentDiv.textContent = content;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = timeString;
        
        messageDiv.appendChild(contentDiv);
        
        // 이미지가 있으면 이미지 갤러리 추가
        if (images && images.length > 0) {
            const imageGallery = document.createElement('div');
            imageGallery.className = 'image-gallery';
            
            images.forEach((image, index) => {
                const imageContainer = document.createElement('div');
                imageContainer.className = 'image-container';
                
                const img = document.createElement('img');
                img.src = image.url;
                img.alt = `PDF 이미지 ${index + 1}`;
                img.className = 'pdf-image';
                img.loading = 'lazy';
                
                // 이미지 클릭 시 확대 보기
                img.addEventListener('click', () => {
                    this.showImageModal(image.url, `${image.filename} (페이지 ${image.page})`);
                });
                
                const caption = document.createElement('div');
                caption.className = 'image-caption';
                caption.textContent = `페이지 ${image.page}`;
                
                imageContainer.appendChild(img);
                imageContainer.appendChild(caption);
                imageGallery.appendChild(imageContainer);
            });
            
            messageDiv.appendChild(imageGallery);
        }
        
        messageDiv.appendChild(timeDiv);
        
        console.log('적용된 white-space:', window.getComputedStyle(contentDiv).whiteSpace);
        
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

    // 파일 업로드 관련 메서드들
    initFileUpload() {
        const attachBtn = document.getElementById('attachBtn');
        const uploadContainer = document.getElementById('uploadContainer');
        const closeUploadBtn = document.getElementById('closeUploadBtn');
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        const selectFileBtn = document.getElementById('selectFileBtn');

        // 업로드 버튼 클릭
        attachBtn.addEventListener('click', () => {
            uploadContainer.style.display = 'block';
        });

        // 업로드 창 닫기
        closeUploadBtn.addEventListener('click', () => {
            uploadContainer.style.display = 'none';
            this.resetUploadForm();
        });

        // 파일 선택 버튼
        selectFileBtn.addEventListener('click', () => {
            fileInput.click();
        });

        // 업로드 영역 클릭
        uploadZone.addEventListener('click', () => {
            fileInput.click();
        });

        // 파일 선택 시
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        // 드래그 앤 드롭
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0]);
            }
        });
    }

    async handleFileUpload(file) {
        if (!file.type.includes('pdf')) {
            alert('PDF 파일만 업로드 가능합니다.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const uploadProgress = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        try {
            // 프로그레스 표시
            uploadProgress.style.display = 'block';
            progressFill.style.width = '0%';
            progressText.textContent = '업로드 중...';

            // 프로그레스 애니메이션
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += 10;
                progressFill.style.width = Math.min(progress, 90) + '%';
            }, 100);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);
            progressFill.style.width = '100%';

            const result = await response.json();

            if (result.success) {
                progressText.textContent = '업로드 완료!';
                
                // 성공 메시지 표시
                this.addSystemMessage(result.message);
                
                // 문서 목록 새로고침
                this.loadDocuments();
                
                setTimeout(() => {
                    document.getElementById('uploadContainer').style.display = 'none';
                    this.resetUploadForm();
                }, 2000);
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('파일 업로드 오류:', error);
            progressText.textContent = '업로드 실패';
            progressFill.style.background = '#ff4757';
            alert('파일 업로드 중 오류가 발생했습니다: ' + error.message);
            
            setTimeout(() => {
                this.resetUploadForm();
            }, 2000);
        }
    }

    resetUploadForm() {
        const uploadProgress = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const fileInput = document.getElementById('fileInput');

        uploadProgress.style.display = 'none';
        progressFill.style.width = '0%';
        progressFill.style.background = '#00d4ff';
        progressText.textContent = '업로드 중...';
        fileInput.value = '';
    }

    // 이미지 모달 표시
    showImageModal(imageUrl, title) {
        // 기존 모달 제거
        const existingModal = document.querySelector('.image-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 모달 생성
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <img src="${imageUrl}" alt="${title}" class="modal-image">
                    </div>
                </div>
            </div>
        `;
        
        // 이벤트 리스너
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === modal.querySelector('.modal-overlay')) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
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