#!/bin/sh

# 환경 변수 기본값 설정
BACKEND_HOST=${BACKEND_HOST:-beacon-backend}
BACKEND_PORT=${BACKEND_PORT:-5000}
BACKEND_PROTOCOL=${BACKEND_PROTOCOL:-http}

echo "🔧 Backend configuration: ${BACKEND_PROTOCOL}://${BACKEND_HOST}:${BACKEND_PORT}"

# default.conf 템플릿에 환경 변수 적용
envsubst '${BACKEND_HOST} ${BACKEND_PORT} ${BACKEND_PROTOCOL}' < /default.conf.template > /etc/nginx/conf.d/default.conf

# HTTPS인 경우 SSL 설정 추가 (중복 방지)
if [ "${BACKEND_PROTOCOL}" = "https" ]; then
    # SSL 설정이 이미 있는지 확인
    if ! grep -q "proxy_ssl_verify" /etc/nginx/conf.d/default.conf; then
        echo "        proxy_ssl_verify off;" > /tmp/ssl_config
        sed -i '/proxy_set_header X-Forwarded-Proto \$scheme;/r /tmp/ssl_config' /etc/nginx/conf.d/default.conf
        rm -f /tmp/ssl_config
    fi
fi

echo "✅ nginx default.conf generated with backend: ${BACKEND_PROTOCOL}://${BACKEND_HOST}:${BACKEND_PORT}"

# nginx 시작
exec nginx -g 'daemon off;'