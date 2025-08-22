#!/bin/bash

# BEACON 로컬 개발 환경 (Docker 없이)
# 가장 빠른 핫 리로드 환경

echo "🚀 BEACON 로컬 개발 환경 시작..."

# 현재 디렉토리 확인
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# 디렉토리 존재 확인
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ 에러: backend 디렉토리를 찾을 수 없습니다: $BACKEND_DIR"
    echo "BEACON 프로젝트 루트에서 실행해주세요."
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ 에러: frontend 디렉토리를 찾을 수 없습니다: $FRONTEND_DIR"
    exit 1
fi

# Frontend dependencies 확인
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "⚠️  node_modules가 없습니다. npm install을 실행합니다..."
    cd "$FRONTEND_DIR" && npm install
fi

# 포트 사용 중인지 확인
if lsof -i:3000 &> /dev/null; then
    echo "⚠️  포트 3000이 이미 사용 중입니다. 기존 프로세스를 종료하세요."
    echo "확인: lsof -i:3000"
    read -p "계속 진행하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

if lsof -i:5000 &> /dev/null; then
    echo "⚠️  포트 5000이 이미 사용 중입니다. 기존 프로세스를 종료하세요."
    echo "확인: lsof -i:5000"
    read -p "계속 진행하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 터미널을 2개로 분할해서 실행
if command -v tmux &> /dev/null; then
    echo "tmux를 사용하여 백엔드/프론트엔드 동시 실행..."
    
    # 기존 세션이 있으면 종료
    tmux kill-session -t beacon 2>/dev/null || true
    
    # tmux 세션 생성
    tmux new-session -d -s beacon
    
    # 첫 번째 패널 - Backend (절대 경로 사용)
    tmux send-keys -t beacon "cd '$BACKEND_DIR' && echo '🐍 Backend 시작 중...' && python app.py" Enter
    
    # 패널 분할
    tmux split-window -h -t beacon
    
    # 두 번째 패널 - Frontend (절대 경로 사용)
    tmux send-keys -t beacon "cd '$FRONTEND_DIR' && echo '⚛️  Frontend 시작 중...' && npm start" Enter
    
    echo ""
    echo "✅ 개발 서버가 시작되었습니다!"
    echo "📝 서버 정보:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:5000"
    echo ""
    echo "⏹️  종료: Ctrl+C 또는 'tmux kill-session -t beacon'"
    echo ""
    
    # tmux 세션에 연결
    tmux attach-session -t beacon
    
elif command -v screen &> /dev/null; then
    echo "screen을 사용하여 백엔드 시작..."
    screen -dmS beacon-backend bash -c "cd backend && python app.py"
    echo "✅ Backend 시작됨 (screen session: beacon-backend)"
    echo "Frontend 시작 중..."
    cd frontend && npm start
    
else
    echo "tmux 또는 screen이 설치되어 있지 않습니다."
    echo "다음 중 선택하세요:"
    echo "1. Backend만 시작: cd backend && python app.py"
    echo "2. Frontend만 시작: cd frontend && npm start"
    echo "3. 터미널을 2개 열어서 각각 실행"
fi