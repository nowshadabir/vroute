import https from 'https';
import tls from 'tls';
import { generateDomainCert } from '../ssl/certs';
import { proxyServer } from './proxy';

const secureContexts = new Map<string, tls.SecureContext>();

function getSecureContext(domain: string): tls.SecureContext {
  if (secureContexts.has(domain)) {
    return secureContexts.get(domain)!;
  }

  // Generate or load cert for this domain
  const { key, cert } = generateDomainCert(domain);
  
  const ctx = tls.createSecureContext({
    key,
    cert
  });

  secureContexts.set(domain, ctx);
  return ctx;
}

export const httpsProxyServer = https.createServer({
  SNICallback: (servername, cb) => {
    try {
      const { readConfig } = require('../state/config');
      const config = readConfig();
      const routeConfig = config.routes[servername];

      if (routeConfig && routeConfig.ssl === false) {
        // Explicitly disabled SSL for this route
        cb(new Error(`SSL is disabled for ${servername}`));
        return;
      }

      const ctx = getSecureContext(servername);
      cb(null, ctx);
    } catch (err) {
      console.error(`Failed to generate/load cert for ${servername}:`, err);
      cb(err as Error);
    }
  }
}, (req, res) => {
  // We forward the request to the same proxy engine we built in Phase 2
  // But we need to make sure we pass it to the proxy request handler
  // Wait, proxyServer is an http.Server, but it uses the http-proxy instance inside.
  // We should extract the request handler from proxyServer or just use the same logic.
  // Actually, proxyServer from proxy.ts is just a standard request listener.
  // Let's import the request listener directly or let proxyServer handle it.
  
  // To keep it simple, we just emit the 'request' event on proxyServer
  proxyServer.emit('request', req, res);
});

httpsProxyServer.on('upgrade', (req, socket, head) => {
  proxyServer.emit('upgrade', req, socket, head);
});
