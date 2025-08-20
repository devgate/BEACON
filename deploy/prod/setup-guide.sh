#!/bin/bash

# BEACON Production 환경 설정 가이드 스크립트
# 배포에 필요한 모든 종속성을 단계별로 설정합니다.

set -e

# 색깔 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

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

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# 사용자 입력 대기 함수
wait_for_user() {
    echo -e "${YELLOW}계속하려면 Enter를 누르세요...${NC}"
    read -r
}

# 환경 설정 완성 체크리스트
check_setup_completion() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}🔍 BEACON 배포 환경 설정 상태 확인${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    local all_good=true
    
    # 1. 도구 설치 확인
    echo -e "${PURPLE}1. 필수 도구 설치 상태:${NC}"
    
    if command -v aws &> /dev/null; then
        echo -e "   ✅ AWS CLI: $(aws --version | head -1)"
    else
        echo -e "   ❌ AWS CLI: 설치되지 않음"
        all_good=false
    fi
    
    if command -v terraform &> /dev/null; then
        echo -e "   ✅ Terraform: $(terraform version | head -1)"
    else
        echo -e "   ❌ Terraform: 설치되지 않음"
        all_good=false
    fi
    
    if command -v docker &> /dev/null; then
        if docker info >/dev/null 2>&1; then
            echo -e "   ✅ Docker: $(docker --version) (실행 중)"
        else
            echo -e "   ⚠️ Docker: $(docker --version) (실행되지 않음)"
            all_good=false
        fi
    else
        echo -e "   ❌ Docker: 설치되지 않음"
        all_good=false
    fi
    
    # 2. AWS 인증 확인
    echo -e "${PURPLE}2. AWS 인증 설정:${NC}"
    
    if aws sts get-caller-identity >/dev/null 2>&1; then
        local aws_user=$(aws sts get-caller-identity --query 'Arn' --output text 2>/dev/null)
        echo -e "   ✅ AWS 인증: $aws_user"
    else
        echo -e "   ❌ AWS 인증: 설정되지 않음"
        all_good=false
    fi
    
    # 3. SSH 키 확인
    echo -e "${PURPLE}3. SSH 키 설정:${NC}"
    
    if [[ -f ~/.ssh/id_rsa ]]; then
        echo -e "   ✅ SSH 개인 키: ~/.ssh/id_rsa"
        if [[ -f ~/.ssh/id_rsa.pub ]]; then
            echo -e "   ✅ SSH 공개 키: ~/.ssh/id_rsa.pub"
            echo -e "   📋 공개 키 내용:"
            echo -e "      ${GREEN}$(cat ~/.ssh/id_rsa.pub)${NC}"
        else
            echo -e "   ❌ SSH 공개 키: ~/.ssh/id_rsa.pub 없음"
            all_good=false
        fi
    else
        echo -e "   ❌ SSH 키: ~/.ssh/id_rsa 없음"
        all_good=false
    fi
    
    # 4. Terraform 상태 확인
    echo -e "${PURPLE}4. 인프라 배포 상태:${NC}"
    
    if [[ -f "../../infra/terraform/terraform.tfstate" ]] || [[ -f "../../infra/terraform/.terraform/terraform.tfstate" ]]; then
        echo -e "   ✅ Terraform 상태: 배포됨"
        
        # 인스턴스 IP 확인
        cd ../../infra/terraform
        local frontend_ip=$(terraform output -raw frontend_instance_public_ip 2>/dev/null)
        local backend_ip=$(terraform output -raw backend_instance_public_ip 2>/dev/null)
        cd - > /dev/null
        
        if [[ "$frontend_ip" != "Frontend not deployed" && -n "$frontend_ip" && "$frontend_ip" != "null" ]]; then
            echo -e "   ✅ Frontend 인스턴스: $frontend_ip"
        else
            echo -e "   ⚠️ Frontend 인스턴스: 배포되지 않음"
        fi
        
        if [[ "$backend_ip" != "Backend not deployed" && -n "$backend_ip" && "$backend_ip" != "null" ]]; then
            echo -e "   ✅ Backend 인스턴스: $backend_ip"
        else
            echo -e "   ⚠️ Backend 인스턴스: 배포되지 않음"
        fi
    else
        echo -e "   ❌ Terraform 상태: 인프라가 배포되지 않음"
        all_good=false
    fi
    
    echo -e "${BLUE}========================================${NC}"
    
    if $all_good; then
        echo -e "${GREEN}🎉 모든 설정이 완료되었습니다!${NC}"
        echo -e "${GREEN}이제 './deploy.sh' 명령어로 배포할 수 있습니다.${NC}"
        return 0
    else
        echo -e "${RED}⚠️ 일부 설정이 완료되지 않았습니다.${NC}"
        echo -e "${YELLOW}설정을 완료하려면 이 스크립트의 가이드를 따라하세요.${NC}"
        return 1
    fi
}

# 운영체제별 도구 설치 가이드
install_tools_guide() {
    log_step "1. 필수 도구 설치"
    
    # 운영체제 및 아키텍처 감지
    if [[ "$OSTYPE" == "darwin"* ]]; then
        local arch=$(uname -m)
        if [[ "$arch" == "arm64" ]]; then
            echo -e "${BLUE}macOS Apple Silicon (M1/M2) 환경이 감지되었습니다.${NC}"
        else
            echo -e "${BLUE}macOS Intel 환경이 감지되었습니다.${NC}"
        fi
        
        # Homebrew 확인 및 설치
        if ! command -v brew &> /dev/null; then
            log_warning "Homebrew가 설치되지 않았습니다."
            echo -e "${YELLOW}Homebrew를 자동으로 설치하시겠습니까? (y/n):${NC}"
            read -r install_brew
            
            if [[ "$install_brew" == "y" || "$install_brew" == "Y" ]]; then
                log_info "Homebrew 설치 중..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                
                # Apple Silicon의 경우 PATH 추가
                if [[ "$arch" == "arm64" ]]; then
                    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
                    eval "$(/opt/homebrew/bin/brew shellenv)"
                fi
                
                log_success "Homebrew가 설치되었습니다."
            else
                echo -e "다음 명령어로 Homebrew를 수동으로 설치하세요:"
                echo -e "${GREEN}/bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"${NC}"
                wait_for_user
                return 1
            fi
        fi
        
        echo -e "${YELLOW}누락된 도구를 자동으로 설치하시겠습니까? (y/n):${NC}"
        read -r install_choice
        
        if [[ "$install_choice" == "y" || "$install_choice" == "Y" ]]; then
            if ! command -v aws &> /dev/null; then
                log_info "AWS CLI 설치 중... (Apple Silicon 최적화)"
                if [[ "$arch" == "arm64" ]]; then
                    # Apple Silicon용 AWS CLI 직접 설치
                    curl "https://awscli.amazonaws.com/AWSCLIV2-arm64.pkg" -o "AWSCLIV2.pkg"
                    sudo installer -pkg AWSCLIV2.pkg -target /
                    rm AWSCLIV2.pkg
                else
                    brew install awscli
                fi
            fi
            
            if ! command -v terraform &> /dev/null; then
                log_info "Terraform 설치 중... (Apple Silicon 최적화)"
                if [[ "$arch" == "arm64" ]]; then
                    # Apple Silicon용 Terraform 직접 설치
                    local terraform_version="1.6.6"
                    curl -LO "https://releases.hashicorp.com/terraform/${terraform_version}/terraform_${terraform_version}_darwin_arm64.zip"
                    unzip "terraform_${terraform_version}_darwin_arm64.zip"
                    sudo mv terraform /usr/local/bin/
                    rm "terraform_${terraform_version}_darwin_arm64.zip"
                else
                    brew install terraform
                fi
            fi
            
            if ! command -v docker &> /dev/null; then
                log_info "Docker Desktop 설치 중... (Apple Silicon 최적화)"
                if [[ "$arch" == "arm64" ]]; then
                    # Apple Silicon용 Docker Desktop 직접 설치
                    curl -L "https://desktop.docker.com/mac/main/arm64/Docker.dmg" -o "Docker.dmg"
                    sudo hdiutil attach Docker.dmg
                    sudo cp -rf /Volumes/Docker/Docker.app /Applications/
                    sudo hdiutil detach /Volumes/Docker
                    rm Docker.dmg
                    log_warning "Docker Desktop이 설치되었습니다. Applications 폴더에서 실행해주세요."
                else
                    brew install --cask docker
                fi
                log_warning "설치 후 Docker Desktop 앱을 실행해야 합니다."
            fi
            
            log_success "모든 도구가 설치되었습니다."
        else
            echo -e "${BLUE}수동 설치 명령어 (Apple Silicon 최적화):${NC}"
            if [[ "$arch" == "arm64" ]]; then
                echo -e "AWS CLI: curl \"https://awscli.amazonaws.com/AWSCLIV2-arm64.pkg\" -o \"AWSCLIV2.pkg\" && sudo installer -pkg AWSCLIV2.pkg -target /"
                echo -e "Terraform: brew install terraform"
                echo -e "Docker: https://desktop.docker.com/mac/main/arm64/Docker.dmg"
            else
                echo -e "brew install awscli terraform"
                echo -e "brew install --cask docker"
            fi
        fi
        
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo -e "${BLUE}Linux 환경이 감지되었습니다.${NC}"
        
        echo -e "${YELLOW}누락된 도구를 자동으로 설치하시겠습니까? (y/n):${NC}"
        read -r install_choice
        
        if [[ "$install_choice" == "y" || "$install_choice" == "Y" ]]; then
            if ! command -v aws &> /dev/null; then
                log_info "AWS CLI 설치 중..."
                curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
                unzip awscliv2.zip
                sudo ./aws/install
                rm -rf awscliv2.zip aws/
            fi
            
            if ! command -v terraform &> /dev/null; then
                log_info "Terraform 설치 중..."
                wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
                echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
                sudo apt update && sudo apt install terraform
            fi
            
            if ! command -v docker &> /dev/null; then
                log_info "Docker 설치 중..."
                curl -fsSL https://get.docker.com -o get-docker.sh
                sudo sh get-docker.sh
                sudo usermod -aG docker $USER
                rm get-docker.sh
                log_warning "Docker 그룹 변경사항을 적용하려면 로그아웃 후 다시 로그인하세요."
            fi
        else
            echo -e "${BLUE}수동 설치 가이드:${NC}"
            echo -e "AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
            echo -e "Terraform: https://learn.hashicorp.com/tutorials/terraform/install-cli"
            echo -e "Docker: https://docs.docker.com/get-docker/"
        fi
    else
        log_warning "지원되지 않는 운영체제입니다."
        echo -e "${BLUE}수동 설치 가이드:${NC}"
        echo -e "AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        echo -e "Terraform: https://learn.hashicorp.com/tutorials/terraform/install-cli"
        echo -e "Docker: https://docs.docker.com/get-docker/"
    fi
    
    log_success "도구 설치 가이드 완료"
    wait_for_user
}

# AWS 자격증명 설정 가이드
setup_aws_credentials() {
    log_step "2. AWS 자격증명 설정"
    
    if aws sts get-caller-identity >/dev/null 2>&1; then
        local aws_user=$(aws sts get-caller-identity --query 'Arn' --output text)
        log_success "AWS 인증이 이미 설정되어 있습니다: $aws_user"
        wait_for_user
        return 0
    fi
    
    echo -e "${YELLOW}AWS 자격증명 설정 방법을 선택하세요:${NC}"
    echo -e "1. 대화형 설정 (aws configure) - 추천"
    echo -e "2. 환경변수 설정 (임시)"
    echo -e "3. 건너뛰기"
    
    echo -e "${YELLOW}선택 (1-3):${NC}"
    read -r aws_choice
    
    case $aws_choice in
        1)
            log_info "AWS CLI 대화형 설정을 시작합니다..."
            echo -e "${BLUE}AWS 콘솔에서 IAM > 보안 자격증명에서 액세스 키를 생성하세요.${NC}"
            aws configure
            ;;
        2)
            echo -e "${YELLOW}AWS Access Key ID를 입력하세요:${NC}"
            read -r aws_access_key
            echo -e "${YELLOW}AWS Secret Access Key를 입력하세요:${NC}"
            read -s aws_secret_key
            echo -e "${YELLOW}기본 리전을 입력하세요 (기본값: ap-northeast-2):${NC}"
            read -r aws_region
            
            aws_region=${aws_region:-"ap-northeast-2"}
            
            export AWS_ACCESS_KEY_ID="$aws_access_key"
            export AWS_SECRET_ACCESS_KEY="$aws_secret_key"
            export AWS_DEFAULT_REGION="$aws_region"
            
            log_success "환경변수로 AWS 자격증명이 설정되었습니다."
            log_warning "환경변수 설정은 현재 터미널 세션에서만 유효합니다."
            ;;
        3)
            log_info "AWS 설정을 건너뜁니다."
            ;;
        *)
            log_error "잘못된 선택입니다."
            return 1
            ;;
    esac
    
    wait_for_user
}

# SSH 키 생성 가이드
setup_ssh_key() {
    log_step "3. SSH 키 설정"
    
    if [[ -f ~/.ssh/id_rsa ]]; then
        log_success "SSH 키가 이미 존재합니다: ~/.ssh/id_rsa"
        echo -e "${BLUE}공개 키 내용:${NC}"
        echo -e "${GREEN}$(cat ~/.ssh/id_rsa.pub)${NC}"
        wait_for_user
        return 0
    fi
    
    echo -e "${YELLOW}SSH 키를 생성하시겠습니까? (y/n):${NC}"
    read -r create_key
    
    if [[ "$create_key" == "y" || "$create_key" == "Y" ]]; then
        log_info "SSH 키를 생성합니다..."
        
        # SSH 디렉토리 생성
        mkdir -p ~/.ssh
        chmod 700 ~/.ssh
        
        # SSH 키 생성
        ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N "" -q
        
        log_success "SSH 키가 생성되었습니다!"
        
        echo -e "${BLUE}========================================${NC}"
        echo -e "${BLUE}🔑 생성된 SSH 공개 키${NC}"
        echo -e "${BLUE}========================================${NC}"
        echo -e "${GREEN}$(cat ~/.ssh/id_rsa.pub)${NC}"
        echo -e "${BLUE}========================================${NC}"
        
        log_warning "위의 공개 키를 복사하여 EC2 인스턴스에 등록해야 합니다."
    else
        log_info "SSH 키 생성을 건너뜁니다."
    fi
    
    wait_for_user
}

# Terraform 인프라 배포 가이드
setup_infrastructure() {
    log_step "4. 인프라 배포 확인"
    
    if [[ -f "../../infra/terraform/terraform.tfstate" ]] || [[ -f "../../infra/terraform/.terraform/terraform.tfstate" ]]; then
        log_success "Terraform 인프라가 이미 배포되어 있습니다."
        
        cd ../../infra/terraform
        terraform output
        cd - > /dev/null
        
        wait_for_user
        return 0
    fi
    
    log_warning "Terraform 인프라가 배포되지 않았습니다."
    
    echo -e "${YELLOW}인프라를 배포하시겠습니까? (y/n):${NC}"
    read -r deploy_infra
    
    if [[ "$deploy_infra" == "y" || "$deploy_infra" == "Y" ]]; then
        log_info "Terraform 인프라 배포를 시작합니다..."
        
        cd ../../infra/terraform
        
        if [[ -f "deploy.sh" ]]; then
            chmod +x deploy.sh
            ./deploy.sh
        else
            log_info "수동 배포 진행..."
            terraform init
            terraform plan
            
            echo -e "${YELLOW}배포를 계속하시겠습니까? (y/n):${NC}"
            read -r continue_deploy
            
            if [[ "$continue_deploy" == "y" || "$continue_deploy" == "Y" ]]; then
                terraform apply
            else
                log_info "배포를 중단합니다."
                cd - > /dev/null
                return 1
            fi
        fi
        
        cd - > /dev/null
        log_success "인프라 배포가 완료되었습니다."
    else
        log_info "인프라 배포를 건너뜁니다."
        log_warning "배포 스크립트를 사용하려면 먼저 인프라를 배포해야 합니다."
    fi
    
    wait_for_user
}

# Docker 설정 확인
check_docker() {
    log_step "5. Docker 실행 상태 확인"
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker가 설치되지 않았습니다."
        return 1
    fi
    
    if docker info >/dev/null 2>&1; then
        log_success "Docker가 실행 중입니다."
        wait_for_user
        return 0
    fi
    
    log_warning "Docker가 실행되지 않았습니다."
    
    echo -e "${YELLOW}Docker를 시작하시겠습니까? (y/n):${NC}"
    read -r start_docker
    
    if [[ "$start_docker" == "y" || "$start_docker" == "Y" ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            log_info "Docker Desktop을 시작합니다..."
            open -a Docker
            
            log_info "Docker가 시작될 때까지 대기 중..."
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
                return 1
            fi
        else
            log_info "Docker 서비스를 시작합니다..."
            sudo systemctl start docker
        fi
    else
        log_warning "Docker를 수동으로 시작하세요."
    fi
    
    wait_for_user
}

# 메인 함수
main() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}🛠️ BEACON Production 환경 설정 가이드${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "이 스크립트는 BEACON 배포에 필요한 모든 환경을 설정합니다."
    echo
    
    # 현재 상태 확인
    if check_setup_completion; then
        echo -e "${YELLOW}설정을 다시 진행하시겠습니까? (y/n):${NC}"
        read -r redo_setup
        
        if [[ "$redo_setup" != "y" && "$redo_setup" != "Y" ]]; then
            echo -e "${GREEN}설정이 완료되어 있습니다. 배포를 진행하세요!${NC}"
            exit 0
        fi
    fi
    
    echo
    echo -e "${BLUE}단계별 설정을 시작합니다...${NC}"
    echo
    
    # 단계별 설정 실행
    install_tools_guide
    setup_aws_credentials  
    setup_ssh_key
    setup_infrastructure
    check_docker
    
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}🎉 설정 가이드 완료!${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    # 최종 상태 확인
    check_setup_completion
    
    if [[ $? -eq 0 ]]; then
        echo
        echo -e "${GREEN}이제 다음 명령어로 배포할 수 있습니다:${NC}"
        echo -e "${BLUE}./deploy.sh all latest${NC}"
    fi
}

# 스크립트 실행
main "$@"