#!/bin/bash

# BEACON Production 통합 배포 스크립트
# ECR 빌드/푸시 → EC2 자동 배포 (SSH Key 기반)

set -e

# 색깔 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 환경 변수 설정
AWS_ACCOUNT_ID="933851512157"
AWS_REGION="ap-northeast-2"
SSH_USER="ec2-user"
SSH_KEY_PATH="${HOME}/.ssh/id_rsa"  # SSH 키 경로
TERRAFORM_DIR="../../infra/terraform"

# 전역 변수 선언
SKIP_SETUP_CHECK=false
FORCE_CLEANUP=false
DEPLOY_TARGET=""
IMAGE_TAG="latest"

# 사용법 출력 함수
usage() {
    echo -e "${BLUE}=== BEACON Production 배포 스크립트 ===${NC}"
    echo "사용법: $0 [OPTIONS] [TARGET] [TAG]"
    echo ""
    echo "TARGET 옵션:"
    echo "  all        - Frontend + Backend 전체 배포 (기본값)"
    echo "  frontend   - Frontend만 배포"
    echo "  backend    - Backend만 배포"
    echo "  cleanup    - Docker 자원 정리만 실행"
    echo ""
    echo "TAG 옵션:"
    echo "  latest     - 최신 이미지 태그 (기본값)"
    echo "  v1.0.1     - 특정 버전 태그"
    echo ""
    echo "OPTIONS:"
    echo "  --skip-setup     - setup-guide.sh 실행 체크를 건너뜀"
    echo "  --force-cleanup  - 배포 전 강제 Docker 자원 정리"
    echo "  -h, --help       - 이 도움말을 표시"
    echo ""
    echo "사전 요구사항:"
    echo "  1. setup-guide.sh 실행 완료 (또는 --skip-setup 플래그 사용)"
    echo "  2. SSH 키가 ~/.ssh/id_rsa에 있어야 함"
    echo "  3. EC2 인스턴스에 SSH 키가 등록되어 있어야 함"
    echo "  4. AWS CLI가 설정되어 있어야 함"
    echo ""
    echo "예시:"
    echo "  $0 all latest                    # 전체 배포 (setup-guide 체크 포함)"
    echo "  $0 --skip-setup frontend         # setup-guide 체크 건너뛰고 프론트엔드만 배포"
    echo "  $0 --force-cleanup all latest    # Docker 정리 후 전체 배포"
    echo "  $0 cleanup                       # Docker 자원 정리만 실행"
    echo "  $0 backend v1.0.1                # 백엔드만 특정 버전으로 배포"
    echo ""
    echo "디스크 공간 부족 문제 해결:"
    echo "  'no space left on device' 오류 발생 시:"
    echo "  1. $0 cleanup                    # 자동 Docker 정리 실행"
    echo "  2. docker system prune -a -f --volumes  # 수동 전체 정리"
    echo "  3. df -h                         # 디스크 사용량 확인"
    echo ""
    echo "첫 사용 시에는 다음 명령어로 환경을 먼저 설정하세요:"
    echo "  ./setup-guide.sh"
    exit 0
}


# setup-guide.sh 실행 여부 확인 함수
check_setup_guide_completion() {
    log_info "배포 환경 설정 상태 확인 중..."
    
    local setup_complete=true
    
    # 1. 필수 도구 설치 확인
    if ! command -v aws &> /dev/null; then
        setup_complete=false
    fi
    
    if ! command -v terraform &> /dev/null; then
        setup_complete=false
    fi
    
    if ! command -v docker &> /dev/null || ! docker info >/dev/null 2>&1; then
        setup_complete=false
    fi
    
    # 2. AWS 인증 확인
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        setup_complete=false
    fi
    
    # 3. SSH 키 확인
    if [[ ! -f ~/.ssh/id_rsa ]] || [[ ! -f ~/.ssh/id_rsa.pub ]]; then
        setup_complete=false
    fi
    
    # 4. Terraform 상태 확인
    if [[ ! -f "../../infra/terraform/terraform.tfstate" ]] && [[ ! -f "../../infra/terraform/.terraform/terraform.tfstate" ]]; then
        setup_complete=false
    fi
    
    if $setup_complete; then
        log_success "배포 환경 설정이 완료되어 있습니다."
        return 0
    else
        return 1
    fi
}

# setup-guide.sh 자동 실행 함수
run_setup_guide() {
    log_warning "배포 환경이 완전히 설정되지 않았습니다."
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}❗ 초기 설정이 필요합니다${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo
    echo -e "배포를 진행하기 전에 다음 설정이 필요합니다:"
    echo -e "  • 필수 도구 설치 (AWS CLI, Terraform, Docker)"
    echo -e "  • AWS 인증 설정"
    echo -e "  • SSH 키 생성/확인"
    echo -e "  • 인프라 배포"
    echo
    echo -e "${YELLOW}setup-guide.sh를 실행하여 환경을 설정하시겠습니까? (y/n): ${NC}"
    read -r run_setup
    
    if [[ "$run_setup" == "y" || "$run_setup" == "Y" ]]; then
        log_info "setup-guide.sh를 실행합니다..."
        
        # setup-guide.sh 파일 존재 확인
        if [[ ! -f "setup-guide.sh" ]]; then
            log_error "setup-guide.sh 파일을 찾을 수 없습니다."
            log_error "현재 디렉토리: $(pwd)"
            log_error "setup-guide.sh가 deploy.sh와 같은 디렉토리에 있는지 확인하세요."
            exit 1
        fi
        
        # 실행 권한 확인 및 설정
        chmod +x setup-guide.sh
        
        # setup-guide.sh 실행
        ./setup-guide.sh
        
        # 설정 완료 후 재확인
        echo
        log_info "설정 완료 후 상태를 재확인합니다..."
        if ! check_setup_guide_completion; then
            log_error "설정이 완료되지 않았습니다. 설정을 확인하고 다시 시도하세요."
            exit 1
        fi
        
        log_success "환경 설정이 완료되었습니다. 배포를 계속 진행합니다."
        echo
    else
        log_error "환경 설정이 완료되지 않았습니다."
        log_error "배포를 진행하려면 먼저 setup-guide.sh를 실행하여 환경을 설정하세요:"
        echo -e "${BLUE}./setup-guide.sh${NC}"
        exit 1
    fi
}

# 로깅 함수
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

# SSH 키 설정 가이드
setup_ssh_key() {
    log_info "SSH 키 설정을 시작합니다..."
    
    echo -e "${YELLOW}SSH 키가 필요합니다. 새로 생성하시겠습니까? (y/n): ${NC}"
    read -r create_key
    
    if [[ "$create_key" == "y" || "$create_key" == "Y" ]]; then
        log_info "SSH 키를 생성합니다..."
        
        # SSH 디렉토리 생성
        mkdir -p ~/.ssh
        chmod 700 ~/.ssh
        
        # 기존 키 백업 확인
        if [[ -f "$SSH_KEY_PATH" ]]; then
            echo -e "${YELLOW}기존 SSH 키가 있습니다. 백업하시겠습니까? (y/n): ${NC}"
            read -r backup_key
            
            if [[ "$backup_key" == "y" || "$backup_key" == "Y" ]]; then
                mv "$SSH_KEY_PATH" "${SSH_KEY_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
                mv "${SSH_KEY_PATH}.pub" "${SSH_KEY_PATH}.pub.backup.$(date +%Y%m%d_%H%M%S)"
                log_info "기존 키를 백업했습니다."
            fi
        fi
        
        # SSH 키 생성
        ssh-keygen -t rsa -b 4096 -f "$SSH_KEY_PATH" -N "" -q
        
        log_success "SSH 키가 생성되었습니다: $SSH_KEY_PATH"
        
        # 공개 키 출력
        echo -e "${BLUE}========================================${NC}"
        echo -e "${BLUE}생성된 공개 키 (EC2 인스턴스에 등록 필요):${NC}"
        echo -e "${GREEN}$(cat ${SSH_KEY_PATH}.pub)${NC}"
        echo -e "${BLUE}========================================${NC}"
        
        echo -e "${YELLOW}위 공개 키를 EC2 인스턴스에 등록해야 합니다.${NC}"
        echo -e "${YELLOW}계속하려면 Enter를 누르세요...${NC}"
        read -r
    else
        echo -e "${YELLOW}사용할 SSH 키 경로를 입력하세요 (기본값: ${SSH_KEY_PATH}): ${NC}"
        read -r custom_key_path
        
        if [[ -n "$custom_key_path" ]]; then
            SSH_KEY_PATH="$custom_key_path"
        fi
        
        if [[ ! -f "$SSH_KEY_PATH" ]]; then
            log_error "SSH 키를 찾을 수 없습니다: $SSH_KEY_PATH"
            return 1
        fi
    fi
    
    # SSH 키 권한 설정
    chmod 600 "$SSH_KEY_PATH" 2>/dev/null || true
    chmod 644 "${SSH_KEY_PATH}.pub" 2>/dev/null || true
    
    return 0
}

# AWS CLI 설정 가이드
setup_aws_cli() {
    log_info "AWS CLI 설정을 시작합니다..."
    
    echo -e "${YELLOW}AWS 자격증명을 설정하시겠습니까? (y/n): ${NC}"
    read -r setup_aws
    
    if [[ "$setup_aws" == "y" || "$setup_aws" == "Y" ]]; then
        echo -e "${BLUE}AWS 자격증명 설정 방법을 선택하세요:${NC}"
        echo "1. 대화형 설정 (aws configure)"
        echo "2. 환경변수 설정"
        echo "3. 건너뛰기 (이미 설정됨)"
        
        echo -e "${YELLOW}선택 (1-3): ${NC}"
        read -r aws_method
        
        case $aws_method in
            1)
                log_info "AWS CLI 대화형 설정을 시작합니다..."
                aws configure
                ;;
            2)
                echo -e "${YELLOW}AWS Access Key ID를 입력하세요: ${NC}"
                read -r aws_access_key
                echo -e "${YELLOW}AWS Secret Access Key를 입력하세요: ${NC}"
                read -s aws_secret_key
                echo -e "${YELLOW}기본 리전을 입력하세요 (기본값: ap-northeast-2): ${NC}"
                read -r aws_region
                
                aws_region=${aws_region:-"ap-northeast-2"}
                
                export AWS_ACCESS_KEY_ID="$aws_access_key"
                export AWS_SECRET_ACCESS_KEY="$aws_secret_key"
                export AWS_DEFAULT_REGION="$aws_region"
                
                log_success "환경변수로 AWS 자격증명이 설정되었습니다."
                ;;
            3)
                log_info "AWS 설정을 건너뜁니다."
                ;;
            *)
                log_error "잘못된 선택입니다."
                return 1
                ;;
        esac
    fi
    
    return 0
}

# 도구 설치 가이드
install_tools() {
    local missing_tools=()
    
    # 누락된 도구 확인
    if ! command -v aws &> /dev/null; then
        missing_tools+=("aws-cli")
    fi
    
    if ! command -v terraform &> /dev/null; then
        missing_tools+=("terraform")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    if [[ ${#missing_tools[@]} -eq 0 ]]; then
        return 0
    fi
    
    log_warning "누락된 도구: ${missing_tools[*]}"
    echo -e "${YELLOW}누락된 도구를 자동으로 설치하시겠습니까? (y/n): ${NC}"
    read -r install_missing
    
    if [[ "$install_missing" == "y" || "$install_missing" == "Y" ]]; then
        # 운영체제 및 아키텍처 감지
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            local arch=$(uname -m)
            if [[ "$arch" == "arm64" ]]; then
                log_info "macOS Apple Silicon (M1/M2) 환경이 감지되었습니다."
            else
                log_info "macOS Intel 환경이 감지되었습니다."
            fi
            
            if ! command -v brew &> /dev/null; then
                log_error "Homebrew가 설치되지 않았습니다."
                log_info "자동 설치를 위해 setup-guide.sh를 먼저 실행하거나, 수동 설치: https://brew.sh/"
                return 1
            fi
            
            for tool in "${missing_tools[@]}"; do
                case $tool in
                    "aws-cli")
                        log_info "AWS CLI 설치 중... (Apple Silicon 최적화)"
                        if [[ "$arch" == "arm64" ]]; then
                            # Apple Silicon용 AWS CLI
                            curl "https://awscli.amazonaws.com/AWSCLIV2-arm64.pkg" -o "AWSCLIV2.pkg"
                            sudo installer -pkg AWSCLIV2.pkg -target /
                            rm AWSCLIV2.pkg
                        else
                            brew install awscli
                        fi
                        ;;
                    "terraform")
                        log_info "Terraform 설치 중... (Apple Silicon 최적화)"
                        if [[ "$arch" == "arm64" ]]; then
                            # Homebrew는 Apple Silicon도 지원하므로 brew 사용
                            brew install terraform
                        else
                            brew install terraform
                        fi
                        ;;
                    "docker")
                        log_info "Docker 설치 중... (Apple Silicon 최적화)"
                        if [[ "$arch" == "arm64" ]]; then
                            # Apple Silicon용 Docker Desktop
                            curl -L "https://desktop.docker.com/mac/main/arm64/Docker.dmg" -o "Docker.dmg"
                            sudo hdiutil attach Docker.dmg
                            sudo cp -rf /Volumes/Docker/Docker.app /Applications/
                            sudo hdiutil detach /Volumes/Docker
                            rm Docker.dmg
                        else
                            brew install --cask docker
                        fi
                        log_warning "Docker Desktop을 Applications에서 수동으로 시작해야 합니다."
                        ;;
                esac
            done
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            for tool in "${missing_tools[@]}"; do
                case $tool in
                    "aws-cli")
                        log_info "AWS CLI 설치 중..."
                        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
                        unzip awscliv2.zip
                        sudo ./aws/install
                        rm -rf awscliv2.zip aws/
                        ;;
                    "terraform")
                        log_info "Terraform 설치 중..."
                        wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
                        echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
                        sudo apt update && sudo apt install terraform
                        ;;
                    "docker")
                        log_info "Docker 설치 중..."
                        curl -fsSL https://get.docker.com -o get-docker.sh
                        sudo sh get-docker.sh
                        sudo usermod -aG docker $USER
                        rm get-docker.sh
                        log_warning "Docker 그룹 변경사항을 적용하려면 로그아웃 후 다시 로그인하세요."
                        ;;
                esac
            done
        else
            log_error "지원되지 않는 운영체제입니다. 수동으로 도구를 설치하세요."
            return 1
        fi
    else
        log_info "수동 설치 가이드:"
        for tool in "${missing_tools[@]}"; do
            case $tool in
                "aws-cli")
                    echo "  - AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
                    ;;
                "terraform")
                    echo "  - Terraform: https://learn.hashicorp.com/tutorials/terraform/install-cli"
                    ;;
                "docker")
                    echo "  - Docker: https://docs.docker.com/get-docker/"
                    ;;
            esac
        done
        return 1
    fi
    
    return 0
}

# Docker 디스크 사용량 확인
check_docker_disk_usage() {
    log_info "Docker 디스크 사용량 확인 중..."
    
    # 디스크 사용량 확인 (Docker root 디렉토리)
    local docker_root="/var/lib/docker"
    local disk_usage
    
    if [[ -d "$docker_root" ]]; then
        disk_usage=$(df "$docker_root" | awk 'NR==2 {print $5}' | sed 's/%//')
    else
        # 기본 루트 파티션 사용량 확인
        disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    fi
    
    log_info "현재 디스크 사용량: ${disk_usage}%"
    
    # 경고 임계치 확인
    if [[ $disk_usage -ge 90 ]]; then
        log_error "디스크 사용량이 90%를 초과했습니다. 배포를 중단합니다."
        log_error "Docker 자원을 정리한 후 다시 시도하세요."
        return 1
    elif [[ $disk_usage -ge 80 ]]; then
        log_warning "디스크 사용량이 80%를 초과했습니다. Docker 자원 정리를 권장합니다."
    else
        log_success "디스크 사용량이 정상 범위입니다."
    fi
    
    return 0
}

# Docker 자원 정리 함수
cleanup_docker_resources() {
    local force_cleanup=${1:-false}
    
    log_info "Docker 자원 정리를 시작합니다..."
    
    # 디스크 사용량이 높거나 강제 정리 요청시 정리 실행
    if [[ "$force_cleanup" == "true" ]] || ! check_docker_disk_usage; then
        log_info "불필요한 Docker 자원을 정리합니다..."
        
        # 1. 중지된 컨테이너 제거
        log_info "중지된 컨테이너 제거 중..."
        local stopped_containers=$(docker container ls -aq --filter "status=exited")
        if [[ -n "$stopped_containers" ]]; then
            docker container rm $stopped_containers 2>/dev/null || true
            log_success "중지된 컨테이너 제거 완료"
        else
            log_info "제거할 중지된 컨테이너가 없습니다."
        fi
        
        # 2. Dangling 이미지 제거
        log_info "Dangling 이미지 제거 중..."
        local dangling_images=$(docker images -q --filter "dangling=true")
        if [[ -n "$dangling_images" ]]; then
            docker rmi $dangling_images 2>/dev/null || true
            log_success "Dangling 이미지 제거 완료"
        else
            log_info "제거할 Dangling 이미지가 없습니다."
        fi
        
        # 3. 사용하지 않는 네트워크 제거
        log_info "사용하지 않는 네트워크 제거 중..."
        docker network prune -f >/dev/null 2>&1 || true
        
        # 4. 사용하지 않는 볼륨 제거
        log_info "사용하지 않는 볼륨 제거 중..."
        docker volume prune -f >/dev/null 2>&1 || true
        
        # 5. 빌드 캐시 정리
        log_info "Docker 빌드 캐시 정리 중..."
        docker builder prune -f >/dev/null 2>&1 || true
        
        # 6. 시스템 정리 (추가적인 정리)
        log_info "Docker 시스템 정리 중..."
        docker system prune -f >/dev/null 2>&1 || true
        
        log_success "Docker 자원 정리 완료"
        
        # 정리 후 디스크 사용량 재확인
        check_docker_disk_usage
    else
        log_info "디스크 사용량이 정상 범위이므로 정리를 건너뜁니다."
    fi
}

# 이전 버전 이미지 정리
cleanup_old_images() {
    local service=$1
    local keep_versions=${2:-2}  # 최근 2개 버전만 보관
    
    log_info "${service}의 이전 버전 이미지 정리 중..."
    
    # ECR 레포지토리 이름 구성
    local repo_name="beacon-${service}"
    
    # 로컬에서 해당 서비스의 이미지 찾기
    local old_images=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${repo_name}" | tail -n +$((keep_versions + 1)))
    
    if [[ -n "$old_images" ]]; then
        log_info "제거할 이전 버전 이미지들:"
        echo "$old_images"
        
        echo "$old_images" | xargs -r docker rmi 2>/dev/null || true
        log_success "${service}의 이전 버전 이미지 정리 완료"
    else
        log_info "${service}의 정리할 이전 버전 이미지가 없습니다."
    fi
}

# 종속성 확인 및 설정
check_dependencies() {
    log_info "종속성 확인 중..."
    
    # 0. Docker 디스크 사용량 사전 확인
    if ! check_docker_disk_usage; then
        log_warning "디스크 사용량이 높습니다. Docker 자원 정리를 실행하시겠습니까? (y/n): "
        read -r cleanup_docker
        
        if [[ "$cleanup_docker" == "y" || "$cleanup_docker" == "Y" ]]; then
            cleanup_docker_resources true
            
            # 정리 후에도 디스크 사용량이 높으면 배포 중단
            if ! check_docker_disk_usage; then
                log_error "디스크 정리 후에도 사용량이 여전히 높습니다. 수동으로 디스크 공간을 확보해주세요."
                exit 1
            fi
        else
            log_warning "디스크 사용량이 높은 상태로 배포를 계속합니다."
        fi
    fi
    
    # 1. 도구 설치 확인 및 설치
    if ! install_tools; then
        log_error "필요한 도구를 설치하고 다시 실행하세요."
        exit 1
    fi
    
    # 2. AWS CLI 설정 확인
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_warning "AWS 인증이 설정되지 않았습니다."
        if ! setup_aws_cli; then
            log_error "AWS 설정에 실패했습니다."
            exit 1
        fi
        
        # 설정 후 재확인
        if ! aws sts get-caller-identity >/dev/null 2>&1; then
            log_error "AWS 인증 설정이 올바르지 않습니다."
            exit 1
        fi
    fi
    
    log_success "AWS 인증 확인됨: $(aws sts get-caller-identity --query 'Arn' --output text)"
    
    # 3. SSH 키 확인 및 생성
    if [[ ! -f "$SSH_KEY_PATH" ]]; then
        log_warning "SSH 키를 찾을 수 없습니다: $SSH_KEY_PATH"
        if ! setup_ssh_key; then
            log_error "SSH 키 설정에 실패했습니다."
            exit 1
        fi
    else
        # SSH 키 권한 확인
        chmod 600 "$SSH_KEY_PATH" 2>/dev/null || {
            log_error "SSH 키 권한을 설정할 수 없습니다: $SSH_KEY_PATH"
            exit 1
        }
        log_success "SSH 키 확인됨: $SSH_KEY_PATH"
    fi
    
    # 4. Docker 실행 상태 확인
    if ! docker info >/dev/null 2>&1; then
        log_warning "Docker가 실행되지 않았습니다."
        echo -e "${YELLOW}Docker를 시작하시겠습니까? (y/n): ${NC}"
        read -r start_docker
        
        if [[ "$start_docker" == "y" || "$start_docker" == "Y" ]]; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                log_info "Docker Desktop을 시작합니다..."
                open -a Docker
                log_info "Docker Desktop이 완전히 시작될 때까지 기다리는 중..."
                
                # Docker가 시작될 때까지 대기
                for i in {1..30}; do
                    if docker info >/dev/null 2>&1; then
                        log_success "Docker가 시작되었습니다."
                        break
                    fi
                    sleep 2
                    echo -n "."
                done
                echo
                
                if ! docker info >/dev/null 2>&1; then
                    log_error "Docker 시작에 실패했습니다. 수동으로 Docker Desktop을 시작하세요."
                    exit 1
                fi
            else
                log_info "Docker 서비스를 시작합니다..."
                sudo systemctl start docker || {
                    log_error "Docker 시작에 실패했습니다."
                    exit 1
                }
            fi
        else
            log_error "Docker가 필요합니다. Docker를 시작하고 다시 실행하세요."
            exit 1
        fi
    fi
    
    log_success "모든 종속성 확인 완료"
}

# ECR 빌드 및 푸시 함수
build_and_push_ecr() {
    local service=$1
    
    log_info "${service} ECR 빌드 및 푸시 시작..."
    
    # 빌드 전 이전 버전 이미지 정리
    cleanup_old_images ${service}
    
    # 디스크 사용량 재확인 (빌드 전)
    if ! check_docker_disk_usage; then
        log_warning "빌드 전 디스크 사용량이 높습니다. 추가 정리를 실행하시겠습니까? (y/n): "
        read -r additional_cleanup
        
        if [[ "$additional_cleanup" == "y" || "$additional_cleanup" == "Y" ]]; then
            cleanup_docker_resources true
        fi
    fi
    
    cd ../../${service}
    
    # 빌드 스크립트 실행
    if [[ -f "build.sh" ]]; then
        chmod +x build.sh
        
        # 빌드 실행 (오류 발생 시 재시도)
        local build_attempts=2
        local attempt=1
        
        while [[ $attempt -le $build_attempts ]]; do
            log_info "${service} 빌드 시도 ${attempt}/${build_attempts}"
            
            if ./build.sh ${IMAGE_TAG}; then
                log_success "${service} ECR 푸시 완료"
                break
            else
                if [[ $attempt -eq $build_attempts ]]; then
                    log_error "${service} 빌드가 실패했습니다."
                    
                    # 디스크 공간 부족이 원인일 수 있으므로 추가 정리 제안
                    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
                    if [[ $disk_usage -ge 85 ]]; then
                        log_error "디스크 사용량이 ${disk_usage}%입니다. 'no space left on device' 오류일 가능성이 높습니다."
                        log_error "수동으로 디스크 공간을 확보한 후 다시 시도하세요."
                        log_error "권장 명령어: docker system prune -a -f --volumes"
                    fi
                    exit 1
                else
                    log_warning "${service} 빌드 실패, Docker 자원 정리 후 재시도..."
                    cleanup_docker_resources true
                    sleep 5
                    ((attempt++))
                fi
            fi
        done
    else
        log_error "${service}/build.sh 파일을 찾을 수 없습니다."
        exit 1
    fi
    
    # 빌드 후 임시 이미지 정리
    log_info "${service} 빌드 후 임시 이미지 정리..."
    docker image prune -f >/dev/null 2>&1 || true
    
    cd - > /dev/null
}

# Terraform에서 인스턴스 정보 가져오기
get_instance_info() {
    local service=$1
    
    # stderr로 로그 출력하여 stdout과 분리
    log_info "${service} 인스턴스 정보 조회 중..." >&2
    
    # 현재 디렉토리 저장
    local original_dir=$(pwd)
    
    # Terraform 디렉토리로 이동
    local terraform_full_path="${original_dir}/${TERRAFORM_DIR}"
    log_info "Terraform 디렉토리로 이동: ${terraform_full_path}" >&2
    
    if [[ ! -d "${terraform_full_path}" ]]; then
        log_error "Terraform 디렉토리를 찾을 수 없습니다: ${terraform_full_path}" >&2
        return 1
    fi
    
    cd "${terraform_full_path}" || {
        log_error "Terraform 디렉토리로 이동할 수 없습니다: ${terraform_full_path}" >&2
        return 1
    }
    
    # Terraform 초기화 확인
    if [[ ! -d ".terraform" ]]; then
        log_info "Terraform 초기화 중..." >&2
        terraform init >&2 || {
            log_error "Terraform 초기화 실패" >&2
            cd "${original_dir}"
            return 1
        }
    fi
    
    # 인스턴스 IP 조회
    local instance_ip
    local terraform_output_error
    
    if [[ "$service" == "frontend" ]]; then
        instance_ip=$(terraform output -raw frontend_instance_public_ip 2>&1)
        terraform_output_error=$?
    elif [[ "$service" == "backend" ]]; then
        instance_ip=$(terraform output -raw backend_instance_public_ip 2>&1)
        terraform_output_error=$?
    else
        log_error "알 수 없는 서비스: ${service}" >&2
        cd "${original_dir}"
        return 1
    fi
    
    # Terraform 명령어 실행 오류 확인
    if [[ $terraform_output_error -ne 0 ]]; then
        log_error "Terraform output 명령어 실행 실패: ${instance_ip}" >&2
        cd "${original_dir}"
        return 1
    fi
    
    # IP 유효성 검사 (더 정확한 검증)
    if [[ -z "$instance_ip" ]] || [[ "$instance_ip" == "null" ]] || [[ "$instance_ip" == *"Error"* ]] || [[ "$instance_ip" == *"not deployed"* ]]; then
        log_error "${service} 인스턴스가 배포되지 않았거나 정보를 가져올 수 없습니다." >&2
        log_error "Terraform output 결과: ${instance_ip}" >&2
        cd "${original_dir}"
        return 1
    fi
    
    # IP 형식 검증 (간단한 IP 형식 체크)
    if ! [[ "$instance_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_error "${service} 인스턴스 IP 형식이 올바르지 않습니다: ${instance_ip}" >&2
        cd "${original_dir}"
        return 1
    fi
    
    cd "${original_dir}"
    log_success "${service} 인스턴스 IP 조회 성공: ${instance_ip}" >&2
    echo "$instance_ip"
}

# SSH 연결 테스트 함수
test_ssh_connection() {
    local instance_ip=$1
    local max_attempts=3
    
    for attempt in $(seq 1 $max_attempts); do
        log_info "SSH 연결 테스트 중... (시도 ${attempt}/${max_attempts}) - IP: ${instance_ip}"
        
        if ssh -i "$SSH_KEY_PATH" \
               -o StrictHostKeyChecking=no \
               -o ConnectTimeout=10 \
               -o BatchMode=yes \
               ${SSH_USER}@${instance_ip} "echo 'SSH connection successful'" > /dev/null 2>&1; then
            log_success "SSH 연결 성공"
            return 0
        else
            log_warning "SSH 연결 실패 (시도 ${attempt}/${max_attempts})"
            if [[ $attempt -lt $max_attempts ]]; then
                sleep 5
            fi
        fi
    done
    
    log_error "SSH 연결 최종 실패: ${instance_ip}"
    log_info "문제 해결 방법:"
    log_info "1. EC2 Security Group에서 SSH(22) 포트가 열려있는지 확인"
    log_info "2. EC2 인스턴스에 SSH 키가 등록되어 있는지 확인"
    log_info "3. 네트워크 연결 상태 확인"
    return 1
}

# SSH로 EC2에서 컨테이너 재시작
restart_container_on_ec2() {
    local service=$1
    local instance_ip=$2
    local ecr_image="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/beacon-${service}:${IMAGE_TAG}"
    
    log_info "${service} 컨테이너 재시작 중 (${instance_ip})..."
    log_info "DEBUG: service=$service, instance_ip=$instance_ip, ecr_image=$ecr_image"
    
    # SSH 연결 테스트
    if ! test_ssh_connection ${instance_ip}; then
        return 1
    fi
    
    # 컨테이너 업데이트 스크립트
    local update_script=$(cat << 'EOF'
set -e

# 환경 변수
SERVICE=$1
ECR_IMAGE=$2
AWS_REGION=$3

echo "=== Updating ${SERVICE} container ==="

# 디스크 사용량 확인
echo "디스크 사용량 확인 중..."
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
echo "현재 디스크 사용량: ${DISK_USAGE}%"

if [[ $DISK_USAGE -ge 85 ]]; then
    echo "디스크 사용량이 높습니다. Docker 자원 정리를 실행합니다..."
    
    # Docker 자원 정리
    echo "중지된 컨테이너 제거 중..."
    docker container prune -f >/dev/null 2>&1 || true
    
    echo "사용하지 않는 이미지 제거 중..."
    docker image prune -a -f >/dev/null 2>&1 || true
    
    echo "빌드 캐시 정리 중..."
    docker builder prune -f >/dev/null 2>&1 || true
    
    echo "Docker 시스템 정리 중..."
    docker system prune -f >/dev/null 2>&1 || true
    
    # 정리 후 디스크 사용량 재확인
    DISK_USAGE_AFTER=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    echo "정리 후 디스크 사용량: ${DISK_USAGE_AFTER}%"
    
    if [[ $DISK_USAGE_AFTER -ge 90 ]]; then
        echo "ERROR: 디스크 정리 후에도 사용량이 90%를 초과합니다. 배포를 중단합니다."
        exit 1
    fi
fi

# 기존 컨테이너 중지 및 제거 (이미지 pull 전에 먼저 실행)
echo "기존 컨테이너 중지 중..."
docker stop beacon-${SERVICE} 2>/dev/null || echo "컨테이너가 실행 중이 아닙니다."
docker rm beacon-${SERVICE} 2>/dev/null || echo "컨테이너가 존재하지 않습니다."

# 이전 버전 이미지 정리
echo "이전 버전 이미지 정리 중..."
OLD_IMAGES=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "beacon-${SERVICE}" | grep -v "${ECR_IMAGE}" | head -5)
if [[ -n "$OLD_IMAGES" ]]; then
    echo "$OLD_IMAGES" | xargs -r docker rmi 2>/dev/null || true
fi

# ECR 로그인
echo "ECR 로그인 중..."
ECR_REGISTRY="933851512157.dkr.ecr.ap-northeast-2.amazonaws.com"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

# 새 이미지 pull (재시도 로직 포함)
echo "새 이미지 pull 중: ${ECR_IMAGE}"
PULL_ATTEMPTS=3
PULL_SUCCESS=false

for attempt in $(seq 1 $PULL_ATTEMPTS); do
    echo "이미지 pull 시도 ${attempt}/${PULL_ATTEMPTS}"
    
    if docker pull ${ECR_IMAGE}; then
        echo "이미지 pull 성공"
        PULL_SUCCESS=true
        break
    else
        echo "이미지 pull 실패 (시도 ${attempt}/${PULL_ATTEMPTS})"
        
        if [[ $attempt -lt $PULL_ATTEMPTS ]]; then
            # 실패 시 추가 정리 수행
            echo "추가 Docker 자원 정리 중..."
            docker system prune -f >/dev/null 2>&1 || true
            sleep 5
        fi
    fi
done

if [[ "$PULL_SUCCESS" != "true" ]]; then
    echo "ERROR: 이미지 pull이 최종 실패했습니다. 디스크 공간을 확인해주세요."
    FINAL_DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    echo "현재 디스크 사용량: ${FINAL_DISK_USAGE}%"
    exit 1
fi

# 새 컨테이너 시작
echo "새 컨테이너 시작 중..."
if [[ "${SERVICE}" == "frontend" ]]; then
    # ConfigMap 방식으로 nginx 설정 준비
    echo "Setting up nginx configuration with ConfigMap..."
    mkdir -p /tmp/nginx-config
    
    cat > /tmp/nginx-config/nginx.conf << 'NGINX_EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 0;

    # Gzip Settings
    gzip on;
    gzip_vary on;
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

    # Include additional configurations
    include /etc/nginx/conf.d/*.conf;
}
NGINX_EOF
    
    echo "Custom nginx configuration created with client_max_body_size 0 (unlimited)"
    
    # Frontend 컨테이너 시작 (ConfigMap nginx 설정 포함)
    docker run -d \
      --name beacon-frontend \
      --restart unless-stopped \
      -p 80:80 \
      -v /tmp/nginx-config/nginx.conf:/etc/nginx/nginx.conf.mounted:ro \
      -e BACKEND_HOST=api.beacon.sk-shieldus.com \
      -e BACKEND_PORT=443 \
      -e BACKEND_PROTOCOL=https \
      ${ECR_IMAGE}
elif [[ "${SERVICE}" == "backend" ]]; then
    docker run -d \
      --name beacon-backend \
      --restart unless-stopped \
      -p 80:5000 \
      ${ECR_IMAGE}
fi

# 컨테이너 시작 후 임시 이미지 정리
echo "임시 이미지 정리 중..."
docker image prune -f >/dev/null 2>&1 || true

# 컨테이너 상태 확인
sleep 5
docker ps --filter "name=beacon-${SERVICE}"

echo "=== ${SERVICE} 컨테이너 업데이트 완료 ==="
EOF
)
    
    # SSH로 스크립트 실행
    if ssh -i "$SSH_KEY_PATH" \
           -o StrictHostKeyChecking=no \
           ${SSH_USER}@${instance_ip} "bash -s ${service} ${ecr_image} ${AWS_REGION}" <<< "${update_script}"; then
        log_success "${service} 컨테이너 업데이트 완료"
    else
        log_error "${service} 컨테이너 업데이트 실패"
        return 1
    fi
}

# 헬스 체크 함수
health_check() {
    local service=$1
    local instance_ip=$2
    
    log_info "${service} 헬스 체크 중..."
    
    local health_endpoint
    if [[ "$service" == "frontend" ]]; then
        health_endpoint="/health"
    elif [[ "$service" == "backend" ]]; then
        health_endpoint="/api/weather"
    fi
    
    # 헬스 체크 (최대 10번 시도)
    for i in {1..10}; do
        if ssh -i "$SSH_KEY_PATH" \
               -o StrictHostKeyChecking=no \
               ${SSH_USER}@${instance_ip} \
               "curl -f http://localhost${health_endpoint}" > /dev/null 2>&1; then
            log_success "${service} 헬스 체크 성공 (시도 ${i}/10)"
            return 0
        else
            log_warning "${service} 헬스 체크 실패 (시도 ${i}/10), 10초 후 재시도..."
            sleep 10
        fi
    done
    
    log_error "${service} 헬스 체크 최종 실패"
    return 1
}

# 서비스 배포 함수
deploy_service() {
    local service=$1
    
    log_info "=== $(echo ${service} | tr '[:lower:]' '[:upper:]') 배포 시작 ==="
    
    # 1. ECR 빌드 및 푸시
    log_info "1단계: ECR 빌드 및 푸시 시작..."
    if ! build_and_push_ecr ${service}; then
        log_error "${service} ECR 빌드/푸시 실패"
        return 1
    fi
    log_success "ECR 빌드/푸시 완료"
    
    # 2. 인스턴스 정보 조회
    log_info "2단계: 인스턴스 정보 조회 중..."
    local instance_ip
    instance_ip=$(get_instance_info ${service})
    if [[ $? -ne 0 ]]; then
        log_error "${service} 배포 실패: 인스턴스 정보 조회 실패"
        return 1
    fi
    
    log_info "${service} 인스턴스 IP: ${instance_ip}"
    
    # IP 검증
    if [[ -z "${instance_ip}" ]]; then
        log_error "${service} 인스턴스 IP를 가져올 수 없습니다"
        return 1
    fi
    
    # 3. 컨테이너 재시작
    log_info "3단계: 컨테이너 재시작 중..."
    log_info "DEBUG deploy_service: service=${service}, instance_ip=${instance_ip}"
    if ! restart_container_on_ec2 ${service} ${instance_ip}; then
        log_error "${service} 컨테이너 재시작 실패"
        return 1
    fi
    log_success "컨테이너 재시작 완료"
    
    # 4. 헬스 체크
    log_info "4단계: 헬스 체크 중..."
    if ! health_check ${service} ${instance_ip}; then
        log_error "${service} 헬스 체크 실패"
        return 1
    fi
    log_success "헬스 체크 완료"
    
    log_success "=== $(echo ${service} | tr '[:lower:]' '[:upper:]') 배포 완료 ==="
}

# 플래그 파싱 함수
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-setup)
                SKIP_SETUP_CHECK=true
                shift
                ;;
            --force-cleanup)
                FORCE_CLEANUP=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                if [[ -z "$DEPLOY_TARGET" ]]; then
                    DEPLOY_TARGET="$1"
                elif [[ "$IMAGE_TAG" == "latest" ]]; then
                    IMAGE_TAG="$1"
                fi
                shift
                ;;
        esac
    done
    
    # 기본값 설정
    DEPLOY_TARGET=${DEPLOY_TARGET:-"all"}
}

# 메인 실행 함수
main() {
    # 인수 파싱
    parse_arguments "$@"
    
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}🚀 BEACON Production 배포 스크립트${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "배포 대상: ${GREEN}${DEPLOY_TARGET}${NC}"
    echo -e "이미지 태그: ${GREEN}${IMAGE_TAG}${NC}"
    echo -e "SSH 키 경로: ${GREEN}${SSH_KEY_PATH}${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    # setup-guide 실행 여부 확인 및 자동 실행
    if [[ "$SKIP_SETUP_CHECK" != "true" ]]; then
        if ! check_setup_guide_completion; then
            run_setup_guide
        fi
    else
        log_warning "--skip-setup 플래그가 설정되어 setup-guide 체크를 건너뜁니다."
    fi
    
    # cleanup 옵션 처리
    if [[ "$DEPLOY_TARGET" == "cleanup" ]]; then
        log_info "Docker 자원 정리를 실행합니다..."
        cleanup_docker_resources true
        
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}🧹 Docker 자원 정리 완료!${NC}"
        echo -e "${GREEN}========================================${NC}"
        
        # 정리 후 상태 표시
        echo "디스크 사용량 상태:"
        df -h | head -2
        echo ""
        echo "Docker 이미지 상태:"
        docker images | head -5
        
        exit 0
    fi
    
    # 강제 정리 옵션 처리
    if [[ "$FORCE_CLEANUP" == "true" ]]; then
        log_info "배포 전 강제 Docker 자원 정리를 실행합니다..."
        cleanup_docker_resources true
    fi
    
    # 종속성 확인 (간소화된 버전 - setup-guide에서 대부분 확인됨)
    check_dependencies
    
    # 배포 실행
    case $DEPLOY_TARGET in
        "all")
            log_info "Frontend와 Backend를 순차적으로 배포합니다..."
            if deploy_service "frontend"; then
                log_success "Frontend 배포 성공, Backend 배포를 시작합니다..."
                deploy_service "backend"
            else
                log_error "Frontend 배포 실패로 인해 Backend 배포를 중단합니다."
                exit 1
            fi
            ;;
        "frontend")
            deploy_service "frontend"
            ;;
        "backend")
            deploy_service "backend"
            ;;
        *)
            log_error "잘못된 배포 대상: $DEPLOY_TARGET"
            usage
            ;;
    esac
    
    # 배포 완료 메시지
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}🎉 배포 완료!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "Frontend URL: ${BLUE}https://beacon.sk-shieldus.com${NC}"
    echo -e "Backend URL:  ${BLUE}https://api.beacon.sk-shieldus.com${NC}"
    echo -e "${GREEN}========================================${NC}"
}

# 스크립트 실행
main "$@"