import { mkdir } from 'fs/promises';
import { existsSync, cpSync } from 'fs';
import { dirname } from 'path';
import chalk from 'chalk';

export interface CopyOptions {
  overwrite?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

export interface CopyResult {
  source: string;
  destination: string;
  action: 'copied' | 'skipped' | 'overwritten' | 'would-copy';
  error?: string;
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
    return {
      source,
      destination,
      action: 'skipped',
      error: 'Destination already exists',
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