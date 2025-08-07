# Backend module - Single EC2 instance with ALB
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  
  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-arm64-gp2"]
  }
  
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

# Security Group for Backend ALB
resource "aws_security_group" "backend_alb" {
  name_prefix = "${var.environment}-backend-alb-"
  description = "Security group for Backend ALB"
  vpc_id      = var.vpc_id
  
  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    description = "HTTP redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name        = "${var.environment}-backend-alb-sg"
    Environment = var.environment
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Security Group for Backend EC2
resource "aws_security_group" "backend_ec2" {
  name_prefix = "${var.environment}-backend-ec2-"
  description = "Security group for Backend EC2 instance"
  vpc_id      = var.vpc_id
  
  ingress {
    description     = "HTTP from ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.backend_alb.id]
  }
  
  ingress {
    description = "SSH from anywhere (for debugging)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name        = "${var.environment}-backend-ec2-sg"
    Environment = var.environment
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Application Load Balancer for Backend
resource "aws_lb" "backend" {
  name               = "${var.environment}-backend-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.backend_alb.id]
  subnets            = var.public_subnet_ids
  
  enable_deletion_protection = false
  
  tags = {
    Name        = "${var.environment}-backend-alb"
    Environment = var.environment
  }
}

# Target Group for Backend
resource "aws_lb_target_group" "backend" {
  name     = "${var.environment}-backend-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/api/weather"
    matcher             = "200"
    port                = "traffic-port"
    protocol            = "HTTP"
  }
  
  tags = {
    Name        = "${var.environment}-backend-tg"
    Environment = var.environment
  }
}

# HTTPS Listener for Backend ALB
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
  
  tags = {
    Name        = "${var.environment}-backend-https-listener"
    Environment = var.environment
  }
}

# HTTP Redirect Listener for Backend ALB
resource "aws_lb_listener" "backend_http_redirect" {
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
  
  tags = {
    Name        = "${var.environment}-backend-http-redirect-listener"
    Environment = var.environment
  }
}

# Single Backend EC2 Instance
resource "aws_instance" "backend" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type         = "t4g.small"  # ARM64 Graviton2 processor
  key_name              = var.key_pair_name
  iam_instance_profile  = aws_iam_instance_profile.backend_ec2.name
  
  vpc_security_group_ids = [aws_security_group.backend_ec2.id]
  subnet_id              = var.public_subnet_ids[0]  # Place in public subnet for SSH access
  
  user_data = base64encode(file("${path.module}/user_data_docker_production.sh"))
  
  tags = {
    Name        = "${var.environment}-backend-server"
    Environment = var.environment
    Type        = "Backend"
  }
}

# Attach instance to target group
resource "aws_lb_target_group_attachment" "backend" {
  target_group_arn = aws_lb_target_group.backend.arn
  target_id        = aws_instance.backend.id
  port             = 80
}

# Route 53 A record for Backend
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