import { existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

export function detectPackageManager(projectPath: string): PackageManager | null {
  // Check for lockfiles
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(join(projectPath, 'yarn.lock'))) {
    return 'yarn';
  }
  if (existsSync(join(projectPath, 'bun.lockb'))) {
    return 'bun';
  }
  if (existsSync(join(projectPath, 'package-lock.json'))) {
    return 'npm';
  }
  
  return null;
}

export function getInstallCommand(pm: PackageManager): string {
  switch (pm) {
    case 'pnpm':
      return 'pnpm install';
    case 'yarn':
      return 'yarn install';
    case 'bun':
      return 'bun install';
    case 'npm':
    default:
      return 'npm install';
  }
}

export async function runInstall(
  projectPath: string,
  pm: PackageManager,
  verbose: boolean = false
): Promise<boolean> {
  return new Promise((resolve) => {
    const [cmd, ...args] = getInstallCommand(pm).split(' ');
    
    const child = spawn(cmd, args, {
      cwd: projectPath,
      stdio: verbose ? 'inherit' : 'pipe',
      shell: true,
    });
    
    child.on('close', (code) => {
      resolve(code === 0);
    });
    
    child.on('error', () => {
      resolve(false);
    });
  });
}