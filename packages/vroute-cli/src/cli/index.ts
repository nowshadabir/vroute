import { Command } from 'commander';
import { spawn, exec } from 'child_process';
import path from 'path';
import { readConfig, updateConfig } from '../state/config';
import sudo from 'sudo-prompt';
import fs from 'fs';

function spawnDaemon() {
  let daemonPath = path.join(__dirname, '..', 'daemon', 'server.js');
  let execCmd = process.execPath;
  let execArgs = [daemonPath];

  if (!fs.existsSync(daemonPath)) {
    const tsPath = path.join(__dirname, '..', 'daemon', 'server.ts');
    if (fs.existsSync(tsPath)) {
      daemonPath = tsPath;
      execCmd = 'npx';
      execArgs = ['tsx', tsPath];
    }
  }

  return spawn(execCmd, execArgs, {
    detached: true,
    stdio: 'ignore'
  });
}

const program = new Command();

program
  .name('vroute')
  .description('Zero-Config Local DNS & SSL Router')
  .version('1.0.0');

function isDaemonRunning(pid?: number): boolean {
  if (!pid) return false;
  try {
    // Sending signal 0 checks for existence without killing the process
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

program
  .command('start')
  .description('Start the background daemon')
  .action(() => {
    const config = readConfig();
    if (isDaemonRunning(config.daemonPid)) {
      console.log('Daemon is already running with PID:', config.daemonPid);
      return;
    }

    console.log('Starting vroute daemon...');

    // Spawn the daemon process in detached mode
    const child = spawnDaemon();

    // Write PID immediately so stop/status work even if daemon hasn't started yet
    updateConfig((c) => { c.daemonPid = child.pid!; });

    child.unref();

    console.log(`Daemon started (PID: ${child.pid})`);
  });

program
  .command('stop')
  .description('Stop the background daemon')
  .action(() => {
    const config = readConfig();
    if (isDaemonRunning(config.daemonPid)) {
      console.log(`Stopping daemon (PID: ${config.daemonPid})...`);
      try {
        process.kill(config.daemonPid as number, 'SIGTERM');
        console.log('Daemon stopped.');
        
        // Clean up config PID just in case the daemon didn't catch SIGTERM
        updateConfig(c => { delete c.daemonPid; });
      } catch (err: any) {
        console.error('Failed to stop daemon:', err.message);
      }
    } else {
      console.log('Daemon is not currently running.');
      // Clean up config if it was stale
      updateConfig(c => { delete c.daemonPid; });
    }
  });

program
  .command('add <domain> <port>')
  .description('Add a new local route (e.g., app.test 3000 or *.app.localhost 3000)')
  .action((domain, port) => {
    const isWildcard = domain.startsWith('*.');

    updateConfig(config => {
      config.routes[domain] = {
        port: parseInt(port, 10),
        ssl: true,
        cors: true,
        wildcard: isWildcard,
      };
    });

    if (isWildcard) {
      console.log(`Wildcard route added: ${domain} -> 127.0.0.1:${port}`);
      console.log('Subdomains will be resolved automatically (no hosts file entry needed).');
      return;
    }

    console.log(`Route added: ${domain} -> 127.0.0.1:${port}`);
    console.log('Requesting permission to modify OS hosts file...');
    const dnsScript = path.join(__dirname, '..', '..', 'bin', 'vroute-dns.js');
    sudo.exec(`node "${dnsScript}" add ${domain}`, { name: 'vroute' }, (error) => {
      if (error) {
        console.error('Failed to update hosts file:', error.message);
      } else {
        console.log(`OS hosts file updated for ${domain}`);
      }
    });
  });

program
  .command('remove <domain>')
  .description('Remove a local route')
  .action((domain) => {
    const config = readConfig();
    const routeConfig = config.routes[domain];

    updateConfig(config => {
      delete config.routes[domain];
    });

    console.log(`Route removed: ${domain}`);

    // Wildcard routes don't have hosts file entries
    if (routeConfig?.wildcard) {
      return;
    }

    console.log('Requesting permission to modify OS hosts file...');
    const dnsScript = path.join(__dirname, '..', '..', 'bin', 'vroute-dns.js');
    sudo.exec(`node "${dnsScript}" remove ${domain}`, { name: 'vroute' }, (error) => {
      if (error) {
        console.error('Failed to update hosts file:', error.message);
      } else {
        console.log(`OS hosts file updated for ${domain}`);
      }
    });
  });

program
  .command('list')
  .description('List all active routes')
  .action(() => {
    const config = readConfig();
    const domains = Object.keys(config.routes);
    if (domains.length === 0) {
      console.log('No routes mapped.');
      return;
    }
    console.log('Active Routes:');
    domains.forEach(d => {
      const route = config.routes[d]!;
      const wildcard = route.wildcard ? ' [wildcard]' : '';
      console.log(`  ${d} -> 127.0.0.1:${route.port}${wildcard}`);
    });
  });

program
  .command('status')
  .description('Check if the daemon is running')
  .action(() => {
    const config = readConfig();
    if (isDaemonRunning(config.daemonPid)) {
      console.log(`✅ Daemon is running (PID: ${config.daemonPid})`);
    } else {
      console.log('❌ Daemon is not running.');
    }
  });

program
  .command('ui')
  .description('Open the dashboard in your browser')
  .action(() => {
    const config = readConfig();
    if (!isDaemonRunning(config.daemonPid)) {
      console.log('⚠️  Daemon is not running. Starting it now...');
      const child = spawnDaemon();
      child.unref();
      // Wait for daemon to start before opening browser
      setTimeout(() => openBrowser(), 2000);
    } else {
      openBrowser();
    }
  });

function openBrowser() {
  const url = 'http://localhost:9999';
  console.log(`Opening ${url}...`);
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${cmd} ${url}`, (error) => {
    if (error) {
      console.log(`Could not open browser automatically. Visit ${url} manually.`);
    }
  });
}

program
  .command('setup')
  .description('Generate local Root CA and inject into OS trust store')
  .action(() => {
    // Import dynamically so forge is only loaded when needed
    const { setupCA, CA_CERT_PATH } = require('../ssl/certs');
    setupCA();

    console.log('Requesting permission to inject Root CA into OS trust store...');
    const sslScript = path.join(__dirname, '..', '..', 'bin', 'vroute-ssl.js');
    sudo.exec(`node "${sslScript}" inject "${CA_CERT_PATH}"`, { name: 'vroute SSL Setup' }, (error) => {
      if (error) {
        console.error('Failed to inject trust:', error.message);
      } else {
        console.log('✅ OS trust store updated successfully.');
      }
    });
  });

program.parse(process.argv);
