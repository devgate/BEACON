# Frontend module - Single EC2 instance with ALB
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

# Security Group for Frontend ALB
resource "aws_security_group" "frontend_alb" {
  name_prefix = "${var.environment}-frontend-alb-"
  description = "Security group for Frontend ALB"
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
    Name        = "${var.environment}-frontend-alb-sg"
    Environment = var.environment
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Security Group for Frontend EC2
resource "aws_security_group" "frontend_ec2" {
  name_prefix = "${var.environment}-frontend-ec2-"
  description = "Security group for Frontend EC2 instance"
  vpc_id      = var.vpc_id
  
  ingress {
    description     = "HTTP from ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.frontend_alb.id]
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
    Name        = "${var.environment}-frontend-ec2-sg"
    Environment = var.environment
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Application Load Balancer for Frontend
resource "aws_lb" "frontend" {
  name               = "${var.environment}-frontend-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.frontend_alb.id]
  subnets            = var.public_subnet_ids
  
  enable_deletion_protection = false
  
  tags = {
    Name        = "${var.environment}-frontend-alb"
    Environment = var.environment
  }
}

# Target Group for Frontend
resource "aws_lb_target_group" "frontend" {
  name     = "${var.environment}-frontend-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
    port                = "traffic-port"
    protocol            = "HTTP"
  }
  
  tags = {
    Name        = "${var.environment}-frontend-tg"
    Environment = var.environment
  }
}

# HTTPS Listener for Frontend ALB
resource "aws_lb_listener" "frontend_https" {
  load_balancer_arn = aws_lb.frontend.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.certificate_arn
  
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
  
  tags = {
    Name        = "${var.environment}-frontend-https-listener"
    Environment = var.environment
  }
}

# HTTP Redirect Listener for Frontend ALB
resource "aws_lb_listener" "frontend_http_redirect" {
  load_balancer_arn = aws_lb.frontend.arn
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
    Name        = "${var.environment}-frontend-http-redirect-listener"
    Environment = var.environment
  }
}

# IAM role for Frontend EC2 instance
resource "aws_iam_role" "frontend_ec2" {
  name = "${var.environment}-frontend-ec2-role"

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
    Name        = "${var.environment}-frontend-ec2-role"
    Environment = var.environment
  }
}

# IAM instance profile for EC2
resource "aws_iam_instance_profile" "frontend_ec2" {
  name = "${var.environment}-frontend-ec2-profile"
  role = aws_iam_role.frontend_ec2.name
}

# Attach basic EC2 policies
resource "aws_iam_role_policy_attachment" "frontend_ssm" {
  role       = aws_iam_role.frontend_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "frontend_cloudwatch" {
  role       = aws_iam_role.frontend_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# ECR permissions for Docker operations
resource "aws_iam_role_policy_attachment" "frontend_ecr" {
  role       = aws_iam_role.frontend_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# Single Frontend EC2 Instance
resource "aws_instance" "frontend" {
  ami                  = data.aws_ami.amazon_linux.id
  instance_type        = "t4g.small"  # ARM64 Graviton2 processor
  key_name             = var.key_pair_name
  iam_instance_profile = aws_iam_instance_profile.frontend_ec2.name
  
  vpc_security_group_ids = [aws_security_group.frontend_ec2.id]
  subnet_id              = var.public_subnet_ids[0]  # Place in public subnet for SSH access
  
  user_data = base64encode(file("${path.module}/user_data_docker_production.sh"))
  
  tags = {
    Name        = "${var.environment}-frontend-server"
    Environment = var.environment
    Type        = "Frontend"
  }
}

# Attach instance to target group
resource "aws_lb_target_group_attachment" "frontend" {
  target_group_arn = aws_lb_target_group.frontend.arn
  target_id        = aws_instance.frontend.id
  port             = 80
}

# Route 53 A record for Frontend
resource "aws_route53_record" "frontend" {
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"
  
  alias {
    name                   = aws_lb.frontend.dns_name
    zone_id                = aws_lb.frontend.zone_id
    evaluate_target_health = true
  }
}