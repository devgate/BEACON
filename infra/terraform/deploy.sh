#!/bin/bash

# 완전 자동화된 Terraform Infrastructure 배포 스크립트
# Beacon 프로젝트용 AWS 인프라 자동 배포

set -e

PROJECT_NAME="beacon"
REGION="ap-northeast-2"
S3_BUCKET_PREFIX="${PROJECT_NAME}-terraform-state"
S3_KEY="${PROJECT_NAME}/terraform.tfstate"
DYNAMODB_TABLE="${PROJECT_NAME}-terraform-locks"

echo "==========================================="
echo "🚀 완전 자동화된 Terraform 인프라 배포"
echo "==========================================="
echo "프로젝트: ${PROJECT_NAME}"
echo "리전: ${REGION}"
echo "S3 버킷 프리픽스: ${S3_BUCKET_PREFIX}"
echo "DynamoDB 테이블: ${DYNAMODB_TABLE}"
echo "==========================================="

# Step 0: AWS 자격증명 및 권한 확인
echo "🔐 AWS 자격증명 확인 중..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS 자격증명이 설정되지 않았습니다."
    echo "aws configure를 실행하거나 환경변수를 설정하세요."
    exit 1
fi

CURRENT_USER=$(aws sts get-caller-identity --query 'Arn' --output text)
echo "✓ AWS 자격증명 확인: $CURRENT_USER"

# Route53 도메인 확인
echo "🌐 Route53 도메인 확인 중..."
if aws route53domains get-domain-detail --domain-name sk-shieldus.com --region us-east-1 > /dev/null 2>&1; then
    echo "✓ sk-shieldus.com 도메인이 Route53에 등록되어 있습니다."
else
    echo "⚠️  sk-shieldus.com 도메인을 Route53에서 찾을 수 없습니다."
    echo "도메인이 등록되어 있는지 확인하세요."
fi
echo "==========================================="

# Step 1: Clean slate - 기존 상태 파일 정리
echo "🧹 기존 Terraform 상태 정리 중..."
rm -rf terraform.tfstate* .terraform/ backend.tf terraform_apply.log
echo "✓ 기존 상태 파일 정리 완료"

# Step 2: 초기 Terraform 초기화 (로컬 백엔드)
echo "🔧 Terraform 초기화 중..."
terraform init
echo "✓ Terraform 초기화 완료"

# Step 3: 고유한 S3 백엔드 버킷 생성
echo "🪣 S3 백엔드 버킷 생성 중..."

# 임시로 state-backend 모듈만 배포하여 S3 버킷 생성
terraform apply -target="module.state_backend" -auto-approve \
  -var="project_name=${PROJECT_NAME}" \
  -var="aws_region=${REGION}"

# S3 버킷 이름을 실제 생성된 것으로 가져오기
ACTUAL_S3_BUCKET=$(terraform output -raw s3_backend_bucket)
echo "✓ S3 백엔드 버킷 생성 완료: ${ACTUAL_S3_BUCKET}"

# Step 4: 백엔드 설정 파일 생성
echo "⚙️ S3 백엔드 설정 생성 중..."
cat > backend.tf <<EOF
terraform {
  backend "s3" {
    bucket         = "${ACTUAL_S3_BUCKET}"
    key            = "${S3_KEY}"
    region         = "${REGION}"
    encrypt        = true
    dynamodb_table = "${DYNAMODB_TABLE}"
  }
}
EOF
echo "✓ 백엔드 설정 파일 생성 완료"

# Step 5: 상태를 S3로 마이그레이션
echo "📦 Terraform 상태를 S3로 마이그레이션 중..."
terraform init -migrate-state -force-copy
echo "✓ S3 백엔드 마이그레이션 완료"

# Step 6: 전체 인프라 배포
echo "🏗️ 전체 인프라 배포 시작..."
echo "이 작업은 최대 20분 정도 소요될 수 있습니다 (SSL 인증서 검증 및 NAT Gateway 생성 시간 포함)"

# 재시도 로직을 포함한 안정적인 배포
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "배포 시도 $((RETRY_COUNT + 1))/$MAX_RETRIES..."
    
    # 상태 잠금 문제 해결을 위한 사전 정리
    if [ $RETRY_COUNT -gt 0 ]; then
        echo "이전 시도 실패로 인한 정리 작업 수행..."
        # 기존 잠금이 있다면 강제 해제 시도 (에러 무시)
        terraform force-unlock -force $(terraform plan 2>&1 | grep "Lock ID:" | awk '{print $3}' | head -1) 2>/dev/null || true
        sleep 5
    fi
    
    # Terraform apply 실행 (macOS 호환)
    if terraform apply -auto-approve \
        -var="project_name=${PROJECT_NAME}" \
        -var="aws_region=${REGION}" \
        -parallelism=1; then
        echo "✅ 배포 성공!"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "⚠️ 배포 실패. 30초 후 재시도합니다..."
            sleep 30
        else
            echo "❌ 최대 재시도 횟수 도달. 배포에 실패했습니다."
            echo "현재 상태 확인: terraform show"
            echo "수동 정리 필요시: terraform destroy"
            exit 1
        fi
    fi
done

# Step 7: 배포 결과 출력
echo ""
echo "==========================================="
echo "🎉 배포 완료!"
echo "==========================================="

# 최종 출력값 표시
terraform output

echo ""
echo "🔧 팀 협업 설정:"
echo "다른 팀원들은 다음 명령어로 동일한 상태를 사용할 수 있습니다:"
echo ""
echo "cat > backend.tf <<EOF"
echo "terraform {"
echo "  backend \"s3\" {"
echo "    bucket         = \"${ACTUAL_S3_BUCKET}\""
echo "    key            = \"${S3_KEY}\""
echo "    region         = \"${REGION}\""
echo "    encrypt        = true"
echo "    dynamodb_table = \"${DYNAMODB_TABLE}\""
echo "  }"
echo "}"
echo "EOF"
echo ""
echo "terraform init"
echo ""

echo "🚀 배포 완료! 모든 서비스가 시작되는 데 2-3분 정도 더 소요될 수 있습니다."
echo ""
echo "📍 접속 URL:"
terraform output frontend_url
terraform output backend_url
echo ""
echo "S3 상태 저장소: s3://${ACTUAL_S3_BUCKET}/${S3_KEY}"
echo "==========================================="