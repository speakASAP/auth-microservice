#!/bin/bash

# Status Check for Auth Microservice
# This script shows the status of the auth microservice

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "Auth Microservice Status"
echo "========================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running"
    exit 1
fi

# Check container status
if docker compose ps | grep -q "auth-microservice"; then
    echo "Container Status:"
    docker compose ps
    echo ""
    
    # Check if container is running
    if docker compose ps | grep -q "auth-microservice.*Up"; then
        echo "✓ Service is running"
        echo ""
        
        # Try to check health endpoint
        echo "Health Check:"
        if curl -s -f http://localhost:3370/health > /dev/null 2>&1; then
            echo "✓ Health endpoint is responding"
            curl -s http://localhost:3370/health | jq . 2>/dev/null || curl -s http://localhost:3370/health
        else
            echo "⚠ Health endpoint is not responding (service may still be starting)"
        fi
        echo ""
        
        # Show recent logs
        echo "Recent Logs (last 20 lines):"
        echo "---"
        docker compose logs --tail=20 auth-service
    else
        echo "❌ Service container exists but is not running"
        echo ""
        echo "Recent logs:"
        echo "---"
        docker compose logs --tail=20 auth-service
    fi
else
    echo "❌ Service is not running"
    echo ""
    echo "Start the service with: ./scripts/start.sh"
fi

