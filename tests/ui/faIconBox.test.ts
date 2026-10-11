/**
 * SAD-92 Step 10 — Font Awesome icon boxes (the 0.25px that blurred the whole toolbar row).
 *
 * Font Awesome's webfont gives an icon an inline box rounded to the nearest whole pixel
 * (`cloud-arrow-up` 640/512 × 11px = 13.75 → 14). The plugin's inlined SVGs keep the exact
 * fraction, so a 13.75px Sync icon pulled every later pill 0.25px left; with `Add Row` 8.75px
 * wide as well, `Add Field` and `Options` landed 0.5px off and the mobile toolbar diff was 1.4 %.
 *
 * `faIcon(name, sizePx)` now reproduces FA's box. The sizes live in `ICON_PX` (toolbar.ts) and
 * must mirror `.tablify__btn-icon` in styles.css — this test fails if they drift.
 *
 * Fails on 6dbdf00 (`faIcon` had no size parameter; Sync measured 13.75px against FA's 14).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { faIcon } from '../../src/ui/faIcons.js';
import { ICON_PX } from '../../src/views/grid/toolbar.js';

/** Box of the SVG markup `faIcon` produces: `width` in px, or em × size. */
function boxPx(name: Parameters<typeof faIcon>[0], sizePx: number): number {
  const markup = faIcon(name, sizePx);
  const em = /width="([\d.]+)em"/.exec(markup);
  if (em) return parseFloat(em[1]) * sizePx;
  const px = /width="([\d.]+)"/.exec(markup);
  expect(px, `width attribute for ${name}`).not.toBeNull();
  return parseFloat((px as RegExpExecArray)[1]);
}

const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');

describe('SAD-92 — icons take Font Awesome’s rounded box', () => {
  it('rounds a non-square glyph to FA’s whole-pixel advance', () => {
    expect(boxPx('cloud-arrow-up', 11)).toBeCloseTo(14, 3); // 13.75 → 14
    expect(boxPx('plus', 10)).toBeCloseTo(9, 3); // 8.75 → 9
    expect(boxPx('grip-vertical', 12)).toBeCloseTo(8, 3); // 7.5 → 8
  });

  it('leaves square glyphs and the exact aspect untouched when no size is given', () => {
    expect(boxPx('sliders', 11)).toBeCloseTo(11, 3);
    expect(faIcon('plus')).toContain('width="0.8750em"');
    expect(faIcon('cloud-arrow-up')).toContain('width="1.2500em"');
  });

  it('pins the undo/redo glyph to the prototype’s whole pixel row', () => {
    // 11px glyph centred in the 16px line = 2.5px; the prototype's webfont sits at 2px.
    const i = css.indexOf(".tablify button.tablify__toolbar-button[data-action='redo'] .tablify__btn-icon {");
    expect(i).toBeGreaterThan(-1);
    const block = css.slice(i, css.indexOf('}', i));
    expect(block).toContain('align-items: flex-start');
    const j = css.lastIndexOf(".tablify button.tablify__toolbar-button[data-action='undo'] .tablify__btn-icon > svg.tablify__fa");
    expect(j).toBeGreaterThan(-1);
    expect(css.slice(j, css.indexOf('}', j))).toContain('margin-top: 2px');
  });

  it('keeps the search box focus ring at the prototype’s alpha per theme', () => {
    // Prototype `.light/.dark .pill-input:focus-within` rings: 15% light, 20% dark (SAD-92 states run).
    const i = css.lastIndexOf('.tablify--light {');
    const dark = css.lastIndexOf('.tablify--dark {');
    expect(css.slice(i, css.indexOf('}', i))).toContain('var(--tablify-accent-primary) 15%');
    expect(css.slice(dark, css.indexOf('}', dark))).toContain('var(--tablify-accent-primary) 20%');
    const focus = css.indexOf('input.tablify__search-input:focus {');
    expect(css.slice(focus, css.indexOf('}', focus))).toContain('box-shadow: 0 0 0 2px var(--tablify-focus-ring)');
  });

  it('keeps ICON_PX in step with the font-sizes in styles.css', () => {
    const at = (selector: string): number | null => {
      const i = css.indexOf(selector);
      if (i < 0) return null;
      const body = css.slice(i, css.indexOf('}', i));
      const m = /font-size:\s*(\d+)px/.exec(body);
      return m ? Number(m[1]) : null;
    };
    expect(at('.tablify__btn-icon {')).toBe(ICON_PX.filter);
    for (const action of ['sync', 'undo', 'redo', 'options']) {
      expect(at(`[data-action='${action}'] .tablify__btn-icon`), action).toBe(11);
    }
    expect(at('.tablify__search-icon {')).toBe(ICON_PX.search);
    // The 11px pills share one size; the 10px default covers Add Row / Add Field / Filter.
    expect(ICON_PX.sync).toBe(11);
    expect(ICON_PX.plus).toBe(ICON_PX.columns);
    expect(ICON_PX.filter).toBe(ICON_PX.columns);
  });
});
