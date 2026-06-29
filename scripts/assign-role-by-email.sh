#!/bin/bash
# Assign a role to a user by email (no admin UI). Use after seed.
#
# Usage: ./scripts/assign-role-by-email.sh --email=user@example.com --role=global:superadmin
#        ./scripts/assign-role-by-email.sh --email=test@example.com --role=app:shop-assistant:admin
#        ./scripts/assign-role-by-email.sh --email=service@example.com --role=internal:warehouse-microservice:admin --dry-run
#
# Role format: global:<role>, app:<application>:<role>, or internal:<service>:<role>

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

npx ts-node "$SCRIPT_DIR/assign-role-by-email.ts" "$@"
