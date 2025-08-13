import { join } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { Artifact } from '../../core/config/config.schema';
import { readFileLines, getFileSize, formatFileSize } from '../../lib/fs/fs.utils';
import { renderDirectoryTree } from '../../lib/output/output.tree';

export interface ViewSection {
  kind: 'file' | 'tree';
  path: string;
  content?: string[];
  range?: [number, number];
  tree?: string;
}

export async function renderArtifactView(
  artifact: Artifact,
  overrides: string[] = []
): Promise<ViewSection[]> {
  const sections: ViewSection[] = [];
  
  // Parse overrides first
  const overrideSpecs = parseOverrides(overrides);
  
  // Get view specs from artifact or use defaults
  let viewSpecs = artifact.sw.view || getDefaultViewSpecs();
  
  // Apply overrides
  if (overrideSpecs.length > 0) {
    viewSpecs = [...viewSpecs, ...overrideSpecs];
  }
  
  // Render each view spec
  for (const spec of viewSpecs) {
    const section = await renderViewSpec(spec, artifact.absPath);
    if (section) {
      sections.push(section);
    }
  }
  
  return sections;
}

function getDefaultViewSpecs(): any[] {
  return [
    { path: 'README.md', lines: [1, 80] },
    { path: 'package.json', lines: [1, 50] },
    { tree: { path: 'src', depth: 2, limit: 50 } }
  ];
}

function parseOverrides(overrides: string[]): any[] {
  const specs: any[] = [];
  
  for (const override of overrides) {
    // Parse tree:path:depth:limit format
    if (override.startsWith('tree:')) {
      const parts = override.slice(5).split(':');
      const spec: any = {
        tree: {
          path: parts[0],
          depth: parts[1] ? parseInt(parts[1]) : 2,
          limit: parts[2] ? parseInt(parts[2]) : 50
        }
      };
      specs.push(spec);
    }
    // Parse path:start-end format
    else if (override.includes(':')) {
      const [path, range] = override.split(':');
      if (range && range.includes('-')) {
        const [start, end] = range.split('-').map(n => parseInt(n));
        specs.push({ path, lines: [start, end] });
      } else {
        specs.push({ path, lines: 'all' });
      }
    }
    // Just a path - show entire file
    else {
      specs.push({ path: override, lines: 'all' });
    }
  }
  
  return specs;
}

async function renderViewSpec(spec: any, basePath: string): Promise<ViewSection | null> {
  // Handle tree spec
  if (spec.tree) {
    const { path, depth = 2, limit = 50 } = spec.tree;
    const fullPath = join(basePath, path);
    
    if (!existsSync(fullPath)) {
      return null;
    }
    
    const tree = await renderDirectoryTree(fullPath, { depth, limit });
    return {
      kind: 'tree',
      path,
      tree
    };
  }
  
  // Handle file spec
  if (spec.path) {
    const fullPath = join(basePath, spec.path);
    
    if (!existsSync(fullPath)) {
      return null;
    }
    
    // Check file size
    const fileSize = await getFileSize(fullPath);
    if (fileSize > 5 * 1024 * 1024) { // 5MB limit
      return {
        kind: 'file',
        path: spec.path,
        content: [`File too large (${formatFileSize(fileSize)}). Skipping preview.`]
      };
    }
    
    let lines: string[];
    let range: [number, number] | undefined;
    
    if (spec.lines === 'all') {
      lines = await readFileLines(fullPath);
      range = [1, lines.length];
    } else if (Array.isArray(spec.lines)) {
      const [start, end] = spec.lines;
      lines = await readFileLines(fullPath, { startLine: start, endLine: end });
      range = [start, end];
    } else {
      // Default to first 80 lines
      lines = await readFileLines(fullPath, { startLine: 1, endLine: 80 });
      range = [1, 80];
    }
    
    return {
      kind: 'file',
      path: spec.path,
      content: lines,
      range
    };
  }
  
  return null;
}

export function formatViewSections(sections: ViewSection[], json: boolean = false): string {
  if (json) {
    return JSON.stringify(sections, null, 2);
  }
  
  const output: string[] = [];
  
  for (const section of sections) {
    output.push('');
    
    if (section.kind === 'file') {
      output.push(chalk.cyan(`📄 ${section.path}`));
      
      if (section.range) {
        output.push(chalk.dim(`   Lines ${section.range[0]}-${section.range[1]}`));
      }
      
      output.push(chalk.dim('─'.repeat(60)));
      
      if (section.content) {
        // Add line numbers
        const startLine = section.range ? section.range[0] : 1;
        section.content.forEach((line, index) => {
          const lineNum = String(startLine + index).padStart(4, ' ');
          output.push(chalk.dim(lineNum) + ' │ ' + line);
        });
      }
    } else if (section.kind === 'tree') {
      output.push(chalk.cyan(`📁 ${section.path}/`));
      output.push(chalk.dim('─'.repeat(60)));
      
      if (section.tree) {
        output.push(section.tree);
      }
    }
  }
  
  return output.join('\n');
}