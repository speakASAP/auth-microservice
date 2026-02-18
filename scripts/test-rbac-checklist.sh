#!/bin/bash
# RBAC Testing Checklist - run when auth-microservice is up and (optionally) seed run.
# Uses TEST_EMAIL, TEST_PASSWORD from .env; AUTH_URL defaults to http://localhost:PORT (PORT=3370).
# Prereq: User exists; for admin tests user should have global:superadmin (run seed with --admin-email).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Preserve env overrides (e.g. AUTH_URL=http://localhost:3370) before sourcing .env
SAVED_AUTH_URL="${AUTH_URL:-}"
SAVED_TEST_EMAIL="${TEST_EMAIL:-}"
SAVED_TEST_PASSWORD="${TEST_PASSWORD:-}"
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
[ -n "$SAVED_AUTH_URL" ] && AUTH_URL="$SAVED_AUTH_URL"
[ -n "$SAVED_TEST_EMAIL" ] && TEST_EMAIL="$SAVED_TEST_EMAIL"
[ -n "$SAVED_TEST_PASSWORD" ] && TEST_PASSWORD="$SAVED_TEST_PASSWORD"

PORT=${PORT:-3370}
AUTH_URL="${AUTH_URL:-http://localhost:${PORT}}"
AUTH_URL="${AUTH_URL%/}"
TEST_EMAIL="${TEST_EMAIL:-test@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-}"

PASS=0
FAIL=0

check() {
  local name="$1"
  if [ "$2" = "1" ]; then
    echo "  ✅ $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name"
    FAIL=$((FAIL + 1))
  fi
}

echo "RBAC Testing Checklist"
echo "======================"
echo "AUTH_URL=$AUTH_URL  TEST_EMAIL=$TEST_EMAIL"
echo ""

# 1. Service health
echo "[1] Service health"
if curl -s -f --connect-timeout 3 "${AUTH_URL}/health" > /dev/null 2>&1; then
  check "Auth service responds on ${AUTH_URL}" 1
else
  check "Auth service responds on ${AUTH_URL}" 0
  echo "  Skip remaining tests (start service first)."
  echo ""
  echo "Summary: 0 passed, $((FAIL)) failed"
  exit 1
fi
echo ""

# 2. Login and JWT with roles
echo "[2] JWT tokens include roles"
if [ -z "$TEST_PASSWORD" ]; then
  check "Login (TEST_PASSWORD not set - set in .env)" 0
  TOKEN=""
else
  LOGIN=$(curl -s -w "\n%{http_code}" -X POST "${AUTH_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")
  HTTP=$(echo "$LOGIN" | tail -n1)
  BODY=$(echo "$LOGIN" | sed '$d')
  if [ "$HTTP" = "200" ] || [ "$HTTP" = "201" ]; then
    TOKEN=$(echo "$BODY" | jq -r '.accessToken' 2>/dev/null)
    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
      # Decode JWT payload (base64url)
      PAYLOAD=$(node -e "
        const part = process.argv[1];
        if (!part) process.exit(1);
        const b64 = part.replace(/-/g,'+').replace(/_/g,'/');
        try { console.log(JSON.parse(Buffer.from(b64,'base64').toString())); } catch(e) { process.exit(1); }
      " "$(echo "$TOKEN" | cut -d. -f2)" 2>/dev/null || echo "{}")
      if echo "$PAYLOAD" | jq -e '.roles | type == "array"' > /dev/null 2>&1; then
        check "Login successful and JWT payload contains roles array" 1
      else
        check "Login successful but JWT payload has no roles array (run seed with --admin-email?)" 0
      fi
    else
      check "Login 200 but no accessToken in response" 0
      TOKEN=""
    fi
  else
    check "Login failed (HTTP $HTTP - create user or set TEST_EMAIL/TEST_PASSWORD)" 0
    TOKEN=""
  fi
  if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo "  (Token obtained; length ${#TOKEN})"
  fi
fi
echo ""

# 3. Validate endpoint returns user with roles
echo "[3] Validate endpoint returns user with roles"
if [ -n "$TOKEN" ]; then
  VALIDATE=$(curl -s -w "\n%{http_code}" -X POST "${AUTH_URL}/auth/validate" \
    -H "Content-Type: application/json" \
    -d "{\"token\":\"${TOKEN}\"}")
  VHTTP=$(echo "$VALIDATE" | tail -n1)
  VBODY=$(echo "$VALIDATE" | sed '$d')
  if [ "$VHTTP" = "200" ] && echo "$VBODY" | jq -e '.valid == true and .user.roles | type == "array"' > /dev/null 2>&1; then
    check "POST /auth/validate returns valid: true and user.roles array" 1
  else
    check "POST /auth/validate (expected 200, valid and user.roles)" 0
  fi
else
  check "POST /auth/validate (skipped - no token)" 0
fi
echo ""

# 4. RolesGuard - Admin API with token -> 200
echo "[4] RolesGuard / Admin API (with valid token)"
if [ -n "$TOKEN" ]; then
  ADMIN_GET=$(curl -s -w "\n%{http_code}" -X GET "${AUTH_URL}/auth/admin/applications" \
    -H "Authorization: Bearer ${TOKEN}")
  AHTTP=$(echo "$ADMIN_GET" | tail -n1)
  if [ "$AHTTP" = "200" ]; then
    check "GET /auth/admin/applications with Bearer token -> 200" 1
  else
    check "GET /auth/admin/applications with Bearer token -> 200 (got $AHTTP - user needs global:superadmin)" 0
  fi
else
  check "GET /auth/admin/applications with token (skipped - no token)" 0
fi
echo ""

# 5. RolesGuard - Admin API without token -> 401
echo "[5] RolesGuard (without token -> 401)"
UNAUTH=$(curl -s -w "\n%{http_code}" -X GET "${AUTH_URL}/auth/admin/applications")
UHTTP=$(echo "$UNAUTH" | tail -n1)
if [ "$UHTTP" = "401" ]; then
  check "GET /auth/admin/applications without token -> 401" 1
else
  check "GET /auth/admin/applications without token -> 401 (got $UHTTP)" 0
fi
echo ""

# 6. Admin roles endpoint
echo "[6] Admin API - roles list"
if [ -n "$TOKEN" ]; then
  ROLES_GET=$(curl -s -w "\n%{http_code}" -X GET "${AUTH_URL}/auth/admin/roles" \
    -H "Authorization: Bearer ${TOKEN}")
  RHTTP=$(echo "$ROLES_GET" | tail -n1)
  if [ "$RHTTP" = "200" ]; then
    check "GET /auth/admin/roles with Bearer token -> 200" 1
  else
    check "GET /auth/admin/roles with Bearer token -> 200 (got $RHTTP)" 0
  fi
else
  check "GET /auth/admin/roles (skipped - no token)" 0
fi
echo ""

echo "======================"
echo "Summary: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
