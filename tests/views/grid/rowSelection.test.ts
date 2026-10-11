/**
 * @vitest-environment jsdom
 *
 * SAD-80 — row selection, bulk delete and row drag reorder (prototype checkbox column,
 * #selectionSummary and `.row-drag-handle`).
 *
 * Covers the pure selection helpers, the two new undoable session commands, the GridView DOM /
 * ARIA / pointer behaviour (embeds without callbacks unchanged), the toolbar summary and the
 * TableView wiring (notices, block reasons, selection lifetime), plus axe with the column on.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axe from 'axe-core';
import { WorkspaceLeaf, Notice } from 'obsidian';
import { GridView, ROW_DRAG_THRESHOLD_PX, type GridOptions } from '../../../src/views/grid/GridView.js';
import {
  toggleRow,
  setVisibleRows,
  allVisibleSelected,
  pruneSelection,
  selectionLabel,
} from '../../../src/views/grid/selection.js';
import { TableView } from '../../../src/views/tableView.js';
import { createSession } from '../../../src/model/tableSession.js';
import { createDefaultView } from '../../../src/model/view.js';
import { makeFile } from '../../io/export.fixtures.js';
import type { FieldDefinition, Row, ViewDefinition } from '../../../src/model/types.js';

const FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
  { id: 'fld_notes', name: 'Notes', type: 'long_text' },
];

function rows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `row_${i}`,
    rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    values: { fld_name: `Item ${i}` } as Row['values'],
    sync: null,
  }));
}

function mount(extra: Partial<GridOptions> = {}, r: Row[] = rows(3), view?: ViewDefinition): GridView {
  const grid = new GridView({
    rows: r,
    fields: FIELDS,
    view: view ?? createDefaultView(FIELDS),
    theme: 'dark',
    viewportHeight: 600,
    viewportWidth: 800,
    ...extra,
  });
  document.body.appendChild(grid.root);
  return grid;
}

const SELECT_CALLBACKS = (): Partial<GridOptions> => ({
  onToggleRow: vi.fn(),
  onToggleAllRows: vi.fn(),
  onRowMove: vi.fn(),
});

function pointer(type: string, init: { clientX?: number; clientY?: number; button?: number } = {}): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
}

const rowChecks = (g: GridView) => Array.from(g.root.querySelectorAll<HTMLInputElement>('.tablify__row-check'));
const selectAll = (g: GridView) => g.root.querySelector<HTMLInputElement>('.tablify__select-all');
const handle = (g: GridView, i: number) =>
  g.root.querySelector<HTMLElement>(`.tablify__row[data-row-index="${i}"] .tablify__lead--num`);

/** jsdom has no layout: rows sit on a 50px pitch below a 45px header (8px gap + 42px slot). */
function stubLayout(): () => void {
  const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const rect = (top: number, height: number, width = 800) =>
      ({ top, bottom: top + height, left: 0, right: width, width, height, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    if (this.classList.contains('tablify__row')) return rect(45 + Number(this.dataset.rowIndex) * 50, 50);
    if (this.classList.contains('tablify__viewport')) return rect(45, 5000);
    if (this.classList.contains('tablify--grid')) return rect(0, 600);
    return rect(0, 0, 0);
  });
  return () => spy.mockRestore();
}

beforeEach(() => {
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------------------

describe('SAD-80 selection helpers (prototype selectedRowIds)', () => {
  it('toggleRow adds, removes and forces a state without mutating the input', () => {
    const empty = new Set<string>();
    const one = toggleRow(empty, 'a');
    expect([...one]).toEqual(['a']);
    expect(empty.size).toBe(0);
    expect([...toggleRow(one, 'a')]).toEqual([]);
    expect([...toggleRow(one, 'a', true)]).toEqual(['a']);
    expect([...toggleRow(one, 'b', false)]).toEqual(['a']);
  });

  it('select-all acts on the visible rows only and keeps hidden selections', () => {
    const sel = new Set(['hidden']);
    const all = setVisibleRows(sel, ['a', 'b'], true);
    expect([...all].sort()).toEqual(['a', 'b', 'hidden']);
    expect(allVisibleSelected(all, ['a', 'b'])).toBe(true);
    const none = setVisibleRows(all, ['a', 'b'], false);
    expect([...none]).toEqual(['hidden']);
    expect(allVisibleSelected(none, ['a', 'b'])).toBe(false);
    // No visible rows: never "all selected" (the prototype header box stays unchecked).
    expect(allVisibleSelected(all, [])).toBe(false);
  });

  it('pruneSelection drops deleted ids and returns the same set when nothing changed', () => {
    const sel = new Set(['a', 'b']);
    expect(pruneSelection(sel, ['a', 'b', 'c'])).toBe(sel);
    expect([...pruneSelection(sel, ['b'])]).toEqual(['b']);
  });

  it('selectionLabel matches the prototype wording', () => {
    expect(selectionLabel(1)).toBe('1 selected');
    expect(selectionLabel(12)).toBe('12 selected');
  });
});

describe('SAD-80 session commands (undoable)', () => {
  it('deleteRows removes every id in one undo step and undo restores the original order', () => {
    const s = createSession(makeFile(6));
    const ids = s.store.getDisplayOrder();
    expect(s.deleteRows([ids[1], ids[3], ids[1], 'missing'])).toBe(2);
    expect(s.store.getDisplayOrder()).toEqual([ids[0], ids[2], ids[4], ids[5]]);
    expect(s.undo()).toBe(true);
    expect(s.store.getDisplayOrder()).toEqual(ids);
    expect(s.redo()).toBe(true);
    expect(s.store.getDisplayOrder()).toEqual([ids[0], ids[2], ids[4], ids[5]]);
  });

  it('deleteRows with nothing to delete adds no undo entry', () => {
    const s = createSession(makeFile(3));
    expect(s.deleteRows([])).toBe(0);
    expect(s.deleteRows(['missing'])).toBe(0);
    expect(s.undo()).toBe(false);
  });

  it('moveRowBefore reorders (null = end), and undo / redo round-trip', () => {
    const s = createSession(makeFile(4));
    const [a, b, c, d] = s.store.getDisplayOrder();
    expect(s.moveRowBefore(a, d)).toBe(true);
    expect(s.store.getDisplayOrder()).toEqual([b, c, a, d]);
    expect(s.moveRowBefore(b, null)).toBe(true);
    expect(s.store.getDisplayOrder()).toEqual([c, a, d, b]);
    s.undo();
    expect(s.store.getDisplayOrder()).toEqual([b, c, a, d]);
    s.undo();
    expect(s.store.getDisplayOrder()).toEqual([a, b, c, d]);
    s.redo();
    expect(s.store.getDisplayOrder()).toEqual([b, c, a, d]);
  });

  it('moveRowBefore is a no-op for a drop in place (prototype noop check)', () => {
    const s = createSession(makeFile(3));
    const [a, b, c] = s.store.getDisplayOrder();
    expect(s.moveRowBefore(a, a)).toBe(false);
    expect(s.moveRowBefore(a, b)).toBe(false); // already directly before b
    expect(s.moveRowBefore(c, null)).toBe(false); // already last
    expect(s.moveRowBefore('missing', a)).toBe(false);
    expect(s.undo()).toBe(false);
  });
});

describe('SAD-80 GridView checkbox column', () => {
  it('embeds (no callbacks) keep the inert empty slot and the original ARIA column indexes', () => {
    const grid = mount();
    expect(rowChecks(grid)).toHaveLength(0);
    expect(selectAll(grid)).toBeNull();
    expect(grid.root.getAttribute('aria-colcount')).toBe('2');
    const first = grid.root.querySelector('.tablify__row .tablify__cell');
    expect(first?.getAttribute('aria-colindex')).toBe('1');
    expect(handle(grid, 0)?.classList.contains('tablify__lead--drag')).toBe(false);
    grid.destroy();
  });

  it('renders a labelled checkbox per row and a select-all box, shifting ARIA columns by one', () => {
    const grid = mount(SELECT_CALLBACKS());
    const boxes = rowChecks(grid);
    expect(boxes).toHaveLength(3);
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual(['Select row 1', 'Select row 2', 'Select row 3']);
    expect(selectAll(grid)?.getAttribute('aria-label')).toBe('Select all rows');
    expect(grid.root.getAttribute('aria-colcount')).toBe('3');
    const lead = boxes[0].parentElement;
    expect(lead?.getAttribute('role')).toBe('gridcell');
    expect(lead?.getAttribute('aria-colindex')).toBe('1');
    expect(grid.root.querySelector('.tablify__row .tablify__cell')?.getAttribute('aria-colindex')).toBe('2');
    expect(grid.root.querySelector('.tablify__header .tablify__header-cell')?.getAttribute('aria-colindex')).toBe('2');
    expect(handle(grid, 0)?.title).toBe('Drag to reorder row');
    grid.destroy();
  });

  it('row and header changes report through the callbacks', () => {
    const cbs = SELECT_CALLBACKS();
    const grid = mount(cbs);
    const box = rowChecks(grid)[1];
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(cbs.onToggleRow).toHaveBeenCalledWith('row_1', true);
    const all = selectAll(grid);
    if (!all) throw new Error('missing select-all');
    all.checked = true;
    all.dispatchEvent(new Event('change', { bubbles: true }));
    expect(cbs.onToggleAllRows).toHaveBeenCalledWith(true);
    grid.destroy();
  });

  it('setRowSelection updates boxes in place; select-all is checked only when every visible row is', () => {
    const grid = mount(SELECT_CALLBACKS());
    const before = rowChecks(grid);
    grid.setRowSelection(new Set(['row_0', 'row_2']));
    expect(rowChecks(grid).map((b) => b.checked)).toEqual([true, false, true]);
    expect(rowChecks(grid)[0]).toBe(before[0]); // no re-render
    expect(selectAll(grid)?.checked).toBe(false);
    grid.setRowSelection(new Set(['row_0', 'row_1', 'row_2', 'gone']));
    expect(selectAll(grid)?.checked).toBe(true);
    // A new model (e.g. filtered to fewer rows) keeps the boxes in step.
    grid.setModel(rows(2), FIELDS, createDefaultView(FIELDS));
    expect(rowChecks(grid).map((b) => b.checked)).toEqual([true, true]);
    expect(selectAll(grid)?.checked).toBe(true);
    grid.destroy();
  });

  it('Enter / Space on a checkbox stay with the checkbox; other keys still reach the grid', () => {
    const grid = mount(SELECT_CALLBACKS());
    const seen: string[] = [];
    grid.root.addEventListener('keydown', (e) => seen.push(e.key));
    const box = rowChecks(grid)[0];
    for (const key of ['Enter', ' ', 'z', 'ArrowDown']) {
      box.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ctrlKey: key === 'z' }));
    }
    selectAll(grid)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(seen).toEqual(['z', 'ArrowDown']);
    grid.destroy();
  });
});

describe('SAD-80 GridView row drag (`#` handle)', () => {
  let restore: () => void = () => undefined;
  beforeEach(() => {
    restore = stubLayout();
  });
  afterEach(() => restore());

  it('drops before the first row whose slot midpoint is below the pointer and shows the line', () => {
    const cbs = SELECT_CALLBACKS();
    const grid = mount(cbs, rows(5));
    handle(grid, 0)?.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 70 }));
    // Row 3: top 195, slot 203–245, midpoint 224. A pointer at 222 lands before it (the row
    // element's own midpoint, 220, would wrongly pick row 4: the 8px gap is not the row).
    document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 222 }));
    expect(grid.root.classList.contains('tablify--row-dragging')).toBe(true);
    expect(grid.root.querySelector('.tablify__row[data-row-index="0"]')?.classList.contains('tablify__row--dragging')).toBe(true);
    const line = grid.root.querySelector<HTMLElement>('.tablify__row-drop');
    expect(line?.style.display).toBe('block');
    // 5px above row 3's slot (203), in viewport coordinates (viewport top 45).
    expect(line?.style.top).toBe(`${203 - 5 - 45}px`);
    expect(line?.getAttribute('aria-hidden')).toBe('true');
    document.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 222 }));
    expect(cbs.onRowMove).toHaveBeenCalledWith('row_0', 'row_3');
    expect(grid.root.classList.contains('tablify--row-dragging')).toBe(false);
    expect(grid.root.querySelector('.tablify__row--dragging')).toBeNull();
    expect(line?.style.display).toBe('none');
    grid.destroy();
  });

  it('below the last row drops at the end (null)', () => {
    const cbs = SELECT_CALLBACKS();
    const grid = mount(cbs, rows(3));
    handle(grid, 1)?.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 120 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 590 }));
    document.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 590 }));
    expect(cbs.onRowMove).toHaveBeenCalledWith('row_1', null);
    grid.destroy();
  });

  it('below the rendered window targets the next unrendered row, not the end', () => {
    const cbs = SELECT_CALLBACKS();
    const grid = mount(cbs, rows(200));
    const rendered = Array.from(grid.root.querySelectorAll<HTMLElement>('.tablify__row[data-row-id]'));
    const lastIdx = Math.max(...rendered.map((r) => Number(r.dataset.rowIndex)));
    expect(lastIdx).toBeLessThan(199);
    handle(grid, 0)?.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 70 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 99999 }));
    document.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 99999 }));
    expect(cbs.onRowMove).toHaveBeenCalledWith('row_0', `row_${lastIdx + 1}`);
    grid.destroy();
  });

  it('a press that moves less than the threshold is a click: nothing moves', () => {
    const cbs = SELECT_CALLBACKS();
    const grid = mount(cbs, rows(3));
    handle(grid, 0)?.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 70 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 22, clientY: 70 + ROW_DRAG_THRESHOLD_PX - 3 }));
    expect(grid.root.classList.contains('tablify--row-dragging')).toBe(false);
    document.dispatchEvent(pointer('pointerup', { clientX: 22, clientY: 72 }));
    expect(cbs.onRowMove).not.toHaveBeenCalled();
    grid.destroy();
  });

  it('does not prevent the press (an open editor must blur and commit) and ignores non-primary buttons', () => {
    const cbs = SELECT_CALLBACKS();
    const grid = mount(cbs, rows(3));
    const down = pointer('pointerdown', { clientX: 20, clientY: 70 });
    handle(grid, 0)?.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    document.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 70 }));
    handle(grid, 0)?.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 70, button: 2 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 300 }));
    document.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 300 }));
    expect(cbs.onRowMove).not.toHaveBeenCalled();
    grid.destroy();
  });

  it('a blocked drag (sorted / grouped view) reports the reason once and never shows the line', () => {
    const onRowMoveBlocked = vi.fn();
    const cbs = { ...SELECT_CALLBACKS(), rowMoveBlocked: () => 'Clear sorting to reorder rows manually', onRowMoveBlocked };
    const grid = mount(cbs, rows(3));
    handle(grid, 0)?.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 70 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 200 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 220 }));
    document.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 220 }));
    expect(onRowMoveBlocked).toHaveBeenCalledTimes(1);
    expect(onRowMoveBlocked).toHaveBeenCalledWith('Clear sorting to reorder rows manually');
    expect(cbs.onRowMove).not.toHaveBeenCalled();
    expect(grid.root.classList.contains('tablify--row-dragging')).toBe(false);
    grid.destroy();
  });

  it('pointercancel and destroy() clean up without moving; the row menu is suppressed mid-drag', () => {
    const cbs = SELECT_CALLBACKS();
    const grid = mount(cbs, rows(3));
    handle(grid, 0)?.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 70 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 200 }));
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    handle(grid, 1)?.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    document.dispatchEvent(pointer('pointercancel'));
    expect(grid.root.classList.contains('tablify--row-dragging')).toBe(false);
    document.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 200 }));
    expect(cbs.onRowMove).not.toHaveBeenCalled();
    // After the drag, context menus behave normally again.
    const later = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    handle(grid, 1)?.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);

    handle(grid, 0)?.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 70 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 200 }));
    grid.destroy();
    document.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 200 }));
    expect(cbs.onRowMove).not.toHaveBeenCalled();
  });

  it('auto-scrolls near the bottom edge of the shell mid-drag', () => {
    const grid = mount(SELECT_CALLBACKS(), rows(200));
    handle(grid, 0)?.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 70 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 590 }));
    expect(grid.root.scrollTop).toBeGreaterThan(0);
    document.dispatchEvent(pointer('pointercancel'));
    grid.destroy();
  });
});

// ---------------------------------------------------------------------------------------

describe('SAD-80 TableView wiring', () => {
  function file(sort: ViewDefinition['sort'] = [], groupBy: string | null = null): string {
    const mk = (id: string, name: string) => ({
      id,
      rev: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      values: { fld_name: name },
      sync: null,
    });
    return JSON.stringify({
      formatVersion: 1,
      tableId: 'tbl_t',
      name: 'T',
      fields: [
        { id: 'fld_name', name: 'Name', type: 'text', primary: true },
        { id: 'fld_notes', name: 'Notes', type: 'long_text' },
      ],
      rows: [mk('r1', 'Beta'), mk('r2', 'Alpha'), mk('r3', 'Gamma')],
      views: [
        {
          id: 'view_1',
          name: 'Default',
          sort,
          groupBy,
          hidden: [],
          frozenColumns: 1,
          rowHeight: 'medium',
          columnWidths: {},
          columnOrder: ['fld_name', 'fld_notes'],
          warnings: [],
        },
      ],
      syncLink: null,
    });
  }

  async function open(data = file()): Promise<TableView> {
    const view = new TableView(new WorkspaceLeaf() as never);
    await view.onOpen();
    document.body.appendChild(view.contentEl);
    view.setViewData(data, false);
    return view;
  }
  const q = <T extends HTMLElement>(v: TableView, sel: string) => v.contentEl.querySelector<T>(sel);
  const checks = (v: TableView) => Array.from(v.contentEl.querySelectorAll<HTMLInputElement>('.tablify__row-check'));
  const summary = (v: TableView) => q<HTMLElement>(v, '[data-testid="tablify-selection-summary"]');
  const savedIds = (v: TableView) => (JSON.parse(v.getViewData()).rows as { id: string }[]).map((r) => r.id);
  const tick = (box: HTMLInputElement, on = true) => {
    box.checked = on;
    box.dispatchEvent(new Event('change', { bubbles: true }));
  };

  beforeEach(() => {
    Notice.messages = [];
  });

  it('the summary is hidden until rows are selected, then shows the prototype count', async () => {
    const view = await open();
    expect(summary(view)?.hidden).toBe(true);
    tick(checks(view)[0]);
    tick(checks(view)[2]);
    expect(summary(view)?.hidden).toBe(false);
    expect(q(view, '.tablify__selected-count')?.textContent).toBe('2 selected');
    expect(q(view, '.tablify__delete-selected')?.textContent).toBe('Delete');
    tick(checks(view)[0], false);
    expect(q(view, '.tablify__selected-count')?.textContent).toBe('1 selected');
  });

  it('selecting is UI state only: no save, no undo entry', async () => {
    const view = await open();
    const data = view.getViewData();
    tick(checks(view)[1]);
    expect(view.getViewData()).toBe(data);
    q<HTMLElement>(view, '[data-action="undo"]')?.click();
    expect(view.getViewData()).toBe(data);
  });

  it('select-all toggles the visible rows; Delete removes them in one undo step with a notice', async () => {
    const view = await open();
    const all = q<HTMLInputElement>(view, '.tablify__select-all');
    if (!all) throw new Error('missing select-all');
    tick(all);
    expect(checks(view).every((b) => b.checked)).toBe(true);
    expect(all.checked).toBe(true);
    tick(all, false);
    expect(checks(view).some((b) => b.checked)).toBe(false);

    tick(checks(view)[0]);
    tick(checks(view)[2]);
    q<HTMLElement>(view, '.tablify__delete-selected')?.click();
    expect(savedIds(view)).toEqual(['r2']);
    expect(Notice.messages.at(-1)).toBe('Deleted 2 rows');
    expect(summary(view)?.hidden).toBe(true);
    q<HTMLElement>(view, '[data-action="undo"]')?.click();
    expect(savedIds(view)).toEqual(['r1', 'r2', 'r3']);
    // The selection was cleared by Delete, so restored rows come back unselected.
    expect(checks(view).some((b) => b.checked)).toBe(false);
  });

  it('a selected row removed another way leaves the selection, so undo restores it unselected', async () => {
    const view = await open();
    tick(checks(view)[0]);
    tick(checks(view)[1]);
    const s = (view as unknown as { session: { deleteRow(id: string): void } }).session;
    s.deleteRow('r1');
    (view as unknown as { renderGrid(): void }).renderGrid();
    expect(q(view, '.tablify__selected-count')?.textContent).toBe('1 selected');
    q<HTMLElement>(view, '[data-action="undo"]')?.click();
    expect(savedIds(view)).toEqual(['r1', 'r2', 'r3']);
    expect(checks(view).map((b) => b.checked)).toEqual([false, true, false]);
    expect(q(view, '.tablify__selected-count')?.textContent).toBe('1 selected');
  });

  it('loading a file clears the selection (prototype switchTable)', async () => {
    const view = await open();
    tick(checks(view)[0]);
    view.setViewData(file(), false);
    expect(summary(view)?.hidden).toBe(true);
    expect(checks(view).some((b) => b.checked)).toBe(false);
  });

  it('row drop reorders the stored rows with a notice and one undo step', async () => {
    const restore = stubLayout();
    try {
      const view = await open();
      const h = q<HTMLElement>(view, '.tablify__row[data-row-index="0"] .tablify__lead--num');
      h?.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 70 }));
      document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 590 }));
      document.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 590 }));
      expect(savedIds(view)).toEqual(['r2', 'r3', 'r1']);
      expect(Notice.messages.at(-1)).toBe('Row moved');
      q<HTMLElement>(view, '[data-action="undo"]')?.click();
      expect(savedIds(view)).toEqual(['r1', 'r2', 'r3']);
    } finally {
      restore();
    }
  });

  it.each([
    [file([{ fieldId: 'fld_name', direction: 'asc' }]), 'Clear sorting to reorder rows manually'],
    [file([], 'fld_notes'), 'Disable grouping to reorder rows manually'],
  ])('reorder is blocked with the prototype message (%#)', async (data, message) => {
    const restore = stubLayout();
    try {
      const view = await open(data);
      const before = view.getViewData();
      const h = q<HTMLElement>(view, '.tablify__row[data-row-index="0"] .tablify__lead--num');
      h?.dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 70 }));
      document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 590 }));
      document.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 590 }));
      expect(Notice.messages.at(-1)).toBe(message);
      expect(view.getViewData()).toBe(before);
    } finally {
      restore();
    }
  });
});

describe('SAD-80 axe with the checkbox column on', () => {
  it('no critical or serious violations', async () => {
    const grid = mount(SELECT_CALLBACKS(), rows(5));
    grid.setRowSelection(new Set(['row_1']));
    const results = await axe.run(grid.root, {
      rules: Object.fromEntries(
        ['region', 'landmark-one-main', 'page-has-heading-one', 'bypass', 'html-has-lang', 'color-contrast'].map((r) => [
          r,
          { enabled: false },
        ]),
      ),
    } as unknown as Parameters<typeof axe.run>[1]);
    const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(blocking, JSON.stringify(blocking.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.length })))).toEqual([]);
    grid.destroy();
  });
});
