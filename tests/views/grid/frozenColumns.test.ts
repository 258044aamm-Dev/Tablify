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
import { GridView, columnWidths, DEFAULT_COLUMN_WIDTH } from '../../../src/views/grid/GridView.js';
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

const headerCells = (grid: GridView) =>
  Array.from(grid.header.children) as HTMLElement[];
const firstRow = (grid: GridView): HTMLElement => {
  const row = grid.content.querySelector<HTMLElement>('.tablify__row');
  expect(row, 'first body row').not.toBeNull();
  if (!row) throw new Error('no body row rendered');
  return row;
};

const bodyCells = (grid: GridView) => Array.from(firstRow(grid).children) as HTMLElement[];

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
    const f = fields(12); // 12 * 160 = 1920px, well past the 800px viewport
    const grid = mount(f, rows(2, f), createDefaultView(f));
    expect(grid.header.style.width).toBe('1920px');
    expect(firstRow(grid).style.width).toBe('1920px');
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

    const offset = (n: number) => String(n * DEFAULT_COLUMN_WIDTH);
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

    expect(bodyCells(grid).map((c) => c.style.left)).toEqual(['0px', '250px', '']);
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
    expect(bodyCells(grid).map((c) => c.style.left)).toEqual(['0px', `${DEFAULT_COLUMN_WIDTH}px`]);
    grid.destroy();
  });
});

describe('GridView — horizontal scroll keeps the header aligned', () => {
  it('mirrors the viewport scroll offset onto the header', () => {
    const f = fields(12);
    const view = { ...createDefaultView(f), frozenColumns: 1 };
    const grid = mount(f, rows(2, f), view);

    // The header is the viewport's sibling, not its child, so it does not scroll with it.
    // Without the mirror the header drifts away from its columns.
    grid.viewport.scrollLeft = 320;
    grid.viewport.dispatchEvent(new Event('scroll'));
    expect(grid.header.scrollLeft).toBe(320);

    grid.viewport.scrollLeft = 0;
    grid.viewport.dispatchEvent(new Event('scroll'));
    expect(grid.header.scrollLeft).toBe(0);
    grid.destroy();
  });

  it('makes the header its own scroll container so the mirror has somewhere to write', () => {
    const f = fields(3);
    const grid = mount(f, rows(2, f), createDefaultView(f));
    // `hidden`, not `auto`: the header must be scrollable programmatically without
    // growing a second horizontal scrollbar under the body's.
    expect(grid.header.style.overflow).toBe('hidden');
    grid.destroy();
  });
});
