import https from 'https';
import tls from 'tls';
import { generateDomainCert } from '../ssl/certs';
import { proxyServer, resolveRoute } from './proxy';
import { readConfig } from '../state/config';

const secureContexts = new Map<string, tls.SecureContext>();

function getSecureContext(domain: string): tls.SecureContext {
  if (secureContexts.has(domain)) {
    return secureContexts.get(domain)!;
  }

  const { key, cert } = generateDomainCert(domain);

  const ctx = tls.createSecureContext({ key, cert });
  secureContexts.set(domain, ctx);
  return ctx;
}

export const httpsProxyServer = https.createServer({
  SNICallback: (servername, cb) => {
    try {
      const config = readConfig();
      const resolved = resolveRoute(servername, config.routes);

      if (resolved && resolved.config.ssl === false) {
        cb(new Error(`SSL is disabled for ${servername}`));
        return;
      }

      // Use the wildcard pattern as cert key if it's a wildcard match
      const certKey = resolved?.subdomain !== undefined && resolved.subdomain !== ''
        ? Object.entries(config.routes).find(([, r]) => r.wildcard)?.[0] || servername
        : servername;

      const ctx = getSecureContext(certKey);
      cb(null, ctx);
    } catch (err) {
      console.error(`Failed to generate/load cert for ${servername}:`, err);
      cb(err as Error);
    }
  }
}, (req, res) => {
  proxyServer.emit('request', req, res);
});

httpsProxyServer.on('upgrade', (req, socket, head) => {
  proxyServer.emit('upgrade', req, socket, head);
});
