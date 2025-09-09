#!/bin/sh

# 환경 변수 기본값 설정
BACKEND_HOST=${BACKEND_HOST:-beacon-backend}
BACKEND_PORT=${BACKEND_PORT:-5000}
BACKEND_PROTOCOL=${BACKEND_PROTOCOL:-http}

echo "🔧 Backend configuration: ${BACKEND_PROTOCOL}://${BACKEND_HOST}:${BACKEND_PORT}"

# 외부 nginx.conf가 마운트되어 있는지 확인 (ConfigMap 방식)
if [ -f "/etc/nginx/nginx.conf.mounted" ]; then
    echo "📁 Using external nginx configuration from ConfigMap"
    cp /etc/nginx/nginx.conf.mounted /etc/nginx/nginx.conf
    echo "✅ External nginx.conf applied successfully"
else
    echo "📄 Using default nginx configuration"
fi

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

echo "✅ nginx configuration applied with backend: ${BACKEND_PROTOCOL}://${BACKEND_HOST}:${BACKEND_PORT}"

# nginx 설정 테스트
nginx -t
if [ $? -eq 0 ]; then
    echo "✅ nginx configuration test passed"
else
    echo "❌ nginx configuration test failed"
    exit 1
fi

# nginx 시작
exec nginx -g 'daemon off;'