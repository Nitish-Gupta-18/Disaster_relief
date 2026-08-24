#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/disaster-relief-portal"

echo "  Starting Disaster Relief Portal..."
echo ""

# Check Bun
if ! command -v bun &> /dev/null; then
  echo "  Bun is not installed."
  echo "  Install: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

# Install deps if missing
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  bun install
fi

echo "  http://localhost:3000"
echo ""

bun run dev
