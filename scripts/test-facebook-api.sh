#!/bin/bash
# Test Facebook App API calls using credentials from .env
# Run from auth-microservice: ./scripts/test-facebook-api.sh
# These calls help satisfy Facebook App Testing requirements (API test calls).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "Facebook App API test (using .env)"
echo "=================================="
echo ""

if [ ! -f .env ]; then
  echo "No .env found. Create .env with FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET."
  exit 1
fi

# Load .env (avoid exporting secrets beyond this script)
set -a
source .env
set +a

FB_CLIENT_ID="${FACEBOOK_CLIENT_ID:-}"
FB_CLIENT_SECRET="${FACEBOOK_CLIENT_SECRET:-}"

if [ -z "$FB_CLIENT_ID" ] || [ -z "$FB_CLIENT_SECRET" ]; then
  echo "Set FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET in .env"
  exit 1
fi

FB_API_VERSION="v12.0"
BASE_URL="https://graph.facebook.com/${FB_API_VERSION}"

echo "1. Requesting app access token..."
APP_TOKEN_RESP=$(curl -s -w "\n%{http_code}" -G "${BASE_URL}/oauth/access_token" \
  --data-urlencode "client_id=${FB_CLIENT_ID}" \
  --data-urlencode "client_secret=${FB_CLIENT_SECRET}" \
  --data-urlencode "grant_type=client_credentials")
HTTP_BODY=$(echo "$APP_TOKEN_RESP" | head -n -1)
HTTP_CODE=$(echo "$APP_TOKEN_RESP" | tail -n 1)

if [ "$HTTP_CODE" != "200" ]; then
  echo "   Failed (HTTP $HTTP_CODE): $HTTP_BODY"
  exit 1
fi

# Extract access_token (format: access_token=... or {"access_token":"..."})
APP_ACCESS_TOKEN=$(echo "$HTTP_BODY" | sed -n 's/.*access_token=\([^&]*\).*/\1/p')
if [ -z "$APP_ACCESS_TOKEN" ]; then
  APP_ACCESS_TOKEN=$(echo "$HTTP_BODY" | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi
if [ -z "$APP_ACCESS_TOKEN" ]; then
  echo "   Could not parse access_token from: $HTTP_BODY"
  exit 1
fi
echo "   OK (app token obtained)"
echo ""

echo "2. Graph API call: GET /app (app info)..."
APP_INFO_RESP=$(curl -s -w "\n%{http_code}" "${BASE_URL}/app?access_token=${APP_ACCESS_TOKEN}")
APP_INFO_BODY=$(echo "$APP_INFO_RESP" | head -n -1)
APP_INFO_CODE=$(echo "$APP_INFO_RESP" | tail -n 1)
if [ "$APP_INFO_CODE" = "200" ]; then
  echo "   OK"
  echo "   Response: $APP_INFO_BODY"
else
  echo "   Failed (HTTP $APP_INFO_CODE): $APP_INFO_BODY"
fi
echo ""

echo "3. Graph API call: GET /debug_token (validate app token)..."
DEBUG_RESP=$(curl -s -w "\n%{http_code}" "${BASE_URL}/debug_token?input_token=${APP_ACCESS_TOKEN}&access_token=${APP_ACCESS_TOKEN}")
DEBUG_BODY=$(echo "$DEBUG_RESP" | head -n -1)
DEBUG_CODE=$(echo "$DEBUG_RESP" | tail -n 1)
if [ "$DEBUG_CODE" = "200" ]; then
  echo "   OK"
  echo "   Response: $DEBUG_BODY"
else
  echo "   Failed (HTTP $DEBUG_CODE): $DEBUG_BODY"
fi
echo ""

echo "Done. API calls above may appear in Facebook App Testing after a short delay."
echo ""
echo "To register test calls for 'Facebook Login' / public_profile:"
echo "  1. Open: https://$(echo "${DOMAIN:-auth.alfares.cz}")/auth/oauth/facebook?return_url=https://${DOMAIN:-auth.alfares.cz}/"
echo "  2. Sign in with a Facebook test user (or your account in development)."
echo "  3. Our backend will call Graph API for profile; that counts as an API test call."
