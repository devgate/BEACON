variable "environment" {
  description = "Environment name"
  type        = string
}

variable "domain_name" {
  description = "Backend domain name"
  type        = string
}

variable "root_domain" {
  description = "Root domain name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Private subnet IDs"
  type        = list(string)
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN"
  type        = string
}

variable "corporate_ip_blocks" {
  description = "Corporate IP CIDR blocks"
  type        = list(string)
}

variable "key_pair_name" {
  description = "EC2 Key Pair name"
  type        = string
  default     = ""
}

