#!/bin/bash

# BEACON Backend AWS ECR Build & Push Script (Multi-Architecture)
set -e

# 환경 변수 설정
AWS_ACCOUNT_ID="933851512157"
AWS_REGION=${AWS_REGION:-"ap-northeast-2"}
REPOSITORY="beacon-backend"
TAG=${1:-latest}
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPOSITORY}"
IMAGE_URI="${ECR_URI}:${TAG}"
PLATFORMS="linux/arm64,linux/amd64"

echo "🚀 Starting BEACON Backend Multi-Architecture AWS ECR Build Process"
echo "ECR Image: ${IMAGE_URI}"
echo "Target Platforms: ${PLATFORMS}"

# AWS CLI 설치 확인
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI가 설치되지 않았습니다. AWS CLI를 설치해주세요."
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# AWS 인증 확인
echo "🔐 Checking AWS credentials..."
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "❌ AWS 인증이 설정되지 않았습니다. 다음 중 하나의 방법으로 설정해주세요:"
    echo "   1. aws configure"
    echo "   2. 환경변수 설정 (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)"
    echo "   3. IAM Role (EC2 인스턴스에서 실행 시)"
    exit 1
fi

# ECR 로그인
echo "🔐 Logging in to AWS ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}

# ECR 리포지토리 존재 확인 및 생성
echo "📦 Checking ECR repository..."
if ! aws ecr describe-repositories --repository-names ${REPOSITORY} --region ${AWS_REGION} >/dev/null 2>&1; then
    echo "Creating ECR repository: ${REPOSITORY}"
    aws ecr create-repository --repository-name ${REPOSITORY} --region ${AWS_REGION} --image-scanning-configuration scanOnPush=true
else
    echo "ECR repository exists: ${REPOSITORY}"
fi

# Docker buildx 설정 확인
echo "🔧 Setting up Docker buildx for multi-architecture builds..."
if ! docker buildx inspect multiarch >/dev/null 2>&1; then
    echo "Creating multiarch builder..."
    docker buildx create --name multiarch --driver docker-container --use
else
    echo "Using existing multiarch builder..."
    docker buildx use multiarch
fi

# Multi-architecture 이미지 빌드 및 푸시
echo "📦 Building and pushing multi-architecture Docker image to ECR..."
docker buildx build \
    --platform ${PLATFORMS} \
    -t ${IMAGE_URI} \
    --push .

echo "✅ Backend Docker image build and push completed!"
echo "ECR Image: ${IMAGE_URI}"
echo ""
echo "🔗 ECR Console: https://console.aws.amazon.com/ecr/repositories/private/${AWS_ACCOUNT_ID}/${REPOSITORY}?region=${AWS_REGION}"