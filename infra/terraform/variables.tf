# Variables for separated frontend/backend deployment

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "beacon"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "corporate_ip_blocks" {
  description = "Corporate IP CIDR blocks"
  type        = list(string)
  default     = ["10.46.0.0/16"]
}

variable "root_domain" {
  description = "Root domain name"
  type        = string
  default     = "sk-shieldus.com"
}

variable "frontend_domain" {
  description = "Frontend domain name"
  type        = string
  default     = "beacon.sk-shieldus.com"
}

variable "backend_domain" {
  description = "Backend API domain name"
  type        = string
  default     = "api.beacon.sk-shieldus.com"
}

variable "deploy_frontend" {
  description = "Whether to deploy frontend infrastructure"
  type        = bool
  default     = true
}

variable "deploy_backend" {
  description = "Whether to deploy backend infrastructure"
  type        = bool
  default     = true
}

variable "auto_update_nameservers" {
  description = "Automatically update nameservers if domain is registered in Route53"
  type        = bool
  default     = true
}