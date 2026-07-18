import { addHost, removeHost } from './hosts';

const action = process.argv[2];
const domain = process.argv[3];

if (!action || !domain) {
  console.error('Usage: node worker.js <add|remove> <domain>');
  process.exit(1);
}

try {
  if (action === 'add') {
    addHost(domain);
  } else if (action === 'remove') {
    removeHost(domain);
  } else {
    console.error(`Unknown action: ${action}`);
    process.exit(1);
  }
} catch (error: any) {
  console.error(`Failed to execute ${action} on hosts file: ${error.message}`);
  process.exit(1);
}
