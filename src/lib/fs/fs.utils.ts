import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';

export interface FileReadOptions {
  startLine?: number;
  endLine?: number;
}

export async function readFileLines(
  filePath: string,
  options: FileReadOptions = {}
): Promise<string[]> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  const { startLine = 1, endLine = lines.length } = options;
  
  // Convert to 0-based index
  const start = Math.max(0, startLine - 1);
  const end = Math.min(lines.length, endLine);
  
  return lines.slice(start, end);
}

export async function getFileSize(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.size;
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}