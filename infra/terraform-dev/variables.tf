# Variables for BEACON Development Environment

variable "aws_region" {
  description = "AWS region for DynamoDB tables"
  type        = string
  default     = "ap-northeast-2"
}

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "default"
}

variable "environment" {
  description = "Environment name (dev)"
  type        = string
  default     = "dev"
}