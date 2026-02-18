#!/bin/bash
# RBAC Seed Script Wrapper
# Runs the TypeScript seed script
#
# Usage: ./scripts/seed-rbac.sh [--admin-email=your@email.com]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the seed script (use npx so local ts-node from devDependencies is used)
echo "🌱 Running RBAC seed script..."
npx ts-node "$SCRIPT_DIR/seed-rbac.ts" "$@"
