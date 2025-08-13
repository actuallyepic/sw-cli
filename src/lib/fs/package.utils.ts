import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

export interface PackageInfo {
  name: string;
  path: string;
}

/**
 * Find all package.json files in a workspace and extract their names
 */
export async function findAllPackageNames(workspaceRoot: string): Promise<Map<string, string>> {
  const packageMap = new Map<string, string>(); // name -> path
  
  // Search for all package.json files
  const patterns = [
    'apps/*/package.json',
    'packages/*/package.json',
    'package.json'
  ];
  
  for (const pattern of patterns) {
    const files = await glob(pattern, { 
      cwd: workspaceRoot,
      absolute: false 
    });
    
    for (const file of files) {
      const fullPath = join(workspaceRoot, file);
      try {
        const content = JSON.parse(readFileSync(fullPath, 'utf-8'));
        if (content.name) {
          packageMap.set(content.name, fullPath);
        }
      } catch {
        // Ignore invalid package.json files
      }
    }
  }
  
  return packageMap;
}

/**
 * Check if a package name already exists in the workspace
 */
export async function checkPackageNameConflict(
  packageName: string,
  workspaceRoot: string,
  excludePath?: string
): Promise<{ exists: boolean; conflictPath?: string }> {
  const existingPackages = await findAllPackageNames(workspaceRoot);
  
  if (existingPackages.has(packageName)) {
    const conflictPath = existingPackages.get(packageName)!;
    // If excludePath is provided and matches, it's not a conflict (same package)
    if (excludePath && conflictPath === excludePath) {
      return { exists: false };
    }
    return { exists: true, conflictPath };
  }
  
  return { exists: false };
}

/**
 * Extract package name from package.json at given path
 */
export function getPackageName(packageJsonPath: string): string | null {
  try {
    if (!existsSync(packageJsonPath)) {
      return null;
    }
    const content = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return content.name || null;
  } catch {
    return null;
  }
}