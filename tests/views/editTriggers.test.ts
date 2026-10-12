/**
 * @vitest-environment jsdom
 *
 * SAD-96 — cell editing must be reachable the way the docs promise.
 *
 * README / user-guide §4: "press Enter (or double-click) to edit"; §18: "Enter, double-click,
 * or Choose linked rows…". Before this fix the main TableView had no double-click handler at
 * all (`git log -S dblclick -- src/` shows only embedView ever had one), and on touch devices
 * there was no way to open an editor: tap selected, the long-press menu had no Edit item, and
 * there is no Enter key in the flow. Enter-to-edit kept working, which is why the issue reads
 * "I cannot edit the content of any cell" from anyone following the documented gestures.
 *
 * Everything here is additive: click still just selects (range select, row drag, long-press
 * and every shortcut keep their current behaviour).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkspaceLeaf, Menu, Modal, type MenuItemApi } from 'obsidian';
import { TableView } from '../../src/views/tableView.js';
import { newTableText } from '../../src/menus/fileMenuModel.js';

// ---- helpers ----------------------------------------------------------------

function ptr(
  type: string,
  init: { x?: number; y?: number; button?: number; pointerType?: string } = {},
): MouseEvent {
  const ev = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: init.button ?? 0,
    clientX: init.x ?? 0,
    clientY: init.y ?? 0,
  });
  Object.defineProperty(ev, 'pointerType', { value: init.pointerType ?? 'mouse' });
  return ev;
}

const tap = (target: HTMLElement, pointerType = 'touch') => {
  target.dispatchEvent(ptr('pointerdown', { x: 10, y: 70, pointerType }));
  target.dispatchEvent(ptr('pointerup', { x: 10, y: 70, pointerType }));
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

const dbl = (target: HTMLElement) =>
  target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));

const ctxMenu = (target: HTMLElement) =>
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

/** newTableText (5 typed fields × 3 rows) plus a read-only formula column. */
function editableFile(): string {
  const parsed = JSON.parse(newTableText('Edit me'));
  parsed.formatVersion = 2;
  const total = parsed.fields.find((f: { name: string }) => f.name === 'Total');
  if (!total) {
    parsed.fields.push({ id: 'fld_total', name: 'Total', type: 'formula', formula: '1' });
    parsed.views[0].columnOrder.push('fld_total');
    parsed.views[0].columnWidths.fld_total = 120;
  }
  return JSON.stringify(parsed);
}

async function openView(data?: string): Promise<TableView> {
  const view = new TableView(new WorkspaceLeaf() as never);
  await view.onOpen();
  document.body.appendChild(view.contentEl);
  view.setViewData(data ?? editableFile(), false);
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

function typeInto(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// ---- suite ------------------------------------------------------------------

describe('SAD-96 — cell edit triggers', () => {
  let shown: Menu[];
  let restoreRects: () => void;

  beforeEach(() => {
    document.body.innerHTML = '';
    Modal.reset();
    shown = [];
    vi.spyOn(Menu.prototype, 'showAtMouseEvent').mockImplementation(function (this: Menu) {
      shown.push(this);
    });
    vi.spyOn(Menu.prototype, 'showAtPosition').mockImplementation(function (this: Menu) {
      shown.push(this);
    });
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const rect = (top: number, height: number, width = 800) =>
          ({ top, bottom: top + height, left: 0, right: width, width, height, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
        if (this.classList.contains('tablify__row')) return rect(45 + Number(this.dataset.rowIndex) * 50, 50);
        return rect(0, 30);
      });
    restoreRects = () => rectSpy.mockRestore();
  });

  afterEach(() => {
    restoreRects();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('double-click opens the inline editor and Enter commits the value', async () => {
    const view = await openView();
    const cell = need(cellAt(view, 0, 0), 'first cell');

    dbl(cell);

    const editor = need(editorIn(view), 'inline editor after double-click');
    typeInto(editor, 'First task');
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const saved = JSON.parse(view.getViewData());
    const nameId = saved.fields[0].id;
    expect(saved.rows[0].values[nameId]).toBe('First task');
    expect(editorIn(view), 'editor closed after commit').toBeNull();
  });

  it('double-click on a select cell opens the select panel (not a text editor)', async () => {
    const view = await openView();
    // Status is the third visible field (Name, Notes, Status, …).
    const cell = need(cellAt(view, 0, 2), 'status cell');

    dbl(cell);

    expect(document.body.querySelector('.tablify__panel'), 'select panel in document.body').not.toBeNull();
    expect(editorIn(view), 'no inline text editor for a select cell').toBeNull();
  });

  it('click alone still only selects (no editor) — range select and drag stay intact', async () => {
    const view = await openView();
    const cell = need(cellAt(view, 0, 0), 'first cell');

    cell.dispatchEvent(ptr('pointerdown', { x: 10, y: 70 }));
    cell.dispatchEvent(ptr('pointerup', { x: 10, y: 70 }));
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(editorIn(view), 'no editor from a single click').toBeNull();
    // Selecting re-renders the row pool — assert on the live cell, not the captured one.
    expect(
      need(cellAt(view, 0, 0), 'first cell after click').classList.contains('tablify__cell--selected'),
      'cell is selected',
    ).toBe(true);
  });

  it('the cell menu gains "Edit cell", which opens the editor', async () => {
    const view = await openView();
    const cell = need(cellAt(view, 0, 0), 'first cell');

    ctxMenu(cell);
    expect(shown, 'cell menu shown').toHaveLength(1);
    const items = shown[0].items.filter((i) => i.type === 'item').map((i) => i.api as MenuItemApi);
    const edit = items.find((i) => i.title === 'Edit cell');
    expect(edit, 'Edit cell item').toBeTruthy();

    need(edit, 'Edit cell item').callback?.(new MouseEvent('click'));
    expect(editorIn(view), 'editor opens from the menu item').not.toBeNull();
  });

  it('"Edit cell" is disabled with a reason on read-only fields', async () => {
    const view = await openView();
    // Total is the injected formula (read-only) column — index 5.
    const cell = need(cellAt(view, 0, 5), 'formula cell');

    ctxMenu(cell);
    expect(shown, 'cell menu shown').toHaveLength(1);
    const items = shown[0].items.filter((i) => i.type === 'item').map((i) => i.api as MenuItemApi);
    const edit = items.find((i) => i.title.startsWith('Edit cell'));
    expect(edit, 'Edit cell item').toBeTruthy();
    expect(edit?.disabled, 'disabled on read-only').toBe(true);
    expect(edit?.title, 'carries the reason').toContain('Read-only field');
  });

  it('double-click on a read-only cell opens nothing and does not crash', async () => {
    const view = await openView();
    const cell = need(cellAt(view, 0, 5), 'formula cell');

    dbl(cell);

    expect(editorIn(view), 'no editor for a read-only cell').toBeNull();
  });

  it('a first touch tap selects; a second tap on the same cell opens the editor (mobile)', async () => {
    const view = await openView();

    tap(need(cellAt(view, 0, 0), 'first cell'));
    expect(editorIn(view), 'first tap only selects').toBeNull();
    expect(
      need(cellAt(view, 0, 0), 'first cell after tap').classList.contains('tablify__cell--selected'),
      'first tap selects',
    ).toBe(true);

    // The grid re-renders on selection; the second tap targets the live element.
    tap(need(cellAt(view, 0, 0), 'first cell again'));
    expect(editorIn(view), 'second tap on the selected cell opens the editor').not.toBeNull();
  });

  it('a tap on a different cell still only selects', async () => {
    const view = await openView();
    tap(need(cellAt(view, 0, 0), 'first cell'));
    tap(need(cellAt(view, 1, 0), 'other cell'));
    expect(editorIn(view), 'moving the selection does not open an editor').toBeNull();
    expect(
      need(cellAt(view, 1, 0), 'other cell after tap').classList.contains('tablify__cell--selected'),
    ).toBe(true);
  });
});
