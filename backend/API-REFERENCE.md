# Beacon API 레퍼런스 & 프론트엔드 가이드

## 🌐 API 엔드포인트

### 기본 URL
- **운영환경**: `https://api.beacon.sk-shieldus.com`
- **개발환경**: `https://dev-api.beacon.sk-shieldus.com`

### 인증
- **타입**: 없음 (데모용 공개 API)
- **CORS**: 크로스 오리진 요청 허용
- **프로토콜**: HTTPS만 허용

---

## 📡 백엔드 API 엔드포인트

### 날씨 정보 API (헬스체크)
```http
GET /api/weather
```

**목적**: 시스템 헬스체크 및 로드밸런서 상태 확인

**응답 예시**:
```json
{
  "temperature": "3°C",
  "location": "안양시 동구",
  "condition": "흐림",
  "range": "5°C/-1°C"
}
```

**응답 코드**:
- `200 OK`: 서비스 정상
- `503 Service Unavailable`: 서비스 이상

---

### 문서 목록 조회
```http
GET /api/documents
```

**목적**: 업로드된 모든 문서 목록 반환

**응답 예시**:
```json
[
  {
    "id": 1,
    "title": "sample.pdf",
    "content": "추출된 PDF 텍스트 내용...",
    "type": "uploaded",
    "category_id": 4,
    "images": [
      {
        "page": 1,
        "filename": "page_1.png",
        "url": "/static/images/doc_1/page_1.png"
      }
    ]
  }
]
```

---

### 카테고리 관리
```http
GET /api/categories
POST /api/categories
```

#### GET /api/categories
**목적**: 문서 카테고리 목록 조회

**응답 예시**:
```json
[
  {
    "id": 1,
    "name": "재무",
    "description": "재무 관련 문서",
    "icon": "fas fa-calculator",
    "color": "#10B981",
    "document_count": 3,
    "settings": {
      "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
      "chunk_size": 512,
      "chunk_overlap": 50,
      "chunk_strategy": "sentence"
    }
  }
]
```

#### POST /api/categories
**목적**: 새 카테고리 생성

**요청 본문**:
```json
{
  "name": "신규 카테고리",
  "description": "카테고리 설명",
  "icon": "fas fa-folder",
  "color": "#6B7280"
}
```

**응답 코드**:
- `200 OK`: 카테고리 생성 성공
- `400 Bad Request`: 잘못된 요청 데이터

---

### AI 채팅
```http
POST /api/chat
```

**목적**: 업로드된 문서 기반 AI 질의응답 (AWS Bedrock RAG 사용)

**요청 본문**:
```json
{
  "message": "재무 현황이 어떻게 되나요?",
  "category_id": 1,
  "model_id": "anthropic.claude-3-haiku-20240307-v1:0",
  "settings": {
    "temperature": 0.7,
    "max_tokens": 2048,
    "use_rag": true,
    "top_k_documents": 5
  }
}
```

**응답 예시**:
```json
{
  "response": "재무 문서를 분석한 결과입니다...",
  "model_used": "anthropic.claude-3-haiku-20240307-v1:0",
  "timestamp": "2025-08-06T01:15:23.123456",
  "tokens_used": {
    "input_tokens": 512,
    "output_tokens": 256,
    "total_tokens": 768
  },
  "cost_estimate": {
    "input_cost": 0.000128,
    "output_cost": 0.00032,
    "total": 0.000448
  },
  "confidence_score": 0.92,
  "processing_time": 2.5,
  "images": [
    {
      "page": 1,
      "url": "/static/images/doc_1/page_1.png"
    }
  ],
  "referenced_docs": [
    {
      "id": 1,
      "title": "financial_report.pdf",
      "has_file": true,
      "relevance_score": 0.95,
      "chunk_index": 3
    }
  ],
  "rag_enabled": true
}
```

---

### 파일 업로드
```http
POST /api/upload
```

**목적**: PDF 문서 업로드, 텍스트 추출 및 RAG 처리

**요청 형식**: `multipart/form-data`
- `file`: PDF 파일
- `category_id`: 카테고리 ID (선택사항, 기본값: 4)

**응답 예시**:
```json
{
  "success": true,
  "message": "document.pdf 파일이 성공적으로 업로드되었습니다.",
  "document": {
    "id": 1,
    "title": "document.pdf",
    "preview": "문서 내용 미리보기..."
  },
  "rag_enabled": true,
  "processing": {
    "chunks_created": 15,
    "embeddings_generated": 15,
    "processing_time": 3.2,
    "total_tokens": 4500
  }
}
```

---

### 채팅 기록
```http
GET /api/chat/history
```

**목적**: 사용자와 AI 간의 대화 내역 조회

**응답 예시**:
```json
[
  {
    "timestamp": "2025-08-06T01:15:23.456789",
    "user_message": "이 문서의 주요 내용은 무엇인가요?",
    "ai_response": "문서 분석 결과..."
  }
]
```

---

### 파일 다운로드
```http
GET /api/download/{doc_id}
```

**목적**: 업로드된 PDF 파일 다운로드

**URL 파라미터**:
- `doc_id`: 문서 ID

**응답**: PDF 파일 바이너리

---

### 문서 삭제
```http
DELETE /api/documents/{doc_id}
```

**목적**: 업로드된 문서 및 관련 파일 삭제

**응답 예시**:
```json
{
  "success": true,
  "message": "문서 'document.pdf'가 삭제되었습니다."
}
```

---

### Bedrock 모델 목록
```http
GET /api/bedrock/models
```

**목적**: 사용 가능한 Bedrock 모델 목록 조회 (Cross-Region Inference Profiles 포함)

**응답 예시**:
```json
{
  "models": [
    {
      "model_id": "anthropic.claude-3-haiku-20240307-v1:0",
      "provider": "anthropic",
      "name": "Claude 3 Haiku",
      "description": "Fast, affordable AI model",
      "input_modalities": ["TEXT"],
      "output_modalities": ["TEXT"],
      "max_tokens": 4096,
      "supports_streaming": true,
      "supports_system_prompt": true,
      "cost_per_1k_input_tokens": 0.00025,
      "cost_per_1k_output_tokens": 0.00125,
      "status": "ACTIVE"
    }
  ],
  "total_count": 12,
  "inference_profiles_included": true
}
```

---

### Bedrock 헬스체크
```http
GET /api/bedrock/health
```

**목적**: Bedrock 및 RAG 시스템 상태 확인

**응답 예시**:
```json
{
  "status": "healthy",
  "rag_enabled": true,
  "details": {
    "status": "healthy",
    "bedrock_available": true,
    "vector_store_connected": true,
    "models_count": 12
  }
}
```

---

### 임베딩 모델 목록 (Legacy)
```http
GET /api/embedding-models
```

**목적**: 사용 가능한 임베딩 모델 목록 조회 (Bedrock Titan Embeddings 포함)

**응답 예시**:
```json
[
  {
    "id": "amazon.titan-embed-text-v1",
    "name": "Titan Text Embeddings v1",
    "description": "Amazon's high-quality text embedding model",
    "language": "multilingual",
    "dimension": 1536,
    "provider": "amazon"
  }
]
```

---

## 🎨 프론트엔드 애플리케이션

### 기본 URL
- **운영환경**: `https://beacon.sk-shieldus.com`
- **개발환경**: `https://dev-beacon.sk-shieldus.com`

### 주요 기능

#### 인터랙티브 대시보드
- **실시간 시계**: 한국 시간대 표시
- **시스템 상태**: 환경 및 배포 정보
- **API 테스팅**: 인터랙티브 백엔드 연결 테스트

#### 헬스체크 엔드포인트
```http
GET /health
```

**응답**: 
```
healthy
```

**사용 목적**: 로드밸런서 헬스체크

---

## 🔧 프론트엔드 JavaScript API

### 백엔드 연결 테스트
```javascript
function testBackend() {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "<p>🔄 백엔드 테스트 중...</p>";
  
  fetch("https://api.beacon.sk-shieldus.com/api/weather")
    .then(response => response.json())
    .then(data => {
      resultDiv.innerHTML = `
        <p style="color: #28a745;">✅ 백엔드 연결 성공!</p>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      `;
    })
    .catch(err => {
      resultDiv.innerHTML = `
        <p style="color: #dc3545;">❌ 백엔드 연결 실패: ${err.message}</p>
      `;
    });
}
```

### 헬스체크 테스트
```javascript
function testHealth() {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "<p>🔄 헬스체크 테스트 중...</p>";
  
  fetch("/health")
    .then(response => response.text())
    .then(data => {
      resultDiv.innerHTML = `
        <p style="color: #28a745;">✅ 헬스체크 성공: ${data}</p>
      `;
    })
    .catch(err => {
      resultDiv.innerHTML = `
        <p style="color: #dc3545;">❌ 헬스체크 실패: ${err.message}</p>
      `;
    });
}
```

---

## 🚀 통합 예제

### cURL 예제

#### 헬스체크 (날씨 API)
```bash
curl -X GET https://api.beacon.sk-shieldus.com/api/weather \
  -H "Accept: application/json"
```

#### 파일 업로드
```bash
curl -X POST https://api.beacon.sk-shieldus.com/api/upload \
  -F "file=@document.pdf" \
  -F "category_id=1"
```

#### AI 채팅
```bash
curl -X POST https://api.beacon.sk-shieldus.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "이 문서의 주요 내용은 무엇인가요?",
    "category_id": 1
  }'
```

### Python Integration
```python
import requests
import json

# Backend API client
class BeaconAPI:
    def __init__(self, base_url="https://api.beacon.sk-shieldus.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
    
    def health_check(self):
        """Check API health status"""
        response = self.session.get(f"{self.base_url}/api/health")
        response.raise_for_status()
        return response.json()
    
    def get_data(self):
        """Retrieve sample data"""
        response = self.session.get(f"{self.base_url}/api/data")
        response.raise_for_status()
        return response.json()
    
    def post_data(self, data):
        """Submit data to API"""
        response = self.session.post(
            f"{self.base_url}/api/data", 
            json=data
        )
        response.raise_for_status()
        return response.json()

# Usage example
api = BeaconAPI()

# Health check
health = api.health_check()
print(f"API Status: {health['status']}")

# Data operations
sample_data = api.get_data()
print(f"Retrieved {sample_data['total']} items")

# Submit data
result = api.post_data({
    "name": "Python Client",
    "value": 999,
    "timestamp": "2025-08-06T01:30:00Z"
})
print(f"Submission result: {result['message']}")
```

### JavaScript Integration
```javascript
// Frontend API client
class BeaconAPI {
  constructor(baseUrl = 'https://api.beacon.sk-shieldus.com') {
    this.baseUrl = baseUrl;
  }
  
  async healthCheck() {
    const response = await fetch(`${this.baseUrl}/api/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  
  async getData() {
    const response = await fetch(`${this.baseUrl}/api/data`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  
  async postData(data) {
    const response = await fetch(`${this.baseUrl}/api/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
}

// Usage example
const api = new BeaconAPI();

// Health check with error handling
api.healthCheck()
  .then(health => console.log('API Status:', health.status))
  .catch(err => console.error('Health check failed:', err));

// Data retrieval
api.getData()
  .then(data => console.log('Retrieved data:', data.data))
  .catch(err => console.error('Data retrieval failed:', err));

// Data submission
api.postData({
  name: 'JavaScript Client',
  value: 777,
  timestamp: new Date().toISOString()
})
  .then(result => console.log('Submission result:', result.message))
  .catch(err => console.error('Data submission failed:', err));
```

---

## 🔒 Error Handling

### Standard Error Responses

#### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "The requested endpoint does not exist",
  "timestamp": "2025-08-06T01:15:23.123456"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal Server Error", 
  "message": "An internal server error occurred",
  "timestamp": "2025-08-06T01:15:23.123456"
}
```

### Client-Side Error Handling
```javascript
// Comprehensive error handling
async function apiCall(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      ...options
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`${response.status}: ${errorData.message || 'Unknown error'}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    
    // Network/connectivity errors
    if (error.name === 'TypeError') {
      throw new Error('Network error - check your connection');
    }
    
    // API errors
    throw error;
  }
}

// Usage with error handling
apiCall('https://api.beacon.sk-shieldus.com/api/health')
  .then(data => console.log('Success:', data))
  .catch(error => console.error('Failed:', error.message));
```

---

## 📊 Response Headers

### Standard Headers
```http
Content-Type: application/json
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Accept
Server: Werkzeug/2.3.7 Python/3.9.23
```

### CORS Configuration
```python
# Backend CORS setup
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enables cross-origin requests

# Allows requests from:
# - https://beacon.sk-shieldus.com
# - Any other origin (configured for demo)
```

---

## 🧪 Testing & Validation

### API Testing Script
```bash
#!/bin/bash
# beacon-api-test.sh

BASE_URL="https://api.beacon.sk-shieldus.com"

echo "🧪 Beacon API Test Suite"
echo "========================"

# Test 1: Health Check
echo "1. Testing health endpoint..."
curl -s -w "\nHTTP Status: %{http_code}\n" "$BASE_URL/api/health" | head -5
echo ""

# Test 2: System Info
echo "2. Testing info endpoint..."
curl -s -w "\nHTTP Status: %{http_code}\n" "$BASE_URL/api/info" | head -5
echo ""

# Test 3: Data Retrieval
echo "3. Testing data retrieval..."
curl -s -w "\nHTTP Status: %{http_code}\n" "$BASE_URL/api/data" | head -5
echo ""

# Test 4: Data Submission
echo "4. Testing data submission..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","value":123}' \
  -w "\nHTTP Status: %{http_code}\n" \
  "$BASE_URL/api/data" | head -5
echo ""

# Test 5: Frontend Health
echo "5. Testing frontend health..."
curl -s -w "\nHTTP Status: %{http_code}\n" "https://beacon.sk-shieldus.com/health"
echo ""

echo "✅ Test suite completed"
```

### Frontend Testing
```javascript
// Frontend test suite
async function runTestSuite() {
  const tests = [
    {
      name: 'Backend Health Check',
      test: () => fetch('https://api.beacon.sk-shieldus.com/api/health')
    },
    {
      name: 'Frontend Health Check',
      test: () => fetch('/health')
    },
    {
      name: 'API Info Endpoint',
      test: () => fetch('https://api.beacon.sk-shieldus.com/api/info')
    },
    {
      name: 'Data Retrieval',
      test: () => fetch('https://api.beacon.sk-shieldus.com/api/data')
    }
  ];
  
  console.log('🧪 Running Frontend Test Suite');
  
  for (const test of tests) {
    try {
      const response = await test.test();
      console.log(`✅ ${test.name}: ${response.ok ? 'PASS' : 'FAIL'} (${response.status})`);
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
    }
  }
}

// Run tests
runTestSuite();
```

---

**API Version**: 1.0  
**Last Updated**: August 2025  
**Backend Framework**: Flask 2.3.3  
**Frontend**: Nginx + Vanilla JavaScript