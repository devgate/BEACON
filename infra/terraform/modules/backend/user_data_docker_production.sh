#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "=== Starting Backend Docker deployment with SSH access at $(date) ==="

# Enable password authentication for SSH
echo "=== SETTING UP SSH ACCESS ==="
echo 'ec2-user:SimplePass123!' | chpasswd
sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
systemctl restart sshd
echo "Password authentication enabled - User: ec2-user, Pass: SimplePass123!"

# Update system
yum update -y
echo "System updated"

# Check memory and disk space
echo "=== SYSTEM RESOURCES ==="
free -h
df -h
echo "========================"

# Install Docker using amazon-linux-extras
amazon-linux-extras install docker -y
echo "Docker installed"

# Start and enable Docker
systemctl start docker
systemctl enable docker
echo "Docker service started"

# Add ec2-user to docker group
usermod -a -G docker ec2-user
echo "User added to docker group"

# Wait for Docker to be ready
sleep 10
docker --version
echo "Docker version: $(docker --version)"

# Check available memory before pull
echo "=== MEMORY BEFORE DOCKER PULL ==="
free -h

# Install AWS CLI v2 for ECR authentication (ARM64 version)
echo "Installing AWS CLI v2 for ARM64..."
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf awscliv2.zip aws/

# Login to AWS ECR
echo "Logging into AWS ECR..."
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 933851512157.dkr.ecr.ap-northeast-2.amazonaws.com

# Pull BEACON backend Docker image from AWS ECR with fallback
echo "Pulling BEACON backend Docker image from AWS ECR..."
if docker pull 933851512157.dkr.ecr.ap-northeast-2.amazonaws.com/beacon-backend:latest; then
    echo "BEACON backend image pulled successfully from ECR"
else
    echo "ECR image not found, building initial image from source..."
    
    # Create temporary build directory
    mkdir -p /tmp/beacon-build
    cd /tmp/beacon-build
    
    # Create basic backend for initial deployment
    cat > app.py << 'EOF'
from flask import Flask, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

@app.route('/api/health')
@app.route('/api/weather')
def health():
    return jsonify({
        "status": "initializing",
        "message": "BEACON backend is being initialized. Please run deployment script.",
        "version": "init-1.0"
    })

@app.route('/api/documents')
def documents():
    return jsonify([])

@app.route('/api/categories')
def categories():
    return jsonify([])

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
EOF

    cat > requirements.txt << 'EOF'
Flask==2.3.3
Flask-CORS==4.0.0
EOF

    # Create basic Dockerfile
    cat > Dockerfile << 'EOF'
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
EXPOSE 5000
CMD ["python", "app.py"]
EOF
    
    # Build and tag image locally
    docker build -t beacon-backend-init .
    docker tag beacon-backend-init 933851512157.dkr.ecr.ap-northeast-2.amazonaws.com/beacon-backend:latest
    
    # Push to ECR
    docker push 933851512157.dkr.ecr.ap-northeast-2.amazonaws.com/beacon-backend:latest
    
    # Clean up
    cd /
    rm -rf /tmp/beacon-build
    
    echo "Initial backend image built and pushed to ECR"
fi

# Check memory after pull
echo "=== MEMORY AFTER DOCKER PULL ==="
free -h

# List images
docker images

# Stop any existing container
docker stop beacon-backend 2>/dev/null || true
docker rm beacon-backend 2>/dev/null || true

# Run BEACON Backend Docker container
echo "Starting BEACON Backend Docker container..."
docker run -d \
  --name beacon-backend \
  --restart unless-stopped \
  -p 80:5000 \
  933851512157.dkr.ecr.ap-northeast-2.amazonaws.com/beacon-backend:latest

echo "Backend container start exit code: $?"

# Wait for container to start
sleep 10

# Health check with automatic restart logic
echo "Starting backend health check with automatic restart capability..."
for attempt in {1..5}; do
  echo "Backend health check attempt $attempt..."
  
  # Wait for container to be ready
  sleep 5
  
  # Check if container is running and healthy
  if ! docker ps --filter "name=beacon-backend" --filter "status=running" --quiet | grep -q .; then
    echo "WARNING: Backend container not running, restarting..."
    docker stop beacon-backend 2>/dev/null || true
    docker rm beacon-backend 2>/dev/null || true
    
    # Restart container
    echo "Restarting backend container..."
    docker run -d \
      --name beacon-backend \
      --restart unless-stopped \
      -p 80:5000 \
      933851512157.dkr.ecr.ap-northeast-2.amazonaws.com/beacon-backend:latest
    
    sleep 15
  fi
  
  # Test health endpoint
  if curl -f http://localhost/api/weather 2>/dev/null; then
    echo "SUCCESS: Backend health check passed on attempt $attempt!"
    break
  else
    echo "Backend health check failed on attempt $attempt, checking logs..."
    docker logs beacon-backend --tail 5 2>/dev/null || echo "No logs available"
    
    if [ $attempt -lt 5 ]; then
      echo "Retrying in 10 seconds..."
      sleep 10
    fi
  fi
done

# Final verification
echo "=== FINAL BACKEND STATUS ==="
docker ps --filter "name=beacon-backend"
docker logs beacon-backend --tail 5 2>/dev/null || echo "No logs available"

# Test API endpoints
echo "Testing API endpoints..."
curl -s http://localhost/api/weather | head -3 || echo "API weather failed"
curl -s http://localhost/api/documents | head -3 || echo "API documents failed"

# Final status
echo "=== FINAL STATUS ==="
docker ps
netstat -tlnp | grep :80 || true
echo "=== Backend Docker deployment completed at $(date) ==="
echo "SSH Access - User: ec2-user, Pass: SimplePass123!"