import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { SwJsonSchema, Artifact } from '../config/config.schema';
import { Config } from '../config/config.loader';

export type RepoScope = 'templates' | 'packages' | 'all';

export class ArtifactScanner {
  private artifactCache = new Map<string, Artifact>();

  constructor(private config: Config) {}

  async scanArtifacts(scope?: RepoScope): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];

    if (scope === 'templates' || scope === 'all' || !scope) {
      const templateArtifacts = await this.scanRepository('templates', this.config.env.SW_TEMPLATES_ROOT);
      artifacts.push(...templateArtifacts);
    }

    if (scope === 'packages' || scope === 'all' || !scope) {
      const packageArtifacts = await this.scanRepository('packages', this.config.env.SW_PACKAGES_ROOT);
      artifacts.push(...packageArtifacts);
    }

    return artifacts;
  }

  private async scanRepository(repo: 'templates' | 'packages', rootPath: string): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];

    // Scan apps directory for templates repo
    if (repo === 'templates') {
      const appsPath = join(rootPath, 'apps');
      if (existsSync(appsPath)) {
        const apps = await this.scanDirectory(appsPath, repo, 'template');
        artifacts.push(...apps);
      }

      // NOTE: We do NOT scan packages in templates repo for direct access
      // They are only available as dependencies when using templates
    }

    // Scan packages directory for packages repo
    if (repo === 'packages') {
      const packagesPath = join(rootPath, 'packages');
      if (existsSync(packagesPath)) {
        const packages = await this.scanDirectory(packagesPath, repo, 'package');
        artifacts.push(...packages);
      }
    }

    return artifacts;
  }

  private async scanDirectory(
    dirPath: string,
    repo: 'templates' | 'packages',
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
          const artifact: Artifact = {
            slug: `${repo}/${swJson.slug}`,
            id: swJson.slug,
            type: swJson.type || defaultType,
            repo,
            relPath: artifactPath.replace(this.getRepoRoot(repo), '').replace(/^\//, ''),
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

  private getRepoRoot(repo: 'templates' | 'packages'): string {
    return repo === 'templates' 
      ? this.config.env.SW_TEMPLATES_ROOT 
      : this.config.env.SW_PACKAGES_ROOT;
  }

  getArtifactBySlug(slug: string): Artifact | undefined {
    return this.artifactCache.get(slug);
  }

  clearCache(): void {
    this.artifactCache.clear();
  }

  // Scan ALL packages including those in templates repo (for dependency resolution only)
  async scanAllPackagesForDependencies(): Promise<Artifact[]> {
    const packages: Artifact[] = [];
    
    // Scan packages in templates repo
    const templatesPackagesPath = join(this.config.env.SW_TEMPLATES_ROOT, 'packages');
    if (existsSync(templatesPackagesPath)) {
      const templatePackages = await this.scanDirectory(templatesPackagesPath, 'templates', 'package');
      packages.push(...templatePackages);
    }
    
    // Scan packages in packages repo
    const packagesPath = join(this.config.env.SW_PACKAGES_ROOT, 'packages');
    if (existsSync(packagesPath)) {
      const repoPackages = await this.scanDirectory(packagesPath, 'packages', 'package');
      packages.push(...repoPackages);
    }
    
    return packages;
  }
}