/**
 * @vitest-environment jsdom
 *
 * SAD-305 — mobile on-screen keyboard layout & cell editing regression tests.
 *
 * When double-tapping a cell on mobile opens the on-screen keyboard and shrinks the viewport:
 *   1. `.tablify__card`, `.tablify__body`, and `.tablify--grid` must not crush the row viewport
 *      to 0px under the sticky `.tablify__header` (while 0–2 row tables still hug their content).
 *   2. Height-only resizes (portrait keyboard open/close) must re-evaluate the virtual row range
 *      and keep the active cell/editor scrolled into view and aligned over its capsule.
 *   3. `scrollToRow` must never scroll a row's top edge underneath the sticky header when the
 *      viewport height is tight.
 *   4. Scrolling works normally while editing, and the layout recovers when the keyboard closes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceLeaf } from 'obsidian';
import { TableView } from '../../src/views/tableView.js';
import {
  GridView,
  GRID_HEADER_CHROME_PX,
  GRID_MIN_VISIBLE_BODY_PX,
} from '../../src/views/grid/GridView.js';
import { createDefaultView } from '../../src/model/view.js';
import type { FieldDefinition, Row } from '../../src/model/types.js';

const NOW = '2026-10-19T00:00:00.000Z';

function makeFields(count = 4): FieldDefinition[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `fld_${i}`,
    name: `Field ${i}`,
    type: 'text' as const,
    ...(i === 0 ? { primary: true } : {}),
  }));
}

function makeRows(count: number, fields: FieldDefinition[]): Row[] {
  return Array.from({ length: count }, (_, r) => ({
    id: `row_${r}`,
    rev: 1,
    createdAt: NOW,
    updatedAt: NOW,
    sync: null,
    values: Object.fromEntries(fields.map((f, c) => [f.id, `R${r}C${c}`])),
  }));
}

function tableJson(rowCount: number, fieldCount = 4): string {
  const fields = makeFields(fieldCount);
  const rows = makeRows(rowCount, fields);
  return JSON.stringify({
    formatVersion: 2,
    tableId: 'tbl_sad305',
    name: 'Mobile Table',
    fields,
    rows,
    views: [
      {
        id: 'viw_1',
        name: 'Grid',
        type: 'grid',
        columnOrder: fields.map((f) => f.id),
        columnWidths: {},
        frozenColumns: 1,
        rowHeight: 'medium',
      },
    ],
    syncLink: null,
  });
}

function need<T>(value: T | null | undefined, label: string): T {
  expect(value, label).not.toBeNull();
  if (value === null || value === undefined) throw new Error(`missing: ${label}`);
  return value;
}

const openViews: TableView[] = [];

async function openTableView(rowCount: number): Promise<TableView> {
  const view = new TableView(new WorkspaceLeaf() as never);
  await view.onOpen();
  document.body.appendChild(view.contentEl);
  view.setViewData(tableJson(rowCount), false);
  openViews.push(view);
  return view;
}

function tapCell(cell: HTMLElement): void {
  const down = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
  Object.defineProperty(down, 'pointerType', { value: 'touch' });
  cell.dispatchEvent(down);
  const up = new MouseEvent('pointerup', { bubbles: true, cancelable: true, button: 0 });
  Object.defineProperty(up, 'pointerType', { value: 'touch' });
  cell.dispatchEvent(up);
  cell.click();
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('SAD-305 — CSS and content-bounded minimum height floors', () => {
  const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');
  const rule = (sel: string): string => {
    const at = css.indexOf(sel);
    expect(at, `${sel} missing`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf('}', at));
  };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    for (const v of openViews) v.clear();
    openViews.length = 0;
  });

  it('wires min-height CSS custom properties on .tablify__card, .tablify__body, and .tablify--grid', () => {
    expect(rule('.tablify__card {')).toContain('min-height: var(--tablify-card-min-height, 0px);');
    expect(rule('.tablify__body {')).toContain('min-height: var(--tablify-grid-min-height, 0px);');
    expect(rule('.tablify--grid {')).toContain('min-height: var(--tablify-grid-min-height, 0px);');
  });

  it('leaves min-height floor unset for 0-row tables so empty tables shrink to content (SAD-79 S-6)', async () => {
    const view = await openTableView(0);
    const card = need(view.contentEl.querySelector<HTMLElement>('.tablify__card'), 'card');
    const grid = need(view.contentEl.querySelector<HTMLElement>('.tablify--grid'), 'grid');

    expect(grid.style.getPropertyValue('--tablify-grid-min-height')).toBe('');
    expect(card.style.getPropertyValue('--tablify-grid-min-height')).toBe('');
    expect(card.style.getPropertyValue('--tablify-card-min-height')).toBe('');
  });

  it('bounds the floor by natural content height for 1-2 row tables and caps at 3 rows for larger tables', async () => {
    const view1 = await openTableView(1);
    const grid1 = need(view1.contentEl.querySelector<HTMLElement>('.tablify--grid'), 'grid 1');
    // 1 medium row: bodyHeight = 50 + 8 = 58px -> floor = 62 + 58 = 120px (< 163px natural height)
    expect(grid1.style.getPropertyValue('--tablify-grid-min-height')).toBe(
      `${GRID_HEADER_CHROME_PX + 58}px`,
    );

    const view20 = await openTableView(20);
    const card20 = need(view20.contentEl.querySelector<HTMLElement>('.tablify__card'), 'card 20');
    const grid20 = need(view20.contentEl.querySelector<HTMLElement>('.tablify--grid'), 'grid 20');
    const expectedFloor = GRID_HEADER_CHROME_PX + GRID_MIN_VISIBLE_BODY_PX; // 220px
    expect(grid20.style.getPropertyValue('--tablify-grid-min-height')).toBe(`${expectedFloor}px`);
    expect(card20.style.getPropertyValue('--tablify-grid-min-height')).toBe(`${expectedFloor}px`);
    expect(
       parseFloat(card20.style.getPropertyValue('--tablify-card-min-height')),
    ).toBeGreaterThanOrEqual(expectedFloor + 180);
    // SAD-71 contract: inline width/height on grid.root stay empty.
    expect(grid20.style.width).toBe('');
    expect(grid20.style.height).toBe('');
  });
});

describe('SAD-305 — scrollToRow clamping and height-only ResizeObserver recovery', () => {
  let observerCallback: (() => void) | null = null;
  const OriginalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    document.body.innerHTML = '';
    observerCallback = null;
    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        observerCallback = () => cb([], this as unknown as ResizeObserver);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = OriginalResizeObserver;
    for (const v of openViews) v.clear();
    openViews.length = 0;
  });

  it('never scrolls a target row underneath the sticky header when the viewport is tight', () => {
    const fields = makeFields(3);
    const rows = makeRows(10, fields);
    const grid = new GridView({
      rows,
      fields,
      view: createDefaultView(fields),
      theme: 'light',
      viewportWidth: 390,
      viewportHeight: 600,
    });
    document.body.appendChild(grid.root);

    // Simulate a severely compressed grid (clientHeight = 55px, sticky header = 45px).
    Object.defineProperty(grid.root, 'clientHeight', { value: 55, configurable: true });
    Object.defineProperty(grid.header, 'offsetHeight', { value: 45, configurable: true });

    // Row 0 starts at top = 0; scrollToRow(0) must keep scrollTop at 0, not push it to 40px.
    grid.scrollToRow(0);
    expect(grid.root.scrollTop).toBe(0);

    // Row 2 starts at top = 100; scrollToRow(2) must never set scrollTop > 100.
    grid.scrollToRow(2);
    expect(grid.root.scrollTop).toBeLessThanOrEqual(100);
    expect(grid.root.scrollTop).toBe(100);

    grid.destroy();
  });

  it('re-renders the virtual row window on height-only ResizeObserver events (keyboard open and close)', () => {
    const fields = makeFields(3);
    const rows = makeRows(40, fields);
    const onViewportResize = vi.fn();
    const grid = new GridView({
      rows,
      fields,
      view: createDefaultView(fields),
      theme: 'light',
      viewportWidth: 390,
      viewportHeight: 220,
      onViewportResize,
    });
    document.body.appendChild(grid.root);

    // Width stays constant at 390px (mobile portrait).
    Object.defineProperty(grid.root, 'clientWidth', { value: 390, configurable: true });
    Object.defineProperty(grid.root, 'clientHeight', { value: 220, configurable: true });
    need(observerCallback, 'ResizeObserver callback')();
    const countWhileKeyboardOpen = grid.getRenderedRowCount();

    // Dismiss the keyboard: height expands to 600px while width remains 390px.
    Object.defineProperty(grid.root, 'clientHeight', { value: 600, configurable: true });
    need(observerCallback, 'ResizeObserver callback')();
    const countAfterKeyboardDismissed = grid.getRenderedRowCount();

    expect(countAfterKeyboardDismissed).toBeGreaterThan(countWhileKeyboardOpen);
    expect(onViewportResize).toHaveBeenCalledTimes(2);
    grid.destroy();
  });
});

describe('SAD-305 — mobile double-tap editing when the on-screen keyboard opens', () => {
  const OriginalResizeObserver = globalThis.ResizeObserver;
  let resizeObservers: Array<() => void> = [];

  beforeEach(() => {
    document.body.innerHTML = '';
    resizeObservers = [];
    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        resizeObservers.push(() => cb([], this as unknown as ResizeObserver));
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = OriginalResizeObserver;
    for (const v of openViews) v.clear();
    openViews.length = 0;
    vi.restoreAllMocks();
  });

  it('keeps the active cell, row, and inline editor visible and aligned when the mobile keyboard shrinks the viewport', async () => {
    const view = await openTableView(15);
    const contentEl = view.contentEl;
    const card = need(contentEl.querySelector<HTMLElement>('.tablify__card'), 'card');
    const titleRow = need(contentEl.querySelector<HTMLElement>('.tablify__title-row'), 'title row');
    const toolbar = need(contentEl.querySelector<HTMLElement>('.tablify__toolbar'), 'toolbar');
    const gridRoot = need(contentEl.querySelector<HTMLElement>('.tablify--grid'), 'grid root');
    const header = need(gridRoot.querySelector<HTMLElement>('.tablify__header'), 'header');

    // Initial mobile layout at rest (390x844).
    Object.defineProperty(contentEl, 'clientWidth', { value: 390, configurable: true });
    Object.defineProperty(contentEl, 'clientHeight', { value: 844, configurable: true });
    Object.defineProperty(contentEl, 'scrollHeight', { value: 844, configurable: true });
    Object.defineProperty(gridRoot, 'clientWidth', { value: 356, configurable: true });
    Object.defineProperty(gridRoot, 'clientHeight', { value: 580, configurable: true });
    Object.defineProperty(header, 'offsetHeight', { value: 45, configurable: true });

    // Double-tap cell (row 4, col 0) via touch to start editing.
    const cell = need(
      gridRoot.querySelector<HTMLElement>('.tablify__row[data-row-index="4"] .tablify__cell[data-col-index="0"]'),
      'row 4 col 0',
    );
    tapCell(cell);
    tapCell(cell);

    const editor = need(gridRoot.querySelector<HTMLInputElement>('input.tablify__editor'), 'inline editor');
    expect(editor.value).toBe('R4C0');

    // Simulate the on-screen keyboard opening after focus:
    // .tablify-view shrinks to 280px height while .tablify__card stays floored at >= 440px,
    // and .tablify--grid shrinks to its 220px floor (and gains a 6px vertical scrollbar).
    Object.defineProperty(contentEl, 'clientHeight', { value: 280, configurable: true });
    Object.defineProperty(contentEl, 'scrollHeight', { value: 460, configurable: true });
    Object.defineProperty(gridRoot, 'clientWidth', { value: 350, configurable: true });
    Object.defineProperty(gridRoot, 'clientHeight', { value: 220, configurable: true });

    const origGetRect = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ): DOMRect {
      if (this === contentEl) return rect(0, 0, 390, 280);
      if (this === card) return rect(12, 12, 366, 440);
      if (this === gridRoot) return rect(28, 220, 350, 220);
      if (
        this.classList.contains('tablify__capsule') &&
        this.closest('.tablify__row[data-row-index="4"] .tablify__cell[data-col-index="0"]')
      ) {
        return rect(38, 330, 148, 34);
      }
      return origGetRect.call(this);
    });

    // Fire ResizeObserver and view.onResize() as the keyboard opens.
    for (const fire of resizeObservers) fire();
    view.onResize();

    // 1. Editor stays open and aligned to the new capsule geometry + grid scrollTop.
    expect(gridRoot.contains(editor), 'editor stays mounted').toBe(true);
    expect(editor.style.width).toBe('148px');
    expect(editor.style.height).toBe('34px');
    // 2. Grid scrolled row 4 (top = 200..250) into the 220px grid viewport below the 45px header.
    expect(gridRoot.scrollTop).toBeGreaterThan(0);
    expect(gridRoot.scrollTop).toBeLessThanOrEqual(200);
    // 3. Outer .tablify-view scrolled down so the active cell (bottom 364 > 280) is above the keyboard.
    expect(contentEl.scrollTop).toBeGreaterThan(0);
    // 4. Title row, toolbar, header, and rows all remain present and accessible.
    expect(titleRow.isConnected).toBe(true);
    expect(toolbar.isConnected).toBe(true);
    expect(header.isConnected).toBe(true);
    expect(gridRoot.querySelectorAll('.tablify__row').length).toBeGreaterThan(0);

    // 5. Pressing on the grid scrollbar (target === gridRoot) or scrolling while editing keeps editor open.
    const scrollbarPress = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(scrollbarPress, 'pointerType', { value: 'touch' });
    gridRoot.dispatchEvent(scrollbarPress);
    expect(gridRoot.contains(editor), 'scrollbar touch does not close editor').toBe(true);

    // Scroll vertically while editing to access later rows.
    gridRoot.scrollTop = 350;
    gridRoot.dispatchEvent(new Event('scroll'));
    expect(gridRoot.contains(editor), 'scrolling keeps editor open').toBe(true);
    expect(
      gridRoot.querySelector('.tablify__row[data-row-index="8"]'),
      'scrolled rows render while editing',
    ).not.toBeNull();

    // Commit edit and dismiss keyboard: layout and outer scroll recover.
    editor.value = 'Updated on mobile';
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(gridRoot.querySelector('input.tablify__editor')).toBeNull();

    Object.defineProperty(contentEl, 'clientHeight', { value: 844, configurable: true });
    Object.defineProperty(contentEl, 'scrollHeight', { value: 844, configurable: true });
    Object.defineProperty(gridRoot, 'clientHeight', { value: 580, configurable: true });
    view.onResize();

    expect(contentEl.scrollTop).toBe(0);
    const saved = JSON.parse(view.getViewData());
    expect(saved.rows[4].values.fld_0).toBe('Updated on mobile');
  });
});
