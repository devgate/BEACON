# DynamoDB table for vector storage (RAG system)
resource "aws_dynamodb_table" "beacon_vectors" {
  name           = "${var.environment}-beacon-vectors"
  billing_mode   = "PAY_PER_REQUEST"  # On-demand billing
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
  
  # TTL for automatic cleanup of old embeddings (optional)
  ttl {
    enabled        = false
    attribute_name = "expiration_time"
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

# IAM role for EC2 instance to access DynamoDB
resource "aws_iam_role_policy" "backend_dynamodb" {
  name = "${var.environment}-backend-dynamodb-policy"
  role = aws_iam_role.backend_ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:DescribeTable"
        ]
        Resource = [
          aws_dynamodb_table.beacon_vectors.arn,
          "${aws_dynamodb_table.beacon_vectors.arn}/index/*",
          aws_dynamodb_table.beacon_sessions.arn,
          "${aws_dynamodb_table.beacon_sessions.arn}/index/*",
          aws_dynamodb_table.beacon_usage.arn,
          "${aws_dynamodb_table.beacon_usage.arn}/index/*"
        ]
      }
    ]
  })
}

# IAM role for EC2 instance to access Bedrock
resource "aws_iam_role_policy" "backend_bedrock" {
  name = "${var.environment}-backend-bedrock-policy"
  role = aws_iam_role.backend_ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          "arn:aws:bedrock:*::foundation-model/*",
          "arn:aws:bedrock:*:*:inference-profile/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:ListFoundationModels",
          "bedrock:GetFoundationModel",
          "bedrock:ListInferenceProfiles",
          "bedrock:GetInferenceProfile"
        ]
        Resource = "*"
      }
    ]
  })
}

# Create or reference existing IAM role for EC2
resource "aws_iam_role" "backend_ec2" {
  name = "${var.environment}-backend-ec2-role"

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

  tags = {
    Name        = "${var.environment}-backend-ec2-role"
    Environment = var.environment
  }
}

# IAM instance profile for EC2
resource "aws_iam_instance_profile" "backend_ec2" {
  name = "${var.environment}-backend-ec2-profile"
  role = aws_iam_role.backend_ec2.name
}

# Attach basic EC2 policies
resource "aws_iam_role_policy_attachment" "backend_ssm" {
  role       = aws_iam_role.backend_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "backend_cloudwatch" {
  role       = aws_iam_role.backend_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# ECR permissions for Docker operations
resource "aws_iam_role_policy_attachment" "backend_ecr" {
  role       = aws_iam_role.backend_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}