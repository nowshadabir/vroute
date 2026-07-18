import { execSync } from 'child_process';
import os from 'os';

export function injectTrust(caCertPath: string) {
  const platform = os.platform();

  console.log(`Injecting Root CA into ${platform} trust store...`);

  try {
    if (platform === 'linux') {
      execSync('mkdir -p /usr/local/share/ca-certificates/');
      execSync(`cp "${caCertPath}" /usr/local/share/ca-certificates/vroute-ca.crt`);
      try {
        execSync('update-ca-certificates');
      } catch (e) {
        console.warn('update-ca-certificates not found or failed, but cert was copied.');
      }
      console.warn('\nNote: On Linux, Chrome and Firefox use their own certificate databases (NSS).');
      console.warn('You may need to manually import ~/.vroute/certs/ca.pem into your browser settings');
      console.warn('under Settings > Privacy and Security > Security > Manage Certificates > Authorities.\n');
    } else if (platform === 'darwin') {
      execSync(`security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${caCertPath}"`);
    } else if (platform === 'win32') {
      execSync(`certutil -addstore -f "ROOT" "${caCertPath}"`);
    } else {
      console.warn(`Unsupported platform for automatic trust injection: ${platform}`);
      return;
    }
    console.log('Successfully injected Root CA into OS trust store.');
  } catch (error: any) {
    console.error('Failed to inject trust:', error.message);
    process.exit(1);
  }
}
