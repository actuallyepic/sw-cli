# SW CLI Specification - Local-Only Model

## Overview

SW is a command-line tool for managing and discovering reusable code templates and packages from a local monorepo. It provides fast local search, dependency resolution, and workspace integration without any network operations.

## Core Principles

- **Local-only**: All operations read from filesystem; no network calls
- **Zero duplication**: Dependencies derived from `package.json`, not duplicated in metadata
- **Fast search**: Powered by ripgrep for instant code/metadata search
- **Simple metadata**: Minimal `sw.json` per artifact; everything else derived
- **Smart defaults**: Works out-of-the-box with sensible conventions

## System Architecture

### 1. Filesystem Layout

```
$SW_ROOT/                             # Set via SW_ROOT env var
  package.json
  turbo.json
  apps/                               # template applications
    saas-app/
      sw.json
      package.json
      src/...
    blog-template/
      sw.json
      package.json
      ...
  packages/                           # reusable packages
    auth-ui/
      sw.json
      package.json
      ...
    database/
      sw.json
      package.json
      ...
    ui/
      sw.json
      package.json
      ...

~/.swrc.json                          # REQUIRED CLI configuration file

/workspaces/current/                  # User's active workspace (written by `sw use`)
  apps/
  packages/
```

### 2. Configuration

#### Environment Variables (REQUIRED)

```bash
export SW_ROOT=/path/to/sw-monorepo  # Path to the SW monorepo
```

#### Configuration File (`~/.swrc.json`)

**REQUIRED** - The CLI will exit with an error if this file is missing.

```json
{
  "internalScopes": ["@repo"],       // Package name prefixes treated as internal
  "defaultPackageManager": "pnpm",   // pnpm | npm | yarn
  "preview": {
    "defaultLines": 80                // Default preview length for `sw view`
  }
}
```

### 3. Artifact Metadata (`sw.json`)

Minimal metadata file per template/package:

```json
{
  "type": "template",                       // "template" | "package"
  "slug": "paid-saas-app-with-auth",       // Slug without repo prefix (matches folder name)
  "name": "Paid SaaS App (Auth + Billing)", // Human-readable name
  "description": "Starter with auth and Stripe billing.",
  "tags": ["web", "nextjs", "auth", "stripe"],
  
  "requiredEnv": [                          // Required environment variables
    {
      "name": "STRIPE_SECRET_KEY",
      "description": "Stripe secret key for billing",
      "example": "sk_test_..."
    },
    {
      "name": "DATABASE_URL",
      "description": "PostgreSQL connection string",
      "example": "postgresql://user:pass@localhost:5432/db"
    }
  ],
  
  "view": [                                 // Curated preview sections
    { "path": "README.md", "lines": "all" },
    { "path": "src/app/page.tsx", "lines": [1, 120] },
    { "tree": { "path": "src/components", "depth": 2, "limit": 100 } },
    { "path": "package.json", "lines": [1, 80] }
  ]
}
```

#### View Entry Types

1. **File with all lines**: `{ "path": "<file>", "lines": "all" }`
2. **File with line range**: `{ "path": "<file>", "lines": [start, end] }`
3. **Directory tree**: `{ "tree": { "path": "<dir>", "depth": <n>, "limit": <max_entries> } }`

**Fallback** (when `view` not specified):
1. `README.md` (all or default lines)
2. `package.json` (first N lines)
3. Entry point (`src/index.*` or framework-typical entry)

## Discovery & Resolution

### Artifact Discovery

1. **Repository structure**:
   - Apps: `$SW_ROOT/apps/*` - Templates for applications
   - Packages: `$SW_ROOT/packages/*` - Reusable packages

2. **Visibility Rules**:
   - All templates in `apps/*` are listed, searchable, and usable
   - All packages in `packages/*` are listed, searchable, and usable
   - Both templates and packages can have `sw.json` metadata

3. **Slug Format**:
   - Templates: `templates/<id>` (e.g., `templates/saas-starter`)
   - Packages: `packages/<id>` (e.g., `packages/auth-ui`)
   - Used consistently across all commands for unambiguous artifact reference

### Dependency Classification

Dependencies are classified by parsing `package.json`:

1. **Internal dependency** if:
   - Name starts with any prefix in `internalScopes` (e.g., `@repo/`)
   - OR matches a discovered package name in either monorepo

2. **External dependency**: Everything else

**Default behaviors**:
- **Templates**: Copy app + all internal deps to workspace
- **Packages**: Copy package only; warn about internal deps (use `--with-internals`)

## Command Reference

### Global Conventions

- **Output**: Pretty human-readable by default, JSON with `--json`
- **Exit codes**:
  - `0`: Success
  - `1`: Not found
  - `2`: Invalid arguments
  - `3`: Conflict (e.g., destination exists)
  - `4`: Filesystem error
  - `5`: Execution error

### `sw list`

List available templates or packages with minimal metadata.

```bash
sw list [templates|packages|all]
```

**Note**: Shows all artifacts with valid `sw.json` metadata in both `apps/` and `packages/` directories.

**Flags**:
- `--filter-tag <tag>`: Filter by tag (repeatable)
- `--filter-text "<text>"`: Case-insensitive substring match
- `--limit <n>`: Limit results
- `--offset <n>`: Skip first n results
- `--json`: Machine-readable output
- `--long`: Include extended information
- `--paths`: Include absolute source paths
- `--quiet`: Slugs only, one per line

**JSON Output Shape**:
```json
{
  "slug": "packages/github-service",
  "id": "github-service",
  "type": "package",
  "name": "GithubService",
  "description": "Thin TS client for GitHub.",
  "tags": ["github", "api", "ts"],
  "relPath": "packages/github-service",
  "absPath": "/path/to/sw-packages/packages/github-service"
}
```

### `sw find`

Fast local search across code and metadata using ripgrep. Searches all repositories by default.

```bash
sw find <pattern>
```

**Note**: Searches across all artifacts in both `apps/` and `packages/` directories.

**Pattern Syntax**:
- `re:/pattern/`: Regular expression search (Rust regex syntax)
- `like:{pattern}`: Substring search (case-sensitive by default)
- `exact:pattern`: Exact match
- `pattern`: Plain pattern defaults to regex

**Examples**:
```bash
sw find "re:/async\s+function/"    # Regex for async functions
sw find "like:{stripe.prices}"     # Substring search
sw find "exact:getUserById"         # Exact match
sw find "TODO|FIXME"                # Default regex
```

**Filter Flags**:
- `--filter <type>`: Filter what to search (repeatable)
  - `code`: Source code files
  - `meta`: Metadata files (`sw.json`, `package.json`, `README*`)
  - `docs`: Documentation files
  - `tests`: Test files
  - Default: searches everything
- `--scope <templates|packages>`: Limit to specific repository
- `--path <glob>`: Restrict to paths (repeatable)
- `--ext <ext>`: Filter by extension (repeatable)
- `--lang <ts|js|py|go|rust>`: Convenience presets for extensions
- `--tag <tag>`: Filter by artifact tags (repeatable)
- `--id <id|glob>`: Filter by artifact ID (repeatable)

**Query Modifiers**:
- `--case-insensitive`: Force case-insensitive search
- `--word`: Match whole words only

**Output Flags**:
- `--json`: Structured output
- `--context <N>`: Lines of context before/after
- `--files-only`: List files without snippets
- `--max-matches <n>`: Stop after n matches

**JSON Hit Shape**:
```json
{
  "artifact": {
    "slug": "templates/paid-saas-app-with-auth",
    "id": "paid-saas-app-with-auth",
    "type": "template"
  },
  "file": "src/app/page.tsx",
  "line": 42,
  "match": "const plan = await stripe.prices.list(...)",
  "before": ["..."],
  "after": ["..."]
}
```

### `sw view`

Show curated previews for templates/packages using the slug format.

```bash
sw view <slug>
```

Example: `sw view templates/paid-saas-app-with-auth`

**Note**: Can view any artifact with valid `sw.json` metadata using the appropriate slug format.

**Flags**:
- `--override <spec>`: Add or replace preview sections (repeatable)
  
  **File previews**:
  - `path:start-end`: Show lines from start to end
  - `path`: Show entire file
  
  **Directory trees**:
  - `tree:path`: Show directory tree (default depth: 2, limit: 50)
  - `tree:path:depth`: Specify tree depth
  - `tree:path:depth:limit`: Specify depth and entry limit
  
  **Examples**:
  ```bash
  # Show specific lines from a file
  --override src/lib/api.ts:1-80
  
  # Show entire file
  --override src/app/layout.tsx
  
  # Show directory tree with defaults
  --override tree:src/components
  
  # Show tree with depth 3
  --override tree:src/components:3
  
  # Show tree with depth 2 and max 100 entries
  --override tree:src/components:2:100
  ```

- `--json`: Structured output

**JSON Section Shape**:
```json
{
  "kind": "file",
  "path": "src/app/page.tsx",
  "range": [1, 120],
  "content": ["import ...", "..."]
}
```

### `sw use`

Copy artifacts into the current workspace with automatic dependency resolution and installation.

```bash
sw use <slug>
```

Example: `sw use templates/paid-saas-app-with-auth`

**Flags**:
- `--into <apps|packages>`: Override destination directory (auto-detected by default)
- `--as <name>`: Rename destination folder (default: artifact slug)
- `--overwrite`: Replace existing destination if it exists
- `--dry-run`: Show plan without executing
- `--no-install`: Skip package manager installation (install runs by default)
- `--pm <pnpm|npm|yarn>`: Override auto-detected package manager
- `--print-next`: Show suggested next steps after completion
- `--json`: Structured output

**Default Behavior**:
- Templates are copied to `./apps/<slug>`
- Packages are copied to `./packages/<slug>`
- All transitive internal dependencies are automatically resolved and copied
- Package manager install runs automatically after copying
- Exits with error if any destination exists (unless `--overwrite`)
- Warns about required environment variables from `sw.json`

**Dependency Resolution Algorithm**:

When copying a template/package, the CLI performs recursive dependency resolution:

1. **Parse source `package.json`**: Extract all dependencies, devDependencies, and peerDependencies
2. **Classify each dependency**:
   - **Internal**: Package name starts with `internalScopes` (e.g., `@repo/`) OR exists in `$SW_ROOT/packages/`
   - **External**: Everything else (npm registry packages)
3. **For each internal dependency**:
   - Locate source in `$SW_ROOT/packages/` by matching package name
   - Check if already exists in destination `./packages/`
   - If exists: Warn about conflict and skip (unless `--overwrite`)
   - If not: Copy to `./packages/<dep-slug>`
   - **Recursively** resolve that dependency's internal dependencies
4. **Build dependency graph**: Track to avoid circular dependencies
5. **Copy in topological order**: Ensure dependencies are copied before dependents

**Conflict Resolution**:
- **Destination exists**: Exit with error, show conflicting path
- **Dependency version mismatch**: Warn if internal dep already exists with different version
- **Missing internal dependency**: Error and list missing packages
- **Circular dependency**: Detect and handle gracefully

**Operation Steps**:
1. **Validation Phase**:
   - Verify slug format and resolve to source path
   - Check source artifact exists and has valid `sw.json`
   - Determine destination path based on type
   - Check for destination conflicts

2. **Analysis Phase**:
   - Build full dependency tree recursively
   - Identify all internal packages needed
   - Check for conflicts in destination
   - Calculate copy order

3. **Execution Phase**:
   - Copy main artifact to destination
   - Copy each internal dependency in order
   - Update relative paths if needed
   - Preserve file permissions and timestamps

4. **Installation Phase**:
   - Detect package manager from lockfile
   - Run install command in workspace root
   - Validate installation succeeded

5. **Reporting Phase**:
   - List all copied artifacts
   - Show required environment variables
   - Display any warnings or conflicts
   - Suggest next steps (dev server, build, etc.)

**JSON Result Shape**:
```json
{
  "artifact": {
    "slug": "templates/paid-saas-app-with-auth",
    "id": "paid-saas-app-with-auth",
    "type": "template"
  },
  "destination": {
    "path": "./apps/paid-saas-app-with-auth",
    "action": "created"
  },
  "internalDeps": [
    {
      "name": "@repo/auth-ui",
      "id": "auth-ui",
      "source": "/path/to/templates/packages/auth-ui",
      "dest": "./packages/auth-ui",
      "action": "copied"
    }
  ],
  "externalDeps": ["next@^14", "react@^18", "stripe@^13"],
  "installed": true,
  "packageManager": "pnpm",
  "nextSteps": ["pnpm dev"]
}
```

## Implementation Architecture

This TypeScript CLI application uses Zod for runtime validation and type derivation, ensuring type safety from configuration through execution.

### Technology Stack

- **Language**: TypeScript 5.x
- **Runtime**: Node.js 20+
- **Validation**: Zod for schema validation and type inference
- **Testing**: Vitest for unit and integration tests
- **CLI Framework**: Commander.js for command parsing
- **File Operations**: Native fs/promises with proper error handling
- **Search**: Ripgrep integration via child_process

### Directory Structure

```
sw-cli/
├── src/
│   ├── commands/                 # Command implementations
│   │   ├── list/
│   │   │   ├── list.command.ts
│   │   │   ├── list.handler.ts
│   │   │   └── list.test.ts
│   │   ├── find/
│   │   │   ├── find.command.ts
│   │   │   ├── find.handler.ts
│   │   │   ├── find.parser.ts    # Pattern parsing logic
│   │   │   └── find.test.ts
│   │   ├── view/
│   │   │   ├── view.command.ts
│   │   │   ├── view.handler.ts
│   │   │   ├── view.renderer.ts  # Preview rendering
│   │   │   └── view.test.ts
│   │   └── use/
│   │       ├── use.command.ts
│   │       ├── use.handler.ts
│   │       ├── use.resolver.ts   # Dependency resolution
│   │       ├── use.copier.ts     # File copying logic
│   │       └── use.test.ts
│   │
│   ├── core/                     # Core business logic
│   │   ├── artifact/
│   │   │   ├── artifact.scanner.ts
│   │   │   ├── artifact.index.ts
│   │   │   ├── artifact.types.ts
│   │   │   └── artifact.test.ts
│   │   ├── config/
│   │   │   ├── config.loader.ts
│   │   │   ├── config.schema.ts  # Zod schemas
│   │   │   ├── config.types.ts   # Derived types
│   │   │   └── config.test.ts
│   │   ├── dependency/
│   │   │   ├── dependency.resolver.ts
│   │   │   ├── dependency.graph.ts
│   │   │   ├── dependency.types.ts
│   │   │   └── dependency.test.ts
│   │   └── search/
│   │       ├── search.engine.ts
│   │       ├── search.parser.ts
│   │       ├── search.types.ts
│   │       └── search.test.ts
│   │
│   ├── lib/                      # Shared utilities
│   │   ├── fs/
│   │   │   ├── fs.utils.ts       # File operations
│   │   │   ├── fs.copy.ts        # Copy with progress
│   │   │   └── fs.test.ts
│   │   ├── process/
│   │   │   ├── process.runner.ts # Child process wrapper
│   │   │   ├── process.pm.ts     # Package manager detection
│   │   │   └── process.test.ts
│   │   ├── output/
│   │   │   ├── output.formatter.ts
│   │   │   ├── output.tree.ts    # Tree rendering
│   │   │   ├── output.json.ts    # JSON formatting
│   │   │   └── output.test.ts
│   │   └── validation/
│   │       ├── validation.schemas.ts  # Shared Zod schemas
│   │       └── validation.utils.ts
│   │
│   ├── types/                    # Global type definitions
│   │   ├── index.ts
│   │   └── global.d.ts
│   │
│   ├── cli.ts                   # CLI entry point
│   └── index.ts                 # Main exports
│
├── tests/                        # Integration & E2E tests
│   ├── e2e/
│   │   ├── list.e2e.test.ts
│   │   ├── find.e2e.test.ts
│   │   ├── view.e2e.test.ts
│   │   └── use.e2e.test.ts
│   ├── fixtures/                # Test data
│   │   ├── templates/
│   │   └── packages/
│   └── utils/
│       └── test-helpers.ts
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Zod Schema Definitions & Type Derivation

```typescript
// src/core/config/config.schema.ts
import { z } from 'zod';

// Environment variable schema
export const EnvConfigSchema = z.object({
  SW_ROOT: z.string().min(1),
});

// User config schema (~/.swrc.json)
export const UserConfigSchema = z.object({
  internalScopes: z.array(z.string()).default(['@repo']),
  defaultPackageManager: z.enum(['pnpm', 'npm', 'yarn']).default('pnpm'),
  preview: z.object({
    defaultLines: z.number().positive().default(80),
  }).default({}),
});

// sw.json schema
export const SwJsonSchema = z.object({
  type: z.enum(['template', 'package']),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  requiredEnv: z.array(z.object({
    name: z.string(),
    description: z.string(),
    example: z.string().optional(),
  })).default([]),
  view: z.array(z.union([
    z.object({
      path: z.string(),
      lines: z.union([
        z.literal('all'),
        z.tuple([z.number(), z.number()]),
      ]).optional(),
    }),
    z.object({
      tree: z.object({
        path: z.string(),
        depth: z.number().positive().optional(),
        limit: z.number().positive().optional(),
      }),
    }),
  ])).optional(),
});

// Derived types from schemas
export type EnvConfig = z.infer<typeof EnvConfigSchema>;
export type UserConfig = z.infer<typeof UserConfigSchema>;
export type SwJson = z.infer<typeof SwJsonSchema>;

// Runtime type with full context
export const ArtifactSchema = z.object({
  slug: z.string(),
  id: z.string(),
  type: z.enum(['template', 'package']),
  relPath: z.string(),
  absPath: z.string(),
  sw: SwJsonSchema,
  packageJson: z.record(z.unknown()), // Lazy parse
});

export type Artifact = z.infer<typeof ArtifactSchema>;
```

### Core Module Responsibilities

#### Config Module (`src/core/config/`)
- Load and validate `~/.swrc.json` using Zod
- Read and validate environment variables
- Merge configurations with proper precedence
- Throw descriptive errors for missing/invalid config

#### Artifact Module (`src/core/artifact/`)
- Scan filesystem for artifacts in the monorepo
- Build and cache artifact index
- Validate `sw.json` files with Zod
- Provide fast lookup by slug or ID

#### Dependency Module (`src/core/dependency/`)
- Parse `package.json` dependencies
- Build dependency graphs
- Detect circular dependencies
- Resolve transitive internal dependencies
- Generate copy order via topological sort

#### Search Module (`src/core/search/`)
- Parse search patterns (regex, like, exact)
- Build ripgrep command arguments
- Stream and parse ripgrep JSON output
- Filter results by artifact metadata

### Command Handlers

Each command follows a consistent pattern:

1. **Parse & Validate**: Use Zod to validate inputs
2. **Load Context**: Config, artifact index, etc.
3. **Execute Logic**: Delegate to core modules
4. **Format Output**: JSON or pretty-print
5. **Handle Errors**: Consistent error codes

Example command structure:

```typescript
// src/commands/list/list.handler.ts
import { z } from 'zod';
import { loadConfig } from '../../core/config';
import { scanArtifacts } from '../../core/artifact';
import { formatList } from '../../lib/output';

const ListOptionsSchema = z.object({
  scope: z.enum(['templates', 'packages', 'all']).optional(),
  filterTag: z.array(z.string()).optional(),
  filterText: z.string().optional(),
  json: z.boolean().default(false),
  // ... other options
});

export async function handleList(options: unknown) {
  // Validate options
  const opts = ListOptionsSchema.parse(options);
  
  // Load context
  const config = await loadConfig();
  const artifacts = await scanArtifacts(config, opts.scope);
  
  // Apply filters
  const filtered = applyFilters(artifacts, opts);
  
  // Format output
  if (opts.json) {
    console.log(JSON.stringify(filtered, null, 2));
  } else {
    console.log(formatList(filtered));
  }
}
```

### Testing Strategy

#### Unit Tests (Vitest)
- Test each module in isolation
- Mock filesystem and child processes
- Validate Zod schemas with edge cases
- Test error handling paths

#### Integration Tests
- Test command handlers with real file fixtures
- Validate dependency resolution algorithms
- Test search with actual ripgrep

#### E2E Tests
- Full command execution via CLI
- Test with sample monorepo structures
- Validate output formats (JSON and pretty)
- Test error scenarios and exit codes

## Example Workflows

```bash
# List all artifacts
sw list

# List only templates
sw list templates

# List packages with specific tag (JSON)
sw list packages --filter-tag github --json

# Search with regex pattern
sw find "re:/async\s+function/"

# Search for substring
sw find "like:{stripe.prices}"

# Search in TypeScript files only
sw find "AGGrid" --filter code --ext ts --ext tsx

# Search in specific repository
sw find "TODO" --scope templates

# View curated preview using slug
sw view packages/github-service

# View with additional file preview
sw view templates/paid-saas-app-with-auth --override src/lib/stripe.ts:1-60

# View with directory tree
sw view templates/saas-app --override tree:src/components:3

# Use template (auto-installs by default)
sw use templates/paid-saas-app-with-auth

# Use with custom name
sw use templates/paid-saas-app-with-auth --as acme-saas

# Skip installation
sw use packages/github-service --no-install

# Dry run to see what would happen
sw use templates/paid-saas-app-with-auth --dry-run --json
```

## Edge Cases & Error Handling

### Missing Configuration
- Exit with error if `~/.swrc.json` is missing
- Exit with error if environment variables not set

### Duplicate IDs
- Handled via slug format (`templates/id` vs `packages/id`)
- No ambiguity with explicit namespace

### Missing Internal Dependencies
- Print clear warning with package name and scope
- Continue operation unless `--strict-deps` flag set
- Include in JSON output under `warnings` field

### Destination Conflicts
- Block operation if destination exists
- Require explicit `--overwrite` flag
- Exit with code 3 (conflict)

### Large Files in View
- Detect files > 5MB and show summary instead
- Include size warning in output
- Skip preview but show file metadata

## Testing with Example Repository

The `example-repos/sw-example/` directory contains a fully configured Turborepo monorepo that can be used for testing the SW CLI implementation:

- **example-repos/sw-example/**: Single monorepo with apps and packages
  - Contains templates in `apps/` directory
  - Contains reusable packages in `packages/` directory
  - Tests dependency resolution with nested dependencies
  - Includes both apps and packages with proper `sw.json` metadata

To test the CLI during development:
```bash
# Set environment variable to point to example repo
export SW_ROOT="$(pwd)/example-repos/sw-example"

# Test commands
sw list
sw find "auth"
sw view templates/saas-starter
sw use templates/saas-starter --dry-run
```

## Implementation Phases

### Phase 1: Core Foundation & Basic Commands

#### Step 1.1: Project Setup & Configuration
**Goal**: Establish project structure and configuration loading

**Tasks**:
1. Initialize TypeScript project with strict mode
2. Set up Vitest configuration for testing
3. Implement Zod schemas for all configuration types
4. Build config loader with environment variable validation
5. Create error handling utilities with proper exit codes

**Tests**:
- Unit: Config schema validation with edge cases
- Unit: Environment variable parsing
- Unit: Missing config file handling
- Integration: Full config loading flow

**Deliverable**: CLI that validates config and exits gracefully

---

#### Step 1.2: Artifact Discovery & Indexing
**Goal**: Scan and index artifacts from both monorepos

**Tasks**:
1. Implement filesystem scanner for monorepo traversal
2. Parse and validate `sw.json` files with Zod
3. Build in-memory artifact index with slug mapping
4. Create artifact lookup utilities (by slug, ID, tags)
5. Handle malformed/missing metadata gracefully

**Tests**:
- Unit: `sw.json` parsing with invalid data
- Unit: Artifact index operations
- Integration: Full repo scanning with fixtures
- E2E: Error handling for missing repos

**Deliverable**: Core that can discover and index all artifacts

---

#### Step 1.3: List Command
**Goal**: Implement first user-facing command

**Tasks**:
1. Set up Commander.js CLI structure
2. Implement list command with filtering
3. Build output formatters (pretty & JSON)
4. Add pagination support (limit/offset)
5. Handle empty results gracefully

**Tests**:
- Unit: Filter logic (tags, text search)
- Integration: List with various filters
- E2E: Full command execution with real repos
- E2E: JSON output validation

**Deliverable**: Working `sw list` command

**Checkpoint**: Manual testing with real monorepos

---

#### Step 1.4: Pattern-Based Search Foundation
**Goal**: Build ripgrep integration for code search

**Tasks**:
1. Implement pattern parser (re:/, like:, exact:)
2. Build ripgrep command builder
3. Create JSON output parser for ripgrep
4. Implement streaming for large results
5. Add search result formatting

**Tests**:
- Unit: Pattern parsing logic
- Unit: Ripgrep argument building
- Integration: Search with mock ripgrep
- E2E: Real searches across fixtures

**Deliverable**: Search engine ready for find command

---

#### Step 1.5: Find Command
**Goal**: Complete search functionality

**Tasks**:
1. Wire up find command with search engine
2. Implement multi-filter support (code, meta, docs)
3. Add artifact-level filtering (tags, IDs)
4. Build context line extraction
5. Format search results (pretty & JSON)

**Tests**:
- Integration: Various search patterns
- Integration: Filter combinations
- E2E: Performance with large codebases
- E2E: No results handling

**Deliverable**: Working `sw find` command

**Checkpoint**: Performance testing with large repos

---

#### Step 1.6: View Renderer
**Goal**: Build preview generation system

**Tasks**:
1. Implement file content reader with line ranges
2. Build directory tree generator with depth limits
3. Create view resolver from `sw.json` specs
4. Implement override parser and merger
5. Add syntax highlighting for code previews

**Tests**:
- Unit: Line range extraction
- Unit: Tree generation with limits
- Integration: View resolution logic
- E2E: Various preview scenarios

**Deliverable**: Preview system for view command

---

#### Step 1.7: View Command
**Goal**: Complete artifact preview functionality

**Tasks**:
1. Wire up view command with renderer
2. Handle missing/invalid view specs
3. Implement fallback preview logic
4. Add large file detection and warnings
5. Format output (pretty & JSON)

**Tests**:
- Integration: Custom view specs
- Integration: Override combinations
- E2E: Large file handling
- E2E: Missing artifact handling

**Deliverable**: Working `sw view` command

**Checkpoint**: User experience review

---

### Phase 2: Dependency Resolution & Use Command

#### Step 2.1: Dependency Graph Builder
**Goal**: Build robust dependency resolution

**Tasks**:
1. Implement package.json parser for dependencies
2. Build internal/external classifier
3. Create dependency graph with cycle detection
4. Implement transitive resolution algorithm
5. Generate topological sort for copy order

**Tests**:
- Unit: Dependency classification
- Unit: Cycle detection algorithm
- Integration: Complex dependency trees
- Integration: Missing dependency handling

**Deliverable**: Full dependency resolver

---

#### Step 2.2: File Operations & Copy Engine
**Goal**: Implement reliable file copying

**Tasks**:
1. Build recursive copy with progress tracking
2. Implement conflict detection and reporting
3. Add permission preservation
4. Create atomic operations with rollback
5. Build dry-run simulation mode

**Tests**:
- Unit: Path resolution and validation
- Integration: Copy with conflicts
- Integration: Permission preservation
- E2E: Large file copying

**Deliverable**: Robust copy engine

---

#### Step 2.3: Package Manager Integration
**Goal**: Integrate with npm/pnpm/yarn

**Tasks**:
1. Implement package manager detection
2. Build install command execution
3. Add lockfile detection
4. Create installation validation
5. Handle install failures gracefully

**Tests**:
- Unit: Package manager detection
- Integration: Install command building
- E2E: Real installations
- E2E: Failure recovery

**Deliverable**: Package manager integration

---

#### Step 2.4: Use Command
**Goal**: Complete artifact usage functionality

**Tasks**:
1. Wire up use command with all components
2. Implement multi-phase execution (validate, analyze, copy, install)
3. Add comprehensive progress reporting
4. Build detailed error messages
5. Create next-steps suggestions

**Tests**:
- Integration: Full use flow with dependencies
- Integration: Conflict scenarios
- E2E: Real template usage
- E2E: Installation validation

**Deliverable**: Working `sw use` command

**Checkpoint**: Full workflow testing

---

#### Step 2.5: Polish & Documentation
**Goal**: Production readiness

**Tasks**:
1. Add comprehensive error messages
2. Implement debug logging mode
3. Create help text for all commands
4. Write CLI documentation
5. Add performance optimizations

**Tests**:
- E2E: Error message clarity
- E2E: Help text completeness
- Performance: Large repo handling
- Performance: Memory usage

**Deliverable**: Production-ready CLI

---

#### Step 2.6: Final Testing & Release
**Goal**: Ensure quality and ship

**Tasks**:
1. Run full test suite
2. Manual testing of all workflows
3. Performance profiling
4. Create release artifacts
5. Write release notes

**Tests**:
- Full regression suite
- Cross-platform testing
- Real-world usage scenarios
- Load testing

**Deliverable**: Released v1.0

## Performance Considerations

- **Indexing**: Build artifact index once per session, cache in memory
- **Search**: Leverage ripgrep's performance, limit search scope early
- **Copy**: Use native filesystem operations, batch small files
- **Symlinks**: Validate targets exist before creating links

## Security Considerations

- **Path validation**: Prevent directory traversal attacks
- **Symlink targets**: Verify targets are within allowed roots
- **Command injection**: Never pass user input directly to shell
- **File permissions**: Preserve original permissions on copy

## Compatibility
- **Package Managers**: pnpm workspaces + bun
- **Monorepo Tools**: Turborepo-compatible structure

CLI should be written in TypeScript.