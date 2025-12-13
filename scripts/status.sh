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
        
        # Load PORT from .env if available
        if [ -f .env ]; then
          source .env
        fi
        PORT=${PORT:-3370}
        
        # Try to check health endpoint
        echo "Health Check:"
        if curl -s -f "http://localhost:${PORT}/health" > /dev/null 2>&1; then
            echo "✓ Health endpoint is responding"
            curl -s "http://localhost:${PORT}/health" | jq . 2>/dev/null || curl -s "http://localhost:${PORT}/health"
        else
            echo "⚠ Health endpoint is not responding (service may still be starting)"
        fi
        echo ""
        
        # Show recent logs
        echo "Recent Logs (last 20 lines):"
        echo "---"
        docker compose logs --tail=20 auth-microservice
    else
        echo "❌ Service container exists but is not running"
        echo ""
        echo "Recent logs:"
        echo "---"
        docker compose logs --tail=20 auth-microservice
    fi
else
    echo "❌ Service is not running"
    echo ""
    echo "Start the service with: ./scripts/start.sh"
fi

