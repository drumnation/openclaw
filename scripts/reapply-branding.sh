#!/bin/bash
# BrainClaw Branding Re-Apply Script
# Run after any upstream merge to restore fork branding.
set -e
FORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RENDER="$FORK_DIR/ui/src/ui/app-render.ts"
INDEX="$FORK_DIR/ui/index.html"
MANIFEST="$FORK_DIR/ui/public/manifest.json"

echo "=== BrainClaw Branding Re-Apply ==="

# 1. Fix app-render.ts — replace brand-logo img (handles any src/alt pattern)
sed -i 's|<img src=\${basePath ? `\${basePath}/[^`]*` : "[^"]*"} alt="[^"]*"[^/]*/> *|<img src=${basePath ? `${basePath}/brainclaw-icon.png` : "/brainclaw-icon.png"} alt="BrainClaw" style="border-radius:50%;" />|' "$RENDER"
sed -i 's|<div class="brand-title">[^<]*</div>|<div class="brand-title">BRAINCLAW</div>|' "$RENDER"
echo "  ✓ app-render.ts patched"

# 2. Fix index.html title
sed -i 's|<title>[^<]*</title>|<title>BrainClaw</title>|' "$INDEX"
echo "  ✓ index.html patched"

# 3. Fix manifest.json name
sed -i 's|"name": "[^"]*"|"name": "BrainClaw Gateway"|' "$MANIFEST"
echo "  ✓ manifest.json patched"

# 4. Check icon
[ -f "$FORK_DIR/ui/public/brainclaw-icon.png" ] && echo "  ✓ brainclaw-icon.png present" || echo "  ⚠ brainclaw-icon.png MISSING!"

echo ""
echo "Done. Now run: ~/openclaw-fork/deploy-ui.sh"
