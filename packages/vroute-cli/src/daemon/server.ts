import express from 'express';
import { updateConfig, readConfig } from '../state/config';
import { proxyServer, proxyEvents } from './proxy';
import { httpsProxyServer } from './https';
import { startDnsServer } from '../dns/server';
import { Server } from 'socket.io';
import path from 'path';
import sudo from 'sudo-prompt';
import { execSync } from 'child_process';

const app = express();
const PORT = 9999;
let PROXY_PORT = 80;
let HTTPS_PORT = 443;

let io: Server;

// Serve static dashboard - resolve from package root
const packageRoot = path.resolve(__dirname, '..', '..');
const dashboardPath = path.join(packageRoot, 'src', 'dashboard', 'dist');
app.use(express.static(dashboardPath));


app.use(express.json());

app.get('/api/status', (req, res) => {
  res.json({ status: 'running', pid: process.pid });
});

app.get('/api/config', (req, res) => {
  res.json(readConfig());
});

app.get('/api/ports', (req, res) => {
  try {
    const cmd = '/usr/bin/ss -tlnp 2>/dev/null || /usr/sbin/ss -tlnp 2>/dev/null || /bin/ss -tlnp 2>/dev/null || ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null';
    const output = execSync(cmd, { encoding: 'utf-8' });
    const lines = output.split('\n').slice(1); // skip header
    const ports = lines
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split(/\s+/);
        const localAddr = parts[3] || '';
        const portMatch = localAddr.match(/:(\d+)$/);
        const port = portMatch ? parseInt(portMatch[1]!, 10) : 0;
        const processInfo = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
        const processName = processInfo ? processInfo[1]! : '';
        const pid = processInfo ? parseInt(processInfo[2]!, 10) : 0;
        return { port, process: processName, pid, address: localAddr };
      })
      .filter(p => p.port > 0)
      .sort((a, b) => a.port - b.port);
    res.json({ ports });
  } catch (err: any) {
    res.json({ ports: [], error: err.message });
  }
});

app.post('/api/routes', (req, res) => {
  const { domain, port, ssl, cors, wildcard, tenantHeader } = req.body;
  if (!domain || !port) {
    res.status(400).json({ error: 'Missing domain or port' });
    return;
  }

  const isWildcard = !!wildcard || domain.startsWith('*.');

  updateConfig(config => {
    config.routes[domain] = {
      port: parseInt(port, 10),
      ssl: !!ssl,
      cors: !!cors,
      wildcard: isWildcard,
      tenantHeader: tenantHeader || undefined,
    };
  });

  // Wildcard routes don't need hosts file entries (resolved via DNS or .localhost)
  if (isWildcard) {
    const newConfig = readConfig();
    io?.emit('config', newConfig);
    res.json({ success: true, config: newConfig });
    return;
  }

  const dnsScript = path.join(__dirname, '..', '..', 'bin', 'vroute-dns.js');
  sudo.exec(`node "${dnsScript}" add ${domain}`, { name: 'vroute' }, (error) => {
    if (error) {
      console.error('Failed to update hosts file:', error.message);
      res.status(500).json({ error: error.message });
    } else {
      const newConfig = readConfig();
      io?.emit('config', newConfig);
      res.json({ success: true, config: newConfig });
    }
  });
});

app.delete('/api/routes/:domain', (req, res) => {
  const domain = req.params.domain;
  const config = readConfig();
  const routeConfig = config.routes[domain];

  updateConfig(config => {
    delete config.routes[domain];
  });

  // Wildcard routes don't have hosts file entries
  if (routeConfig?.wildcard) {
    const newConfig = readConfig();
    io?.emit('config', newConfig);
    res.json({ success: true, config: newConfig });
    return;
  }

  const dnsScript = path.join(__dirname, '..', '..', 'bin', 'vroute-dns.js');
  sudo.exec(`node "${dnsScript}" remove ${domain}`, { name: 'vroute' }, (error) => {
    if (error) {
      console.error('Failed to update hosts file:', error.message);
      res.status(500).json({ error: error.message });
    } else {
      const newConfig = readConfig();
      io?.emit('config', newConfig);
      res.json({ success: true, config: newConfig });
    }
  });
});

app.post('/api/shield', (req, res) => {
  const { enabled, rules } = req.body;
  
  updateConfig(config => {
    if (enabled !== undefined) config.shieldEnabled = !!enabled;
    if (Array.isArray(rules)) config.shieldRules = rules;
  });

  const newConfig = readConfig();
  io?.emit('config', newConfig);
  res.json({ success: true, config: newConfig });
});

app.post('/api/routes/:domain/chaos', (req, res) => {
  const domain = req.params.domain;
  const { enabled, rules } = req.body;

  updateConfig(config => {
    if (!config.routes[domain]) return;
    if (enabled !== undefined) config.routes[domain].chaosEnabled = !!enabled;
    if (Array.isArray(rules)) config.routes[domain].chaosRules = rules;
  });

  const newConfig = readConfig();
  io?.emit('config', newConfig);
  res.json({ success: true, config: newConfig });
});

// Fallback: serve index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(dashboardPath, 'index.html'));
});

export function startDaemon() {
  const server = app.listen(PORT, () => {
    console.log(`vroute daemon API is running on port ${PORT}`);

    // Write PID to state
    updateConfig((config) => {
      config.daemonPid = process.pid;
    });
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ vroute daemon API Error: Port ${PORT} is already in use.`);
      process.exit(1);
    } else {
      console.error(`❌ vroute daemon API Error:`, err.message);
      process.exit(1);
    }
  });

  // Attach WebSocket Server
  io = new Server(server, {
    cors: { origin: '*' }
  });

  io.on('connection', (socket) => {
    console.log('Dashboard connected');
    socket.emit('config', readConfig());
  });

  proxyEvents.on('request-log', (log) => {
    io.emit('request-log', log);
  });

  // Try standard ports (80/443), fall back to alt ports (8080/8443)
  let httpFallbackDone = false;
  proxyServer.on('error', (err: any) => {
    if (err.code === 'EACCES' || err.code === 'EADDRINUSE') {
      if (!httpFallbackDone) {
        httpFallbackDone = true;
        PROXY_PORT = 8080;
        console.log(`Port 80 unavailable, falling back to port ${PROXY_PORT}`);
        proxyServer.listen(PROXY_PORT, '127.0.0.1', () => {
          console.log(`vroute proxy server listening on 127.0.0.1:${PROXY_PORT}`);
        });
      } else {
        console.error(`❌ Proxy Server Error: Cannot bind to port ${PROXY_PORT}.`);
        process.exit(1);
      }
    } else {
      console.error(`❌ Proxy Server Error:`, err.message);
    }
  });

  let httpsFallbackDone = false;
  httpsProxyServer.on('error', (err: any) => {
    if (err.code === 'EACCES' || err.code === 'EADDRINUSE') {
      if (!httpsFallbackDone) {
        httpsFallbackDone = true;
        HTTPS_PORT = 8443;
        console.log(`Port 443 unavailable, falling back to port ${HTTPS_PORT}`);
        httpsProxyServer.listen(HTTPS_PORT, '127.0.0.1', () => {
          console.log(`vroute HTTPS proxy server listening on 127.0.0.1:${HTTPS_PORT}`);
        });
      } else {
        console.error(`❌ HTTPS Proxy Server Error: Cannot bind to port ${HTTPS_PORT}.`);
        process.exit(1);
      }
    } else {
      console.error(`❌ HTTPS Proxy Server Error:`, err.message);
    }
  });

  proxyServer.listen(PROXY_PORT, '127.0.0.1', () => {
    console.log(`vroute proxy server listening on 127.0.0.1:${PROXY_PORT}`);
  });

  httpsProxyServer.listen(HTTPS_PORT, '127.0.0.1', () => {
    console.log(`vroute HTTPS proxy server listening on 127.0.0.1:${HTTPS_PORT}`);
  });

  const dnsServer = startDnsServer();

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('Shutting down vroute daemon...');
    
    httpsProxyServer.close(() => {
      console.log('HTTPS Proxy server closed');
    });

    proxyServer.close(() => {
      console.log('Proxy server closed');
    });

    try {
      dnsServer.close();
      console.log('DNS server closed');
    } catch (e) {
      console.log('DNS server was not running');
    }

    server.close(() => {
      console.log('API server closed');
      updateConfig((config) => {
        if (config.daemonPid === process.pid) {
          delete config.daemonPid;
        }
      });
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// If this file is executed directly (which it will be by the detached process)
if (require.main === module) {
  startDaemon();
}
