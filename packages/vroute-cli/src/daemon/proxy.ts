import http from 'http';
import httpProxy from 'http-proxy';
import { readConfig, type RouteConfig, type VRouteConfig } from '../state/config';
import { EventEmitter } from 'events';

export const proxyEvents = new EventEmitter();

// Helper to determine if a domain/path matches a glob pattern like "*.google.com" or "/api/v1/*"
function matchesPattern(str: string, pattern: string): boolean {
  if (!pattern) return false;
  if (pattern === '*') return true;
  
  // Convert basic wildcard pattern to regex
  const regexStr = '^' + pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape special characters
    .replace(/\*/g, '.*') + '$';            // replace * with .*
    
  return new RegExp(regexStr).test(str);
}

export function isShielded(host: string, path: string, config: VRouteConfig): boolean {
  if (!config.shieldEnabled || !config.shieldRules) return false;
  
  for (const rule of config.shieldRules) {
    if (matchesPattern(host, rule) || matchesPattern(path, rule)) {
      return true;
    }
  }
  return false;
}

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
export const proxy = httpProxy.createProxyServer({
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
  } else if ('destroy' in res) {
    (res as any).destroy();
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
export const proxyServer = http.createServer(async (req, res) => {
  const hostHeader = req.headers.host;

  if (!hostHeader) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request: Missing Host header');
    return;
  }

  const host = hostHeader.split(':')[0] as string;
  const path = req.url || '/';
  const method = req.method || 'GET';
  const config = readConfig();
  
  // 1. Shield Intercept
  if (isShielded(host, path, config)) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    res.end(JSON.stringify({ status: 'shielded', message: 'Intercepted by vroute shield' }));
    
    proxyEvents.emit('request-log', {
      method,
      url: path,
      host: hostHeader,
      status: 200,
      duration: 0,
      timestamp: new Date().toISOString(),
      shielded: true
    });
    return;
  }

  const resolved = resolveRoute(host, config.routes);

  if (resolved && resolved.config.port) {
    // 2. Chaos Intercept
    if (resolved.config.chaosEnabled && resolved.config.chaosRules) {
      for (const rule of resolved.config.chaosRules) {
        if ((rule.method === '*' || rule.method === method) && matchesPattern(path, rule.path)) {
          // Apply Latency
          if (rule.latency > 0) {
            await new Promise(r => setTimeout(r, rule.latency));
          }
          
          // Apply Failure
          if (rule.failureRate > 0 && Math.random() * 100 < rule.failureRate) {
            res.writeHead(rule.errorStatus || 500, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': resolved.config.cors ? '*' : ''
            });
            res.end(JSON.stringify({ error: 'Chaos Monkey injected fault' }));
            
            proxyEvents.emit('request-log', {
              method,
              url: path,
              host: hostHeader,
              status: rule.errorStatus || 500,
              duration: rule.latency || 0,
              timestamp: new Date().toISOString(),
              chaosTriggered: true
            });
            return; // Terminate request
          }
        }
      }
    }

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
    delete req.headers.origin; // Bypass strict origin checks for WebSockets (e.g. Next.js HMR)
    proxy.ws(req, socket, head, { target });
  } else {
    socket.destroy();
  }
});
