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
  let tempTemplatesPath: string;
  let tempPackagesPath: string;
  let scanner: ArtifactScanner;

  beforeEach(async () => {
    tempTemplatesPath = await createTempDir();
    tempPackagesPath = await createTempDir();
    
    const config = createMockConfig();
    config.env.SW_TEMPLATES_ROOT = tempTemplatesPath;
    config.env.SW_PACKAGES_ROOT = tempPackagesPath;
    
    scanner = new ArtifactScanner(config);
  });

  afterEach(async () => {
    await cleanupTempDir(tempTemplatesPath);
    await cleanupTempDir(tempPackagesPath);
  });

  describe('scanArtifacts', () => {
    it('should find no artifacts in empty repositories', async () => {
      const artifacts = await scanner.scanArtifacts();
      expect(artifacts).toEqual([]);
    });

    it('should find template artifacts', async () => {
      // Create template monorepo structure
      await createMockMonorepo(tempTemplatesPath);
      
      // Create a template artifact
      await createMockArtifact(
        join(tempTemplatesPath, 'apps'),
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
      // Create packages monorepo structure
      await createMockMonorepo(tempPackagesPath);
      
      // Create a package artifact
      await createMockArtifact(
        join(tempPackagesPath, 'packages'),
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
      // Only create apps directory for templates repo
      await mkdir(join(tempTemplatesPath, 'apps'), { recursive: true });
      
      // Create packages monorepo
      await createMockMonorepo(tempPackagesPath);
      
      await createMockArtifact(
        join(tempTemplatesPath, 'apps'),
        'template1',
        createMockSwJson({ slug: 'template1', type: 'template' })
      );
      
      await createMockArtifact(
        join(tempPackagesPath, 'packages'),
        'package1',
        createMockSwJson({ slug: 'package1', type: 'package' })
      );
      
      const artifacts = await scanner.scanArtifacts('all');
      
      expect(artifacts).toHaveLength(2);
      const slugs = artifacts.map(a => a.slug).sort();
      expect(slugs).toEqual(['packages/package1', 'templates/template1']);
    });

    it('should ignore directories without sw.json', async () => {
      await createMockMonorepo(tempTemplatesPath);
      
      // Create directory without sw.json
      const { mkdir, writeFile } = await import('fs/promises');
      const dirPath = join(tempTemplatesPath, 'apps', 'no-sw-json');
      await mkdir(dirPath, { recursive: true });
      await writeFile(
        join(dirPath, 'package.json'),
        JSON.stringify({ name: 'test' })
      );
      
      const artifacts = await scanner.scanArtifacts();
      expect(artifacts).toHaveLength(0);
    });

    it('should handle invalid sw.json gracefully', async () => {
      await createMockMonorepo(tempTemplatesPath);
      
      // Create artifact with invalid sw.json
      const { mkdir, writeFile } = await import('fs/promises');
      const dirPath = join(tempTemplatesPath, 'apps', 'invalid');
      await mkdir(dirPath, { recursive: true });
      await writeFile(
        join(dirPath, 'sw.json'),
        '{ invalid json }'
      );
      
      const artifacts = await scanner.scanArtifacts();
      expect(artifacts).toHaveLength(0);
    });

    it('should include package.json data', async () => {
      await createMockMonorepo(tempTemplatesPath);
      
      await createMockArtifact(
        join(tempTemplatesPath, 'apps'),
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
      await createMockMonorepo(tempTemplatesPath);
      await createMockArtifact(
        join(tempTemplatesPath, 'apps'),
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
      await createMockMonorepo(tempTemplatesPath);
      await createMockArtifact(
        join(tempTemplatesPath, 'apps'),
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
    it('should find packages in both repos including templates/packages', async () => {
      await createMockMonorepo(tempTemplatesPath);
      await createMockMonorepo(tempPackagesPath);
      
      // Create package in templates repo (should be found by this method)
      await createMockArtifact(
        join(tempTemplatesPath, 'packages'),
        'internal-pkg',
        createMockSwJson({ slug: 'internal-pkg', type: 'package' })
      );
      
      // Create package in packages repo
      await createMockArtifact(
        join(tempPackagesPath, 'packages'),
        'external-pkg',
        createMockSwJson({ slug: 'external-pkg', type: 'package' })
      );
      
      const packages = await scanner.scanAllPackagesForDependencies();
      
      expect(packages).toHaveLength(2);
      const slugs = packages.map(p => p.id).sort();
      expect(slugs).toEqual(['external-pkg', 'internal-pkg']);
    });
  });
});