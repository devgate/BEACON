FROM python:3.9-slim

WORKDIR /app

# 시스템 의존성 설치 (PDF 처리용)
RUN apt-get update && apt-get install -y \
    poppler-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# requirements 먼저 복사하여 캐시 최적화
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . /app


# uploads 디렉토리 권한 설정
RUN mkdir -p uploads static/images && \
    chmod 755 uploads static/images

# 비루트 사용자 생성
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# 포트 5000 노출
EXPOSE 5000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/weather || exit 1

# Flask 애플리케이션 실행
CMD ["python", "app.py"]