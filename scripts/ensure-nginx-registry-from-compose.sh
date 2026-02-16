#!/bin/bash
# Remove nginx-microservice registry for auth-microservice so the next deploy
# recreates it from docker-compose.blue.yml (backend + frontend).
# Use this when you add or rename services in compose so the registry matches.
# Run from auth-microservice directory or repo root. After running, deploy:
#   ./nginx-microservice/scripts/blue-green/deploy-smart.sh auth-microservice

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTH_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# Assume nginx-microservice is sibling of auth-microservice (e.g. Github/auth-microservice, Github/nginx-microservice)
GITHUB_DIR="$(cd "$AUTH_DIR/.." && pwd)"
REGISTRY_FILE="${GITHUB_DIR}/nginx-microservice/service-registry/auth-microservice.json"

if [ ! -f "$REGISTRY_FILE" ]; then
  echo "Registry file not found: $REGISTRY_FILE"
  echo "Nothing to remove. Next deploy will auto-create from docker-compose."
  exit 0
fi

rm -f "$REGISTRY_FILE"
echo "Removed $REGISTRY_FILE"
echo "Next deploy will auto-create registry from docker-compose.blue.yml (backend + frontend)."
echo "Run: ./nginx-microservice/scripts/blue-green/deploy-smart.sh auth-microservice"
