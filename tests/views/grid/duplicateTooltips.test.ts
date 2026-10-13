/**
 * @vitest-environment jsdom
 *
 * SAD-109 — one tooltip per element.
 *
 * Obsidian shows its own popover for any element with `aria-label`, and the browser shows a
 * native tooltip for `title`. An element that sets both shows two tooltips with the same text.
 * This file renders every surface that had such elements (toolbar, grid header and row,
 * option manager, filter builder) and asserts that no element carries both attributes.
 *
 * It also pins the accessible names: removing `title` must not change any `aria-label`.
 *
 * Fails on c7dd671 (before the fix): toolbar buttons, the option-manager buttons, the filter
 * builder's Remove button and the header field-menu button each carried both attributes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Toolbar, type ToolbarCallbacks, type ToolbarState } from '../../../src/views/grid/toolbar.js';
import { GridView } from '../../../src/views/grid/GridView.js';
import { OptionManagerDialog } from '../../../src/views/grid/select/OptionManager.js';
import { FilterBuilder } from '../../../src/views/grid/filterBuilder.js';
import { createTableStore } from '../../../src/model/tableStore.js';
import { createDefaultView } from '../../../src/model/view.js';
import type { FieldDefinition, Row } from '../../../src/model/types.js';

const FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
  {
    id: 'fld_status',
    name: 'Status',
    type: 'single_select',
    options: [
      { id: 'opt_todo', name: 'Todo', color: 'red' },
      { id: 'opt_done', name: 'Done', color: 'green' },
    ],
  },
  { id: 'fld_due', name: 'Due date', type: 'date' },
];

/** Every element under `root` (and `root` itself) that carries both `title` and `aria-label`. */
function doubleTooltips(root: ParentNode & Element): string[] {
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))] as HTMLElement[];
  return nodes
    .filter((el) => el.hasAttribute('title') && el.hasAttribute('aria-label'))
    .map((el) => `${el.tagName.toLowerCase()}.${el.className || '(no class)'} title="${el.getAttribute('title')}" aria-label="${el.getAttribute('aria-label')}"`);
}

function callbacks(): ToolbarCallbacks {
  const noop = () => {};
  return {
    onFilter: noop,
    onSync: noop,
    onOpenFilter: noop,
    onAddRow: noop,
    onAddField: noop,
    onRowHeight: noop,
    onFreezeColumns: noop,
    onShowField: noop,
    onClearFilters: noop,
    onUndo: noop,
    onRedo: noop,
  } as unknown as ToolbarCallbacks;
}

function toolbarState(): ToolbarState {
  return {
    fields: FIELDS,
    view: createDefaultView(FIELDS),
    visibleRowCount: 3,
    totalRowCount: 3,
    search: '',
    query: '',
    queryError: null,
    theme: 'light',
  };
}

function rows(): Row[] {
  return [0, 1, 2].map((i) => ({
    id: `row_${i}`,
    rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    values: { fld_name: `Task ${i}`, fld_status: 'opt_todo' } as Row['values'],
    sync: null,
  }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('SAD-109 — no element shows two tooltips', () => {
  it('toolbar buttons (including Sync) carry one tooltip, and keep their accessible name', () => {
    const toolbar = new Toolbar({ ...toolbarState(), callbacks: callbacks() } as never);
    document.body.appendChild(toolbar.root);
    expect(doubleTooltips(toolbar.root)).toEqual([]);

    const sync = toolbar.root.querySelector<HTMLElement>('[data-action="sync"]');
    expect(sync?.getAttribute('aria-label')).toBe('Airtable sync for this table');
    expect(sync?.textContent).toContain('Sync');
  });

  it('grid header and rows: the field-menu button keeps its name and drops the duplicate title', () => {
    const grid = new GridView({
      rows: rows(),
      fields: FIELDS,
      view: createDefaultView(FIELDS),
      theme: 'light',
      viewportHeight: 600,
      viewportWidth: 800,
      onHeaderMenu: () => {},
      onSortClick: () => {},
      onColumnMove: () => {},
      onRowMove: () => {},
    } as never);
    document.body.appendChild(grid.root);

    expect(doubleTooltips(grid.root)).toEqual([]);
    const menu = grid.header.querySelector<HTMLElement>('.tablify__hc-menu');
    expect(menu?.getAttribute('aria-label')).toBe('Field menu: Name');
  });

  it('option manager buttons (delete, move, colour) carry one tooltip each', () => {
    const field: FieldDefinition = { ...FIELDS[1] };
    const store = createTableStore({ fields: [field], initialRows: [] });
    const dialog = new OptionManagerDialog(field, store);
    dialog.open();
    expect(doubleTooltips(document.body)).toEqual([]);
    const del = document.body.querySelector<HTMLElement>('button[aria-label^="Delete "]');
    expect(del, 'a Delete button is rendered').not.toBeNull();
    expect(del?.hasAttribute('title')).toBe(false);
  });

  it('filter builder Remove buttons carry one tooltip, keeping the aria-label', () => {
    const builder = new FilterBuilder(FIELDS, 'status:Done', { onApply: () => {}, onCancel: () => {} });
    document.body.appendChild(builder.root);
    expect(doubleTooltips(builder.root)).toEqual([]);
    const remove = builder.root.querySelector<HTMLElement>('[data-action="fb-remove"]');
    expect(remove?.getAttribute('aria-label')).toBe('Remove condition');
  });
});
