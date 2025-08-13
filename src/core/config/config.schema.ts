import { z } from 'zod';

// Environment variable schema
export const EnvConfigSchema = z.object({
  SW_TEMPLATES_ROOT: z.string().min(1),
  SW_PACKAGES_ROOT: z.string().min(1),
});

// User config schema (~/.swrc.json)
export const UserConfigSchema = z.object({
  internalScopes: z.array(z.string()).default(['@repo']),
  defaultPackageManager: z.enum(['pnpm', 'npm', 'yarn', 'bun']).default('pnpm'),
  preview: z.object({
    defaultLines: z.number().positive().default(80),
  }).default({ defaultLines: 80 }),
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
        z.tuple([z.number().positive(), z.number().positive()]),
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
  repo: z.enum(['templates', 'packages']),
  relPath: z.string(),
  absPath: z.string(),
  sw: SwJsonSchema,
  packageJson: z.record(z.string(), z.unknown()), // Lazy parse
});

export type Artifact = z.infer<typeof ArtifactSchema>;