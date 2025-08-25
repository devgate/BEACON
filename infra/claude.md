# BEACON Infrastructure - AWS & Terraform Documentation

## 🏗️ Infrastructure Overview

**BEACON Infrastructure**: Cloud-native AWS infrastructure using Terraform for Infrastructure as Code (IaC), supporting multi-environment deployment with auto-scaling, high availability, and security best practices.

### Architecture Components
- **Compute**: Auto Scaling Groups with EC2 instances
- **Load Balancing**: Application Load Balancer with health checks
- **Networking**: VPC with public/private subnets, NAT Gateway
- **Storage**: DynamoDB for vector storage, S3 for file storage
- **Security**: IAM roles, Security Groups, SSL/TLS certificates
- **Monitoring**: CloudWatch logs, metrics, and alarms

### Infrastructure Patterns
- **Modular Design**: Reusable Terraform modules
- **Environment Separation**: Dev/Prod environment isolation
- **Blue-Green Deployment**: Zero-downtime deployments
- **Auto Scaling**: Dynamic scaling based on demand

---

## 📁 Infrastructure Structure

```
infra/
├── README.md                    # Infrastructure documentation
├── ARCHITECTURE.md              # System architecture overview
│
├── terraform/                   # Production Terraform
│   ├── main.tf                 # Main infrastructure orchestration
│   ├── variables.tf            # Input variables
│   ├── outputs.tf              # Infrastructure outputs
│   ├── backend.tf              # Remote state configuration
│   ├── deploy.sh               # Production deployment script
│   ├── terraform.tfstate       # Terraform state (if local)
│   ├── terraform.tfstate.backup # State backup
│   │
│   ├── environments/           # Environment-specific variables
│   │   ├── dev.tfvars         # Development environment
│   │   └── prod.tfvars        # Production environment
│   │
│   └── modules/                # Reusable infrastructure modules
│       ├── common/             # Shared infrastructure (VPC, Route53)
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── outputs.tf
│       ├── frontend/           # Frontend infrastructure
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   ├── outputs.tf
│       │   └── user_data_docker_production.sh
│       ├── backend/            # Backend infrastructure  
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   ├── outputs.tf
│       │   ├── dynamodb.tf
│       │   └── user_data_docker_production.sh
│       ├── state-backend/      # Terraform state infrastructure
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── outputs.tf
│       └── ecr/               # Container registry
│           ├── main.tf
│           ├── variables.tf
│           └── outputs.tf
│
└── terraform-dev/              # Development Terraform
    ├── README.md
    ├── main.tf                 # Development infrastructure
    ├── variables.tf
    ├── outputs.tf
    ├── backend.tf
    ├── terraform.tfvars
    └── backend-setup.sh        # Development backend setup
```

---

## 🚀 Main Infrastructure Configuration

### Root Terraform Configuration (`terraform/main.tf`)
```hcl
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
  
  # Remote state backend
  backend "s3" {
    bucket         = "beacon-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "ap-northeast-2"
    dynamodb_table = "beacon-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "beacon"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "beacon-team"
    }
  }
}

# Generate random suffix for unique resource names
resource "random_id" "suffix" {
  byte_length = 4
}

# State backend infrastructure (S3 bucket and DynamoDB table)
module "state_backend" {
  source = "./modules/state-backend"
  
  project_name = "beacon"
  environment  = var.environment
}

# Common infrastructure (VPC, subnets, Route53, etc.)
module "common" {
  source = "./modules/common"

  aws_region              = var.aws_region
  environment             = var.environment
  corporate_ip_blocks     = var.corporate_ip_blocks
  root_domain             = var.root_domain
  auto_update_nameservers = var.auto_update_nameservers
  
  # Resource naming
  project_name = "beacon"
  random_suffix = random_id.suffix.hex
}

# ECR repositories for container images
module "ecr" {
  source = "./modules/ecr"
  
  environment = var.environment
  repositories = [
    "beacon-backend",
    "beacon-frontend"
  ]
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
  
  # ECR repository URLs
  ecr_repository_url = module.ecr.repository_urls["beacon-frontend"]
  
  # Auto Scaling configuration
  min_size         = var.frontend_min_instances
  max_size         = var.frontend_max_instances
  desired_capacity = var.frontend_desired_instances
  instance_type    = var.frontend_instance_type
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
  
  # ECR repository URLs
  ecr_repository_url = module.ecr.repository_urls["beacon-backend"]
  
  # Auto Scaling configuration
  min_size         = var.backend_min_instances
  max_size         = var.backend_max_instances
  desired_capacity = var.backend_desired_instances
  instance_type    = var.backend_instance_type
  
  # DynamoDB configuration
  enable_dynamodb = var.enable_dynamodb
  dynamodb_tables = var.dynamodb_tables
}
```

### Variables Configuration (`terraform/variables.tf`)
```hcl
# Core variables
variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-northeast-2"
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.aws_region))
    error_message = "AWS region must be a valid region identifier."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "beacon"
}

# Domain configuration
variable "root_domain" {
  description = "Root domain for the application"
  type        = string
  default     = "beacon.example.com"
}

variable "frontend_domain" {
  description = "Domain name for frontend"
  type        = string
  default     = "beacon.example.com"
}

variable "backend_domain" {
  description = "Domain name for backend API"
  type        = string
  default     = "api.beacon.example.com"
}

variable "auto_update_nameservers" {
  description = "Automatically update nameservers for domain"
  type        = bool
  default     = false
}

# Deployment toggles
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

variable "enable_dynamodb" {
  description = "Whether to create DynamoDB tables"
  type        = bool
  default     = true
}

# Security
variable "corporate_ip_blocks" {
  description = "List of corporate IP blocks for security group access"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Change this for production
}

# Auto Scaling configuration
variable "frontend_instance_type" {
  description = "EC2 instance type for frontend"
  type        = string
  default     = "t3.medium"
}

variable "frontend_min_instances" {
  description = "Minimum number of frontend instances"
  type        = number
  default     = 1
}

variable "frontend_max_instances" {
  description = "Maximum number of frontend instances"
  type        = number
  default     = 3
}

variable "frontend_desired_instances" {
  description = "Desired number of frontend instances"
  type        = number
  default     = 2
}

variable "backend_instance_type" {
  description = "EC2 instance type for backend"
  type        = string
  default     = "t3.medium"
}

variable "backend_min_instances" {
  description = "Minimum number of backend instances"
  type        = number
  default     = 1
}

variable "backend_max_instances" {
  description = "Maximum number of backend instances"
  type        = number
  default     = 5
}

variable "backend_desired_instances" {
  description = "Desired number of backend instances"
  type        = number
  default     = 2
}

# DynamoDB configuration
variable "dynamodb_tables" {
  description = "DynamoDB tables to create"
  type = map(object({
    billing_mode = string
    hash_key     = string
    range_key    = optional(string)
    attributes = list(object({
      name = string
      type = string
    }))
    global_secondary_indexes = optional(list(object({
      name     = string
      hash_key = string
      range_key = optional(string)
      projection_type = string
    })))
  }))
  default = {
    vectors = {
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "document_id"
      range_key    = "chunk_id"
      attributes = [
        {
          name = "document_id"
          type = "S"
        },
        {
          name = "chunk_id"
          type = "S"
        },
        {
          name = "category_id"
          type = "N"
        }
      ]
      global_secondary_indexes = [
        {
          name            = "CategoryIndex"
          hash_key        = "category_id"
          projection_type = "ALL"
        }
      ]
    }
    sessions = {
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "session_id"
      attributes = [
        {
          name = "session_id"
          type = "S"
        }
      ]
    }
    usage = {
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "user_id"
      range_key    = "timestamp"
      attributes = [
        {
          name = "user_id"
          type = "S"
        },
        {
          name = "timestamp"
          type = "S"
        }
      ]
    }
  }
}

# Monitoring and logging
variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch logging"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch retention period."
  }
}
```

### Outputs Configuration (`terraform/outputs.tf`)
```hcl
# Common infrastructure outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.common.vpc_id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = module.common.vpc_cidr
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.common.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.common.private_subnet_ids
}

output "hosted_zone_id" {
  description = "Route53 hosted zone ID"
  value       = module.common.hosted_zone_id
}

output "certificate_arn" {
  description = "ACM certificate ARN"
  value       = module.common.certificate_arn
}

# ECR outputs
output "ecr_repository_urls" {
  description = "ECR repository URLs"
  value       = module.ecr.repository_urls
}

# Frontend outputs
output "frontend_load_balancer_dns" {
  description = "Frontend load balancer DNS name"
  value       = var.deploy_frontend ? module.frontend[0].load_balancer_dns : null
}

output "frontend_instance_ips" {
  description = "Frontend EC2 instance IP addresses"
  value       = var.deploy_frontend ? module.frontend[0].instance_private_ips : []
}

output "frontend_auto_scaling_group_arn" {
  description = "Frontend Auto Scaling Group ARN"
  value       = var.deploy_frontend ? module.frontend[0].auto_scaling_group_arn : null
}

# Backend outputs
output "backend_load_balancer_dns" {
  description = "Backend load balancer DNS name"
  value       = var.deploy_backend ? module.backend[0].load_balancer_dns : null
}

output "backend_instance_ips" {
  description = "Backend EC2 instance IP addresses"
  value       = var.deploy_backend ? module.backend[0].instance_private_ips : []
}

output "backend_auto_scaling_group_arn" {
  description = "Backend Auto Scaling Group ARN"
  value       = var.deploy_backend ? module.backend[0].auto_scaling_group_arn : null
}

# DynamoDB outputs
output "dynamodb_table_names" {
  description = "Names of created DynamoDB tables"
  value       = var.deploy_backend && var.enable_dynamodb ? module.backend[0].dynamodb_table_names : {}
}

output "dynamodb_table_arns" {
  description = "ARNs of created DynamoDB tables"
  value       = var.deploy_backend && var.enable_dynamodb ? module.backend[0].dynamodb_table_arns : {}
}

# Application URLs
output "application_urls" {
  description = "Application URLs"
  value = {
    frontend = var.deploy_frontend ? "https://${var.frontend_domain}" : null
    backend  = var.deploy_backend ? "https://${var.backend_domain}" : null
    api      = var.deploy_backend ? "https://${var.backend_domain}/api" : null
  }
}

# Infrastructure summary
output "infrastructure_summary" {
  description = "Summary of deployed infrastructure"
  value = {
    environment      = var.environment
    region          = var.aws_region
    frontend_deployed = var.deploy_frontend
    backend_deployed  = var.deploy_backend
    domain_names = {
      frontend = var.frontend_domain
      backend  = var.backend_domain
    }
    scaling = {
      frontend = var.deploy_frontend ? {
        min      = var.frontend_min_instances
        max      = var.frontend_max_instances
        desired  = var.frontend_desired_instances
        type     = var.frontend_instance_type
      } : null
      backend = var.deploy_backend ? {
        min      = var.backend_min_instances
        max      = var.backend_max_instances
        desired  = var.backend_desired_instances
        type     = var.backend_instance_type
      } : null
    }
  }
}
```

---

## 🧩 Infrastructure Modules

### 1. Common Module (`modules/common/main.tf`)
```hcl
# Common infrastructure: VPC, subnets, Route53, SSL certificates

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-${var.environment}-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-${var.environment}-igw"
  }
}

# Public subnets
resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-${var.environment}-public-${count.index + 1}"
    Type = "Public"
  }
}

# Private subnets
resource "aws_subnet" "private" {
  count = 2

  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.project_name}-${var.environment}-private-${count.index + 1}"
    Type = "Private"
  }
}

# Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  domain = "vpc"
  depends_on = [aws_internet_gateway.main]

  tags = {
    Name = "${var.project_name}-${var.environment}-nat-eip"
  }
}

# NAT Gateway
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.main]

  tags = {
    Name = "${var.project_name}-${var.environment}-nat"
  }
}

# Public route table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-public-rt"
  }
}

# Private route table
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-private-rt"
  }
}

# Route table associations
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# Route53 hosted zone
resource "aws_route53_zone" "main" {
  name = var.root_domain

  tags = {
    Name = "${var.project_name}-${var.environment}-zone"
  }
}

# ACM certificate
resource "aws_acm_certificate" "main" {
  domain_name               = var.root_domain
  subject_alternative_names = ["*.${var.root_domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cert"
  }
}

# Certificate validation records
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

# Certificate validation
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# Key pair for EC2 instances
resource "aws_key_pair" "main" {
  key_name   = "${var.project_name}-${var.environment}-key"
  public_key = file("~/.ssh/id_rsa.pub")  # Update path as needed

  tags = {
    Name = "${var.project_name}-${var.environment}-key"
  }
}

# Security group for ALB
resource "aws_security_group" "alb" {
  name_prefix = "${var.project_name}-${var.environment}-alb-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-alb-sg"
  }
}
```

### 2. Backend Module (`modules/backend/main.tf`)
```hcl
# Backend infrastructure: EC2 Auto Scaling, ALB, DynamoDB

# Data sources
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# Security group for backend instances
resource "aws_security_group" "backend" {
  name_prefix = "${var.project_name}-${var.environment}-backend-"
  vpc_id      = var.vpc_id

  ingress {
    description     = "HTTP from ALB"
    from_port       = 5000
    to_port         = 5000
    protocol        = "tcp"
    security_groups = [aws_security_group.backend_alb.id]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.corporate_ip_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-backend-sg"
  }
}

# Security group for backend ALB
resource "aws_security_group" "backend_alb" {
  name_prefix = "${var.project_name}-${var.environment}-backend-alb-"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-backend-alb-sg"
  }
}

# IAM role for EC2 instances
resource "aws_iam_role" "backend_instance" {
  name = "${var.project_name}-${var.environment}-backend-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for backend instances
resource "aws_iam_role_policy" "backend_instance" {
  name = "${var.project_name}-${var.environment}-backend-instance-policy"
  role = aws_iam_role.backend_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:ListFoundationModels"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          for table in aws_dynamodb_table.main : table.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query"
        ]
        Resource = [
          for table in aws_dynamodb_table.main : "${table.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:*"
      }
    ]
  })
}

# IAM instance profile
resource "aws_iam_instance_profile" "backend" {
  name = "${var.project_name}-${var.environment}-backend-instance-profile"
  role = aws_iam_role.backend_instance.name
}

# Launch template for backend instances
resource "aws_launch_template" "backend" {
  name_prefix   = "${var.project_name}-${var.environment}-backend-"
  image_id      = data.aws_ami.amazon_linux.id
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  vpc_security_group_ids = [aws_security_group.backend.id]

  iam_instance_profile {
    name = aws_iam_instance_profile.backend.name
  }

  user_data = base64encode(templatefile("${path.module}/user_data_docker_production.sh", {
    ecr_repository_url = var.ecr_repository_url
    aws_region        = var.aws_region
    environment       = var.environment
    dynamodb_vectors_table = "${var.environment}-beacon-vectors"
    dynamodb_sessions_table = "${var.environment}-beacon-sessions"
    dynamodb_usage_table = "${var.environment}-beacon-usage"
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.project_name}-${var.environment}-backend"
    }
  }
}

# Auto Scaling Group for backend
resource "aws_autoscaling_group" "backend" {
  name                = "${var.project_name}-${var.environment}-backend-asg"
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = [aws_lb_target_group.backend.arn]
  health_check_type   = "ELB"
  health_check_grace_period = 300

  min_size         = var.min_size
  max_size         = var.max_size
  desired_capacity = var.desired_capacity

  launch_template {
    id      = aws_launch_template.backend.id
    version = "$Latest"
  }

  # Auto Scaling policies
  tag {
    key                 = "Name"
    value               = "${var.project_name}-${var.environment}-backend"
    propagate_at_launch = true
  }

  tag {
    key                 = "Environment"
    value               = var.environment
    propagate_at_launch = true
  }
}

# Application Load Balancer for backend
resource "aws_lb" "backend" {
  name               = "${var.project_name}-${var.environment}-backend-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.backend_alb.id]
  subnets           = var.public_subnet_ids

  enable_deletion_protection = false

  tags = {
    Name = "${var.project_name}-${var.environment}-backend-alb"
  }
}

# Target group for backend
resource "aws_lb_target_group" "backend" {
  name     = "${var.project_name}-${var.environment}-backend-tg"
  port     = 5000
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-backend-tg"
  }
}

# ALB listener (HTTPS)
resource "aws_lb_listener" "backend_https" {
  load_balancer_arn = aws_lb.backend.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# ALB listener (HTTP redirect to HTTPS)
resource "aws_lb_listener" "backend_http" {
  load_balancer_arn = aws_lb.backend.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Route53 record for backend
resource "aws_route53_record" "backend" {
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.backend.dns_name
    zone_id                = aws_lb.backend.zone_id
    evaluate_target_health = true
  }
}

# Auto Scaling policies
resource "aws_autoscaling_policy" "backend_scale_up" {
  name                   = "${var.project_name}-${var.environment}-backend-scale-up"
  scaling_adjustment     = 1
  adjustment_type        = "ChangeInCapacity"
  cooldown              = 300
  autoscaling_group_name = aws_autoscaling_group.backend.name
}

resource "aws_autoscaling_policy" "backend_scale_down" {
  name                   = "${var.project_name}-${var.environment}-backend-scale-down"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown              = 300
  autoscaling_group_name = aws_autoscaling_group.backend.name
}

# CloudWatch alarms
resource "aws_cloudwatch_metric_alarm" "backend_high_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-backend-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "70"
  alarm_description   = "This metric monitors backend CPU utilization"
  alarm_actions       = [aws_autoscaling_policy.backend_scale_up.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.backend.name
  }
}

resource "aws_cloudwatch_metric_alarm" "backend_low_cpu" {
  alarm_name          = "${var.project_name}-${var.environment}-backend-low-cpu"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "20"
  alarm_description   = "This metric monitors backend CPU utilization"
  alarm_actions       = [aws_autoscaling_policy.backend_scale_down.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.backend.name
  }
}
```

### 3. Backend User Data Script (`modules/backend/user_data_docker_production.sh`)
```bash
#!/bin/bash

# BEACON Backend Production User Data Script
# Installs Docker, configures environment, and starts backend container

set -e

# Variables from Terraform
ECR_REPOSITORY_URL="${ecr_repository_url}"
AWS_REGION="${aws_region}"
ENVIRONMENT="${environment}"
DYNAMODB_VECTORS_TABLE="${dynamodb_vectors_table}"
DYNAMODB_SESSIONS_TABLE="${dynamodb_sessions_table}"
DYNAMODB_USAGE_TABLE="${dynamodb_usage_table}"

# Logging
LOG_FILE="/var/log/beacon-setup.log"
exec > >(tee -a $LOG_FILE)
exec 2>&1

echo "Starting BEACON backend setup at $(date)"

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker

# Add ec2-user to docker group
usermod -a -G docker ec2-user

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf awscliv2.zip aws/

# Install CloudWatch agent
yum install -y amazon-cloudwatch-agent

# Configure CloudWatch agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "cwagent"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/beacon-setup.log",
            "log_group_name": "/aws/ec2/beacon/${ENVIRONMENT}/setup",
            "log_stream_name": "{instance_id}/setup.log"
          },
          {
            "file_path": "/var/log/beacon-app.log",
            "log_group_name": "/aws/ec2/beacon/${ENVIRONMENT}/app",
            "log_stream_name": "{instance_id}/app.log"
          }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "BEACON/${ENVIRONMENT}",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          "cpu_usage_idle",
          "cpu_usage_iowait",
          "cpu_usage_user",
          "cpu_usage_system"
        ],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": [
          "used_percent"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "diskio": {
        "measurement": [
          "io_time"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "mem": {
        "measurement": [
          "mem_used_percent"
        ],
        "metrics_collection_interval": 60
      }
    }
  }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -s \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Create application directory
mkdir -p /app/logs
chown ec2-user:ec2-user /app/logs

# Login to ECR
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPOSITORY_URL%/*}

# Pull backend image
docker pull ${ECR_REPOSITORY_URL}:latest

# Create systemd service for backend
cat > /etc/systemd/system/beacon-backend.service << EOF
[Unit]
Description=BEACON Backend Service
After=docker.service
Requires=docker.service

[Service]
Type=forking
RemainAfterExit=yes
ExecStart=/usr/bin/docker run -d \\
    --name beacon-backend \\
    --restart unless-stopped \\
    -p 5000:5000 \\
    -v /app/logs:/app/logs \\
    -e AWS_REGION=${AWS_REGION} \\
    -e FLASK_ENV=production \\
    -e FLASK_DEBUG=0 \\
    -e DYNAMODB_VECTORS_TABLE=${DYNAMODB_VECTORS_TABLE} \\
    -e DYNAMODB_SESSIONS_TABLE=${DYNAMODB_SESSIONS_TABLE} \\
    -e DYNAMODB_USAGE_TABLE=${DYNAMODB_USAGE_TABLE} \\
    -e CHROMA_DATA_DIR=/app/chroma_data \\
    ${ECR_REPOSITORY_URL}:latest

ExecStop=/usr/bin/docker stop beacon-backend
ExecStopPost=/usr/bin/docker rm beacon-backend

[Install]
WantedBy=multi-user.target
EOF

# Start and enable the service
systemctl daemon-reload
systemctl enable beacon-backend
systemctl start beacon-backend

# Wait for service to start
sleep 30

# Health check
for i in {1..10}; do
    if curl -f http://localhost:5000/api/health; then
        echo "Backend service is healthy"
        break
    fi
    
    if [ $i -eq 10 ]; then
        echo "Backend service failed to start properly"
        exit 1
    fi
    
    echo "Waiting for backend service... attempt $i/10"
    sleep 10
done

# Setup log rotation
cat > /etc/logrotate.d/beacon-backend << EOF
/app/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# Create monitoring script
cat > /usr/local/bin/beacon-monitor.sh << 'EOF'
#!/bin/bash

# BEACON Backend Monitoring Script

LOG_FILE="/var/log/beacon-monitor.log"

# Check if container is running
if ! docker ps | grep -q beacon-backend; then
    echo "$(date): Backend container not running, attempting restart" >> $LOG_FILE
    systemctl restart beacon-backend
    
    # Wait and check again
    sleep 30
    if ! docker ps | grep -q beacon-backend; then
        echo "$(date): Failed to restart backend container" >> $LOG_FILE
        exit 1
    fi
fi

# Check health endpoint
if ! curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "$(date): Health check failed, restarting backend" >> $LOG_FILE
    systemctl restart beacon-backend
fi

echo "$(date): Backend monitoring check completed" >> $LOG_FILE
EOF

chmod +x /usr/local/bin/beacon-monitor.sh

# Setup cron job for monitoring
echo "*/5 * * * * root /usr/local/bin/beacon-monitor.sh" >> /etc/crontab

echo "BEACON backend setup completed successfully at $(date)"
```

### 4. DynamoDB Configuration (`modules/backend/dynamodb.tf`)
```hcl
# DynamoDB tables for BEACON backend

# DynamoDB tables
resource "aws_dynamodb_table" "main" {
  for_each = var.enable_dynamodb ? var.dynamodb_tables : {}

  name           = "${var.environment}-beacon-${each.key}"
  billing_mode   = each.value.billing_mode
  hash_key       = each.value.hash_key
  range_key      = each.value.range_key

  # Attributes
  dynamic "attribute" {
    for_each = each.value.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  # Global Secondary Indexes
  dynamic "global_secondary_index" {
    for_each = each.value.global_secondary_indexes != null ? each.value.global_secondary_indexes : []
    content {
      name            = global_secondary_index.value.name
      hash_key        = global_secondary_index.value.hash_key
      range_key       = global_secondary_index.value.range_key
      projection_type = global_secondary_index.value.projection_type
    }
  }

  # Enable point-in-time recovery
  point_in_time_recovery {
    enabled = true
  }

  # Server-side encryption
  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "${var.environment}-beacon-${each.key}"
    Environment = var.environment
    Project     = "beacon"
  }
}

# CloudWatch log group for DynamoDB
resource "aws_cloudwatch_log_group" "dynamodb" {
  for_each = var.enable_dynamodb ? var.dynamodb_tables : {}

  name              = "/aws/dynamodb/beacon/${var.environment}/${each.key}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "beacon-${var.environment}-dynamodb-${each.key}-logs"
    Environment = var.environment
    Project     = "beacon"
  }
}
```

---

## 🛠️ Deployment Scripts

### Production Deployment (`terraform/deploy.sh`)
```bash
#!/bin/bash

# BEACON Terraform Deployment Script
# Manages infrastructure deployment with state validation and rollback

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVIRONMENT="${1:-prod}"
ACTION="${2:-apply}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Validate environment
validate_environment() {
    case $ENVIRONMENT in
        dev|staging|prod)
            log_info "Environment: $ENVIRONMENT"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            log_info "Valid environments: dev, staging, prod"
            exit 1
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed"
        exit 1
    fi
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    # Check environment variables file
    if [[ ! -f "environments/${ENVIRONMENT}.tfvars" ]]; then
        log_error "Environment file not found: environments/${ENVIRONMENT}.tfvars"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Initialize Terraform
init_terraform() {
    log_info "Initializing Terraform..."
    
    terraform init \
        -backend-config="bucket=beacon-terraform-state-${ENVIRONMENT}" \
        -backend-config="key=${ENVIRONMENT}/terraform.tfstate" \
        -backend-config="region=ap-northeast-2" \
        -backend-config="dynamodb_table=beacon-terraform-locks-${ENVIRONMENT}"
    
    log_success "Terraform initialized"
}

# Plan infrastructure changes
plan_infrastructure() {
    log_info "Planning infrastructure changes..."
    
    terraform plan \
        -var-file="environments/${ENVIRONMENT}.tfvars" \
        -out="${ENVIRONMENT}.tfplan"
    
    log_success "Plan created: ${ENVIRONMENT}.tfplan"
}

# Apply infrastructure changes
apply_infrastructure() {
    log_info "Applying infrastructure changes..."
    
    # Show plan summary
    terraform show "${ENVIRONMENT}.tfplan"
    
    # Confirmation prompt
    if [[ "${ENVIRONMENT}" == "prod" ]]; then
        read -p "Are you sure you want to apply these changes to PRODUCTION? (yes/no): " confirm
        if [[ $confirm != "yes" ]]; then
            log_warning "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Apply changes
    terraform apply "${ENVIRONMENT}.tfplan"
    
    log_success "Infrastructure deployed successfully"
}

# Validate deployment
validate_deployment() {
    log_info "Validating deployment..."
    
    # Get outputs
    local frontend_url=$(terraform output -raw application_urls | jq -r '.frontend' 2>/dev/null || echo "")
    local backend_url=$(terraform output -raw application_urls | jq -r '.backend' 2>/dev/null || echo "")
    
    # Test endpoints if available
    if [[ -n "${backend_url}" ]]; then
        log_info "Testing backend health..."
        if curl -sf "${backend_url}/api/health" > /dev/null; then
            log_success "Backend is healthy"
        else
            log_warning "Backend health check failed"
        fi
    fi
    
    if [[ -n "${frontend_url}" ]]; then
        log_info "Testing frontend..."
        if curl -sf "${frontend_url}/health" > /dev/null; then
            log_success "Frontend is healthy"
        else
            log_warning "Frontend health check failed"
        fi
    fi
    
    log_success "Deployment validation completed"
}

# Show deployment summary
show_summary() {
    log_success "Deployment Summary"
    echo "===================="
    
    # Infrastructure summary
    terraform output infrastructure_summary
    
    echo ""
    echo "Application URLs:"
    terraform output application_urls
    
    echo ""
    echo "Next steps:"
    echo "1. Update DNS records if needed"
    echo "2. Deploy application code"
    echo "3. Run integration tests"
    echo "4. Monitor CloudWatch dashboards"
}

# Destroy infrastructure
destroy_infrastructure() {
    log_warning "DESTROYING infrastructure for environment: ${ENVIRONMENT}"
    
    # Extra confirmation for production
    if [[ "${ENVIRONMENT}" == "prod" ]]; then
        read -p "THIS WILL DESTROY PRODUCTION INFRASTRUCTURE! Type 'destroy-prod' to confirm: " confirm
        if [[ $confirm != "destroy-prod" ]]; then
            log_warning "Destruction cancelled"
            exit 0
        fi
    fi
    
    terraform destroy \
        -var-file="environments/${ENVIRONMENT}.tfvars" \
        -auto-approve
    
    log_success "Infrastructure destroyed"
}

# Main execution
main() {
    echo "========================================="
    echo "🏗️  BEACON Infrastructure Deployment"
    echo "========================================="
    
    validate_environment
    check_prerequisites
    
    case $ACTION in
        plan)
            init_terraform
            plan_infrastructure
            ;;
        apply)
            init_terraform
            plan_infrastructure
            apply_infrastructure
            validate_deployment
            show_summary
            ;;
        destroy)
            init_terraform
            destroy_infrastructure
            ;;
        validate)
            validate_deployment
            ;;
        output)
            terraform output
            ;;
        *)
            echo "Usage: $0 <environment> <action>"
            echo ""
            echo "Environment: dev, staging, prod"
            echo "Action: plan, apply, destroy, validate, output"
            echo ""
            echo "Examples:"
            echo "  $0 dev plan      # Plan development infrastructure"
            echo "  $0 prod apply    # Deploy production infrastructure"
            echo "  $0 dev destroy   # Destroy development infrastructure"
            exit 1
            ;;
    esac
}

# Execute main function
main
```

### Environment Variables (`terraform/environments/prod.tfvars`)
```hcl
# Production environment configuration

# Basic settings
environment = "prod"
aws_region  = "ap-northeast-2"

# Domain configuration
root_domain     = "beacon.sk-shieldus.com"
frontend_domain = "beacon.sk-shieldus.com"
backend_domain  = "api.beacon.sk-shieldus.com"

# Deployment configuration
deploy_frontend = true
deploy_backend  = true
enable_dynamodb = true

# Security
corporate_ip_blocks = [
  "203.0.113.0/24",    # Corporate office
  "198.51.100.0/24"    # VPN range
]

# Auto Scaling - Frontend
frontend_instance_type     = "t3.medium"
frontend_min_instances     = 2
frontend_max_instances     = 10
frontend_desired_instances = 3

# Auto Scaling - Backend
backend_instance_type     = "t3.large"
backend_min_instances     = 2
backend_max_instances     = 20
backend_desired_instances = 4

# DynamoDB configuration
dynamodb_tables = {
  vectors = {
    billing_mode = "PAY_PER_REQUEST"
    hash_key     = "document_id"
    range_key    = "chunk_id"
    attributes = [
      {
        name = "document_id"
        type = "S"
      },
      {
        name = "chunk_id"
        type = "S"
      },
      {
        name = "category_id"
        type = "N"
      }
    ]
    global_secondary_indexes = [
      {
        name            = "CategoryIndex"
        hash_key        = "category_id"
        projection_type = "ALL"
      }
    ]
  }
  sessions = {
    billing_mode = "PAY_PER_REQUEST"
    hash_key     = "session_id"
    attributes = [
      {
        name = "session_id"
        type = "S"
      }
    ]
  }
  usage = {
    billing_mode = "PAY_PER_REQUEST"
    hash_key     = "user_id"
    range_key    = "timestamp"
    attributes = [
      {
        name = "user_id"
        type = "S"
      },
      {
        name = "timestamp"
        type = "S"
      }
    ]
  }
}

# Monitoring and logging
enable_cloudwatch_logs = true
log_retention_days     = 30
```

---

## 📊 Monitoring & Operations

### CloudWatch Dashboard Configuration
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "beacon-prod-backend-alb"],
          ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "beacon-prod-backend-alb"],
          ["AWS/ApplicationELB", "HTTPCode_Target_2XX_Count", "LoadBalancer", "beacon-prod-backend-alb"],
          ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", "beacon-prod-backend-alb"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "ap-northeast-2",
        "title": "Backend Application Load Balancer",
        "period": 300
      }
    },
    {
      "type": "metric", 
      "properties": {
        "metrics": [
          ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", "beacon-prod-backend-asg"],
          ["AWS/EC2", "NetworkIn", "AutoScalingGroupName", "beacon-prod-backend-asg"],
          ["AWS/EC2", "NetworkOut", "AutoScalingGroupName", "beacon-prod-backend-asg"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "ap-northeast-2",
        "title": "Backend EC2 Metrics",
        "period": 300
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "prod-beacon-vectors"],
          ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", "prod-beacon-vectors"],
          ["AWS/DynamoDB", "UserErrors", "TableName", "prod-beacon-vectors"],
          ["AWS/DynamoDB", "SystemErrors", "TableName", "prod-beacon-vectors"]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "ap-northeast-2",
        "title": "DynamoDB Vectors Table",
        "period": 300
      }
    }
  ]
}
```

### Infrastructure Monitoring Script
```bash
#!/bin/bash

# infrastructure-monitor.sh - Monitor BEACON infrastructure health

ENVIRONMENT="${1:-prod}"
SLACK_WEBHOOK_URL="${2:-}"

# AWS configuration
AWS_REGION="ap-northeast-2"
PROJECT_NAME="beacon"

# Monitoring functions
check_alb_health() {
    local alb_name="${PROJECT_NAME}-${ENVIRONMENT}-backend-alb"
    local healthy_targets=$(aws elbv2 describe-target-health \
        --target-group-arn $(aws elbv2 describe-target-groups \
            --names "${PROJECT_NAME}-${ENVIRONMENT}-backend-tg" \
            --query 'TargetGroups[0].TargetGroupArn' \
            --output text) \
        --query 'TargetHealthDescriptions[?TargetHealth.State==`healthy`]' \
        --output json | jq length)
    
    echo "Healthy targets: ${healthy_targets}"
    
    if [[ ${healthy_targets} -lt 1 ]]; then
        send_alert "No healthy backend targets in ${ENVIRONMENT}"
        return 1
    fi
    
    return 0
}

check_dynamodb_health() {
    local tables=("vectors" "sessions" "usage")
    
    for table in "${tables[@]}"; do
        local table_name="${ENVIRONMENT}-beacon-${table}"
        local status=$(aws dynamodb describe-table \
            --table-name "${table_name}" \
            --query 'Table.TableStatus' \
            --output text 2>/dev/null || echo "NOT_FOUND")
        
        if [[ "${status}" != "ACTIVE" ]]; then
            send_alert "DynamoDB table ${table_name} is ${status}"
            return 1
        fi
    done
    
    return 0
}

check_application_health() {
    local backend_url="https://api.beacon.sk-shieldus.com"
    local frontend_url="https://beacon.sk-shieldus.com"
    
    # Check backend
    if ! curl -sf "${backend_url}/api/health" > /dev/null; then
        send_alert "Backend application health check failed"
        return 1
    fi
    
    # Check frontend  
    if ! curl -sf "${frontend_url}/health" > /dev/null; then
        send_alert "Frontend application health check failed"
        return 1
    fi
    
    return 0
}

send_alert() {
    local message="$1"
    
    echo "ALERT: ${message}"
    
    if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 BEACON ${ENVIRONMENT}: ${message}\"}" \
            "${SLACK_WEBHOOK_URL}"
    fi
}

# Main monitoring loop
main() {
    echo "Starting BEACON infrastructure monitoring for ${ENVIRONMENT}"
    
    local alerts=0
    
    if ! check_alb_health; then
        ((alerts++))
    fi
    
    if ! check_dynamodb_health; then
        ((alerts++))
    fi
    
    if ! check_application_health; then
        ((alerts++))
    fi
    
    if [[ ${alerts} -eq 0 ]]; then
        echo "✅ All systems healthy"
    else
        echo "❌ ${alerts} issues detected"
        exit 1
    fi
}

main
```

---

## 🔒 Security & Compliance

### Security Configuration
```hcl
# security.tf - Additional security configurations

# WAF Web ACL for ALB
resource "aws_wafv2_web_acl" "main" {
  name  = "${var.project_name}-${var.environment}-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate limiting rule
  rule {
    name     = "RateLimitRule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 1000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  # AWS managed rules
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-${var.environment}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-waf"
  }
}

# Associate WAF with ALB
resource "aws_wafv2_web_acl_association" "main" {
  resource_arn = aws_lb.backend.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# VPC Flow Logs
resource "aws_flow_log" "main" {
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_log.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id
}
```

### Backup and Disaster Recovery
```hcl
# backup.tf - Backup and disaster recovery

# DynamoDB backup
resource "aws_dynamodb_table" "backup" {
  for_each = var.dynamodb_tables

  name           = "${var.environment}-beacon-${each.key}-backup"
  billing_mode   = "PAY_PER_REQUEST"
  
  # Copy from main table structure
  hash_key  = each.value.hash_key
  range_key = each.value.range_key

  # Enable backup
  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-beacon-${each.key}-backup"
    Type = "Backup"
  }
}

# S3 bucket for application backups
resource "aws_s3_bucket" "backups" {
  bucket = "${var.project_name}-${var.environment}-backups"

  tags = {
    Name = "${var.project_name}-${var.environment}-backups"
  }
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
```