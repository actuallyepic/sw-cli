import { Command } from 'commander';
import { handleView } from './view.handler';

export const viewCommand = new Command('view')
  .description('Show curated previews for templates/packages')
  .argument('<slug>', 'Artifact slug (e.g., templates/saas-starter)')
  .option('--override <spec>', 'Add or replace preview sections (repeatable)', (spec, specs: string[]) => [...(specs || []), spec], [])
  .option('--json', 'Structured output', false)
  .action(async (slug, options) => {
    await handleView(slug, options);
  });