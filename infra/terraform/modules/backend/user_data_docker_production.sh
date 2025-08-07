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

# Pull BEACON backend Docker image from Docker Hub
echo "Pulling BEACON backend Docker image from Docker Hub..."
docker pull sksda4614/beacon-backend:latest
echo "BEACON backend image pulled successfully"

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
  sksda4614/beacon-backend:latest

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
      sksda4614/beacon-backend:latest
    
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