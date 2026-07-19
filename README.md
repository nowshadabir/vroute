# vroute

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/vroute.svg)](https://www.npmjs.com/package/vroute)

> Zero-config local DNS & SSL router for seamless local web development

**vroute** eliminates the friction of local web development by automatically handling DNS mapping, SSL certificate generation, OS trust injection, and traffic proxying — all from a clean web dashboard. It acts as your local "infrastructure in a box", helping you bypass CORS, simulate network latency, block analytics, and map custom domains securely to your local dev servers.

![vroute dashboard](https://github.com/nowshadabir/vroute/raw/main/packages/vroute-cli/dashboard.png)

---

## Why vroute?

When developing locally, you often face roadblocks:
- Testing third-party services (payment gateways, OAuth, webhooks) that demand HTTPS.
- Juggling ports instead of using clean custom domains (e.g., `app.test` instead of `localhost:3000`).
- Fighting CORS restrictions during API testing.
- Polluting your live product analytics (Mixpanel, Google Analytics) because of local testing clicks.
- Modifying your backend code just to simulate slow networks or 500 server errors for UI testing.

Currently, solving these involves generating manual SSL certs, configuring complex reverse proxies (like NGINX), and editing system files like `/etc/hosts` by hand.

**vroute automates all of this.**

---

## Key Features

- 🌍 **Instant Local Domains** — Map custom domains (e.g., `app.test`) to local ports instantly.
- 🔀 **Wildcard Subdomains** — Map `*.app.test` for multi-tenant applications easily without defining each subdomain.
- 🛡️ **Built-in Local DNS Server** — Intercepts traffic automatically without touching `/etc/hosts` for wildcard and shielded domains (runs locally on UDP Port 53).
- 🔒 **Auto-SSL** — Generate trusted SSL certificates automatically on the fly.
- 🔓 **CORS Bypass** — Automatically inject headers to prevent cross-origin errors in the browser.
- 🚫 **Analytics & Webhook Shield** — Silently block third-party trackers with dummy 200 OK responses to keep production data clean.
- ⚡ **UI Chaos Monkey** — Inject customizable latency and HTTP faults to test frontend resilience without changing backend code.
- 💻 **Cross-Platform** — Works flawlessly on Linux, macOS, and Windows.
- 📊 **Web Dashboard** — Clean, minimal UI to manage routes, settings, and monitor traffic in real-time.
- 💾 **Persistent Routes** — Routes survive reboots and daemon restarts.

---

## Quick Start

```bash
# Install globally
npm install -g vroute

# Generate and trust local SSL certificates
sudo vroute setup

# Start the background daemon (Requires sudo to bind to port 53 for Local DNS features)
sudo vroute start

# Open the dashboard
vroute ui

# Add a route manually via CLI (or use the Dashboard UI)
sudo vroute add myapp.test 3000
```

Visit `https://myapp.test` in your browser — it is proxied directly to `localhost:3000` with a valid, trusted SSL certificate!

---

## CLI Commands Reference

Manage your local environments directly from your terminal. 

| Command | Description | Example Usage |
|---------|-------------|---------------|
| `vroute setup` | Generate local Root CA and inject it into OS trust store | `sudo vroute setup` |
| `vroute start` | Start the background routing daemon | `sudo vroute start` |
| `vroute stop` | Stop the background daemon | `vroute stop` |
| `vroute ui` | Open the web dashboard in your default browser | `vroute ui` |
| `vroute add <domain> <port>` | Map a domain or wildcard to a local port | `sudo vroute add *.app.test 3000` |
| `vroute remove <domain>` | Remove an active local route | `sudo vroute remove app.test` |
| `vroute list` | List all active routes mapped by vroute | `vroute list` |
| `vroute status` | Check if the vroute daemon is currently running | `vroute status` |

*(Note: Certain commands like `start` or `add` may require `sudo` to securely modify the OS hosts file or bind the local DNS server to port 53.)*

---

## The Dashboard

The built-in web dashboard is the command center for your local environment. Run `vroute ui` (or visit `http://localhost:9999`) to access it.

**Dashboard Features:**
- **Route management** — Add, view, and remove exact or wildcard routes, with independent SSL/CORS toggles.
- **Analytics Shield** — Toggle and manage your tracking/webhook blocklist to avoid polluting production data.
- **Chaos Monkey** — Add granular fault and latency injection rules per route to test your frontend.
- **Real-time traffic** — Monitor proxied requests with method, status, host, latency, and interception badges.
- **Connection status** — Live WebSocket connection indicator.

---

## Advanced Proxy Middlewares

### 🛡️ Analytics & Webhook Shield (No-Pollution Mode)
During frontend development, firing requests to Mixpanel, Google Analytics, or Stripe webhooks can pollute your actual live dashboards. 

With the Shield enabled from the dashboard, vroute intercepts outgoing tracking scripts via its Local DNS and instantly returns a mock `200 OK` response with CORS bypass headers. This prevents ugly red console errors in your browser, allows your frontend to execute flawlessly, and keeps your live product data 100% clean.

*(Note: Intercepting external domains requires the daemon to run via `sudo` to bind to port 53.)*

### ⚡ UI Chaos Monkey (Fault & Latency Injection)
Testing frontend loading skeletons or API timeout handlers usually requires temporarily writing `setTimeout()` or `throw new Error()` inside your backend. This pollutes codebases and risks shipping buggy test code to production.

With Chaos Monkey, you can apply rules directly in the vroute dashboard. Set a `1000ms` latency and a `50%` failure rate on `/api/checkout`, and vroute will dynamically inject faults into the network traffic. This allows you to test frontend resilience while keeping both the frontend and backend codebases completely pristine.

---

## Packages

This is a monorepo containing:

| Package | Description | Status |
|---------|-------------|--------|
| [`vroute-cli`](./packages/vroute-cli) | npm CLI package with web dashboard | Active |
| [`vroute-desktop`](./packages/vroute-desktop) | Windows/Mac desktop app | Coming Soon |

---

## Tech Stack

- **CLI** — Commander.js
- **Daemon** — Express 5, http-proxy, Socket.IO
- **Dashboard** — React 19, Tailwind CSS, Vite
- **SSL** — node-forge (local CA generation)
- **DNS** — Built-in UDP DNS Server (dns2) + Cross-platform hosts file management

## Platform Support

vroute is designed to run anywhere smoothly:

| Platform | DNS Modification | SSL Trust |
|----------|------------------|-----------|
| **Linux** | `/etc/hosts` via `sudo` | `update-ca-certificates` |
| **macOS** | `/etc/hosts` via `osascript` | Keychain via `security add-trusted-cert` |
| **Windows** | PowerShell `Start-Process -Verb RunAs` | `certutil -addstore` |

---

## Development

Want to contribute or hack on vroute locally?

```bash
# Clone the repo
git clone https://github.com/nowshadabir/vroute.git
cd vroute

# Install all dependencies
npm install

# Build the CLI package
npm run build:cli

# Build the Dashboard UI
cd packages/vroute-cli/src/dashboard && npm run build
```

---

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

---

## Contributing

Contributions are heavily welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the ISC License — see the [LICENSE](LICENSE) file for details.

---

Built by [Kazi Nowshad Abir](https://github.com/nowshadabir) | [VivaGo Technologies](https://github.com/vivagotechnologies)
