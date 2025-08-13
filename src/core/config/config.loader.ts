import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import { z } from 'zod';
import { EnvConfigSchema, UserConfigSchema, UserConfig, EnvConfig } from './config.schema';

export interface Config {
  env: EnvConfig;
  user: UserConfig;
}

let cachedConfig: Config | null = null;

export async function loadConfig(): Promise<Config> {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Load environment variables
  const envResult = EnvConfigSchema.safeParse(process.env);
  if (!envResult.success) {
    const missing = envResult.error.issues
      .map(issue => issue.path.join('.'))
      .join(', ');
    throw new Error(`Missing required environment variables: ${missing}`);
  }

  // Validate paths exist
  const { SW_ROOT } = envResult.data;
  if (!existsSync(SW_ROOT)) {
    throw new Error(`SW root does not exist: ${SW_ROOT}`);
  }

  // Load user config
  const userConfigPath = join(homedir(), '.swrc.json');
  if (!existsSync(userConfigPath)) {
    throw new Error(`Configuration file not found: ${userConfigPath}\nPlease create it with the following structure:\n{\n  "internalScopes": ["@repo"],\n  "defaultPackageManager": "pnpm"\n}`);
  }

  let userConfig: UserConfig;
  try {
    const userConfigData = await readFile(userConfigPath, 'utf-8');
    const parsed = JSON.parse(userConfigData);
    userConfig = UserConfigSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid configuration in ${userConfigPath}: ${error.message}`);
    }
    throw new Error(`Failed to load configuration from ${userConfigPath}: ${error}`);
  }

  cachedConfig = {
    env: envResult.data,
    user: userConfig,
  };

  return cachedConfig;
}

export async function validateConfig(): Promise<void> {
  await loadConfig();
}