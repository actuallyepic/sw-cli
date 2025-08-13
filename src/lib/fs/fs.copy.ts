import { mkdir } from 'fs/promises';
import { existsSync, cpSync } from 'fs';
import { dirname } from 'path';
import chalk from 'chalk';
import { areDirectoriesIdentical } from './hash.utils';

export interface CopyOptions {
  overwrite?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

export interface CopyResult {
  source: string;
  destination: string;
  action: 'copied' | 'skipped' | 'overwritten' | 'would-copy' | 'identical';
  error?: string;
  message?: string;
}


export async function copyDirectory(
  source: string,
  destination: string,
  options: CopyOptions = {}
): Promise<CopyResult> {
  const { overwrite = false, dryRun = false, verbose = false } = options;
  
  // Check if source exists
  if (!existsSync(source)) {
    return {
      source,
      destination,
      action: 'skipped',
      error: 'Source does not exist',
    };
  }
  
  // Check if destination exists
  const destExists = existsSync(destination);
  
  if (destExists && !overwrite) {
    // Check if the directories are identical
    if (areDirectoriesIdentical(source, destination)) {
      if (verbose) {
        console.log(chalk.yellow('[SKIP]'), `${destination} - identical to source`);
      }
      return {
        source,
        destination,
        action: 'identical',
        message: 'Skipped - package is identical to source',
      };
    }
    
    // Directories exist but are different - provide helpful error
    const packageName = destination.split('/').pop();
    return {
      source,
      destination,
      action: 'skipped',
      error: `Package conflict: ${packageName} already exists with local modifications.\n` +
             `To resolve:\n` +
             `  1. Rename your local package (folder + package.json name)\n` +
             `  2. Update imports from '@repo/${packageName}' to your new name\n` +
             `  3. Run the command again`,
    };
  }
  
  if (dryRun) {
    return {
      source,
      destination,
      action: 'would-copy',
    };
  }
  
  try {
    // Ensure parent directory exists
    const parentDir = dirname(destination);
    if (!existsSync(parentDir)) {
      await mkdir(parentDir, { recursive: true });
    }
    
    // Use Node's built-in cpSync for reliable copying
    cpSync(source, destination, {
      recursive: true,
      force: overwrite,
      errorOnExist: !overwrite,
      preserveTimestamps: true,
    });
    
    if (verbose) {
      console.log(chalk.green('[OK]'), `Copied ${source} → ${destination}`);
    }
    
    return {
      source,
      destination,
      action: destExists ? 'overwritten' : 'copied',
    };
  } catch (error) {
    return {
      source,
      destination,
      action: 'skipped',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function copyArtifacts(
  artifacts: Array<{ source: string; destination: string }>,
  options: CopyOptions = {}
): Promise<CopyResult[]> {
  const results: CopyResult[] = [];
  
  for (const { source, destination } of artifacts) {
    const result = await copyDirectory(source, destination, options);
    results.push(result);
  }
  
  return results;
}