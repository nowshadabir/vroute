import dns2 from 'dns2';
import { readConfig } from '../state/config';
import { resolveRoute, isShielded } from '../daemon/proxy';

const { Packet } = dns2;

// Create a client to forward unresolved queries (e.g. to Google DNS)
const forwardClient = dns2.UDPClient({ dns: '8.8.8.8' });

export function startDnsServer() {
  const server = dns2.createServer({
    udp: true,
    handle: async (request, send, rinfo) => {
      const response = Packet.createResponseFromRequest(request);
      const [question] = request.questions;
      
      if (!question) {
        return send(response);
      }
      
      const { name, type } = question;
      
      // Only process A (IPv4) queries for wildcard routes or shielded domains
      if (type === Packet.TYPE.A) {
        const config = readConfig();
        const resolved = resolveRoute(name, config.routes);
        const shielded = isShielded(name, '', config);
        
        if ((resolved && resolved.config.wildcard) || shielded) {
          response.answers.push({
            name,
            type: Packet.TYPE.A,
            class: Packet.CLASS.IN,
            ttl: 60,
            address: '127.0.0.1'
          } as any);
          return send(response);
        }
      }

      // If it doesn't match a local wildcard route, forward it
      try {
        // Forward the exact name and type to 8.8.8.8
        const result = await forwardClient(name, Object.keys(Packet.TYPE).find(k => (Packet.TYPE as any)[k] === type) || 'A');
        
        response.answers = result.answers;
        response.authorities = result.authorities;
        response.additionals = result.additionals;
        
        // Also copy the rcode from the upstream response (e.g. NXDOMAIN)
        response.header.rcode = result.header.rcode;
        
        send(response);
      } catch (err) {
        // In case of forwarding error (e.g. timeout), return SERVFAIL (rcode 2)
        response.header.rcode = 2;
        send(response);
      }
    }
  });

  server.on('error', (err: any) => {
    if (err.code === 'EACCES') {
      console.warn('\n⚠️  DNS Server Warning: Permission denied (EACCES). Cannot bind to port 53.');
      console.warn('   Run daemon as root (sudo vroute start) to enable wildcard DNS resolution.');
    } else if (err.code === 'EADDRINUSE') {
      console.warn('\n⚠️  DNS Server Warning: Port 53 is already in use (EADDRINUSE).');
      console.warn('   Wildcard subdomains will not resolve automatically unless you use .localhost');
    } else {
      console.error('\n❌ DNS Server Error:', err.message);
    }
  });

  server.listen({
    udp: 53
  }).then(() => {
    console.log('✅ Local DNS Server listening on UDP port 53');
  }).catch((err: any) => {
    // EACCES or EADDRINUSE are caught by the 'error' event as well, but we catch here to prevent unhandled rejections
  });

  return server;
}
