# Contributing to vroute

Thank you for your interest in contributing to vroute! This document provides guidelines and information for contributors.

## Code of Conduct

Please be respectful and inclusive in all interactions. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/vivagotechnologies/vroute/issues) to avoid duplicates
2. Create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Your OS and Node.js version

### Suggesting Features

1. Open an issue with the "feature request" label
2. Describe the problem you're trying to solve
3. Explain your proposed solution

### Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests if applicable
5. Update documentation if needed
6. Commit with clear messages: `git commit -m 'Add: amazing feature description'`
7. Push: `git push origin feature/amazing-feature`
8. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/vroute.git
cd vroute

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Project Structure

```
vroute/
├── src/
│   ├── cli/          # CLI commands
│   ├── daemon/       # Background server
│   ├── dashboard/    # Web UI
│   ├── dns/          # DNS management
│   ├── ssl/          # SSL certificates
│   └── state/        # Config persistence
├── bin/              # Entry points
└── dist/             # Compiled output
```

### Coding Standards

- **TypeScript**: Use strict mode
- **Formatting**: Follow existing code style
- **Comments**: Add comments for complex logic
- **Error Handling**: Always handle errors gracefully

### Commit Messages

Use conventional commits:

- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `style: code formatting`
- `refactor: code restructuring`
- `test: add tests`
- `chore: maintenance tasks`

### Testing

```bash
# Run all tests
npm test

# Run specific test
npm test -- --grep "test name"
```

## Pull Request Guidelines

1. **One feature per PR** - Keep changes focused
2. **Clear description** - Explain what and why
3. **Tests included** - Add tests for new features
4. **Documentation updated** - Update README if needed
5. **No breaking changes** - Unless discussed in an issue

## Review Process

1. All PRs require at least one review
2. Address feedback promptly
3. Keep PR updated with main branch
4. Squash commits before merge

## Getting Help

- Open an issue for questions
- Join discussions in existing issues
- Review the codebase for patterns

Thank you for contributing to vroute!
