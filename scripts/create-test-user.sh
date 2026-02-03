#!/bin/bash

# Create Test User Script for Auth Microservice
# This script creates a test user for testing login functionality

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "Auth Microservice - Create Test User"
echo "===================================="
echo ""

# Load environment variables from .env if available
if [ -f .env ]; then
  source .env
  echo "✓ Loaded .env file"
else
  echo "⚠ No .env file found"
fi

# AUTH_URL: use if set (e.g. https://auth.statex.cz on prod); otherwise try localhost
PORT=${PORT:-3370}
if [ -n "$AUTH_URL" ]; then
  AUTH_URL="${AUTH_URL%/}"
else
  # On prod after blue/green deploy, active backend may be on 3370 (blue) or 3371 (green)
  if curl -s -f --connect-timeout 2 "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    AUTH_URL="http://localhost:${PORT}"
  elif curl -s -f --connect-timeout 2 "http://localhost:3371/health" > /dev/null 2>&1; then
    AUTH_URL="http://localhost:3371"
  else
    AUTH_URL="http://localhost:${PORT}"
  fi
fi

# Get test credentials from environment or use defaults
TEST_EMAIL="${TEST_EMAIL:-test@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-testpassword123}"
TEST_FIRST_NAME="${TEST_FIRST_NAME:-Test}"
TEST_LAST_NAME="${TEST_LAST_NAME:-User}"

echo "Test User Configuration:"
echo "  Email: ${TEST_EMAIL}"
echo "  Password: [hidden]"
echo "  First Name: ${TEST_FIRST_NAME}"
echo "  Last Name: ${TEST_LAST_NAME}"
echo "  Auth URL: ${AUTH_URL}"
echo ""

# Check if service is running
echo "Checking service status..."
if curl -s -f --connect-timeout 5 "${AUTH_URL}/health" > /dev/null 2>&1; then
  echo "✓ Service is responding at ${AUTH_URL}"
  echo ""
else
  echo "❌ Service is not responding at ${AUTH_URL}"
  echo "   On prod, set AUTH_URL=https://\${DOMAIN} in .env (e.g. https://auth.statex.cz) or ensure backend is running."
  echo "   Locally: ./scripts/start.sh"
  exit 1
fi

# Check if user already exists
echo "Checking if user already exists..."
EXISTING_USER=$(curl -s -X POST "${AUTH_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\"
  }")

if echo "$EXISTING_USER" | grep -q "accessToken"; then
  echo "✓ Test user already exists and credentials are valid!"
  echo ""
  echo "User details:"
  echo "$EXISTING_USER" | jq . 2>/dev/null || echo "$EXISTING_USER"
  exit 0
fi

# Register new test user
echo "Registering new test user..."
echo "POST ${AUTH_URL}/auth/register"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${AUTH_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\",
    \"firstName\": \"${TEST_FIRST_NAME}\",
    \"lastName\": \"${TEST_LAST_NAME}\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response HTTP Code: ${HTTP_CODE}"
echo "Response Body:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✓ Test user created successfully!"
  ACCESS_TOKEN=$(echo "$BODY" | jq -r '.accessToken' 2>/dev/null)
  if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
    echo "✓ Access token received"
    echo "  Token (first 50 chars): ${ACCESS_TOKEN:0:50}..."
  fi
elif [ "$HTTP_CODE" = "409" ]; then
  echo "⚠ User already exists (this is OK)"
  echo "   Try logging in with the credentials"
elif [ "$HTTP_CODE" = "503" ]; then
  echo "❌ Service unavailable"
  echo "   The auth-microservice may be down or unreachable"
else
  echo "❌ Failed to create test user: HTTP ${HTTP_CODE}"
  exit 1
fi

echo ""
echo "Test user setup completed"

