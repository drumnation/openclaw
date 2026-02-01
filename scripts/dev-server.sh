#!/bin/bash
# Start a dev instance of Clawdbot from the fork
# Runs on port 18790, bound to local network (0.0.0.0)
# Uses separate config/state dir so production is never touched
#
# Usage: ./scripts/dev-server.sh
# Access: http://192.168.1.245:18790

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV_STATE_DIR="$HOME/.clawdbot-dev"

echo "=== Clawdbot Dev Server ==="
echo "Repo:    $REPO_ROOT"
echo "State:   $DEV_STATE_DIR"
echo "Port:    18790"
echo "Bind:    0.0.0.0 (local network)"
echo "Access:  http://$(hostname -I | awk '{print $1}'):18790"
echo ""

# Build first
echo "=== Building ==="
cd "$REPO_ROOT"
pnpm build 2>&1 | tail -3
pnpm ui:build 2>&1 | tail -3
echo ""

echo "=== Starting gateway ==="
# Run with dev state directory
CLAWDBOT_STATE_DIR="$DEV_STATE_DIR" \
OPENCLAW_STATE_DIR="$DEV_STATE_DIR" \
  node "$REPO_ROOT/dist/entry.js" gateway start --foreground
