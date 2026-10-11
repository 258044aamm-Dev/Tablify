/**
 * @vitest-environment jsdom
 *
 * TableView + toolbar integration (SAD-69 plan items A and B).
 *
 * These are the tests that prove the reported bug is actually fixed: TableView.onOpen()
 * mounts a real toolbar with search, Add Row, Add Field, Options and Undo/Redo, and the
 * controls are wired to the session. Before the fix, onOpen() built three bare buttons and
 * nothing else, and no test could reach this class at all (no obsidian mock existed).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TableView } from '../../src/views/tableView.js';
import { AddFieldModal } from '../../src/views/grid/AddFieldModal.js';
import { WorkspaceLeaf, Modal, Notice } from 'obsidian';
import { FilterBuilderModal } from '../../src/views/grid/FilterBuilderModal.js';
import { DEBOUNCE_MS } from '../../src/views/grid/toolbar.js';
import { newTableText } from '../../src/menus/fileMenuModel.js';

function sampleFile(): string {
  return JSON.stringify({
    formatVersion: 1,
    tableId: 'tbl_test',
    name: 'Test',
    fields: [
      { id: 'fld_name', name: 'Name', type: 'text', primary: true },
      { id: 'fld_status', name: 'Status', type: 'text' },
    ],
    rows: [
      mkRow('row_1', { fld_name: 'Alpha', fld_status: 'done' }),
      mkRow('row_2', { fld_name: 'Beta', fld_status: 'todo' }),
      mkRow('row_3', { fld_name: 'Gamma', fld_status: 'done' }),
    ],
    views: [
      {
        id: 'view_1',
        name: 'Default',
        sort: [],
        groupBy: null,
        hidden: [],
        frozenColumns: 1,
        rowHeight: 'medium',
        columnWidths: {},
        columnOrder: ['fld_name', 'fld_status'],
        warnings: [],
      },
    ],
    syncLink: null,
  });
}

function mkRow(id: string, values: Record<string, unknown>) {
  return {
    id,
    rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    values,
    sync: null,
  };
}

async function openView(data?: string): Promise<TableView> {
  const view = new TableView(new WorkspaceLeaf() as never);
  await view.onOpen();
  document.body.appendChild(view.contentEl);
  if (data !== undefined) view.setViewData(data, false);
  return view;
}

const el = (view: TableView, sel: string) => view.contentEl.querySelector<HTMLElement>(sel);

/** Assert a node exists and return it, so tests avoid non-null assertions (lint warns on them). */
function need<T>(value: T | null | undefined, label: string): T {
  expect(value, label).not.toBeNull();
  if (value === null || value === undefined) throw new Error(`missing element: ${label}`);
  return value;
}

const action = (view: TableView, name: string) =>
  view.contentEl.querySelector<HTMLElement>(`[data-action="${name}"]`);
const gridRows = (view: TableView) =>
  Array.from(view.contentEl.querySelectorAll('.tablify__row'));
const savedView = (view: TableView) => JSON.parse(view.getViewData()).views[0];

function typeInto(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('TableView — toolbar is mounted (the SAD-69 bug)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Modal.reset();
  });

  it('onOpen mounts a toolbar with every control the prototype calls for', async () => {
    const view = await openView();
    expect(el(view, '[data-testid="tablify-search"]'), 'search-or-query box').not.toBeNull();
    // SAD-78 (S-3): one box; the separate query input is gone.
    expect(el(view, '[data-testid="tablify-query"]'), 'no second query input').toBeNull();
    expect(action(view, 'sync'), 'Sync').not.toBeNull();
    expect(action(view, 'filter'), 'Filter').not.toBeNull();
    expect(action(view, 'add-row'), 'Add Row').not.toBeNull();
    expect(action(view, 'add-field'), 'Add Field').not.toBeNull();
    expect(action(view, 'options'), 'Options / view settings').not.toBeNull();
    expect(action(view, 'undo')).not.toBeNull();
    expect(action(view, 'redo')).not.toBeNull();
  });

  it('mounts the toolbar above the grid, and both are present', async () => {
    const view = await openView(sampleFile());
    const toolbar = el(view, '.tablify__toolbar');
    const grid = el(view, '.tablify__body .tablify--grid');
    expect(toolbar).not.toBeNull();
    expect(grid).not.toBeNull();
    expect(
      need(toolbar, 'toolbar').compareDocumentPosition(need(grid, 'grid')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps the toolbar mounted after the file loads', async () => {
    const view = await openView(sampleFile());
    expect(el(view, '[data-testid="tablify-search"]')).not.toBeNull();
    expect(gridRows(view)).toHaveLength(3);
  });
});

describe('TableView — search and query are wired to the session', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('typing in the search box filters the grid', async () => {
    const view = await openView(sampleFile());
    expect(gridRows(view)).toHaveLength(3);
    typeInto(el(view, '[data-testid="tablify-search"]') as HTMLInputElement, 'Alpha');
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(gridRows(view)).toHaveLength(1);
    expect(view.contentEl.textContent).toContain('Alpha');
    expect(view.contentEl.textContent).not.toContain('Beta');
  });

  it('the search term is persisted into the view', async () => {
    const view = await openView(sampleFile());
    typeInto(el(view, '[data-testid="tablify-search"]') as HTMLInputElement, 'Alpha');
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(savedView(view).search).toBe('Alpha');
  });

  it('searching requests a save, so the filter survives a reload', async () => {
    const view = await openView(sampleFile());
    const before = (view as unknown as { saveRequests: number }).saveRequests;
    typeInto(el(view, '[data-testid="tablify-search"]') as HTMLInputElement, 'Alpha');
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect((view as unknown as { saveRequests: number }).saveRequests).toBeGreaterThan(before);
  });

  it('searching does not create an undo entry', async () => {
    // Ctrl+Z must not step back through the user's typing.
    const view = await openView(sampleFile());
    typeInto(el(view, '[data-testid="tablify-search"]') as HTMLInputElement, 'Alpha');
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(gridRows(view)).toHaveLength(1);
    need(action(view, 'undo'), 'undo button').click();
    // Undo was a no-op: the stack was empty, so the filter still applies.
    expect(gridRows(view)).toHaveLength(1);
  });

  it('a field:value query in the box filters the grid and is persisted as the query', async () => {
    const view = await openView(sampleFile());
    typeInto(el(view, '[data-testid="tablify-search"]') as HTMLInputElement, 'Status:done');
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(gridRows(view)).toHaveLength(2);
    expect(savedView(view).query).toBe('Status:done');
    expect(savedView(view).search).toBe('');
  });

  it('free words and field:value terms combine (AND), each persisted in its own half', async () => {
    const view = await openView(sampleFile());
    typeInto(el(view, '[data-testid="tablify-search"]') as HTMLInputElement, 'Gam Status:done');
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(gridRows(view)).toHaveLength(1);
    expect(view.contentEl.textContent).toContain('Gamma');
    expect(savedView(view).search).toBe('Gam');
    expect(savedView(view).query).toBe('Status:done');
  });

  it('one debounce tick writes both halves in a single save request', async () => {
    const view = await openView(sampleFile());
    const before = (view as unknown as { saveRequests: number }).saveRequests;
    typeInto(el(view, '[data-testid="tablify-search"]') as HTMLInputElement, 'Gam Status:done');
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect((view as unknown as { saveRequests: number }).saveRequests).toBe(before + 1);
  });

  it('an invalid query shows the inline error (position in the box) and fails open', async () => {
    const view = await openView(sampleFile());
    const box = el(view, '[data-testid="tablify-search"]') as HTMLInputElement;
    typeInto(box, 'Alpha Status:>');
    const error = need(el(view, '[data-testid="tablify-query-error"]'), 'error');
    expect(error.hidden).toBe(false);
    expect(error.textContent).toMatch(/position 14\)$/);
    expect(box.classList.contains('tablify__search-input--invalid')).toBe(true);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    // The search half still applies; the broken query half fails open (no row hidden by it).
    expect(gridRows(view)).toHaveLength(1);
  });

  it('a file saved with search and query shows both in the box', async () => {
    const data = JSON.parse(sampleFile());
    data.views[0].search = 'Gam';
    data.views[0].query = 'Status:done';
    const view = await openView(JSON.stringify(data));
    expect((el(view, '[data-testid="tablify-search"]') as HTMLInputElement).value).toBe('Gam Status:done');
    expect(gridRows(view)).toHaveLength(1);
  });

  it('the row-count badge reports the filtered and total counts', async () => {
    const view = await openView(sampleFile());
    expect(need(el(view, '[data-testid="tablify-rowcount"]'), 'row count').textContent).toBe('3 rows');
    typeInto(el(view, '[data-testid="tablify-search"]') as HTMLInputElement, 'Alpha');
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(need(el(view, '[data-testid="tablify-rowcount"]'), 'row count').textContent).toBe('1 row (of 3)');
  });

  it('Clear filters empties both search and query', async () => {
    const view = await openView(sampleFile());
    typeInto(el(view, '[data-testid="tablify-search"]') as HTMLInputElement, 'Alpha Status:done');
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(gridRows(view)).toHaveLength(1);

    need(action(view, 'options'), 'options button').click();
    need(action(view, 'clear-filters'), 'clear filters button').click();
    expect(gridRows(view)).toHaveLength(3);
    expect(savedView(view).search).toBe('');
    expect(savedView(view).query).toBe('');
    expect((el(view, '[data-testid="tablify-search"]') as HTMLInputElement).value).toBe('');
  });
});

describe('TableView — Filter builder and Sync (SAD-78)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Modal.reset();
    Notice.messages = [];
  });

  it('Filter opens the builder with the box text; Apply writes the box, filters and persists', async () => {
    const view = await openView(sampleFile());
    const box = el(view, '[data-testid="tablify-search"]') as HTMLInputElement;
    box.value = 'Gam';
    need(action(view, 'filter'), 'filter button').click();
    const modal = Modal.opened.at(-1);
    expect(modal).toBeInstanceOf(FilterBuilderModal);
    const fb = need((modal as FilterBuilderModal).builder, 'builder');
    // Pick Status = done in the first (blank) row, then Apply.
    const row = need(fb.root.querySelector('[data-testid="tablify-fb-row"]'), 'row');
    const fieldSel = row.querySelector<HTMLSelectElement>('.tablify__fb-field');
    need(fieldSel, 'field select').value = 'fld_status';
    fieldSel?.dispatchEvent(new Event('change'));
    const value = need(fb.root.querySelector<HTMLInputElement>('input.tablify__fb-value'), 'value input');
    value.value = 'done';
    value.dispatchEvent(new Event('input'));
    need(fb.root.querySelector<HTMLElement>('[data-action="fb-apply"]'), 'apply').click();

    expect(modal?.isOpen).toBe(false);
    expect(box.value).toBe('Gam Status:done');
    expect(gridRows(view)).toHaveLength(1);
    expect(savedView(view).search).toBe('Gam');
    expect(savedView(view).query).toBe('Status:done');
  });

  it('Cancel leaves the filter untouched', async () => {
    const view = await openView(sampleFile());
    need(action(view, 'filter'), 'filter button').click();
    const fb = need((Modal.opened.at(-1) as FilterBuilderModal).builder, 'builder');
    need(fb.root.querySelector<HTMLElement>('[data-action="fb-cancel"]'), 'cancel').click();
    expect(gridRows(view)).toHaveLength(3);
    expect(savedView(view).query ?? '').toBe('');
  });

  it('Sync calls the plugin entry point with this view', async () => {
    const openSync = vi.fn();
    const view = new TableView(new WorkspaceLeaf() as never, { openSync });
    await view.onOpen();
    view.setViewData(sampleFile(), false);
    view.contentEl.querySelector<HTMLElement>('[data-action="sync"]')?.click();
    expect(openSync).toHaveBeenCalledWith(view);
  });

  it('Sync without the plugin hook explains instead of failing', async () => {
    const view = await openView(sampleFile());
    need(action(view, 'sync'), 'sync button').click();
    expect(Notice.messages.at(-1)).toMatch(/not available/);
  });
});

describe('TableView — toolbar actions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Modal.reset();
  });

  it('Add Row appends a row', async () => {
    const view = await openView(sampleFile());
    expect(gridRows(view)).toHaveLength(3);
    need(action(view, 'add-row'), 'add row button').click();
    expect(gridRows(view)).toHaveLength(4);
  });

  it('Add Row is undoable via the toolbar', async () => {
    const view = await openView(sampleFile());
    need(action(view, 'add-row'), 'add row button').click();
    expect(gridRows(view)).toHaveLength(4);
    need(action(view, 'undo'), 'undo button').click();
    expect(gridRows(view)).toHaveLength(3);
    need(action(view, 'redo'), 'redo button').click();
    expect(gridRows(view)).toHaveLength(4);
  });

  it('Add Field opens the modal and adds the field on confirm', async () => {
    const view = await openView(sampleFile());
    need(action(view, 'add-field'), 'add field button').click();

    const modal = Modal.opened[0] as AddFieldModal;
    expect(modal, 'an AddFieldModal should have opened').toBeInstanceOf(AddFieldModal);

    const input = modal.contentEl.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'Score';
    input.dispatchEvent(new Event('input'));
    const select = modal.contentEl.querySelector('select') as HTMLSelectElement;
    select.value = 'number';
    select.dispatchEvent(new Event('change'));
    (modal.contentEl.querySelector('button') as HTMLButtonElement).click();

    const headers = Array.from(view.contentEl.querySelectorAll('.tablify__header-cell')).map(
      (h) => h.textContent,
    );
    expect(headers).toContain('Score');
    expect(savedView(view).columnOrder).toContain(savedView(view).columnOrder.slice(-1)[0]);
  });
});

describe('TableView — view settings (Options)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows a hidden field again (plan item B)', async () => {
    const file = JSON.parse(sampleFile());
    file.views[0].hidden = ['fld_status'];
    const view = await openView(JSON.stringify(file));

    let headers = Array.from(view.contentEl.querySelectorAll('.tablify__header-cell')).map(
      (h) => h.textContent,
    );
    expect(headers).toEqual(['Name']);

    need(action(view, 'options'), 'options button').click();
    const showBtn = view.contentEl.querySelector<HTMLElement>('[data-show-field="fld_status"]');
    expect(showBtn, 'a way to show the hidden field must exist').not.toBeNull();
    need(showBtn, 'show field button').click();

    headers = Array.from(view.contentEl.querySelectorAll('.tablify__header-cell')).map(
      (h) => h.textContent,
    );
    expect(headers).toEqual(['Name', 'Status']);
    expect(savedView(view).hidden).toEqual([]);
  });

  it('changing row height re-renders and persists', async () => {
    const view = await openView(sampleFile());
    expect(gridRows(view)[0].style.height).toBe('50px'); // medium — SAD-79 prototype pitch

    need(action(view, 'options'), 'options button').click();
    need(
      view.contentEl.querySelector<HTMLElement>('[data-row-height="large"]'),
      'large row height',
    ).click();

    expect(gridRows(view)[0].style.height).toBe('56px'); // large — 40px capsule pitch
    expect(savedView(view).rowHeight).toBe('large');
  });

  it('changing frozen columns persists', async () => {
    const view = await openView(sampleFile());
    need(action(view, 'options'), 'options button').click();
    const select = need(
      view.contentEl.querySelector<HTMLSelectElement>('.tablify__option-select'),
      'freeze select',
    );
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    expect(savedView(view).frozenColumns).toBe(2);
  });
});

// SAD-84 (owner decision S-8): a brand-new table opens with five columns and three empty rows,
// and the first cell is editable straight away (Enter → type → Enter commits and saves).
describe('TableView — new table defaults (SAD-84)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Modal.reset();
  });

  it('renders five header cells and three empty body rows', async () => {
    const view = await openView(newTableText('Untitled table'));
    const headers = Array.from(view.contentEl.querySelectorAll('.tablify__header-cell'));
    expect(headers).toHaveLength(5);
    expect(gridRows(view)).toHaveLength(3);
    for (const row of gridRows(view)) {
      for (const text of Array.from(row.querySelectorAll('.tablify__cell-text'))) {
        expect(text.textContent ?? '').toBe('');
      }
    }
  });

  it('lets the first cell be edited immediately and saves the value', async () => {
    const view = await openView(newTableText('Untitled table'));
    const root = need(el(view, '.tablify--grid'), 'grid root');
    root.focus();
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const editor = need(root.querySelector<HTMLInputElement>('input'), 'inline editor');
    editor.value = 'First task';
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const saved = JSON.parse(view.getViewData());
    const nameId = saved.fields[0].id;
    expect(saved.rows).toHaveLength(3);
    expect(saved.rows[0].values[nameId]).toBe('First task');
    expect(saved.rows[1].values).toEqual({});
    expect(saved.rows[2].values).toEqual({});
  });
});
