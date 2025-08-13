#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { listCommand } from './commands/list/list.command';
import { findCommand } from './commands/find/find.command';
import { viewCommand } from './commands/view/view.command';
import { useCommand } from './commands/use/use.command';
import { validateConfig } from './core/config/config.loader';

const program = new Command();

async function main() {
  try {
    // Validate configuration early
    await validateConfig();

    program
      .name('sw')
      .description('SW CLI - Manage and discover reusable code templates and packages')
      .version('1.0.0')
      .addHelpText('after', `
Environment Variables:
  SW_TEMPLATES_ROOT    Path to templates monorepo clone
  SW_PACKAGES_ROOT     Path to packages monorepo clone

Configuration:
  ~/.swrc.json         Required configuration file

Examples:
  $ sw list templates
  $ sw find "TODO"
  $ sw view templates/saas-starter
  $ sw use templates/paid-saas-app-with-auth`);

    // Add commands
    program.addCommand(listCommand);
    program.addCommand(findCommand);
    program.addCommand(viewCommand);
    program.addCommand(useCommand);

    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red('Error:'), error.message);
      if (process.env.DEBUG === 'true') {
        console.error(error.stack);
      }
    } else {
      console.error(chalk.red('Error:'), error);
    }
    process.exit(1);
  }
}

main();