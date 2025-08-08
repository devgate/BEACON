# Outputs for BEACON Development Environment

output "dynamodb_tables" {
  description = "Created DynamoDB table names"
  value = {
    vectors  = aws_dynamodb_table.beacon_vectors.name
    sessions = aws_dynamodb_table.beacon_sessions.name
    usage    = aws_dynamodb_table.beacon_usage.name
  }
}

output "dynamodb_arns" {
  description = "ARNs of created DynamoDB tables"
  value = {
    vectors  = aws_dynamodb_table.beacon_vectors.arn
    sessions = aws_dynamodb_table.beacon_sessions.arn
    usage    = aws_dynamodb_table.beacon_usage.arn
  }
}

output "environment_config" {
  description = "Environment variables for local development"
  value = {
    DYNAMODB_VECTORS_TABLE  = aws_dynamodb_table.beacon_vectors.name
    DYNAMODB_SESSIONS_TABLE = aws_dynamodb_table.beacon_sessions.name
    DYNAMODB_USAGE_TABLE    = aws_dynamodb_table.beacon_usage.name
    AWS_REGION              = var.aws_region
  }
}