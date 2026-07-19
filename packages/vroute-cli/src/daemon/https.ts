import https from 'https';
import tls from 'tls';
import { generateDomainCert } from '../ssl/certs';
import { proxy, proxyServer, resolveRoute } from './proxy';
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
  const hostHeader = req.headers.host;
  if (!hostHeader) {
    socket.destroy();
    return;
  }

  const host = hostHeader.split(':')[0]!;
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
