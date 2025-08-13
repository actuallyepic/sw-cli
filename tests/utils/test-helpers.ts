import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { Config } from '../../src/core/config/config.loader';
import { SwJson } from '../../src/core/config/config.schema';

let tempDirCounter = 0;

export async function createTempDir(): Promise<string> {
  const tempPath = join(tmpdir(), `sw-cli-test-${Date.now()}-${tempDirCounter++}`);
  await mkdir(tempPath, { recursive: true });
  return tempPath;
}

export async function cleanupTempDir(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

export function createMockConfig(): Config {
  return {
    env: {
      SW_ROOT: '/mock/sw',
    },
    user: {
      internalScopes: ['@repo'],
      defaultPackageManager: 'pnpm',
      preview: {
        defaultLines: 80,
      },
    },
  };
}

export function createMockSwJson(overrides: Partial<SwJson> = {}): SwJson {
  return {
    type: 'template',
    slug: 'test-artifact',
    name: 'Test Artifact',
    description: 'A test artifact',
    tags: ['test'],
    requiredEnv: [],
    view: [],
    ...overrides,
  };
}

export async function createMockArtifact(
  basePath: string,
  dirName: string,
  swJson: SwJson,
  packageJson: Record<string, any> = {}
): Promise<string> {
  const artifactPath = join(basePath, dirName);
  await mkdir(artifactPath, { recursive: true });
  
  // Write sw.json
  await writeFile(
    join(artifactPath, 'sw.json'),
    JSON.stringify(swJson, null, 2)
  );
  
  // Write package.json
  const defaultPackageJson = {
    name: `@test/${dirName}`,
    version: '1.0.0',
    ...packageJson,
  };
  
  await writeFile(
    join(artifactPath, 'package.json'),
    JSON.stringify(defaultPackageJson, null, 2)
  );
  
  return artifactPath;
}

export async function createMockMonorepo(rootPath: string): Promise<void> {
  // Create monorepo structure
  await mkdir(join(rootPath, 'apps'), { recursive: true });
  await mkdir(join(rootPath, 'packages'), { recursive: true });
  
  // Create root package.json
  const rootPackageJson = {
    name: 'test-monorepo',
    version: '1.0.0',
    private: true,
    workspaces: ['apps/*', 'packages/*'],
  };
  
  await writeFile(
    join(rootPath, 'package.json'),
    JSON.stringify(rootPackageJson, null, 2)
  );
}