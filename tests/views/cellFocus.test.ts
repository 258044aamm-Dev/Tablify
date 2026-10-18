/**
 * @vitest-environment jsdom
 *
 * COD-77 — a press outside the table surface drops the focused cell.
 *
 * The prototype clears its focused-cell highlight on any mousedown/touchstart
 * outside the table and its float panel (Prototype/script.js:866,
 * `outsideTapClear`). Tablify never ported that handler, so the capsule outline
 * stuck until another cell was pressed. These tests pin the port: what clears,
 * what keeps (the table surface, the picker panels, menus, modals, the open
 * editor), and the commit-first rule while editing.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkspaceLeaf, Modal } from 'obsidian';
import { TableView } from '../../src/views/tableView.js';

const NOW = '2026-10-17T00:00:00.000Z';

/** Name (text), Notes (text), Number, Done (checkbox) — three rows. */
function tableText(): string {
  const fields = [
    { id: 'fld_name', name: 'Name', type: 'text', primary: true },
    { id: 'fld_notes', name: 'Notes', type: 'text' },
    { id: 'fld_num', name: 'Number', type: 'number' },
    { id: 'fld_done', name: 'Done', type: 'checkbox' },
  ];
  const rows = [0, 1, 2].map((i) => ({
    id: `row_${i}`,
    rev: 1,
    createdAt: NOW,
    updatedAt: NOW,
    sync: null,
    values: {
      fld_name: `Name ${i}`,
      fld_notes: `Note ${i}`,
      fld_num: i,
      fld_done: i === 0,
    },
  }));
  return JSON.stringify({
    formatVersion: 2,
    tableId: 'tbl_cod77',
    name: 'COD-77',
    fields,
    rows,
    views: [
      {
        id: 'viw_grid',
        name: 'Grid',
        type: 'grid',
        columnOrder: fields.map((f) => f.id),
        columnWidths: {},
        frozenColumns: 0,
        rowHeight: 'medium',
      },
    ],
    syncLink: null,
  });
}

/** The listener sits on the document, so every view must be cleared away. */
const views: TableView[] = [];

async function openView(): Promise<TableView> {
  const view = new TableView(new WorkspaceLeaf() as never);
  await view.onOpen();
  document.body.appendChild(view.contentEl);
  view.setViewData(tableText(), false);
  views.push(view);
  return view;
}

const need = <T>(v: T | null | undefined, label: string): T => {
  expect(v, label).not.toBeNull();
  if (v === null || v === undefined) throw new Error(`missing: ${label}`);
  return v;
};

const cellAt = (view: TableView, row: number, col: number) =>
  view.contentEl.querySelector<HTMLElement>(
    `.tablify__row[data-row-index="${row}"] .tablify__cell[data-col-index="${col}"]`,
  );

const editorIn = (view: TableView) =>
  view.contentEl.querySelector<HTMLInputElement>('input.tablify__editor, textarea.tablify__editor');

/** A mouse press, as the browser delivers it before any click. */
function press(target: HTMLElement): MouseEvent {
  const ev = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
  Object.defineProperty(ev, 'pointerType', { value: 'mouse' });
  target.dispatchEvent(ev);
  return ev;
}

const dbl = (target: HTMLElement) =>
  target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));

/** Open the editor on (row, col) and type `value` into it. */
function edit(view: TableView, row: number, col: number, value: string): HTMLInputElement {
  dbl(need(cellAt(view, row, col), `cell ${row}/${col}`));
  const editor = need(editorIn(view), 'inline editor');
  editor.value = value;
  return editor;
}

const saved = (view: TableView) => JSON.parse(view.getViewData());

const isSelected = (view: TableView, row: number, col: number) =>
  need(cellAt(view, row, col), `cell ${row}/${col}`).classList.contains('tablify__cell--selected');

const outlineOf = (view: TableView, row: number, col: number) =>
  need(
    need(cellAt(view, row, col), `cell ${row}/${col}`).querySelector<HTMLElement>(
      '.tablify__capsule',
    ),
    'capsule',
  ).style.outline;

/** An element the real app draws at document level (a panel, a menu, a modal). */
const atDocumentLevel = (className: string): HTMLElement => {
  const el = document.createElement('div');
  el.className = className;
  document.body.appendChild(el);
  return el;
};

describe('COD-77 — a press outside the table drops the focused cell', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Modal.reset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const view of views) view.clear();
    views.length = 0;
  });

  it('a press outside the grid drops the focused cell', async () => {
    const view = await openView();
    need(cellAt(view, 0, 0), 'cell 0/0').click();
    expect(isSelected(view, 0, 0), 'the cell is focused before the press').toBe(true);

    press(view.contentEl);

    expect(view.contentEl.querySelectorAll('.tablify__cell--selected')).toHaveLength(0);
    expect(need(cellAt(view, 0, 0), 'cell 0/0').hasAttribute('aria-selected')).toBe(false);
    expect(outlineOf(view, 0, 0), 'the capsule outline is gone').toBe('');
  });

  it('a press on empty grid surface keeps the focus', async () => {
    const view = await openView();
    need(cellAt(view, 0, 0), 'cell 0/0').click();

    press(need(view.contentEl.querySelector<HTMLElement>('.tablify__viewport'), 'viewport'));

    expect(isSelected(view, 0, 0), 'the highlight survives').toBe(true);
  });

  it('a press on the header keeps the focus', async () => {
    const view = await openView();
    need(cellAt(view, 0, 0), 'cell 0/0').click();

    press(need(view.contentEl.querySelector<HTMLElement>('.tablify__header-cell'), 'header cell'));

    expect(isSelected(view, 0, 0), 'the highlight survives').toBe(true);
  });

  it('a press on the Insert Row pill drops the focus — prototype parity', async () => {
    const view = await openView();
    need(cellAt(view, 0, 0), 'cell 0/0').click();

    press(need(view.contentEl.querySelector<HTMLElement>('.tablify__insert-row'), 'insert pill'));

    expect(isSelected(view, 0, 0), 'the pill is outside the table surface').toBe(false);
    // The press alone: no click was dispatched, so no row was added either.
    expect(saved(view).rows).toHaveLength(3);
  });

  it('a press inside an open picker panel keeps the focus', async () => {
    const view = await openView();
    need(cellAt(view, 0, 0), 'cell 0/0').click();
    const panel = atDocumentLevel('tablify__panel');

    press(panel);

    expect(isSelected(view, 0, 0), 'the panel is the prototype\'s #floatPanel').toBe(true);
    panel.remove();
  });

  it('a press on an open menu keeps the focus', async () => {
    const view = await openView();
    need(cellAt(view, 0, 0), 'cell 0/0').click();
    const menu = atDocumentLevel('menu');

    press(menu);

    expect(isSelected(view, 0, 0), 'menus are float-panel content in the prototype').toBe(true);
    menu.remove();
  });

  it('a press on an open modal keeps the focus', async () => {
    const view = await openView();
    need(cellAt(view, 0, 0), 'cell 0/0').click();
    const modal = atDocumentLevel('modal-container');

    press(modal);

    expect(isSelected(view, 0, 0), 'only true modal backdrops keep it (the prototype\'s rule)').toBe(
      true,
    );
    modal.remove();
  });

  it('a press outside commits the open editor, then drops the focus', async () => {
    const view = await openView();
    edit(view, 0, 0, 'Renamed');

    press(view.contentEl);

    expect(editorIn(view), 'the edit committed').toBeNull();
    expect(saved(view).rows[0].values.fld_name).toBe('Renamed');
    expect(isSelected(view, 0, 0), 'the highlight follows the editor out').toBe(false);
  });

  it('a press inside the open editor keeps both the editor and the focus', async () => {
    const view = await openView();
    const editor = edit(view, 0, 0, 'Caret');

    press(editor);

    expect(editorIn(view), 'the editor is untouched').toBe(editor);
    expect(saved(view).rows[0].values.fld_name, 'nothing was written').toBe('Name 0');
    expect(isSelected(view, 0, 0)).toBe(true);
  });

  it('an invalid value keeps the editor and the focus', async () => {
    const view = await openView();
    edit(view, 0, 2, 'not a number');

    press(view.contentEl);

    expect(editorIn(view), 'the editor stays open on an invalid value').not.toBeNull();
    expect(saved(view).rows[0].values.fld_num, 'nothing was written').toBe(0);
    expect(isSelected(view, 0, 2), 'the highlight stays with the open editor').toBe(true);
  });

  it('a press outside with nothing focused is a no-op', async () => {
    const view = await openView();

    expect(() => press(view.contentEl)).not.toThrow();
    expect(view.contentEl.querySelectorAll('.tablify__cell--selected')).toHaveLength(0);
  });

  it('a press on another cell moves the focus — the listener never eats a grid press', async () => {
    const view = await openView();
    need(cellAt(view, 0, 0), 'cell 0/0').click();
    const other = need(cellAt(view, 1, 1), 'cell 1/1');

    press(other);
    expect(isSelected(view, 0, 0), 'the press alone does not clear').toBe(true);

    other.click();
    expect(isSelected(view, 0, 0)).toBe(false);
    expect(isSelected(view, 1, 1), 'the click still moves the selection').toBe(true);
  });

  it('clear() unwires the listener', async () => {
    const view = await openView();
    need(cellAt(view, 0, 0), 'cell 0/0').click();

    view.clear();

    expect(() => press(document.body)).not.toThrow();
  });
});
