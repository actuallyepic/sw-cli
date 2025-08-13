import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { z } from 'zod';

const InitOptionsSchema = z.object({
  shell: z.string().optional(),
  force: z.boolean().default(false),
  skipEnv: z.boolean().default(false),
  skipConfig: z.boolean().default(false),
});


const DEFAULT_CONFIG = {
  internalScopes: ['@repo'],
  defaultPackageManager: 'pnpm',
  preview: {
    defaultLines: 80
  }
};

export async function handleInit(swRoot: string, options: unknown): Promise<void> {
  try {
    const opts = InitOptionsSchema.parse(options);
    
    // Validate SW_ROOT path exists
    const absoluteSwRoot = path.resolve(swRoot);
    try {
      const stats = await fs.stat(absoluteSwRoot);
      if (!stats.isDirectory()) {
        console.error(chalk.red(`Error: ${absoluteSwRoot} is not a directory`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`Error: Directory ${absoluteSwRoot} does not exist`));
      process.exit(1);
    }

    // Check for apps/ and packages/ directories
    const appsPath = path.join(absoluteSwRoot, 'apps');
    const packagesPath = path.join(absoluteSwRoot, 'packages');
    
    const hasApps = await fs.stat(appsPath).then(s => s.isDirectory()).catch(() => false);
    const hasPackages = await fs.stat(packagesPath).then(s => s.isDirectory()).catch(() => false);
    
    if (!hasApps && !hasPackages) {
      console.warn(chalk.yellow('Warning: No apps/ or packages/ directory found in the specified root'));
      console.warn(chalk.yellow('Make sure this is a valid SW monorepo structure'));
    }

    console.log(chalk.cyan('Initializing SW CLI configuration...\n'));

    // 1. Setup ~/.swrc.json
    if (!opts.skipConfig) {
      await setupConfigFile(opts.force);
    }

    // 2. Setup environment variable
    if (!opts.skipEnv) {
      await setupEnvironmentVariable(absoluteSwRoot, opts.shell, opts.force);
    }

    console.log(chalk.green('\n✓ SW CLI initialization complete!'));
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('1. Restart your terminal or run: source ~/.zshrc (or ~/.bashrc)'));
    console.log(chalk.gray('2. Verify setup with: sw list'));
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(chalk.red('Invalid options:'), error.issues);
      process.exit(2);
    }
    console.error(chalk.red('Error during initialization:'), error);
    process.exit(1);
  }
}

async function setupConfigFile(force: boolean): Promise<void> {
  const configPath = path.join(os.homedir(), '.swrc.json');
  
  // Check if config already exists
  try {
    await fs.access(configPath);
    if (!force) {
      console.log(chalk.yellow(`~/.swrc.json already exists. Use --force to overwrite.`));
      return;
    }
    console.log(chalk.yellow('Overwriting existing ~/.swrc.json...'));
  } catch {
    // File doesn't exist, which is fine
  }

  // Write the default config
  await fs.writeFile(
    configPath,
    JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n',
    'utf-8'
  );
  
  console.log(chalk.green('✓ Created ~/.swrc.json with default configuration'));
  console.log(chalk.gray(`  Internal scopes: ${DEFAULT_CONFIG.internalScopes.join(', ')}`));
  console.log(chalk.gray(`  Default package manager: ${DEFAULT_CONFIG.defaultPackageManager}`));
  console.log(chalk.gray(`  Preview lines: ${DEFAULT_CONFIG.preview.defaultLines}`));
}

async function setupEnvironmentVariable(swRoot: string, shellType?: string, force?: boolean): Promise<void> {
  // Detect shell if not specified
  const shell = shellType || detectShell();
  
  // Determine shell config file
  const shellConfigFile = getShellConfigFile(shell);
  const configPath = path.join(os.homedir(), shellConfigFile);
  
  console.log(chalk.cyan(`Configuring ${shell} (${shellConfigFile})...`));
  
  // Read existing config
  let configContent = '';
  try {
    configContent = await fs.readFile(configPath, 'utf-8');
  } catch {
    // File doesn't exist, we'll create it
    configContent = '';
  }
  
  // Check if SW_ROOT is already configured
  const exportLine = `export SW_ROOT="${swRoot}"`;
  const swRootRegex = /^export SW_ROOT=.*/m;
  
  if (swRootRegex.test(configContent)) {
    if (!force) {
      console.log(chalk.yellow(`SW_ROOT is already configured in ${shellConfigFile}. Use --force to update.`));
      return;
    }
    // Replace existing SW_ROOT
    configContent = configContent.replace(swRootRegex, exportLine);
    console.log(chalk.yellow(`Updated existing SW_ROOT in ${shellConfigFile}`));
  } else {
    // Add SW_ROOT to the end
    const comment = '\n# SW CLI Configuration\n';
    configContent = configContent.trimEnd() + '\n' + comment + exportLine + '\n';
    console.log(chalk.green(`✓ Added SW_ROOT to ${shellConfigFile}`));
  }
  
  // Write back the config
  await fs.writeFile(configPath, configContent, 'utf-8');
  console.log(chalk.gray(`  SW_ROOT="${swRoot}"`));
}

function detectShell(): string {
  // Try to detect from SHELL environment variable
  const shellEnv = process.env.SHELL;
  if (shellEnv) {
    if (shellEnv.includes('zsh')) return 'zsh';
    if (shellEnv.includes('bash')) return 'bash';
    if (shellEnv.includes('fish')) return 'fish';
  }
  
  // Try to detect from parent process
  try {
    const parentProcess = execSync('ps -p $PPID -o comm=', { encoding: 'utf-8' }).trim();
    if (parentProcess.includes('zsh')) return 'zsh';
    if (parentProcess.includes('bash')) return 'bash';
    if (parentProcess.includes('fish')) return 'fish';
  } catch {
    // Fallback to default
  }
  
  // Default to bash
  return 'bash';
}

function getShellConfigFile(shell: string): string {
  switch (shell) {
    case 'zsh':
      return '.zshrc';
    case 'bash':
      // Check for .bash_profile on macOS, .bashrc on Linux
      return process.platform === 'darwin' ? '.bash_profile' : '.bashrc';
    case 'fish':
      return '.config/fish/config.fish';
    default:
      return '.bashrc';
  }
}