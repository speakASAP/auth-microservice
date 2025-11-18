#!/bin/bash

# Start Auth Microservice
# This script starts the auth microservice using Docker Compose

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "Starting auth-microservice..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found. Please create it from .env.example"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Check if nginx-network exists
if ! docker network inspect nginx-network > /dev/null 2>&1; then
    echo "Warning: nginx-network not found. Creating it..."
    docker network create nginx-network
fi

# Start the service
docker compose up -d

# Wait a moment for the service to start
sleep 2

# Check service status
if docker compose ps | grep -q "auth-microservice.*Up"; then
    echo "✓ Auth microservice started successfully"
    echo ""
    echo "Service is running on:"
    echo "  - Internal: http://auth-microservice:3370"
    echo "  - External: https://auth.statex.cz"
    echo ""
    echo "View logs with: ./scripts/status.sh"
    echo "Stop service with: ./scripts/stop.sh"
else
    echo "Error: Service failed to start. Check logs with: docker compose logs auth-service"
    exit 1
fi

