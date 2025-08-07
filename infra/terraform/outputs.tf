# Main outputs for the infrastructure

# State backend outputs
output "s3_backend_bucket" {
  description = "S3 bucket for Terraform state"
  value       = module.state_backend.s3_bucket_name
}

output "dynamodb_lock_table" {
  description = "DynamoDB table for state locking"
  value       = module.state_backend.dynamodb_table_name
}

output "backend_config" {
  description = "Backend configuration for terraform init"
  value       = module.state_backend.backend_config
}

# Common infrastructure outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.common.vpc_id
}

output "hosted_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = module.common.hosted_zone_id
}

output "name_servers" {
  description = "Name servers for the domain"
  value       = module.common.name_servers
}

output "certificate_arn" {
  description = "ACM certificate ARN"
  value       = module.common.certificate_arn
}

# Frontend outputs (when deployed)
output "frontend_url" {
  description = "Frontend URL"
  value       = var.deploy_frontend ? module.frontend[0].frontend_url : "Frontend not deployed"
}

output "frontend_alb_dns" {
  description = "Frontend ALB DNS name"
  value       = var.deploy_frontend ? module.frontend[0].alb_dns_name : "Frontend not deployed"
}

# Backend outputs (when deployed)
output "backend_url" {
  description = "Backend API URL"
  value       = var.deploy_backend ? module.backend[0].backend_url : "Backend not deployed"
}

output "backend_alb_dns" {
  description = "Backend ALB DNS name"
  value       = var.deploy_backend ? module.backend[0].alb_dns_name : "Backend not deployed"
}

# Deployment instructions
output "deployment_instructions" {
  description = "Instructions for separate deployments"
  value       = <<-EOT
    
    🚀 Deployment Instructions:
    
    1. Deploy all infrastructure:
       terraform apply
    
    2. Deploy only frontend:
       terraform apply -var="deploy_backend=false"
    
    3. Deploy only backend:
       terraform apply -var="deploy_frontend=false"
    
    4. Deploy common infrastructure only:
       terraform apply -var="deploy_frontend=false" -var="deploy_backend=false"
    
    📍 Access URLs:
    - Frontend: https://beacon.sk-shieldus.com
    - Backend API: https://api.beacon.sk-shieldus.com
    
  EOT
}