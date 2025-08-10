# BEACON Frontend - React Application

## 📱 Overview

BEACON 프론트엔드는 Create React App 기반의 RAG 문서 관리 및 AI 채팅 애플리케이션입니다. AWS Bedrock과 연동하여 PDF 문서 기반의 지능형 질의응답 서비스를 제공합니다.

## 🎯 핵심 기능

### 1. **AI 채팅 시스템**
- **실시간 대화**: AWS Bedrock 모델과 실시간 채팅
- **RAG 기반 답변**: 업로드된 PDF 문서 기반 지능형 응답
- **모델 선택**: Claude 3, Llama 3, Titan 등 다양한 AI 모델 지원
- **비용 추적**: 실시간 토큰 사용량 및 비용 표시
- **신뢰도 점수**: 응답 관련성 0.0-1.0 스케일 표시
- **이미지 참조**: 관련 문서 페이지 이미지 함께 표시

### 2. **문서 관리 시스템 (RAG Manager)**
- **PDF 업로드**: 드래그 앤 드롭으로 간편한 파일 업로드
- **카테고리 분류**: 재무, 맛집, 매뉴얼, 일반 4개 사전 정의 카테고리
- **실시간 통계**: 카테고리별 문서 개수 및 상태 표시
- **파일 관리**: 다운로드, 삭제, 미리보기 기능
- **RAG 설정**: 카테고리별 청킹 전략 및 임베딩 모델 설정

### 3. **사용자 인터페이스**
- **반응형 디자인**: 모바일 및 데스크톱 최적화
- **FontAwesome 아이콘**: 직관적인 아이콘 인터페이스
- **실시간 피드백**: 로딩 상태, 성공/오류 메시지 표시

## 🏗️ 프로젝트 구조

```
frontend/
├── public/                     # 정적 파일
│   ├── index.html             # 메인 HTML 템플릿
│   ├── favicon.ico            # 파비콘
│   └── manifest.json          # PWA 매니페스트
├── src/                       # React 소스 코드
│   ├── components/            # 재사용 가능한 컴포넌트
│   │   ├── Header.js          # 네비게이션 헤더
│   │   ├── CategoryList.js    # 카테고리 목록 및 선택
│   │   ├── FileManager.js     # 파일 업로드/관리
│   │   ├── ChatMessage.js     # 채팅 메시지 표시
│   │   ├── ChatInput.js       # 메시지 입력 인터페이스
│   │   ├── ModelSelector.js   # AI 모델 선택
│   │   ├── UploadModal.js     # 파일 업로드 모달
│   │   └── SettingsPanel.js   # RAG 설정 패널
│   ├── pages/                 # 페이지 컴포넌트
│   │   ├── ChatPage.js        # 채팅 페이지
│   │   └── RAGManagerPage.js  # 문서 관리 페이지
│   ├── services/              # API 서비스
│   │   └── api.js             # 백엔드 API 통신
│   ├── hooks/                 # 커스텀 React 훅
│   ├── App.js                 # 메인 애플리케이션
│   ├── App.css                # 글로벌 스타일
│   ├── index.js               # 앱 엔트리 포인트
│   └── index.css              # 기본 CSS 스타일
├── package.json               # 의존성 및 스크립트
├── Dockerfile                 # Docker 멀티스테이지 빌드
├── default.conf.template      # Nginx 설정 템플릿
└── docker-entrypoint.sh       # 컨테이너 시작 스크립트
```

## 🚀 개발 환경 설정

### Prerequisites
```bash
Node.js >= 16.0.0
npm >= 8.0.0
```

### 로컬 개발 서버 실행
```bash
# 의존성 설치
npm install

# 개발 서버 시작 (localhost:3000)
npm start

# 프로덕션 빌드
npm run build

# 테스트 실행
npm test
```

### 로컬 테스트 (Docker Compose)
```bash
cd deploy/dev

# 통합 테스트 환경
./test-local.sh

# 또는 수동 실행
docker-compose -f docker-compose.test.yml up --build

# 접속
# Frontend: http://localhost:3000
# Backend: http://localhost:5001
```

### 개발 환경 (Hot Reload)
```bash
cd deploy/dev
docker-compose -f docker-compose.dev.yml up

# React 개발 서버: http://localhost:3000
# 실시간 코드 변경 반영
```

### Docker 빌드 및 푸시
```bash
cd frontend
./build.sh [TAG]
```

## 🌐 배포

### 자동화된 AWS 배포 (권장)
```bash
# 전체 자동 배포 (빌드 + Terraform + EC2 자동 업데이트)
cd deploy/prd
./deploy-frontend.sh latest

# 빌드 없이 자동 배포 (이미 빌드된 이미지 사용)
./deploy-frontend.sh latest true

# Terraform 없이 Docker 이미지만 자동 배포
./deploy-frontend.sh latest false true

# 상태 확인만 (자동 배포 비활성화)
./deploy-frontend.sh latest true true false
```

#### 자동화 기능
- **인스턴스 자동 검색**: AWS CLI로 프론트엔드 EC2 자동 발견
- **SSH 연결 자동화**: 연결 테스트 및 컨테이너 자동 업데이트
- **환경별 설정**: AWS는 HTTPS, 로컬은 HTTP 백엔드 자동 설정
- **실시간 모니터링**: 배포 과정 실시간 로그 및 헬스체크

### 수동 컨테이너 실행 (백업용)
```bash
# AWS 환경에서 수동 실행 (자동화 스크립트 실패 시에만)
docker run -d \
  --name beacon-frontend \
  -p 80:80 \
  -e BACKEND_HOST=api.beacon.sk-shieldus.com \
  -e BACKEND_PORT=443 \
  -e BACKEND_PROTOCOL=https \
  sksda4614/beacon-frontend:latest

# 로컬 환경에서 수동 실행 (Docker Compose 권장)
docker run -d \
  --name beacon-frontend \
  -p 3000:80 \
  -e BACKEND_HOST=beacon-backend \
  -e BACKEND_PORT=5000 \
  -e BACKEND_PROTOCOL=http \
  sksda4614/beacon-frontend:latest
```

## 🎨 컴포넌트 아키텍처

### Core Layout Components

#### **App.js**
메인 애플리케이션 구조
```javascript
function App() {
  const [activeTab, setActiveTab] = useState('chat');
  
  return (
    <div className="app-container">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      {activeTab === 'chat' ? <ChatPage /> : <RAGManagerPage />}
    </div>
  );
}
```

#### **Header.js**
네비게이션 및 탭 관리 - 채팅과 RAG 관리 페이지 간 전환

### Chat System Components

#### **ChatPage.js**
- 메시지 상태 관리 및 실시간 채팅 인터페이스
- Bedrock 모델 선택 및 카테고리 필터링
- 자동 스크롤 및 대화 기록 관리

#### **ChatMessage.js**
- 사용자/AI 메시지 구분 렌더링
- 비용 정보, 신뢰도 점수, 처리 시간 표시
- 참조 문서 이미지 및 링크 표시

#### **ChatInput.js**
- 자동 크기 조정 textarea
- Enter 전송, Shift+Enter 줄바꿈
- 빈 메시지 전송 방지

#### **ModelSelector.js**
- Bedrock 모델 목록 동적 로딩
- 모델별 비용 정보 표시
- 실시간 상태 확인

### Document Management Components

#### **RAGManagerPage.js**
- 3-column 레이아웃 (카테고리, 파일, 설정)
- 실시간 파일 상태 업데이트
- 카테고리별 필터링

#### **CategoryList.js**
- 4개 사전 정의 카테고리 (재무, 맛집, 매뉴얼, 일반)
- 카테고리별 문서 개수 표시
- FontAwesome 아이콘 및 색상 코딩

#### **FileManager.js**
- 파일 목록 표시 및 관리
- 다운로드, 삭제, 미리보기 기능
- 파일 크기 및 업로드 시간 표시

#### **UploadModal.js**
- 드래그 앤 드롭 파일 업로드
- PDF 파일 검증
- 업로드 진행률 표시

#### **SettingsPanel.js**
- 카테고리별 RAG 설정 관리
- 임베딩 모델, 청킹 전략 설정
- 실시간 서버 동기화

## 🔌 API 통신 (services/api.js)

### Service Architecture
```javascript
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.beacon.sk-shieldus.com'
  : 'http://localhost:5000';

// HTTP 클라이언트 설정
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});
```

### Chat Service
```javascript
export const chatService = {
  sendMessage: async (message, categoryId, modelId, settings) => {
    const response = await apiClient.post('/api/chat', {
      message,
      category_id: categoryId,
      model_id: modelId,
      settings
    });
    return response.data;
  },
  
  getChatHistory: async () => {
    const response = await apiClient.get('/api/chat/history');
    return response.data;
  }
};
```

### Document Service
```javascript
export const documentService = {
  uploadFile: async (file, categoryId, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category_id', categoryId);
    
    const response = await apiClient.post('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress?.(progress);
      }
    });
    return response.data;
  },
  
  getDocuments: async () => {
    const response = await apiClient.get('/api/documents');
    return response.data;
  },
  
  deleteDocument: async (docId) => {
    const response = await apiClient.delete(`/api/documents/${docId}`);
    return response.data;
  }
};
```

### Bedrock Service
```javascript
export const bedrockService = {
  getModels: async () => {
    const response = await apiClient.get('/api/bedrock/models');
    return response.data.models;
  },
  
  checkHealth: async () => {
    const response = await apiClient.get('/api/bedrock/health');
    return response.data;
  }
};
```

## 🎭 상태 관리 패턴

### Local State Management
각 컴포넌트는 React의 `useState`와 `useEffect`를 활용한 로컬 상태 관리:

```javascript
function ChatPage() {
  // 채팅 관련 상태
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // 모델 및 설정 상태  
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [models, setModels] = useState([]);
  
  // 카테고리 및 문서 상태
  const [categories, setCategories] = useState([]);
}
```

### Props Drilling Pattern
부모-자식 컴포넌트 간 상태 및 콜백 전달:

```javascript
// App.js
<Header activeTab={activeTab} setActiveTab={setActiveTab} />

// ChatPage.js
<CategoryList 
  categories={categories}
  selectedCategory={selectedCategory}
  onCategorySelect={setSelectedCategory}
/>
<ModelSelector
  selectedModel={selectedModel}
  onModelChange={setSelectedModel}
/>
```

## 🐳 Docker 배포

### Dockerfile (멀티스테이지 빌드)
```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Stage 2: Production
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY default.conf.template /etc/nginx/templates/
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
```

### 환경 변수 설정
```bash
# .env.local
REACT_APP_API_BASE_URL=http://localhost:5000
REACT_APP_VERSION=1.0.0
REACT_APP_BUILD_TIME=2025-01-15T10:30:00Z
```

### 환경별 배포 설정
```bash
# 개발 환경
BACKEND_HOST=localhost
BACKEND_PORT=5000
BACKEND_PROTOCOL=http

# 운영 환경  
BACKEND_HOST=api.beacon.sk-shieldus.com
BACKEND_PORT=443
BACKEND_PROTOCOL=https
```

---

**Built With**: React 18.2.0 + Create React App 5.0.1  
**UI Framework**: FontAwesome Icons + Custom CSS  
**HTTP Client**: Axios  
**Build Tool**: Webpack (via CRA)  
**Container**: Docker + Nginx  
**Last Updated**: 2025-01-15