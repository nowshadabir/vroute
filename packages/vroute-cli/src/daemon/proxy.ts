import http from 'http';
import httpProxy from 'http-proxy';
import { readConfig, type RouteConfig } from '../state/config';
import { EventEmitter } from 'events';

export const proxyEvents = new EventEmitter();

export interface ResolvedRoute {
  config: RouteConfig;
  subdomain?: string;
}

/**
 * Resolves a host to a route config.
 * Priority: exact match > wildcard match.
 */
export function resolveRoute(host: string, routes: Record<string, RouteConfig>): ResolvedRoute | undefined {
  // 1. Exact match
  if (routes[host]) {
    return { config: routes[host] };
  }

  // 2. Wildcard match
  for (const [pattern, routeConfig] of Object.entries(routes)) {
    if (!routeConfig.wildcard) continue;

    // Extract base from wildcard pattern: "*.app.localhost" → "app.localhost"
    const base = pattern.replace(/^\*\./, '');

    // Check if host is a subdomain of the base
    if (host === base || host.endsWith('.' + base)) {
      const subdomain = host === base ? '' : host.slice(0, host.length - base.length - 1);
      return { config: routeConfig, subdomain };
    }
  }

  return undefined;
}

// Create a proxy server with custom application logic
const proxy = httpProxy.createProxyServer({
  ws: true,
  xfwd: true,
});

proxy.on('proxyReq', (proxyReq, req, res, options) => {
  (req as any)._startTime = Date.now();
});

// CORS + Tenant Header Injection
proxy.on('proxyRes', function (proxyRes, req, res) {
  const hostHeader = req.headers.host;
  const host = hostHeader ? (hostHeader as string).split(':')[0] : '';
  const config = readConfig();
  const resolved = host ? resolveRoute(host, config.routes) : undefined;

  if (resolved) {
    // CORS bypass
    if (resolved.config.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    }

    // Tenant header injection for wildcard routes
    if (resolved.config.wildcard && resolved.subdomain !== undefined) {
      const headerKey = resolved.config.tenantHeader || 'X-Vroute-Tenant';
      res.setHeader(headerKey, resolved.subdomain);
    }
  }

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

// HTTP Proxy Server
export const proxyServer = http.createServer((req, res) => {
  const hostHeader = req.headers.host;

  if (!hostHeader) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: Missing Host header');
    return;
  }

  const host = hostHeader.split(':')[0] as string;
  const config = readConfig();
  const resolved = resolveRoute(host, config.routes);

  if (resolved && resolved.config.port) {
    const target = `http://127.0.0.1:${resolved.config.port}`;
    proxy.web(req, res, { target });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`vroute: 404 Not Found. No route mapping found for ${host}`);
  }
});

// WebSocket upgrade
proxyServer.on('upgrade', (req, socket, head) => {
  const hostHeader = req.headers.host;
  if (!hostHeader) {
    socket.destroy();
    return;
  }

  const host = hostHeader.split(':')[0] as string;
  const config = readConfig();
  const resolved = resolveRoute(host, config.routes);

  if (resolved && resolved.config.port) {
    const target = `http://127.0.0.1:${resolved.config.port}`;
    proxy.ws(req, socket, head, { target });
  } else {
    socket.destroy();
  }
});
