# Terraform Backend Configuration for Dev Environment
# This file configures S3 backend for state management and team collaboration

terraform {
  backend "s3" {
    # S3 bucket for state storage (shared with prod)
    bucket = "beacon-terraform-state-2ex762oh"
    
    # State file path for dev environment (separate from prod)
    key    = "dev/terraform.tfstate"
    
    # AWS region
    region = "ap-northeast-2"
    
    # DynamoDB table for state locking (shared with prod)
    dynamodb_table = "beacon-terraform-locks"
    
    # Enable encryption
    encrypt = true
    
    # AWS profile to use (optional)
    # profile = "default"
  }
}