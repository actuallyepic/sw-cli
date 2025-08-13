import { z } from 'zod';
import chalk from 'chalk';
import { loadConfig } from '../../core/config/config.loader';
import { SearchEngine, SearchHit } from '../../core/search/search.engine';
import { ArtifactScanner } from '../../core/artifact/artifact.scanner';

const FindOptionsSchema = z.object({
  filter: z.array(z.string()).optional(),
  scope: z.enum(['templates', 'packages']).optional(),
  path: z.array(z.string()).optional(),
  ext: z.array(z.string()).optional(),
  lang: z.string().optional(),
  tag: z.array(z.string()).optional(),
  id: z.array(z.string()).optional(),
  caseInsensitive: z.boolean().default(false),
  word: z.boolean().default(false),
  context: z.number().optional(),
  filesOnly: z.boolean().default(false),
  maxMatches: z.number().optional(),
  json: z.boolean().default(false),
});

export async function handleFind(pattern: string, options: unknown): Promise<void> {
  // Validate options
  const opts = FindOptionsSchema.parse(options);
  
  // Load config
  const config = await loadConfig();
  
  // If filtering by tags or IDs, we need to scan artifacts first
  let artifactFilter: Set<string> | undefined;
  if (opts.tag || opts.id) {
    const scanner = new ArtifactScanner(config);
    const artifacts = await scanner.scanArtifacts(opts.scope);
    
    artifactFilter = new Set<string>();
    
    for (const artifact of artifacts) {
      let include = true;
      
      // Filter by tags
      if (opts.tag && opts.tag.length > 0) {
        include = opts.tag.some(tag => artifact.sw.tags.includes(tag));
      }
      
      // Filter by ID
      if (include && opts.id && opts.id.length > 0) {
        include = opts.id.some(id => {
          // Support glob patterns
          if (id.includes('*')) {
            const regex = new RegExp('^' + id.replace(/\*/g, '.*') + '$');
            return regex.test(artifact.id);
          }
          return artifact.id === id;
        });
      }
      
      if (include) {
        artifactFilter.add(artifact.absPath);
      }
    }
  }
  
  // Perform search
  const searchEngine = new SearchEngine(config);
  const hits = await searchEngine.search(pattern, opts);
  
  // Filter by artifact if needed
  const filteredHits = artifactFilter 
    ? hits.filter(hit => {
        return Array.from(artifactFilter).some(path => hit.file.startsWith(path));
      })
    : hits;
  
  // Output results
  if (opts.json) {
    console.log(JSON.stringify(filteredHits, null, 2));
  } else {
    formatPrettyOutput(filteredHits, opts);
  }
}

function formatPrettyOutput(hits: SearchHit[], options: any): void {
  if (hits.length === 0) {
    console.log(chalk.yellow('No matches found'));
    return;
  }
  
  console.log(chalk.bold(`\nFound ${hits.length} match${hits.length === 1 ? '' : 'es'}:\n`));
  
  // Group by artifact
  const byArtifact = new Map<string, SearchHit[]>();
  
  for (const hit of hits) {
    const key = hit.artifact?.slug || 'unknown';
    if (!byArtifact.has(key)) {
      byArtifact.set(key, []);
    }
    byArtifact.get(key)!.push(hit);
  }
  
  // Display grouped results
  for (const [artifactSlug, artifactHits] of byArtifact) {
    if (artifactSlug !== 'unknown') {
      console.log(chalk.cyan.bold(`📦 ${artifactSlug}`));
    }
    
    for (const hit of artifactHits) {
      const relativePath = hit.file.split('/').slice(-3).join('/');
      
      if (options.filesOnly) {
        console.log(`  ${chalk.green(relativePath)}`);
      } else {
        console.log(`  ${chalk.green(relativePath)}${hit.line ? chalk.dim(`:${hit.line}`) : ''}`);
        
        if (hit.match) {
          const trimmed = hit.match.trim();
          if (trimmed) {
            console.log(`    ${chalk.dim('│')} ${trimmed.slice(0, 100)}`);
          }
        }
      }
    }
    
    console.log();
  }
}