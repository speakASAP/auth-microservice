#!/bin/bash

# Performance Check Script for Auth Microservice
# This script checks the performance of the auth-microservice

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "Auth Microservice Performance Check"
echo "==================================="
echo ""

# Load environment variables from .env if available
if [ -f .env ]; then
  source .env
fi

PORT=${PORT:-3370}
AUTH_URL="http://localhost:${PORT}"

echo "Testing login endpoint performance..."
echo ""

# Test login multiple times and measure response time
for i in {1..3}; do
  echo "Test $i:"
  START_TIME=$(date +%s%N)
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${AUTH_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"ssfskype@gmail.com","password":"Password123!"}' \
    --max-time 30)
  END_TIME=$(date +%s%N)
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  DURATION_MS=$(( (END_TIME - START_TIME) / 1000000 ))
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "  ✓ Success - HTTP $HTTP_CODE - Duration: ${DURATION_MS}ms"
  else
    echo "  ❌ Failed - HTTP $HTTP_CODE - Duration: ${DURATION_MS}ms"
  fi
  
  if [ $DURATION_MS -gt 5000 ]; then
    echo "  ⚠ WARNING: Response time is very slow (>5 seconds)"
  fi
  
  echo ""
  sleep 1
done

echo "Performance check completed"

