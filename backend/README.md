# 🔧 BEACON Backend

Flask 기반 백엔드 API 서버 with AWS Bedrock RAG Integration

## 📁 구조

```
backend/
├── app.py              # Flask 메인 애플리케이션
├── bedrock_service.py  # AWS Bedrock 서비스 통합
├── vector_store.py     # DynamoDB 벡터 스토어
├── rag_engine.py       # RAG 엔진 구현
├── uploads/            # PDF 파일 업로드 디렉토리
├── static/             # 정적 파일 (추출된 이미지)
│   └── images/         # PDF에서 추출된 이미지
├── templates/          # HTML 템플릿
│   └── index.html      # 기본 인덱스 페이지
├── Dockerfile          # Docker 빌드 설정
├── build.sh           # 빌드 스크립트
├── requirements.txt   # Python 의존성
└── API-REFERENCE.md   # API 문서
```

## 🚀 개발

### 로컬 개발 서버
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 로컬 테스트 (Docker Compose)
```bash
cd ../deploy/dev
docker-compose -f docker-compose.test.yml up --build

# 접속
# Backend API: http://localhost:5000
# Health Check: http://localhost:5000/api/weather
```

### Docker 빌드 및 푸시
```bash
cd backend
./build.sh [TAG]
```

## 🌐 배포

### AWS 환경 배포
```bash
# Backend만 배포
cd deploy/dev  # 또는 deploy/prd
./deploy-backend.sh

# 전체 스택 배포
./deploy-full.sh
```

### 개별 컨테이너 실행
```bash
# AWS 환경에서 수동 실행
docker run -d \
  --name beacon-backend \
  -p 5000:5000 \
  -v /app/uploads:/app/uploads \
  sksda4614/beacon-backend:latest
```

## 🎯 주요 기능

- **AWS Bedrock RAG Integration**: Claude, Llama, Titan 등 다양한 AI 모델 활용
- **AI 문서 분석**: PDF 업로드 및 텍스트 추출, 벡터 임베딩 생성
- **카테고리별 문서 관리**: 재무, 맛집, 매뉴얼, 일반 카테고리
- **지능형 채팅**: 업로드된 문서 기반 AI 질의응답 (RAG 기반)
- **벡터 스토어**: DynamoDB 기반 문서 임베딩 저장 및 검색
- **이미지 추출**: PDF 페이지를 이미지로 변환
- **모델 선택**: 다양한 Bedrock 모델 선택 가능
- **비용 추적**: 토큰 사용량 및 비용 실시간 계산
- **RESTful API**: 표준 REST API 구조
- **헬스체크**: `/api/weather` 엔드포인트를 통한 서비스 상태 모니터링
- **CORS 지원**: 크로스 오리진 요청 허용 (localhost:3000, localhost:8080)
- **Docker 지원**: 컨테이너화된 배포
- **Flask Framework**: Python 기반 경량 프레임워크

## 🔧 환경 변수

- `FLASK_ENV`: Flask 실행 환경 (development/production)
- `PORT`: 서버 포트 (기본값: 5000)
- `BEDROCK_REGION`: AWS Bedrock 리전 (기본값: ap-northeast-2)
- `AWS_PROFILE`: AWS 프로파일 (선택사항)
- `DYNAMODB_VECTORS_TABLE`: DynamoDB 벡터 테이블 이름 (기본값: prod-beacon-vectors)

## 📖 관련 문서

- [API 상세 문서](./API-REFERENCE.md)
- [배포 가이드](../deploy/DEPLOYMENT-GUIDE.md)
- [인프라 설정](../infra/README.md)
- [프론트엔드 연동](../frontend/README.md)