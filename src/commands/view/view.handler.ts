import { z } from 'zod';
import chalk from 'chalk';
import { loadConfig } from '../../core/config/config.loader';
import { ArtifactScanner } from '../../core/artifact/artifact.scanner';
import { renderArtifactView, formatViewSections } from './view.renderer';

const ViewOptionsSchema = z.object({
  override: z.array(z.string()).optional(),
  json: z.boolean().default(false),
});

export async function handleView(slug: string, options: unknown): Promise<void> {
  // Validate options
  const opts = ViewOptionsSchema.parse(options);
  
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
  
  // Render the view
  const sections = await renderArtifactView(artifact, opts.override || []);
  
  // Output
  if (!opts.json) {
    // Print artifact header
    console.log();
    console.log(chalk.bold.green(artifact.slug));
    console.log(chalk.bold(artifact.sw.name));
    
    if (artifact.sw.description) {
      console.log(artifact.sw.description);
    }
    
    if (artifact.sw.tags.length > 0) {
      console.log(chalk.dim('Tags:'), artifact.sw.tags.map(t => chalk.green(t)).join(', '));
    }
    
    if (artifact.sw.requiredEnv.length > 0) {
      console.log();
      console.log(chalk.yellow('Required Environment Variables:'));
      for (const env of artifact.sw.requiredEnv) {
        console.log(`  • ${chalk.bold(env.name)}: ${env.description}`);
        if (env.example) {
          console.log(`    ${chalk.dim('Example:')} ${env.example}`);
        }
      }
    }
  }
  
  // Format and output sections
  const formatted = formatViewSections(sections, opts.json);
  console.log(formatted);
}