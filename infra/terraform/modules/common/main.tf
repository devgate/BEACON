# Common infrastructure module - VPC, Route53, SSL Certificate
data "aws_availability_zones" "available" {
  state = "available"
}

# Random string for unique naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# Route 53 Hosted Zone
resource "aws_route53_zone" "main" {
  name = var.root_domain
  
  tags = {
    Name        = "${var.environment}-zone"
    Environment = var.environment
  }
}

# Check if domain exists in Route53 and update nameservers if it does
resource "null_resource" "update_nameservers" {
  count = var.auto_update_nameservers ? 1 : 0
  
  triggers = {
    zone_id = aws_route53_zone.main.zone_id
    nameservers = join(",", aws_route53_zone.main.name_servers)
  }
  
  provisioner "local-exec" {
    command = <<-EOT
      echo "=========================================="
      echo "Checking domain registration for: ${var.root_domain}"
      echo "=========================================="
      
      # Check if domain is registered in Route53 (Route53 Domains API only works in us-east-1)
      DOMAIN_INFO=$(aws route53domains get-domain-detail --domain-name ${var.root_domain} --region us-east-1 2>&1 || true)
      
      if echo "$DOMAIN_INFO" | grep -q "DomainName"; then
        echo "✓ Domain ${var.root_domain} is registered in Route53"
        
        # Get current nameservers
        CURRENT_NS=$(echo "$DOMAIN_INFO" | grep -A 4 "Nameservers:" | grep "Name:" | awk '{print $2}' | sort)
        
        echo "Current nameservers:"
        echo "$CURRENT_NS"
        echo ""
        echo "New nameservers from hosted zone:"
        echo "${aws_route53_zone.main.name_servers[0]}"
        echo "${aws_route53_zone.main.name_servers[1]}"
        echo "${aws_route53_zone.main.name_servers[2]}"
        echo "${aws_route53_zone.main.name_servers[3]}"
        echo ""
        
        # Create nameserver update JSON
        cat > /tmp/nameservers-${var.root_domain}.json <<EOF
      {
        "DomainName": "${var.root_domain}",
        "Nameservers": [
          {"Name": "${aws_route53_zone.main.name_servers[0]}"},
          {"Name": "${aws_route53_zone.main.name_servers[1]}"},
          {"Name": "${aws_route53_zone.main.name_servers[2]}"},
          {"Name": "${aws_route53_zone.main.name_servers[3]}"}
        ]
      }
      EOF
        
        # Update nameservers (must use us-east-1 region for Route53 Domains)
        echo "Updating nameservers..."
        if aws route53domains update-domain-nameservers --cli-input-json file:///tmp/nameservers-${var.root_domain}.json --region us-east-1; then
          echo "✓ Nameservers updated successfully for ${var.root_domain}"
        else
          echo "⚠ Failed to update nameservers automatically"
          echo "Please update manually in Route53 console"
        fi
        
        rm -f /tmp/nameservers-${var.root_domain}.json
      else
        echo "ℹ Domain ${var.root_domain} is not registered in Route53 Domains"
        echo "  (It may be registered with another registrar)"
        echo ""
        echo "Please manually update the nameservers at your domain registrar to:"
        echo "----------------------------------------"
        echo "${aws_route53_zone.main.name_servers[0]}"
        echo "${aws_route53_zone.main.name_servers[1]}"
        echo "${aws_route53_zone.main.name_servers[2]}"
        echo "${aws_route53_zone.main.name_servers[3]}"
        echo "----------------------------------------"
      fi
    EOT
  }
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name        = "${var.environment}-vpc"
    Environment = var.environment
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = {
    Name        = "${var.environment}-igw"
    Environment = var.environment
  }
}

# NAT Gateway용 Elastic IP - 단일 NAT Gateway로 최적화
resource "aws_eip" "nat" {
  count  = 1
  domain = "vpc"
  
  depends_on = [aws_internet_gateway.main]
  
  tags = {
    Name        = "${var.environment}-nat-eip"
    Environment = var.environment
  }
}

# Public Subnets
resource "aws_subnet" "public" {
  count = 2
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  
  tags = {
    Name        = "${var.environment}-public-subnet-${count.index + 1}"
    Environment = var.environment
    Type        = "Public"
  }
}

# Private Subnets
resource "aws_subnet" "private" {
  count = 2
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  
  tags = {
    Name        = "${var.environment}-private-subnet-${count.index + 1}"
    Environment = var.environment
    Type        = "Private"
  }
}

# NAT Gateway - 단일 NAT Gateway로 최적화
resource "aws_nat_gateway" "main" {
  count = 1
  
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id
  
  depends_on = [aws_internet_gateway.main]
  
  tags = {
    Name        = "${var.environment}-nat-gateway"
    Environment = var.environment
  }
}

# Route Tables - Public
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  
  tags = {
    Name        = "${var.environment}-public-rt"
    Environment = var.environment
  }
}

# Route Tables - Private
resource "aws_route_table" "private" {
  count  = 2
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[0].id
  }
  
  tags = {
    Name        = "${var.environment}-private-rt-${count.index + 1}"
    Environment = var.environment
  }
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count = 2
  
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = 2
  
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ACM Certificate for wildcard domain
resource "aws_acm_certificate" "main" {
  domain_name       = "*.${var.root_domain}"
  validation_method = "DNS"
  
  subject_alternative_names = [
    var.root_domain
  ]
  
  lifecycle {
    create_before_destroy = true
  }
  
  tags = {
    Name        = "${var.environment}-wildcard-cert"
    Environment = var.environment
  }
}

# Route 53 record for ACM validation
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

# ACM Certificate validation
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
  
  timeouts {
    create = "60m"
  }
}

# Key Pair for EC2 access
resource "aws_key_pair" "main" {
  key_name   = "${var.environment}-keypair"
  public_key = file("~/.ssh/id_rsa.pub")
  
  tags = {
    Name        = "${var.environment}-keypair"
    Environment = var.environment
  }
}