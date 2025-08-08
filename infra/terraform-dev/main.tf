# Terraform configuration for BEACON Development Environment
# This creates only DynamoDB tables for local development

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

# DynamoDB table for vector storage (RAG system)
resource "aws_dynamodb_table" "beacon_vectors" {
  name           = "${var.environment}-beacon-vectors"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "document_id"
  
  attribute {
    name = "document_id"
    type = "S"
  }
  
  attribute {
    name = "category_id"
    type = "N"
  }
  
  attribute {
    name = "chunk_index"
    type = "N"
  }
  
  # Global secondary index for category-based queries
  global_secondary_index {
    name            = "category-index"
    hash_key        = "category_id"
    range_key       = "chunk_index"
    projection_type = "ALL"
  }
  
  # Enable point-in-time recovery for data protection
  point_in_time_recovery {
    enabled = true
  }
  
  # Enable encryption at rest
  server_side_encryption {
    enabled = true
  }
  
  tags = {
    Name        = "${var.environment}-beacon-vectors"
    Environment = var.environment
    Purpose     = "Vector storage for RAG system"
  }
}

# DynamoDB table for chat history and session management
resource "aws_dynamodb_table" "beacon_sessions" {
  name           = "${var.environment}-beacon-sessions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "session_id"
  range_key      = "timestamp"
  
  attribute {
    name = "session_id"
    type = "S"
  }
  
  attribute {
    name = "timestamp"
    type = "N"
  }
  
  attribute {
    name = "user_id"
    type = "S"
  }
  
  # Global secondary index for user-based queries
  global_secondary_index {
    name            = "user-index"
    hash_key        = "user_id"
    range_key       = "timestamp"
    projection_type = "ALL"
  }
  
  # Enable point-in-time recovery
  point_in_time_recovery {
    enabled = true
  }
  
  # Enable encryption at rest
  server_side_encryption {
    enabled = true
  }
  
  # TTL for automatic cleanup of old sessions (30 days)
  ttl {
    enabled        = true
    attribute_name = "ttl"
  }
  
  tags = {
    Name        = "${var.environment}-beacon-sessions"
    Environment = var.environment
    Purpose     = "Chat history and session management"
  }
}

# DynamoDB table for model usage tracking and cost management
resource "aws_dynamodb_table" "beacon_usage" {
  name           = "${var.environment}-beacon-usage"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "date"
  range_key      = "request_id"
  
  attribute {
    name = "date"
    type = "S"  # Format: YYYY-MM-DD
  }
  
  attribute {
    name = "request_id"
    type = "S"
  }
  
  attribute {
    name = "model_id"
    type = "S"
  }
  
  # Global secondary index for model-based cost analysis
  global_secondary_index {
    name            = "model-index"
    hash_key        = "model_id"
    range_key       = "date"
    projection_type = "ALL"
  }
  
  # Enable point-in-time recovery
  point_in_time_recovery {
    enabled = true
  }
  
  # Enable encryption at rest
  server_side_encryption {
    enabled = true
  }
  
  # TTL for automatic cleanup of old usage data (90 days)
  ttl {
    enabled        = true
    attribute_name = "ttl"
  }
  
  tags = {
    Name        = "${var.environment}-beacon-usage"
    Environment = var.environment
    Purpose     = "Model usage tracking and cost management"
  }
}