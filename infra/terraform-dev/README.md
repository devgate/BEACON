# BEACON Development Environment - DynamoDB Setup

이 Terraform 구성은 BEACON 개발 환경을 위한 DynamoDB 테이블만 생성합니다.
로컬에서 Docker Compose로 애플리케이션을 실행하고 AWS의 DynamoDB와 Bedrock 서비스를 사용합니다.

## 생성되는 리소스

### DynamoDB 테이블
- `dev-beacon-vectors`: RAG 시스템의 벡터 저장소
- `dev-beacon-sessions`: 채팅 세션 및 히스토리 관리
- `dev-beacon-usage`: 모델 사용량 추적 및 비용 관리

## 사용 방법

### 1. AWS 자격증명 설정

```bash
# AWS CLI 설정
aws configure

# 또는 특정 프로필 사용
aws configure --profile dev
```

### 2. S3 Backend 설정 (팀 협업용) - 선택사항

S3 backend를 설정하면 팀원들과 Terraform state를 공유할 수 있습니다:

```bash
# Backend 자동 설정 스크립트 실행
./backend-setup.sh setup

# 또는 수동으로 설정
terraform init -backend-config="bucket=<your-bucket-name>"
```

**S3 Backend 장점:**
- ✅ **팀 협업**: 여러 개발자가 동일한 state 공유
- ✅ **State Locking**: DynamoDB를 통한 동시 수정 방지
- ✅ **버전 관리**: S3 versioning으로 state 히스토리 보관
- ✅ **보안**: 암호화된 state 저장

### 3. Terraform 실행

```bash
# Terraform 초기화 (S3 backend 사용 시 자동으로 state 다운로드)
terraform init

# 생성될 리소스 확인
terraform plan

# 리소스 생성
terraform apply

# 생성된 테이블 확인
terraform output
```

### 3. 로컬 환경 설정

Terraform 실행 후 출력된 값들을 `deploy/dev/local/.env` 파일에 설정:

```bash
# Terraform output을 .env 형식으로 출력
terraform output -json environment_config | jq -r 'to_entries[] | "\(.key)=\(.value)"'
```

또는 수동으로 `.env` 파일 수정:

```env
DYNAMODB_VECTORS_TABLE=dev-beacon-vectors
DYNAMODB_SESSIONS_TABLE=dev-beacon-sessions
DYNAMODB_USAGE_TABLE=dev-beacon-usage
AWS_REGION=ap-northeast-2
```

### 4. Docker Compose 실행

```bash
cd ../../deploy/dev/local
./deploy.sh start
```

## 리소스 삭제

개발이 끝나고 리소스를 삭제하려면:

```bash
# 모든 리소스 삭제
terraform destroy

# 또는 특정 테이블만 삭제
terraform destroy -target=aws_dynamodb_table.beacon_vectors
```

## 비용 정보

- **DynamoDB**: PAY_PER_REQUEST (On-Demand) 모드로 설정되어 사용한 만큼만 비용 발생
- **예상 비용**: 개발 환경에서는 월 $1 미만 (최소 사용 시)

## 보안 설정

- Point-in-time recovery 활성화
- 서버 측 암호화 활성화
- TTL 설정으로 오래된 데이터 자동 정리

## 문제 해결

### 테이블이 이미 존재하는 경우

```bash
# 기존 상태 가져오기
terraform import aws_dynamodb_table.beacon_vectors dev-beacon-vectors
terraform import aws_dynamodb_table.beacon_sessions dev-beacon-sessions
terraform import aws_dynamodb_table.beacon_usage dev-beacon-usage
```

### AWS 권한 문제

필요한 IAM 권한:
- `dynamodb:CreateTable`
- `dynamodb:DescribeTable`
- `dynamodb:DeleteTable`
- `dynamodb:TagResource`
- `dynamodb:UpdateTimeToLive`
- `dynamodb:UpdateContinuousBackups`

### 테이블 상태 확인

```bash
# AWS CLI로 확인
aws dynamodb list-tables --region ap-northeast-2 | grep dev-beacon

# 상세 정보
aws dynamodb describe-table --table-name dev-beacon-vectors --region ap-northeast-2
```