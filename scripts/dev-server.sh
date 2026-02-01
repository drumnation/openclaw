#!/bin/bash
# Start a dev instance of Clawdbot from the fork
# Runs on port 19001, bound to local network
# Uses separate config at ~/.openclaw/openclaw.json
# Production on port 18789 is UNTOUCHED
#
# Usage: ./scripts/dev-server.sh
# Access: http://192.168.1.245:19001

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV_PORT=19001
DEV_TOKEN="dev-test-token-12345"

echo "=== Clawdbot Dev Server ==="
echo "Repo:    $REPO_ROOT"
echo "Port:    $DEV_PORT"
echo "Access:  http://$(hostname -I | awk '{print $1}'):$DEV_PORT"
echo ""

# Build
echo "=== Building ==="
cd "$REPO_ROOT"
pnpm build 2>&1 | tail -3
pnpm ui:build 2>&1 | tail -3
echo ""

echo "=== Starting gateway ==="
OPENCLAW_CONFIG_PATH="$HOME/.openclaw/openclaw.json" \
OPENCLAW_GATEWAY_PORT="$DEV_PORT" \
  exec node "$REPO_ROOT/dist/entry.js" gateway run \
    --port "$DEV_PORT" \
    --bind lan \
    --token "$DEV_TOKEN"
