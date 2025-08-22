#!/bin/bash

# BEACON 개발 환경 시작 스크립트
# 핫 리로드가 활성화된 개발 서버 실행

echo "🚀 BEACON 개발 환경 시작 중..."

# AWS 환경변수 체크 및 설정
echo "🔑 AWS 자격증명 확인 중..."

# AWS credentials 저장 파일 경로
AWS_CREDS_FILE="./.aws-dev-credentials"

# 저장된 AWS 자격증명 로드 시도
if [ -f "$AWS_CREDS_FILE" ] && [ -z "$AWS_ACCESS_KEY_ID" ]; then
    echo "💾 저장된 AWS 자격증명을 찾았습니다."
    source "$AWS_CREDS_FILE"
    echo "✅ AWS 자격증명을 로드했습니다."
fi

# AWS 환경변수가 설정되어 있는지 확인
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "⚠️  AWS 환경변수가 설정되지 않았습니다."
    echo ""
    echo "다음 중 선택하세요:"
    echo "1. AWS 환경변수 설정하기 (다음부터 자동 로드)"
    echo "2. Mock 모드로 계속 진행하기"
    echo ""
    
    read -p "선택 (1/2): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[1]$ ]]; then
        echo ""
        echo "AWS 자격증명을 입력해주세요:"
        read -p "AWS_ACCESS_KEY_ID: " AWS_ACCESS_KEY_ID
        read -s -p "AWS_SECRET_ACCESS_KEY: " AWS_SECRET_ACCESS_KEY
        echo
        
        # 환경변수 export
        export AWS_ACCESS_KEY_ID
        export AWS_SECRET_ACCESS_KEY
        export AWS_DEFAULT_REGION="${BEDROCK_REGION:-ap-northeast-2}"
        
        # AWS 자격증명 저장 (다음부터 자동 로드)
        cat > "$AWS_CREDS_FILE" << EOF
export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="${BEDROCK_REGION:-ap-northeast-2}"
export AWS_PROFILE=""
EOF
        chmod 600 "$AWS_CREDS_FILE"  # 보안: 소유자만 읽기 가능
        
        echo "✅ AWS 자격증명이 설정되고 저장되었습니다."
        echo "🔥 실제 AWS Bedrock 모드로 실행됩니다."
        echo "💾 다음부터는 자동으로 로드됩니다."
        echo "🗑️  삭제하려면: rm .aws-dev-credentials"
    else
        echo "📝 Mock 모드로 실행됩니다 (AWS 연결 없이 UI 개발 가능)"
    fi
else
    echo "✅ AWS 환경변수가 이미 설정되어 있습니다."
    if [ -f "$AWS_CREDS_FILE" ]; then
        echo "💾 (저장된 자격증명에서 로드됨)"
    fi
    echo "🔥 실제 AWS Bedrock 모드로 실행됩니다."
fi

echo ""

# 기존 컨테이너 정리
echo "기존 컨테이너 정리 중..."
docker-compose -f docker-compose.dev.yml down

# 개발용 컨테이너 빌드 및 실행
echo "개발 서버 시작 중..."
docker-compose -f docker-compose.dev.yml up --build

echo "✅ 개발 서버가 시작되었습니다!"
echo ""
echo "📝 개발 서버 정보:"
echo "  Frontend: http://localhost:3000 (React 개발 서버)"
echo "  Backend:  http://localhost:5000 (Flask 개발 서버)"
echo ""
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "🔥 AWS Bedrock 모드 활성화됨:"
    echo "  - 실제 AI 모델 사용 가능"
    echo "  - DynamoDB 벡터 저장소 연결"
    echo "  - 프로덕션 수준 RAG 기능"
else
    echo "📝 Mock 모드로 실행 중:"
    echo "  - AWS 연결 없이 UI 개발 가능"
    echo "  - 가짜 응답으로 기능 테스트"
    echo "  - AWS 설정 후 재시작하면 실제 모드 전환"
fi
echo ""
echo "🔥 핫 리로드 활성화됨:"
echo "  - 프론트엔드: 파일 수정 시 자동 새로고침"
echo "  - 백엔드: 파일 수정 시 자동 재시작"
echo ""
echo "⏹️  중지하려면: Ctrl+C 또는 docker-compose -f docker-compose.dev.yml down"