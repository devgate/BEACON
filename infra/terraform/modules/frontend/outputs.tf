output "alb_dns_name" {
  description = "Frontend ALB DNS name"
  value       = aws_lb.frontend.dns_name
}

output "frontend_url" {
  description = "Frontend URL"
  value       = "https://${var.domain_name}"
}

output "target_group_arn" {
  description = "Frontend target group ARN"
  value       = aws_lb_target_group.frontend.arn
}

output "frontend_instance_id" {
  description = "Frontend EC2 instance ID"
  value       = aws_instance.frontend.id
}

output "frontend_instance_public_ip" {
  description = "Frontend EC2 instance public IP"
  value       = aws_instance.frontend.public_ip
}

