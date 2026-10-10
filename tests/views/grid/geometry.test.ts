/**
 * @vitest-environment jsdom
 *
 * SAD-71 Step 1 — geometry defects seen in the owner's v1.0.1 screenshot.
 *
 * 1. The grid box was sized once in px at construction (`root.style.width/height`), so a
 *    pane resize left the table covering part of the view. Sizing must be CSS-driven.
 * 2. A table with no rows rendered a black void: there was no empty-state affordance.
 *    The prototype always offers an "Insert Row" pill at the bottom of the container.
 * 3. The last header/body cell kept a right border, so the filler space next to the last
 *    column read as an unnamed column.
 *
 * These tests fail on cafbd17 and pass after the Step-1 fix.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GridView } from '../../../src/views/grid/GridView.js';
import { TableView } from '../../../src/views/tableView.js';
import { WorkspaceLeaf } from 'obsidian';
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

describe('SAD-71 — grid sizing is CSS-driven, not frozen px', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('carries no inline width/height on the grid root (pane resize can reflow it)', () => {
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
    // Frozen px is what left the table at ~62% of the pane in the screenshot.
    expect(grid.root.style.width, 'inline width freezes the grid').toBe('');
    expect(grid.root.style.height, 'inline height freezes the grid').toBe('');
    grid.destroy();
  });

  it('exposes a resize hook that re-renders the visible range', () => {
    const f = fields(3);
    const grid = new GridView({
      rows: rows(50, f),
      fields: f,
      view: createDefaultView(f),
      theme: 'light',
      viewportHeight: 600,
      viewportWidth: 800,
    });
    expect(typeof grid.handleResize).toBe('function');
    grid.handleResize(); // must not throw
    grid.destroy();
  });
});

describe('SAD-71 — the last column has no trailing divider', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('draws no inline column separators (capsule gaps since Step 4)', () => {
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
    const header = Array.from(grid.header.children) as HTMLElement[];
    expect(header).toHaveLength(3);
    // SAD-71 Step 4: separation is the capsule gap now; no inline separators anywhere.
    for (const c of header) {
      expect(c.style.borderRight).not.toContain('solid');
    }
    const row = grid.content.querySelector<HTMLElement>('.tablify__row');
    const cells = Array.from(row?.children ?? []) as HTMLElement[];
    expect(cells[2].style.borderRight).not.toContain('solid');
    grid.destroy();
  });
});

describe('SAD-71 — empty and short tables keep an Insert Row affordance', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function sampleFile(rowCount: number): string {
    return JSON.stringify({
      formatVersion: 1,
      tableId: 'tbl_test',
      name: 'Test',
      fields: [
        { id: 'fld_name', name: 'Name', type: 'text', primary: true },
      ],
      rows: Array.from({ length: rowCount }, (_, i) => ({
        id: `row_${i}`,
        rev: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        values: { fld_name: `Row ${i}` },
        sync: null,
      })),
      views: [
        {
          id: 'view_1',
          name: 'Default',
          sort: [],
          groupBy: null,
          hidden: [],
          frozenColumns: 0,
          rowHeight: 'medium',
          columnWidths: {},
          columnOrder: ['fld_name'],
          warnings: [],
        },
      ],
      syncLink: null,
    });
  }

  async function openView(data: string): Promise<TableView> {
    const view = new TableView(new WorkspaceLeaf() as never);
    await view.onOpen();
    document.body.appendChild(view.contentEl);
    view.setViewData(data, false);
    return view;
  }

  it('shows an Insert Row pill and an empty hint when the table has no rows', async () => {
    const view = await openView(sampleFile(0));
    const insert = view.contentEl.querySelector<HTMLElement>('[data-testid="tablify-insert-row"]');
    expect(insert, 'Insert Row affordance').not.toBeNull();
    const hint = view.contentEl.querySelector<HTMLElement>('[data-testid="tablify-empty-hint"]');
    expect(hint, 'empty hint').not.toBeNull();
    expect(hint?.hidden).toBe(false);
  });

  it('inserts a row from the Insert Row pill', async () => {
    const view = await openView(sampleFile(0));
    const insert = view.contentEl.querySelector<HTMLElement>('[data-testid="tablify-insert-row"]');
    expect(insert).not.toBeNull();
    insert?.click();
    expect(view.contentEl.querySelectorAll('.tablify__row')).toHaveLength(1);
    const hint = view.contentEl.querySelector<HTMLElement>('[data-testid="tablify-empty-hint"]');
    expect(hint?.hidden).toBe(true);
  });

  it('keeps the Insert Row pill visible for short tables, hidden hint', async () => {
    const view = await openView(sampleFile(2));
    expect(view.contentEl.querySelector('[data-testid="tablify-insert-row"]')).not.toBeNull();
    const hint = view.contentEl.querySelector<HTMLElement>('[data-testid="tablify-empty-hint"]');
    expect(hint?.hidden).toBe(true);
  });
});
