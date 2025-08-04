/**
 * BEACON RAG 시스템의 메인 클래스
 * PDF 문서 업로드, 채팅, 이미지 표시 등의 기능을 관리
 */
class RAGManager {
    constructor() {
        this.isUploading = false; // 파일 업로드 중복 방지 플래그
        this.selectedCategoryId = null; // 선택된 카테고리 ID
        this.init();
        this.loadDocuments();
        this.loadCategories();
        this.loadWeatherData();
    }

    init() {
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.chatMessages = document.getElementById('chatMessages');

        // 페이지 요소들
        this.chatPage = document.getElementById('chatPage');
        this.ragManagerPage = document.getElementById('ragManagerPage');
        this.chatTab = document.getElementById('chatTab');
        this.ragManagerTab = document.getElementById('ragManagerTab');

        // 이벤트 리스너 설정
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // 네비게이션 이벤트 리스너
        this.chatTab.addEventListener('click', () => this.showPage('chat'));
        this.ragManagerTab.addEventListener('click', () => this.showPage('ragManager'));

        // 파일 업로드 초기화
        this.initFileUpload();
        
        // RAG Manager 초기화
        this.initRAGManager();
    }

    async loadDocuments() {
        try {
            const response = await fetch('/api/documents');
            const documents = await response.json();
            
            // 문서는 카테고리별로만 표시하므로 별도 renderDocuments 호출하지 않음
            console.log(`총 ${documents.length}개의 문서가 로드되었습니다.`);
        } catch (error) {
            console.error('문서 로드 실패:', error);
        }
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/categories');
            const categories = await response.json();
            
            this.renderCategories(categories);
            this.populateCategorySelect(categories);
            
            // 초기 로드 시 "전체" 카테고리를 기본으로 선택
            if (!this.selectedCategoryId) {
                setTimeout(() => {
                    document.querySelectorAll(`[data-category-id="all"]`).forEach(item => {
                        item.classList.add('active');
                    });
                }, 100);
            }
        } catch (error) {
            console.error('카테고리 로드 실패:', error);
        }
    }

    renderCategories(categories) {
        const categoryList = document.getElementById('categoryList');
        const ragCategoryList = document.getElementById('ragCategoryList');
        
        if (!categoryList && !ragCategoryList) return;
        
        // "전체" 옵션을 맨 위에 추가
        const totalDocs = categories.reduce((sum, cat) => sum + (cat.document_count || 0), 0);
        const allCategoryHTML = `
            <div class="category-item" data-category-id="all" onclick="ragManager.selectAllCategories()">
                <div class="category-icon" style="color: #718096">
                    <i class="fas fa-folder-open"></i>
                </div>
                <div class="category-info">
                    <div class="category-name">전체</div>
                    <div class="category-description">모든 카테고리의 문서</div>
                </div>
                <div class="category-count">${totalDocs}</div>
            </div>
        `;
        
        const categoryHTML = categories.map(category => `
            <div class="category-item" data-category-id="${category.id}" onclick="ragManager.selectCategory(${category.id})">
                <div class="category-icon" style="color: ${category.color}">
                    <i class="${category.icon}"></i>
                </div>
                <div class="category-info">
                    <div class="category-name">${category.name}</div>
                    <div class="category-description">${category.description}</div>
                </div>
                <div class="category-count">${category.document_count || 0}</div>
            </div>
        `).join('');
        
        const fullHTML = allCategoryHTML + categoryHTML;
        
        if (categoryList) {
            categoryList.innerHTML = fullHTML;
        }
        if (ragCategoryList) {
            ragCategoryList.innerHTML = fullHTML;
        }
    }

    populateCategorySelect(categories) {
        const categorySelect = document.getElementById('categorySelect');
        if (!categorySelect) return;
        
        categorySelect.innerHTML = categories.map(category => 
            `<option value="${category.id}">${category.name}</option>`
        ).join('');
    }

    selectCategory(categoryId) {
        this.selectedCategoryId = categoryId;
        
        // 카테고리 선택 상태 업데이트 (시각적 표시)
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.querySelectorAll(`[data-category-id="${categoryId}"]`).forEach(item => {
            item.classList.add('active');
        });
        
        // 선택된 카테고리의 문서들 로드
        this.loadDocumentsByCategory(categoryId);
        
        // 채팅 영역에 카테고리 선택 알림
        this.showCategorySelection(categoryId);
    }

    selectAllCategories() {
        this.selectedCategoryId = null; // null이면 전체 문서 검색
        
        // 카테고리 선택 상태 업데이트 (시각적 표시)
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.querySelectorAll(`[data-category-id="all"]`).forEach(item => {
            item.classList.add('active');
        });
        
        // 전체 문서 로드
        this.loadDocuments();
        
        // 채팅 영역에 전체 선택 알림
        this.addSystemMessage('📂 모든 카테고리가 선택되었습니다. 전체 문서를 대상으로 질문하실 수 있습니다.');
    }

    async showCategorySelection(categoryId) {
        try {
            const response = await fetch('/api/categories');
            const categories = await response.json();
            const selectedCategory = categories.find(cat => cat.id === categoryId);
            
            if (selectedCategory) {
                this.addSystemMessage(`📁 "${selectedCategory.name}" 카테고리가 선택되었습니다. 이제 이 카테고리의 문서들만을 대상으로 질문하실 수 있습니다. (문서 ${selectedCategory.document_count}개)`);
            }
        } catch (error) {
            console.error('카테고리 정보 로드 실패:', error);
        }
    }

    async loadDocumentsByCategory(categoryId) {
        try {
            const response = await fetch(`/api/categories/${categoryId}/documents`);
            const documents = await response.json();
            
            console.log(`카테고리 ${categoryId}의 문서 ${documents.length}개를 로드했습니다.`);
            
            // RAG Manager에서도 필터링
            if (document.getElementById('ragManagerPage').style.display !== 'none') {
                this.renderFileManager(documents);
            }
        } catch (error) {
            console.error('카테고리별 문서 로드 실패:', error);
        }
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
            // 채팅 요청 데이터 준비
            const chatData = { message };
            
            // 선택된 카테고리가 있으면 추가
            if (this.selectedCategoryId) {
                chatData.category_id = this.selectedCategoryId;
                console.log(`선택된 카테고리 ${this.selectedCategoryId}로 채팅 요청`);
            }
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(chatData)
            });

            const data = await response.json();
            
            // 로딩 메시지 제거
            loadingDiv.remove();
            
            // AI 응답 표시
            this.addMessage(data.response, 'ai', false, data.images, data.referenced_docs);
            
        } catch (error) {
            loadingDiv.remove();
            this.addMessage('죄송합니다. 오류가 발생했습니다.', 'ai');
            console.error('채팅 오류:', error);
        }
    }

    /**
     * 채팅 메시지를 화면에 추가하는 함수
     * @param {string} content - 메시지 내용
     * @param {string} type - 메시지 타입 ('user' 또는 'ai')
     * @param {boolean} isLoading - 로딩 상태 표시 여부
     * @param {Array} images - 표시할 이미지 배열
     * @param {Array} referencedDocs - 참조된 문서 배열
     * @returns {HTMLElement} 생성된 메시지 요소
     */
    addMessage(content, type, isLoading = false, images = [], referencedDocs = []) {
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
        
        // 참조된 문서가 있고 실제로 데이터가 있으면 문서 목록 추가
        if (referencedDocs && Array.isArray(referencedDocs) && referencedDocs.length > 0) {
            const referencedDocsDiv = document.createElement('div');
            referencedDocsDiv.className = 'referenced-docs';
            
            const docsTitle = document.createElement('div');
            docsTitle.className = 'referenced-docs-title';
            docsTitle.innerHTML = '<i class="fas fa-file-alt"></i> 참조된 문서:';
            referencedDocsDiv.appendChild(docsTitle);
            
            referencedDocs.forEach(doc => {
                const docItem = document.createElement('div');
                docItem.className = 'referenced-doc-item';
                
                const docIcon = document.createElement('i');
                docIcon.className = 'fas fa-file-pdf';
                
                const docTitle = document.createElement('span');
                docTitle.className = 'doc-title';
                docTitle.textContent = doc.title;
                
                docItem.appendChild(docIcon);
                docItem.appendChild(docTitle);
                
                if (doc.has_file) {
                    const downloadBtn = document.createElement('button');
                    downloadBtn.className = 'download-btn';
                    downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
                    downloadBtn.title = '파일 다운로드';
                    downloadBtn.addEventListener('click', () => {
                        this.downloadFile(doc.id, doc.title);
                    });
                    docItem.appendChild(downloadBtn);
                }
                
                referencedDocsDiv.appendChild(docItem);
            });
            
            messageDiv.appendChild(referencedDocsDiv);
        }
        
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
        const uploadContainer = document.getElementById('uploadContainer');
        const closeUploadBtn = document.getElementById('closeUploadBtn');
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        const selectFileBtn = document.getElementById('selectFileBtn');

        // 요소가 존재하지 않으면 함수 종료
        if (!uploadContainer || !closeUploadBtn || !uploadZone || !fileInput || !selectFileBtn) {
            console.log('업로드 관련 요소를 찾을 수 없습니다.');
            return;
        }

        // 업로드 창 닫기
        closeUploadBtn.addEventListener('click', () => {
            uploadContainer.style.display = 'none';
            this.resetUploadForm();
        });

        // 파일 선택 버튼 - 더 강력한 이벤트 핸들러
        selectFileBtn.addEventListener('click', function(e) {
            console.log('파일 선택 버튼 클릭됨');
            e.stopPropagation();
            e.preventDefault();
            
            // 파일 입력 요소를 직접 트리거
            const fileInputElement = document.getElementById('fileInput');
            if (fileInputElement) {
                console.log('파일 입력 요소 찾음, 클릭 트리거');
                fileInputElement.click();
            } else {
                console.error('파일 입력 요소를 찾을 수 없음');
            }
        });

        // 버튼에 마우스 오버 이벤트도 추가하여 버튼이 인식되는지 확인
        selectFileBtn.addEventListener('mouseenter', function() {
            console.log('파일 선택 버튼에 마우스 오버');
        });

        // 업로드 영역 클릭 (버튼이 아닌 영역만)
        uploadZone.addEventListener('click', (e) => {
            // 파일 선택 버튼을 클릭한 경우에는 처리하지 않음
            if (e.target.classList.contains('select-file-btn') || e.target.closest('.select-file-btn')) {
                return;
            }
            
            // 버튼이 아닌 영역을 클릭한 경우에만 파일 입력 트리거
            if (e.target === uploadZone || e.target.classList.contains('upload-icon') || e.target.tagName === 'P') {
                console.log('업로드 영역 클릭됨');
                fileInput.click();
            }
        });

        // 파일 선택 시
        fileInput.addEventListener('change', (e) => {
            console.log('파일 선택됨:', e.target.files);
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
                // 업로드 후 즉시 파일 입력 초기화하여 같은 파일 재선택 가능하게 함
                e.target.value = '';
            }
        });

        // fileInput 클릭 이벤트도 추가하여 다이얼로그가 열리는지 확인
        fileInput.addEventListener('click', () => {
            console.log('파일 입력 요소 클릭됨');
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

    /**
     * PDF 파일 업로드 처리 함수
     * @param {File} file - 업로드할 PDF 파일
     */
    async handleFileUpload(file) {
        // 중복 업로드 방지 체크
        if (this.isUploading) {
            console.log('업로드가 이미 진행 중입니다.');
            return;
        }

        // PDF 파일 형식 검증
        if (!file.type.includes('pdf')) {
            alert('PDF 파일만 업로드 가능합니다.');
            return;
        }

        this.isUploading = true; // 업로드 시작 플래그 설정
        const formData = new FormData();
        formData.append('file', file);
        
        // 선택된 카테고리 ID 추가
        const categorySelect = document.getElementById('categorySelect');
        const categoryId = categorySelect ? categorySelect.value : '4'; // 기본값: 일반 카테고리
        formData.append('category_id', categoryId);

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
                this.loadCategories(); // 카테고리도 새로고침 (문서 개수 업데이트)
                this.refreshFileManager(); // RAG Manager도 새로고침
                
                setTimeout(() => {
                    document.getElementById('uploadContainer').style.display = 'none';
                    this.resetUploadForm();
                    this.isUploading = false; // 업로드 완료 플래그 해제
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
                this.isUploading = false; // 업로드 실패 플래그 해제
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

    /**
     * 파일 다운로드 함수
     * @param {number} docId - 문서 ID
     * @param {string} filename - 파일명
     */
    downloadFile(docId, filename) {
        const downloadUrl = `/api/download/${docId}`;
        
        // 임시 다운로드 링크 생성 및 클릭
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 사용자에게 다운로드 시작 알림
        this.addSystemMessage(`"${filename}" 파일 다운로드를 시작합니다.`);
    }

    /**
     * 페이지 전환 함수
     * @param {string} pageName - 전환할 페이지 ('chat' 또는 'ragManager')
     */
    showPage(pageName) {
        // 모든 페이지 숨기기
        this.chatPage.style.display = 'none';
        this.ragManagerPage.style.display = 'none';
        
        // 모든 탭 비활성화
        this.chatTab.classList.remove('active');
        this.ragManagerTab.classList.remove('active');
        
        // 선택된 페이지 표시
        if (pageName === 'chat') {
            this.chatPage.style.display = 'flex';
            this.chatTab.classList.add('active');
        } else if (pageName === 'ragManager') {
            this.ragManagerPage.style.display = 'flex';
            this.ragManagerTab.classList.add('active');
            this.refreshFileManager();
            this.loadCategories(); // RAG Manager 페이지에서도 카테고리 새로고침
        }
    }

    /**
     * RAG Manager 초기화
     */
    initRAGManager() {
        const uploadTriggerBtn = document.getElementById('uploadTriggerBtn');
        
        // 업로드 트리거 버튼
        uploadTriggerBtn.addEventListener('click', () => {
            document.getElementById('uploadContainer').style.display = 'block';
        });
        
        // 필터 버튼들
        const filterBtns = document.querySelectorAll('[data-filter]');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // 활성 필터 변경
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 필터링 적용
                this.filterFiles(e.target.dataset.filter);
            });
        });
    }

    /**
     * 파일 매니저 새로고침
     */
    async refreshFileManager() {
        try {
            const response = await fetch('/api/documents');
            const documents = await response.json();
            
            this.renderFileManager(documents);
            this.updateStats(documents);
        } catch (error) {
            console.error('파일 목록 로드 실패:', error);
        }
    }

    /**
     * 파일 매니저 렌더링
     */
    renderFileManager(documents) {
        const fileManagerContent = document.getElementById('fileManagerContent');
        
        if (documents.length === 0) {
            fileManagerContent.innerHTML = `
                <div class="empty-file-manager">
                    <i class="fas fa-folder-open"></i>
                    <h3>업로드된 문서가 없습니다</h3>
                    <p>PDF 파일을 업로드하여 RAG 시스템을 시작하세요</p>
                    <button class="upload-trigger-btn" onclick="document.getElementById('uploadContainer').style.display='block'">
                        <i class="fas fa-plus"></i>
                        <span>첫 번째 파일 업로드</span>
                    </button>
                </div>
            `;
            return;
        }

        const fileCards = documents.map(doc => this.createFileCard(doc)).join('');
        fileManagerContent.innerHTML = fileCards;
    }

    /**
     * 파일 카드 생성
     */
    createFileCard(doc) {
        const uploadDate = new Date().toLocaleDateString('ko-KR');
        const fileSize = this.formatFileSize(doc.content ? doc.content.length : 0);
        const preview = doc.content ? doc.content.substring(0, 100) + '...' : '내용을 불러올 수 없습니다.';

        return `
            <div class="file-card" data-doc-id="${doc.id}">
                <div class="file-card-header">
                    <div class="file-icon">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div class="file-info">
                        <h3>${doc.title}</h3>
                        <p>업로드: ${uploadDate}</p>
                    </div>
                </div>
                <div class="file-card-body">
                    <div class="file-preview">${preview}</div>
                </div>
                <div class="file-card-footer">
                    <div class="file-actions">
                        ${doc.file_path ? `<button class="action-btn download" onclick="ragManager.downloadFile(${doc.id}, '${doc.original_filename || doc.title}')">
                            <i class="fas fa-download"></i> 다운로드
                        </button>` : ''}
                        <button class="action-btn delete" onclick="ragManager.deleteFile(${doc.id})">
                            <i class="fas fa-trash"></i> 삭제
                        </button>
                    </div>
                    <div class="file-size">${fileSize}</div>
                </div>
            </div>
        `;
    }

    /**
     * 파일 크기 포맷팅
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 통계 업데이트
     */
    updateStats(documents) {
        const totalDocs = documents.length;
        const totalSize = documents.reduce((sum, doc) => sum + (doc.content ? doc.content.length : 0), 0);
        
        document.getElementById('totalDocs').textContent = totalDocs;
        document.getElementById('totalSize').textContent = this.formatFileSize(totalSize);
    }

    /**
     * 파일 필터링
     */
    filterFiles(filter) {
        const fileCards = document.querySelectorAll('.file-card');
        
        fileCards.forEach(card => {
            let show = true;
            
            switch (filter) {
                case 'recent':
                    // 최근 7일 내 파일만 표시 (간단한 구현)
                    show = true; // 실제로는 업로드 날짜 체크 필요
                    break;
                case 'large':
                    // 1MB 이상 파일만 표시 (간단한 구현)
                    const sizeText = card.querySelector('.file-size').textContent;
                    show = sizeText.includes('MB') || sizeText.includes('GB');
                    break;
                default:
                    show = true;
            }
            
            card.style.display = show ? 'block' : 'none';
        });
    }

    /**
     * 파일 삭제
     */
    async deleteFile(docId) {
        if (!confirm('정말로 이 파일을 삭제하시겠습니까?')) {
            return;
        }

        try {
            const response = await fetch(`/api/documents/${docId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.refreshFileManager();
                this.loadDocuments(); // Chat 페이지의 문서 목록도 새로고침
                this.loadCategories(); // 카테고리도 새로고침 (문서 개수 업데이트)
                this.addSystemMessage('파일이 삭제되었습니다.');
            } else {
                throw new Error('파일 삭제 실패');
            }
        } catch (error) {
            console.error('파일 삭제 오류:', error);
            alert('파일 삭제 중 오류가 발생했습니다.');
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