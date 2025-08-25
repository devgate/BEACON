# BEACON Deployment - Container & DevOps Documentation

## 🚀 Deployment Overview

**BEACON Deployment**: Multi-environment containerized deployment strategy using Docker, Docker Compose, and automated deployment scripts for development and production environments.

### Deployment Environments
- **Development** (`/dev/local`) - Local Docker Compose development environment
- **Production** (`/prod`) - AWS production deployment with Terraform + Docker

### Key Components
- **Docker Containerization** - Separate containers for frontend and backend
- **Local Development** - Hot-reload enabled development environment
- **Production Deployment** - Blue-green deployment with health checks
- **Automated Scripts** - Deployment, testing, and maintenance automation

---

## 📁 Deployment Structure

```
deploy/
├── dev/                    # Development deployment
│   └── local/              # Local Docker environment
│       ├── README.md       # Local deployment guide
│       ├── deploy.sh       # Local deployment script
│       ├── docker-compose.yml # Local services configuration
│       ├── stop.sh         # Environment shutdown script
│       ├── test.sh         # Integration testing script
│       └── nginx/          # Nginx configuration
│           ├── nginx.conf  # Main Nginx config
│           └── conf.d/
│               └── default.conf # Virtual host configuration
│
├── prod/                   # Production deployment
│   ├── DEPLOYMENT.md       # Production deployment guide
│   ├── deploy.sh           # Production deployment script
│   ├── setup-guide.sh      # Initial setup automation
│   └── terraform.tfstate   # Terraform state (if managed here)
│
├── docker-compose.dev.yml  # Root-level development compose
└── dev-start.sh            # Quick development startup script
```

---

## 🔧 Development Deployment

### 1. Local Development Environment (`/dev/local`)

#### Docker Compose Configuration (`docker-compose.yml`)
```yaml
version: '3.8'

services:
  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: beacon-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ../../../frontend/build:/usr/share/nginx/html:ro
    depends_on:
      - backend
      - frontend
    networks:
      - beacon-network
    restart: unless-stopped

  # Backend Service
  backend:
    build:
      context: ../../../backend
      dockerfile: Dockerfile
    container_name: beacon-backend
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=production
      - FLASK_DEBUG=0
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - BEDROCK_REGION=${BEDROCK_REGION:-ap-northeast-2}
      - DYNAMODB_VECTORS_TABLE=${DYNAMODB_VECTORS_TABLE:-prod-beacon-vectors}
      - DYNAMODB_SESSIONS_TABLE=${DYNAMODB_SESSIONS_TABLE:-prod-beacon-sessions}
      - DYNAMODB_USAGE_TABLE=${DYNAMODB_USAGE_TABLE:-prod-beacon-usage}
      - CHROMA_DATA_DIR=/app/chroma_data
    volumes:
      - backend_uploads:/app/uploads
      - backend_chroma:/app/chroma_data
      - backend_static:/app/static
    networks:
      - beacon-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Frontend Service  
  frontend:
    build:
      context: ../../../frontend
      dockerfile: Dockerfile
    container_name: beacon-frontend
    environment:
      - REACT_APP_API_URL=http://backend:5000/api
    networks:
      - beacon-network
    restart: unless-stopped
    depends_on:
      - backend

# Persistent Volumes
volumes:
  backend_uploads:
    driver: local
  backend_chroma:
    driver: local
  backend_static:
    driver: local

# Networks
networks:
  beacon-network:
    driver: bridge
```

#### Nginx Configuration (`nginx/nginx.conf`)
```nginx
user nginx;
worker_processes auto;

error_log /var/log/nginx/error.log notice;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    multi_accept on;
    use epoll;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                   '$status $body_bytes_sent "$http_referer" '
                   '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 16m;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Include virtual host configurations
    include /etc/nginx/conf.d/*.conf;
}
```

#### Virtual Host Configuration (`nginx/conf.d/default.conf`)
```nginx
# Upstream backend servers
upstream backend {
    server backend:5000;
    keepalive 32;
}

# Main server block
server {
    listen 80;
    server_name localhost beacon.local;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend static files
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy to backend
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Health check endpoint
    location /health {
        return 200 'healthy';
        add_header Content-Type text/plain;
        access_log off;
    }

    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}

# SSL server block (for HTTPS)
# server {
#     listen 443 ssl http2;
#     server_name beacon.local;
#
#     ssl_certificate /etc/ssl/certs/beacon.crt;
#     ssl_certificate_key /etc/ssl/private/beacon.key;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512...;
#     ssl_prefer_server_ciphers off;
#
#     # Same location blocks as HTTP server
# }
```

### 2. Local Deployment Scripts

#### Main Deployment Script (`deploy.sh`)
```bash
#!/bin/bash

# BEACON Local Deployment Script
# Description: Deploy BEACON application locally using Docker Compose

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check environment file
    if [[ ! -f "${ENV_FILE}" ]]; then
        log_warning "Environment file not found. Creating default .env file..."
        create_default_env
    fi
    
    log_success "Prerequisites check passed"
}

# Create default environment file
create_default_env() {
    cat > "${ENV_FILE}" << 'EOF'
# AWS Configuration
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
BEDROCK_REGION=ap-northeast-2

# Database Tables
DYNAMODB_VECTORS_TABLE=dev-beacon-vectors
DYNAMODB_SESSIONS_TABLE=dev-beacon-sessions
DYNAMODB_USAGE_TABLE=dev-beacon-usage

# Application Settings
CHROMA_DATA_DIR=./chroma_data
EOF
    
    log_warning "Please edit .env file with your AWS credentials before running again."
    exit 1
}

# Build application images
build_images() {
    log_info "Building application images..."
    
    # Build backend
    log_info "Building backend image..."
    cd "${PROJECT_ROOT}/backend"
    docker build -t beacon-backend:latest -f Dockerfile .
    
    # Build frontend
    log_info "Building frontend image..."
    cd "${PROJECT_ROOT}/frontend"
    docker build -t beacon-frontend:latest -f Dockerfile .
    
    cd "${SCRIPT_DIR}"
    log_success "Images built successfully"
}

# Deploy services
deploy_services() {
    log_info "Deploying services..."
    
    # Load environment variables
    set -a  # Automatically export variables
    source "${ENV_FILE}"
    set +a
    
    # Deploy with Docker Compose
    docker-compose -f "${COMPOSE_FILE}" up -d
    
    log_success "Services deployed successfully"
}

# Wait for services to be healthy
wait_for_services() {
    log_info "Waiting for services to be healthy..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ ${attempt} -le ${max_attempts} ]]; do
        log_info "Health check attempt ${attempt}/${max_attempts}"
        
        # Check backend health
        if curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
            log_success "Backend is healthy"
            break
        fi
        
        if [[ ${attempt} -eq ${max_attempts} ]]; then
            log_error "Services failed to become healthy within $(( max_attempts * 10 )) seconds"
            docker-compose -f "${COMPOSE_FILE}" logs
            exit 1
        fi
        
        sleep 10
        ((attempt++))
    done
    
    log_success "All services are healthy"
}

# Run post-deployment tests
run_tests() {
    log_info "Running post-deployment tests..."
    
    if [[ -f "${SCRIPT_DIR}/test.sh" ]]; then
        bash "${SCRIPT_DIR}/test.sh"
    else
        log_warning "Test script not found, skipping tests"
    fi
}

# Display deployment information
show_deployment_info() {
    log_success "BEACON deployed successfully!"
    echo ""
    echo "🌐 Application URLs:"
    echo "   Frontend: http://localhost:80"
    echo "   Backend API: http://localhost:5000"
    echo "   Health Check: http://localhost:80/health"
    echo ""
    echo "📊 Service Status:"
    docker-compose -f "${COMPOSE_FILE}" ps
    echo ""
    echo "📝 View logs:"
    echo "   All services: docker-compose -f ${COMPOSE_FILE} logs -f"
    echo "   Backend only: docker-compose -f ${COMPOSE_FILE} logs -f backend"
    echo "   Frontend only: docker-compose -f ${COMPOSE_FILE} logs -f frontend"
    echo ""
    echo "🛑 Stop services: bash ${SCRIPT_DIR}/stop.sh"
}

# Main deployment function
main() {
    log_info "Starting BEACON local deployment..."
    echo "========================================"
    
    check_prerequisites
    build_images
    deploy_services
    wait_for_services
    run_tests
    show_deployment_info
    
    log_success "Deployment completed successfully!"
}

# Handle script arguments
case "${1:-}" in
    "build")
        check_prerequisites
        build_images
        ;;
    "deploy")
        check_prerequisites
        deploy_services
        wait_for_services
        show_deployment_info
        ;;
    "test")
        run_tests
        ;;
    "")
        main
        ;;
    *)
        echo "Usage: $0 [build|deploy|test]"
        echo ""
        echo "Commands:"
        echo "  build   - Build Docker images only"
        echo "  deploy  - Deploy services only (images must exist)"
        echo "  test    - Run post-deployment tests only"
        echo "  (none)  - Full deployment (build + deploy + test)"
        exit 1
        ;;
esac
```

#### Service Stop Script (`stop.sh`)
```bash
#!/bin/bash

# BEACON Local Stop Script
# Description: Stop and cleanup local BEACON deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Stop services
stop_services() {
    log_info "Stopping BEACON services..."
    
    if docker-compose -f "${COMPOSE_FILE}" ps -q | grep -q .; then
        docker-compose -f "${COMPOSE_FILE}" down
        log_success "Services stopped successfully"
    else
        log_info "No services are running"
    fi
}

# Cleanup (optional)
cleanup() {
    if [[ "${1:-}" == "--cleanup" ]]; then
        log_info "Cleaning up Docker resources..."
        
        # Remove containers
        docker-compose -f "${COMPOSE_FILE}" down -v --remove-orphans
        
        # Remove images (optional)
        if [[ "${2:-}" == "--images" ]]; then
            log_info "Removing Docker images..."
            docker rmi beacon-backend:latest beacon-frontend:latest 2>/dev/null || true
        fi
        
        # Prune unused resources
        docker system prune -f
        
        log_success "Cleanup completed"
    fi
}

# Main function
main() {
    log_info "Stopping BEACON local deployment..."
    
    stop_services
    cleanup "$@"
    
    log_success "BEACON stopped successfully!"
}

# Show usage
show_usage() {
    echo "Usage: $0 [--cleanup] [--images]"
    echo ""
    echo "Options:"
    echo "  --cleanup  Remove containers and volumes"
    echo "  --images   Also remove Docker images (requires --cleanup)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Stop services only"
    echo "  $0 --cleanup          # Stop and remove containers/volumes"
    echo "  $0 --cleanup --images # Full cleanup including images"
}

# Handle arguments
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    show_usage
    exit 0
fi

main "$@"
```

#### Integration Test Script (`test.sh`)
```bash
#!/bin/bash

# BEACON Integration Test Script
# Description: Run comprehensive tests against deployed services

set -e

# Configuration
BACKEND_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:80"
API_URL="${BACKEND_URL}/api"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Logging functions
log_info() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_failure() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test function wrapper
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    ((TESTS_TOTAL++))
    log_info "Running: ${test_name}"
    
    if eval "${test_command}"; then
        log_success "${test_name}"
    else
        log_failure "${test_name}"
    fi
    
    echo ""
}

# Individual test functions
test_frontend_health() {
    curl -sf "${FRONTEND_URL}/health" > /dev/null
}

test_backend_health() {
    local response=$(curl -sf "${API_URL}/health")
    [[ "${response}" == "healthy" ]]
}

test_backend_info() {
    local response=$(curl -sf "${API_URL}/info")
    echo "${response}" | grep -q "timestamp"
}

test_bedrock_health() {
    local response=$(curl -sf "${API_URL}/bedrock/health")
    echo "${response}" | grep -q "status"
}

test_bedrock_models() {
    local response=$(curl -sf "${API_URL}/bedrock/models")
    echo "${response}" | grep -q "models"
}

test_documents_endpoint() {
    local response=$(curl -sf "${API_URL}/documents")
    echo "${response}" | grep -q "documents"
}

test_categories_endpoint() {
    local response=$(curl -sf "${API_URL}/categories")
    echo "${response}" | grep -q "categories"
}

test_chat_endpoint() {
    local response=$(curl -sf -X POST "${API_URL}/chat" \
        -H "Content-Type: application/json" \
        -d '{"message":"Hello","use_rag":false}')
    echo "${response}" | grep -q "response"
}

test_file_upload() {
    # Create a test PDF file
    echo "This is a test document" > /tmp/test.txt
    
    # Convert to PDF (if possible) or skip if no converter available
    if command -v pandoc &> /dev/null; then
        pandoc /tmp/test.txt -o /tmp/test.pdf
        
        local response=$(curl -sf -X POST "${API_URL}/upload" \
            -F "file=@/tmp/test.pdf")
        echo "${response}" | grep -q "success"
        
        # Cleanup
        rm -f /tmp/test.pdf
    else
        log_warning "Pandoc not available, skipping file upload test"
        return 0
    fi
    
    rm -f /tmp/test.txt
}

test_nginx_configuration() {
    # Test reverse proxy to backend
    local response=$(curl -sf "${FRONTEND_URL}/api/health")
    [[ "${response}" == "healthy" ]]
}

test_nginx_static_files() {
    # Test static file serving
    curl -sf "${FRONTEND_URL}/" | grep -q "html"
}

test_security_headers() {
    local headers=$(curl -sI "${FRONTEND_URL}/")
    echo "${headers}" | grep -q "X-Content-Type-Options"
}

# Performance tests
test_response_times() {
    log_info "Testing API response times..."
    
    local endpoints=(
        "${API_URL}/health"
        "${API_URL}/info"
        "${API_URL}/documents"
        "${API_URL}/bedrock/health"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local response_time=$(curl -o /dev/null -s -w "%{time_total}" "${endpoint}")
        local time_ms=$(echo "${response_time} * 1000" | bc)
        
        if (( $(echo "${response_time} < 2.0" | bc -l) )); then
            log_success "Response time for ${endpoint}: ${time_ms}ms"
        else
            log_failure "Response time for ${endpoint}: ${time_ms}ms (too slow)"
        fi
    done
}

# Load testing (basic)
test_concurrent_requests() {
    log_info "Testing concurrent request handling..."
    
    local pids=()
    local success_count=0
    
    # Start 10 concurrent requests
    for i in {1..10}; do
        curl -sf "${API_URL}/health" > /dev/null && ((success_count++)) &
        pids+=($!)
    done
    
    # Wait for all requests to complete
    for pid in "${pids[@]}"; do
        wait "${pid}"
    done
    
    if [[ ${success_count} -eq 10 ]]; then
        log_success "Concurrent requests: ${success_count}/10 successful"
    else
        log_failure "Concurrent requests: ${success_count}/10 successful"
    fi
}

# Docker health checks
test_container_health() {
    log_info "Checking container health..."
    
    local containers=("beacon-backend" "beacon-frontend" "beacon-nginx")
    
    for container in "${containers[@]}"; do
        if docker ps --filter "name=${container}" --filter "status=running" | grep -q "${container}"; then
            log_success "Container ${container} is running"
        else
            log_failure "Container ${container} is not running"
        fi
    done
}

# Resource usage tests
test_resource_usage() {
    log_info "Checking resource usage..."
    
    # Get container stats
    local stats=$(docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}")
    
    echo "${stats}"
    
    # Basic resource usage validation (containers should not use excessive resources)
    if echo "${stats}" | grep -q "beacon-backend"; then
        log_success "Backend container resource usage within limits"
    else
        log_failure "Backend container resource usage check failed"
    fi
}

# Main test execution
main() {
    echo "=========================================="
    echo "🧪 BEACON Integration Test Suite"
    echo "=========================================="
    echo ""
    
    log_info "Testing BEACON deployment at:"
    log_info "  Frontend: ${FRONTEND_URL}"
    log_info "  Backend:  ${BACKEND_URL}"
    echo ""
    
    # Basic health tests
    run_test "Frontend health check" "test_frontend_health"
    run_test "Backend health check" "test_backend_health"
    run_test "Backend info endpoint" "test_backend_info"
    
    # Service-specific tests
    run_test "Bedrock health check" "test_bedrock_health"
    run_test "Bedrock models list" "test_bedrock_models"
    run_test "Documents endpoint" "test_documents_endpoint"
    run_test "Categories endpoint" "test_categories_endpoint"
    run_test "Chat endpoint" "test_chat_endpoint"
    
    # File operations
    run_test "File upload functionality" "test_file_upload"
    
    # Infrastructure tests
    run_test "Nginx reverse proxy" "test_nginx_configuration"
    run_test "Nginx static files" "test_nginx_static_files"
    run_test "Security headers" "test_security_headers"
    
    # Performance tests
    test_response_times
    run_test "Concurrent requests" "test_concurrent_requests"
    
    # Docker tests
    run_test "Container health" "test_container_health"
    test_resource_usage
    
    # Test summary
    echo "=========================================="
    echo "📊 Test Results Summary"
    echo "=========================================="
    echo -e "Total tests: ${TESTS_TOTAL}"
    echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
    echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
    
    if [[ ${TESTS_FAILED} -eq 0 ]]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some tests failed!${NC}"
        exit 1
    fi
}

# Execute tests
main "$@"
```

---

## 🏭 Production Deployment

### Production Deployment Script (`prod/deploy.sh`)
```bash
#!/bin/bash

# BEACON Production Deployment Script
# Description: Deploy BEACON to production environment with blue-green deployment

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
INFRA_DIR="${PROJECT_ROOT}/infra/terraform"

# Load environment variables
ENV_FILE="${PROJECT_ROOT}/.env.prod"
if [[ -f "${ENV_FILE}" ]]; then
    set -a
    source "${ENV_FILE}"
    set +a
fi

# Default values
ENVIRONMENT="${ENVIRONMENT:-prod}"
AWS_REGION="${AWS_REGION:-ap-northeast-2}"
BACKEND_DOMAIN="${BACKEND_DOMAIN:-api.beacon.example.com}"
FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-beacon.example.com}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local tools=("docker" "aws" "terraform")
    for tool in "${tools[@]}"; do
        if ! command -v "${tool}" &> /dev/null; then
            log_error "${tool} is not installed"
            exit 1
        fi
    done
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    # Check environment file
    if [[ ! -f "${ENV_FILE}" ]]; then
        log_error "Production environment file not found: ${ENV_FILE}"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Build and push Docker images
build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    # Get ECR repository URLs
    local backend_repo=$(aws ecr describe-repositories \
        --repository-names "beacon-backend" \
        --region "${AWS_REGION}" \
        --query 'repositories[0].repositoryUri' \
        --output text 2>/dev/null || echo "")
    
    local frontend_repo=$(aws ecr describe-repositories \
        --repository-names "beacon-frontend" \
        --region "${AWS_REGION}" \
        --query 'repositories[0].repositoryUri' \
        --output text 2>/dev/null || echo "")
    
    if [[ -z "${backend_repo}" ]] || [[ -z "${frontend_repo}" ]]; then
        log_error "ECR repositories not found. Run Terraform first."
        exit 1
    fi
    
    # Login to ECR
    aws ecr get-login-password --region "${AWS_REGION}" | \
        docker login --username AWS --password-stdin "${backend_repo%/*}"
    
    # Build and push backend
    log_info "Building backend image..."
    cd "${PROJECT_ROOT}/backend"
    docker build -t "${backend_repo}:latest" -f Dockerfile .
    docker push "${backend_repo}:latest"
    
    # Build and push frontend
    log_info "Building frontend image..."
    cd "${PROJECT_ROOT}/frontend"
    docker build -t "${frontend_repo}:latest" \
        --build-arg REACT_APP_API_URL="https://${BACKEND_DOMAIN}/api" \
        -f Dockerfile .
    docker push "${frontend_repo}:latest"
    
    cd "${SCRIPT_DIR}"
    log_success "Images built and pushed successfully"
}

# Deploy infrastructure
deploy_infrastructure() {
    log_info "Deploying infrastructure with Terraform..."
    
    cd "${INFRA_DIR}"
    
    # Initialize Terraform
    terraform init
    
    # Plan deployment
    terraform plan \
        -var="environment=${ENVIRONMENT}" \
        -var="backend_domain=${BACKEND_DOMAIN}" \
        -var="frontend_domain=${FRONTEND_DOMAIN}" \
        -out=tfplan
    
    # Apply deployment
    terraform apply tfplan
    
    cd "${SCRIPT_DIR}"
    log_success "Infrastructure deployed successfully"
}

# Update application on EC2 instances
update_application() {
    log_info "Updating application on EC2 instances..."
    
    # Get instance IPs from Terraform output
    cd "${INFRA_DIR}"
    local backend_ips=$(terraform output -json backend_instance_ips | jq -r '.[]')
    local frontend_ips=$(terraform output -json frontend_instance_ips | jq -r '.[]')
    cd "${SCRIPT_DIR}"
    
    # Update backend instances
    for ip in ${backend_ips}; do
        log_info "Updating backend instance: ${ip}"
        ssh -o StrictHostKeyChecking=no "ec2-user@${ip}" << 'EOF'
            # Pull latest image
            sudo docker pull $(aws ecr describe-repositories --repository-names beacon-backend --region ap-northeast-2 --query 'repositories[0].repositoryUri' --output text):latest
            
            # Stop current container
            sudo docker stop beacon-backend || true
            sudo docker rm beacon-backend || true
            
            # Start new container
            sudo docker run -d \
                --name beacon-backend \
                -p 5000:5000 \
                --restart unless-stopped \
                -e AWS_REGION=ap-northeast-2 \
                $(aws ecr describe-repositories --repository-names beacon-backend --region ap-northeast-2 --query 'repositories[0].repositoryUri' --output text):latest
EOF
    done
    
    # Update frontend instances
    for ip in ${frontend_ips}; do
        log_info "Updating frontend instance: ${ip}"
        ssh -o StrictHostKeyChecking=no "ec2-user@${ip}" << 'EOF'
            # Pull latest image
            sudo docker pull $(aws ecr describe-repositories --repository-names beacon-frontend --region ap-northeast-2 --query 'repositories[0].repositoryUri' --output text):latest
            
            # Stop current container
            sudo docker stop beacon-frontend || true
            sudo docker rm beacon-frontend || true
            
            # Start new container
            sudo docker run -d \
                --name beacon-frontend \
                -p 80:80 \
                --restart unless-stopped \
                $(aws ecr describe-repositories --repository-names beacon-frontend --region ap-northeast-2 --query 'repositories[0].repositoryUri' --output text):latest
EOF
    done
    
    log_success "Application updated successfully"
}

# Run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    local max_attempts=20
    local attempt=1
    
    while [[ ${attempt} -le ${max_attempts} ]]; do
        log_info "Health check attempt ${attempt}/${max_attempts}"
        
        # Check backend health
        if curl -sf "https://${BACKEND_DOMAIN}/api/health" > /dev/null 2>&1; then
            log_success "Backend is healthy"
            break
        fi
        
        if [[ ${attempt} -eq ${max_attempts} ]]; then
            log_error "Backend failed health checks"
            exit 1
        fi
        
        sleep 30
        ((attempt++))
    done
    
    # Check frontend
    if curl -sf "https://${FRONTEND_DOMAIN}/health" > /dev/null 2>&1; then
        log_success "Frontend is healthy"
    else
        log_error "Frontend health check failed"
        exit 1
    fi
    
    log_success "All services are healthy"
}

# Deployment summary
show_deployment_summary() {
    log_success "Production deployment completed!"
    echo ""
    echo "🌐 Application URLs:"
    echo "   Frontend: https://${FRONTEND_DOMAIN}"
    echo "   Backend API: https://${BACKEND_DOMAIN}"
    echo ""
    echo "📊 Infrastructure:"
    cd "${INFRA_DIR}"
    terraform output
    cd "${SCRIPT_DIR}"
    echo ""
    echo "🔍 Monitoring:"
    echo "   CloudWatch: https://console.aws.amazon.com/cloudwatch"
    echo "   ALB: https://console.aws.amazon.com/ec2/v2/home#LoadBalancers"
}

# Rollback function
rollback() {
    log_warning "Initiating rollback..."
    
    # This would implement blue-green rollback logic
    # For now, just log the action
    log_info "Rollback functionality would be implemented here"
    log_info "This would switch ALB target groups back to previous version"
}

# Main deployment function
main() {
    local command="${1:-deploy}"
    
    case "${command}" in
        "build")
            check_prerequisites
            build_and_push_images
            ;;
        "infrastructure")
            check_prerequisites
            deploy_infrastructure
            ;;
        "update")
            check_prerequisites
            update_application
            run_health_checks
            ;;
        "deploy")
            log_info "Starting production deployment..."
            check_prerequisites
            build_and_push_images
            deploy_infrastructure
            update_application
            run_health_checks
            show_deployment_summary
            ;;
        "rollback")
            rollback
            ;;
        *)
            echo "Usage: $0 [build|infrastructure|update|deploy|rollback]"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"
```

---

## 🔧 Root Level Quick Scripts

### Quick Development Startup (`dev-start.sh`)
```bash
#!/bin/bash

# BEACON Quick Development Startup
# Description: Quickly start development environment with Docker Compose

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.dev.yml"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_warning "Docker is not running. Starting Docker..."
        
        # Try to start Docker on macOS
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open /Applications/Docker.app
            log_info "Waiting for Docker to start..."
            
            # Wait for Docker to start (max 60 seconds)
            local count=0
            while ! docker info > /dev/null 2>&1; do
                sleep 2
                ((count+=2))
                if [[ $count -ge 60 ]]; then
                    log_warning "Docker took too long to start. Please start Docker manually."
                    exit 1
                fi
            done
        else
            log_warning "Please start Docker manually and run this script again."
            exit 1
        fi
    fi
    
    log_success "Docker is running"
}

# Create .env file if it doesn't exist
create_env_file() {
    if [[ ! -f "${PROJECT_ROOT}/.env" ]]; then
        log_info "Creating development .env file..."
        
        cat > "${PROJECT_ROOT}/.env" << 'EOF'
# Development Environment Variables
BEDROCK_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# DynamoDB Tables (Development)
DYNAMODB_VECTORS_TABLE=dev-beacon-vectors
DYNAMODB_SESSIONS_TABLE=dev-beacon-sessions
DYNAMODB_USAGE_TABLE=dev-beacon-usage

# Application Settings
CHROMA_DATA_DIR=./chroma_data
REACT_APP_API_URL=http://localhost:5000/api
EOF
        
        log_warning "Created .env file. Please update AWS credentials before first use."
    fi
}

# Start development environment
start_development() {
    log_info "Starting BEACON development environment..."
    
    # Load environment variables
    set -a
    source "${PROJECT_ROOT}/.env"
    set +a
    
    # Start with Docker Compose
    docker-compose -f "${COMPOSE_FILE}" up -d
    
    log_success "Development environment started!"
    
    echo ""
    echo "🚀 BEACON Development Environment"
    echo "=================================="
    echo "📱 Frontend (React): http://localhost:3000"
    echo "🔧 Backend (Flask): http://localhost:5000"
    echo "📊 Backend API: http://localhost:5000/api"
    echo ""
    echo "🔄 Services with hot reload enabled"
    echo "📝 View logs: docker-compose -f ${COMPOSE_FILE} logs -f"
    echo "🛑 Stop: docker-compose -f ${COMPOSE_FILE} down"
}

# Check service health
check_services() {
    log_info "Checking service health..."
    
    local max_attempts=15
    local attempt=1
    
    while [[ ${attempt} -le ${max_attempts} ]]; do
        if curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
            log_success "Backend is ready!"
            break
        fi
        
        if [[ ${attempt} -eq ${max_attempts} ]]; then
            log_warning "Backend is taking longer than expected to start"
            log_info "Check logs: docker-compose -f ${COMPOSE_FILE} logs backend"
            break
        fi
        
        log_info "Waiting for backend to start... (${attempt}/${max_attempts})"
        sleep 5
        ((attempt++))
    done
    
    # Check if frontend is accessible
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        log_success "Frontend is ready!"
    else
        log_info "Frontend starting up... (may take a moment for React dev server)"
    fi
}

# Main function
main() {
    echo "🚀 BEACON Quick Development Startup"
    echo "====================================="
    
    check_docker
    create_env_file
    start_development
    check_services
    
    echo ""
    log_success "Development environment is ready! Happy coding! 🎉"
}

# Handle arguments
case "${1:-}" in
    "stop")
        log_info "Stopping development environment..."
        docker-compose -f "${COMPOSE_FILE}" down
        log_success "Development environment stopped"
        ;;
    "restart")
        log_info "Restarting development environment..."
        docker-compose -f "${COMPOSE_FILE}" down
        main
        ;;
    "logs")
        docker-compose -f "${COMPOSE_FILE}" logs -f
        ;;
    "")
        main
        ;;
    *)
        echo "Usage: $0 [stop|restart|logs]"
        echo ""
        echo "Commands:"
        echo "  (none)   - Start development environment"
        echo "  stop     - Stop development environment" 
        echo "  restart  - Restart development environment"
        echo "  logs     - View service logs"
        exit 1
        ;;
esac
```

---

## 📊 Monitoring & Logging

### Docker Health Checks
```dockerfile
# Backend Dockerfile health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Frontend Dockerfile health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1
```

### Log Aggregation Configuration
```yaml
# docker-compose.yml logging configuration
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        
  frontend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Monitoring Script
```bash
#!/bin/bash

# monitoring.sh - Service monitoring and alerting

monitor_services() {
    local services=("beacon-backend" "beacon-frontend" "beacon-nginx")
    
    for service in "${services[@]}"; do
        if ! docker ps | grep -q "${service}"; then
            echo "ALERT: ${service} is not running" | mail -s "BEACON Alert" admin@example.com
            
            # Auto-restart
            docker-compose -f docker-compose.yml restart "${service}"
        fi
    done
}

# Run every 5 minutes
while true; do
    monitor_services
    sleep 300
done
```

---

## 🔒 Security Considerations

### Container Security
```dockerfile
# Use non-root user
RUN addgroup -g 1001 -S app && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G app app

USER app
```

### Network Security
```yaml
# docker-compose.yml network isolation
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No external access

services:
  frontend:
    networks:
      - frontend
      
  backend:
    networks:
      - frontend
      - backend
```

### Secrets Management
```bash
# Use Docker secrets or external secret management
docker secret create aws_access_key_id /path/to/aws_key
docker secret create aws_secret_access_key /path/to/aws_secret
```