# SW CLI Guide

## Creating sw.json Files

### Location Requirements
- **Templates**: Place in `$SW_ROOT/apps/<template-name>/sw.json`
- **Packages**: Place in `$SW_ROOT/packages/<package-name>/sw.json`
- Must be valid JSON in the artifact's root directory alongside `package.json`

### Required Fields
```json
{
  "type": "template" | "package",
  "slug": "artifact-id",
  "name": "Human Readable Name",
  "description": "Brief description (optional)",
  "tags": ["tag1", "tag2"],
  "requiredEnv": [...],
  "view": [...]
}
```

### Field Specifications

**type**: `"template"` for apps/, `"package"` for packages/

**slug**: Unique identifier matching directory name (alphanumeric + hyphens)

**tags**: Array for categorization/filtering. Common: `["auth", "ui", "database", "api", "nextjs", "react"]`

**requiredEnv** (templates only):
```json
"requiredEnv": [
  {
    "name": "DATABASE_URL",
    "description": "PostgreSQL connection string",
    "example": "postgresql://user:pass@localhost:5432/db"
  }
]
```

**view** (optional): Curated preview sections
```json
"view": [
  { "path": "README.md", "lines": "all" },
  { "path": "src/index.ts", "lines": [1, 50] },
  { "tree": { "path": "src", "depth": 2, "limit": 30 } }
]
```

### Examples

**Template** (`apps/saas-starter/sw.json`):
```json
{
  "type": "template",
  "slug": "saas-starter",
  "name": "SaaS Starter",
  "description": "Production SaaS with auth & billing",
  "tags": ["saas", "stripe", "auth"],
  "requiredEnv": [
    {
      "name": "STRIPE_KEY",
      "description": "Stripe API key",
      "example": "sk_test_..."
    }
  ],
  "view": [
    { "path": "README.md", "lines": "all" }
  ]
}
```

**Package** (`packages/auth-ui/sw.json`):
```json
{
  "type": "package",
  "slug": "auth-ui",
  "name": "Auth Components",
  "description": "Reusable auth UI",
  "tags": ["auth", "ui", "react"]
}
```

## Using the SW CLI

### Discovery Commands

**List artifacts**
```bash
sw list                    # All artifacts
sw list templates          # Templates only
sw list packages           # Packages only
sw list --filter-tag auth  # By tag
sw list --filter-text ui   # By text search
sw list --json            # Machine-readable
sw list --quiet           # Slugs only
```

**Search code**
```bash
sw find "stripe"                      # Text search
sw find "async\s+function"            # Regex
sw find "AUTH" --case-insensitive     # Case-insensitive
sw find "import" --files-only         # List files only
sw find "TODO" --context 2            # Show context lines
sw find "api" --lang ts               # TypeScript only
sw find "db" --scope packages         # Search packages only
```

### Inspection Commands

**Preview artifacts**
```bash
sw view templates/saas-starter                          # Default preview
sw view packages/ui --override src/Button.tsx           # Add file to preview
sw view packages/database --override tree:prisma:3:100  # Show directory tree
sw view templates/blog --json                           # JSON output
```

### Usage Commands

**Copy to workspace**
```bash
sw use templates/saas-starter              # Copy template + all deps
sw use packages/logger                     # Copy single package
sw use templates/blog --as my-blog         # Rename on copy
sw use packages/ui --no-install            # Skip npm/pnpm install
sw use templates/api --dry-run             # Preview operation
sw use templates/shop --overwrite          # Replace existing
sw use packages/auth --into packages       # Explicit destination
sw use templates/app --json                # JSON result
```

### Common Workflows

**Starting new project**:
```bash
sw list templates --filter-tag nextjs     # Find Next.js templates
sw view templates/saas-starter            # Preview template
sw use templates/saas-starter             # Copy with dependencies
```

**Adding package to existing project**:
```bash
sw find "authentication" --scope packages # Find auth packages
sw view packages/auth-ui                  # Check implementation
sw use packages/auth-ui                   # Add to project
```

**Exploring codebase**:
```bash
sw find "stripe.prices"                   # Find Stripe usage
sw find "TODO|FIXME"                      # Find todos
sw find "import.*@repo"                   # Find internal imports
```

**Dependency inspection**:
```bash
sw use templates/complex --dry-run        # See all dependencies
sw view packages/core --json | jq '.dependencies'  # Check deps
```

### Key Concepts

**Slugs**: Always `templates/<id>` or `packages/<id>` format

**Dependencies**: Automatically resolves & copies internal deps (`@repo/*`)

**Conflicts**: Use `--overwrite` or rename with `--as`

**Workspaces**: Copies to `./apps/` (templates) or `./packages/` (packages)

**Environment**: Set `SW_ROOT=/path/to/monorepo` before using

### Performance Tips

- Use `--limit` for large result sets
- Use `--scope` to narrow searches
- Use `--quiet` for scripting
- Use `--json` for programmatic access
- Cache artifact index persists per session