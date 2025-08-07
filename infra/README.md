# 🏗️ BEACON Infrastructure

AWS 클라우드 인프라 관리를 위한 Terraform 코드와 관련 문서

## 📁 구조

```
infra/
├── terraform/          # Terraform 설정 파일
│   ├── main.tf         # 메인 설정
│   ├── variables.tf    # 변수 정의
│   ├── outputs.tf      # 출력 값
│   ├── terraform.tfvars # 환경 변수
│   └── modules/        # 모듈별 설정
│       ├── common/     # 공통 인프라 (VPC, DNS 등)
│       ├── frontend/   # 프론트엔드 인프라
│       └── backend/    # 백엔드 인프라
├── state/              # Terraform 상태 파일
└── ARCHITECTURE.md     # 인프라 아키텍처 문서
```

## 🚀 사용법

### 초기 설정
```bash
cd infra/terraform
terraform init
```

### 계획 확인
```bash
terraform plan
```

### 배포 실행
```bash
terraform apply
```

### 전체 인프라 제거
```bash
terraform destroy
```

## 🎯 주요 구성 요소

- **VPC & 네트워킹**: 격리된 네트워크 환경
- **ALB**: Application Load Balancer
- **EC2**: ARM64 Graviton2 인스턴스 (t4g.small)
- **Route53**: DNS 관리
- **ACM**: SSL 인증서
- **Security Groups**: 보안 그룹 설정

## 📖 관련 문서

- [아키텍처 상세 설명](./ARCHITECTURE.md)
- [배포 가이드](../deploy/DEPLOYMENT-GUIDE.md)