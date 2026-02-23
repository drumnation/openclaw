#!/usr/bin/env node
/**
 * Mission Control Combined Server
 * 
 * Serves static files AND proxies to Gordon brother gateways with:
 * - Header stripping (removes x-frame-options, CSP that block iframes)
 * - WebSocket support
 * - Runs behind Cloudflare Access
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const httpProxy = require('http-proxy');
const url = require('url');

const PORT = process.env.PORT || 18800;
const STATIC_DIR = path.join(__dirname, 'dist');

// Gateway targets
const GATEWAYS = {
  dawn: 'http://192.168.1.248:18791',
  day: 'http://127.0.0.1:18789',
  dusk: 'http://192.168.1.234:18790',
};

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Create proxy
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
});

// Strip iframe-blocking headers from proxy responses
proxy.on('proxyRes', (proxyRes, req, res) => {
  delete proxyRes.headers['x-frame-options'];
  delete proxyRes.headers['content-security-policy'];
  proxyRes.headers['x-frame-options'] = 'SAMEORIGIN';
});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy error: ' + err.message);
  }
});

// Serve static file
function serveStatic(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// Create server
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;
  
  // Proxy requests to /frame/{gateway}/...
  const proxyMatch = pathname.match(/^\/frame\/(dawn|day|dusk)(\/.*)?$/);
  if (proxyMatch) {
    const gateway = proxyMatch[1];
    const targetPath = proxyMatch[2] || '/';
    const target = GATEWAYS[gateway];
    
    req.url = targetPath + (parsed.search || '');
    console.log(`[PROXY] ${gateway}: ${req.method} ${req.url}`);
    proxy.web(req, res, { target });
    return;
  }
  
  // Serve static files
  let filePath = path.join(STATIC_DIR, pathname);
  
  // Default to index.html for root or if directory
  if (pathname === '/' || pathname.endsWith('/')) {
    filePath = path.join(STATIC_DIR, pathname, 'index.html');
  }
  
  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Try index.html for SPA routing
      filePath = path.join(STATIC_DIR, 'index.html');
    }
    console.log(`[STATIC] ${pathname} -> ${filePath}`);
    serveStatic(req, res, filePath);
  });
});

// Handle WebSocket upgrades
server.on('upgrade', (req, socket, head) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;
  
  const match = pathname.match(/^\/frame\/(dawn|day|dusk)(\/.*)?$/);
  if (match) {
    const gateway = match[1];
    const targetPath = match[2] || '/';
    const target = GATEWAYS[gateway];
    
    req.url = targetPath + (parsed.search || '');
    console.log(`[WS] ${gateway}: ${req.url}`);
    proxy.ws(req, socket, head, { target });
    return;
  }
  
  socket.destroy();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nMission Control Server running on http://0.0.0.0:${PORT}`);
  console.log(`Static files from: ${STATIC_DIR}`);
  console.log('\nProxy routes:');
  Object.entries(GATEWAYS).forEach(([name, target]) => {
    console.log(`  /frame/${name}/ -> ${target}`);
  });
  console.log('');
});
