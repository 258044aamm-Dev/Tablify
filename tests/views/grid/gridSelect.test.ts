/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { GridView } from '../../../src/views/grid/GridView.js';
import { makeFile, VIEW } from '../../io/export.fixtures.js';
import { visibleFields } from '../../../src/model/viewOrder.js';

describe('GridView header and selection (P5-00)', () => {
  it('renders a header with one label per visible field', () => {
    const file = makeFile(5);
    const fields = visibleFields(file.fields, VIEW);
    const grid = new GridView({ rows: file.rows, fields, view: VIEW, theme: 'light' });
    expect(grid.getHeaderLabels()).toEqual(fields.map((f) => f.name));
    document.body.appendChild(grid.root);
    grid.destroy();
  });

  it('click selects a cell and reports its row and column indexes', () => {
    const file = makeFile(5);
    const fields = visibleFields(file.fields, VIEW);
    const onCellClick = vi.fn();
    const grid = new GridView({ rows: file.rows, fields, view: VIEW, theme: 'light', onCellClick });
    document.body.appendChild(grid.root);
    const cell = grid.root.querySelector('.tablify__row[data-row-index="2"] .tablify__cell[data-col-index="1"]') as HTMLElement;
    expect(cell).toBeTruthy();
    cell.click();
    expect(onCellClick).toHaveBeenCalledWith(2, 1);
    expect(grid.getSelection()).toEqual({ row: 2, col: 1 });
    expect(grid.root.querySelectorAll('.tablify__cell--selected')).toHaveLength(1);
    grid.destroy();
  });

  it('setModel swaps rows and clears a selection that is now out of range', () => {
    const file = makeFile(5);
    const fields = visibleFields(file.fields, VIEW);
    const grid = new GridView({ rows: file.rows, fields, view: VIEW, theme: 'light' });
    document.body.appendChild(grid.root);
    grid.setSelection({ row: 4, col: 0 });
    grid.setModel(file.rows.slice(0, 2), fields, VIEW);
    expect(grid.getSelection()).toBeNull();
    expect(grid.getRenderedRowCount()).toBe(2);
    grid.destroy();
  });

  it('setSelection ignores out-of-range positions', () => {
    const file = makeFile(3);
    const fields = visibleFields(file.fields, VIEW);
    const grid = new GridView({ rows: file.rows, fields, view: VIEW, theme: 'light' });
    grid.setSelection({ row: 9, col: 0 });
    expect(grid.getSelection()).toBeNull();
    grid.destroy();
  });
});
