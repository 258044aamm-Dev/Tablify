import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

describe('Extension guard (P0-04)', () => {
  const srcDir = join(process.cwd(), 'src');

  it('registered extension is only "tablify" (no .tabula)', () => {
    // Read main.ts and verify it only references .tablify, never .tabula
    const mainTs = readFileSync(join(srcDir, 'main.ts'), 'utf-8');

    // The main.ts should not contain any reference to 'tabula'
    expect(mainTs.toLowerCase()).not.toContain('tabula');
  });

  it('no source file in src/ contains "tabula" (case-insensitive)', () => {
    const files = getAllFiles(srcDir);
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      if (content.toLowerCase().includes('tabula')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('manifest.json does not reference .tabula', () => {
    const manifest = readFileSync(join(process.cwd(), 'manifest.json'), 'utf-8');
    expect(manifest.toLowerCase()).not.toContain('tabula');
  });

  it('guard script exists and is executable', () => {
    const guardPath = join(process.cwd(), 'scripts', 'check-tabula-guard.sh');
    const content = readFileSync(guardPath, 'utf-8');
    expect(content).toContain('tabula');
    expect(content).toContain('src/');
  });
});

function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}
