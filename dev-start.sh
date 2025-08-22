#!/bin/bash

# BEACON 개발 환경 시작 스크립트
# 핫 리로드가 활성화된 개발 서버 실행

echo "🚀 BEACON 개발 환경 시작 중..."

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
echo "🔥 핫 리로드 활성화됨:"
echo "  - 프론트엔드: 파일 수정 시 자동 새로고침"
echo "  - 백엔드: 파일 수정 시 자동 재시작"
echo ""
echo "⏹️  중지하려면: Ctrl+C 또는 docker-compose -f docker-compose.dev.yml down"