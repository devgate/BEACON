# BEACON RAG System - Production Ready AWS Deployment

BEACON AI 문서 분석 시스템의 완전 자동화된 AWS 프로덕션 배포 및 로컬 개발 환경.

## 📋 개요

BEACON은 AWS Bedrock 기반 RAG(Retrieval-Augmented Generation) 기술을 활용한 AI 문서 분석 시스템으로, PDF 문서를 업로드하여 지능형 질의응답을 제공합니다. React 프론트엔드, Flask 백엔드, DynamoDB 벡터 스토어, AWS Bedrock AI 모델로 구성되며, AWS 클라우드에 완전히 자동화된 배포가 가능합니다.

## 🏗️ 시스템 아키텍처

### 운영 환경 (AWS)
```
Internet
    ↓
Route53 DNS (beacon.sk-shieldus.com)
    ↓
Application Load Balancer (HTTPS/443)
    ↓
┌─────────────────┬─────────────────┐
│  Frontend EC2   │   Backend EC2   │
│  (t4g.small)    │  (t4g.small)    │
│  Docker:nginx   │  Docker:Flask   │
│  React SPA:80   │  Python API:80  │
└─────────────────┴────────┬────────┘
                          ↓
              ┌───────────┴───────────┐
              │     AWS Services      │
              ├───────────────────────┤
              │  • ECR (Images)       │
              │  • DynamoDB (Vectors) │
              │  • Bedrock (AI/LLM)  │
              └───────────────────────┘
```

### 로컬 개발 환경
```
Docker Compose (deploy/dev/local/)
├── beacon-frontend:3000 (React + Nginx)
└── beacon-backend:5000 (Flask + AWS Bedrock)
    └── AWS Services
        ├── Bedrock (Claude AI)
        └── DynamoDB (dev tables)
```

## 🚀 빠른 시작 가이드

### 1. 로컬 개발 환경 (초간단 시작)

```bash
# 한 번에 모든 설정 + 실행
cd deploy/dev/local
./deploy.sh start

# 스크립트가 자동으로 처리:
# ✅ AWS 자격증명 감지/입력
# ✅ .env 파일 생성
# ✅ DynamoDB 연결
# ✅ Bedrock AI 연결
# ✅ Docker 컨테이너 시작

# 접속 정보:
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
# Health Check: http://localhost:3000/health
```

**추가 명령어들**:
```bash
./deploy.sh stop      # 서비스 중지
./deploy.sh restart   # 서비스 재시작
./deploy.sh rebuild   # 이미지 재빌드 + 재시작
./deploy.sh logs      # 실시간 로그 보기
./deploy.sh status    # 컨테이너 상태 확인
./deploy.sh clean     # 완전 정리
```

**AWS 자격증명이 없는 경우** 자동으로 입력받습니다:
- 필요 권한: `AmazonBedrockFullAccess`, `DynamoDBFullAccess`
- 컨테이너 준비시간: 30초-1분 (502 오류 정상)

### 2. 프로덕션용 Docker 이미지 빌드

```bash
# Frontend 이미지 빌드 및 ECR 푸시
cd frontend
./build.sh latest  # AWS ECR로 자동 푸시

# Backend 이미지 빌드 및 ECR 푸시  
cd backend
./build.sh latest  # AWS ECR로 자동 푸시
```

### 3. 프로덕션 배포 (AWS)

#### 인프라 배포 (Terraform)
```bash
cd infra/terraform

# Terraform 초기화
terraform init

# 배포 계획 확인
terraform plan

# 인프라 배포
terraform apply
```

#### 애플리케이션 배포 (자동화)
```bash
cd deploy/prod

# 초기 설정 (첫 배포시)
./setup-guide.sh  # AWS CLI, SSH 키, Docker 등 자동 설정

# 전체 배포 (Frontend + Backend)
./deploy.sh all

# 개별 서비스 배포
./deploy.sh frontend  # Frontend만
./deploy.sh backend   # Backend만
./deploy.sh all v1.0.1  # 특정 버전 배포
```

**주요 특징**:
- 🚀 원클릭 배포: ECR 빌드 → EC2 배포 자동화
- 🔒 SSH 키 기반 보안 배포
- 🏗️ ARM64 최적화 (t4g.small 인스턴스)
- ✅ 자동 헬스 체크 및 롤백 지원

## 📁 프로젝트 구조

```
BEACON/
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
│   ├── terraform/             # 운영 환경 Terraform IaC
│   │   ├── main.tf           # 메인 설정 파일
│   │   ├── variables.tf      # 환경 변수 정의
│   │   ├── outputs.tf        # 출력 정보
│   │   ├── terraform.tfvars  # 환경 설정 값
│   │   └── modules/          # 모듈화된 인프라
│   │       ├── common/       # VPC, DNS, SSL 인증서
│   │       ├── frontend/     # Frontend ALB, EC2, 보안그룹
│   │       └── backend/      # Backend ALB, EC2, 보안그룹
│   └── terraform-dev/         # 개발 환경 DynamoDB 테이블
│       ├── main.tf           # dev 테이블 정의
│       └── variables.tf      # 개발환경 변수
└── deploy/                    # 배포 자동화
    ├── dev/                  # 개발 환경
    │   └── local/           # 로컬 Docker Compose 환경
    │       ├── deploy.sh    # 스마트 배포 스크립트 (AWS 자동설정)
    │       ├── docker-compose.yml # 서비스 정의
    │       ├── .env.example # 환경변수 템플릿
    │       └── README.md    # 로컬 개발 가이드
    └── prod/                 # 프로덕션 환경
        ├── deploy.sh         # 통합 배포 스크립트 (ECR + EC2)
        ├── setup-guide.sh    # 초기 환경 설정 스크립트
        └── DEPLOYMENT.md     # 상세 배포 가이드
```

## 🐳 Docker 설정

### Docker 레지스트리
- **개발환경**: 로컬 Docker 이미지 (docker-compose 자동 빌드)
- **프로덕션**: AWS ECR (933851512157.dkr.ecr.ap-northeast-2.amazonaws.com)
  - Frontend: `beacon-frontend:latest`
  - Backend: `beacon-backend:latest`

### ECR 로그인
```bash
# AWS ECR 로그인 (프로덕션 배포시)
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  933851512157.dkr.ecr.ap-northeast-2.amazonaws.com
```

## 🌐 AWS 인프라 상세

### 핵심 구성 요소
- **VPC**: 2개 가용영역, 퍼블릭/프라이빗 서브넷
- **ALB**: Application Load Balancer (Frontend/Backend 분리)
- **EC2**: t4g.small ARM64 인스턴스 (비용 최적화)
- **ECR**: Docker 이미지 레지스트리
- **Route53**: DNS 관리 (beacon.sk-shieldus.com, api.beacon.sk-shieldus.com)
- **SSL**: AWS Certificate Manager (와일드카드 인증서)
- **보안그룹**: HTTPS(443), HTTP(80), SSH(22) 허용
- **DynamoDB**: 벡터 스토어 (prod-beacon-vectors 테이블)
- **AWS Bedrock**: Claude 3, Llama 3, Titan 모델 통합
- **IAM**: EC2 역할, ECR/Bedrock/DynamoDB 권한

### 도메인 설정
- **Frontend**: https://beacon.sk-shieldus.com
- **Backend API**: https://api.beacon.sk-shieldus.com
- **Health Check**: `/health` (Frontend), `/api/weather` (Backend)

## 📊 프로덕션 배포 상세

### 배포 프로세스
1. **ECR 빌드 및 푸시**: Docker 이미지를 AWS ECR에 업로드
2. **인스턴스 정보 조회**: Terraform 상태에서 EC2 IP 획득
3. **SSH 연결 테스트**: EC2 인스턴스 접근 가능 여부 확인
4. **컨테이너 업데이트**: 새 이미지로 컨테이너 교체
5. **헬스 체크**: 서비스 정상 동작 확인

### 주요 개선사항
- **SSH 키 자동 설정**: 로컬 SSH 키와 EC2 키 페어 동기화
- **ARM64 최적화**: t4g.small 인스턴스와 네이티브 바이너리 사용
- **IAM 역할 관리**: EC2 인스턴스별 ECR 접근 권한 자동 설정
- **로그 분리**: 배포 로그와 실행 결과 명확한 분리
- **파라미터 전달**: SSH 스크립트 파라미터 정확한 전달

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
# SSH를 통한 직접 로그 확인
ssh -i ~/.ssh/id_rsa ec2-user@<instance-ip> 'docker logs beacon-frontend'
ssh -i ~/.ssh/id_rsa ec2-user@<instance-ip> 'docker logs beacon-backend'

# 실시간 로그 모니터링
ssh -i ~/.ssh/id_rsa ec2-user@<instance-ip> 'docker logs -f beacon-frontend'
```

### 컨테이너 관리
```bash
# 컨테이너 재시작
ssh -i ~/.ssh/id_rsa ec2-user@<instance-ip> 'docker restart beacon-frontend'

# ECR에서 최신 이미지 pull 및 재시작
ssh -i ~/.ssh/id_rsa ec2-user@<instance-ip> '
  aws ecr get-login-password --region ap-northeast-2 | \
    docker login --username AWS --password-stdin 933851512157.dkr.ecr.ap-northeast-2.amazonaws.com
  docker pull 933851512157.dkr.ecr.ap-northeast-2.amazonaws.com/beacon-frontend:latest
  docker stop beacon-frontend && docker rm beacon-frontend
  docker run -d --name beacon-frontend --restart unless-stopped -p 80:80 \
    933851512157.dkr.ecr.ap-northeast-2.amazonaws.com/beacon-frontend:latest
'

# 컨테이너 상태 확인
ssh -i ~/.ssh/id_rsa ec2-user@<instance-ip> 'docker ps -a'
```

### 헬스 체크
```bash
# Frontend 헬스 체크
curl https://beacon.sk-shieldus.com/health

# Backend API 헬스 체크
curl https://api.beacon.sk-shieldus.com/api/weather

# 카테고리 API 테스트
curl https://api.beacon.sk-shieldus.com/api/categories
```

## 🚨 트러블슈팅

### 일반적인 문제들

1. **502 Bad Gateway 에러 (로컬 환경)**
   - 원인: 컨테이너가 아직 준비중 (정상 현상)
   - 해결: 30초-1분 대기 후 재접속
   - 확인: `./deploy.sh status` 또는 `./deploy.sh logs`로 상태 모니터링

2. **Frontend-Backend 통신 실패**
   - nginx 프록시 설정 확인: `default.conf.template`
   - 백엔드 API 상태 확인: `curl https://api.beacon.sk-shieldus.com/api/weather`
   - CORS 설정 확인: Backend에서 Frontend 도메인 허용

3. **ECR 푸시 실패**
   - AWS 자격증명 확인: `aws sts get-caller-identity`
   - ECR 로그인 상태 확인
   - IAM 권한 확인: ECR push 권한 필요

4. **SSH 연결 실패**
   - SSH 키 권한 확인: `chmod 600 ~/.ssh/id_rsa`
   - EC2 Security Group 22번 포트 확인
   - 키 페어 일치 확인: Terraform에서 등록된 키와 로컬 키 동일

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
- **[deploy/prod/DEPLOYMENT.md](./deploy/prod/DEPLOYMENT.md)**: 📚 **프로덕션 배포 종합 가이드**
- **[deploy/dev/local/README.md](./deploy/dev/local/README.md)**: 🚀 **로컬 개발환경 설정 가이드**
- **[infra/README.md](./infra/README.md)**: Terraform 인프라 상세 가이드
- **[frontend/README.md](./frontend/README.md)**: React 프론트엔드 개발 가이드  
- **[backend/README.md](./backend/README.md)**: Flask API 백엔드 가이드

### 외부 링크
- **운영 사이트**: https://beacon.sk-shieldus.com
- **API 엔드포인트**: https://api.beacon.sk-shieldus.com
- **AWS Console**: https://console.aws.amazon.com/

## 📝 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다.

---

**마지막 업데이트**: 2025-01-11
**배포 상태**: ✅ 운영 중 (https://beacon.sk-shieldus.com)
**최신 개선사항**: ECR 기반 자동 배포, ARM64 최적화, SSH 키 기반 보안 배포, IAM 역할 자동 설정