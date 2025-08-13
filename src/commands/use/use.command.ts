import { Command } from 'commander';
import { handleUse } from './use.handler';

export const useCommand = new Command('use')
  .description('Copy artifacts into the current workspace with automatic dependency resolution')
  .argument('<slug>', 'Artifact slug (e.g., templates/saas-starter)')
  .option('--into <dir>', 'Override destination directory (apps or packages)')
  .option('--as <name>', 'Rename destination folder')
  .option('--overwrite', 'Replace existing destination if it exists', false)
  .option('--dry-run', 'Show plan without executing', false)
  .option('--no-install', 'Skip package manager installation')
  .option('--pm <pm>', 'Override package manager (pnpm/npm/yarn/bun)')
  .option('--print-next', 'Show suggested next steps after completion', false)
  .option('--json', 'Structured output', false)
  .action(async (slug, options) => {
    await handleUse(slug, options);
  });