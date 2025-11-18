#!/bin/bash

# Stop Auth Microservice
# This script stops the auth microservice using Docker Compose

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "Stopping auth-microservice..."

# Stop the service
docker compose down

echo "✓ Auth microservice stopped"

