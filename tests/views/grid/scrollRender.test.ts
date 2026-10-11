/**
 * @vitest-environment jsdom
 *
 * SAD-79: a native scroll that keeps the same rows in range must not rebuild them (smooth
 * scrolling fires several scroll events per row; rebuilding on each was the bulk of the frame
 * cost once rows carried the prototype's capsule markup). A scroll that changes the range,
 * and every explicit update, must still re-render.
 */

import { describe, it, expect } from 'vitest';
import { GridView } from '../../../src/views/grid/GridView.js';
import { createDefaultView } from '../../../src/model/view.js';
import type { FieldDefinition, Row } from '../../../src/model/types.js';

const fields: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
  { id: 'fld_note', name: 'Note', type: 'text' },
];

function rows(n: number): Row[] {
  return Array.from({ length: n }, (_, r) => ({
    id: `row_${r}`,
    rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    values: { fld_name: `Row ${r + 1}`, fld_note: `n${r}` },
    sync: null,
  }));
}

function mount(n = 1000): GridView {
  const view = createDefaultView(fields);
  view.rowHeight = 'medium'; // pitch 50
  const grid = new GridView({ rows: rows(n), fields, view, theme: 'dark', viewportHeight: 600, viewportWidth: 800 });
  document.body.appendChild(grid.root);
  return grid;
}

function scrollTo(grid: GridView, top: number): void {
  grid.root.scrollTop = top;
  grid.root.dispatchEvent(new Event('scroll'));
}

const firstCell = (grid: GridView): Element | null => grid.content.querySelector('.tablify__row .tablify__cell');
const numbers = (grid: GridView): string[] =>
  Array.from(grid.content.querySelectorAll('.tablify__row .tablify__lead--num')).map((n) => n.textContent ?? '');

describe('SAD-79 scroll render', () => {
  it('a scroll within the rendered range keeps the existing row DOM', () => {
    const grid = mount();
    scrollTo(grid, 5000); // row 100
    const cell = firstCell(grid);
    const before = numbers(grid);
    scrollTo(grid, 5008);
    scrollTo(grid, 5016);
    expect(firstCell(grid)).toBe(cell);
    expect(numbers(grid)).toEqual(before);
    grid.destroy();
  });

  it('a scroll that changes the range re-renders the rows in view', () => {
    const grid = mount();
    scrollTo(grid, 5000);
    const cell = firstCell(grid);
    scrollTo(grid, 25000); // row 500
    expect(firstCell(grid)).not.toBe(cell);
    expect(numbers(grid)).toContain('501');
    grid.destroy();
  });

  it('explicit updates still re-render even when the range is unchanged', () => {
    const grid = mount();
    scrollTo(grid, 0);
    const next = rows(1000);
    next[0] = { ...next[0], values: { ...next[0].values, fld_name: 'Renamed' } };
    grid.setModel(next, fields, createDefaultView(fields));
    expect(grid.content.querySelector('.tablify__row .tablify__cell')?.textContent).toBe('Renamed');
    // and the following in-range scroll does not resurrect the old value
    scrollTo(grid, 8);
    expect(grid.content.querySelector('.tablify__row .tablify__cell')?.textContent).toBe('Renamed');
    grid.destroy();
  });

  it('a shrinking row count re-renders on the next scroll even inside the same window', () => {
    const grid = mount(20);
    const view = createDefaultView(fields);
    view.rowHeight = 'medium';
    grid.setModel(rows(3), fields, view);
    scrollTo(grid, 0);
    expect(numbers(grid)).toEqual(['1', '2', '3']);
    grid.destroy();
  });
});
