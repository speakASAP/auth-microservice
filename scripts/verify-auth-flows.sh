#!/bin/bash
# Verify auth flows (magic link, Google OAuth init, allowlist, unsupported provider).
# Run against a running backend: ./scripts/verify-auth-flows.sh
# Or against prod: AUTH_URL=https://auth.alfares.cz ./scripts/verify-auth-flows.sh
# These are real HTTP calls; no mocks.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Backend base URL (local or https)
AUTH_URL="${AUTH_URL:-http://localhost:${PORT:-3370}}"
AUTH_URL="${AUTH_URL%/}"

# return_url must be a full URL whose origin is allowlisted (e.g. https://auth.alfares.cz/)
# Use DOMAIN to build a concrete URL; if only wildcard like *.alfares.cz in env, use DOMAIN
if [ -n "$DOMAIN" ]; then
  RETURN_URL="https://${DOMAIN}/"
else
  FIRST_ORIGIN=$(echo "$AUTH_ALLOWED_REDIRECT_ORIGINS" | cut -d',' -f1 | tr -d ' ')
  if [ -n "$FIRST_ORIGIN" ] && echo "$FIRST_ORIGIN" | grep -q '^https\?://'; then
    RETURN_URL="${FIRST_ORIGIN%/}/"
  else
    RETURN_URL="https://auth.alfares.cz/"
  fi
fi

PASS=0
FAIL=0

echo "Auth flows verification (real backend)"
echo "======================================"
echo "  AUTH_URL:    $AUTH_URL"
echo "  return_url:  $RETURN_URL"
echo ""

# Health check
echo -n "1. Health check ... "
if curl -s -f -o /dev/null "${AUTH_URL}/health" 2>/dev/null; then
  echo "OK"; PASS=$((PASS+1))
else
  echo "FAIL (backend not reachable)"; FAIL=$((FAIL+1))
  echo "   Start backend or set AUTH_URL. Example: AUTH_URL=https://auth.alfares.cz $0"
  exit 1
fi

# Magic link request — valid return_url
echo -n "2. Magic link request (valid return_url) ... "
RESP=$(curl -s -w "\n%{http_code}" -X POST "${AUTH_URL}/auth/magic-link/request" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"verify-test-$(date +%s)@example.com\",\"return_url\":\"${RETURN_URL}\",\"state\":\"verify-script\"}")
CODE=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$CODE" = "200" ] && echo "$BODY" | grep -q '"success":true'; then
  echo "OK"; PASS=$((PASS+1))
else
  echo "FAIL (HTTP $CODE)"; FAIL=$((FAIL+1))
  echo "   Body: $BODY"
fi

# Magic link request — invalid return_url (not allowlisted)
echo -n "3. Magic link request (invalid return_url) ... "
RESP=$(curl -s -w "\n%{http_code}" -X POST "${AUTH_URL}/auth/magic-link/request" \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","return_url":"https://evil.example.com/cb"}')
CODE=$(echo "$RESP" | tail -n1)
if [ "$CODE" = "400" ]; then
  echo "OK (rejected as expected)"; PASS=$((PASS+1))
else
  echo "FAIL (expected 400, got $CODE)"; FAIL=$((FAIL+1))
fi

# Google OAuth init — must respond with 302 and Location to accounts.google.com
echo -n "4. Google OAuth init (redirect to Google) ... "
HEADERS=$(curl -s -I -X GET "${AUTH_URL}/auth/oauth/google?return_url=${RETURN_URL}&state=verify-google" 2>/dev/null || true)
CODE=$(echo "$HEADERS" | grep -i "^HTTP/" | awk '{print $2}')
LOCATION=$(echo "$HEADERS" | grep -i "^location:" | cut -d' ' -f2- | tr -d '\r')
if [ "$CODE" = "302" ] && echo "$LOCATION" | grep -q "accounts.google.com"; then
  echo "OK (302 to Google)"; PASS=$((PASS+1))
else
  echo "FAIL (code=$CODE, expected 302; location=$LOCATION)"; FAIL=$((FAIL+1))
fi

# Unsupported OAuth provider
echo -n "5. Unsupported provider (twitter) ... "
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${AUTH_URL}/auth/oauth/twitter?return_url=${RETURN_URL}")
if [ "$CODE" = "400" ]; then
  echo "OK (400 as expected)"; PASS=$((PASS+1))
else
  echo "FAIL (expected 400, got $CODE)"; FAIL=$((FAIL+1))
fi

# Password login (if TEST_EMAIL/TEST_PASSWORD set)
if [ -n "$TEST_EMAIL" ] && [ -n "$TEST_PASSWORD" ]; then
  echo -n "6. Password login ... "
  RESP=$(curl -s -w "\n%{http_code}" -X POST "${AUTH_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")
  CODE=$(echo "$RESP" | tail -n1)
  if [ "$CODE" = "200" ]; then
    echo "OK"; PASS=$((PASS+1))
  else
    echo "FAIL (HTTP $CODE)"; FAIL=$((FAIL+1))
  fi
else
  echo "6. Password login ... SKIP (set TEST_EMAIL and TEST_PASSWORD in .env to test)"
fi

echo ""
echo "Result: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
