# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --silent

# Copy source code
COPY . .

# Build the React app
RUN npm run build

# Production stage
FROM nginx:alpine

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Copy nginx configuration and entrypoint
COPY default.conf.template /default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built React app from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Create health check endpoint
RUN echo "healthy" > /usr/share/nginx/html/health

# Create non-root user for security (nginx user already exists in nginx:alpine)
RUN adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G nginx beaconuser

# Set proper permissions
RUN chown -R beaconuser:nginx /usr/share/nginx/html && \
    chown -R beaconuser:nginx /var/cache/nginx && \
    chown -R beaconuser:nginx /var/log/nginx && \
    chown -R beaconuser:nginx /etc/nginx/conf.d && \
    chown beaconuser:nginx /default.conf.template && \
    touch /var/run/nginx.pid && \
    chown -R beaconuser:nginx /var/run/nginx.pid

USER beaconuser

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Run entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]