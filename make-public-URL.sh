#!/bin/bash

find_python_server() {
    # cloudflared 확인
    if ! command -v cloudflared &> /dev/null; then
        echo "❌ cloudflared not found"
        echo "📦 Install with: (brew install cloudflared)"
        return 1
    fi
    
    # Python 서버 찾기 - 더 포괄적인 패턴
    port=$(lsof -i -P | grep -iE "(python[0-9]*|flask)" | grep LISTEN | awk '{print $9}' | cut -d: -f2 | head -1)
    
    if [ -z "$port" ]; then
        # 일반적인 개발 포트들도 확인
        for test_port in 5000 8000 8080 3000 9000; do
            if lsof -i :$test_port 2>/dev/null | grep -iq python; then
                port=$test_port
                break
            fi
        done
    fi
    
    if [ -n "$port" ]; then
        local_url="http://localhost:$port"
        echo "✅ Python server found: $local_url"
        echo "🚀 Starting cloudflared tunnel..."
        echo "⏳ Please wait for the public URL..."
        echo ""
        
        # 임시 파일로 출력 캡처 (원본 방식 유지)
        temp_file=$(mktemp)
        
        # 트랩으로 정리 보장
        trap 'cleanup_tunnel' EXIT INT TERM
        
        cleanup_tunnel() {
            if [ -n "$tunnel_pid" ] && kill -0 "$tunnel_pid" 2>/dev/null; then
                echo ""
                echo "🛑 Stopping tunnel (PID: $tunnel_pid)..."
                kill "$tunnel_pid" 2>/dev/null
                wait "$tunnel_pid" 2>/dev/null
            fi
            [ -f "$temp_file" ] && rm -f "$temp_file"
        }
        
        # 백그라운드에서 터널 실행하고 출력을 임시 파일에 저장
        cloudflared tunnel --url "$local_url" > "$temp_file" 2>&1 &
        tunnel_pid=$!
        
        # URL이 나올 때까지 기다리면서 모니터링
        timeout=30
        counter=0
        tunnel_url=""
        
        while [ $counter -lt $timeout ]; do
            # 프로세스가 죽었는지 먼저 확인
            if ! kill -0 "$tunnel_pid" 2>/dev/null; then
                echo "❌ Tunnel process died unexpectedly"
                echo "📄 Last output:"
                cat "$temp_file" | tail -10
                break
            fi
            
            # trycloudflare.com URL 패턴 찾기
            if [ -f "$temp_file" ]; then
                tunnel_url=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$temp_file" | head -1)
                if [ -n "$tunnel_url" ]; then
                    break
                fi
            fi
            
            sleep 1
            counter=$((counter + 1))
        done
        
        if [ -n "$tunnel_url" ]; then
            echo "🎉 SUCCESS!"
            echo "🌐 Public URL: $tunnel_url"
            echo "📋 Tunnel PID: $tunnel_pid"
            echo "🛑 Stop tunnel: kill $tunnel_pid"
            echo ""
            echo "✨ Your app is now publicly accessible!"
            
            # URL을 클립보드에 복사 (macOS)
            if command -v pbcopy &> /dev/null; then
                echo "$tunnel_url" | pbcopy
                echo "📋 URL copied to clipboard!"
            fi
        else
            echo "⏰ Timeout waiting for tunnel URL (${timeout}s)"
            echo "📋 Tunnel PID: $tunnel_pid"
            echo "💡 Check tunnel status: ps -p $tunnel_pid"
            echo "🛑 Manual stop: kill $tunnel_pid"
        fi
        
        # 트랩이 정리를 담당하므로 여기서는 제거하지 않음
        trap - EXIT INT TERM
        
    else
        echo "❌ No Python server found"
        echo "💡 Make sure your Python web server is running first"
        echo "🔍 Common ports checked: 5000, 8000, 8080, 3000, 9000"
        return 1
    fi
}

# 직접 실행
find_python_server
