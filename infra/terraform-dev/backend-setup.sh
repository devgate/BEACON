#!/bin/bash

# Script to set up S3 backend for Terraform state management
# This enables team collaboration by storing state in S3

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Terraform S3 Backend Setup${NC}"
echo -e "${GREEN}======================================${NC}\n"

# Configuration
AWS_REGION=${AWS_REGION:-"ap-northeast-2"}
AWS_PROFILE=${AWS_PROFILE:-"default"}

# Function to check if S3 bucket exists
check_s3_bucket() {
    local bucket_name=$1
    aws s3api head-bucket --bucket "$bucket_name" --profile "$AWS_PROFILE" 2>/dev/null && return 0 || return 1
}

# Function to get S3 bucket name from prod terraform
get_bucket_name() {
    echo -e "${YELLOW}Getting S3 bucket name from production Terraform...${NC}"
    
    cd ../terraform
    
    # Check if state backend module has been applied
    if terraform state list | grep -q "module.state_backend"; then
        BUCKET_NAME=$(terraform output -raw -json | jq -r '.state_backend_bucket.value' 2>/dev/null || echo "")
        
        if [ -z "$BUCKET_NAME" ]; then
            # Try alternative method
            BUCKET_NAME=$(terraform state show module.state_backend.aws_s3_bucket.terraform_state | grep "bucket" | head -1 | awk -F'"' '{print $2}')
        fi
        
        if [ -n "$BUCKET_NAME" ]; then
            echo -e "${GREEN}✓ Found S3 bucket: $BUCKET_NAME${NC}"
            return 0
        fi
    fi
    
    echo -e "${RED}Could not find S3 bucket. Please create it first.${NC}"
    return 1
}

# Function to create backend infrastructure
create_backend_infra() {
    echo -e "${YELLOW}Creating S3 backend infrastructure...${NC}\n"
    
    cd ../terraform
    
    # Initialize if needed
    if [ ! -d ".terraform" ]; then
        terraform init
    fi
    
    # Create only the state backend module
    echo -e "${YELLOW}Creating S3 bucket and DynamoDB table for state management...${NC}"
    terraform apply -target=module.state_backend -auto-approve
    
    echo -e "${GREEN}✓ Backend infrastructure created!${NC}"
}

# Function to initialize dev backend
init_dev_backend() {
    local bucket_name=$1
    
    echo -e "${YELLOW}Initializing dev environment with S3 backend...${NC}\n"
    
    cd ../terraform-dev
    
    # Create backend config file
    cat > backend-config.hcl << EOF
bucket         = "$bucket_name"
key            = "dev/terraform.tfstate"
region         = "$AWS_REGION"
dynamodb_table = "beacon-terraform-locks"
encrypt        = true
EOF
    
    echo -e "${GREEN}✓ Backend configuration created${NC}"
    
    # Initialize with backend
    echo -e "${YELLOW}Initializing Terraform with S3 backend...${NC}"
    terraform init -backend-config=backend-config.hcl
    
    echo -e "${GREEN}✓ Terraform initialized with S3 backend!${NC}"
}

# Function to show current backend status
show_status() {
    echo -e "${BLUE}Current Backend Configuration:${NC}\n"
    
    cd ../terraform-dev
    
    if [ -f ".terraform/terraform.tfstate" ]; then
        cat .terraform/terraform.tfstate | jq '.backend'
    else
        echo "Backend not initialized yet."
    fi
}

# Main logic
main() {
    case "${1:-}" in
        setup)
            echo -e "${YELLOW}Setting up S3 backend for team collaboration...${NC}\n"
            
            # Check if backend infrastructure exists
            if get_bucket_name; then
                echo -e "${GREEN}Backend infrastructure already exists.${NC}"
            else
                echo -e "${YELLOW}Backend infrastructure not found. Creating...${NC}"
                create_backend_infra
                get_bucket_name
            fi
            
            # Initialize dev environment with backend
            if [ -n "$BUCKET_NAME" ]; then
                init_dev_backend "$BUCKET_NAME"
                
                echo -e "\n${GREEN}========================================${NC}"
                echo -e "${GREEN}S3 Backend Setup Complete!${NC}"
                echo -e "${GREEN}========================================${NC}"
                echo -e "\n${BLUE}Team members can now collaborate by running:${NC}"
                echo -e "${YELLOW}cd infra/terraform-dev${NC}"
                echo -e "${YELLOW}terraform init${NC}"
                echo -e "\n${BLUE}State is stored in:${NC}"
                echo -e "  S3 Bucket: ${GREEN}$BUCKET_NAME${NC}"
                echo -e "  State Key: ${GREEN}dev/terraform.tfstate${NC}"
                echo -e "\n${BLUE}State locking enabled via DynamoDB table:${NC}"
                echo -e "  Table: ${GREEN}beacon-terraform-locks${NC}"
            else
                echo -e "${RED}Failed to set up backend. Please check the errors above.${NC}"
                exit 1
            fi
            ;;
            
        status)
            show_status
            ;;
            
        migrate)
            echo -e "${YELLOW}Migrating local state to S3 backend...${NC}\n"
            
            cd ../terraform-dev
            
            # Check if local state exists
            if [ -f "terraform.tfstate" ]; then
                echo -e "${YELLOW}Local state file found. Migrating to S3...${NC}"
                
                if get_bucket_name; then
                    # Create backend config
                    cat > backend-config.hcl << EOF
bucket         = "$BUCKET_NAME"
key            = "dev/terraform.tfstate"
region         = "$AWS_REGION"
dynamodb_table = "beacon-terraform-locks"
encrypt        = true
EOF
                    
                    # Re-initialize with backend (will prompt to migrate)
                    terraform init -backend-config=backend-config.hcl -migrate-state
                    
                    echo -e "${GREEN}✓ State migrated successfully!${NC}"
                else
                    echo -e "${RED}Could not find S3 bucket. Run '$0 setup' first.${NC}"
                    exit 1
                fi
            else
                echo -e "${YELLOW}No local state found. Run '$0 setup' to initialize with S3 backend.${NC}"
            fi
            ;;
            
        *)
            echo "Usage: $0 {setup|status|migrate}"
            echo ""
            echo "Commands:"
            echo "  setup   - Set up S3 backend for team collaboration"
            echo "  status  - Show current backend configuration"
            echo "  migrate - Migrate existing local state to S3 backend"
            echo ""
            echo "Benefits of S3 backend:"
            echo "  • Team collaboration - shared state"
            echo "  • State locking - prevents conflicts"
            echo "  • State versioning - rollback capability"
            echo "  • Encryption - secure state storage"
            exit 1
            ;;
    esac
}

# Check prerequisites
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}Terraform is not installed. Please install it first.${NC}"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}jq is not installed. Please install it first.${NC}"
    echo "Install: brew install jq (Mac) or apt-get install jq (Linux)"
    exit 1
fi

# Run main function
main "$@"