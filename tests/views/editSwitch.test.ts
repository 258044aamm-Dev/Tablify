/**
 * @vitest-environment jsdom
 *
 * COD-70 — clicking another cell while editing must select it on the first click.
 *
 * The commit itself already happened on blur, but the blur runs during the press and its
 * re-render empties every row; the element the press began on is detached before the browser
 * can dispatch `click`, and the click is what selects a cell. The view now finishes the edit
 * from the press and activates the pressed cell itself.
 *
 * These tests pin the three shapes of the gesture: a plain cell (commit + select), a checkbox
 * (commit + toggle — the box owns its click, COD-71) and an invalid value (the editor stays).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    tableId: 'tbl_cod70',
    name: 'COD-70',
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

async function openView(): Promise<TableView> {
  const view = new TableView(new WorkspaceLeaf() as never);
  await view.onOpen();
  document.body.appendChild(view.contentEl);
  view.setViewData(tableText(), false);
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

describe('COD-70 — switching cells while an editor is open', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Modal.reset();
    vi.restoreAllMocks();
  });

  it('one press on another cell commits the edit and selects that cell', async () => {
    const view = await openView();
    const editor = edit(view, 0, 0, 'Renamed');
    expect(editorIn(view), 'editor open before the press').toBe(editor);

    press(need(cellAt(view, 1, 1), 'other cell'));

    expect(editorIn(view), 'the press closes the editor').toBeNull();
    expect(saved(view).rows[0].values.fld_name).toBe('Renamed');
    expect(saved(view).rows[1].values.fld_notes).toBe('Note 1');
    const moved = need(cellAt(view, 1, 1), 'other cell after the press');
    expect(moved.classList.contains('tablify__cell--selected'), 'the pressed cell is selected').toBe(
      true,
    );
    // Exactly one cell carries the selection.
    expect(view.contentEl.querySelectorAll('.tablify__cell--selected')).toHaveLength(1);
  });

  it('one press on a checkbox cell toggles the box and leaves the selection alone', async () => {
    const view = await openView();
    edit(view, 0, 0, 'Renamed');
    const box = need(
      need(cellAt(view, 1, 3), 'checkbox cell').querySelector<HTMLElement>('.tablify__check'),
      'checkbox control',
    );

    press(box);

    expect(editorIn(view), 'the press closes the editor').toBeNull();
    expect(saved(view).rows[0].values.fld_name).toBe('Renamed');
    // Row 1 started unchecked; the press toggled it, like a click on the box does.
    expect(saved(view).rows[1].values.fld_done).toBe(true);
    // COD-71: the box owns its click — the cell is not selected by it.
    expect(need(cellAt(view, 0, 0), 'edited cell').classList.contains('tablify__cell--selected')).toBe(
      true,
    );
  });

  it('an invalid value keeps the editor open and does not move the selection', async () => {
    const view = await openView();
    const editor = edit(view, 0, 2, 'not a number');

    press(need(cellAt(view, 1, 0), 'other cell'));

    expect(editorIn(view), 'the editor stays open on an invalid value').toBe(editor);
    expect(editor.getAttribute('aria-invalid'), 'the editor marks the value invalid').toBe('true');
    expect(saved(view).rows[0].values.fld_num, 'nothing was written').toBe(0);
    const still = need(cellAt(view, 0, 2), 'edited cell');
    expect(still.classList.contains('tablify__cell--selected'), 'selection did not move').toBe(true);
  });

  it('a press inside the editor leaves it open', async () => {
    const view = await openView();
    const editor = edit(view, 0, 0, 'Still typing');

    press(editor);

    expect(editorIn(view), 'the editor is untouched').toBe(editor);
    expect(saved(view).rows[0].values.fld_name, 'nothing was written').toBe('Name 0');
  });

  it('a touch press is not the mouse path: it still only selects', async () => {
    const view = await openView();
    edit(view, 0, 0, 'Renamed');
    const target = need(cellAt(view, 0, 1), 'other cell');
    const ev = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(ev, 'pointerType', { value: 'touch' });

    target.dispatchEvent(ev);

    // The editor is still open (the tap's own click/blur decides); nothing was committed
    // behind the user's back by the press handler.
    expect(editorIn(view), 'a touch press does not commit').not.toBeNull();
  });
});
