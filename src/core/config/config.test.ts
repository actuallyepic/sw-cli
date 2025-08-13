import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { 
  EnvConfigSchema, 
  UserConfigSchema, 
  SwJsonSchema,
  ArtifactSchema 
} from './config.schema';

describe('Config Schemas', () => {
  describe('EnvConfigSchema', () => {
    it('should validate valid environment config', () => {
      const valid = {
        SW_ROOT: '/path/to/sw',
      };
      
      const result = EnvConfigSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(valid);
      }
    });

    it('should reject missing SW_ROOT', () => {
      const invalid = {};
      
      const result = EnvConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject empty strings', () => {
      const invalid = {
        SW_ROOT: '',
      };
      
      const result = EnvConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('UserConfigSchema', () => {
    it('should validate minimal user config', () => {
      const minimal = {};
      
      const result = UserConfigSchema.safeParse(minimal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.internalScopes).toEqual(['@repo']);
        expect(result.data.defaultPackageManager).toBe('pnpm');
        expect(result.data.preview.defaultLines).toBe(80);
      }
    });

    it('should validate custom user config', () => {
      const custom = {
        internalScopes: ['@company', '@internal'],
        defaultPackageManager: 'bun',
        preview: {
          defaultLines: 100,
        },
      };
      
      const result = UserConfigSchema.safeParse(custom);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(custom);
      }
    });

    it('should reject invalid package manager', () => {
      const invalid = {
        defaultPackageManager: 'invalid-pm',
      };
      
      const result = UserConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject negative preview lines', () => {
      const invalid = {
        preview: {
          defaultLines: -10,
        },
      };
      
      const result = UserConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('SwJsonSchema', () => {
    it('should validate minimal sw.json', () => {
      const minimal = {
        type: 'template',
        slug: 'my-template',
        name: 'My Template',
      };
      
      const result = SwJsonSchema.safeParse(minimal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual([]);
        expect(result.data.requiredEnv).toEqual([]);
      }
    });

    it('should validate complete sw.json', () => {
      const complete = {
        type: 'package',
        slug: 'my-package',
        name: 'My Package',
        description: 'A test package',
        tags: ['test', 'example'],
        requiredEnv: [
          {
            name: 'API_KEY',
            description: 'API key for service',
            example: 'sk_test_...',
          },
        ],
        view: [
          { path: 'README.md', lines: 'all' },
          { path: 'src/index.ts', lines: [1, 50] },
          { tree: { path: 'src', depth: 2, limit: 100 } },
        ],
      };
      
      const result = SwJsonSchema.safeParse(complete);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(complete);
      }
    });

    it('should reject invalid type', () => {
      const invalid = {
        type: 'invalid',
        slug: 'my-template',
        name: 'My Template',
      };
      
      const result = SwJsonSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalid = {
        type: 'template',
        name: 'My Template',
      };
      
      const result = SwJsonSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should validate view entries', () => {
      const withView = {
        type: 'template',
        slug: 'test',
        name: 'Test',
        view: [
          { path: 'file.ts', lines: [10, 20] },
          { tree: { path: 'src' } },
        ],
      };
      
      const result = SwJsonSchema.safeParse(withView);
      expect(result.success).toBe(true);
    });

    it('should reject invalid line ranges', () => {
      const invalid = {
        type: 'template',
        slug: 'test',
        name: 'Test',
        view: [
          { path: 'file.ts', lines: [-1, 20] },
        ],
      };
      
      const result = SwJsonSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('ArtifactSchema', () => {
    it('should validate complete artifact', () => {
      const artifact = {
        slug: 'templates/my-template',
        id: 'my-template',
        type: 'template',
        relPath: 'apps/my-template',
        absPath: '/path/to/sw/apps/my-template',
        sw: {
          type: 'template',
          slug: 'my-template',
          name: 'My Template',
          tags: [],
          requiredEnv: [],
        },
        packageJson: {
          name: '@repo/my-template',
          version: '1.0.0',
        },
      };
      
      const result = ArtifactSchema.safeParse(artifact);
      expect(result.success).toBe(true);
    });

    it('should validate artifact without repo field', () => {
      const artifact = {
        slug: 'packages/my-package',
        id: 'my-package',
        type: 'package',
        relPath: 'packages/my-package',
        absPath: '/path/to/sw/packages/my-package',
        sw: {
          type: 'package',
          slug: 'my-package',
          name: 'My Package',
          tags: [],
          requiredEnv: [],
        },
        packageJson: {},
      };
      
      const result = ArtifactSchema.safeParse(artifact);
      expect(result.success).toBe(true);
    });
  });
});