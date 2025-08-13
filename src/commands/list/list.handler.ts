import { z } from 'zod';
import chalk from 'chalk';
import { loadConfig } from '../../core/config/config.loader';
import { ArtifactScanner, RepoScope } from '../../core/artifact/artifact.scanner';

const ListOptionsSchema = z.object({
  filterTag: z.array(z.string()).optional(),
  filterText: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  json: z.boolean().default(false),
  long: z.boolean().default(false),
  paths: z.boolean().default(false),
  quiet: z.boolean().default(false),
});


export async function handleList(scope: string, options: unknown): Promise<void> {
  // Validate scope
  const validScopes: RepoScope[] = ['templates', 'packages', 'all'];
  if (!validScopes.includes(scope as RepoScope)) {
    throw new Error(`Invalid scope: ${scope}. Must be one of: ${validScopes.join(', ')}`);
  }

  // Validate options
  const opts = ListOptionsSchema.parse(options);

  // Load config and scan artifacts
  const config = await loadConfig();
  const scanner = new ArtifactScanner(config);
  const artifacts = await scanner.scanArtifacts(scope as RepoScope);

  // Apply filters
  let filtered = artifacts;

  // Filter by tags
  if (opts.filterTag && opts.filterTag.length > 0) {
    filtered = filtered.filter(artifact => 
      opts.filterTag!.some(tag => artifact.sw.tags.includes(tag))
    );
  }

  // Filter by text
  if (opts.filterText) {
    const searchText = opts.filterText.toLowerCase();
    filtered = filtered.filter(artifact => {
      const searchableText = [
        artifact.slug,
        artifact.sw.name,
        artifact.sw.description || '',
        ...artifact.sw.tags
      ].join(' ').toLowerCase();
      return searchableText.includes(searchText);
    });
  }

  // Apply pagination
  if (opts.offset) {
    filtered = filtered.slice(opts.offset);
  }
  if (opts.limit) {
    filtered = filtered.slice(0, opts.limit);
  }

  // Output results
  if (opts.quiet) {
    filtered.forEach(artifact => console.log(artifact.slug));
  } else if (opts.json) {
    const output = filtered.map(artifact => ({
      slug: artifact.slug,
      id: artifact.id,
      type: artifact.type,
      name: artifact.sw.name,
      description: artifact.sw.description,
      tags: artifact.sw.tags,
      ...(opts.paths && {
        relPath: artifact.relPath,
        absPath: artifact.absPath,
      }),
      ...(opts.long && {
        requiredEnv: artifact.sw.requiredEnv,
        packageName: artifact.packageJson.name,
        version: artifact.packageJson.version,
      }),
    }));
    console.log(JSON.stringify(output, null, 2));
  } else {
    // Pretty print
    if (filtered.length === 0) {
      console.log(chalk.yellow('No artifacts found'));
      return;
    }

    console.log(chalk.bold(`\nFound ${filtered.length} artifact${filtered.length === 1 ? '' : 's'}:\n`));

    for (const artifact of filtered) {
      console.log(chalk.cyan(artifact.slug));
      console.log(`  ${chalk.bold(artifact.sw.name)}`);
      
      if (artifact.sw.description) {
        console.log(`  ${artifact.sw.description}`);
      }
      
      if (artifact.sw.tags.length > 0) {
        console.log(`  ${chalk.dim('Tags:')} ${artifact.sw.tags.map(t => chalk.green(t)).join(', ')}`);
      }

      if (opts.long) {
        if (artifact.packageJson.version) {
          console.log(`  ${chalk.dim('Version:')} ${artifact.packageJson.version}`);
        }
        if (artifact.sw.requiredEnv.length > 0) {
          console.log(`  ${chalk.dim('Required env:')} ${artifact.sw.requiredEnv.map(e => e.name).join(', ')}`);
        }
      }

      if (opts.paths) {
        console.log(`  ${chalk.dim('Path:')} ${artifact.absPath}`);
      }

      console.log();
    }
  }
}