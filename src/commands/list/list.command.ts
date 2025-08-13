import { Command } from 'commander';
import { handleList } from './list.handler';

export const listCommand = new Command('list')
  .description('List available templates or packages')
  .argument('[scope]', 'Scope to list: templates, packages, or all', 'all')
  .option('--filter-tag <tag>', 'Filter by tag (repeatable)', (tag, tags: string[]) => [...(tags || []), tag], [])
  .option('--filter-text <text>', 'Case-insensitive substring match')
  .option('--limit <n>', 'Limit results', parseInt)
  .option('--offset <n>', 'Skip first n results', parseInt)
  .option('--json', 'Machine-readable output', false)
  .option('--long', 'Include extended information', false)
  .option('--paths', 'Include absolute source paths', false)
  .option('--quiet', 'Slugs only, one per line', false)
  .action(async (scope, options) => {
    await handleList(scope, options);
  });