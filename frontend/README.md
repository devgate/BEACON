# 🎨 BEACON Frontend (React)

Modern React-based frontend for the BEACON RAG system

## 📁 구조

```
frontend/
├── src/                 # React 소스 코드
│   ├── components/     # 재사용 가능한 컴포넌트
│   ├── pages/         # 페이지 컴포넌트
│   ├── services/      # API 서비스
│   └── App.js         # 메인 앱 컴포넌트
├── public/             # 정적 파일
│   └── index.html     # HTML 템플릿
├── static/             # 레거시 정적 파일 (백업)
├── package.json        # Node.js 의존성
├── Dockerfile         # 멀티스테이지 프로덕션 빌드
├── Dockerfile.dev     # 개발용 빌드
├── default.conf.template # nginx 설정 템플릿 (환경별 프로토콜 지원)
└── docker-entrypoint.sh  # 컨테이너 시작 스크립트 (환경 변수 처리)
```

## 🚀 개발

### 로컬 개발 서버 (React)
```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 시작
npm start
# 또는
./start-dev.sh

# 접속: http://localhost:3000
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

## 🎯 주요 기능

- **Modern React**: Hooks, 함수형 컴포넌트, React 18
- **반응형 디자인**: 모바일 우선 설계
- **AI 문서 분석**: 실시간 채팅 및 PDF 문서 검색
- **카테고리별 문서 관리**: 임베딩 모델 설정, 청킹 전략
- **사이드바 스크롤링**: RAG Manager에서 통계 정보 완전 표시 가능
- **향상된 UX**: 툴팁, 시각적 피드백, 직관적인 인터페이스
- **컴포넌트 기반**: 재사용 가능한 UI 컴포넌트
- **실시간 업데이트**: React state 기반 UI 업데이트
- **FontAwesome 아이콘**: 전문적인 아이콘 시스템
- **API 통합**: Axios 기반 백엔드 통신
- **환경별 최적화**: 로컬/AWS 환경 자동 감지 및 설정
- **Docker 지원**: Multi-stage 빌드, 보안 강화, 환경 변수 기반 설정

## 🔧 환경 변수

### 개발 환경
- `REACT_APP_API_URL`: API 서버 주소 (기본값: http://localhost:5001/api)
- `REACT_APP_ENV`: 환경 설정 (development/production)
- `REACT_APP_DEBUG`: 디버그 모드 활성화

### Docker 환경
- `BACKEND_HOST`: 백엔드 서버 주소 (기본값: beacon-backend)
- `BACKEND_PORT`: 백엔드 포트 (기본값: 5000)
- `BACKEND_PROTOCOL`: 백엔드 프로토콜 (기본값: http)
  - **로컬**: `http` (Docker Compose 자동 설정)
  - **AWS**: `https` (배포 스크립트 자동 설정)

### 환경별 자동 설정
| 환경 | BACKEND_HOST | BACKEND_PORT | BACKEND_PROTOCOL |
|------|--------------|--------------|------------------|
| 로컬 Docker Compose | beacon-backend | 5000 | http |
| AWS 프로덕션 | api.beacon.sk-shieldus.com | 443 | https |

### nginx 설정 확인
```bash
# 컨테이너에서 생성된 nginx 설정 확인
docker exec beacon-frontend cat /etc/nginx/conf.d/default.conf

# 환경 변수 처리 로그 확인
docker logs beacon-frontend | head -5
```

## 📖 관련 문서

- [배포 가이드](../deploy/DEPLOYMENT-GUIDE.md)
- [인프라 설정](../infra/README.md)
- [백엔드 API](../backend/README.md)