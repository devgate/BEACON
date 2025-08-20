# BEACON Vision API 테스트 환경 사용 가이드

BEACON에 추가된 비전 API 테스트 환경을 사용하여 PDF 이미지 추출과 그래프 기반 RAG 시스템을 테스트할 수 있습니다.

## 🚀 빠른 시작

### 1. 환경 설정

#### OpenAI API 키 설정
```bash
export OPENAI_API_KEY="your_openai_api_key_here"
```

또는 배포 시점에 대화형으로 입력할 수 있습니다.

### 2. BEACON 실행
```bash
cd /path/to/BEACON/deploy/dev/local
./deploy.sh start
```

배포 스크립트 실행 시:
1. AWS 자격증명 확인/입력
2. OpenAI API 키 확인/입력 (선택사항)
3. 자동으로 환경 변수 설정
4. Docker 컨테이너 시작

### 3. 웹 인터페이스 접속
- **메인 애플리케이션**: http://localhost:3000
- **Vision Test 페이지**: http://localhost:3000 (상단 "Vision Test" 탭)
- **백엔드 API**: http://localhost:5000

## 🎯 주요 기능

### 1. PDF 이미지 추출
- PDF 파일 업로드
- PyMuPDF를 이용한 이미지 자동 추출
- 이미지 메타데이터 표시 (크기, 페이지, 포맷)

### 2. 비전 AI 분석 
- OpenAI GPT-4 Vision을 이용한 이미지 분석
- 엔티티 자동 추출 (인물, 객체, 다이어그램, 텍스트 등)
- 관계 매핑 (엔티티 간 연결관계)
- 공간정보 분석

### 3. 그래프 구조 생성
- 이미지와 텍스트를 통합한 지식 그래프 생성
- 노드(엔티티)와 엣지(관계) 구조화
- JSON 형태의 그래프 데이터 출력

## 🔧 API 엔드포인트

### Vision API 엔드포인트
```bash
# 서비스 상태 확인
GET /api/vision/health

# 설정 정보 조회
GET /api/vision/config

# PDF 파일 업로드
POST /api/vision/upload
Content-Type: multipart/form-data
Body: file (PDF 파일)

# 이미지 추출만 수행
POST /api/vision/extract-images
Content-Type: application/json
Body: {"filename": "업로드된파일명.pdf"}

# 전체 비전 분석
POST /api/vision/analyze  
Content-Type: application/json
Body: {
  "filename": "업로드된파일명.pdf",
  "options": {
    "extract_text": true,
    "extract_images": true,
    "analyze_images": true
  }
}

# 그래프 검색 (향후 확장)
POST /api/vision/graph-search
Content-Type: application/json
Body: {
  "filename": "분석된파일명.pdf",
  "query": "검색어",
  "options": {
    "include_images": true,
    "max_results": 10
  }
}
```

## 📋 테스트 시나리오

### 시나리오 1: 기본 이미지 추출
1. Vision Test 페이지 접속
2. PDF 파일 선택 (16MB 이하)
3. "Upload File" 버튼 클릭
4. "Extract Images Only" 버튼 클릭
5. 추출된 이미지 정보 확인

### 시나리오 2: 전체 비전 분석
1. 위와 같이 파일 업로드
2. "Full Vision Analysis" 버튼 클릭 (OpenAI API 키 필요)
3. 분석 결과 확인:
   - 발견된 엔티티 목록
   - 엔티티 간 관계
   - 그래프 데이터 구조

### 시나리오 3: API 직접 호출
```bash
# 1. 파일 업로드
curl -X POST http://localhost:5000/api/vision/upload \
  -F "file=@sample.pdf"

# 2. 비전 분석
curl -X POST http://localhost:5000/api/vision/analyze \
  -H "Content-Type: application/json" \
  -d '{"filename": "20241220_123456_sample.pdf"}'
```

## 🔍 결과 해석

### 엔티티 유형
- **person**: 인물, 사람
- **object**: 물리적 객체
- **diagram**: 도표, 다이어그램
- **text**: 텍스트 영역
- **chart**: 차트, 그래프
- **table**: 테이블, 표

### 관계 유형  
- **contains**: 포함 관계
- **related_to**: 일반적 연관성
- **appears_with**: 함께 나타남
- **points_to**: 지시/참조 관계

### 그래프 데이터 구조
```json
{
  "nodes": [
    {
      "id": "entity_1",
      "label": "System Architecture", 
      "type": "diagram",
      "description": "메인 시스템 아키텍처 다이어그램",
      "confidence": 0.95,
      "source": "vision"
    }
  ],
  "edges": [
    {
      "source": "entity_1",
      "target": "entity_2", 
      "type": "contains",
      "description": "다이어그램에 데이터베이스 컴포넌트 포함",
      "confidence": 0.87
    }
  ]
}
```

## ⚠️ 주의사항

### 파일 제한
- **포맷**: PDF만 지원
- **크기**: 16MB 이하
- **보안**: 민감한 문서 업로드 주의

### API 키 요구사항
- **이미지 추출**: API 키 불필요
- **비전 분석**: OpenAI API 키 필수
- **대안**: AWS Bedrock도 지원 (향후 확장)

### 성능 고려사항
- **이미지 크기**: 큰 이미지일수록 처리 시간 증가
- **API 요청**: OpenAI API 호출당 비용 발생
- **동시 처리**: 하나씩 순차 처리 권장

## 🔧 문제 해결

### 업로드 실패
```bash
# 로그 확인
docker-compose logs backend

# 업로드 폴더 권한 확인  
ls -la backend/uploads/
```

### 비전 분석 실패
1. OpenAI API 키 확인
2. API 키 유효성 검증
3. 네트워크 연결 상태 확인
4. Docker 컨테이너 재시작

### 환경 초기화
```bash
# 전체 서비스 정리
./deploy.sh clean

# 환경 재설정
./deploy.sh setup

# 서비스 재시작
./deploy.sh start
```

## 🚀 향후 확장 계획

### LightRAG 스타일 구현
1. **텍스트-이미지 통합**: 문서의 텍스트와 이미지를 통합한 지식 그래프
2. **의미적 검색**: 그래프 기반 semantic search 
3. **다중모달 RAG**: 텍스트와 이미지 정보를 모두 활용한 답변 생성
4. **관계 추론**: 엔티티 간 암시적 관계 추론

### 추가 기능
1. **그래프 시각화**: 웹 기반 그래프 뷰어
2. **배치 처리**: 여러 PDF 동시 처리
3. **모델 선택**: GPT-4, Claude, Gemini 선택 지원
4. **벡터 DB 통합**: ChromaDB, PostgreSQL 벡터 저장

## 📞 지원

문제 발생시 다음을 확인하세요:
1. Docker 상태: `docker-compose ps`
2. 서비스 로그: `./deploy.sh logs`
3. API 상태: `curl http://localhost:5000/api/vision/health`

이제 BEACON Vision Test 환경에서 PDF 문서의 이미지를 분석하고 그래프 기반 RAG 시스템을 테스트해보세요!