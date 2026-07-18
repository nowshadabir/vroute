import { Command } from 'commander';
import { spawn } from 'child_process';
import path from 'path';
import { readConfig, updateConfig } from '../state/config';
import sudo from 'sudo-prompt';

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

    // Resolve the path to the compiled daemon server
    const daemonPath = path.join(__dirname, '..', 'daemon', 'server.js');
    
    console.log('Starting vroute daemon...');
    
    // Spawn the daemon process in detached mode
    const child = spawn(process.execPath, [daemonPath], {
      detached: true,
      stdio: 'ignore' // We don't want to hold onto the child's stdio
    });

    child.unref(); // Allow the parent process to exit independently of the child
    
    console.log('Daemon started in background (PID will be written to config soon).');
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
  .description('Add a new local route (e.g., app.test 3000)')
  .action((domain, port) => {
    updateConfig(config => {
      config.routes[domain] = {
        port: parseInt(port, 10),
        ssl: true,
        cors: true
      };
    });
    console.log(`✅ Route added to config: ${domain} -> 127.0.0.1:${port}`);
    
    // Modify OS hosts file using sudo-prompt
    console.log('Requesting permission to modify OS hosts file...');
    const dnsScript = path.join(__dirname, '..', '..', 'bin', 'vroute-dns.js');
    sudo.exec(`node "${dnsScript}" add ${domain}`, { name: 'vroute' }, (error) => {
      if (error) {
        console.error('Failed to update hosts file:', error.message);
      } else {
        console.log(`✅ OS hosts file updated for ${domain}`);
      }
    });
  });

program
  .command('remove <domain>')
  .description('Remove a local route')
  .action((domain) => {
    updateConfig(config => {
      delete config.routes[domain];
    });
    console.log(`✅ Route removed from config: ${domain}`);
    
    console.log('Requesting permission to modify OS hosts file...');
    const dnsScript = path.join(__dirname, '..', '..', 'bin', 'vroute-dns.js');
    sudo.exec(`node "${dnsScript}" remove ${domain}`, { name: 'vroute' }, (error) => {
      if (error) {
        console.error('Failed to update hosts file:', error.message);
      } else {
        console.log(`✅ OS hosts file updated for ${domain}`);
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
      console.log(`  ${d} -> 127.0.0.1:${config.routes[d]}`);
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
