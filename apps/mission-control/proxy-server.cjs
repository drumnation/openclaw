#!/usr/bin/env node
/**
 * Mission Control Proxy Server
 * 
 * Proxies requests to Gordon brother gateways with:
 * - Header stripping (removes x-frame-options, CSP that block iframes)
 * - WebSocket support
 * - No authentication required (runs behind Cloudflare Access)
 */

const http = require('http');
const httpProxy = require('http-proxy');
const url = require('url');

const PORT = 18803;

// Gateway targets
const GATEWAYS = {
  dawn: 'http://192.168.1.248:18791',
  day: 'http://127.0.0.1:18789',
  dusk: 'http://192.168.1.221:18790',
};

// Create proxy server
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
});

// Strip iframe-blocking headers
proxy.on('proxyRes', (proxyRes, req, res) => {
  delete proxyRes.headers['x-frame-options'];
  delete proxyRes.headers['content-security-policy'];
  // Allow same-origin framing
  proxyRes.headers['x-frame-options'] = 'SAMEORIGIN';
});

// Handle errors
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy error: ' + err.message);
  }
});

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const path = parsed.pathname;
  
  // Match /frame/{gateway}/...
  const match = path.match(/^\/frame\/(dawn|day|dusk)(\/.*)?$/);
  
  if (match) {
    const gateway = match[1];
    const targetPath = match[2] || '/';
    const target = GATEWAYS[gateway];
    
    if (target) {
      // Rewrite URL to remove /frame/{gateway} prefix
      req.url = targetPath + (parsed.search || '');
      
      console.log(`[${new Date().toISOString()}] ${gateway}: ${req.method} ${req.url}`);
      
      proxy.web(req, res, { target });
      return;
    }
  }
  
  // Not a proxy request - return 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found. Use /frame/dawn/, /frame/day/, or /frame/dusk/');
});

// Handle WebSocket upgrades
server.on('upgrade', (req, socket, head) => {
  const parsed = url.parse(req.url);
  const path = parsed.pathname;
  
  const match = path.match(/^\/frame\/(dawn|day|dusk)(\/.*)?$/);
  
  if (match) {
    const gateway = match[1];
    const targetPath = match[2] || '/';
    const target = GATEWAYS[gateway];
    
    if (target) {
      req.url = targetPath + (parsed.search || '');
      console.log(`[${new Date().toISOString()}] WS ${gateway}: ${req.url}`);
      proxy.ws(req, socket, head, { target });
      return;
    }
  }
  
  socket.destroy();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mission Control Proxy running on http://0.0.0.0:${PORT}`);
  console.log('Routes:');
  Object.entries(GATEWAYS).forEach(([name, target]) => {
    console.log(`  /frame/${name}/ -> ${target}`);
  });
});
