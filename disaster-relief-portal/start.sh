#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║     Disaster Relief Coordination Portal     ║"
echo "  ║         Bun + Next.js + SQLite              ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ---- Check Bun ----
if ! command -v bun &> /dev/null; then
  echo "  ❌ Bun is not installed."
  echo ""
  echo "  Install Bun with:"
  echo "    curl -fsSL https://bun.sh/install | bash"
  echo ""
  echo "  Or visit: https://bun.sh"
  exit 1
fi

BUN_VERSION=$(bun --version 2>/dev/null || echo "unknown")
echo "  ✅ Bun $BUN_VERSION"

# ---- Install dependencies if needed ----
if [ ! -d "node_modules" ]; then
  echo ""
  echo "  📦 Installing dependencies with Bun..."
  bun install
  echo "  ✅ Dependencies installed"
else
  echo "  ✅ Dependencies already installed"
fi

# ---- Check for existing database ----
if [ -f "disaster_relief.sqlite" ]; then
  echo "  ✅ SQLite database ready"
else
  echo "  🆕 SQLite database will be created on first run (with seed data)"
fi

echo ""
echo "  🚀 Starting Next.js on http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

# ---- Start dev server ----
bun run dev
