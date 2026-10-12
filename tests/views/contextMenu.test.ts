/**
 * @vitest-environment jsdom
 *
 * SAD-97 — the right-click context menu must appear reliably.
 *
 * Two defects are pinned here:
 * 1. `lastTouchAt` was stamped on every mouse `pointerup`, so the P5-03 touch-dedupe window
 *    (1.5 s) swallowed ordinary desktop right-clicks — click a cell, right-click it, nothing.
 * 2. `startRowDrag` armed a document-level capture `contextmenu` blocker at pointerdown on the
 *    `#` handle (before the drag threshold), so a press without movement — or a press whose
 *    `pointerup` is never delivered — blocked context menus outside any drag.
 *
 * Plus the parity gap: right-click on the row lead (`#` / checkbox) fell through to the native
 * menu; the prototype opens the row menu for any target inside the row (`tr[data-row]`).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WorkspaceLeaf, Menu, Modal, type MenuItemApi } from 'obsidian';
import { TableView } from '../../src/views/tableView.js';
import { GridView, ROW_DRAG_THRESHOLD_PX } from '../../src/views/grid/GridView.js';
import { newTableText } from '../../src/menus/fileMenuModel.js';
import { createDefaultView } from '../../src/model/view.js';
import type { FieldDefinition, Row } from '../../src/model/types.js';

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

const ctx = (target: Element) =>
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

/** Menu titles of a built menu (separators as '—'). */
function titles(menu: Menu): string[] {
  return menu.items.map((it) => (it.type === 'item' ? (it.api as MenuItemApi).title : '—'));
}

function openView(): Promise<TableView> {
  const view = new TableView(new WorkspaceLeaf() as never);
  return view.onOpen().then(() => {
    document.body.appendChild(view.contentEl);
    view.setViewData(newTableText('Untitled table'), false);
    return view;
  });
}

const cellAt = (view: TableView, row: number, col: number) =>
  view.contentEl.querySelector<HTMLElement>(
    `.tablify__row[data-row-index="${row}"] .tablify__cell[data-col-index="${col}"]`,
  );

/** Body-row `#` drag handle (the header's `#` slot shares the class — scope to rows). */
const handleAt = (view: TableView, row: number) =>
  view.contentEl.querySelector<HTMLElement>(
    `.tablify__row[data-row-index="${row}"] .tablify__lead--num`,
  );

const need = <T>(v: T | null | undefined, label: string): T => {
  expect(v, label).not.toBeNull();
  if (v === null || v === undefined) throw new Error(`missing: ${label}`);
  return v;
};

// ---- suite ------------------------------------------------------------------

describe('SAD-97 — right-click context menu', () => {
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
    // jsdom has no layout; rows sit on a 50px pitch below a 45px header (as in rowSelection.test).
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
  });

  it('opens the cell menu on right-click even immediately after a mouse click', async () => {
    const view = await openView();
    const cell = need(cellAt(view, 0, 0), 'first cell');

    // A normal left click first (selects the cell) …
    cell.dispatchEvent(ptr('pointerdown', { x: 10, y: 70, button: 0 }));
    cell.dispatchEvent(ptr('pointerup', { x: 10, y: 70, button: 0 }));
    // … then an immediate right-click on the same cell. The 1.5 s touch-dedupe window
    // must not apply: this is a mouse, not a touch long-press.
    ctx(cell);

    expect(shown, 'menu shown for the right-click').toHaveLength(1);
    expect(titles(shown[0])).toContain('Copy');
    expect(titles(shown[0])).toContain('Insert row above');
  });

  it('opens on consecutive rapid right-clicks (each re-arms nothing)', async () => {
    const view = await openView();
    const gridRoot = need(view.contentEl.querySelector('.tablify--grid'), 'grid root');

    // Nodes are re-queried: opening a menu re-renders the grid (row pool), so a captured
    // element can be detached by the time the next event is dispatched.
    ctx(need(cellAt(view, 0, 0), 'first cell'));
    // The right-click's own pointerup must not arm the dedupe window for the next one.
    gridRoot.dispatchEvent(ptr('pointerup', { x: 10, y: 70, button: 2 }));
    ctx(need(cellAt(view, 1, 0), 'second-row cell'));

    expect(shown, 'both right-clicks show a menu').toHaveLength(2);
  });

  it('still suppresses the native menu that follows a touch interaction (P5-03)', async () => {
    const view = await openView();
    const cell = need(cellAt(view, 0, 0), 'first cell');

    // Touch press (long-press would open the menu via LongPressDetector; the native
    // contextmenu that follows must be ignored so the menu does not open twice).
    cell.dispatchEvent(ptr('pointerdown', { x: 10, y: 70, pointerType: 'touch' }));
    ctx(cell);

    expect(shown, 'native touch context menu is swallowed').toHaveLength(0);
  });

  it('a row-handle press with no movement does not block later right-clicks', async () => {
    const view = await openView();
    const handle = need(handleAt(view, 0), 'row-number handle');
    const cell = need(cellAt(view, 0, 0), 'first cell');

    // Press on the `#` handle and never release (lost pointerup / window blur): the
    // drag's context-menu blocker must not be armed yet — the threshold was never crossed.
    handle.dispatchEvent(ptr('pointerdown', { x: 20, y: 70, button: 0 }));
    ctx(cell);

    expect(shown, 'menu still opens after an inert handle press').toHaveLength(1);
    expect(titles(shown[0])).toContain('Copy');
  });

  it('suppresses the menu while a row drag is active and restores it afterwards', async () => {
    const view = await openView();
    const handle = need(handleAt(view, 0), 'row-number handle');
    const cell = need(cellAt(view, 0, 0), 'first cell');

    handle.dispatchEvent(ptr('pointerdown', { x: 20, y: 70, button: 0 }));
    document.dispatchEvent(ptr('pointermove', { x: 20, y: 70 + ROW_DRAG_THRESHOLD_PX + 10 }));
    ctx(cell);
    expect(shown, 'no menu mid-drag').toHaveLength(0);

    document.dispatchEvent(ptr('pointerup', { x: 20, y: 200 }));
    ctx(cell);
    expect(shown, 'menu returns after the drag ends').toHaveLength(1);
  });

  it('right-click on the row-number lead opens the row menu (prototype tr behaviour)', async () => {
    const view = await openView();
    const handle = need(handleAt(view, 0), 'row-number handle');

    ctx(handle);

    expect(shown, 'row menu shown for the lead').toHaveLength(1);
    expect(titles(shown[0])).toContain('Insert row above');
    expect(titles(shown[0])).toContain('Delete row');
  });
});

// ---- GridView-level: the blocker cannot outlive the drag --------------------

describe('SAD-97 — row-drag context-menu blocker lifecycle (GridView)', () => {
  const FIELDS: FieldDefinition[] = [
    { id: 'fld_name', name: 'Name', type: 'text', primary: true },
    { id: 'fld_notes', name: 'Notes', type: 'long_text' },
  ];
  const rows = (n: number): Row[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `row_${i}`,
      rev: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      values: { fld_name: `Item ${i}` } as Row['values'],
      sync: null,
    }));

  let shown: Menu[];
  let restoreRects: () => void;

  beforeEach(() => {
    document.body.innerHTML = '';
    shown = [];
    vi.spyOn(Menu.prototype, 'showAtMouseEvent').mockImplementation(function (this: Menu) {
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

  function mount(): GridView {
    const grid = new GridView({
      rows: rows(3),
      fields: FIELDS,
      view: createDefaultView(FIELDS),
      theme: 'dark',
      viewportHeight: 600,
      viewportWidth: 800,
      onRowMove: () => undefined,
    });
    document.body.appendChild(grid.root);
    return grid;
  }

  it('pointercancel tears the blocker down even mid-drag', () => {
    const grid = mount();
    const handle = need(
      grid.root.querySelector<HTMLElement>('.tablify__row[data-row-index="0"] .tablify__lead--num'),
      'handle',
    );
    handle.dispatchEvent(ptr('pointerdown', { x: 20, y: 70, button: 0 }));
    document.dispatchEvent(ptr('pointermove', { x: 20, y: 70 + ROW_DRAG_THRESHOLD_PX + 10 }));
    // Simulate the browser cancelling the gesture (window blur, system gesture, …).
    document.dispatchEvent(ptr('pointercancel', {}));

    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    grid.root.dispatchEvent(ev);
    expect(ev.defaultPrevented, 'blocker no longer swallows contextmenu').toBe(false);
    grid.destroy();
  });

  it('a leaked press must not block context menus outside the grid either', () => {
    const grid = mount();
    const handle = need(
      grid.root.querySelector<HTMLElement>('.tablify__row[data-row-index="0"] .tablify__lead--num'),
      'handle',
    );
    // Inert press on the handle, release never delivered:
    handle.dispatchEvent(ptr('pointerdown', { x: 20, y: 70, button: 0 }));

    const outside = document.createElement('div');
    document.body.appendChild(outside);
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    outside.dispatchEvent(ev);
    expect(ev.defaultPrevented, 'nothing outside the grid is blocked').toBe(false);

    document.dispatchEvent(ptr('pointerup', { x: 20, y: 70 }));
    grid.destroy();
  });
});
