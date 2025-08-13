import { Config } from '../config/config.loader';
import { Artifact } from '../config/config.schema';
import { ArtifactScanner } from '../artifact/artifact.scanner';

export interface Dependency {
  name: string;
  version: string;
  type: 'internal' | 'external';
  artifact?: Artifact;
}

export interface DependencyGraph {
  root: Artifact;
  dependencies: Map<string, Dependency>;
  order: Artifact[];
}

export class DependencyResolver {
  private artifactsByPackageName = new Map<string, Artifact>();
  
  constructor(
    private config: Config,
    private scanner: ArtifactScanner
  ) {}

  async resolve(artifact: Artifact): Promise<DependencyGraph> {
    // Build artifact index by package name
    await this.buildPackageIndex();
    
    // Build dependency graph
    const graph: DependencyGraph = {
      root: artifact,
      dependencies: new Map(),
      order: [],
    };
    
    // Track visited to handle cycles
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    // Perform DFS to build graph
    await this.collectDependencies(artifact, graph, visited, visiting);
    
    // Calculate topological order
    graph.order = this.topologicalSort(graph);
    
    return graph;
  }

  private async buildPackageIndex(): Promise<void> {
    const artifacts = await this.scanner.scanArtifacts();
    
    for (const artifact of artifacts) {
      if (artifact.packageJson && artifact.packageJson.name) {
        this.artifactsByPackageName.set(artifact.packageJson.name as string, artifact);
      }
    }
  }

  private async collectDependencies(
    artifact: Artifact,
    graph: DependencyGraph,
    visited: Set<string>,
    visiting: Set<string>
  ): Promise<void> {
    const artifactKey = artifact.slug;
    
    // Check for cycles
    if (visiting.has(artifactKey)) {
      console.warn(`Circular dependency detected: ${artifactKey}`);
      return;
    }
    
    if (visited.has(artifactKey)) {
      return;
    }
    
    visiting.add(artifactKey);
    
    // Get all dependencies from package.json
    const allDeps = {
      ...((artifact.packageJson.dependencies as Record<string, string>) || {}),
      ...((artifact.packageJson.devDependencies as Record<string, string>) || {}),
      ...((artifact.packageJson.peerDependencies as Record<string, string>) || {}),
    };
    
    for (const [name, version] of Object.entries(allDeps)) {
      const dep = this.classifyDependency(name, version);
      
      if (!graph.dependencies.has(name)) {
        graph.dependencies.set(name, dep);
        
        // If internal, recursively resolve its dependencies
        if (dep.type === 'internal' && dep.artifact) {
          await this.collectDependencies(dep.artifact, graph, visited, visiting);
        }
      }
    }
    
    visiting.delete(artifactKey);
    visited.add(artifactKey);
  }

  private classifyDependency(name: string, version: string): Dependency {
    // Check if it matches internal scopes
    const isInternalScope = this.config.user.internalScopes.some(scope => 
      name.startsWith(scope)
    );
    
    // Check if we have this package in our artifacts
    const artifact = this.artifactsByPackageName.get(name);
    
    const type = isInternalScope || artifact ? 'internal' : 'external';
    
    return {
      name,
      version,
      type,
      artifact,
    };
  }

  private topologicalSort(graph: DependencyGraph): Artifact[] {
    const sorted: Artifact[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    // Build adjacency list
    const adjList = new Map<string, string[]>();
    
    // Add root
    adjList.set(graph.root.slug, []);
    
    // Add all internal dependencies
    for (const dep of graph.dependencies.values()) {
      if (dep.type === 'internal' && dep.artifact) {
        if (!adjList.has(dep.artifact.slug)) {
          adjList.set(dep.artifact.slug, []);
        }
        
        // Find which artifacts depend on this one
        for (const otherArtifact of this.artifactsByPackageName.values()) {
          const otherDeps = {
            ...((otherArtifact.packageJson.dependencies as Record<string, string>) || {}),
            ...((otherArtifact.packageJson.devDependencies as Record<string, string>) || {}),
          };
          
          if (dep.name in otherDeps) {
            const list = adjList.get(otherArtifact.slug) || [];
            list.push(dep.artifact.slug);
            adjList.set(otherArtifact.slug, list);
          }
        }
      }
    }
    
    // DFS for topological sort
    const dfs = (slug: string): void => {
      if (visited.has(slug)) return;
      if (visiting.has(slug)) {
        // Cycle detected, but we handle it gracefully
        return;
      }
      
      visiting.add(slug);
      
      const deps = adjList.get(slug) || [];
      for (const depSlug of deps) {
        dfs(depSlug);
      }
      
      visiting.delete(slug);
      visited.add(slug);
      
      // Find artifact by slug
      const artifact = slug === graph.root.slug 
        ? graph.root 
        : Array.from(graph.dependencies.values())
            .find(d => d.artifact?.slug === slug)?.artifact;
      
      if (artifact) {
        sorted.unshift(artifact);
      }
    };
    
    // Start with root
    dfs(graph.root.slug);
    
    // Add any missed internal dependencies
    for (const dep of graph.dependencies.values()) {
      if (dep.type === 'internal' && dep.artifact && !visited.has(dep.artifact.slug)) {
        dfs(dep.artifact.slug);
      }
    }
    
    return sorted;
  }

  getInternalDependencies(graph: DependencyGraph): Artifact[] {
    return Array.from(graph.dependencies.values())
      .filter(dep => dep.type === 'internal' && dep.artifact)
      .map(dep => dep.artifact!);
  }

  getExternalDependencies(graph: DependencyGraph): string[] {
    return Array.from(graph.dependencies.values())
      .filter(dep => dep.type === 'external')
      .map(dep => `${dep.name}@${dep.version}`);
  }
}