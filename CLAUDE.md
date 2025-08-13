## Project Overview

SW CLI is a TypeScript command-line tool for managing and discovering reusable code templates and packages from a local monorepo containing both apps/ (templates) and packages/ directories.


## Development Commands

### Building and Running
```bash
# Install dependencies
bun install

# Build TypeScript to JavaScript
bun run build

# Run in development mode (with watch)
bun run dev

# Clean build artifacts
bun run clean

# Start compiled CLI
bun start
```

### Testing
```bash
# Run all tests
bun test

# Run tests with verbose output
bun run test:unit

# Run tests with coverage report
bun run test:coverage

# Run specific test file
bun run vitest run path/to/test.ts
```

### Code Quality
```bash
# Run ESLint
bun run lint

# Run TypeScript type checking
bun run typecheck
```

## Architecture

### Code Organization

The codebase follows a modular architecture with clear separation of concerns:

- **Commands** (`src/commands/`): CLI command implementations (list, find, view, use)
  - Each command has its own directory with command, handler, and test files
  - Commands use Zod for validation and type inference

- **Core Business Logic** (`src/core/`):
  - `artifact/`: Scanning and indexing artifacts from monorepos
  - `config/`: Configuration loading and validation with Zod schemas
  - `dependency/`: Dependency resolution and graph building
  - `search/`: Ripgrep integration for code search

- **Shared Utilities** (`src/lib/`):
  - `fs/`: File system operations and copying
  - `output/`: Formatters for JSON and pretty-print output
  - `process/`: Child process execution and package manager detection
  - `validation/`: Shared Zod schemas and validation utilities

- **Type Definitions** (`src/types/`): Global TypeScript type definitions

### Key Design Patterns

1. **Zod-First Type Safety**: All configurations and inputs are validated using Zod schemas, with TypeScript types derived from schemas
2. **Local-Only Operations**: All operations read from filesystem; no network calls
3. **Slug-Based Identification**: Artifacts are identified using `templates/<id>` or `packages/<id>` format
4. **Recursive Dependency Resolution**: Internal dependencies are automatically resolved and copied

### Testing Strategy

- **Unit Tests**: Test modules in isolation with mocked dependencies
- **Integration Tests**: Test command handlers with real file fixtures
- **E2E Tests**: Full command execution via CLI

Tests use Vitest with fixtures in `tests/fixtures/` and example monorepos in `example-repos/`.

## Configuration

The CLI requires:
1. Environment variable: `SW_ROOT` pointing to the monorepo containing apps/ and packages/
2. User config file: `~/.swrc.json` with internal scopes and package manager settings

## Implementation Status

The CLI is fully implemented with:
- Complete command implementations (list, find, view, use)
- Artifact scanning from a single monorepo structure
- Dependency resolution and copying
- Comprehensive test coverage (74 tests passing)
- Example repository in `example-repos/sw-example/`

The system works with a single `SW_ROOT` environment variable pointing to a monorepo containing:
- `apps/` directory for template applications
- `packages/` directory for reusable packages