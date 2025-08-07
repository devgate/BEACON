# Beacon Infrastructure Architecture

## 🏗️ Overview

Beacon은 AWS 클라우드에서 실행되는 모듈화된 frontend/backend 애플리케이션입니다. Terraform을 사용하여 Infrastructure as Code로 관리되며, Docker 컨테이너 기반으로 배포됩니다.

## 🎯 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet Gateway                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                    Route 53 DNS                                 │
│  beacon.sk-shieldus.com → Frontend ALB                         │
│  api.beacon.sk-shieldus.com → Backend ALB                      │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                   SSL Certificate                               │
│            *.sk-shieldus.com (Wildcard)                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        v                           v
┌──────────────┐              ┌──────────────┐
│ Frontend ALB │              │ Backend ALB  │
│   (HTTPS)    │              │   (HTTPS)    │
└──────┬───────┘              └───────┬──────┘
       │                              │
       v                              v
┌──────────────┐              ┌──────────────┐
│  Frontend    │              │   Backend    │
│   Target     │              │   Target     │
│   Group      │              │    Group     │
└──────┬───────┘              └───────┬──────┘
       │                              │
       v                              v
┌──────────────┐              ┌──────────────┐
│  Frontend    │              │   Backend    │
│  EC2 (t3.s)  │◄─────CORS────┤  EC2 (t3.s)  │
│              │              │              │
│ nginx:alpine │              │ python:3.9   │
│   + React    │              │   + Flask    │
└──────────────┘              └──────┬───────┘
                                     │
                              ┌──────▼───────┐
                              │   DynamoDB   │
                              │ Vector Store │
                              └──────┬───────┘
                                     │
                              ┌──────▼───────┐
                              │  AWS Bedrock │
                              │  AI Models   │
                              └──────────────┘
```

## 🏛️ Infrastructure Components

### VPC Network Architecture
```
VPC: 10.0.0.0/16
├── Public Subnets
│   ├── ap-northeast-2a: 10.0.1.0/24
│   └── ap-northeast-2b: 10.0.2.0/24
├── Private Subnets  
│   ├── ap-northeast-2a: 10.0.3.0/24
│   └── ap-northeast-2b: 10.0.4.0/24
├── Internet Gateway
├── NAT Gateway (ap-northeast-2a)
├── Route Tables (Public/Private)
└── Security Groups
```

### Compute Resources

#### Frontend Infrastructure
- **EC2 Instance**: t3.small in public subnet
- **Container**: nginx:alpine with custom HTML
- **Health Check**: `/health` endpoint
- **Port**: 80 (HTTP inside container, HTTPS via ALB)

#### Backend Infrastructure  
- **EC2 Instance**: t3.small in public subnet
- **Container**: Custom Python:3.9-slim with Flask
- **Health Check**: `/api/health` endpoint
- **Port**: 80 (HTTP inside container, HTTPS via ALB)

### Load Balancing & Security

#### Application Load Balancers
- **Frontend ALB**: 
  - Internet-facing
  - HTTPS listener (443) → Target Group (80)
  - HTTP listener (80) → HTTPS redirect
- **Backend ALB**:
  - Internet-facing  
  - HTTPS listener (443) → Target Group (80)
  - HTTP listener (80) → HTTPS redirect

#### Security Groups
- **ALB Security Groups**: 
  - Ingress: 80, 443 from 0.0.0.0/0
  - Egress: All traffic
- **EC2 Security Groups**:
  - Ingress: 80 from ALB SG, 22 from 0.0.0.0/0
  - Egress: All traffic

#### SSL/TLS
- **Certificate**: Wildcard certificate (*.sk-shieldus.com)
- **Validation**: DNS validation via Route53
- **Coverage**: Both frontend and backend domains

### DNS & Domain Management
- **Hosted Zone**: sk-shieldus.com
- **A Records**:
  - beacon.sk-shieldus.com → Frontend ALB
  - api.beacon.sk-shieldus.com → Backend ALB
- **Certificate Validation**: CNAME records for SSL validation

### AWS Services Integration

#### DynamoDB
- **Table**: prod-beacon-vectors
- **Purpose**: Vector embeddings storage for RAG
- **Partition Key**: document_id (String)
- **Sort Key**: chunk_index (Number)
- **Attributes**: embeddings, text, metadata, timestamp
- **Billing Mode**: On-Demand

#### AWS Bedrock
- **Region**: ap-northeast-2
- **Models**: Claude 3 (Haiku, Sonnet, Opus), Llama 3, Titan
- **Features**: Text generation, embeddings, cross-region inference
- **Authentication**: IAM role-based access

## 🐳 Container Architecture

### Frontend Container
```dockerfile
FROM nginx:alpine
├── Static Files: /usr/share/nginx/html/
│   ├── index.html (Custom Beacon UI)
│   └── health (Health check endpoint)
├── Port: 80
└── Health Check: GET /health
```

**특징**:
- AI 문서 분석 인터페이스
- PDF 업로드 및 카테고리별 관리
- 실시간 시계 표시
- 백엔드 연결 테스트 버튼
- 반응형 디자인 및 한국어 UI
- CORS 지원 API 테스팅

### Backend Container
```dockerfile  
FROM python:3.9-slim
├── Dependencies: Flask, Flask-CORS, PyPDF2, pdf2image, boto3
├── Application: /app/
│   ├── app.py (AI 문서 분석 Flask 애플리케이션)
│   ├── bedrock_service.py (AWS Bedrock 통합)
│   ├── vector_store.py (DynamoDB 벡터 스토어)
│   ├── rag_engine.py (RAG 처리 엔진)
│   ├── requirements.txt
│   ├── uploads/ (PDF 업로드 디렉토리)
│   └── static/images/ (추출된 이미지)
├── Port: 80 (내부), 5000 (Flask)
├── User: appuser (non-root)
└── Health Check: GET /api/weather
```

**API 엔드포인트**:
- `GET /api/weather` - 헬스체크용 날씨 정보 API
- `GET /api/documents` - 업로드된 문서 목록 조회
- `GET /api/categories` - 문서 카테고리 관리
- `POST /api/chat` - AI 채팅 및 문서 분석 (Bedrock RAG)
- `POST /api/upload` - PDF 파일 업로드 및 벡터화
- `GET /api/download/{doc_id}` - 파일 다운로드
- `DELETE /api/documents/{doc_id}` - 문서 삭제
- `GET /api/bedrock/models` - Bedrock 모델 목록
- `GET /api/bedrock/health` - RAG 시스템 상태
- `GET /api/embedding-models` - 임베딩 모델 목록

## 🔧 Infrastructure as Code

### Terraform 모듈 구조
```
infra/terraform/
├── main.tf                    # 루트 모듈 오케스트레이션
├── variables.tf               # 전역 변수
├── outputs.tf                 # 인프라 출력값
├── terraform.tfvars          # 설정 값
└── modules/
    ├── common/               # 공유 인프라
    │   ├── main.tf          # VPC, Route53, SSL 인증서
    │   ├── variables.tf     # 공통 변수
    │   └── outputs.tf       # 공유 출력값
    ├── frontend/            # 프론트엔드 전용 리소스
    │   ├── main.tf         # ALB, EC2, 보안 그룹
    │   ├── variables.tf    # 프론트엔드 변수
    │   ├── outputs.tf      # 프론트엔드 출력값
    │   └── user_data_docker_production.sh
    └── backend/             # 백엔드 전용 리소스
        ├── main.tf         # ALB, EC2, 보안 그룹  
        ├── variables.tf    # 백엔드 변수
        ├── outputs.tf      # 백엔드 출력값
        └── user_data_docker_production.sh
```

### Deployment Configuration
```hcl
# terraform.tfvars
aws_region          = "ap-northeast-2"
corporate_ip_blocks = ["0.0.0.0/0"]  # Configure for security
root_domain         = "sk-shieldus.com"
frontend_domain     = "beacon.sk-shieldus.com"
backend_domain      = "api.beacon.sk-shieldus.com"
environment         = "prod"
deploy_frontend     = true
deploy_backend      = true
```

## 🚀 Deployment Process

### Prerequisites
1. AWS CLI configured with appropriate permissions
2. Terraform 1.0+ installed
3. Domain registered and Route53 hosted zone configured
4. SSH key pair available at `~/.ssh/id_rsa.pub`

### 배포 명령어
```bash
# infra/terraform 디렉토리에서 실행
cd infra/terraform

# 전체 배포
terraform init
terraform plan
terraform apply

# 프론트엔드만 배포
terraform apply -var="deploy_backend=false"

# 백엔드만 배포  
terraform apply -var="deploy_frontend=false"

# 인프라 정리
terraform destroy
```

### Bootstrap Process
1. **Infrastructure Creation**: VPC, subnets, security groups, ALB
2. **SSL Certificate**: Request and validate wildcard certificate
3. **EC2 Launch**: Instances with user data scripts
4. **Container Setup**: Pull images, build, and start containers
5. **Health Checks**: ALB target health validation
6. **DNS Propagation**: Route53 record creation

## 🔒 Security Implementation

### Network Security
- **Public Subnets**: Only for ALB and NAT Gateway
- **EC2 Placement**: Currently public (configurable to private)
- **Security Groups**: Principle of least privilege
- **SSL/TLS**: End-to-end encryption via ALB termination

### Application Security
- **CORS**: Configured for cross-origin requests
- **Non-root Container**: Backend runs as `appuser`
- **Input Validation**: Flask request validation
- **Health Checks**: Separate health endpoints

### Access Control
- **SSH Access**: Key-based authentication
- **API Access**: HTTPS-only with CORS controls
- **Corporate IP**: Configurable IP block restrictions

## 📊 Monitoring & Observability

### Health Checks
- **ALB Health Checks**: HTTP health probes every 30s
- **Container Health Checks**: Docker HEALTHCHECK directives
- **Application Health**: Custom health endpoints

### Logging
- **User Data Logs**: `/var/log/user-data.log`
- **Application Logs**: Container stdout/stderr
- **ALB Access Logs**: Optional (not currently enabled)

### Monitoring Points
- **Target Group Health**: AWS Console/CLI monitoring
- **Container Status**: `docker ps` on instances
- **Application Metrics**: Response time, error rates
- **SSL Certificate**: Expiration monitoring

## 🛠️ Maintenance & Operations

### Scaling Options
- **Vertical**: Change instance types in Terraform
- **Horizontal**: Add Auto Scaling Groups (future enhancement)
- **Container**: Resource limits and requests

### Updates & Rollbacks
- **Infrastructure**: Terraform state management
- **Application**: Container image updates
- **SSL Certificate**: Automatic renewal via AWS Certificate Manager

### Backup & Recovery
- **Infrastructure**: Terraform state file backup
- **Configuration**: Git repository versioning
- **Data**: Stateless architecture (no persistent data)

## 🔧 Troubleshooting Guide

### Common Issues

#### 1. Health Check Failures
```bash
# Check target group health
aws elbv2 describe-target-health --target-group-arn <arn>

# SSH into instance and check container
ssh -i ~/.ssh/id_rsa ec2-user@<ip>
docker ps
docker logs <container-name>
curl http://localhost/api/weather  # 헬스체크 엔드포인트
```

#### 2. SSL Certificate Issues
```bash
# Check certificate status
aws acm list-certificates
aws acm describe-certificate --certificate-arn <arn>

# Verify DNS validation records
dig +short _acme-challenge.sk-shieldus.com
```

#### 3. Docker Issues
```bash
# On instance
docker images
docker ps -a
docker logs <container>
docker exec -it <container> sh

# Rebuild if needed
docker stop <container>
docker rm <container>
# Re-run user data script commands
```

#### 4. Network Connectivity
```bash
# Test ALB connectivity
curl -I https://beacon.sk-shieldus.com
curl -I https://api.beacon.sk-shieldus.com/api/weather

# Check security groups
aws ec2 describe-security-groups --group-ids <sg-id>

# Test internal connectivity
ssh -i ~/.ssh/id_rsa ec2-user@<frontend-ip>
curl http://<backend-private-ip>/api/weather
```

## 📈 Performance Optimization

### Current Configuration
- **Instance Types**: t3.small (2 vCPU, 2 GB RAM)
- **Container Resources**: Default Docker limits
- **Network**: Single AZ deployment for cost optimization

### Optimization Opportunities
1. **Multi-AZ Deployment**: Enhanced availability
2. **Auto Scaling**: Dynamic capacity management
3. **Container Optimization**: Resource limits and multi-stage builds
4. **CDN Integration**: CloudFront for static assets
5. **Database Integration**: RDS for persistent data
6. **Monitoring**: CloudWatch detailed monitoring

## 🔄 Future Enhancements

### Planned Improvements
1. **Container Orchestration**: ECS or EKS migration
2. **CI/CD Pipeline**: Automated deployment pipeline
3. **Database Layer**: RDS or DynamoDB integration
4. **Monitoring Stack**: CloudWatch, Prometheus, Grafana
5. **Security Enhancements**: WAF, GuardDuty, Security Hub
6. **Cost Optimization**: Spot instances, Reserved instances

### Architecture Evolution
- **Microservices**: Service mesh implementation
- **Serverless**: Lambda function integration
- **Event-Driven**: SQS/SNS message queuing
- **Data Pipeline**: Analytics and reporting capabilities

---

## 📞 Contact & Support

For questions or issues with this infrastructure:
1. Check this documentation first
2. Review Terraform state and logs
3. Use AWS Console for real-time status
4. Refer to troubleshooting section above

**Infrastructure Version**: 1.0
**Last Updated**: August 2025
**Maintained By**: Infrastructure Team