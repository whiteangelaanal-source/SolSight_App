#!/bin/bash

# SolSight Production Deployment Script
# This script handles the complete deployment process

set -e  # Exit on any error

# Configuration
APP_NAME="solsight-api"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-your-registry.com}"
BACKUP_DIR="/backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="/var/log/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

# Error logging
error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Success logging
success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Warning logging
warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking deployment prerequisites..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check environment variables
    if [[ -z "$JWT_SECRET" ]]; then
        error "JWT_SECRET environment variable is not set."
        exit 1
    fi

    if [[ -z "$FIREBASE_PROJECT_ID" ]]; then
        error "FIREBASE_PROJECT_ID environment variable is not set."
        exit 1
    fi

    success "All prerequisites checked"
}

# Create backup
create_backup() {
    log "Creating backup of current deployment..."

    # Create backup directory
    sudo mkdir -p "$BACKUP_DIR"

    # Backup Docker containers and images
    if docker ps | grep -q solsight; then
        log "Backing up current containers..."
        docker export solsight-api > "$BACKUP_DIR/solsight-api-container.tar" 2>/dev/null || true
        docker save $(docker images -q solsight-api:latest) > "$BACKUP_DIR/solsight-api-image.tar" 2>/dev/null || true
    fi

    # Backup configuration files
    cp -r .env "$BACKUP_DIR/" 2>/dev/null || true
    cp -r nginx.conf "$BACKUP_DIR/" 2>/dev/null || true

    success "Backup created at $BACKUP_DIR"
}

# Build Docker image
build_image() {
    log "Building Docker image..."

    # Build new image
    docker build -t "$APP_NAME:latest" .

    # Tag with version
    VERSION=$(date +%Y%m%d_%H%M%S)
    docker tag "$APP_NAME:latest" "$APP_NAME:$VERSION"

    success "Docker image built successfully"
}

# Deploy new version
deploy_application() {
    log "Deploying new version..."

    # Stop current containers
    if docker ps | grep -q solsight; then
        log "Stopping current containers..."
        docker-compose down
    fi

    # Pull latest updates
    log "Pulling latest updates..."
    docker-compose pull

    # Start new containers
    log "Starting new containers..."
    docker-compose up -d

    # Wait for health check
    log "Waiting for application to be healthy..."
    sleep 10

    # Health check
    local attempts=0
    local max_attempts=30
    local healthy=false

    while [ $attempts -lt $max_attempts ]; do
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            healthy=true
            break
        fi

        attempts=$((attempts + 1))
        echo "Health check attempt $attempts/$max_attempts..."
        sleep 2
    done

    if [ "$healthy" = true ]; then
        success "Application is healthy and running"
    else
        error "Application failed health check after $max_attempts attempts"

        # Show logs
        log "Application logs:"
        docker-compose logs --tail=50 solsight-api

        exit 1
    fi
}

# Post-deployment verification
verify_deployment() {
    log "Verifying deployment..."

    # Check API endpoints
    local endpoints=(
        "/health"
        "/api"
        "/api/auth/login"
        "/api/users"
        "/api/admin/users"
    )

    for endpoint in "${endpoints[@]}"; do
        if curl -f -s -o /dev/null -w "%{http_code}" "http://localhost:3000$endpoint" | grep -q "200\|401"; then
            success "Endpoint $endpoint is responding"
        else
            warn "Endpoint $endpoint returned unexpected response"
        fi
    done

    # Check database connectivity
    if docker exec solsight-api node -e "
        const admin = require('./src/middleware/adminAuth');
        const db = require('./src/config/database');
        try {
          db.testConnection();
          console.log('Database connection: OK');
          process.exit(0);
        } catch (error) {
          console.log('Database connection: FAILED', error.message);
          process.exit(1);
        }
    " 2>/dev/null; then
        success "Database connectivity verified"
    else
        warn "Database connectivity check failed"
    fi

    success "Deployment verification completed"
}

# Clean up old resources
cleanup() {
    log "Cleaning up old resources..."

    # Remove old Docker images (keep last 5)
    docker images "$APP_NAME" --format "table {{.Repository}}:{{.Tag}}" | \
        tail -n +6 | \
        awk '{print $1":"$2}' | \
        xargs -r docker rmi 2>/dev/null || true

    # Clean up old backups (keep last 7 days)
    find /backups -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true

    # Clean up old logs (keep last 30 days)
    find /var/log -name "*.log" -mtime +30 -delete 2>/dev/null || true

    success "Cleanup completed"
}

# Rollback function
rollback() {
    log "Initiating rollback to previous version..."

    if [ ! -d "$BACKUP_DIR" ]; then
        error "No backup found for rollback"
        exit 1
    fi

    # Stop current containers
    docker-compose down

    # Load backup image
    if [ -f "$BACKUP_DIR/solsight-api-image.tar" ]; then
        docker load < "$BACKUP_DIR/solsight-api-image.tar"
    fi

    # Start with backup
    docker-compose up -d

    success "Rollback completed"
}

# Main deployment function
main() {
    log "Starting SolSight deployment process..."

    # Check for rollback flag
    if [[ "$1" == "rollback" ]]; then
        rollback
        exit 0
    fi

    # Run deployment steps
    check_prerequisites
    create_backup
    build_image
    deploy_application
    verify_deployment
    cleanup

    success "Deployment completed successfully!"
    log "Application is available at: https://api.solsight.app"
}

# Handle script interruption
trap 'error "Deployment interrupted"; exit 1' INT TERM

# Run main function with all arguments
main "$@"