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

  it('keeps the search input scoped inside the toolbar', () => {
    expect(css).toMatch(/\.tablify__toolbar input\.tablify__search-input/);
    expect(css).toMatch(/\.tablify__toolbar input\.tablify__search-input--invalid/);
  });

  // SAD-78: the separate query input merged into the "Search or query" box.
  it('SAD-78: no rules remain for the retired query input', () => {
    expect(css).not.toMatch(/tablify__query-input|tablify__query-row/);
  });

  it('SAD-78: filter builder controls are element-qualified inside .tablify', () => {
    expect(css).toMatch(/\.tablify select\.tablify__fb-input/);
    expect(css).toMatch(/\.tablify input\.tablify__fb-input/);
  });

  // SAD-76 (RC-B): Obsidian's `button:not(.clickable-icon)` is 0,1,1 (hover 0,2,1) and repainted
  // every pill with the host theme (#313244 fill, blue bold text in the owner screenshot).
  it('SAD-76: every Tablify button class is element-qualified inside the .tablify scope', () => {
    const buttonClasses = [
      'tablify__toolbar-button',
      'tablify__option-button',
      'tablify__insert-row',
      'tablify__title-link',
      'tablify__fb-button',
      'tablify__fb-add',
      'tablify__fb-remove',
      'tablify__fb-apply',
      'tablify__fb-cancel',
      'tablify__fb-clear',
      // SAD-79 header capsule
      'tablify__hc-name',
      'tablify__hc-menu',
    ];
    const offenders: string[] = [];
    for (const group of ruleSelectors(css)) {
      for (const sel of group.split(',')) {
        const s = sel.trim();
        for (const cls of buttonClasses) {
          if (!new RegExp(`\\.${cls}(?![\\w-])`).test(s)) continue;
          const ok = new RegExp(`\\.tablify\\s+button\\.${cls}(?![\\w-])`).test(s);
          if (!ok) offenders.push(s);
        }
      }
    }
    expect(offenders, `button selectors Obsidian can out-specify: ${offenders.join(' | ')}`).toEqual([]);
  });

  it('SAD-76: pill buttons reset the properties the host button rule sets', () => {
    const body = /\.tablify button\.tablify__toolbar-button\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    for (const prop of ['background', 'color', 'border', 'font-family', 'font-size', 'font-weight', 'height', 'line-height', 'box-shadow', 'padding']) {
      expect(body, `toolbar pill must set ${prop}`).toMatch(new RegExp(`(^|\\s|;)${prop}\\s*:`));
    }
  });

  // SAD-76 (RC-C): the magnifier gutter must be at the scoped specificity, or the scoped
  // `padding` shorthand wins and the icon covers the first letter.
  it('SAD-76: the search gutter is declared at the scoped specificity', () => {
    // Either a padding-left longhand or a 4-value shorthand whose left value is 40px, inside the
    // scoped (0,2,1) rule itself.
    const body = /\.tablify__toolbar input\.tablify__search-input\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const gutter = /padding-left:\s*40px/.test(body) || /padding:\s*\S+\s+\S+\s+\S+\s+40px\s*;/.test(body);
    expect(gutter, `scoped search rule must declare the 40px icon gutter: ${body}`).toBe(true);
  });

  // SAD-76 (RC-D): a `background` shorthand on a frozen capsule resets background-clip to
  // border-box and paints the 3px gutter, drawing a double ring.
  it('SAD-76: frozen capsules keep the capsule paint on the padding box', () => {
    const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*\.tablify__cell--frozen[^{}]*)\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(0);
    for (const [, sel, body] of rules) {
      if (!/background\s*:/.test(body)) continue;
      expect(body, `frozen rule ${sel.trim()} must clip the capsule to padding-box`).toMatch(/padding-box/);
    }
  });

  // SAD-76: `.tablify__options { display: flex }` overrode the [hidden] attribute, so the Options
  // popover was always open (owner screenshot).
  it('SAD-76: the hidden attribute wins over class display rules inside the plugin', () => {
    expect(css).toMatch(/\.tablify \[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
  });
});
