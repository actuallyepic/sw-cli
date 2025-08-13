import { z } from 'zod';
import chalk from 'chalk';
import { join } from 'path';
import { existsSync } from 'fs';
import { loadConfig } from '../../core/config/config.loader';
import { ArtifactScanner } from '../../core/artifact/artifact.scanner';
import { DependencyResolver } from '../../core/dependency/dependency.resolver';
import { copyDirectory, CopyResult } from '../../lib/fs/fs.copy';
import { detectPackageManager, runInstall, PackageManager } from '../../lib/process/process.pm';

const UseOptionsSchema = z.object({
  into: z.enum(['apps', 'packages']).optional(),
  as: z.string().optional(),
  overwrite: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  noInstall: z.boolean().default(false),
  pm: z.enum(['pnpm', 'npm', 'yarn', 'bun']).optional(),
  printNext: z.boolean().default(false),
  json: z.boolean().default(false),
});

interface UseResult {
  artifact: {
    slug: string;
    id: string;
    type: string;
  };
  destination: {
    path: string;
    action: string;
  };
  internalDeps: Array<{
    name: string;
    id: string;
    source: string;
    dest: string;
    action: string;
  }>;
  externalDeps: string[];
  installed: boolean;
  packageManager?: string;
  nextSteps?: string[];
}

export async function handleUse(slug: string, options: unknown): Promise<void> {
  // Validate options
  const opts = UseOptionsSchema.parse(options);
  
  // Validate slug format
  if (!slug.includes('/')) {
    throw new Error(`Invalid slug format: ${slug}. Expected format: templates/<id> or packages/<id>`);
  }
  
  // Load config and scan artifacts
  const config = await loadConfig();
  const scanner = new ArtifactScanner(config);
  
  // Scan to populate cache
  await scanner.scanArtifacts();
  
  // Find the artifact
  const artifact = scanner.getArtifactBySlug(slug);
  
  if (!artifact) {
    throw new Error(`Artifact not found: ${slug}`);
  }
  
  // Determine destination directory
  const destDir = opts.into || (artifact.type === 'template' ? 'apps' : 'packages');
  const destName = opts.as || artifact.id;
  const destPath = join(process.cwd(), destDir, destName);
  
  // Check for conflicts
  if (!opts.dryRun && !opts.overwrite && existsSync(destPath)) {
    throw new Error(`Destination already exists: ${destPath}\nUse --overwrite to replace it.`);
  }
  
  // Resolve dependencies
  if (!opts.json && !opts.dryRun) {
    console.log(chalk.cyan('Resolving dependencies...'));
  }
  
  const resolver = new DependencyResolver(config, scanner);
  const depGraph = await resolver.resolve(artifact);
  const internalDeps = resolver.getInternalDependencies(depGraph);
  const externalDeps = resolver.getExternalDependencies(depGraph);
  
  // Plan the operation
  const copyPlan: Array<{ source: string; destination: string; artifact: any }> = [];
  
  // Add main artifact
  copyPlan.push({
    source: artifact.absPath,
    destination: destPath,
    artifact: artifact,
  });
  
  // Add internal dependencies
  for (const dep of internalDeps) {
    const depDestPath = join(process.cwd(), 'packages', dep.id);
    copyPlan.push({
      source: dep.absPath,
      destination: depDestPath,
      artifact: dep,
    });
  }
  
  // Display plan in dry-run mode
  if (opts.dryRun) {
    console.log(chalk.bold('\nDry Run - Would perform the following operations:\n'));
    
    console.log(chalk.cyan('Copy artifacts:'));
    for (const { source, destination } of copyPlan) {
      console.log(`  ${source}\n  → ${destination}`);
    }
    
    if (internalDeps.length > 0) {
      console.log(chalk.cyan('\nInternal dependencies:'));
      for (const dep of internalDeps) {
        console.log(`  • ${dep.sw.name} (${dep.slug})`);
      }
    }
    
    if (externalDeps.length > 0) {
      console.log(chalk.cyan('\nExternal dependencies:'));
      for (const dep of externalDeps) {
        console.log(`  • ${dep}`);
      }
    }
    
    return;
  }
  
  // Execute the copy operations
  if (!opts.json) {
    console.log(chalk.cyan('\nCopying artifacts...'));
  }
  
  const copyResults: CopyResult[] = [];
  
  for (const { source, destination } of copyPlan) {
    const result = await copyDirectory(source, destination, {
      overwrite: opts.overwrite,
      verbose: !opts.json,
    });
    
    if (result.error) {
      throw new Error(`Failed to copy ${source}: ${result.error}`);
    }
    
    copyResults.push(result);
  }
  
  // Run package manager install
  let installed = false;
  let packageManager: PackageManager | null = null;
  
  if (!opts.noInstall) {
    // Detect package manager
    packageManager = opts.pm || detectPackageManager(process.cwd()) || config.user.defaultPackageManager as PackageManager;
    
    if (!opts.json) {
      console.log(chalk.cyan(`\nInstalling dependencies with ${packageManager}...`));
    }
    
    installed = await runInstall(process.cwd(), packageManager, !opts.json);
    
    if (!installed && !opts.json) {
      console.log(chalk.yellow('Warning: Package installation failed'));
    }
  }
  
  // Build result
  const result: UseResult = {
    artifact: {
      slug: artifact.slug,
      id: artifact.id,
      type: artifact.type,
    },
    destination: {
      path: destPath,
      action: copyResults[0].action,
    },
    internalDeps: internalDeps.map((dep, i) => ({
      name: dep.packageJson.name as string || dep.id,
      id: dep.id,
      source: dep.absPath,
      dest: copyResults[i + 1]?.destination || '',
      action: copyResults[i + 1]?.action || '',
    })),
    externalDeps,
    installed,
    packageManager: packageManager || undefined,
  };
  
  // Generate next steps
  if (artifact.type === 'template') {
    result.nextSteps = [];
    
    // Check for dev script
    if (artifact.packageJson.scripts && (artifact.packageJson.scripts as any).dev) {
      result.nextSteps.push(`cd ${destDir}/${destName} && ${packageManager} run dev`);
    }
    
    // Add environment variables reminder
    if (artifact.sw.requiredEnv.length > 0) {
      result.nextSteps.push('Set up required environment variables (see .env.example)');
    }
  }
  
  // Output results
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(chalk.green.bold('\n✅ Success!\n'));
    
    console.log(chalk.bold('Copied:'));
    console.log(`  • ${artifact.sw.name} → ${destPath}`);
    
    if (internalDeps.length > 0) {
      console.log(chalk.bold('\nInternal dependencies copied:'));
      for (const dep of result.internalDeps) {
        console.log(`  • ${dep.name} → ${dep.dest}`);
      }
    }
    
    if (artifact.sw.requiredEnv.length > 0) {
      console.log(chalk.yellow.bold('\n⚠️  Required Environment Variables:'));
      for (const env of artifact.sw.requiredEnv) {
        console.log(`  • ${chalk.bold(env.name)}: ${env.description}`);
        if (env.example) {
          console.log(`    Example: ${chalk.dim(env.example)}`);
        }
      }
    }
    
    if (opts.printNext && result.nextSteps && result.nextSteps.length > 0) {
      console.log(chalk.cyan.bold('\n📝 Next Steps:'));
      result.nextSteps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step}`);
      });
    }
  }
}