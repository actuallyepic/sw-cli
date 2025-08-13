import { Command } from 'commander';
import { handleInit } from './init.handler';

export const initCommand = new Command('init')
  .description('Initialize SW CLI configuration')
  .argument('<sw-root>', 'Path to the SW monorepo root')
  .option('--shell <shell>', 'Shell to configure (auto-detected by default)')
  .option('--force', 'Overwrite existing configuration')
  .option('--skip-env', 'Skip environment variable setup')
  .option('--skip-config', 'Skip ~/.swrc.json creation')
  .action(handleInit);