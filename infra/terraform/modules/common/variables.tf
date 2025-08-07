variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "corporate_ip_blocks" {
  description = "Corporate IP CIDR blocks"
  type        = list(string)
}

variable "root_domain" {
  description = "Root domain name"
  type        = string
}

variable "auto_update_nameservers" {
  description = "Automatically update nameservers if domain is registered in Route53"
  type        = bool
  default     = true
}