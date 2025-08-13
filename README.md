# SW CLI

A command-line tool for managing and discovering reusable code templates and packages from a local monorepo.

## Overview

SW provides fast local search, dependency resolution, and workspace integration for code templates and packages, all without any network operations. It reads from a filesystem-based monorepo and helps developers quickly discover and use reusable code.

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

Set the environment variable to point to your SW monorepo:
```bash
export SW_ROOT=/path/to/sw-monorepo  # Path to the SW monorepo containing apps/ and packages/
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

## Repository Structure

The SW monorepo should have the following structure:
```
$SW_ROOT/
├── apps/           # Template applications
│   ├── saas-starter/
│   │   ├── sw.json
│   │   └── package.json
│   └── blog-template/
│       ├── sw.json
│       └── package.json
└── packages/       # Reusable packages
    ├── auth-ui/
    │   ├── sw.json
    │   └── package.json
    └── database/
        ├── sw.json
        └── package.json
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
sw view templates/saas-starter        # View a template
sw view packages/auth-ui              # View a package
```

### Use artifact in workspace
```bash
sw use templates/saas-starter         # Copy template with all dependencies
sw use packages/database --no-install # Copy package without running install
```

## Artifact Identification

Artifacts are identified using a slug format:
- Templates: `templates/<id>` (e.g., `templates/saas-starter`)
- Packages: `packages/<id>` (e.g., `packages/auth-ui`)

This format is used consistently across all commands.

## Development

```bash
# Install dependencies
bun install

# Build TypeScript to JavaScript
bun run build

# Run in development mode (with watch)
bun run dev

# Run tests
bun test                  # Run all tests
bun run test:unit        # Run unit tests with verbose output
bun run test:coverage    # Run tests with coverage report

# Code quality
bun run lint             # Run ESLint
bun run typecheck        # Run TypeScript type checking

# Clean build artifacts
bun run clean
```

## Testing

The project includes comprehensive test coverage:
- Unit tests for core modules
- Integration tests for commands
- E2E tests for full CLI execution

To test with the example repository:
```bash
export SW_ROOT="$(pwd)/example-repos/sw-example"
bun start list           # List all artifacts
bun start find auth      # Search for "auth" in code
bun start view templates/saas-starter  # View template details
```

## License

MIT