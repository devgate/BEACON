#!/bin/bash

# BEACON Frontend AWS ECR Build & Push Script (Multi-Architecture)
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Function to load .env file
load_env_file() {
    local env_file=""
    
    # Check multiple locations for .env file
    if [ -f "$SCRIPT_DIR/.env" ]; then
        env_file="$SCRIPT_DIR/.env"
    elif [ -f "$PROJECT_ROOT/.env" ]; then
        env_file="$PROJECT_ROOT/.env"
    elif [ -f "$PROJECT_ROOT/deploy/dev/local/.env" ]; then
        env_file="$PROJECT_ROOT/deploy/dev/local/.env"
    fi
    
    if [ ! -z "$env_file" ]; then
        echo -e "${YELLOW}Loading environment from: $env_file${NC}"
        # Export variables from .env file
        set -a
        source "$env_file"
        set +a
        echo -e "${GREEN}✓ Environment file loaded${NC}"
        return 0
    else
        echo -e "${YELLOW}No .env file found${NC}"
        return 1
    fi
}

# Function to check and get AWS credentials
check_aws_credentials() {
    echo -e "${YELLOW}Checking AWS credentials...${NC}"
    
    local aws_access_key=""
    local aws_secret_key=""
    local aws_region="ap-northeast-2"
    
    # First, try to load from .env file
    if load_env_file; then
        # Check if credentials exist in loaded environment
        if [ ! -z "$AWS_ACCESS_KEY_ID" ]; then
            aws_access_key="$AWS_ACCESS_KEY_ID"
        fi
        if [ ! -z "$AWS_SECRET_ACCESS_KEY" ]; then
            aws_secret_key="$AWS_SECRET_ACCESS_KEY"
        fi
        if [ ! -z "$AWS_REGION" ]; then
            aws_region="$AWS_REGION"
        elif [ ! -z "$BEDROCK_REGION" ]; then
            aws_region="$BEDROCK_REGION"
        fi
    fi
    
    # If not found in .env, try AWS CLI
    if [ -z "$aws_access_key" ] || [ -z "$aws_secret_key" ]; then
        if command -v aws &> /dev/null; then
            local cli_access_key=$(aws configure get aws_access_key_id 2>/dev/null || echo "")
            local cli_secret_key=$(aws configure get aws_secret_access_key 2>/dev/null || echo "")
            local cli_region=$(aws configure get region 2>/dev/null || echo "")
            
            if [ ! -z "$cli_access_key" ] && [ -z "$aws_access_key" ]; then
                aws_access_key="$cli_access_key"
            fi
            
            if [ ! -z "$cli_secret_key" ] && [ -z "$aws_secret_key" ]; then
                aws_secret_key="$cli_secret_key"
            fi
            
            if [ ! -z "$cli_region" ] && [ "$aws_region" == "ap-northeast-2" ]; then
                aws_region="$cli_region"
            fi
        fi
    fi
    
    # If credentials are still not found, prompt user
    if [ -z "$aws_access_key" ] || [ -z "$aws_secret_key" ]; then
        echo -e "${YELLOW}AWS credentials not found in .env or AWS CLI config.${NC}"
        echo -e "${YELLOW}Please provide them:${NC}"
        echo -e "${YELLOW}Required permissions: ECR push/pull access${NC}"
        echo ""
        
        while [ -z "$aws_access_key" ]; do
            read -p "Enter AWS Access Key ID: " aws_access_key
        done
        
        while [ -z "$aws_secret_key" ]; do
            read -s -p "Enter AWS Secret Access Key: " aws_secret_key
            echo
        done
        
        read -p "Enter AWS Region [${aws_region}]: " input_region
        if [ ! -z "$input_region" ]; then
            aws_region="$input_region"
        fi
        
        echo -e "${GREEN}✓ AWS credentials provided${NC}"
        
        # Offer to save credentials to .env file
        read -p "Save credentials to .env file? (y/n): " save_env
        if [ "$save_env" == "y" ] || [ "$save_env" == "Y" ]; then
            create_env_file "$aws_access_key" "$aws_secret_key" "$aws_region"
        fi
    else
        echo -e "${GREEN}✓ AWS credentials found${NC}"
    fi
    
    # Export for use in the script
    export AWS_ACCESS_KEY_ID="$aws_access_key"
    export AWS_SECRET_ACCESS_KEY="$aws_secret_key"
    export AWS_REGION="$aws_region"
}

# Function to create .env file
create_env_file() {
    local access_key=$1
    local secret_key=$2
    local region=$3
    
    cat > "$SCRIPT_DIR/.env" << EOF
# AWS Credentials for ECR
AWS_ACCESS_KEY_ID=$access_key
AWS_SECRET_ACCESS_KEY=$secret_key
AWS_REGION=$region

# ECR Configuration
ECR_ACCOUNT_ID=933851512157
ECR_REPOSITORY=beacon-frontend
EOF
    
    echo -e "${GREEN}✓ .env file created at $SCRIPT_DIR/.env${NC}"
}

# Check AWS credentials first
check_aws_credentials

# 환경 변수 설정 (기본값 설정, .env 파일에서 오버라이드 가능)
AWS_ACCOUNT_ID=${ECR_ACCOUNT_ID:-"933851512157"}
AWS_REGION=${AWS_REGION:-"ap-northeast-2"}
REPOSITORY=${ECR_REPOSITORY:-"beacon-frontend"}
TAG=${1:-latest}
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPOSITORY}"
IMAGE_URI="${ECR_URI}:${TAG}"
PLATFORMS=${BUILD_PLATFORMS:-"linux/arm64,linux/amd64"}

echo "🚀 Starting BEACON Frontend Multi-Architecture AWS ECR Build Process"
echo "ECR Image: ${IMAGE_URI}"
echo "Target Platforms: ${PLATFORMS}"
echo "AWS Region: ${AWS_REGION}"

# AWS CLI 설치 확인
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI가 설치되지 않았습니다. AWS CLI를 설치해주세요.${NC}"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# AWS 인증 확인 (이미 check_aws_credentials에서 설정됨)
echo -e "${YELLOW}🔐 Verifying AWS credentials...${NC}"
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo -e "${RED}❌ AWS 인증 실패. 제공된 자격 증명을 확인해주세요.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS authentication successful${NC}"

# ECR 로그인
echo -e "${YELLOW}🔐 Logging in to AWS ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}
echo -e "${GREEN}✓ ECR login successful${NC}"

# ECR 리포지토리 존재 확인 및 생성
echo -e "${YELLOW}📦 Checking ECR repository...${NC}"
if ! aws ecr describe-repositories --repository-names ${REPOSITORY} --region ${AWS_REGION} >/dev/null 2>&1; then
    echo -e "${YELLOW}Creating ECR repository: ${REPOSITORY}${NC}"
    aws ecr create-repository --repository-name ${REPOSITORY} --region ${AWS_REGION} --image-scanning-configuration scanOnPush=true
    echo -e "${GREEN}✓ ECR repository created${NC}"
else
    echo -e "${GREEN}✓ ECR repository exists: ${REPOSITORY}${NC}"
fi

# Docker buildx 설정 확인
echo -e "${YELLOW}🔧 Setting up Docker buildx for multi-architecture builds...${NC}"
if ! docker buildx inspect multiarch >/dev/null 2>&1; then
    echo "Creating multiarch builder..."
    docker buildx create --name multiarch --driver docker-container --use
    echo -e "${GREEN}✓ Multiarch builder created${NC}"
else
    echo "Using existing multiarch builder..."
    docker buildx use multiarch
    echo -e "${GREEN}✓ Using existing multiarch builder${NC}"
fi

# Multi-architecture 이미지 빌드 및 푸시
echo -e "${YELLOW}📦 Building and pushing multi-architecture Docker image to ECR...${NC}"
docker buildx build \
    --platform ${PLATFORMS} \
    -t ${IMAGE_URI} \
    --push .

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Frontend Docker image build and push completed!${NC}"
echo -e "${GREEN}ECR Image: ${IMAGE_URI}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}🔗 ECR Console:${NC}"
echo "https://console.aws.amazon.com/ecr/repositories/private/${AWS_ACCOUNT_ID}/${REPOSITORY}?region=${AWS_REGION}"
echo ""
echo -e "${YELLOW}🚀 AWS 배포 시 사용법:${NC}"
echo "   docker run -d \\"
echo "     --name beacon-frontend \\"
echo "     -p 80:80 \\"
echo "     -e BACKEND_HOST=<BACKEND_SERVER_IP> \\"
echo "     -e BACKEND_PORT=5000 \\"
echo "     ${IMAGE_URI}"