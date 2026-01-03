#!/bin/bash

# Test Login Script for Auth Microservice
# This script tests the login endpoint with test credentials

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "Auth Microservice Login Test"
echo "============================"
echo ""

# Load environment variables from .env if available
if [ -f .env ]; then
  source .env
  echo "✓ Loaded .env file"
else
  echo "⚠ No .env file found"
fi

# Get PORT from environment or use default
PORT=${PORT:-3370}
AUTH_URL="http://localhost:${PORT}"

# Check if service is running
echo "Checking service status..."
if curl -s -f "${AUTH_URL}/health" > /dev/null 2>&1; then
  echo "✓ Service is running on port ${PORT}"
  echo ""
else
  echo "❌ Service is not responding on port ${PORT}"
  echo "   Please start the service first: ./scripts/start.sh"
  exit 1
fi

# Get test credentials from environment or use defaults
TEST_EMAIL="${TEST_EMAIL:-test@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-testpassword123}"

echo "Test Configuration:"
echo "  Email: ${TEST_EMAIL}"
echo "  Password: [hidden]"
echo "  Auth URL: ${AUTH_URL}"
echo ""

# Test login endpoint
echo "Testing login endpoint..."
echo "POST ${AUTH_URL}/auth/login"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${AUTH_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response HTTP Code: ${HTTP_CODE}"
echo "Response Body:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Login successful!"
  ACCESS_TOKEN=$(echo "$BODY" | jq -r '.accessToken' 2>/dev/null)
  if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
    echo "✓ Access token received"
    echo "  Token (first 50 chars): ${ACCESS_TOKEN:0:50}..."
  fi
elif [ "$HTTP_CODE" = "401" ]; then
  echo "❌ Login failed: Invalid credentials"
  echo ""
  echo "Possible issues:"
  echo "  1. User does not exist - try registering first"
  echo "  2. Password is incorrect"
  echo "  3. User account is inactive"
  echo ""
  echo "To register a test user, run:"
  echo "  curl -X POST ${AUTH_URL}/auth/register \\"
  echo "    -H \"Content-Type: application/json\" \\"
  echo "    -d '{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}'"
elif [ "$HTTP_CODE" = "503" ]; then
  echo "❌ Service unavailable"
  echo "   The auth-microservice may be down or unreachable"
else
  echo "❌ Unexpected response: HTTP ${HTTP_CODE}"
fi

echo ""
echo "Test completed"

