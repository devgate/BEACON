# Development environment configuration
environment = "dev"
aws_region  = "ap-northeast-2"

# Development doesn't need EC2 instances, only DynamoDB
deploy_frontend = false
deploy_backend  = false

# Domain configuration (not used for dev, but required variables)
root_domain     = "dev.local"
frontend_domain = "beacon.dev.local"
backend_domain  = "api.beacon.dev.local"

# IP blocks for development
corporate_ip_blocks = ["0.0.0.0/0"]

# Auto update nameservers (false for dev)
auto_update_nameservers = false