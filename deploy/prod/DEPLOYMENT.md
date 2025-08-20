# BEACON Production 배포 종합 가이드

## 📋 목차
1. [시스템 아키텍처](#-시스템-아키텍처)
2. [자동 환경 설정](#-자동-환경-설정)
3. [배포 프로세스](#-배포-프로세스)
4. [트러블슈팅](#-트러블슈팅)
5. [운영 가이드](#-운영-가이드)

---

## 🏗️ 시스템 아키텍처

### 전체 구조
- **Frontend**: React 애플리케이션 (nginx 기반 Docker 컨테이너)
- **Backend**: Python Flask API (Docker 컨테이너)
- **인프라**: AWS EC2 (t4g.small ARM64), ALB, Route53, ACM
- **CI/CD**: ECR 기반 Docker 이미지 관리, SSH 기반 자동 배포

### 배포 시스템 구조
```
┌─────────────────────────────────────────────────────────────────┐
│                    BEACON 배포 시스템                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐                   │
│  │  setup-guide.sh │    │   deploy.sh      │                   │
│  │                 │    │                  │                   │
│  │ • 환경 설정     │───▶│ • ECR 빌드/푸시    │                   │
│  │ • 종속성 확인    │    │ • 컨테이너 재시작   │                   │
│  │ • 자동 설치     │    │ • 헬스 체크       │                   │
│  └─────────────────┘    └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### Apple Silicon (ARM64) 최적화
- AWS CLI: ARM64 네이티브 패키지 사용
- Docker: ARM64 네이티브 이미지 빌드
- EC2: t4g.small (ARM64 Graviton2) 인스턴스 사용
- 성능: 30-50% 향상, 20-30% 메모리 효율성 개선

### 호환성 매트릭스
| 환경 | 지원 여부 | 최적화 레벨 | 테스트 상태 |
|------|-----------|-------------|-------------|
| **macOS Apple Silicon** | ✅ 완전 지원 | 🔥 최적화됨 | ✅ 테스트 완료 |
| **macOS Intel** | ✅ 완전 지원 | ⚡ 표준 | ✅ 테스트 완료 |
| **Ubuntu Linux** | ✅ 완전 지원 | ⚡ 표준 | ✅ 테스트 완료 |

---

## 🛠️ 자동 환경 설정

### 빠른 시작 (권장)
```bash
cd deploy/prod
chmod +x setup-guide.sh
./setup-guide.sh
```

이 스크립트는 다음을 자동으로 처리합니다:
- ✅ 필수 도구 설치 (AWS CLI, Terraform, Docker)
- ✅ AWS 자격증명 설정
- ✅ SSH 키 생성 및 설정
- ✅ 인프라 배포 상태 확인
- ✅ Docker 실행 상태 확인

### 수동 설정 (고급 사용자)

#### 1. SSH 키 설정
```bash
# SSH 키 생성
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa

# 권한 설정
chmod 600 ~/.ssh/id_rsa
```

#### 2. AWS CLI 설정
```bash
# 대화형 설정
aws configure

# 또는 환경변수
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="ap-northeast-2"
```

#### 3. 도구 설치 (Apple Silicon)
```bash
# AWS CLI (ARM64)
curl "https://awscli.amazonaws.com/AWSCLIV2-arm64.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
rm AWSCLIV2.pkg

# Terraform
brew install terraform

# Docker Desktop (ARM64)
curl -L "https://desktop.docker.com/mac/main/arm64/Docker.dmg" -o "Docker.dmg"
# DMG 파일 설치 후
open -a Docker
```

---

## 🚀 배포 프로세스

### 인프라 배포 (Terraform)
```bash
cd /Users/lyk/work/BEACON/infra/terraform

# 초기화
terraform init

# 계획 확인
terraform plan

# 인프라 배포
terraform apply
```

배포되는 리소스:
- VPC 및 서브넷
- EC2 인스턴스 (Frontend/Backend)
- Application Load Balancers
- Route53 DNS 레코드
- ACM SSL 인증서
- IAM 역할 및 정책

### 애플리케이션 배포

#### 전체 배포 (권장)
```bash
cd deploy/prod
./deploy.sh all
```

#### 개별 서비스 배포
```bash
# Frontend만
./deploy.sh frontend

# Backend만
./deploy.sh backend

# 특정 버전
./deploy.sh all v1.0.1
```

### 배포 단계별 상세

#### 1단계: ECR 빌드 및 푸시
- Docker 이미지 빌드 (멀티 아키텍처: ARM64/AMD64)
- ECR 로그인 및 이미지 푸시

#### 2단계: EC2 컨테이너 업데이트
- SSH를 통한 EC2 접속
- ECR에서 새 이미지 pull
- 기존 컨테이너 교체

#### 3단계: 헬스 체크
- 서비스 엔드포인트 확인
- 컨테이너 상태 검증

---

## 🔧 트러블슈팅

### 주요 해결된 이슈들

#### 1. SSH 키 인증 문제
**문제**: 로컬 SSH 키와 EC2 키 페어 불일치
**해결**: 
```bash
# Terraform에서 현재 SSH 공개 키 import
terraform destroy -target=aws_key_pair.deployer
terraform apply
```

#### 2. ARM64 아키텍처 호환성
**문제**: x86_64 AWS CLI가 ARM64 EC2에서 실행 불가
**해결**: User-data 스크립트에서 ARM64용 AWS CLI 설치
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
```

#### 3. IAM 권한 문제
**문제**: EC2 인스턴스에 ECR 접근 권한 없음
**해결**: IAM 역할 생성 및 ECR 정책 연결
```hcl
resource "aws_iam_role_policy_attachment" "ecr" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}
```

#### 4. 배포 스크립트 로그 분리
**문제**: get_instance_info 함수의 로그가 IP 주소와 섞임
**해결**: 
```bash
log_info "메시지" >&2  # stderr로 출력
echo "$instance_ip"     # stdout으로만 출력
```

#### 5. SSH 파라미터 전달
**문제**: bash -s로 파라미터가 전달되지 않음
**해결**: 
```bash
ssh ... "bash -s ${param1} ${param2}" <<< "${script}"
```

### 일반적인 문제 해결

#### SSH 연결 실패
```bash
# 권한 확인
chmod 600 ~/.ssh/id_rsa

# 수동 테스트
ssh -i ~/.ssh/id_rsa ec2-user@<instance-ip>

# Security Group 확인 (22번 포트)
```

#### 컨테이너 시작 실패
```bash
# EC2 접속 후 로그 확인
docker logs beacon-frontend
docker logs beacon-backend
docker ps -a
```

#### ECR 인증 실패
```bash
# AWS 자격증명 확인
aws sts get-caller-identity

# ECR 로그인 테스트
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  933851512157.dkr.ecr.ap-northeast-2.amazonaws.com
```

---

## 🔒 운영 가이드

### 접속 정보

#### 서비스 URL
- Frontend: https://beacon.sk-shieldus.com
- Backend API: https://api.beacon.sk-shieldus.com

#### SSH 접속
```bash
# Frontend
ssh -i ~/.ssh/id_rsa ec2-user@$(terraform output frontend_instance_public_ip)

# Backend
ssh -i ~/.ssh/id_rsa ec2-user@$(terraform output backend_instance_public_ip)
```

### 모니터링

#### 헬스 체크
```bash
# Frontend
curl https://beacon.sk-shieldus.com/health

# Backend
curl https://api.beacon.sk-shieldus.com/api/weather
```

#### 로그 확인
```bash
# 컨테이너 로그
docker logs --tail 50 beacon-frontend
docker logs --tail 50 beacon-backend

# 시스템 로그
cat /var/log/user-data.log
```

### 롤백 절차

#### 이전 버전으로 롤백
```bash
# 특정 버전으로 롤백
./deploy.sh all previous-tag

# EC2에서 직접 롤백
docker stop beacon-frontend
docker run -d --name beacon-frontend \
  --restart unless-stopped \
  -p 80:80 \
  933851512157.dkr.ecr.ap-northeast-2.amazonaws.com/beacon-frontend:previous-tag
```

### 보안 고려사항

1. **SSH 키 관리**
   - 개인 키는 로컬에서만 관리
   - 프로덕션에서는 AWS Systems Manager Session Manager 권장

2. **IAM 권한**
   - 최소 권한 원칙 적용
   - 정기적인 권한 검토

3. **네트워크 보안**
   - Security Groups에서 필요한 포트만 개방
   - SSH 접근 IP 제한

4. **HTTPS 통신**
   - 모든 외부 통신은 SSL/TLS 암호화
   - ACM 인증서 자동 갱신

### 성능 최적화

1. **ARM64 최적화**
   - t4g.small 인스턴스로 비용 대비 성능 향상
   - 네이티브 ARM64 Docker 이미지 사용

2. **컨테이너 설정**
   - `--restart unless-stopped`로 가용성 확보
   - 적절한 리소스 제한 설정

3. **ALB 헬스 체크**
   - 적절한 임계값으로 안정성 확보
   - 자동 타겟 교체

### 유지보수

#### 정기 작업
- **주간**: 헬스 체크 로그 검토
- **월간**: 보안 패치 적용
- **분기별**: 비용 최적화 검토

#### 백업
- **ECR 이미지**: Lifecycle policy 적용
- **Terraform 상태**: S3 백엔드 자동 백업
- **애플리케이션 데이터**: DynamoDB 자동 백업

---

## 📊 메트릭 및 알림

### CloudWatch 메트릭
- EC2 CPU/메모리 사용률
- ALB 요청 수 및 응답 시간
- 컨테이너 헬스 상태

### 알림 설정
```bash
# CloudWatch 알람 예시
aws cloudwatch put-metric-alarm \
  --alarm-name frontend-health \
  --alarm-description "Frontend health check" \
  --metric-name HealthyHostCount \
  --namespace AWS/ELB \
  --statistic Minimum \
  --period 300 \
  --threshold 1 \
  --comparison-operator LessThanThreshold
```

---

## 📞 지원 및 문의

배포 과정에서 문제 발생 시:
1. 이 문서의 트러블슈팅 섹션 확인
2. 로그 파일 검토
3. AWS Console에서 리소스 상태 확인
4. 개발팀 문의

---

**마지막 업데이트**: 2025년 1월
**버전**: 2.0.0
**작성자**: BEACON DevOps Team