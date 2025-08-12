# SW CLI

A command-line tool for managing and discovering reusable code templates and packages from local monorepo clones.

## Overview

SW provides fast local search, dependency resolution, and workspace integration for code templates and packages, all without any network operations. It reads from filesystem-based monorepo clones and helps developers quickly discover and use reusable code.

## Features

- **Local-only operations**: All operations read from filesystem; no network calls
- **Fast search**: Powered by ripgrep for instant code/metadata search
- **Smart dependency resolution**: Automatically resolves and copies internal dependencies
- **Zero duplication**: Dependencies derived from package.json, not duplicated in metadata
- **Simple metadata**: Minimal sw.json per artifact; everything else derived

## Installation

```bash
npm install -g sw-cli
```

## Configuration

Set environment variables:
```bash
export SW_TEMPLATES_ROOT=/path/to/sw-templates  # Path to templates monorepo clone
export SW_PACKAGES_ROOT=/path/to/sw-packages    # Path to packages monorepo clone
```

Create `~/.swrc.json`:
```json
{
  "internalScopes": ["@repo"],
  "defaultPackageManager": "pnpm",
  "preview": {
    "defaultLines": 80
  }
}
```

## Commands

### List artifacts
```bash
sw list [templates|packages|all]
```

### Search code and metadata
```bash
sw find <pattern>
sw find "re:/async\\s+function/"  # Regex search
sw find "like:{stripe.prices}"    # Substring search
```

### View artifact preview
```bash
sw view templates/paid-saas-app-with-auth
```

### Use artifact in workspace
```bash
sw use templates/paid-saas-app-with-auth
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## License

MIT