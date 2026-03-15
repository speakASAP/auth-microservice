#!/bin/bash
# Assign a role to a user by email (no admin UI). Use after seed.
#
# Usage: ./scripts/assign-role-by-email.sh --email=user@example.com --role=global:superadmin
#        ./scripts/assign-role-by-email.sh --email=test@example.com --role=app:shop-assistant:admin
#
# Role must be one of: global:superadmin, app:shop-assistant:admin

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

npx ts-node "$SCRIPT_DIR/assign-role-by-email.ts" "$@"
