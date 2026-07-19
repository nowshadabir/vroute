# vroute

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/vroute.svg)](https://www.npmjs.com/package/vroute)

> Zero-config local DNS & SSL router for seamless local web development

**vroute** eliminates the friction of local web development by automatically handling DNS mapping, SSL certificate generation, OS trust injection, and traffic proxying — all from a clean web dashboard.

## Why vroute?

When developing locally, you often need to:
- Test third-party services (payment gateways, OAuth, webhooks) that require HTTPS
- Use custom domains instead of `localhost:3000`
- Bypass CORS restrictions during API testing

Currently, this involves:
- Manually generating SSL certificates
- Configuring complex reverse proxies (NGINX)
- Editing system files like `/etc/hosts`

**vroute** automates all of this.

## Features

- **Instant Local Domains** — Map custom domains (e.g., `app.test`) to local ports
- **Wildcard Subdomains** — Map `*.app.test` for multi-tenant applications easily
- **Built-in Local DNS Server** — Automatically intercepts traffic without touching `/etc/hosts` (for wildcard and shielded domains)
- **Auto-SSL** — Generate trusted SSL certificates automatically on the fly
- **CORS Bypass** — Inject headers to prevent cross-origin errors
- **Analytics & Webhook Shield** — Silently block third-party trackers with dummy 200 OK responses to keep data clean
- **UI Chaos Monkey** — Inject customizable latency and HTTP faults to test frontend resilience
- **Cross-Platform** — Works on Linux, macOS, and Windows
- **Web Dashboard** — Clean, minimal UI to manage routes, settings, and monitor traffic
- **Persistent Routes** — Routes survive reboots

## Quick Start

```bash
# Install globally
npm install -g vroute

# Generate and trust local SSL certificates
sudo vroute setup

# Start the daemon
sudo vroute start

# Open the dashboard
vroute ui

# Add a route
sudo vroute add myapp.test 3000
```

Visit `https://myapp.test` in your browser — it's proxied to `localhost:3000` with a valid SSL certificate.

## CLI Commands

| Command | Description |
|---------|-------------|
| `vroute start` | Start the background daemon |
| `vroute stop` | Stop the background daemon |
| `vroute ui` | Open the web dashboard in browser |
| `vroute add <domain> <port>` | Add a new local route |
| `vroute remove <domain>` | Remove a local route |
| `vroute list` | List all active routes |
| `vroute status` | Check if daemon is running |
| `vroute setup` | Generate and trust SSL certificates |

## Dashboard

The built-in web dashboard provides:
- **Route management** — Add, view, and remove routes with SSL/CORS toggles
- **Analytics Shield** — Toggle and manage your tracking/webhook blocklist to avoid polluting production data.
- **Chaos Monkey** — Add granular fault and latency injection rules per route to test your frontend.
- **Real-time traffic** — Monitor proxied requests with method, status, host, latency, and interception badges.
- **Connection status** — Live WebSocket connection indicator

Run `vroute ui` to open it at `http://localhost:9999`.

## Advanced Features

### 🛡️ Analytics & Webhook Shield (No-Pollution Mode)
During frontend development, firing requests to Mixpanel, Google Analytics, or Stripe webhooks can pollute your actual live dashboards. With the Shield enabled, vroute intercepts outgoing tracking scripts via its Local DNS and instantly returns a mock `200 OK` response with CORS bypass headers. This prevents red console errors in your browser while keeping your live data 100% clean.
*(Note: Intercepting external domains requires the daemon to run via `sudo` to bind to port 53.)*

### ⚡ UI Chaos Monkey (Fault & Latency Injection)
Testing frontend loading skeletons or API timeout handlers usually requires temporarily writing `setTimeout()` or `throw new Error()` in your backend. With Chaos Monkey, you can apply rules directly in the vroute dashboard. Set a `1000ms` latency and a `50%` failure rate on `/api/checkout`, and vroute will dynamically inject faults into the network traffic, allowing you to test frontend resilience while keeping both codebases pristine.

## Packages

This is a monorepo containing:

| Package | Description | Status |
|---------|-------------|--------|
| [`vroute-cli`](./packages/vroute-cli) | npm CLI package with web dashboard | Active |
| [`vroute-desktop`](./packages/vroute-desktop) | Windows/Mac desktop app | Coming Soon |

## Project Structure

```
vroute/
├── packages/
│   ├── vroute-cli/              # npm CLI package
│   │   ├── src/
│   │   │   ├── cli/             # Command-line interface (Commander.js)
│   │   │   ├── daemon/          # Express server + reverse proxy
│   │   │   ├── dashboard/       # React + Tailwind CSS web UI
│   │   │   ├── dns/             # Cross-platform hosts file management
│   │   │   ├── ssl/             # Certificate generation (node-forge)
│   │   │   └── state/           # JSON config persistence (~/.vroute/)
│   │   └── bin/                 # CLI entry points
│   └── vroute-desktop/          # Desktop app (coming soon)
├── README.md
├── LICENSE
└── CONTRIBUTING.md
```

## Tech Stack

- **CLI** — Commander.js
- **Daemon** — Express 5, http-proxy, Socket.IO
- **Dashboard** — React 19, Tailwind CSS, Vite
- **SSL** — node-forge (local CA generation)
- **DNS** — Built-in UDP DNS Server (dns2) + Cross-platform hosts file management

## Platform Support

| Platform | DNS Modification | SSL Trust |
|----------|------------------|-----------|
| Linux | `/etc/hosts` via sudo | `update-ca-certificates` |
| macOS | `/etc/hosts` via osascript | Keychain via `security add-trusted-cert` |
| Windows | PowerShell `Start-Process -Verb RunAs` | `certutil -addstore` |

## Development

```bash
# Clone
git clone https://github.com/nowshadabir/vroute.git
cd vroute

# Install dependencies
npm install

# Build CLI
npm run build:cli

# Build dashboard
cd packages/vroute-cli/src/dashboard && npm run build
```

## Roadmap

- [x] CLI tool with web dashboard
- [x] Built-in DNS Server (UDP port 53)
- [x] Cross-platform DNS management
- [x] Auto-SSL certificate generation
- [x] Advanced Proxies: Analytics Shield & Chaos Monkey
- [x] Tailwind CSS light theme dashboard
- [ ] Desktop app (Windows .exe)
- [ ] Desktop app (macOS .app)
- [ ] System tray integration
- [ ] Auto-updates

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License — see the [LICENSE](LICENSE) file for details.

---

Built by [Kazi Nowshad Abir](https://github.com/nowshadabir) | [VivaGo Technologies](https://github.com/vivagotechnologies)
