/**
 * @vitest-environment jsdom
 * P6-03 — ARIA grid semantics (attribute-only additions in GridView).
 * Guards the role/count/index contract that screen readers rely on.
 */
import { describe, it, expect } from 'vitest';
import { GridView } from '../../src/views/grid/GridView.js';
import { createDefaultView } from '../../src/model/view.js';
import type { Row, FieldDefinition, ViewDefinition } from '../../src/model/types.js';

function tinyModel(): { rows: Row[]; fields: FieldDefinition[] } {
  const fields: FieldDefinition[] = [
    { id: 'fld_name', name: 'Name', type: 'text', primary: true },
    { id: 'fld_qty', name: 'Qty', type: 'number' },
    { id: 'fld_done', name: 'Done', type: 'checkbox' },
  ];
  const rows: Row[] = Array.from({ length: 50 }, (_, i) => ({
    id: `row_${String(i).padStart(3, '0')}`,
    rev: 1,
    updatedAt: '2026-10-09T08:00:00Z',
    values: { fld_name: `Item ${i}`, fld_qty: i, fld_done: i % 2 === 0 },
    sync: null,
  }));
  return { rows, fields };
}

function makeGrid() {
  const { rows, fields } = tinyModel();
  const view: ViewDefinition = createDefaultView(fields);
  view.rowHeight = 'medium';
  view.sort = [{ fieldId: 'fld_qty', direction: 'desc' }];
  const grid = new GridView({ rows, fields, view, theme: 'light', viewportHeight: 600, viewportWidth: 800 });
  document.body.appendChild(grid.root);
  return grid;
}

describe('P6-03 — ARIA grid semantics', () => {
  it('root has role=grid with aria-rowcount (rows+header) and aria-colcount', () => {
    const grid = makeGrid();
    expect(grid.root.getAttribute('role')).toBe('grid');
    expect(grid.root.getAttribute('aria-rowcount')).toBe('51'); // 50 rows + header
    expect(grid.root.getAttribute('aria-colcount')).toBe('3');
    grid.destroy();
  });

  it('header cells are columnheader with 1-based aria-colindex; primary sort column has aria-sort', () => {
    const grid = makeGrid();
    const headers = Array.from(grid.root.querySelectorAll('[role="columnheader"]')) as HTMLElement[];
    expect(headers.length).toBe(3);
    headers.forEach((h, i) => expect(h.getAttribute('aria-colindex')).toBe(String(i + 1)));
    const sortHeaders = headers.filter((h) => h.hasAttribute('aria-sort'));
    expect(sortHeaders.length).toBe(1);
    expect(sortHeaders[0].getAttribute('data-field-id')).toBe('fld_qty');
    expect(sortHeaders[0].getAttribute('aria-sort')).toBe('descending');
    grid.destroy();
  });

  it('visible rows carry aria-rowindex (offset for header) and cells carry aria-colindex + role', () => {
    const grid = makeGrid();
    grid.setScrollTop(0);
    const rowEls = Array.from(grid.root.querySelectorAll('[role="row"]')).filter(
      (el) => el.parentElement?.getAttribute('role') === 'presentation',
    );
    expect(rowEls.length).toBeGreaterThan(0);
    const first = rowEls[0];
    expect(first.getAttribute('aria-rowindex')).toBe('2'); // header is row 1
    const cells = Array.from(first.querySelectorAll('[role="gridcell"]')) as HTMLElement[];
    expect(cells.length).toBe(3);
    cells.forEach((c, i) => expect(c.getAttribute('aria-colindex')).toBe(String(i + 1)));
    // scroll deeper: aria-rowindex must follow the virtual window
    grid.setScrollTop(10 * 36);
    const deeper = (
      Array.from(grid.root.querySelectorAll('[role="row"]')).filter(
        (el) => el.parentElement?.getAttribute('role') === 'presentation',
      ) as HTMLElement[]
    ).sort((a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')));
    expect(Number(deeper[0].getAttribute('aria-rowindex'))).toBeGreaterThan(2);
    grid.destroy();
  });

  it('setModel updates aria-rowcount/aria-colcount', () => {
    const grid = makeGrid();
    const { rows, fields } = tinyModel();
    const view: ViewDefinition = createDefaultView(fields);
    grid.setModel(rows.slice(0, 10), fields, view);
    expect(grid.root.getAttribute('aria-rowcount')).toBe('11');
    grid.destroy();
  });

  it('intermediate containers are presentation so grid owns its rows', () => {
    const grid = makeGrid();
    const viewport = grid.root.querySelector('.tablify__viewport');
    const content = grid.root.querySelector('.tablify__content');
    expect(viewport?.getAttribute('role')).toBe('presentation');
    expect(content?.getAttribute('role')).toBe('presentation');
    grid.destroy();
  });
});
