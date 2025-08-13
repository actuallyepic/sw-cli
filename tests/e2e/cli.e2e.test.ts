import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { createTempDir, cleanupTempDir } from '../utils/test-helpers';

describe('SW CLI E2E Tests', () => {
  const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');
  const EXAMPLE_TEMPLATES = join(process.cwd(), 'example-repos', 'sw-templates');
  const EXAMPLE_PACKAGES = join(process.cwd(), 'example-repos', 'sw-packages');
  const CONFIG_PATH = join(homedir(), '.swrc.json');
  
  let testWorkspace: string;
  let originalConfig: string | null = null;

  beforeAll(async () => {
    // Build the CLI
    execSync('bun run build', { cwd: process.cwd() });
    
    // Backup existing config if it exists
    if (existsSync(CONFIG_PATH)) {
      originalConfig = await readFile(CONFIG_PATH, 'utf-8');
    }
    
    // Create test config
    await writeFile(CONFIG_PATH, JSON.stringify({
      internalScopes: ['@repo', '@packages'],
      defaultPackageManager: 'bun',
    }, null, 2));
    
    // Create test workspace
    testWorkspace = await createTempDir();
  });

  afterAll(async () => {
    // Restore original config or remove test config
    if (originalConfig) {
      await writeFile(CONFIG_PATH, originalConfig);
    } else if (existsSync(CONFIG_PATH)) {
      await rm(CONFIG_PATH);
    }
    
    // Clean up test workspace
    await cleanupTempDir(testWorkspace);
  });

  function runCLI(args: string, options: { cwd?: string } = {}): string {
    const env = {
      ...process.env,
      SW_TEMPLATES_ROOT: EXAMPLE_TEMPLATES,
      SW_PACKAGES_ROOT: EXAMPLE_PACKAGES,
    };
    
    const cwd = options.cwd || testWorkspace;
    
    try {
      const output = execSync(`bun ${CLI_PATH} ${args}`, {
        env,
        cwd,
        encoding: 'utf-8',
      });
      return output;
    } catch (error: any) {
      // Return error output for testing error cases
      return error.stdout || error.stderr || error.message;
    }
  }

  describe('list command', () => {
    it('should list all artifacts', () => {
      const output = runCLI('list');
      
      expect(output).toContain('templates/saas-starter');
      expect(output).toContain('templates/blog-starter');
      expect(output).toContain('packages/github-service');
      expect(output).toContain('packages/logger');
    });

    it('should list only templates', () => {
      const output = runCLI('list templates');
      
      expect(output).toContain('templates/saas-starter');
      expect(output).toContain('templates/blog-starter');
      expect(output).not.toContain('packages/github-service');
    });

    it('should list only packages', () => {
      const output = runCLI('list packages');
      
      expect(output).not.toContain('templates/saas-starter');
      expect(output).toContain('packages/github-service');
      expect(output).toContain('packages/logger');
    });

    it('should filter by tag', () => {
      const output = runCLI('list --filter-tag saas');
      
      expect(output).toContain('templates/saas-starter');
      expect(output).not.toContain('templates/blog-starter');
    });

    it('should output JSON format', () => {
      const output = runCLI('list --json --limit 2');
      const json = JSON.parse(output);
      
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBe(2);
      expect(json[0]).toHaveProperty('slug');
      expect(json[0]).toHaveProperty('name');
      expect(json[0]).toHaveProperty('tags');
    });

    it('should output quiet format', () => {
      const output = runCLI('list --quiet --limit 3');
      const lines = output.trim().split('\n');
      
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/^(templates|packages)\/[\w-]+$/);
    });
  });

  describe('view command', () => {
    it('should view template details', () => {
      const output = runCLI('view templates/saas-starter');
      
      expect(output).toContain('SaaS Starter Template');
      expect(output).toContain('Required Environment Variables:');
      expect(output).toContain('STRIPE_SECRET_KEY');
      expect(output).toContain('README.md');
    });

    it('should view package details', () => {
      const output = runCLI('view packages/github-service');
      
      expect(output).toContain('GitHub Service');
      expect(output).toContain('TypeScript client for GitHub API');
    });

    it('should support custom overrides', () => {
      const output = runCLI('view templates/saas-starter --override package.json:1-5');
      
      expect(output).toContain('package.json');
      expect(output).toContain('Lines 1-5');
      expect(output).toContain('"name": "saas-starter"');
    });

    it('should output JSON format', () => {
      const output = runCLI('view templates/blog-starter --json');
      const json = JSON.parse(output);
      
      expect(Array.isArray(json)).toBe(true);
      expect(json[0]).toHaveProperty('kind');
      expect(json[0]).toHaveProperty('path');
    });

    it('should error on invalid slug', () => {
      const output = runCLI('view invalid/slug');
      
      expect(output).toContain('Artifact not found');
    });
  });

  describe('find command', () => {
    it('should find text in code', () => {
      const output = runCLI('find import --max-matches 5');
      
      expect(output).toContain('Found');
      expect(output).toContain('.ts');
    });

    it('should support case-insensitive search', () => {
      const output = runCLI('find AUTH --case-insensitive --max-matches 3');
      
      expect(output).toContain('Found');
      expect(output).toContain('auth');
    });

    it('should filter by language', () => {
      const output = runCLI('find function --lang ts --max-matches 3');
      
      expect(output).toContain('Found');
      // Should only match TypeScript files
    });

    it('should support files-only mode', () => {
      const output = runCLI('find template --files-only --max-matches 5');
      
      expect(output).toContain('Found');
      expect(output).not.toContain('│'); // No code snippets
    });

    it('should output JSON format', () => {
      const output = runCLI('find export --json --max-matches 2');
      const json = JSON.parse(output);
      
      expect(Array.isArray(json)).toBe(true);
      if (json.length > 0) {
        expect(json[0]).toHaveProperty('file');
      }
    });
  });

  describe('use command', () => {
    it('should perform dry-run without copying', async () => {
      const output = runCLI('use templates/blog-starter --dry-run');
      
      expect(output).toContain('Dry Run');
      expect(output).toContain('Would perform the following operations');
      expect(output).toContain('blog-starter');
      expect(output).toContain('Copy artifacts:');
      
      // Verify nothing was actually copied
      const appsPath = join(testWorkspace, 'apps');
      expect(existsSync(appsPath)).toBe(false);
    });

    it('should copy template with dependencies', async () => {
      const output = runCLI('use templates/saas-starter --no-install');
      
      expect(output).toContain('Success');
      expect(output).toContain('Copied');
      expect(output).toContain('Internal dependencies copied');
      
      // Verify files were copied
      const appPath = join(testWorkspace, 'apps', 'saas-starter');
      const packagePath = join(testWorkspace, 'packages', 'auth-ui');
      
      expect(existsSync(appPath)).toBe(true);
      expect(existsSync(packagePath)).toBe(true);
      
      // Verify sw.json exists
      const swJsonPath = join(appPath, 'sw.json');
      expect(existsSync(swJsonPath)).toBe(true);
    });

    it('should rename artifact with --as flag', async () => {
      const customWorkspace = await createTempDir();
      
      try {
        const output = runCLI('use packages/logger --as my-logger --no-install', {
          cwd: customWorkspace,
        });
        
        expect(output).toContain('Success');
        
        const customPath = join(customWorkspace, 'packages', 'my-logger');
        expect(existsSync(customPath)).toBe(true);
      } finally {
        await cleanupTempDir(customWorkspace);
      }
    });

    it('should error when destination exists without --overwrite', async () => {
      // Create existing directory
      const appsDir = join(testWorkspace, 'apps', 'blog-starter');
      await mkdir(appsDir, { recursive: true });
      
      const output = runCLI('use templates/blog-starter --no-install');
      
      expect(output).toContain('Destination already exists');
      expect(output).toContain('--overwrite');
    });

    it('should output JSON format', async () => {
      const customWorkspace = await createTempDir();
      
      try {
        const output = runCLI('use packages/event-emitter --json --no-install', {
          cwd: customWorkspace,
        });
        const json = JSON.parse(output);
        
        expect(json).toHaveProperty('artifact');
        expect(json).toHaveProperty('destination');
        expect(json).toHaveProperty('internalDeps');
        expect(json).toHaveProperty('externalDeps');
        expect(json.artifact.slug).toBe('packages/event-emitter');
      } finally {
        await cleanupTempDir(customWorkspace);
      }
    });
  });

  describe('help command', () => {
    it('should show general help', () => {
      const output = runCLI('--help');
      
      expect(output).toContain('SW CLI');
      expect(output).toContain('list');
      expect(output).toContain('find');
      expect(output).toContain('view');
      expect(output).toContain('use');
      expect(output).toContain('Environment Variables');
    });

    it('should show command-specific help', () => {
      const output = runCLI('list --help');
      
      expect(output).toContain('List available templates or packages');
      expect(output).toContain('--filter-tag');
      expect(output).toContain('--json');
      expect(output).toContain('--quiet');
    });
  });

  describe('error handling', () => {
    it('should error with missing environment variables', () => {
      const env = { ...process.env };
      delete env.SW_TEMPLATES_ROOT;
      
      try {
        execSync(`bun ${CLI_PATH} list`, {
          env,
          cwd: testWorkspace,
          encoding: 'utf-8',
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        const output = error.stdout || error.stderr || error.message;
        expect(output).toContain('Missing required environment variables');
      }
    });

    it('should error with invalid config file', async () => {
      // Temporarily write invalid config
      await writeFile(CONFIG_PATH, '{ invalid json }');
      
      try {
        const output = runCLI('list');
        expect(output).toContain('Failed to load configuration');
      } finally {
        // Restore valid config
        await writeFile(CONFIG_PATH, JSON.stringify({
          internalScopes: ['@repo'],
          defaultPackageManager: 'bun',
        }));
      }
    });
  });
});