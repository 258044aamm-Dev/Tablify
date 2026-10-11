/**
 * @vitest-environment jsdom
 *
 * Frozen columns and column widths (SAD-69 plan item C).
 *
 * `view.frozenColumns` and `view.columnWidths` were both persisted and round-tripped
 * correctly, and neither was ever read: cells were `flex: 1; min-width: 120px`, so every
 * column was the same width and nothing was ever pinned. These tests cover the geometry
 * that makes them visible.
 */

import { describe, it, expect } from 'vitest';
import {
  GridView,
  columnWidths,
  DEFAULT_COLUMN_WIDTH,
  LEAD_CHECK_WIDTH,
  LEAD_NUM_WIDTH,
  COLUMN_GAP,
} from '../../../src/views/grid/GridView.js';
import { createDefaultView } from '../../../src/model/view.js';
import type { FieldDefinition, Row, ViewDefinition } from '../../../src/model/types.js';

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

function mount(f: FieldDefinition[], r: Row[], view: ViewDefinition): GridView {
  const grid = new GridView({ rows: r, fields: f, view, theme: 'light', viewportHeight: 600, viewportWidth: 800 });
  document.body.appendChild(grid.root);
  return grid;
}

// SAD-79: field cells only — every line also starts with the checkbox and `#` lead slots.
const headerCells = (grid: GridView) =>
  Array.from(grid.header.querySelectorAll<HTMLElement>('.tablify__header-cell'));
const headerLeads = (grid: GridView) =>
  Array.from(grid.header.querySelectorAll<HTMLElement>('.tablify__lead'));
/** Sticky left of the first field: the checkbox and `#` slots plus their spacing. */
const LEAD_BLOCK = LEAD_CHECK_WIDTH + COLUMN_GAP + LEAD_NUM_WIDTH + COLUMN_GAP;
/** Row/header box width for field widths `w` (6px edge spacing + 6px after every slot). */
const lineWidth = (w: number[]) =>
  COLUMN_GAP + [LEAD_CHECK_WIDTH, LEAD_NUM_WIDTH, ...w].reduce((a, b) => a + b + COLUMN_GAP, 0);
const firstRow = (grid: GridView): HTMLElement => {
  const row = grid.content.querySelector<HTMLElement>('.tablify__row');
  expect(row, 'first body row').not.toBeNull();
  if (!row) throw new Error('no body row rendered');
  return row;
};

const bodyCells = (grid: GridView) => Array.from(firstRow(grid).querySelectorAll<HTMLElement>('.tablify__cell'));
const bodyLeads = (grid: GridView) => Array.from(firstRow(grid).querySelectorAll<HTMLElement>('.tablify__lead'));

describe('columnWidths', () => {
  it('defaults every column to the same width when the view records none', () => {
    const f = fields(3);
    expect(columnWidths(f, createDefaultView(f))).toEqual([
      DEFAULT_COLUMN_WIDTH,
      DEFAULT_COLUMN_WIDTH,
      DEFAULT_COLUMN_WIDTH,
    ]);
  });

  it('reads per-field widths from the view', () => {
    const f = fields(3);
    const view = { ...createDefaultView(f), columnWidths: { fld_1: 300 } };
    expect(columnWidths(f, view)).toEqual([DEFAULT_COLUMN_WIDTH, 300, DEFAULT_COLUMN_WIDTH]);
  });

  it('falls back to the default for zero, negative and non-finite widths', () => {
    const f = fields(3);
    const view = {
      ...createDefaultView(f),
      columnWidths: { fld_0: 0, fld_1: -50, fld_2: Number.NaN },
    };
    expect(columnWidths(f, view)).toEqual([
      DEFAULT_COLUMN_WIDTH,
      DEFAULT_COLUMN_WIDTH,
      DEFAULT_COLUMN_WIDTH,
    ]);
  });

  it('resolves widths in view order, not field-declaration order', () => {
    const f = fields(3);
    const reordered = [f[2], f[0], f[1]];
    const view = { ...createDefaultView(reordered), columnWidths: { fld_0: 200 } };
    // fld_0 is now the second column, so the 200 lands on index 1.
    expect(columnWidths(reordered, view)).toEqual([DEFAULT_COLUMN_WIDTH, 200, DEFAULT_COLUMN_WIDTH]);
  });
});

describe('GridView — header and body agree on column geometry', () => {
  it('gives header and body cells identical widths', () => {
    const f = fields(4);
    const view = { ...createDefaultView(f), columnWidths: { fld_1: 240 } };
    const grid = mount(f, rows(3, f), view);

    expect(headerCells(grid).map((c) => c.style.width)).toEqual([
      `${DEFAULT_COLUMN_WIDTH}px`,
      '240px',
      `${DEFAULT_COLUMN_WIDTH}px`,
      `${DEFAULT_COLUMN_WIDTH}px`,
    ]);
    // The whole point: if these drift, a header cell no longer sits over its column.
    expect(bodyCells(grid).map((c) => c.style.width)).toEqual(
      headerCells(grid).map((c) => c.style.width),
    );
    grid.destroy();
  });

  it('spans rows and header across the full column width, not just the viewport', () => {
    const f = fields(12); // 12 * 160 = 1920px of fields, well past the 800px viewport
    const grid = mount(f, rows(2, f), createDefaultView(f));
    // SAD-79: + the 32px checkbox and 40px `#` slots and the 6px prototype column spacing.
    const total = lineWidth(Array(12).fill(DEFAULT_COLUMN_WIDTH));
    expect(total).toBe(2082);
    expect(grid.header.style.width).toBe(`${total}px`);
    expect(firstRow(grid).style.width).toBe(`${total}px`);
    // min-width keeps them filling the grid when the columns are narrower than the viewport.
    expect(grid.header.style.minWidth).toBe('100%');
    grid.destroy();
  });
});

describe('GridView — frozen columns', () => {
  it('pins nothing when frozenColumns is 0', () => {
    const f = fields(3);
    // createDefaultView freezes the primary column, so 0 has to be asked for explicitly.
    const grid = mount(f, rows(2, f), { ...createDefaultView(f), frozenColumns: 0 });
    for (const c of [...headerCells(grid), ...bodyCells(grid)]) {
      expect(c.style.position).toBe('');
      expect(c.classList.contains('tablify__cell--frozen')).toBe(false);
    }
    grid.destroy();
  });

  it('makes the first N columns sticky in both header and body', () => {
    const f = fields(4);
    const view = { ...createDefaultView(f), frozenColumns: 2 };
    const grid = mount(f, rows(2, f), view);

    for (const cells of [headerCells(grid), bodyCells(grid)]) {
      expect(cells.map((c) => c.style.position)).toEqual(['sticky', 'sticky', '', '']);
      expect(cells.map((c) => c.classList.contains('tablify__cell--frozen'))).toEqual([
        true,
        true,
        false,
        false,
      ]);
    }
    grid.destroy();
  });

  it('pins each frozen column at its cumulative offset', () => {
    const f = fields(4);
    const view = { ...createDefaultView(f), frozenColumns: 3 };
    const grid = mount(f, rows(2, f), view);

    const offset = (n: number) => String(LEAD_BLOCK + n * (DEFAULT_COLUMN_WIDTH + COLUMN_GAP));
    expect(headerCells(grid).map((c) => c.style.left)).toEqual([
      `${offset(0)}px`,
      `${offset(1)}px`,
      `${offset(2)}px`,
      '',
    ]);
    expect(bodyCells(grid).map((c) => c.style.left)).toEqual(
      headerCells(grid).map((c) => c.style.left),
    );
    grid.destroy();
  });

  it('derives offsets from the resolved widths, so a wide column pushes the next one right', () => {
    const f = fields(3);
    const view = { ...createDefaultView(f), frozenColumns: 2, columnWidths: { fld_0: 250 } };
    const grid = mount(f, rows(2, f), view);

    expect(bodyCells(grid).map((c) => c.style.left)).toEqual([
      `${LEAD_BLOCK}px`,
      `${LEAD_BLOCK + 250 + COLUMN_GAP}px`,
      '',
    ]);
    grid.destroy();
  });

  it('ranks frozen body cells above the columns that scroll beneath them', () => {
    const f = fields(3);
    const view = { ...createDefaultView(f), frozenColumns: 1 };
    const grid = mount(f, rows(2, f), view);

    const [first, second] = bodyCells(grid);
    expect(first.style.zIndex).toBe('1');
    // Unfrozen cells take the default, so they pass underneath.
    expect(second.style.zIndex).toBe('');
    // The header outranks both, or frozen body cells would paint over it while scrolling.
    expect(Number(grid.header.style.zIndex)).toBeGreaterThan(Number(first.style.zIndex));
    // Inside the header's own stacking context, its frozen cells outrank its free ones.
    expect(headerCells(grid)[0].style.zIndex).toBe('2');
    grid.destroy();
  });

  it('clamps a frozen count larger than the field count', () => {
    const f = fields(2);
    const view = { ...createDefaultView(f), frozenColumns: 99 };
    const grid = mount(f, rows(2, f), view);
    expect(bodyCells(grid).map((c) => c.style.position)).toEqual(['sticky', 'sticky']);
    grid.destroy();
  });

  it('picks up a new frozen count through setModel', () => {
    const f = fields(4);
    const view = { ...createDefaultView(f), frozenColumns: 0 };
    const grid = mount(f, rows(2, f), view);
    expect(bodyCells(grid).map((c) => c.style.position)).toEqual(['', '', '', '']);

    grid.setModel(rows(2, f), f, { ...view, frozenColumns: 2 });
    expect(bodyCells(grid).map((c) => c.style.position)).toEqual(['sticky', 'sticky', '', '']);

    // …and releases them again.
    grid.setModel(rows(2, f), f, { ...view, frozenColumns: 0 });
    expect(bodyCells(grid).map((c) => c.style.position)).toEqual(['', '', '', '']);
    grid.destroy();
  });

  it('picks up new column widths through setModel', () => {
    const f = fields(3);
    const grid = mount(f, rows(2, f), createDefaultView(f));
    grid.setModel(rows(2, f), f, { ...createDefaultView(f), columnWidths: { fld_2: 400 } });
    expect(bodyCells(grid).map((c) => c.style.width)).toEqual([
      `${DEFAULT_COLUMN_WIDTH}px`,
      `${DEFAULT_COLUMN_WIDTH}px`,
      '400px',
    ]);
    grid.destroy();
  });

  it('excludes hidden fields from the geometry (frozen offsets follow what is visible)', () => {
    const f = fields(3);
    // GridView receives fields already filtered by view order, as TableView does.
    const visible = [f[0], f[2]];
    const view = { ...createDefaultView(visible), frozenColumns: 2 };
    const grid = mount(visible, rows(2, visible), view);
    expect(bodyCells(grid).map((c) => c.style.left)).toEqual([
      `${LEAD_BLOCK}px`,
      `${LEAD_BLOCK + DEFAULT_COLUMN_WIDTH + COLUMN_GAP}px`,
    ]);
    grid.destroy();
  });

  // SAD-79 (S-5): freeze pins the prototype's whole frozen block — checkbox, `#`, then fields.
  it('pins the checkbox and # slots with the frozen fields, flush to the shell edge', () => {
    const f = fields(3);
    const grid = mount(f, rows(2, f), { ...createDefaultView(f), frozenColumns: 1 });
    for (const leads of [headerLeads(grid), bodyLeads(grid)]) {
      expect(leads).toHaveLength(2);
      expect(leads.map((c) => c.style.position)).toEqual(['sticky', 'sticky']);
      expect(leads.map((c) => c.style.left)).toEqual(['0px', `${LEAD_CHECK_WIDTH + COLUMN_GAP}px`]);
      expect(leads.every((c) => c.classList.contains('tablify__lead--frozen'))).toBe(true);
    }
    expect(headerLeads(grid).map((c) => c.style.zIndex)).toEqual(['2', '2']);
    expect(bodyLeads(grid).map((c) => c.style.zIndex)).toEqual(['1', '1']);
    grid.destroy();
  });

  it('leaves the lead slots in the flow when freeze is off', () => {
    const f = fields(3);
    const grid = mount(f, rows(2, f), { ...createDefaultView(f), frozenColumns: 0 });
    for (const c of [...headerLeads(grid), ...bodyLeads(grid)]) {
      expect(c.style.position).toBe('');
      expect(c.classList.contains('tablify__lead--frozen')).toBe(false);
    }
    grid.destroy();
  });

  it('gives the lead slots the prototype widths in header and body alike', () => {
    const f = fields(2);
    const grid = mount(f, rows(1, f), createDefaultView(f));
    const want = [`${LEAD_CHECK_WIDTH}px`, `${LEAD_NUM_WIDTH}px`];
    expect(headerLeads(grid).map((c) => c.style.width)).toEqual(want);
    expect(bodyLeads(grid).map((c) => c.style.width)).toEqual(want);
    grid.destroy();
  });
});

// SAD-79: the root is the single scroll container for both axes, so the sticky header
// scrolls horizontally with the body by itself and frozen cells pin against the same box.
// (SAD-69 C mirrored the viewport's scrollLeft onto an `overflow: hidden` header instead.)
describe('GridView — horizontal scroll keeps the header aligned', () => {
  it('scrolls both axes on the root, with no nested horizontal scroller', () => {
    const f = fields(12);
    const grid = mount(f, rows(2, f), { ...createDefaultView(f), frozenColumns: 1 });
    expect(grid.root.style.overflow).toBe('auto');
    expect(grid.viewport.style.overflowX).toBe('');
    expect(grid.header.style.overflow).toBe('');
    // Header and rows are the same width, so one scrollLeft moves both together.
    expect(grid.header.style.width).toBe(firstRow(grid).style.width);
    expect(grid.header.style.position).toBe('sticky');
    grid.destroy();
  });

  it('sizes the viewport to every row plus the closing row spacing', () => {
    const f = fields(2);
    const grid = mount(f, rows(3, f), createDefaultView(f));
    // 3 rows × 50px pitch + 8px closing spacing (prototype border-spacing-y).
    expect(grid.viewport.style.height).toBe('158px');
    grid.destroy();
  });
});
