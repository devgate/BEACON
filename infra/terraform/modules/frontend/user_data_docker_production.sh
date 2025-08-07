#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "=== Starting Frontend Docker deployment with SSH access at $(date) ==="

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

# Pull BEACON frontend Docker image from Docker Hub
echo "Pulling BEACON frontend Docker image from Docker Hub..."
docker pull sksda4614/beacon-frontend:latest
echo "BEACON frontend image pulled successfully"

# Check memory after pull
echo "=== MEMORY AFTER DOCKER PULL ==="
free -h

# List images
docker images

# Stop any existing container
docker stop beacon-frontend 2>/dev/null || true
docker rm beacon-frontend 2>/dev/null || true

# Run BEACON Frontend Docker container with backend domain
echo "Starting BEACON Frontend Docker container..."

docker run -d \
  --name beacon-frontend \
  --restart unless-stopped \
  -p 80:80 \
  -e BACKEND_HOST=api.beacon.sk-shieldus.com \
  -e BACKEND_PORT=443 \
  -e BACKEND_PROTOCOL=https \
  sksda4614/beacon-frontend:latest

# Wait for container to start
sleep 10

# Health check with automatic restart logic
echo "Starting health check with automatic restart capability..."
for attempt in {1..5}; do
  echo "Health check attempt $attempt..."
  
  # Wait for container to be ready
  sleep 5
  
  # Check if container is running
  if ! docker ps --filter "name=beacon-frontend" --filter "status=running" --quiet | grep -q .; then
    echo "WARNING: Container not running, restarting..."
    docker stop beacon-frontend 2>/dev/null || true
    docker rm beacon-frontend 2>/dev/null || true
    
    # Restart with explicit environment variables
    echo "Restarting container with fresh environment..."
    docker run -d \
      --name beacon-frontend \
      --restart unless-stopped \
      -p 80:80 \
      -e BACKEND_HOST=api.beacon.sk-shieldus.com \
      -e BACKEND_PORT=443 \
      -e BACKEND_PROTOCOL=https \
      sksda4614/beacon-frontend:latest
    
    sleep 10
  fi
  
  # Test health endpoint
  if curl -f http://localhost/health 2>/dev/null; then
    echo "SUCCESS: Frontend health check passed on attempt $attempt!"
    
    # Verify environment variables are correctly set
    if docker logs beacon-frontend 2>/dev/null | grep -q "api.beacon.sk-shieldus.com:443"; then
      echo "✅ Environment variables correctly configured"
      break
    else
      echo "⚠️ Environment variables not properly set, will retry..."
      continue
    fi
  else
    echo "Health check failed on attempt $attempt, checking container logs..."
    docker logs beacon-frontend --tail 5 2>/dev/null || echo "No logs available"
    
    if [ $attempt -lt 5 ]; then
      echo "Retrying in 10 seconds..."
      sleep 10
    fi
  fi
done

# Final verification
echo "=== Final Container Status ==="
docker ps --filter "name=beacon-frontend"
docker logs beacon-frontend --tail 3 2>/dev/null | grep "Backend configuration" || echo "No backend config log found"

# Remove old HTML content creation since we're using our own image
echo "BEACON Frontend container is running with built-in content"

# The BEACON frontend image contains the full application
# No additional HTML setup needed

echo "Frontend container start exit code: $?"

# Wait for container to start
sleep 15
echo "Container started, checking status..."

# Check container status
echo "=== CONTAINER STATUS ==="
docker ps -a
docker logs beacon-frontend 2>/dev/null || echo "No logs yet"

# Check memory usage
echo "=== MEMORY AFTER CONTAINER START ==="
free -h

# Test health endpoint
echo "Testing health endpoint..."
for i in {1..20}; do
  if curl -f http://localhost/health 2>/dev/null; then
    echo "SUCCESS: Frontend health check passed on attempt $i!"
    break
  else
    echo "Health check attempt $i failed, retrying in 3 seconds..."
    sleep 3
  fi
done

# Final status
echo "=== FINAL STATUS ==="
docker ps
netstat -tlnp | grep :80 || true
echo "=== Frontend Docker deployment completed at $(date) ==="
echo "SSH Access - User: ec2-user, Pass: SimplePass123!"