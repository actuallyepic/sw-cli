import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { SwJsonSchema, Artifact } from '../config/config.schema';
import { Config } from '../config/config.loader';

export type ArtifactScope = 'templates' | 'packages' | 'all';

export class ArtifactScanner {
  private artifactCache = new Map<string, Artifact>();

  constructor(private config: Config) {}

  async scanArtifacts(scope?: ArtifactScope): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];
    const rootPath = this.config.env.SW_ROOT;

    if (scope === 'templates' || scope === 'all' || !scope) {
      const appsPath = join(rootPath, 'apps');
      if (existsSync(appsPath)) {
        const apps = await this.scanDirectory(appsPath, 'template');
        artifacts.push(...apps);
      }
    }

    if (scope === 'packages' || scope === 'all' || !scope) {
      const packagesPath = join(rootPath, 'packages');
      if (existsSync(packagesPath)) {
        const packages = await this.scanDirectory(packagesPath, 'package');
        artifacts.push(...packages);
      }
    }

    return artifacts;
  }

  private async scanDirectory(
    dirPath: string,
    defaultType: 'template' | 'package'
  ): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];
    
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const artifactPath = join(dirPath, entry.name);
        const swJsonPath = join(artifactPath, 'sw.json');
        
        // Check if sw.json exists
        if (!existsSync(swJsonPath)) continue;
        
        try {
          // Load and parse sw.json
          const swJsonContent = await readFile(swJsonPath, 'utf-8');
          const swJson = SwJsonSchema.parse(JSON.parse(swJsonContent));
          
          // Load package.json
          const packageJsonPath = join(artifactPath, 'package.json');
          let packageJson = {};
          if (existsSync(packageJsonPath)) {
            const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
            packageJson = JSON.parse(packageJsonContent);
          }
          
          // Create artifact object
          const artifactType = swJson.type || defaultType;
          const prefix = artifactType === 'template' ? 'templates' : 'packages';
          const artifact: Artifact = {
            slug: `${prefix}/${swJson.slug}`,
            id: swJson.slug,
            type: artifactType,
            relPath: artifactPath.replace(this.config.env.SW_ROOT, '').replace(/^\//, ''),
            absPath: artifactPath,
            sw: swJson,
            packageJson,
          };
          
          artifacts.push(artifact);
          this.artifactCache.set(artifact.slug, artifact);
        } catch (error) {
          // Log error but continue scanning
          if (process.env.DEBUG === 'true') {
            console.error(`Failed to parse artifact at ${artifactPath}:`, error);
          }
        }
      }
    } catch (error) {
      // Log error but continue
      if (process.env.DEBUG === 'true') {
        console.error(`Failed to scan directory ${dirPath}:`, error);
      }
    }
    
    return artifacts;
  }


  getArtifactBySlug(slug: string): Artifact | undefined {
    return this.artifactCache.get(slug);
  }

  clearCache(): void {
    this.artifactCache.clear();
  }

  // Scan ALL packages for dependency resolution
  async scanAllPackagesForDependencies(): Promise<Artifact[]> {
    const packagesPath = join(this.config.env.SW_ROOT, 'packages');
    if (existsSync(packagesPath)) {
      return await this.scanDirectory(packagesPath, 'package');
    }
    return [];
  }
}