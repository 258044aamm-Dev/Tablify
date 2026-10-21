/**
 * SAD-376 — the stylesheet contract for the expand affordance.
 *
 * The ticket's hardest requirement is the quiet one: *preserve the existing ellipsis and do not
 * disrupt the layout or the cell's interactions*. That is a CSS promise, so it is pinned in CSS,
 * with the same one-level `@media` reader `hoverGrips.test.ts` uses:
 *
 *  - at rest the control is invisible **and inert** (`pointer-events: none`), so a click on the
 *    cell is still only a click on the cell;
 *  - it is revealed only where a pointer can hover, and becomes clickable in the same rule;
 *  - a coarse pointer gets the reveal only through the plugin's own class;
 *  - nothing here sets a size, padding or margin on `.tablify__cell-text` or `.tablify__capsule`,
 *    which is what keeps the ellipsis and the row pitch exactly as they are.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

interface CssRule {
  selectors: string[];
  body: string;
  media: string | null;
}

/** Minimal CSS reader: top-level rules and rules one `@media` level deep. Comments removed. */
function readRules(css: string): CssRule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: CssRule[] = [];
  const walk = (text: string, media: string | null): void => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const prelude = text.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      const body = text.slice(open + 1, j - 1);
      if (prelude.startsWith('@media')) {
        walk(body, prelude.replace(/^@media\s*/, ''));
      } else if (!prelude.startsWith('@')) {
        out.push({ selectors: prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), body, media });
      }
      i = j;
    }
  };
  walk(src, null);
  return out;
}

const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');
const rules = readRules(css);

/** Declarations of every rule whose selector list contains `selector` and whose media matches. */
function declarations(selector: string, media: string | null = null): string[] {
  return rules
    .filter((r) => r.media === media && r.selectors.includes(selector))
    .map((r) => r.body);
}

function decl(selector: string, property: string, media: string | null = null): string | null {
  const bodies = declarations(selector, media);
  const match = bodies
    .map((b) => new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'm').exec(b)?.[1]?.trim())
    .filter((v): v is string => !!v);
  return match.length > 0 ? (match[match.length - 1] as string) : null;
}

const CONTROL = '.tablify__cell-expand';

describe('SAD-376 — the control is inert at rest', () => {
  it('is invisible and cannot take a press', () => {
    expect(decl(CONTROL, 'opacity')).toBe('0');
    expect(decl(CONTROL, 'pointer-events')).toBe('none');
  });

  it('is taken out of the layout, so it cannot move the text or the row', () => {
    expect(decl(CONTROL, 'position')).toBe('absolute');
    // No flex participation and no size on the value span or the capsule.
    expect(decl('.tablify__cell--overflow > .tablify__capsule', 'position')).toBe('relative');
  });

  it('fits every row height (28 / 34 / 40 px capsules)', () => {
    const height = Number.parseInt(decl(CONTROL, 'height') ?? '0', 10);
    expect(height).toBeGreaterThan(0);
    // A small row's capsule is 28px with 4px padding top and bottom.
    expect(height).toBeLessThanOrEqual(20);
  });
});

describe('SAD-376 — reveal follows the grips', () => {
  it('is revealed on hover only where a pointer can hover', () => {
    expect(decl('.tablify__cell--overflow:hover > .tablify__capsule > .tablify__cell-expand', 'opacity', '(hover: hover)')).toBe('1');
    expect(
      decl('.tablify__cell--overflow:hover > .tablify__capsule > .tablify__cell-expand', 'pointer-events', '(hover: hover)'),
    ).toBe('auto');
    // No unqualified :hover rule outside that block.
    expect(decl('.tablify__cell--overflow:hover > .tablify__capsule > .tablify__cell-expand', 'opacity')).toBeNull();
  });

  it('is reachable by keyboard in every mode', () => {
    expect(decl(`${CONTROL}:focus-visible`, 'opacity')).toBe('1');
    expect(decl(`${CONTROL}:focus-visible`, 'outline')).toContain('--tablify-focus');
  });

  it('keeps the control visible on a coarse pointer only when the plugin class is present', () => {
    const selectors = rules
      .filter((r) => r.media === '(hover: none)')
      .flatMap((r) => r.selectors);
    expect(selectors).toContain('.tablify--overflow-touch .tablify__cell-expand');
    // Nothing is revealed on touch without that class.
    expect(selectors).not.toContain(CONTROL);
  });

  it('drops the transition under reduce motion', () => {
    const reduce = rules.filter((r) => r.media === '(prefers-reduced-motion: reduce)');
    expect(reduce.some((r) => r.selectors.includes(CONTROL) && /transition\s*:\s*none/.test(r.body))).toBe(true);
  });
});

describe('SAD-376 — the ellipsis and the row geometry are untouched', () => {
  /** Golden values: if this feature ever moves the text box or the row pitch, these fail. */
  it('keeps the ellipsis, the clamp and the capsule box exactly as they were', () => {
    expect(decl('.tablify__cell-text', 'text-overflow')).toBe('ellipsis');
    expect(decl('.tablify__cell-text', 'white-space')).toBe('nowrap');
    expect(decl('.tablify__cell-text', 'overflow')).toBe('hidden');
    expect(decl('.tablify__cell-text', 'font-size')).toBe('12px');

    expect(decl('.tablify__capsule', 'height')).toBe('34px');
    expect(decl('.tablify__capsule', 'padding')).toBe('8px 14px');
    expect(decl('.tablify--rh-small .tablify__capsule', 'height')).toBe('28px');
    expect(decl('.tablify--rh-large .tablify__capsule', 'height')).toBe('40px');

    expect(decl('.tablify__cell--long-text .tablify__cell-text', '-webkit-line-clamp')).toBe('2');
    expect(decl('.tablify__cell--long-text .tablify__cell-text', 'text-overflow')).toBe('clip');
  });

  it('adds no size to the slot or the row', () => {
    // `.tablify__cell` is padding only; `.tablify__row` gets its height from JS, not from CSS.
    expect(decl('.tablify__cell', 'padding')).toBe('4px');
    expect(decl('.tablify__cell', 'height')).toBeNull();
    expect(decl('.tablify__row', 'height')).toBeNull();
  });
});

describe('SAD-376 — the panel', () => {
  it('is the shared float-panel layer, wider but still viewport-bound', () => {
    expect(decl('.tablify__panel--overflow', 'width')).toBe('360px');
    expect(decl('.tablify__panel--overflow', 'max-width')).toContain('100vw');
  });

  it('wraps the full value and caps its height with a scroll', () => {
    expect(decl('.tablify__overflow-text', 'white-space')).toBe('pre-wrap');
    expect(decl('.tablify__overflow-text', 'overflow-wrap')).toBe('anywhere');
    expect(decl('.tablify__overflow-text', 'overflow')).toBe('auto');
    expect(decl('.tablify__overflow-text', 'max-height')).toContain('vh');
  });

  it('uses plugin tokens only — no Obsidian theme variables', () => {
    const bodies = rules
      .filter((r) => r.selectors.some((s) => s.includes('tablify__overflow') || s.includes('tablify__panel--overflow')))
      .map((r) => r.body)
      .join('\n');
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies).not.toMatch(/var\(--(?!tablify-)/);
  });
});
