/**
 * SAD-85 (Step 7a) — prototype-only annotations never reach the plugin UI.
 *
 * The prototype labels its demo controls ("Feature 10", "(simulated)", "UI-only",
 * "19 types — spec §2.2–§2.4", a SIMULATED badge). The plugin copies the prototype's look, not
 * those notes: no user-facing string in src/ may carry them. Code comments may still cite spec
 * sections, so comments are stripped before the scan.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ANNOTATION = /Feature \d|simulated|UI-only|spec §/i;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.ts$/.test(entry.name) ? [full] : [];
  });
}

/**
 * Blank block comments (keeping their newlines, so line numbers hold) and drop line comments;
 * `//` inside a string (a URL) only ever removes more text.
 */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, '')).replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

describe('SAD-85 — no prototype annotations in plugin strings', () => {
  it('strips comments but keeps code and strings', () => {
    const code = "/** spec §12 */\nconst a = 'Feature 3'; // simulated\nconst u = 'https://x.y';";
    const stripped = stripComments(code);
    expect(stripped).toContain("'Feature 3'");
    expect(stripped).not.toMatch(/spec §|simulated/);
    expect(stripped).toContain("'https:");
  });

  it('finds no "Feature N", "simulated", "UI-only" or "spec §" outside comments in src/', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(path.resolve(process.cwd(), 'src'))) {
      stripComments(fs.readFileSync(file, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          if (ANNOTATION.test(line)) offenders.push(`${path.relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
