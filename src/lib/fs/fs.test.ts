import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileLines, getFileSize, formatFileSize } from './fs.utils';
import { copyDirectory, copyArtifacts } from './fs.copy';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { createTempDir, cleanupTempDir } from '../../../tests/utils/test-helpers';

describe('File System Utilities', () => {
  describe('fs.utils', () => {
    let tempDir: string;
    let testFile: string;

    beforeEach(async () => {
      tempDir = await createTempDir();
      testFile = join(tempDir, 'test.txt');
      
      // Create test file with multiple lines
      const content = [
        'Line 1',
        'Line 2',
        'Line 3',
        'Line 4',
        'Line 5',
      ].join('\n');
      
      await writeFile(testFile, content);
    });

    afterEach(async () => {
      await cleanupTempDir(tempDir);
    });

    describe('readFileLines', () => {
      it('should read all lines by default', async () => {
        const lines = await readFileLines(testFile);
        
        expect(lines).toHaveLength(5);
        expect(lines[0]).toBe('Line 1');
        expect(lines[4]).toBe('Line 5');
      });

      it('should read specific line range', async () => {
        const lines = await readFileLines(testFile, {
          startLine: 2,
          endLine: 4,
        });
        
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('Line 2');
        expect(lines[2]).toBe('Line 4');
      });

      it('should handle out-of-bounds ranges', async () => {
        const lines = await readFileLines(testFile, {
          startLine: 3,
          endLine: 10,
        });
        
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('Line 3');
        expect(lines[2]).toBe('Line 5');
      });

      it('should handle negative start line', async () => {
        const lines = await readFileLines(testFile, {
          startLine: -1,
          endLine: 2,
        });
        
        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe('Line 1');
        expect(lines[1]).toBe('Line 2');
      });

      it('should throw error for non-existent file', async () => {
        await expect(
          readFileLines(join(tempDir, 'non-existent.txt'))
        ).rejects.toThrow('File not found');
      });
    });

    describe('getFileSize', () => {
      it('should return correct file size', async () => {
        const size = await getFileSize(testFile);
        
        // 5 lines with 6 chars each + 4 newlines = 34 bytes
        expect(size).toBe(34);
      });
    });

    describe('formatFileSize', () => {
      it('should format bytes', () => {
        expect(formatFileSize(500)).toBe('500.0 B');
      });

      it('should format kilobytes', () => {
        expect(formatFileSize(1500)).toBe('1.5 KB');
      });

      it('should format megabytes', () => {
        expect(formatFileSize(1500000)).toBe('1.4 MB');
      });

      it('should format gigabytes', () => {
        expect(formatFileSize(1500000000)).toBe('1.4 GB');
      });
    });
  });

  describe('fs.copy', () => {
    let sourceDir: string;
    let destDir: string;

    beforeEach(async () => {
      sourceDir = await createTempDir();
      destDir = await createTempDir();
      
      // Create source structure
      await mkdir(join(sourceDir, 'src'), { recursive: true });
      await writeFile(join(sourceDir, 'package.json'), '{"name": "test"}');
      await writeFile(join(sourceDir, 'src', 'index.ts'), 'export {}');
    });

    afterEach(async () => {
      await cleanupTempDir(sourceDir);
      await cleanupTempDir(destDir);
    });

    describe('copyDirectory', () => {
      it('should copy directory recursively', async () => {
        const dest = join(destDir, 'copied');
        const result = await copyDirectory(sourceDir, dest);
        
        // Debug: log the actual result
        if (result.action !== 'copied') {
          console.log('Copy failed:', result);
        }
        
        expect(result.action).toBe('copied');
        expect(existsSync(dest)).toBe(true);
        expect(existsSync(join(dest, 'package.json'))).toBe(true);
        expect(existsSync(join(dest, 'src', 'index.ts'))).toBe(true);
      });

      it('should skip if destination exists without overwrite', async () => {
        const dest = join(destDir, 'existing');
        await mkdir(dest);
        
        const result = await copyDirectory(sourceDir, dest);
        
        expect(result.action).toBe('skipped');
        expect(result.error).toContain('already exists');
      });

      it('should overwrite if flag is set', async () => {
        const dest = join(destDir, 'overwrite');
        await mkdir(dest);
        await writeFile(join(dest, 'old.txt'), 'old content');
        
        const result = await copyDirectory(sourceDir, dest, {
          overwrite: true,
        });
        
        expect(result.action).toBe('overwritten');
        expect(existsSync(join(dest, 'package.json'))).toBe(true);
      });

      it('should handle dry-run mode', async () => {
        const dest = join(destDir, 'dry-run');
        
        const result = await copyDirectory(sourceDir, dest, {
          dryRun: true,
        });
        
        expect(result.action).toBe('would-copy');
        expect(existsSync(dest)).toBe(false);
      });

      it('should handle non-existent source', async () => {
        const result = await copyDirectory(
          join(sourceDir, 'non-existent'),
          join(destDir, 'dest')
        );
        
        expect(result.action).toBe('skipped');
        expect(result.error).toContain('does not exist');
      });
    });

    describe('copyArtifacts', () => {
      it('should copy multiple artifacts', async () => {
        const artifacts = [
          {
            source: sourceDir,
            destination: join(destDir, 'artifact1'),
          },
          {
            source: sourceDir,
            destination: join(destDir, 'artifact2'),
          },
        ];
        
        const results = await copyArtifacts(artifacts);
        
        expect(results).toHaveLength(2);
        expect(results[0].action).toBe('copied');
        expect(results[1].action).toBe('copied');
        expect(existsSync(join(destDir, 'artifact1'))).toBe(true);
        expect(existsSync(join(destDir, 'artifact2'))).toBe(true);
      });

      it('should handle mixed success and failure', async () => {
        const artifacts = [
          {
            source: sourceDir,
            destination: join(destDir, 'success'),
          },
          {
            source: join(sourceDir, 'non-existent'),
            destination: join(destDir, 'failure'),
          },
        ];
        
        const results = await copyArtifacts(artifacts);
        
        expect(results).toHaveLength(2);
        expect(results[0].action).toBe('copied');
        expect(results[1].action).toBe('skipped');
        expect(results[1].error).toBeDefined();
      });
    });
  });
});