/**
 * SAD-108 — drag grips are hidden until hover.
 *
 * The `#` row grip (`.tablify__lead-grip`) and the column header grip (`.tablify__hc-grip`)
 * were always visible. The rules below pin the new contract in styles.css:
 *  - at rest both grips are invisible but keep their box (no column shift);
 *  - they are revealed only where a pointer can hover (`@media (hover: hover)`), on the
 *    row / header cell being hovered;
 *  - while a drag is in progress the grip of the dragged row / column stays visible;
 *  - touch devices (`hover: none`) have no reveal rule, so they keep the grips at rest:
 *    the touch path must not lose its only visual cue for the drag handle.
 *
 * Fails on e10bd3b: neither grip has an `opacity: 0` rest state.
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
      // Find the matching close brace.
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
        out.push({
          selectors: prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
          body,
          media,
        });
      }
      i = j;
    }
  };
  walk(src, null);
  return out;
}

const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');
const rules = readRules(css);

/** Rules whose selector list contains `selector` exactly, in the given media (or none). */
function find(selector: string, media: string | null): CssRule[] {
  return rules.filter((r) => r.media === media && r.selectors.includes(selector));
}

const ROW_GRIP = '.tablify__lead-grip';
const HEADER_GRIP = '.tablify__hc-grip';
const HOVER = '(hover: hover)';

describe('SAD-108 — drag grips appear only on hover', () => {
  it('both grips are invisible at rest and keep their layout box', () => {
    for (const grip of [ROW_GRIP, HEADER_GRIP]) {
      const rest = find(grip, null);
      expect(rest.length, `${grip} has a rest rule`).toBeGreaterThan(0);
      expect(rest.some((r) => /opacity:\s*0\s*;/.test(r.body)), `${grip} rests at opacity 0`).toBe(true);
      // Hidden with opacity, not display:none, so the slot width does not change.
      expect(rest.some((r) => /display:\s*none/.test(r.body)), `${grip} is not display:none`).toBe(false);
    }
  });

  it('the row grip is revealed when its row is hovered, only on hover-capable pointers', () => {
    const reveal = find(`.tablify__row:hover > .tablify__lead--drag ${ROW_GRIP}`, HOVER);
    expect(reveal.length).toBeGreaterThan(0);
    expect(reveal.some((r) => /opacity:\s*1\s*;/.test(r.body))).toBe(true);
  });

  it('the header grip is revealed when its column header is hovered, only on hover-capable pointers', () => {
    const reveal = find(`.tablify__header-cell:hover ${HEADER_GRIP}`, HOVER);
    expect(reveal.length).toBeGreaterThan(0);
    expect(reveal.some((r) => /opacity:\s*1\s*;/.test(r.body))).toBe(true);
  });

  it('no reveal rule exists outside the hover-capable media query (touch keeps the default)', () => {
    const unconditionalReveal = rules.filter(
      (r) => r.media === null && r.selectors.some((s) => /:hover/.test(s) && (s.includes(ROW_GRIP) || s.includes(HEADER_GRIP))),
    );
    expect(unconditionalReveal).toEqual([]);
  });

  it('a grip stays visible on the row or column being dragged', () => {
    const rowDrag = rules.filter(
      (r) => r.selectors.some((s) => s.includes('.tablify__row--dragging') && s.includes(ROW_GRIP)),
    );
    const colDrag = rules.filter(
      (r) => r.selectors.some((s) => s.includes('.tablify__header-cell--dragging') && s.includes(HEADER_GRIP)),
    );
    expect(rowDrag.some((r) => /opacity:\s*1\s*;/.test(r.body))).toBe(true);
    expect(colDrag.some((r) => /opacity:\s*1\s*;/.test(r.body))).toBe(true);
  });

  it('the grip fade is short, so the reveal feels immediate', () => {
    const rest = find(ROW_GRIP, null).concat(find(HEADER_GRIP, null));
    const transition = rest.map((r) => /transition:\s*opacity\s+(\d+)ms/.exec(r.body)).find(Boolean);
    expect(transition, 'grip rule declares an opacity transition').toBeTruthy();
    expect(Number((transition as RegExpExecArray)[1])).toBeLessThanOrEqual(150);
  });
});
