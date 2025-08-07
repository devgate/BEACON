# BEACON RAG System - Infrastructure & Deployment

BEACON AI 문서 분석 시스템을 위한 완전한 AWS 클라우드 인프라와 Docker 기반 배포 시스템.

## 📋 개요

BEACON은 AWS Bedrock 기반 RAG(Retrieval-Augmented Generation) 기술을 활용한 AI 문서 분석 시스템으로, PDF 문서를 업로드하여 지능형 질의응답을 제공합니다. React 프론트엔드, Flask 백엔드, DynamoDB 벡터 스토어, AWS Bedrock AI 모델로 구성되며, AWS 클라우드에 완전히 자동화된 배포가 가능합니다.

## 🏗️ 시스템 아키텍처

### 운영 환경 (AWS)
```
Internet
    ↓
Route53 DNS
    ↓
CloudFront (Optional) 
    ↓
Application Load Balancer (HTTPS)
    ↓
┌─────────────────┬─────────────────┐
│   Frontend EC2  │   Backend EC2   │
│   nginx:80      │   Flask:5000    │
│   React SPA     │   Python API    │
└─────────────────┴────────┬────────┘
                          ↓
              ┌───────────┴───────────┐
              │     DynamoDB          │
              │   Vector Store        │
              └───────────┬───────────┘
                          ↓
              ┌───────────┴───────────┐
              │    AWS Bedrock        │
              │  Claude, Llama, Titan │
              └───────────────────────┘
```

### 로컬 개발
```
Docker Compose
├── beacon-frontend:3000 (React Dev Server)
└── beacon-backend:5001 (Flask API + Mock AI)
```

## 🚀 빠른 시작 가이드

### 1. 로컬 개발 환경

```bash
# 전체 스택 로컬 테스트 (dev 디렉터리에서)
cd deploy/dev
docker-compose -f docker-compose.test.yml up --build

# 접속 확인
# Frontend: http://localhost:3000
# Backend API: http://localhost:5001/api/weather
```

### 2. Docker 이미지 빌드

```bash
# Frontend 이미지 빌드 및 Docker Hub 업로드
cd frontend
./build.sh latest
cd ..

# Backend 이미지 빌드 및 Docker Hub 업로드  
cd backend
./build.sh latest
cd ..
```

### 3. AWS 인프라 배포

```bash
cd infra/terraform

# Terraform 초기화
terraform init

# 배포 계획 확인
terraform plan

# 인프라 배포
terraform apply
```

### 4. 간편 배포 스크립트

```bash
cd deploy/prd

# 전체 배포 (빌드 + 인프라)
./deploy-full.sh latest

# 프론트엔드만 배포
./deploy-frontend.sh latest

# 백엔드만 배포
./deploy-backend.sh latest
```

## 📁 프로젝트 구조

```
terraform-test/
├── frontend/                    # React 프론트엔드
│   ├── src/                    # React 소스 코드
│   ├── public/                 # 정적 파일
│   ├── Dockerfile              # 멀티스테이지 빌드
│   ├── default.conf.template   # nginx 설정 템플릿
│   ├── docker-entrypoint.sh    # 컨테이너 시작 스크립트
│   └── build.sh               # Docker 빌드 스크립트
├── backend/                    # Flask 백엔드
│   ├── app.py                 # Flask API 서버
│   ├── bedrock_service.py     # AWS Bedrock 통합
│   ├── vector_store.py        # DynamoDB 벡터 스토어
│   ├── rag_engine.py          # RAG 처리 엔진
│   ├── uploads/               # PDF 업로드 폴더
│   ├── static/images/         # 추출된 PDF 이미지
│   ├── Dockerfile             # Python 컨테이너 빌드
│   ├── requirements.txt       # Python 의존성
│   └── build.sh              # Docker 빌드 스크립트
├── infra/                     # AWS 인프라
│   └── terraform/             # Terraform IaC
│       ├── main.tf           # 메인 설정 파일
│       ├── variables.tf      # 환경 변수 정의
│       ├── outputs.tf        # 출력 정보
│       ├── terraform.tfvars  # 환경 설정 값
│       └── modules/          # 모듈화된 인프라
│           ├── common/       # VPC, DNS, SSL 인증서
│           ├── frontend/     # Frontend ALB, EC2, 보안그룹
│           └── backend/      # Backend ALB, EC2, 보안그룹
└── deploy/                    # 배포 자동화
    ├── dev/                  # 개발 환경
    └── prd/                  # 운영 환경
        ├── deploy-full.sh    # 전체 스택 배포
        ├── deploy-frontend.sh # 프론트엔드 배포  
        └── deploy-backend.sh  # 백엔드 배포
```

## 🐳 Docker 설정

### Docker Hub 리포지토리
- **Frontend**: `sksda4614/beacon-frontend`
- **Backend**: `sksda4614/beacon-backend`

### 환경 변수 설정
```bash
export DOCKER_USERNAME=sksda4614
export DOCKER_PASSWORD=your-dockerhub-token

# 또는 로그인
docker login
```

## 🌐 AWS 인프라 상세

### 핵심 구성 요소
- **VPC**: 2개 가용영역, 퍼블릭/프라이빗 서브넷
- **ALB**: Application Load Balancer (Frontend/Backend 분리)
- **EC2**: t3.small 인스턴스 (Frontend/Backend)
- **Route53**: DNS 관리 (beacon.sk-shieldus.com, api.beacon.sk-shieldus.com)
- **SSL**: AWS Certificate Manager (와일드카드 인증서)
- **보안그룹**: HTTPS(443), HTTP(80), SSH(22) 허용
- **DynamoDB**: 벡터 스토어 (prod-beacon-vectors 테이블)
- **AWS Bedrock**: Claude 3, Llama 3, Titan 모델 통합
- **IAM**: Bedrock 및 DynamoDB 접근 권한 관리

### 도메인 설정
- **Frontend**: https://beacon.sk-shieldus.com
- **Backend API**: https://api.beacon.sk-shieldus.com
- **Health Check**: `/health` (Frontend), `/api/weather` (Backend)

## 📊 배포 스크립트 사용법

### deploy-full.sh (전체 배포)
```bash
# 전체 배포 (권장)
./deploy-full.sh latest

# 빌드 생략하고 Terraform만
./deploy-full.sh latest true false

# 상태 확인만
./deploy-full.sh latest true true

# 자동 승인 (CI/CD용)
./deploy-full.sh latest false false true
```

### deploy-frontend.sh (프론트엔드만)
```bash
# 전체 자동 배포 (빌드 + Terraform + EC2 배포)
./deploy-frontend.sh latest

# 빌드 없이 자동 배포
./deploy-frontend.sh latest true

# Terraform 없이 자동 배포 (Docker 이미지만 배포)
./deploy-frontend.sh latest false true

# 상태 확인만 (자동 배포 비활성화)
./deploy-frontend.sh latest true true false

# 수동 배포 모드 (SSH 명령어만 출력)
./deploy-frontend.sh latest true true false
```

#### 새로운 자동화 기능
- **자동 인스턴스 검색**: Terraform output 실패 시 AWS CLI로 자동 fallback
- **완전 자동 배포**: SSH 연결, Docker pull, 컨테이너 교체, 헬스체크 자동화
- **환경별 설정**: AWS는 HTTPS, 로컬은 HTTP 백엔드 자동 설정
- **실시간 로그**: 배포 과정의 모든 단계를 실시간 모니터링

### deploy-backend.sh (백엔드만)
```bash
# 전체 백엔드 배포
./deploy-backend.sh latest

# 빌드 생략
./deploy-backend.sh latest true

# Terraform 생략
./deploy-backend.sh latest false true

# 상태 확인만
./deploy-backend.sh latest true true
```

## ✨ 주요 기능

### 🤖 AI 문서 분석 (AWS Bedrock RAG)
- **PDF 업로드**: 멀티파일 업로드 지원
- **텍스트 추출**: PyPDF2 기반 텍스트 파싱
- **벡터 임베딩**: Titan Embeddings로 문서 벡터화
- **이미지 추출**: pdf2image로 페이지별 이미지 생성
- **카테고리 분류**: 재무, 맛집, 매뉴얼, 일반 4개 카테고리
- **청킹 전략**: 카테고리별 최적화된 문서 분할

### 💬 지능형 채팅 시스템
- **RAG 기반 검색**: DynamoDB 벡터 스토어 활용 시맨틱 검색
- **다중 AI 모델**: Claude 3 (Haiku, Sonnet, Opus), Llama 3, Titan 선택 가능
- **비용 추적**: 토큰 사용량 및 비용 실시간 계산
- **신뢰도 점수**: 응답 관련성 점수 제공
- **카테고리별 응답**: 카테고리 특화 AI 응답
- **실시간 채팅**: 실시간 대화 인터페이스
- **이미지 참조**: 관련 문서 이미지 함께 표시

### 🎨 React 프론트엔드
- **모던 UI/UX**: 사용자 친화적인 인터페이스 디자인
- **컴포넌트 기반**: 재사용 가능한 React 컴포넌트
- **반응형 디자인**: 모바일 및 데스크톱 최적화
- **실시간 업데이트**: 파일 업로드 진행 상황 표시
- **사이드바 스크롤링**: RAG Manager에서 통계 섹션 스크롤 기능
- **향상된 UX**: 툴팁 및 시각적 피드백 제공

### ⚙️ Flask 백엔드 API
- **RESTful API**: 표준 HTTP 메서드 지원
- **CORS 설정**: 크로스 오리진 요청 처리
- **파일 처리**: 안전한 파일 업로드 및 검증
- **에러 핸들링**: 포괄적 예외 처리
- **환경별 최적화**: 로컬/AWS 환경 자동 감지 및 설정

## 🔧 운영 관리

### 로그 확인
```bash
# Frontend 컨테이너 로그
ssh ec2-user@<frontend-ip> 'docker logs beacon-frontend'

# Backend 컨테이너 로그  
ssh ec2-user@<backend-ip> 'docker logs beacon-backend'

# 실시간 로그 모니터링
ssh ec2-user@<instance-ip> 'docker logs -f beacon-frontend'
```

### 컨테이너 관리
```bash
# 컨테이너 재시작
ssh ec2-user@<instance-ip> 'docker restart beacon-frontend'

# 이미지 업데이트
ssh ec2-user@<instance-ip> 'docker pull sksda4614/beacon-frontend:latest && docker restart beacon-frontend'

# 컨테이너 상태 확인
ssh ec2-user@<instance-ip> 'docker ps -a'
```

### 헬스 체크
```bash
# Frontend 헬스 체크
curl -k https://beacon.sk-shieldus.com/health

# Backend API 헬스 체크
curl -k https://api.beacon.sk-shieldus.com/api/weather

# 카테고리 API 테스트
curl -k https://beacon.sk-shieldus.com/api/categories
```

## 🚨 트러블슈팅

### 일반적인 문제들

1. **502 Bad Gateway 에러 (로컬 환경)**
   - 원인: nginx에서 HTTPS로 백엔드 연결 시도하나 로컬은 HTTP 필요
   - 해결: `BACKEND_PROTOCOL=http` 환경 변수 설정됨 (자동 해결)
   - 확인: `docker logs beacon-frontend` 로그에서 HTTP 연결 확인

2. **카테고리가 하나만 표시되는 경우**
   - nginx 프록시 설정 확인: `default.conf.template`
   - 백엔드 연결 상태 확인: `curl -k https://api.beacon.sk-shieldus.com/api/categories`
   - 환경 변수 확인: `BACKEND_PROTOCOL` 설정 상태

3. **Docker 이미지 빌드 실패**
   - Docker Hub 로그인 상태 확인
   - 네트워크 연결 및 권한 확인
   - 빌드 컨텍스트 크기 확인 (.dockerignore 활용)

4. **자동 배포 실패**
   - SSH 키 설정 확인: EC2 인스턴스 접근 권한
   - AWS CLI 자격 증명 확인
   - 인스턴스 상태 확인: `aws ec2 describe-instances`

5. **Terraform 배포 실패**
   - AWS 자격 증명 확인
   - 도메인 및 SSL 인증서 설정 확인
   - 리소스 한도 및 권한 확인

6. **헬스 체크 실패**
   - ALB 대상 그룹 상태 확인
   - EC2 인스턴스 상태 및 보안 그룹 확인
   - 컨테이너 로그 확인: `docker logs beacon-frontend`

## 📚 추가 리소스

### 관련 문서
- **[infra/README.md](./infra/README.md)**: Terraform 인프라 상세 가이드
- **[frontend/README.md](./frontend/README.md)**: React 프론트엔드 개발 가이드  
- **[backend/README.md](./backend/README.md)**: Flask API 백엔드 가이드
- **[deploy/README.md](./deploy/README.md)**: 배포 환경 및 스크립트 가이드

### 외부 링크
- **Docker Hub Frontend**: https://hub.docker.com/r/sksda4614/beacon-frontend
- **Docker Hub Backend**: https://hub.docker.com/r/sksda4614/beacon-backend
- **운영 사이트**: https://beacon.sk-shieldus.com

## 📝 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다.

---

**마지막 업데이트**: 2025-08-07
**배포 상태**: ✅ 운영 중 (https://beacon.sk-shieldus.com)
**최신 개선사항**: AWS Bedrock RAG 통합, DynamoDB 벡터 스토어, 다중 AI 모델 지원, 비용 추적 기능