#!/bin/bash

# BEACON 앱 자동 시작 스크립트
echo "🚀 BEACON 앱을 시작합니다..."

# Ollama 설치 확인 및 설치
if ! command -v ollama &> /dev/null; then
    echo "📦 Ollama를 설치합니다..."
    if command -v brew &> /dev/null; then
        brew install ollama
    else
        echo "❌ Homebrew가 설치되지 않았습니다. 먼저 Homebrew를 설치해주세요:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
else
    echo "✅ Ollama가 이미 설치되어 있습니다."
fi

# 가상환경 디렉토리 설정
VENV_DIR="venv"

# 가상환경이 존재하지 않으면 생성
if [ ! -d "$VENV_DIR" ]; then
    echo "🐍 Python 가상환경을 생성합니다..."
    python3 -m venv $VENV_DIR
fi

# 가상환경 활성화
echo "🔄 가상환경을 활성화합니다..."
source $VENV_DIR/bin/activate

# requirements.txt가 변경되었거나 의존성이 설치되지 않은 경우에만 설치
REQUIREMENTS_HASH_FILE="$VENV_DIR/.requirements_hash"
CURRENT_HASH=$(md5 -q requirements.txt 2>/dev/null || md5sum requirements.txt | cut -d' ' -f1)

if [ ! -f "$REQUIREMENTS_HASH_FILE" ] || [ "$(cat $REQUIREMENTS_HASH_FILE)" != "$CURRENT_HASH" ]; then
    echo "📋 Python 의존성을 설치합니다..."
    pip install -r requirements.txt
    echo "$CURRENT_HASH" > "$REQUIREMENTS_HASH_FILE"
else
    echo "✅ Python 의존성이 이미 최신 상태입니다."
fi

# Ollama가 실행 중인지 확인하고, 실행 중이 아니면 시작
if ! pgrep -x "ollama" > /dev/null; then
    echo "📦 Ollama를 시작합니다..."
    ollama serve &
    sleep 3
else
    echo "✅ Ollama가 이미 실행 중입니다."
fi

# llama3.2:latest 모델이 설치되어 있는지 확인하고, 없으면 설치
if ! ollama list | grep -q "llama3.2:latest"; then
    echo "🤖 llama3.2:latest 모델을 다운로드합니다... (시간이 걸릴 수 있습니다)"
    ollama pull llama3.2:latest
else
    echo "✅ llama3.2:latest 모델이 이미 설치되어 있습니다."
fi

# Flask 앱 실행
echo "🌟 BEACON 앱을 시작합니다..."
echo "🌐 브라우저에서 http://localhost:5000 에 접속하세요"
python app.py