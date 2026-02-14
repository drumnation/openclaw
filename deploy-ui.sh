#!/bin/bash
# deploy-ui.sh - Build and deploy BrainClaw fork to all 3 dynasty brothers
# Usage: cd ~/openclaw-fork && bash deploy-ui.sh
set -e
export PATH=$HOME/.local/share/fnm/node-versions/v22.22.0/installation/bin:$PATH

echo "===== BRAINCLAW DEPLOY ====="

echo "1. Pulling latest..."
cd ~/openclaw-fork && git pull origin brain-garden

echo "2. Building backend..."
npm install --silent 2>&1 | tail -1
npm run build 2>&1 | tail -3

echo "3. Building UI..."
cd ui && npm install --silent 2>&1 | tail -1 && npx vite build 2>&1 | tail -2 && cd ..

echo "4. Restarting Day..."
systemctl --user restart clawdbot-gateway.service && sleep 5
echo "   Day: $(systemctl --user is-active clawdbot-gateway.service)"

echo "5. Deploying Dusk..."
ssh -o ConnectTimeout=10 beelink 'cd ~/openclaw-fork && export PATH=$HOME/.nvm/versions/node/v22.22.0/bin:$PATH && git pull origin brain-garden 2>&1 | tail -1 && npm install --silent 2>&1 | tail -1 && npm run build 2>&1 | tail -1 && cd ui && npm install --silent 2>&1 | tail -1 && npx vite build 2>&1 | tail -1 && cd .. && systemctl --user restart openclaw-gateway 2>/dev/null && echo "   Dusk: OK"' || echo "   Dusk: SSH failed"

echo "6. Deploying Dawn..."
ssh -o ConnectTimeout=10 gaming-pc 'cd ~/openclaw-fork && export HOME=/home/dave && export PATH=/home/dave/.nvm/versions/node/v22.22.0/bin:$PATH && git pull origin brain-garden 2>&1 | tail -1 && npm install --silent 2>&1 | tail -1 && npm run build 2>&1 | tail -1 && cd ui && npm install --silent 2>&1 | tail -1 && npx vite build 2>&1 | tail -1' || echo "   Dawn: build failed"
# Restart Dawn separately (pkill can kill SSH session)
ssh -o ConnectTimeout=10 gaming-pc 'kill $(pgrep -f openclaw-gateway) 2>/dev/null; sleep 2; export HOME=/home/dave; export PATH=/home/dave/.nvm/versions/node/v22.22.0/bin:$PATH; nohup openclaw gateway --port 18791 >> /tmp/openclaw.log 2>&1 &' 2>/dev/null || true
echo "   Dawn: restarted"

echo ""
echo "7. Health check (waiting 5s)..."
sleep 5
node -e '
const W = require("ws");
const targets = [
  ["Day", "ws://localhost:18789/ws", "999556ca8a9b025339cb28c602293da636091324e6f8e5e3"],
  ["Dusk", "ws://192.168.1.234:18790/ws", "aa2a6237ba9f105090b1aa2fcfa0418c567a4f942acb35c1"],
  ["Dawn", "ws://192.168.1.248:18791/ws", "da4d1150742b9e5fdd73d307"]
];
let done = 0;
for (const [name, url, token] of targets) {
  const s = Date.now();
  const w = new W(url + "?token=" + token);
  w.on("open", () => { console.log("   " + name + " WS: OK " + (Date.now()-s) + "ms"); w.close(); if(++done===3) process.exit(0); });
  w.on("error", (e) => { console.log("   " + name + " WS: FAIL"); if(++done===3) process.exit(1); });
  setTimeout(() => { console.log("   " + name + " WS: TIMEOUT"); if(++done===3) process.exit(2); }, 5000);
}
'

echo ""
echo "===== DEPLOY COMPLETE ====="
