#!/bin/bash
# Application Registration Script
# Registers an application in auth-microservice during deployment
#
# Usage: ./scripts/register-application.sh [service-name]
# If service-name not provided, reads from SERVICE_NAME in .env

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Service name from argument or .env
SERVICE_NAME="${1:-}"

if [ -z "$SERVICE_NAME" ]; then
  # Try to read from .env
  if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    source "$PROJECT_ROOT/.env" 2>/dev/null || true
    set +a
    SERVICE_NAME="${SERVICE_NAME:-}"
  fi
fi

if [ -z "$SERVICE_NAME" ]; then
  echo -e "${RED}❌ Error: SERVICE_NAME not provided and not found in .env${NC}"
  echo "Usage: $0 [service-name]"
  exit 1
fi

# Determine application type based on SERVICE_NAME pattern
# Internal services end with -microservice (except auth-microservice which is infrastructure)
# Infrastructure: auth-microservice, nginx-microservice, database-server
# Internal: ai-microservice, logging-microservice, notifications-microservice, etc.
# User-facing: everything else

APP_TYPE="user_facing"
if [[ "$SERVICE_NAME" == *"-microservice" ]]; then
  if [[ "$SERVICE_NAME" == "auth-microservice" ]] || [[ "$SERVICE_NAME" == "nginx-microservice" ]]; then
    APP_TYPE="infrastructure"
  else
    APP_TYPE="internal"
  fi
elif [[ "$SERVICE_NAME" == "database-server" ]]; then
  APP_TYPE="infrastructure"
fi

# Get domain from .env if available
DOMAIN="${DOMAIN:-}"
FRONTEND_URL="${FRONTEND_URL:-}"

# Use FRONTEND_URL or DOMAIN for user-facing apps
if [ "$APP_TYPE" = "user_facing" ] && [ -n "$FRONTEND_URL" ]; then
  DOMAIN="${FRONTEND_URL#https://}"
  DOMAIN="${DOMAIN#http://}"
fi

# Get display name (capitalize SERVICE_NAME)
DISPLAY_NAME=$(echo "$SERVICE_NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++)sub(/./,toupper(substr($i,1,1)),$i)}1')

# Auth service URL
AUTH_SERVICE_URL="${AUTH_SERVICE_URL:-https://auth.alfares.cz}"
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.env" 2>/dev/null || true
  set +a
  AUTH_SERVICE_URL="${AUTH_SERVICE_URL:-https://auth.alfares.cz}"
fi

# Check if auth-microservice is accessible
if ! curl -sf "${AUTH_SERVICE_URL}/health" > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Warning: Auth service not accessible at ${AUTH_SERVICE_URL}${NC}"
  echo -e "${YELLOW}   Registration will be skipped. Ensure auth-microservice is running.${NC}"
  exit 0
fi

echo -e "${BLUE}📦 Registering application: ${SERVICE_NAME}${NC}"
echo -e "   Type: ${APP_TYPE}"
echo -e "   Domain: ${DOMAIN:-N/A}"
echo ""

# Prepare registration payload
PAYLOAD=$(cat <<EOF
{
  "name": "${SERVICE_NAME}",
  "displayName": "${DISPLAY_NAME}",
  "type": "${APP_TYPE}",
  "domain": "${DOMAIN}",
  "description": "Auto-registered during deployment"
}
EOF
)

# Register application
# Try public registration first (works during initial setup), fallback to authenticated endpoint
REGISTER_URL_PUBLIC="${AUTH_SERVICE_URL}/auth/admin/applications/register-public"
REGISTER_URL_AUTH="${AUTH_SERVICE_URL}/auth/admin/applications/register"

# Try public registration first (for initial setup)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${REGISTER_URL_PUBLIC}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}" \
  2>&1) || true

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# If public registration fails with 401/403, it means apps already exist - skip registration
# (will be handled by seed script or manual registration)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo -e "${GREEN}✅ Application registered successfully${NC}"
  exit 0
elif [ "$HTTP_CODE" = "409" ]; then
  echo -e "${GREEN}✅ Application already registered${NC}"
  exit 0
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "500" ]; then
  # Public registration not available (apps exist) or error
  # Skip - will be registered via seed script or manually
  echo -e "${YELLOW}⚠️  Registration skipped (requires authentication or seed script)${NC}"
  echo -e "${YELLOW}   Application will be registered via seed script or manual registration${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Registration failed (HTTP ${HTTP_CODE})${NC}"
  echo -e "${YELLOW}   Response: ${BODY}${NC}"
  echo -e "${YELLOW}   Application will be registered via seed script or manual registration${NC}"
  exit 0
fi
