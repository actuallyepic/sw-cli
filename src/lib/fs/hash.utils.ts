import { createHash } from 'crypto';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Compute a hash of a directory's contents
 * Includes file paths, contents, and permissions
 */
export function computeDirectoryHash(dirPath: string): string {
  const hash = createHash('sha256');
  const files = getAllFiles(dirPath);
  
  // Sort files for consistent hashing
  files.sort();
  
  for (const file of files) {
    // Include relative path in hash
    const relativePath = relative(dirPath, file);
    hash.update(relativePath);
    
    // Include file contents
    const content = readFileSync(file);
    hash.update(content);
    
    // Include file stats (size, mode)
    const stats = statSync(file);
    hash.update(`${stats.size}-${stats.mode}`);
  }
  
  return hash.digest('hex');
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dirPath: string): string[] {
  const files: string[] = [];
  
  function traverse(currentPath: string) {
    const items = readdirSync(currentPath);
    
    for (const item of items) {
      // Skip node_modules and .git
      if (item === 'node_modules' || item === '.git') {
        continue;
      }
      
      const fullPath = join(currentPath, item);
      const stats = statSync(fullPath);
      
      if (stats.isDirectory()) {
        traverse(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dirPath);
  return files;
}

/**
 * Check if two directories have identical contents
 */
export function areDirectoriesIdentical(dir1: string, dir2: string): boolean {
  try {
    const hash1 = computeDirectoryHash(dir1);
    const hash2 = computeDirectoryHash(dir2);
    return hash1 === hash2;
  } catch (error) {
    // If we can't compute hashes, assume they're different
    return false;
  }
}