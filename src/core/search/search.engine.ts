import { spawn } from 'child_process';
import { Config } from '../config/config.loader';

export interface SearchOptions {
  filter?: string[];
  scope?: 'templates' | 'packages';
  path?: string[];
  ext?: string[];
  lang?: string;
  tag?: string[];
  id?: string[];
  caseInsensitive?: boolean;
  word?: boolean;
  context?: number;
  filesOnly?: boolean;
  maxMatches?: number;
}

export interface SearchHit {
  artifact?: {
    slug: string;
    id: string;
    type: string;
  };
  file: string;
  line?: number;
  match?: string;
  before?: string[];
  after?: string[];
}

export class SearchEngine {
  constructor(private config: Config) {}

  async search(pattern: string, options: SearchOptions = {}): Promise<SearchHit[]> {
    const searchPaths = this.getSearchPaths(options);
    const rgArgs = this.buildRipgrepArgs(pattern, options);
    
    const hits: SearchHit[] = [];
    
    for (const searchPath of searchPaths) {
      const pathHits = await this.searchInPath(searchPath, rgArgs, options);
      hits.push(...pathHits);
      
      if (options.maxMatches && hits.length >= options.maxMatches) {
        return hits.slice(0, options.maxMatches);
      }
    }
    
    return hits;
  }

  private getSearchPaths(options: SearchOptions): string[] {
    const paths: string[] = [];
    const rootPath = this.config.env.SW_ROOT;
    
    if (options.scope === 'templates' || !options.scope) {
      paths.push(`${rootPath}/apps`);
    }
    
    if (options.scope === 'packages' || !options.scope) {
      paths.push(`${rootPath}/packages`);
    }
    
    return paths;
  }

  private buildRipgrepArgs(pattern: string, options: SearchOptions): string[] {
    const args: string[] = [];
    
    // Parse pattern type
    let searchPattern = pattern;
    if (pattern.startsWith('re:/') && pattern.endsWith('/')) {
      searchPattern = pattern.slice(4, -1);
    } else if (pattern.startsWith('like:{') && pattern.endsWith('}')) {
      searchPattern = pattern.slice(6, -1);
      args.push('--fixed-strings');
    } else if (pattern.startsWith('exact:')) {
      searchPattern = pattern.slice(6);
      args.push('--fixed-strings');
    }
    
    // Add pattern
    args.push(searchPattern);
    
    // Add options
    if (options.caseInsensitive) {
      args.push('-i');
    }
    
    if (options.word) {
      args.push('-w');
    }
    
    if (options.filesOnly) {
      args.push('-l');
    } else {
      args.push('--json');
    }
    
    if (options.context) {
      args.push('-C', options.context.toString());
    }
    
    // File type filters
    if (options.lang) {
      const langMap: Record<string, string[]> = {
        'ts': ['ts', 'tsx'],
        'js': ['js', 'jsx', 'mjs'],
        'py': ['py'],
        'go': ['go'],
        'rust': ['rs'],
      };
      
      const exts = langMap[options.lang] || [];
      exts.forEach(ext => args.push('-g', `*.${ext}`));
    }
    
    if (options.ext) {
      options.ext.forEach(ext => args.push('-g', `*.${ext}`));
    }
    
    if (options.path) {
      options.path.forEach(p => args.push('-g', p));
    }
    
    // Filter by type
    if (options.filter) {
      const filterMap: Record<string, string[]> = {
        'code': ['*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs', '*.java'],
        'meta': ['sw.json', 'package.json', 'README*'],
        'docs': ['*.md', '*.mdx', '*.txt', 'README*'],
        'tests': ['*.test.*', '*.spec.*', '__tests__/*'],
      };
      
      options.filter.forEach(f => {
        const patterns = filterMap[f] || [];
        patterns.forEach(p => args.push('-g', p));
      });
    }
    
    return args;
  }

  private async searchInPath(
    searchPath: string,
    rgArgs: string[],
    options: SearchOptions
  ): Promise<SearchHit[]> {
    return new Promise((resolve, reject) => {
      const hits: SearchHit[] = [];
      const rg = spawn('rg', [...rgArgs, searchPath]);
      
      let buffer = '';
      
      rg.stdout.on('data', (data) => {
        buffer += data.toString();
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          if (options.filesOnly) {
            // Simple file path
            const hit: SearchHit = {
              file: line.trim(),
            };
            
            // Try to determine artifact
            const artifact = this.extractArtifactFromPath(line.trim(), searchPath);
            if (artifact) {
              hit.artifact = artifact;
            }
            
            hits.push(hit);
          } else {
            // JSON output
            try {
              const jsonLine = JSON.parse(line);
              
              if (jsonLine.type === 'match') {
                const hit: SearchHit = {
                  file: jsonLine.data.path.text,
                  line: jsonLine.data.line_number,
                  match: jsonLine.data.lines.text,
                };
                
                // Try to determine artifact
                const artifact = this.extractArtifactFromPath(jsonLine.data.path.text, searchPath);
                if (artifact) {
                  hit.artifact = artifact;
                }
                
                hits.push(hit);
                
                if (options.maxMatches && hits.length >= options.maxMatches) {
                  rg.kill();
                  resolve(hits);
                  return;
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      });
      
      rg.stderr.on('data', () => {
        // Ignore stderr for now
      });
      
      rg.on('close', () => {
        resolve(hits);
      });
      
      rg.on('error', (err) => {
        if (err.message.includes('ENOENT')) {
          reject(new Error('ripgrep (rg) is not installed. Please install it first.'));
        } else {
          reject(err);
        }
      });
    });
  }

  private extractArtifactFromPath(filePath: string, searchPath: string): any {
    // Try to extract artifact ID from path
    const relativePath = filePath.replace(searchPath, '').replace(/^\//, '');
    const parts = relativePath.split('/');
    
    if (parts.length >= 2) {
      const [topDir, artifactId] = parts;
      
      if ((topDir === 'apps' || topDir === 'packages')) {
        const type = topDir === 'apps' ? 'template' : 'package';
        const prefix = type === 'template' ? 'templates' : 'packages';
        return {
          slug: `${prefix}/${artifactId}`,
          id: artifactId,
          type,
        };
      }
    }
    
    return null;
  }
}