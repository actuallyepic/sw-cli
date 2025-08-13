# SW CLI Guide

The CLI is built for local, fast, zero-drama reuse. It helps you find, preview, and adopt artifacts into your current workspace—pulling along internal dependencies automatically and leaving external packages to your package manager.

**When to reach for sw:**

- You want a starter (template) to bootstrap a new app
- You want to reuse an existing package (design system, auth, utils)

## Creating sw.json Files

### Philosophy

The `sw.json` file is your artifact's resume. It should provide enough information that developers can understand what your artifact does, how it fits into their stack, and what they're committing to before they copy it.

### Location Requirements

- **Templates**: `$SW_ROOT/apps/<template-name>/sw.json`
- **Packages**: `$SW_ROOT/packages/<package-name>/sw.json`
- Must coexist with `package.json` in the artifact's root directory

### Schema & Best Practices

```json
{
  "type": "template",
  "slug": "saas-starter",
  "name": "Production SaaS Starter",
  "description": "Full-featured SaaS template with multi-tenant auth, Stripe billing, admin dashboard, and email workflows. Built on Next.js 14 with App Router, Tailwind CSS, and PostgreSQL. Includes CI/CD setup and monitoring.",
  "tags": [
    "saas",
    "nextjs",
    "stripe",
    "postgresql",
    "multi-tenant",
    "production"
  ],
  "requiredEnv": [
    {
      "name": "DATABASE_URL",
      "description": "PostgreSQL connection string for main database",
      "example": "postgresql://user:pass@localhost:5432/myapp"
    }
  ],
  "view": [
    { "path": "README.md", "lines": "all" },
    { "path": "src/app/page.tsx", "lines": [1, 100] },
    { "path": "src/lib/auth/provider.tsx", "lines": [1, 80] },
    { "tree": { "path": "src", "depth": 3, "limit": 50 } },
    { "path": "package.json", "lines": [1, 40] }
  ]
}
```

### Field Guidelines

**`description`** - Write 2-3 sentences that answer:

- What does this solve?
- What stack/technologies does it use?
- What makes it distinctive?

Bad: "Auth package"
Good: "Type-safe authentication package with JWT refresh tokens, OAuth providers (Google, GitHub), and React hooks. Includes session management, permission guards, and automatic token renewal."

**`tags`** - Include:

- Technology tags: `nextjs`, `react`, `vue`, `typescript`...
- Domain tags: `auth`, `billing`, `analytics`, `cms`...
- Architecture tags: `microservice`, `monolithic`, `serverless`...
- Maturity tags: `production`, `experimental`, `deprecated`...

Feel free to add other tags that you think are relevant.

**`view`** - Design for standalone understanding:

```json
"view": [
  // 1. Always include README for overview
  { "path": "README.md", "lines": [1, 150] },

  // 2. Show structure with a tree
  { "tree": { "path": "src", "depth": 3, "limit": 100 } },

  // 3. Show the main entry point or API surface
  { "path": "src/index.ts", "lines": "all" },

  // 4. Include a key implementation file
  { "path": "src/core/handler.ts", "lines": [1, 100] },
]
```

**Goal**: Someone should be able to understand 80% of your artifact's implementation from the view alone.

### Examples of Well-Documented Artifacts

**Rich Template Example:**

```json
{
  "type": "template",
  "slug": "marketplace-platform",
  "name": "Multi-Vendor Marketplace Platform",
  "description": "Complete marketplace with vendor onboarding, product catalog, cart/checkout, payment splitting, and admin controls. Features real-time inventory, review system, and shipping integrations. Built with Next.js, tRPC, Prisma, and Stripe Connect.",
  "tags": [
    "marketplace",
    "ecommerce",
    "multi-vendor",
    "stripe-connect",
    "nextjs",
    "trpc",
    "prisma",
    "postgresql",
    "production"
  ],
  "requiredEnv": [
    {
      "name": "DATABASE_URL",
      "description": "PostgreSQL database for all application data",
      "example": "postgresql://user:pass@localhost:5432/marketplace"
    },
    {
      "name": "STRIPE_SECRET_KEY",
      "description": "Stripe secret key with Connect capabilities enabled",
      "example": "sk_live_..."
    },
    {
      "name": "STRIPE_CONNECT_WEBHOOK_SECRET",
      "description": "Webhook secret for Stripe Connect events",
      "example": "whsec_..."
    }
  ],
  "view": [
    { "path": "README.md", "lines": "all" },
    { "tree": { "path": "src", "depth": 3, "limit": 150 } },
    { "path": "docs/ARCHITECTURE.md", "lines": [1, 200] },
    { "path": "src/server/api/root.ts", "lines": "all" },
    { "path": "src/pages/api/webhooks/stripe.ts", "lines": [1, 150] },
    { "path": "prisma/schema.prisma", "lines": [1, 100] }
  ]
}
```

**Detailed Package Example:**

```json
{
  "type": "package",
  "slug": "feature-flags",
  "name": "Feature Flag System",
  "description": "Runtime feature flag system with React hooks, HOCs, and server-side utilities. Supports percentage rollouts, user targeting, A/B tests, and flag prerequisites. Integrates with LaunchDarkly, Split.io, or uses local JSON config.",
  "tags": [
    "feature-flags",
    "experimentation",
    "ab-testing",
    "react",
    "typescript",
    "launchdarkly",
    "split"
  ],
  "view": [
    { "path": "README.md", "lines": "all" },
    { "tree": { "path": "src", "depth": 4, "limit": 100 } },
    { "path": "src/index.ts", "lines": "all" },
    { "path": "src/react/FeatureFlag.tsx", "lines": "all" },
    { "path": "src/providers/launchdarkly.ts", "lines": [1, 100] },
    { "path": "examples/basic-usage.tsx", "lines": "all" }
  ]
}
```

## Core Commands at a Glance

### 1. Discover

**List everything (or narrow by scope):**

```bash
sw list                    # all artifacts
sw list templates          # only templates
sw list packages           # only packages
```

**Useful switches:**

- `--filter-tag <tag>` filter by tag(s)
- `--filter-text "<text>"` case-insensitive substring over name/desc/tags
- `--limit <n> --offset <n>` simple paging
- `--long` adds version and required env names
- `--paths` shows absolute source paths
- `--quiet` slugs only (great for scripting)
- `--json` machine-readable output

**Search code + metadata (fast):**

```bash
sw find "like:{stripe}"              # substring match
sw find "re:/async\\s+function/"     # regex
sw find "exact:AuthProvider"         # exact match
```

**Scoping and filters:**

- `--scope templates|packages`
- `--filter code|meta|docs|tests` (repeatable)
- `--lang ts|js|py|go|rust` or `--ext ts --ext tsx`
- `--path "src/**" --path "!**/*.test.ts"` glob includes/excludes

**Matching controls:**

- `--case-insensitive`, `--word`, `--context <N>`, `--files-only`, `--max-matches <n>`
- `--json` for structured hits (file, line, snippet)

> **Tip:** Search is extremely fast; use it like `rg` but scoped to reusable artifacts.

### 2. Preview

**View a curated preview (from sw.json):**

```bash
sw view templates/saas-starter
sw view packages/auth-ui
```

**Inspect specific files:**

```bash
# View entire file
sw view packages/auth-ui --override src/index.ts

# View specific line range
sw view packages/auth-ui --override "src/components/LoginForm.tsx:1-80"

# View multiple files
sw view packages/ui --override src/Button.tsx --override src/Modal.tsx

# View directory tree
sw view packages/database --override tree:prisma
sw view packages/database --override tree:src:3:100  # depth:3, limit:100

# Combine multiple overrides for deep inspection
sw view templates/blog \
  --override src/pages/api/posts.ts \
  --override "src/lib/markdown.ts:1-50" \
  --override tree:src/components:2:50
```

**JSON output for tooling:**

```bash
sw view packages/logger --json | jq '.sections[].path'
```

> **Pro tip:** Use view to understand key unlocks or patterns if you do not want to copy. This is particularly helpful for finding reference or potential bug fixes.

### 3. Adopt

**Copy an artifact (and its internal dependencies) into your workspace:**

```bash
sw use templates/saas-starter     # copies to ./apps/saas-starter
sw use packages/auth-ui           # copies to ./packages/auth-ui
```

**Controls:**

- `--dry-run` show the plan without copying
- `--into apps|packages` override destination root
- `--as <name>` rename destination folder (not package.json name)
- `--overwrite` replace existing destination
- `--no-install` skip package installation
- `--pm pnpm|npm|yarn|bun` override package manager
- `--print-next` show suggested next steps
- `--json` emit operation report

**Behavioral guarantees:**

- Internal dependencies (`@repo/*`) are automatically resolved and copied
- External dependencies remain in package.json for your package manager
- Required environment variables are prominently displayed
- Conflicts block operation unless `--overwrite` is passed
- Identical packages (by hash) are automatically skipped
- Package name conflicts are detected and reported

## Practical Recipes

### Find a starter and try it quickly

```bash
sw list templates --filter-tag nextjs --long
sw view templates/saas-starter
sw view templates/saas-starter --override src/app/layout.tsx #optional 
sw use templates/saas-starter
```

### Deep dive into a package before adopting

```bash
# Find the package
sw list packages --filter-tag auth

# Inspect its complete structure
sw view packages/auth-ui --override tree:src:5:200

# Read the main exports
sw view packages/auth-ui --override src/index.ts

# Check a key component
sw view packages/auth-ui --override src/components/AuthProvider.tsx

# Review the tests to understand usage
sw view packages/auth-ui --override "tests/auth.test.ts:1-100"

# If satisfied, adopt it
sw use packages/auth-ui
```

### Surgical code search across reusable artifacts

```bash
# Find all Stripe webhook handlers
sw find "re:/stripe\.webhooks\.constructEvent/" --scope templates --context 5

# Find all tRPC routers
sw find "exact:createTRPCRouter" --lang ts --files-only

# Find all database migrations
sw find "like:{migration}" --path "**/migrations/**" --ext sql
```

### Understand an artifact's complete implementation

```bash
# Get everything you need to try and fix an auth issue in your current implementation
sw view packages/auth-ui \
  --override README.md \
  --override src/index.ts \
  --override "src/hooks/useAuth.ts:1-200" \
  --override "src/providers/AuthProvider.tsx:1-300"
```

## Guardrails & Gotchas

**Name & slug discipline:** Your sw.json slug must equal the folder name

**Search prerequisites:** Fast search requires ripgrep (`rg`) in your shell

**Package name conflicts:** The CLI detects duplicate package.json names and blocks copying

**Hash-based deduplication:** Identical packages are skipped automatically

## Mental Model: When to Use Which Command

**"I want to browse"** → `sw list`

**"I want to understand how it works or learn from it"** → `sw view` with `--override`

**"I want to find specific code patterns"** → `sw find`

**"I'm ready to adopt it"** → `sw use` 