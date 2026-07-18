import { injectTrust } from './trust';

const action = process.argv[2];
const caCertPath = process.argv[3];

if (action === 'inject' && caCertPath) {
  injectTrust(caCertPath);
} else {
  console.error('Unknown action or no action specified.');
  process.exit(1);
}
