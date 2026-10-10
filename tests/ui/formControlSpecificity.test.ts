/**
 * SAD-71 Step 1 — host-theme leak guard.
 *
 * Obsidian ships element-qualified form rules (e.g. `input[type='search']`, specificity
 * 0,1,1) that beat a bare class selector (0,1,0). In v1.0.1 the search and query inputs
 * therefore rendered with the *host* theme's form-field background and corner radius —
 * a direct violation of spec/branding.md §3 ("apply regardless of the user's Obsidian
 * theme"). Every form-control rule we ship must be scoped so the plugin wins: an element
 * qualifier inside a Tablify class scope (≥ 0,2,1).
 *
 * Fails on cafbd17 (bare `.tablify__search-input` / `.tablify__query-input` rules).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/** Split a stylesheet into (selector, body) pairs, ignoring comments and at-rules. */
function ruleSelectors(css: string): string[] {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors: string[] = [];
  const re = /(^|})\s*([^{}]+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(noComments)) !== null) {
    const sel = m[2].trim();
    if (sel.startsWith('@')) continue;
    selectors.push(sel);
  }
  return selectors;
}

describe('SAD-71 — form-control selectors outrank Obsidian element rules', () => {
  const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');

  it('scopes every input/select/textarea rule under a Tablify class with an element qualifier', () => {
    const offenders: string[] = [];
    for (const group of ruleSelectors(css)) {
      for (const sel of group.split(',')) {
        const s = sel.trim();
        // Element token only — a class name that merely contains "select" (e.g.
        // .tablify__option-select) is not an element selector and must not match.
        if (!/(^|[\s,>+~(])(input|select|textarea)(?=[.[:\s,>+~)]|$)/.test(s)) continue;
        // Must contain both a .tablify scope and an element qualifier, e.g.
        // `.tablify__toolbar input.tablify__search-input` (0,2,1) — which beats 0,1,1.
        const scoped = /\.tablify[a-z-]*/.test(s) && /(input|select|textarea)[.[]/.test(s);
        if (!scoped) offenders.push(s);
      }
    }
    expect(
      offenders,
      `form-control selectors Obsidian can out-specify: ${offenders.join(' | ')}`,
    ).toEqual([]);
  });

  it('keeps the search and query inputs scoped inside the toolbar', () => {
    expect(css).toMatch(/\.tablify__toolbar input\.tablify__search-input/);
    expect(css).toMatch(/\.tablify__toolbar input\.tablify__query-input/);
  });
});
