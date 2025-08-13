import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArtifactScanner } from './artifact.scanner';
import { 
  createTempDir, 
  cleanupTempDir, 
  createMockConfig, 
  createMockSwJson,
  createMockArtifact,
  createMockMonorepo
} from '../../../tests/utils/test-helpers';
import { join } from 'path';
import { mkdir } from 'fs/promises';

describe('ArtifactScanner', () => {
  let tempRootPath: string;
  let scanner: ArtifactScanner;

  beforeEach(async () => {
    tempRootPath = await createTempDir();
    
    const config = createMockConfig();
    config.env.SW_ROOT = tempRootPath;
    
    scanner = new ArtifactScanner(config);
  });

  afterEach(async () => {
    await cleanupTempDir(tempRootPath);
  });

  describe('scanArtifacts', () => {
    it('should find no artifacts in empty repositories', async () => {
      const artifacts = await scanner.scanArtifacts();
      expect(artifacts).toEqual([]);
    });

    it('should find template artifacts', async () => {
      // Create monorepo structure
      await createMockMonorepo(tempRootPath);
      
      // Create a template artifact
      await createMockArtifact(
        join(tempRootPath, 'apps'),
        'my-template',
        createMockSwJson({
          type: 'template',
          slug: 'my-template',
          name: 'My Template',
        })
      );
      
      const artifacts = await scanner.scanArtifacts('templates');
      
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].slug).toBe('templates/my-template');
      expect(artifacts[0].type).toBe('template');
      expect(artifacts[0].sw.name).toBe('My Template');
    });

    it('should find package artifacts', async () => {
      // Create monorepo structure
      await createMockMonorepo(tempRootPath);
      
      // Create a package artifact
      await createMockArtifact(
        join(tempRootPath, 'packages'),
        'my-package',
        createMockSwJson({
          type: 'package',
          slug: 'my-package',
          name: 'My Package',
        })
      );
      
      const artifacts = await scanner.scanArtifacts('packages');
      
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].slug).toBe('packages/my-package');
      expect(artifacts[0].type).toBe('package');
    });

    it('should find both templates and packages with "all" scope', async () => {
      // Create monorepo structure
      await createMockMonorepo(tempRootPath);
      
      await createMockArtifact(
        join(tempRootPath, 'apps'),
        'template1',
        createMockSwJson({ slug: 'template1', type: 'template' })
      );
      
      await createMockArtifact(
        join(tempRootPath, 'packages'),
        'package1',
        createMockSwJson({ slug: 'package1', type: 'package' })
      );
      
      const artifacts = await scanner.scanArtifacts('all');
      
      expect(artifacts).toHaveLength(2);
      const slugs = artifacts.map(a => a.slug).sort();
      expect(slugs).toEqual(['packages/package1', 'templates/template1']);
    });

    it('should ignore directories without sw.json', async () => {
      await createMockMonorepo(tempRootPath);
      
      // Create directory without sw.json
      const { mkdir, writeFile } = await import('fs/promises');
      const dirPath = join(tempRootPath, 'apps', 'no-sw-json');
      await mkdir(dirPath, { recursive: true });
      await writeFile(
        join(dirPath, 'package.json'),
        JSON.stringify({ name: 'test' })
      );
      
      const artifacts = await scanner.scanArtifacts();
      expect(artifacts).toHaveLength(0);
    });

    it('should handle invalid sw.json gracefully', async () => {
      await createMockMonorepo(tempRootPath);
      
      // Create artifact with invalid sw.json
      const { mkdir, writeFile } = await import('fs/promises');
      const dirPath = join(tempRootPath, 'apps', 'invalid');
      await mkdir(dirPath, { recursive: true });
      await writeFile(
        join(dirPath, 'sw.json'),
        '{ invalid json }'
      );
      
      const artifacts = await scanner.scanArtifacts();
      expect(artifacts).toHaveLength(0);
    });

    it('should include package.json data', async () => {
      await createMockMonorepo(tempRootPath);
      
      await createMockArtifact(
        join(tempRootPath, 'apps'),
        'with-deps',
        createMockSwJson({ slug: 'with-deps' }),
        {
          name: '@repo/with-deps',
          version: '2.0.0',
          dependencies: {
            'react': '^18.0.0',
          },
        }
      );
      
      const artifacts = await scanner.scanArtifacts();
      
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].packageJson.name).toBe('@repo/with-deps');
      expect(artifacts[0].packageJson.version).toBe('2.0.0');
      expect(artifacts[0].packageJson.dependencies).toEqual({
        'react': '^18.0.0',
      });
    });
  });

  describe('getArtifactBySlug', () => {
    beforeEach(async () => {
      await createMockMonorepo(tempRootPath);
      await createMockArtifact(
        join(tempRootPath, 'apps'),
        'test-artifact',
        createMockSwJson({ slug: 'test-artifact' })
      );
      await scanner.scanArtifacts();
    });

    it('should find artifact by slug', () => {
      const artifact = scanner.getArtifactBySlug('templates/test-artifact');
      expect(artifact).toBeDefined();
      expect(artifact?.id).toBe('test-artifact');
    });

    it('should return undefined for non-existent slug', () => {
      const artifact = scanner.getArtifactBySlug('templates/non-existent');
      expect(artifact).toBeUndefined();
    });
  });

  describe('clearCache', () => {
    it('should clear the artifact cache', async () => {
      await createMockMonorepo(tempRootPath);
      await createMockArtifact(
        join(tempRootPath, 'apps'),
        'cached',
        createMockSwJson({ slug: 'cached' })
      );
      
      await scanner.scanArtifacts();
      expect(scanner.getArtifactBySlug('templates/cached')).toBeDefined();
      
      scanner.clearCache();
      expect(scanner.getArtifactBySlug('templates/cached')).toBeUndefined();
    });
  });

  describe('scanAllPackagesForDependencies', () => {
    it('should find all packages in the packages directory', async () => {
      await createMockMonorepo(tempRootPath);
      
      // Create multiple packages
      await createMockArtifact(
        join(tempRootPath, 'packages'),
        'pkg1',
        createMockSwJson({ slug: 'pkg1', type: 'package' })
      );
      
      await createMockArtifact(
        join(tempRootPath, 'packages'),
        'pkg2',
        createMockSwJson({ slug: 'pkg2', type: 'package' })
      );
      
      const packages = await scanner.scanAllPackagesForDependencies();
      
      expect(packages).toHaveLength(2);
      const slugs = packages.map(p => p.id).sort();
      expect(slugs).toEqual(['pkg1', 'pkg2']);
    });
  });
});