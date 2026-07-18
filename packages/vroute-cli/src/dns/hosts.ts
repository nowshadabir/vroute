import fs from 'fs';
import os from 'os';
import path from 'path';

// Define sudo-prompt type since @types/sudo-prompt doesn't exist
declare module 'sudo-prompt' {
  export function exec(cmd: string, options: { name: string }, callback: (error?: Error, stdout?: string | Buffer, stderr?: string | Buffer) => void): void;
}

const IS_WINDOWS = os.platform() === 'win32';
export const HOSTS_PATH = IS_WINDOWS
  ? path.join(process.env.windir || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts')
  : '/etc/hosts';

const VROUTE_COMMENT = '# vroute managed';

export function addHost(domain: string, ip: string = '127.0.0.1'): void {
  const content = fs.readFileSync(HOSTS_PATH, 'utf-8');
  const lines = content.split('\n');
  
  // Check if it already exists
  const exists = lines.some(line => line.includes(domain) && line.includes(VROUTE_COMMENT));
  if (exists) {
    return;
  }

  // Remove any conflicting unmanaged entries for this domain just in case? 
  // No, better to just append.
  const newEntry = `${ip}\t${domain} ${VROUTE_COMMENT}`;
  fs.appendFileSync(HOSTS_PATH, `\n${newEntry}\n`);
  console.log(`Successfully added ${domain} to hosts file.`);
}

export function removeHost(domain: string): void {
  const content = fs.readFileSync(HOSTS_PATH, 'utf-8');
  const lines = content.split('\n');
  
  const filteredLines = lines.filter(line => {
    // Keep the line if it doesn't contain the domain OR it's not managed by vroute
    const isTargetDomain = line.includes(domain);
    const isManaged = line.includes(VROUTE_COMMENT);
    return !(isTargetDomain && isManaged);
  });

  if (lines.length !== filteredLines.length) {
    fs.writeFileSync(HOSTS_PATH, filteredLines.join('\n'));
    console.log(`Successfully removed ${domain} from hosts file.`);
  }
}
