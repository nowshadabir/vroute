import http from 'http';
import httpProxy from 'http-proxy';
import { readConfig } from '../state/config';
import { EventEmitter } from 'events';

export const proxyEvents = new EventEmitter();

// Create a proxy server with custom application logic
const proxy = httpProxy.createProxyServer({
  ws: true, // Support WebSockets
  xfwd: true,
});

proxy.on('proxyReq', (proxyReq, req, res, options) => {
  // Store start time on the request object for duration calculation
  (req as any)._startTime = Date.now();
});

// Module 2C: Middleware Injector (CORS Bypass)
proxy.on('proxyRes', function (proxyRes, req, res) {
  const hostHeader = req.headers.host;
  const host = hostHeader ? (hostHeader as string).split(':')[0] : '';
  const config = readConfig();
  const routeConfig = host ? config.routes[host] : undefined;

  if (routeConfig && routeConfig.cors) {
    // Inject CORS headers to bypass local restrictions
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  }

  // Calculate duration
  const duration = Date.now() - ((req as any)._startTime || Date.now());

  proxyEvents.emit('request-log', {
    method: req.method,
    url: req.url,
    host: req.headers.host,
    status: proxyRes.statusCode,
    duration,
    timestamp: new Date().toISOString()
  });
});

// Handle proxy errors gracefully
proxy.on('error', function (err, req, res) {
  console.error('Proxy Error:', err.message);
  if ('writeHead' in res && !(res as any).headersSent) {
    (res as any).writeHead(502, { 'Content-Type': 'text/plain' });
    (res as any).end('vroute: Bad Gateway. The local server might be down.');
  }

  const duration = Date.now() - ((req as any)._startTime || Date.now());
  proxyEvents.emit('request-log', {
    method: req.method,
    url: req.url,
    host: req.headers.host,
    status: 502,
    duration,
    error: err.message,
    timestamp: new Date().toISOString()
  });
});

// Module 2B: Dynamic Routing
export const proxyServer = http.createServer((req, res) => {
  const hostHeader = req.headers.host;
  
  if (!hostHeader) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: Missing Host header');
    return;
  }

  // Extract domain without port if any
  const host = hostHeader.split(':')[0] as string;
  const config = readConfig();
  
  const routeConfig = config.routes[host];

  if (routeConfig && routeConfig.port) {
    // We found a route mapping! Proxy the request.
    const target = `http://127.0.0.1:${routeConfig.port}`;
    proxy.web(req, res, { target });
  } else {
    // No route found for this domain
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`vroute: 404 Not Found. No route mapping found for ${host}`);
  }
});

// Handle WebSocket upgrade
proxyServer.on('upgrade', (req, socket, head) => {
  const hostHeader = req.headers.host;
  if (!hostHeader) {
    socket.destroy();
    return;
  }

  const host = hostHeader.split(':')[0] as string;
  const config = readConfig();
  const routeConfig = config.routes[host];

  if (routeConfig && routeConfig.port) {
    const target = `http://127.0.0.1:${routeConfig.port}`;
    proxy.ws(req, socket, head, { target });
  } else {
    socket.destroy();
  }
});
