#!/bin/bash

# BEACON Frontend Docker Build & Push Script (Multi-Architecture)
set -e

# 환경 변수 설정
DOCKER_USERNAME=${DOCKER_USERNAME:-"sksda4614"}
REPOSITORY="beacon-frontend"
TAG=${1:-latest}
IMAGE_URI="${DOCKER_USERNAME}/${REPOSITORY}:${TAG}"
PLATFORMS="linux/arm64,linux/amd64"

echo "🚀 Starting BEACON Frontend Multi-Architecture Docker Build Process"
echo "Docker Hub Image: ${IMAGE_URI}"
echo "Target Platforms: ${PLATFORMS}"

# Docker buildx 설정 확인
echo "🔧 Setting up Docker buildx for multi-architecture builds..."
if ! docker buildx inspect multiarch >/dev/null 2>&1; then
    echo "Creating multiarch builder..."
    docker buildx create --name multiarch --driver docker-container --use
else
    echo "Using existing multiarch builder..."
    docker buildx use multiarch
fi

# Docker Hub 로그인 확인
echo "🔐 Checking Docker Hub login..."
if ! docker info | grep -q "Username:"; then
    echo "⚠️  Docker Hub 로그인이 필요합니다:"
    echo "   docker login"
    echo "   또는 환경변수 설정:"
    echo "   export DOCKER_USERNAME=sksda4614"
    echo "   export DOCKER_PASSWORD=your-dockerhub-token"
    
    if [ -n "$DOCKER_PASSWORD" ]; then
        echo "환경변수로 Docker Hub 로그인 시도 중..."
        echo "$DOCKER_PASSWORD" | docker login --username "$DOCKER_USERNAME" --password-stdin
    else
        echo "수동으로 로그인해주세요: docker login"
        exit 1
    fi
fi

# Multi-architecture 이미지 빌드 및 푸시
echo "📦 Building and pushing multi-architecture Docker image..."
docker buildx build \
    --platform ${PLATFORMS} \
    -t ${IMAGE_URI} \
    --push .

echo "✅ Frontend Docker image build and push completed!"
echo "Docker Hub Image: ${IMAGE_URI}"
echo ""
echo "🔗 이미지 URL: https://hub.docker.com/r/${DOCKER_USERNAME}/${REPOSITORY}"
echo ""
echo "🚀 AWS 배포 시 사용법:"
echo "   docker run -d \\"
echo "     --name beacon-frontend \\"
echo "     -p 80:80 \\"
echo "     -e BACKEND_HOST=<BACKEND_SERVER_IP> \\"
echo "     -e BACKEND_PORT=5000 \\"
echo "     ${IMAGE_URI}"