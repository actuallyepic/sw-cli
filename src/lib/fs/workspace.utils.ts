import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Find the root of a turborepo/monorepo workspace by looking for marker files
 * Walks up the directory tree from the current working directory
 */
export function findWorkspaceRoot(startPath: string = process.cwd()): string {
  let currentPath = startPath;
  
  // Walk up the directory tree
  while (currentPath !== dirname(currentPath)) {
    // Check for turborepo marker
    if (existsSync(join(currentPath, 'turbo.json'))) {
      return currentPath;
    }
    
    // Check for pnpm workspace
    if (existsSync(join(currentPath, 'pnpm-workspace.yaml'))) {
      return currentPath;
    }
    
    // Check for npm/yarn workspaces in package.json
    const packageJsonPath = join(currentPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);
        if (packageJson.workspaces) {
          return currentPath;
        }
      } catch {
        // Ignore parsing errors
      }
    }
    
    // Move up one directory
    currentPath = dirname(currentPath);
  }
  
  // If no workspace root found, return the original working directory
  return process.cwd();
}