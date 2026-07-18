# vroute

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

> Zero-config local DNS & SSL router for seamless local web development

**vroute** eliminates the friction of local web development by automatically handling DNS mapping, SSL certificate generation, OS trust injection, and traffic proxying with a single command.

## Why vroute?

When developing locally, you often need to:
- Test third-party services (payment gateways, OAuth, webhooks) that require HTTPS
- Use custom domains instead of `localhost:3000`
- Bypass CORS restrictions during API testing

Currently, this involves:
- Manually generating SSL certificates
- Configuring complex reverse proxies (NGINX)
- Editing system files like `/etc/hosts`

**vroute** automates all of this with a beautiful web dashboard.

## Features

- **Instant Local Domains** - Map custom domains (e.g., `app.test`) to local ports
- **Auto-SSL** - Generate trusted SSL certificates automatically
- **CORS Bypass** - Inject headers to prevent cross-origin errors
- **Cross-Platform** - Works on Linux, macOS, and Windows
- **Zero Configuration** - Drive everything from a modern web UI
- **Persistent Routes** - Routes survive reboots

## Quick Start

### Installation

```bash
npm install -g vroute
```

### Setup

```bash
# Generate and trust local SSL certificates
vroute setup

# Start the daemon
vroute start

# Open the web dashboard
vroute ui
```

### Add Your First Route

```bash
# Add a route mapping
vroute add app.test 3000

# Your app is now available at https://app.test
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `vroute start` | Start the background daemon |
| `vroute stop` | Stop the background daemon |
| `vroute add <domain> <port>` | Add a new local route |
| `vroute remove <domain>` | Remove a local route |
| `vroute list` | List all active routes |
| `vroute status` | Check if daemon is running |
| `vroute setup` | Generate and trust SSL certificates |
| `vroute ui` | Open the web dashboard |

## Architecture

```
vroute/
├── src/
│   ├── cli/          # Command-line interface
│   ├── daemon/       # Background server
│   ├── dashboard/    # Web UI (Next.js + Tailwind)
│   ├── dns/          # Hosts file management
│   ├── ssl/          # Certificate generation
│   └── state/        # Configuration persistence
├── bin/              # CLI entry points
└── dist/             # Compiled output
```

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/vivagotechnologies/vroute.git
cd vroute

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Project Structure

- **CLI** (`src/cli/`): Command-line interface using Commander.js
- **Daemon** (`src/daemon/`): Background Express server
- **Dashboard** (`src/dashboard/`): Next.js web interface
- **DNS** (`src/dns/`): Cross-platform hosts file management
- **SSL** (`src/ssl/`): Certificate generation using node-forge
- **State** (`src/state/`): JSON-based configuration storage

## Platform Support

| Platform | DNS Modification | SSL Trust |
|----------|------------------|-----------|
| Linux | `/etc/hosts` via sudo | `/usr/local/share/ca-certificates/` |
| macOS | `/etc/hosts` via osascript | Keychain via `security add-trusted-cert` |
| Windows | PowerShell `Start-Process -Verb RunAs` | `certutil -addstore` |

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with Node.js, Express, and TypeScript
- Dashboard powered by Next.js and Tailwind CSS
- SSL certificates generated with node-forge

---

Made with ❤️ by [VivaGo Technologies](https://github.com/vivagotechnologies)
