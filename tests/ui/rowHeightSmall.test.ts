/**
 * SAD-112 — the three row-height settings must look different.
 *
 * Before: Small and Medium both used a 34px capsule (pitch 50), so the setting did nothing
 * visible between them. The fix gives Small a 28px capsule (pitch 44) via the `.tablify--rh-small`
 * hook in styles.css. Medium (34px) and Large (40px) must not change.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'styles.css'), 'utf8');
// Strip comments first so a comment before a rule does not become part of its selector.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

/** Declarations of the first rule whose selector list contains `selector` exactly. */
function declarationsFor(selector: string): string | null {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const selectors = m[1].split(',').map((x) => x.trim());
    if (selectors.includes(selector)) return m[2];
  }
  return null;
}

describe('SAD-112 — Small row height is distinct', () => {
  it('Small capsule is 28px tall', () => {
    const decl = declarationsFor('.tablify--rh-small .tablify__capsule');
    expect(decl).not.toBeNull();
    expect(decl).toMatch(/height:\s*28px/);
  });

  it('Small keeps the 4px / 14px padding (16px text fits 28px minus borders)', () => {
    const decl = declarationsFor('.tablify--rh-small .tablify__capsule') ?? '';
    expect(decl).toMatch(/padding:\s*4px\s+14px/);
  });

  it('the default capsule (Medium) stays 34px and Large stays 40px', () => {
    expect(declarationsFor('.tablify__capsule')).toMatch(/height:\s*34px/);
    expect(declarationsFor('.tablify--rh-large .tablify__capsule')).toMatch(/height:\s*40px/);
  });
});
