import forge from 'node-forge';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const CERTS_DIR = path.join(os.homedir(), '.vroute', 'certs');
export const CA_KEY_PATH = path.join(CERTS_DIR, 'ca.key');
export const CA_CERT_PATH = path.join(CERTS_DIR, 'ca.pem');

export function ensureCertsDir() {
  if (!fs.existsSync(CERTS_DIR)) {
    fs.mkdirSync(CERTS_DIR, { recursive: true });
  }
}

export function setupCA() {
  ensureCertsDir();

  if (fs.existsSync(CA_KEY_PATH) && fs.existsSync(CA_CERT_PATH)) {
    return; // CA already exists
  }

  console.log('Generating vroute Root CA (this may take a moment)...');

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(16));
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

  const attrs = [
    { name: 'commonName', value: 'vroute Local Root CA' },
    { name: 'organizationName', value: 'vroute' }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true, critical: true }
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  const pemCert = forge.pki.certificateToPem(cert);
  const pemKey = forge.pki.privateKeyToPem(keys.privateKey);

  fs.writeFileSync(CA_CERT_PATH, pemCert);
  fs.writeFileSync(CA_KEY_PATH, pemKey);
  
  console.log('Root CA generated successfully.');
}

export function generateDomainCert(domain: string): { key: string, cert: string } {
  ensureCertsDir();
  
  const domainKeyPath = path.join(CERTS_DIR, `${domain}.key`);
  const domainCertPath = path.join(CERTS_DIR, `${domain}.pem`);

  if (fs.existsSync(domainKeyPath) && fs.existsSync(domainCertPath)) {
    return {
      key: fs.readFileSync(domainKeyPath, 'utf-8'),
      cert: fs.readFileSync(domainCertPath, 'utf-8')
    };
  }

  // Load CA
  const caCertPem = fs.readFileSync(CA_CERT_PATH, 'utf-8');
  const caKeyPem = fs.readFileSync(CA_KEY_PATH, 'utf-8');
  const caCert = forge.pki.certificateFromPem(caCertPem);
  const caKey = forge.pki.privateKeyFromPem(caKeyPem);

  // Generate Domain Cert
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  
  cert.publicKey = keys.publicKey;
  // Modern browsers require a long, random serial number (usually 64+ bits).
  cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(16));
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  cert.setSubject([{ name: 'commonName', value: domain }]);
  cert.setIssuer(caCert.subject.attributes);

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: domain }] }
  ]);

  cert.sign(caKey, forge.md.sha256.create());

  const pemCert = forge.pki.certificateToPem(cert);
  const pemKey = forge.pki.privateKeyToPem(keys.privateKey);

  fs.writeFileSync(domainCertPath, pemCert);
  fs.writeFileSync(domainKeyPath, pemKey);

  return { key: pemKey, cert: pemCert };
}
