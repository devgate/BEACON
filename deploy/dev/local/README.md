# BEACON 로컬 개발 환경 설정

Docker Compose를 사용한 BEACON 로컬 개발 환경 설정 가이드입니다.

## 🚀 초간단 시작 (One Command Setup)

```bash
# 1. 저장소 클론
git clone <repository-url>
cd BEACON/deploy/dev/local

# 2. 한 번에 모든 설정 + 실행
./deploy.sh start
```

**그게 끝입니다!** 🎉

스크립트가 자동으로:
- ✅ AWS 자격증명 감지/입력 받기
- ✅ .env 파일 자동 생성
- ✅ AWS 연결 검증
- ✅ Docker 컨테이너 시작

## 🔧 AWS 자격증명이 없는 경우

`./deploy.sh start` 실행시 자격증명이 없으면 자동으로 물어봅니다:

```
AWS credentials not found. Please provide them:
Required permissions: AmazonBedrockFullAccess, DynamoDBFullAccess

Enter AWS Access Key ID: [입력]
Enter AWS Secret Access Key: [입력]
```

**AWS IAM 권한 요구사항:**
- `AmazonBedrockFullAccess` - Claude AI 모델 사용
- `DynamoDBFullAccess` - 벡터 저장 및 세션 관리

## 📋 DynamoDB 테이블 생성 (선택사항)

dev 테이블이 없는 경우에만 실행:

```bash
cd ../../../infra/terraform-dev
terraform init && terraform apply
```

## 🎮 사용 가능한 명령어

```bash
./deploy.sh start     # AWS 자동설정 + 전체 시작 (추천)
./deploy.sh stop      # 서비스 중지
./deploy.sh restart   # 서비스 재시작
./deploy.sh rebuild   # 이미지 재빌드 + 재시작
./deploy.sh logs      # 실시간 로그 보기
./deploy.sh status    # 컨테이너 상태 확인
./deploy.sh clean     # 완전 정리
```

## 📱 접속 정보

- **Frontend (React)**: http://localhost:3000
- **Backend (Flask API)**: http://localhost:5000
- **Health Check**: http://localhost:3000/health

## ⏱️ 시작 시간 안내

컨테이너가 완전히 준비되기까지 **약 30초-1분** 정도 소요됩니다:
1. 🔄 Docker 이미지 빌드
2. 🔄 AWS 연결 초기화 
3. 🔄 Frontend/Backend 헬스체크 통과
4. ✅ 준비 완료!

**502 Bad Gateway 오류가 나오면** 잠시 기다려주세요. 컨테이너가 아직 준비중입니다.

## 🛠 개발 도구

```bash
# 실시간 로그 모니터링 (컨테이너 상태 확인용)
./deploy.sh logs

# 컨테이너 상태만 확인
./deploy.sh status

# 문제 발생시 완전 재빌드
./deploy.sh clean && ./deploy.sh start
```

## 🏗 아키텍처

### 서비스 구성

- **Frontend**: React + Nginx (포트 3000)
- **Backend**: Flask + Python (포트 5000)
- **AI/LLM**: AWS Bedrock (Claude 모델)
- **데이터베이스**: DynamoDB (dev 테이블)

### 네트워크

서비스들은 `beacon-network` 브릿지 네트워크를 통해 통신합니다:
- Frontend → Backend: `http://backend:5000`
- Backend → AWS: Bedrock + DynamoDB

## 🔧 트러블슈팅

### 🚨 자주 발생하는 문제들

**1. 502 Bad Gateway 오류**
```bash
# 원인: 컨테이너가 아직 준비중
# 해결: 1-2분 기다리거나 상태 확인
./deploy.sh status
./deploy.sh logs
```

**2. AWS 연결 문제**
```bash
# Backend 로그에서 AWS 초기화 확인
./deploy.sh logs | grep -i bedrock

# ✅ 성공: "RAG system initialized successfully"
# ❌ 실패: "Running in mock mode" 또는 "credentials not found"
```

**3. 포트 이미 사용중**
```bash
# 기존 컨테이너 완전 정리 후 재시작
./deploy.sh clean
./deploy.sh start
```

**4. 완전히 꼬인 경우**
```bash
# 핵옵션: 모든 것을 처음부터
./deploy.sh clean
docker system prune -f
./deploy.sh start
```

## 📋 자동 생성되는 환경 변수들

deploy.sh가 자동으로 생성하는 .env 파일 내용:

| 변수명 | 설명 | 기본값 |
|-------|------|--------|
| `AWS_ACCESS_KEY_ID` | AWS 액세스 키 | **자동 감지/입력** |
| `AWS_SECRET_ACCESS_KEY` | AWS 시크릿 키 | **자동 감지/입력** |
| `BEDROCK_REGION` | AWS 리전 | ap-northeast-2 |
| `FRONTEND_PORT` | Frontend 포트 | 3000 |
| `BACKEND_PORT` | Backend 포트 | 5000 |
| `DYNAMODB_VECTORS_TABLE` | 벡터 테이블명 | dev-beacon-vectors |
| `DYNAMODB_SESSIONS_TABLE` | 세션 테이블명 | dev-beacon-sessions |
| `DYNAMODB_USAGE_TABLE` | 사용량 테이블명 | dev-beacon-usage |

## 🔒 보안 정보

- ✅ `.env` 파일은 자동으로 `.gitignore`에 포함됨
- ✅ AWS 자격증명은 로컬에서만 저장됨
- ✅ deploy.sh가 자동으로 권한 검증
- ⚠️ 개발용 키만 사용하세요 (최소 권한 원칙)

## 🎯 팀 협업 가이드

**새로운 팀원 온보딩:**
1. 리포지토리 클론
2. `./deploy.sh start` 실행
3. AWS 자격증명 입력 (한 번만)
4. 개발 시작! ☕

**이미 설정된 팀원:**
```bash
./deploy.sh start  # 모든 설정 재사용됨
```

## 📚 기술 스택

- **Frontend**: React 18 + Vite + Nginx
- **Backend**: Flask + Python 3.9
- **AI/LLM**: AWS Bedrock (Claude 3.5 Sonnet)
- **Database**: DynamoDB (vector store + sessions)
- **Infrastructure**: Docker + Docker Compose
- **IaC**: Terraform (DynamoDB 테이블 관리)