import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';

export interface TreeOptions {
  depth?: number;
  limit?: number;
  showHidden?: boolean;
}

interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

export async function renderDirectoryTree(
  dirPath: string,
  options: TreeOptions = {}
): Promise<string> {
  const { depth = 2, limit = 50, showHidden = false } = options;
  
  const tree = await buildTree(dirPath, depth, showHidden);
  const lines = formatTree(tree, '', true, limit);
  
  return lines.join('\n');
}

async function buildTree(
  dirPath: string,
  maxDepth: number,
  showHidden: boolean,
  currentDepth: number = 0
): Promise<TreeNode> {
  const name = dirPath.split('/').pop() || dirPath;
  const node: TreeNode = { name, type: 'directory', children: [] };
  
  if (currentDepth >= maxDepth) {
    return node;
  }
  
  try {
    const entries = await readdir(dirPath);
    const filtered = showHidden ? entries : entries.filter(e => !e.startsWith('.'));
    
    for (const entry of filtered.sort()) {
      const fullPath = join(dirPath, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        const childNode = await buildTree(fullPath, maxDepth, showHidden, currentDepth + 1);
        node.children!.push(childNode);
      } else {
        node.children!.push({ name: entry, type: 'file' });
      }
    }
  } catch (error) {
    // Ignore errors (e.g., permission denied)
  }
  
  return node;
}

function formatTree(
  node: TreeNode,
  prefix: string,
  isLast: boolean,
  limit: number,
  count: { value: number } = { value: 0 }
): string[] {
  const lines: string[] = [];
  
  if (count.value >= limit) {
    if (count.value === limit) {
      lines.push(chalk.dim('... (truncated)'));
      count.value++;
    }
    return lines;
  }
  
  // Format current node
  const connector = isLast ? '└── ' : '├── ';
  const icon = node.type === 'directory' ? '📁 ' : '📄 ';
  const name = node.type === 'directory' ? chalk.bold(node.name) : node.name;
  
  if (prefix !== '' || !isLast) { // Skip root node name
    lines.push(prefix + connector + icon + name);
    count.value++;
  }
  
  // Format children
  if (node.children && node.children.length > 0) {
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    
    node.children.forEach((child, index) => {
      const isLastChild = index === node.children!.length - 1;
      const childLines = formatTree(child, childPrefix, isLastChild, limit, count);
      lines.push(...childLines);
    });
  }
  
  return lines;
}