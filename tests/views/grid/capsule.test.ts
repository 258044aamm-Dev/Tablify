/**
 * @vitest-environment jsdom
 *
 * SAD-71 Step 4 — the capsule grid: the prototype renders every header and body cell as a
 * detached rounded capsule floating on a tinted inner shell, not as a contiguous grid with
 * 1px separators and striped rows.
 *
 * Geometry contracts stay frozen while the language changes: column widths, frozen offsets
 * and the 28/36/48 row pitch are untouched — the gaps come from a transparent 3px border
 * inside each capsule (border-box), so outer sizes never move.
 *
 * These tests fail on the pre-Step-4 code.
 *
 * SAD-79 update: the prototype geometry replaced the 3px-border trick — `.tablify__cell` is
 * now the 4px-padded slot (the prototype's `<td>`) and the visible capsule is its
 * `.tablify__capsule` child; header capsules carry a real type badge whose text is CSS
 * `attr()` content. The contracts below (value span, textContent, no inline separators)
 * still hold.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { GridView } from '../../../src/views/grid/GridView.js';
import { createDefaultView } from '../../../src/model/view.js';
import type { FieldDefinition, Row } from '../../../src/model/types.js';

function fields(n: number): FieldDefinition[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `fld_${i}`,
    name: `Col ${i}`,
    type: 'text' as const,
    ...(i === 0 ? { primary: true } : {}),
  }));
}

function rows(n: number, cols: FieldDefinition[]): Row[] {
  return Array.from({ length: n }, (_, r) => ({
    id: `row_${r}`,
    rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    values: Object.fromEntries(cols.map((c, i) => [c.id, `r${r}c${i}`])),
    sync: null,
  }));
}

function mount(): GridView {
  const f = fields(3);
  const grid = new GridView({
    rows: rows(2, f),
    fields: f,
    view: createDefaultView(f),
    theme: 'light',
    viewportHeight: 600,
    viewportWidth: 800,
  });
  document.body.appendChild(grid.root);
  return grid;
}

describe('SAD-71 Step 4 — capsule cells', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('puts the value in a .tablify__cell-text span (ellipsis without breaking textContent)', () => {
    const grid = mount();
    const row = grid.content.querySelector<HTMLElement>('.tablify__row');
    const cell = row?.querySelector<HTMLElement>('.tablify__cell');
    const span = cell?.querySelector<HTMLElement>('.tablify__cell-text');
    expect(span, 'value span').not.toBeNull();
    expect(span?.textContent).toBe('r0c0');
    expect(cell?.textContent).toBe('r0c0');
    grid.destroy();
  });

  it('draws no inline separators or padding on cells (capsule gaps are CSS)', () => {
    const grid = mount();
    const header = Array.from(grid.header.children) as HTMLElement[];
    const row = grid.content.querySelector<HTMLElement>('.tablify__row');
    const cells = Array.from(row?.children ?? []) as HTMLElement[];
    for (const c of [...header, ...cells]) {
      expect(c.style.borderRight, 'no inline separator').not.toContain('solid');
      expect(c.style.padding, 'no inline padding').toBe('');
    }
    expect(row?.style.borderBottom, 'no inline row separator').toBe('');
    expect(grid.header.style.borderBottom, 'no inline header separator').toBe('');
    grid.destroy();
  });

  it('keeps the field type as a cell attribute but paints no badge (COD-67)', () => {
    const grid = mount();
    const header = Array.from(grid.header.querySelectorAll<HTMLElement>('.tablify__header-cell'));
    // The attribute stays: menus and tests still need to know the type without a badge.
    expect(header[0].getAttribute('data-field-type')).toBe('text');
    expect(header[0].querySelector('.tablify__hc-badge')).toBeNull();
    // textContent stays exactly the field name (existing contract).
    expect(header[0].textContent).toBe('Col 0');
    grid.destroy();
  });
});

describe('SAD-71 Step 4 — capsule language in styles.css', () => {
  const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');
  const rule = (sel: string): string => {
    const at = css.indexOf(sel);
    expect(at, `${sel} missing`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf('}', at));
  };

  it('cells are rounded capsules on the capsule surface', () => {
    const r = rule('\n.tablify__capsule {'); // line start: not the selected-capsule rule
    expect(r).toContain('border-radius');
    expect(r).toContain('var(--tablify-bg-capsule)');
  });

  it('the grid shell is the tinted inner surface, rounded', () => {
    const r = rule('.tablify--grid {');
    expect(r).toContain('var(--tablify-bg-inner)');
    expect(r).toContain('border-radius');
  });

  it('striping is retired — capsules carry the rhythm', () => {
    // The cascade winner is the LAST rule for the selector in the file.
    const sel = '.tablify__row--stripe {';
    const at = css.lastIndexOf(sel);
    expect(at).toBeGreaterThan(-1);
    const r = css.slice(at, css.indexOf('}', at));
    expect(r).toContain('transparent');
  });

  it('header capsules paint the sort arrow via attr() and have no type badge rule', () => {
    expect(css).toContain('attr(data-sort)');
    // COD-67: the badge is gone from the header, so its rules are gone too.
    expect(css).not.toContain('.tablify__hc-badge');
    expect(css).not.toContain('attr(data-type)');
  });

  it('lets the field name take the freed badge space in narrow headers', () => {
    const buttonName = rule('.tablify button.tablify__hc-name {');
    const staticName = rule('.tablify .tablify__hc-name--static {');

    // Name labels keep normal intrinsic sizing and can still ellipsize if needed. With the
    // badge gone (COD-67) the name is the only flexible part of the capsule.
    for (const name of [buttonName, staticName]) {
      expect(name).toContain('flex: 0 1 auto;');
      expect(name).toContain('min-width: 0;');
      expect(name).toContain('text-overflow: ellipsis;');
    }
    // No element competes for the space any more.
    expect(css).not.toContain('flex: 0 999 auto;');
  });
});
