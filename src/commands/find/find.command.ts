import { Command } from 'commander';
import { handleFind } from './find.handler';

export const findCommand = new Command('find')
  .description('Fast local search across code and metadata')
  .argument('<pattern>', 'Search pattern (supports re:/, like:{}, exact:)')
  .option('--filter <type>', 'Filter what to search (code/meta/docs/tests)', (type, types: string[]) => [...(types || []), type], [])
  .option('--scope <scope>', 'Limit to templates or packages')
  .option('--path <glob>', 'Restrict to paths (repeatable)', (glob, globs: string[]) => [...(globs || []), glob], [])
  .option('--ext <ext>', 'Filter by extension (repeatable)', (ext, exts: string[]) => [...(exts || []), ext], [])
  .option('--lang <lang>', 'Language preset (ts/js/py/go/rust)')
  .option('--tag <tag>', 'Filter by artifact tags (repeatable)', (tag, tags: string[]) => [...(tags || []), tag], [])
  .option('--id <id>', 'Filter by artifact ID (repeatable)', (id, ids: string[]) => [...(ids || []), id], [])
  .option('--case-insensitive', 'Case-insensitive search', false)
  .option('--word', 'Match whole words only', false)
  .option('--context <n>', 'Lines of context before/after', parseInt)
  .option('--files-only', 'List files without snippets', false)
  .option('--max-matches <n>', 'Stop after n matches', parseInt)
  .option('--json', 'Structured output', false)
  .action(async (pattern, options) => {
    await handleFind(pattern, options);
  });