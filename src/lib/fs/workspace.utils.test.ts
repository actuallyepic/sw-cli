import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { findWorkspaceRoot } from './workspace.utils';

describe('workspace.utils', () => {
  let testDir: string;
  
  beforeEach(() => {
    testDir = join(tmpdir(), `workspace-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });
  
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('findWorkspaceRoot', () => {
    it('should find workspace root with turbo.json', () => {
      // Create a turborepo structure
      const workspaceRoot = join(testDir, 'my-turborepo');
      const subDir = join(workspaceRoot, 'apps', 'web');
      
      mkdirSync(subDir, { recursive: true });
      writeFileSync(join(workspaceRoot, 'turbo.json'), '{}');
      
      // Test from subdirectory
      const result = findWorkspaceRoot(subDir);
      expect(result).toBe(workspaceRoot);
    });
    
    it('should find workspace root with pnpm-workspace.yaml', () => {
      const workspaceRoot = join(testDir, 'my-pnpm-workspace');
      const subDir = join(workspaceRoot, 'packages', 'utils');
      
      mkdirSync(subDir, { recursive: true });
      writeFileSync(join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"');
      
      const result = findWorkspaceRoot(subDir);
      expect(result).toBe(workspaceRoot);
    });
    
    it('should find workspace root with npm workspaces in package.json', () => {
      const workspaceRoot = join(testDir, 'my-npm-workspace');
      const subDir = join(workspaceRoot, 'apps', 'api');
      
      mkdirSync(subDir, { recursive: true });
      writeFileSync(
        join(workspaceRoot, 'package.json'),
        JSON.stringify({ workspaces: ['apps/*', 'packages/*'] })
      );
      
      const result = findWorkspaceRoot(subDir);
      expect(result).toBe(workspaceRoot);
    });
    
    it('should return current directory if no workspace markers found', () => {
      const isolatedDir = join(testDir, 'isolated');
      mkdirSync(isolatedDir, { recursive: true });
      
      // Mock process.cwd to return our test directory
      const originalCwd = process.cwd;
      process.cwd = () => isolatedDir;
      
      const result = findWorkspaceRoot(isolatedDir);
      expect(result).toBe(isolatedDir);
      
      // Restore original process.cwd
      process.cwd = originalCwd;
    });
    
    it('should handle deeply nested directories', () => {
      const workspaceRoot = join(testDir, 'deep-workspace');
      const deepDir = join(workspaceRoot, 'apps', 'web', 'src', 'components', 'ui');
      
      mkdirSync(deepDir, { recursive: true });
      writeFileSync(join(workspaceRoot, 'turbo.json'), '{}');
      
      const result = findWorkspaceRoot(deepDir);
      expect(result).toBe(workspaceRoot);
    });
  });
});