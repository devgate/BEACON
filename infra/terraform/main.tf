# Main Terraform configuration for modular frontend/backend deployment
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
  # Backend will be configured after initial deployment
}

provider "aws" {
  region = var.aws_region
}

# State backend infrastructure (S3 bucket and DynamoDB table)
module "state_backend" {
  source = "./modules/state-backend"
  
  project_name = "beacon"
}

# Common infrastructure (VPC, subnets, Route53, etc.)
module "common" {
  source = "./modules/common"

  aws_region              = var.aws_region
  environment             = var.environment
  corporate_ip_blocks     = var.corporate_ip_blocks
  root_domain             = var.root_domain
  auto_update_nameservers = var.auto_update_nameservers
}

# Frontend module (React + Nginx)
module "frontend" {
  count  = var.deploy_frontend ? 1 : 0
  source = "./modules/frontend"

  environment         = var.environment
  domain_name         = var.frontend_domain
  root_domain         = var.root_domain
  vpc_id              = module.common.vpc_id
  public_subnet_ids   = module.common.public_subnet_ids
  private_subnet_ids  = module.common.private_subnet_ids
  hosted_zone_id      = module.common.hosted_zone_id
  certificate_arn     = module.common.certificate_arn
  corporate_ip_blocks = var.corporate_ip_blocks
  backend_domain      = var.backend_domain
  key_pair_name       = module.common.key_pair_name
  
}

# Backend module (Flask API)
module "backend" {
  count  = var.deploy_backend ? 1 : 0
  source = "./modules/backend"

  environment         = var.environment
  domain_name         = var.backend_domain
  root_domain         = var.root_domain
  vpc_id              = module.common.vpc_id
  private_subnet_ids  = module.common.private_subnet_ids
  public_subnet_ids   = module.common.public_subnet_ids
  hosted_zone_id      = module.common.hosted_zone_id
  certificate_arn     = module.common.certificate_arn
  corporate_ip_blocks = var.corporate_ip_blocks
  key_pair_name       = module.common.key_pair_name
  
}