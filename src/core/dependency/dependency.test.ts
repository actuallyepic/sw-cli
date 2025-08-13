import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DependencyResolver } from './dependency.resolver';
import { ArtifactScanner } from '../artifact/artifact.scanner';
import { createMockConfig, createMockSwJson } from '../../../tests/utils/test-helpers';
import { Artifact } from '../config/config.schema';

describe('DependencyResolver', () => {
  let resolver: DependencyResolver;
  let mockScanner: ArtifactScanner;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = createMockConfig();
    mockScanner = new ArtifactScanner(mockConfig);
    resolver = new DependencyResolver(mockConfig, mockScanner);
  });

  describe('resolve', () => {
    it('should resolve artifact with no dependencies', async () => {
      const artifact: Artifact = {
        slug: 'templates/simple',
        id: 'simple',
        type: 'template',
        relPath: 'apps/simple',
        absPath: '/path/to/simple',
        sw: createMockSwJson({ slug: 'simple' }),
        packageJson: {
          name: '@repo/simple',
          version: '1.0.0',
        },
      };

      // Mock scanner to return empty artifacts
      vi.spyOn(mockScanner, 'scanArtifacts').mockResolvedValue([artifact]);

      const graph = await resolver.resolve(artifact);

      expect(graph.root).toBe(artifact);
      expect(graph.dependencies.size).toBe(0);
      expect(graph.order).toEqual([artifact]);
    });

    it('should classify internal dependencies correctly', async () => {
      const mainArtifact: Artifact = {
        slug: 'templates/main',
        id: 'main',
        type: 'template',
        relPath: 'apps/main',
        absPath: '/path/to/main',
        sw: createMockSwJson({ slug: 'main' }),
        packageJson: {
          name: '@repo/main',
          version: '1.0.0',
          dependencies: {
            '@repo/utils': 'workspace:*',
            'react': '^18.0.0',
          },
        },
      };

      const utilsArtifact: Artifact = {
        slug: 'templates/utils',
        id: 'utils',
        type: 'package',
        relPath: 'packages/utils',
        absPath: '/path/to/utils',
        sw: createMockSwJson({ slug: 'utils', type: 'package' }),
        packageJson: {
          name: '@repo/utils',
          version: '1.0.0',
        },
      };

      vi.spyOn(mockScanner, 'scanArtifacts').mockResolvedValue([
        mainArtifact,
        utilsArtifact,
      ]);

      const graph = await resolver.resolve(mainArtifact);
      const deps = Array.from(graph.dependencies.values());

      expect(deps).toHaveLength(2);
      
      const internalDep = deps.find(d => d.name === '@repo/utils');
      expect(internalDep?.type).toBe('internal');
      expect(internalDep?.artifact).toBe(utilsArtifact);

      const externalDep = deps.find(d => d.name === 'react');
      expect(externalDep?.type).toBe('external');
      expect(externalDep?.artifact).toBeUndefined();
    });

    it('should handle transitive dependencies', async () => {
      const appArtifact: Artifact = {
        slug: 'templates/app',
        id: 'app',
        type: 'template',
        relPath: 'apps/app',
        absPath: '/path/to/app',
        sw: createMockSwJson({ slug: 'app' }),
        packageJson: {
          name: '@repo/app',
          dependencies: {
            '@repo/ui': 'workspace:*',
          },
        },
      };

      const uiArtifact: Artifact = {
        slug: 'templates/ui',
        id: 'ui',
        type: 'package',
        relPath: 'packages/ui',
        absPath: '/path/to/ui',
        sw: createMockSwJson({ slug: 'ui', type: 'package' }),
        packageJson: {
          name: '@repo/ui',
          dependencies: {
            '@repo/utils': 'workspace:*',
          },
        },
      };

      const utilsArtifact: Artifact = {
        slug: 'templates/utils',
        id: 'utils',
        type: 'package',
        relPath: 'packages/utils',
        absPath: '/path/to/utils',
        sw: createMockSwJson({ slug: 'utils', type: 'package' }),
        packageJson: {
          name: '@repo/utils',
        },
      };

      vi.spyOn(mockScanner, 'scanArtifacts').mockResolvedValue([
        appArtifact,
        uiArtifact,
        utilsArtifact,
      ]);

      const graph = await resolver.resolve(appArtifact);

      // Should include all transitive dependencies
      const internalDeps = resolver.getInternalDependencies(graph);
      expect(internalDeps).toHaveLength(2);
      expect(internalDeps.map(d => d.id).sort()).toEqual(['ui', 'utils']);
    });

    it('should handle circular dependencies gracefully', async () => {
      const artifact1: Artifact = {
        slug: 'templates/circular1',
        id: 'circular1',
        type: 'package',
        relPath: 'packages/circular1',
        absPath: '/path/to/circular1',
        sw: createMockSwJson({ slug: 'circular1', type: 'package' }),
        packageJson: {
          name: '@repo/circular1',
          dependencies: {
            '@repo/circular2': 'workspace:*',
          },
        },
      };

      const artifact2: Artifact = {
        slug: 'templates/circular2',
        id: 'circular2',
        type: 'package',
        relPath: 'packages/circular2',
        absPath: '/path/to/circular2',
        sw: createMockSwJson({ slug: 'circular2', type: 'package' }),
        packageJson: {
          name: '@repo/circular2',
          dependencies: {
            '@repo/circular1': 'workspace:*',
          },
        },
      };

      vi.spyOn(mockScanner, 'scanArtifacts').mockResolvedValue([
        artifact1,
        artifact2,
      ]);

      // Mock console.warn to check if warning is logged
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const graph = await resolver.resolve(artifact1);

      // Should handle circular dependency without infinite loop
      expect(graph).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circular dependency detected')
      );

      warnSpy.mockRestore();
    });
  });

  describe('getInternalDependencies', () => {
    it('should return only internal dependencies', async () => {
      const artifact: Artifact = {
        slug: 'templates/mixed',
        id: 'mixed',
        type: 'template',
        relPath: 'apps/mixed',
        absPath: '/path/to/mixed',
        sw: createMockSwJson({ slug: 'mixed' }),
        packageJson: {
          name: '@repo/mixed',
          dependencies: {
            '@repo/internal': 'workspace:*',
            'external-package': '^1.0.0',
          },
        },
      };

      const internalArtifact: Artifact = {
        slug: 'templates/internal',
        id: 'internal',
        type: 'package',
        relPath: 'packages/internal',
        absPath: '/path/to/internal',
        sw: createMockSwJson({ slug: 'internal', type: 'package' }),
        packageJson: {
          name: '@repo/internal',
        },
      };

      vi.spyOn(mockScanner, 'scanArtifacts').mockResolvedValue([
        artifact,
        internalArtifact,
      ]);

      const graph = await resolver.resolve(artifact);
      const internalDeps = resolver.getInternalDependencies(graph);

      expect(internalDeps).toHaveLength(1);
      expect(internalDeps[0]).toBe(internalArtifact);
    });
  });

  describe('getExternalDependencies', () => {
    it('should return only external dependencies', async () => {
      const artifact: Artifact = {
        slug: 'templates/external',
        id: 'external',
        type: 'template',
        relPath: 'apps/external',
        absPath: '/path/to/external',
        sw: createMockSwJson({ slug: 'external' }),
        packageJson: {
          name: '@repo/external',
          dependencies: {
            'react': '^18.0.0',
            'next': '^14.0.0',
            '@repo/internal': 'workspace:*',
          },
        },
      };

      vi.spyOn(mockScanner, 'scanArtifacts').mockResolvedValue([artifact]);

      const graph = await resolver.resolve(artifact);
      const externalDeps = resolver.getExternalDependencies(graph);

      expect(externalDeps).toHaveLength(2);
      expect(externalDeps.sort()).toEqual(['next@^14.0.0', 'react@^18.0.0']);
    });
  });
});