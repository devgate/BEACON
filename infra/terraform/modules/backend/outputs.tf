output "alb_dns_name" {
  description = "Backend ALB DNS name"
  value       = aws_lb.backend.dns_name
}

output "backend_url" {
  description = "Backend API URL"
  value       = "https://${var.domain_name}"
}

output "target_group_arn" {
  description = "Backend target group ARN"
  value       = aws_lb_target_group.backend.arn
}

output "backend_instance_id" {
  description = "Backend EC2 instance ID"
  value       = aws_instance.backend.id
}

output "backend_instance_public_ip" {
  description = "Backend EC2 instance public IP"
  value       = aws_instance.backend.public_ip
}

output "dynamodb_vectors_table" {
  description = "DynamoDB table name for vector storage"
  value       = aws_dynamodb_table.beacon_vectors.name
}

output "dynamodb_sessions_table" {
  description = "DynamoDB table name for session management"
  value       = aws_dynamodb_table.beacon_sessions.name
}

output "dynamodb_usage_table" {
  description = "DynamoDB table name for usage tracking"
  value       = aws_dynamodb_table.beacon_usage.name
}

output "backend_iam_role_arn" {
  description = "Backend EC2 IAM role ARN"
  value       = aws_iam_role.backend_ec2.arn
}

