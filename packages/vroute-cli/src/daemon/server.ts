import express from 'express';
import { updateConfig, readConfig } from '../state/config';
import { proxyServer, proxyEvents } from './proxy';
import { httpsProxyServer } from './https';
import { Server } from 'socket.io';
import path from 'path';
import sudo from 'sudo-prompt';

const app = express();
const PORT = 9999;
const PROXY_PORT = 8080; // Using 8080 for testing without sudo
const HTTPS_PORT = 8443; // Using 8443 for testing without sudo

let io: Server;

// Serve static dashboard
const dashboardPath = path.join(__dirname, '..', '..', 'src', 'dashboard', 'dist');
app.use(express.static(dashboardPath));

app.use(express.json());

app.get('/api/status', (req, res) => {
  res.json({ status: 'running', pid: process.pid });
});

app.get('/api/config', (req, res) => {
  res.json(readConfig());
});

app.post('/api/routes', (req, res) => {
  const { domain, port, ssl, cors } = req.body;
  if (!domain || !port) {
    res.status(400).json({ error: 'Missing domain or port' });
    return;
  }

  updateConfig(config => {
    config.routes[domain] = { port: parseInt(port, 10), ssl: !!ssl, cors: !!cors };
  });

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
  
  updateConfig(config => {
    delete config.routes[domain];
  });

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

export function startDaemon() {
  const server = app.listen(PORT, () => {
    console.log(`vroute daemon API is running on port ${PORT}`);
    
    // Write PID to state
    updateConfig((config) => {
      config.daemonPid = process.pid;
    });
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

  proxyServer.listen(PROXY_PORT, '127.0.0.1', () => {
    console.log(`vroute proxy server listening on 127.0.0.1:${PROXY_PORT}`);
  });

  httpsProxyServer.listen(HTTPS_PORT, '127.0.0.1', () => {
    console.log(`vroute HTTPS proxy server listening on 127.0.0.1:${HTTPS_PORT}`);
  });

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('Shutting down vroute daemon...');
    
    httpsProxyServer.close(() => {
      console.log('HTTPS Proxy server closed');
    });

    proxyServer.close(() => {
      console.log('Proxy server closed');
    });

    server.close(() => {
      console.log('API server closed');
      updateConfig((config) => {
        delete config.daemonPid;
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
