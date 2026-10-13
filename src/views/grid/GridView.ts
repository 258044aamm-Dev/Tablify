/**
 * Grid view with virtual rows.
 * Renders only visible rows + overscan, recycles row elements, supports touch scrolling.
 * Column virtualization is NOT implemented; all visible columns are rendered per row.
 * Row height comes from ViewDefinition.rowHeight via src/model/view.ts (small/medium/large).
 * Column widths and frozen columns come from the view too (SAD-69 C).
 * Theme is applied via src/ui/theme/tokens.ts applyTheme on the root.
 *
 * P5-00: adds a sticky header, a single selected cell, click-to-select, and setModel() so the
 * table view can swap rows/fields after each undoable change. Fields passed in are already
 * in view order and exclude hidden columns (see src/model/viewOrder.ts).
 *
 * SAD-79: prototype grid geometry (Prototype/index.html `#tableInnerContainer`, script.js
 * `renderGrid` / `headCellHtml` / `cellHtml`). The prototype is a `border-separate` table —
 * 6px column spacing, 8px row spacing, `table-layout: fixed; width: 100%` — so:
 *   - every row starts with a 32px checkbox slot and a 40px `#` slot (`w-8`, `w-10`);
 *   - when the columns are narrower than the shell, every slot scales up proportionally to
 *     fill it (fill mode); wider tables keep their widths and scroll horizontally;
 *   - header cells are capsules with grip, key, sortable name, sort arrow, type badge, ⋮ and
 *     a resize handle; body cells are 34/34/40px capsules inside 4px-padded slots;
 *   - the root is the one scroll container for both axes, so the sticky header and the
 *     sticky frozen block share a single reference and no scroll mirroring is needed;
 *   - the Insert Row pill lives inside the shell, sticky to the visible width.
 * `.tablify__cell` stays the column slot (the prototype's `<td>`) and keeps its data
 * attributes, so selection, editors and menus address cells exactly as before.
 */

import { getVisibleRange, rowHeightPx, rowHeightKey, totalHeight, OVERSCAN } from './virtual.js';
import { RowPool } from './rowPool.js';
import { applyTheme, optionChipColors } from '../../ui/theme/tokens.js';
import { faIcon } from '../../ui/faIcons.js';
import { typeIcon, typeLabel } from './fieldTypeBadge.js';
import type { Row, FieldDefinition, CellValue } from '../../model/types.js';
import type { ViewDefinition } from '../../model/types.js';
import { effectiveFrozenColumns } from '../../model/view.js';
import { getFieldType } from '../../model/fieldTypes/registry.js';
import type { GridGroup } from './grouping.js';

export interface GridOptions {
  rows: Row[];
  fields: FieldDefinition[];
  view: ViewDefinition;
  theme: 'light' | 'dark';
  viewportHeight?: number; // default 600
  viewportWidth?: number; // default 800, for column measurement
  /**
   * SAD-100: fired when the pane width changed and geometry was re-applied (the table pane is
   * what the viewport freeze default measures). Lets the toolbar mirror the new effective state.
   */
  onPaneWidthChange?: () => void;
  /** Called when a body cell is clicked. Indexes refer to the current rows and fields. */
  onCellClick?: (rowIndex: number, colIndex: number) => void;
  /**
   * SAD-96: the clicked cell was already selected (a second click/tap on it). Touch uses this
   * to open the editor where there is no Enter key; fired after onCellClick.
   */
  onCellReselect?: (rowIndex: number, colIndex: number) => void;
  /** SAD-96: a body cell was double-clicked — open its editor (the documented edit gesture). */
  onCellActivate?: (rowIndex: number, colIndex: number) => void;
  /** P8-03: error state of a formula cell (tooltip and styling). Null for a good value. */
  formulaError?: (rowId: string, fieldId: string) => { code: string; message: string } | null;
  /** P8-04: label text for a link cell, and how many of its links are broken. */
  linkSummary?: (value: CellValue | undefined) => {
    text: string;
    broken: number;
    chips?: Array<{ label: string; broken: boolean }>;
  };
  /**
   * SAD-79: header name click — plain click cycles this column's sort, Shift adds/cycles it
   * as an extra sort key (prototype `headerSortClick`). Without it the name is plain text.
   */
  onSortClick?: (colIndex: number, additive: boolean) => void;
  /** SAD-79: the header capsule's ⋮ button. Without it the button is not rendered. */
  onHeaderMenu?: (colIndex: number, pos: { x: number; y: number }) => void;
  /** SAD-79: commit a column resize (px, already clamped). Without it no handle is rendered. */
  onColumnResize?: (fieldId: string, width: number) => void;
  /**
   * SAD-79: commit a header-grip drag: move `fieldId` onto `targetFieldId` (prototype
   * `colDrop`). Without it no grip is rendered.
   */
  onColumnMove?: (fieldId: string, targetFieldId: string) => void;
  /** SAD-79: Insert Row pill inside the shell (prototype `#insertRowWrap`). Omitted = no pill. */
  onInsertRow?: () => void;
  /**
   * SAD-80: a row checkbox changed (prototype `toggleSelectRow`). Without it the checkbox slot
   * stays empty and the grid's ARIA columns are exactly the fields (embeds).
   */
  onToggleRow?: (rowId: string, checked: boolean) => void;
  /** SAD-80: the header checkbox changed — select or clear the rows in view (`toggleSelectAll`). */
  onToggleAllRows?: (checked: boolean) => void;
  /**
   * SAD-80: commit a row drag from the `#` cell: put `rowId` directly above `beforeRowId`
   * (null = after the last row). Without it rows cannot be dragged.
   */
  onRowMove?: (rowId: string, beforeRowId: string | null) => void;
  /** SAD-80: why rows cannot be reordered right now (a sort or grouping is active), or null. */
  rowMoveBlocked?: () => string | null;
  /** SAD-80: a row drag was refused for `reason` (the prototype shows it as a toast). */
  onRowMoveBlocked?: (reason: string) => void;
  /**
   * SAD-81: group headers (Options → Group by). `rows` must then be the grouped rows with
   * collapsed groups left out (see grouping.ts). Null or absent = the flat grid, unchanged.
   */
  groups?: GridGroup[] | null;
  /** SAD-81: a group header was clicked — collapse or expand the group with this key. */
  onToggleGroup?: (key: string) => void;
}

/**
 * SAD-81: group header pitch — the row's 8px gap plus the prototype's `pt-2 pb-0.5` cell around
 * the header button: 22px when the label is an option chip, 16px (one text line) otherwise.
 */
export const GROUP_HEADER_CHIP_PX = 40;
export const GROUP_HEADER_TEXT_PX = 34;

/** One virtual item of the grouped layout: a group header or a data row. */
type GroupedItem = { kind: 'group'; group: GridGroup } | { kind: 'row'; rowIdx: number; number: number };

interface GroupedLayout {
  items: GroupedItem[];
  /** Top offset of each item; tops[items.length] is the total height. */
  tops: number[];
  /** Item index of each data row (by row index). */
  rowItem: number[];
}

export interface GridSelection {
  row: number;
  col: number;
}

/**
 * Column width used when the view records no width for a field.
 *
 * SAD-69 C: `view.columnWidths` was written by setColumnWidth() and carried through
 * serialize/normalizeView, but nothing ever read it — cells were `flex: 1` with a
 * `min-width`. Columns now have a real width, which frozen columns need anyway:
 * `position: sticky; left` is meaningless without a known geometry.
 */
export const DEFAULT_COLUMN_WIDTH = 160;

/** SAD-79: prototype leading slots — checkbox `th.w-8` and `#` `th.w-10`. */
export const LEAD_CHECK_WIDTH = 32;
export const LEAD_NUM_WIDTH = 40;
/** SAD-79: prototype `border-spacing` — 6px between columns, 8px between rows. */
export const COLUMN_GAP = 6;
export const ROW_GAP = 8;
/** SAD-79: prototype `colResizeStart` clamp. */
export const RESIZE_MIN_WIDTH = 120;
export const RESIZE_MAX_WIDTH = 520;
/** Pointer travel before a grip press becomes a column drag. */
const DRAG_THRESHOLD_PX = 4;
/** Number of leading (non-field) slots in every row. */
const LEAD_SLOTS = 2;
/** SAD-80: prototype `rowDragMove` threshold — |dx| + |dy| before a `#` press becomes a drag. */
export const ROW_DRAG_THRESHOLD_PX = 5;
/** Prototype `#rowDropIndicator` left/right inset inside the scroll container. */
const ROW_DROP_INSET_PX = 10;
/** SAD-80: distance from the shell's top/bottom edge that auto-scrolls a row drag, and the step. */
const ROW_DRAG_EDGE_PX = 48;
const ROW_DRAG_SCROLL_STEP = 14;

/**
 * Resolved width in px for each visible field, in view order.
 *
 * Header and body both read this, and both must: the only thing keeping a column's header
 * cell over its body cells is the two agreeing on the same number.
 */
export function columnWidths(fields: FieldDefinition[], view: ViewDefinition): number[] {
  const widths = view.columnWidths ?? {};
  return fields.map((f) => {
    const w = widths[f.id];
    return typeof w === 'number' && Number.isFinite(w) && w > 0
      ? Math.round(w)
      : DEFAULT_COLUMN_WIDTH;
  });
}

/**
 * SAD-79 fill mode: the prototype table is `width: 100%; table-layout: fixed`, so when its
 * columns are narrower than the shell every column — leading slots included — grows by the
 * same factor until the table fills it. Wider tables keep their widths and scroll.
 *
 * @param natural slot widths (checkbox, #, fields…) before scaling
 * @param available content-box width of the shell; 0 when unknown (jsdom, detached)
 * @returns displayed widths, floored to 0.01px so rounding never adds a scrollbar
 */
export function fillWidths(natural: number[], available: number): number[] {
  const gaps = COLUMN_GAP * (natural.length + 1);
  const sum = natural.reduce((a, b) => a + b, 0);
  if (!(available > 0) || sum <= 0 || available <= sum + gaps) return natural.slice();
  const scale = (available - gaps) / sum;
  return natural.map((w) => Math.floor(w * scale * 100) / 100);
}

export class GridView {
  root: HTMLElement;
  header: HTMLElement;
  viewport: HTMLElement;
  content: HTMLElement;
  /** SAD-79: Insert Row wrapper inside the shell; null when no onInsertRow was given. */
  insertWrap: HTMLElement | null = null;
  private pool: RowPool;
  private scrollTop = 0;
  private rowHeight: number;
  private totalRows: number;
  private fields: FieldDefinition[];
  private rows: Row[];
  private view: ViewDefinition;
  private selected: GridSelection | null = null;
  private sortState: { fieldId: string; direction: string }[] = [];
  /** Column geometry, recomputed by measure(). Header and body share it. */
  private widths: number[] = [];
  /** Sticky `left` of each field column when frozen. */
  private offsets: number[] = [];
  /** SAD-79: displayed widths and sticky lefts of every slot (checkbox, #, fields…). */
  private slotWidths: number[] = [];
  private slotLefts: number[] = [];
  private frozenColumns = 0;
  private totalWidth = 0;
  /** SAD-79: shell content width for fill mode; 0 until laid out. */
  private availableWidth = 0;
  /** SAD-79: live width while a resize handle is dragged (not yet committed). */
  private resizePreview: { fieldId: string; width: number } | null = null;
  private resizeObserver: ResizeObserver | null = null;
  /** SAD-80: selected row ids (UI state owned by the table view). */
  private rowSelection: ReadonlySet<string> = new Set();
  /** SAD-80: the row being dragged by its `#` cell, re-applied on every render. */
  private draggingRowId: string | null = null;
  private rowDropIndicator: HTMLElement | null = null;
  /** SAD-80: ends an in-progress row drag without committing (destroy, model swap). */
  private cancelRowDrag: (() => void) | null = null;
  /** SAD-81: group headers, or null for the flat grid. */
  private groups: GridGroup[] | null = null;
  /** SAD-81: virtual layout of the grouped grid (headers + rows), null when flat. */
  private layout: GroupedLayout | null = null;

  constructor(private opts: GridOptions) {
    this.fields = opts.fields;
    this.rows = opts.rows;
    this.view = opts.view;
    this.totalRows = opts.rows.length;
    this.rowHeight = rowHeightPx(opts.view.rowHeight);
    this.groups = opts.groups ?? null;
    this.layout = this.buildLayout();

    this.root = document.createElement('div');
    this.root.className = 'tablify tablify--grid';
    // P6-03 (a11y): grid semantics. Attribute-only; no behavior change.
    this.root.setAttribute('role', 'grid');
    this.root.setAttribute('aria-rowcount', String(this.ariaRowCount())); // +1 header row
    this.root.setAttribute('aria-colcount', String(this.fields.length + this.ariaColBase()));
    this.sortState = Array.isArray(opts.view.sort)
      ? opts.view.sort.map((s) => ({ fieldId: s.fieldId, direction: s.direction }))
      : [];
    this.applyRowHeightClass(opts.view.rowHeight);
    this.measure(opts.view);
    // touch scrolling without blocking page
    this.root.style.overflow = 'auto';
    this.root.style.webkitOverflowScrolling = 'touch' as unknown as string;
    // SAD-71 Step 1: no inline px size here. A px width/height captured at construction
    // froze the grid: after a pane resize the table covered part of the view and a fixed
    // 600px height left a black void under short tables (owner screenshot, v1.0.1).
    // Sizing is CSS-driven instead; the opts remain as the jsdom/measure fallback wherever
    // clientHeight is 0.
    this.root.style.position = 'relative';
    applyTheme(this.root, opts.theme);

    this.header = document.createElement('div');
    this.header.className = 'tablify__header';
    this.header.setAttribute('role', 'row');
    this.header.style.position = 'sticky';
    // SAD-79: `top` lives in styles.css — the header pins at the shell's padding edge
    // (top: -padding), so rows never show through the padding band above it.
    // Above frozen body cells (z-index 1). The header is a positioned element with a
    // z-index, so it is its own stacking context and its frozen cells rank inside it.
    this.header.style.zIndex = '3';
    this.header.style.display = 'flex';
    // SAD-79: the root scrolls both axes, so the header scrolls horizontally with the body
    // by itself. The SAD-69 C scrollLeft mirror (and the header's own `overflow: hidden`
    // scroll box) is gone; sticky frozen cells now share the root as their scroll reference.
    // SAD-69 D: no inline background — styles.css paints the opaque inner surface, which
    // keeps capsules scrolling underneath masked.
    this.root.appendChild(this.header);
    // Header buttons own their keys: Enter/Space on the name or ⋮ must press the button, not
    // start an edit on the selected cell through the grid's keydown handler.
    this.header.addEventListener('keydown', stopButtonKeys);

    this.viewport = document.createElement('div');
    this.viewport.className = 'tablify__viewport';
    this.viewport.setAttribute('role', 'presentation'); // keep grid → row ownership intact for assistive tech
    this.viewport.style.position = 'relative';
    this.viewport.style.height = `${this.bodyHeight()}px`;

    this.content = document.createElement('div');
    this.content.className = 'tablify__content';
    this.content.setAttribute('role', 'presentation'); // keep grid → row ownership intact for assistive tech
    this.content.style.position = 'absolute';
    this.content.style.top = '0';
    this.content.style.left = '0';
    this.content.style.right = '0';
    this.viewport.appendChild(this.content);
    this.root.appendChild(this.viewport);

    // SAD-80: one delegated listener each for the row checkboxes and the `#` drag handle —
    // rows are rebuilt as they scroll, so per-row listeners would be re-created every frame.
    this.content.addEventListener('change', (e) => {
      const box = e.target as HTMLInputElement | null;
      if (!box?.classList?.contains('tablify__row-check')) return;
      const rowId = (box.closest('.tablify__row') as HTMLElement | null)?.dataset.rowId;
      if (rowId) this.opts.onToggleRow?.(rowId, box.checked);
    });
    this.content.addEventListener('keydown', stopCheckboxKeys);
    this.header.addEventListener('keydown', stopCheckboxKeys);
    if (opts.onRowMove) {
      this.content.addEventListener('pointerdown', (e) => {
        const lead = (e.target as HTMLElement | null)?.closest?.('.tablify__lead--num') as HTMLElement | null;
        const rowId = (lead?.closest('.tablify__row') as HTMLElement | null)?.dataset.rowId;
        if (lead && rowId) this.startRowDrag(e, rowId);
      });
    }

    if (opts.onInsertRow) this.buildInsertRow(opts.onInsertRow);

    this.pool = new RowPool(() => {
      const el = document.createElement('div');
      el.className = 'tablify__row';
      el.style.display = 'flex';
      el.style.height = `${this.rowHeight}px`;
      // SAD-71 Step 4: no row separator — capsule gaps carry the vertical rhythm.
      return el;
    });

    // scroll handler
    this.root.addEventListener('scroll', () => {
      this.scrollTop = this.root.scrollTop;
      // A scroll that keeps the same rows in range needs no rebuild: the browser has already
      // moved them. Smooth scrolling fires several events per row, and rebuilding each time
      // was the bulk of the per-frame cost. Every other caller still forces render().
      if (this.renderedRange && this.rangeFor(this.scrollTop) === this.renderedRange) return;
      this.render();
    });

    // click-to-select (delegated); double-click opens the cell editor (SAD-96)
    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const cell = target?.closest?.('.tablify__cell') as HTMLElement | null;
      if (!cell) return;
      const rowEl = cell.parentElement as HTMLElement | null;
      const row = Number(rowEl?.dataset.rowIndex);
      const col = Number(cell.dataset.colIndex);
      if (Number.isNaN(row) || Number.isNaN(col)) return;
      const wasSelected = this.selected?.row === row && this.selected?.col === col;
      this.setSelection({ row, col });
      this.opts.onCellClick?.(row, col);
      if (wasSelected) this.opts.onCellReselect?.(row, col);
    });
    this.root.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement | null;
      const cell = target?.closest?.('.tablify__cell') as HTMLElement | null;
      if (!cell) return;
      const row = Number((cell.parentElement as HTMLElement).dataset.rowIndex);
      const col = Number(cell.dataset.colIndex);
      if (Number.isNaN(row) || Number.isNaN(col)) return;
      this.setSelection({ row, col });
      this.opts.onCellActivate?.(row, col);
    });

    // SAD-79 fill mode follows the shell's width. Obsidian also calls handleResize() on pane
    // resizes; the observer covers first layout and container changes it does not report.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.refreshGeometry());
      this.resizeObserver.observe(this.root);
    }

    this.renderHeader();
    this.render();
  }

  /**
   * Replace rows, fields, and view settings, then re-render. Scroll position is kept.
   * SAD-81: `groups` switches the grouped layout on (rows are then the grouped rows); omitted or
   * null keeps the flat grid.
   */
  setModel(rows: Row[], fields: FieldDefinition[], view: ViewDefinition, groups: GridGroup[] | null = null): void {
    this.rows = rows;
    this.fields = fields;
    this.view = view;
    this.totalRows = rows.length;
    this.rowHeight = rowHeightPx(view.rowHeight);
    this.groups = groups;
    this.layout = this.buildLayout();
    this.sortState = Array.isArray(view.sort)
      ? view.sort.map((s) => ({ fieldId: s.fieldId, direction: s.direction }))
      : [];
    this.applyRowHeightClass(view.rowHeight);
    this.readAvailableWidth();
    this.measure(view);
    this.root.setAttribute('aria-rowcount', String(this.ariaRowCount())); // keep counts in sync (P6-03)
    this.root.setAttribute('aria-colcount', String(this.fields.length + this.ariaColBase()));
    this.viewport.style.height = `${this.bodyHeight()}px`;
    if (this.selected && (this.selected.row >= rows.length || this.selected.col >= fields.length)) {
      this.selected = null;
    }
    this.renderHeader();
    this.render();
  }

  /**
   * SAD-80: the selected row ids. Updates the checkboxes in place — no re-render — so a
   * toggle never moves the scroll position or rebuilds rows under the pointer.
   */
  setRowSelection(selection: ReadonlySet<string>): void {
    this.rowSelection = selection;
    for (const rowEl of Array.from(this.content.children) as HTMLElement[]) {
      const box = rowEl.querySelector<HTMLInputElement>('.tablify__row-check');
      if (box && rowEl.dataset.rowId) box.checked = selection.has(rowEl.dataset.rowId);
    }
    this.syncSelectAll();
  }

  /** The header checkbox is checked when every row in view is selected (see selection.ts). */
  private syncSelectAll(): void {
    const box = this.header.querySelector<HTMLInputElement>('.tablify__select-all');
    if (!box) return;
    box.checked = this.rows.length > 0 && this.rows.every((r) => this.rowSelection.has(r.id));
  }

  /** SAD-80: with row checkboxes the checkbox slot is ARIA column 1 and fields start at 2. */
  private ariaColBase(): number {
    return this.opts.onToggleRow ? 1 : 0;
  }

  /** Current selection, or null. */
  getSelection(): GridSelection | null {
    return this.selected ? { ...this.selected } : null;
  }

  /** Select one body cell (no-op if out of range). Pass null to clear. */
  setSelection(sel: GridSelection | null): void {
    if (sel && (sel.row < 0 || sel.row >= this.totalRows || sel.col < 0 || sel.col >= this.fields.length)) return;
    this.selected = sel ? { ...sel } : null;
    this.render();
  }

  /** Scroll so that the given row is inside the viewport. */
  scrollToRow(rowIndex: number): void {
    const viewportH = this.root.clientHeight || this.opts.viewportHeight || 600;
    const top = this.layout ? this.layout.tops[this.layout.rowItem[rowIndex] ?? 0] ?? 0 : rowIndex * this.rowHeight;
    const bodyTop = this.header.offsetHeight;
    if (top < this.scrollTop) this.setScrollTop(top);
    else if (top + this.rowHeight > this.scrollTop + viewportH - bodyTop) {
      this.setScrollTop(top + this.rowHeight - (viewportH - bodyTop));
    }
  }

  /** Set scrollTop programmatically (for tests/benchmark) */
  setScrollTop(top: number): void {
    this.scrollTop = Math.max(0, top);
    this.root.scrollTop = this.scrollTop;
    this.render();
  }

  /** Update theme without rebuilding rows */
  setTheme(theme: 'light' | 'dark'): void {
    applyTheme(this.root, theme);
  }

  /**
   * Pane resize hook (SAD-71 Step 1). Sizing is CSS-driven, so a resize reflows the root
   * by itself; what needs redoing is the virtual-row math, which reads clientHeight, and
   * (SAD-79) the fill-mode column widths, which read clientWidth.
   */
  handleResize(): void {
    if (!this.refreshGeometry()) this.render();
  }

  /** Number of DOM row elements currently mounted (active) */
  getRenderedRowCount(): number {
    return this.content.children.length;
  }

  /** Pool size (active + recycled) — should stay bounded */
  getPoolSize(): number {
    return this.pool.size;
  }

  /** For tests: get visible range */
  getVisibleRange(viewportHeight: number = 600): { start: number; end: number } {
    return getVisibleRange(this.scrollTop, viewportHeight, this.rowHeight, this.totalRows, OVERSCAN);
  }

  /** Header labels in column order (for tests and accessibility checks). */
  getHeaderLabels(): string[] {
    return Array.from(this.header.querySelectorAll('.tablify__header-cell')).map((c) => c.textContent ?? '');
  }

  /** SAD-79: displayed width of every slot (checkbox, #, fields…) — for tests and harnesses. */
  getSlotWidths(): number[] {
    return this.slotWidths.slice();
  }

  // ---- geometry ----

  /** Viewport height: every row's pitch plus the table's closing 8px spacing. */
  private bodyHeight(): number {
    if (this.layout) return this.layout.tops[this.layout.items.length] + ROW_GAP;
    return totalHeight(this.totalRows, this.rowHeight) + ROW_GAP;
  }

  /** ARIA rows: the header, every data row and (SAD-81) every group header. */
  private ariaRowCount(): number {
    return (this.layout ? this.layout.items.length : this.totalRows) + 1;
  }

  /** SAD-81: lay out group headers and the rows of expanded groups, or null when flat. */
  private buildLayout(): GroupedLayout | null {
    if (!this.groups) return null;
    const items: GroupedItem[] = [];
    const tops: number[] = [];
    const rowItem: number[] = [];
    let y = 0;
    for (const group of this.groups) {
      tops.push(y);
      items.push({ kind: 'group', group });
      y += group.color ? GROUP_HEADER_CHIP_PX : GROUP_HEADER_TEXT_PX;
      if (group.collapsed) continue;
      for (let i = 0; i < group.count; i++) {
        const rowIdx = group.rowStart + i;
        if (rowIdx >= this.rows.length) break;
        rowItem[rowIdx] = items.length;
        tops.push(y);
        items.push({ kind: 'row', rowIdx, number: group.firstNumber + i });
        y += this.rowHeight;
      }
    }
    tops.push(y);
    return { items, tops, rowItem };
  }

  /** SAD-81: item window [start, end) for the grouped layout, with the usual overscan. */
  private groupedRange(layout: GroupedLayout, scrollTop: number, viewportH: number): { start: number; end: number } {
    const n = layout.items.length;
    if (n === 0 || viewportH <= 0) return { start: 0, end: 0 };
    // First item whose bottom edge is below scrollTop (binary search on the tops).
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (layout.tops[mid + 1] <= scrollTop) lo = mid + 1;
      else hi = mid;
    }
    let last = lo;
    while (last < n - 1 && layout.tops[last + 1] < scrollTop + viewportH) last++;
    return { start: Math.max(0, lo - OVERSCAN), end: Math.min(n, last + 1 + OVERSCAN) };
  }

  private applyRowHeightClass(rowHeight: string): void {
    const key = rowHeightKey(rowHeight);
    this.root.classList.remove('tablify--rh-small', 'tablify--rh-medium', 'tablify--rh-large');
    this.root.classList.add(`tablify--rh-${key}`);
  }

  /** Read the shell's content-box width. Returns true when it changed. */
  private readAvailableWidth(): boolean {
    let w = 0;
    const cw = this.root.clientWidth;
    if (cw > 0) {
      const cs = typeof getComputedStyle === 'function' ? getComputedStyle(this.root) : null;
      const pad = cs ? (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) : 0;
      w = Math.max(0, cw - pad);
    }
    if (Math.abs(w - this.availableWidth) < 0.5) return false;
    this.availableWidth = w;
    return true;
  }

  /** Re-measure after a size change. Returns true when it re-rendered. */
  private refreshGeometry(): boolean {
    if (!this.readAvailableWidth()) return false;
    this.measure(this.view);
    this.renderHeader();
    this.render();
    // SAD-100: a width change can flip the viewport freeze default (639px breakpoint).
    this.opts.onPaneWidthChange?.();
    return true;
  }

  /**
   * Recompute column geometry from the view. Called from the constructor and setModel(),
   * so a frozen-columns or column-width change takes effect on the next render.
   */
  private measure(view: ViewDefinition): void {
    const base = columnWidths(this.fields, view);
    const preview = this.resizePreview;
    if (preview) {
      const i = this.fields.findIndex((f) => f.id === preview.fieldId);
      if (i >= 0) base[i] = preview.width;
    }
    this.slotWidths = fillWidths([LEAD_CHECK_WIDTH, LEAD_NUM_WIDTH, ...base], this.availableWidth);
    // Sticky `left` of each slot = its distance from the first slot, so a frozen block pins
    // flush to the shell's padding edge — the prototype's syncFrozenOffsets().
    this.slotLefts = [];
    let x = 0;
    for (const w of this.slotWidths) {
      this.slotLefts.push(round2(x));
      x += w + COLUMN_GAP;
    }
    // Row box: leading spacing + slots + spacing between and after them.
    this.totalWidth = round2(COLUMN_GAP + x);
    this.widths = this.slotWidths.slice(LEAD_SLOTS);
    this.offsets = this.slotLefts.slice(LEAD_SLOTS);
    // SAD-100: render the *effective* freeze — the viewport default follows the live pane
    // width; an explicit (fixed) choice applies at every width. Clamp stays identical.
    this.frozenColumns = Math.max(
      0,
      Math.min(
        this.fields.length,
        Math.round(effectiveFrozenColumns(view, this.currentPaneWidth)),
      ),
    );
  }

  /**
   * SAD-100: the table-pane width the viewport freeze default measures — the live grid shell
   * width, falling back to the host-provided width before first layout (and in jsdom).
   */
  get currentPaneWidth(): number {
    return this.root.clientWidth > 0 ? this.root.clientWidth : (this.opts.viewportWidth ?? 800);
  }

  /**
   * Width, and the sticky pin when frozen, for one slot. Slot 0 is the checkbox, slot 1 the
   * `#`, slot 2+ the fields. With freeze on (SAD-79, S-5), the checkbox and `#` slots pin with
   * the first N fields, as in the prototype's frozen block.
   *
   * @param frozenZIndex stacking order for a frozen cell. Body cells pass '1', header cells
   *   '2' — the header is its own stacking context, so this only has to outrank the other
   *   header cells, while the header element itself outranks the whole body.
   */
  private placeSlot(el: HTMLElement, slot: number, frozenZIndex: string): void {
    // Fixed width rather than `flex: 1`: sticky frozen columns need a stable geometry, and
    // header and body have to agree on it.
    el.style.flex = '0 0 auto';
    el.style.boxSizing = 'border-box';
    el.style.width = `${this.slotWidths[slot] ?? DEFAULT_COLUMN_WIDTH}px`;
    const frozen = this.frozenColumns > 0 && slot < LEAD_SLOTS + this.frozenColumns;
    if (frozen) {
      el.classList.add(slot < LEAD_SLOTS ? 'tablify__lead--frozen' : 'tablify__cell--frozen');
      el.style.position = 'sticky';
      el.style.left = `${this.slotLefts[slot]}px`;
      el.style.zIndex = frozenZIndex;
    } else if (el.style.position) {
      // Only an element that was pinned before (restyleGeometry after un-freezing) needs
      // clearing; skipping the writes on fresh cells keeps the scroll render as cheap as it
      // was before SAD-79.
      el.classList.remove('tablify__lead--frozen', 'tablify__cell--frozen');
      el.style.position = '';
      el.style.left = '';
      el.style.zIndex = '';
    }
  }

  private styleCell(cell: HTMLElement, colIndex: number, frozenZIndex: string): void {
    cell.className = 'tablify__cell';
    // SAD-79: the cell is the prototype's `<td>` slot; the visible capsule is a child
    // (.tablify__capsule), so padding, radius and paint live in styles.css.
    this.placeSlot(cell, colIndex + LEAD_SLOTS, frozenZIndex);
  }

  /** Re-apply widths and pins in place (live resize preview keeps its DOM and pointer capture). */
  private restyleGeometry(): void {
    const apply = (container: HTMLElement, z: string): void => {
      container.style.width = `${this.totalWidth}px`;
      Array.from(container.children).forEach((el, i) => this.placeSlot(el as HTMLElement, i, z));
    };
    apply(this.header, '2');
    for (const rowEl of Array.from(this.content.children) as HTMLElement[]) apply(rowEl, '1');
  }

  // ---- header ----

  private rowGripTemplate: HTMLElement | null = null;

  /** The row-number grip, parsed once and cloned per row (the scroll render runs per frame). */
  private rowGrip(): HTMLElement {
    if (!this.rowGripTemplate) {
      const grip = document.createElement('span');
      grip.className = 'tablify__lead-grip';
      grip.innerHTML = faIcon('grip-vertical');
      this.rowGripTemplate = grip;
    }
    return this.rowGripTemplate;
  }

  private createLead(kind: 'check' | 'num', frozenZIndex: string, slot: number): HTMLElement {
    const el = document.createElement('div');
    el.className = `tablify__lead tablify__lead--${kind}`;
    // Visual row furniture: the grid's own row/column semantics stay on the field cells.
    el.setAttribute('aria-hidden', 'true');
    this.placeSlot(el, slot, frozenZIndex);
    return el;
  }

  private renderHeader(): void {
    this.header.innerHTML = '';
    // Span the columns; min-width keeps the header filling the grid when they are narrower
    // than the viewport, so its background never stops short of the body.
    this.header.style.minWidth = '100%';
    this.header.style.width = `${this.totalWidth}px`;
    // SAD-79: leading slots — checkbox and `#`. SAD-80: the checkbox selects the rows in view.
    const checkLead = this.createLead('check', '2', 0);
    if (this.opts.onToggleRow && this.opts.onToggleAllRows) {
      const onToggleAll = this.opts.onToggleAllRows;
      checkLead.removeAttribute('aria-hidden');
      checkLead.setAttribute('role', 'columnheader');
      checkLead.setAttribute('aria-colindex', '1');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.className = 'tablify__select-all';
      box.setAttribute('aria-label', 'Select all rows');
      box.checked = this.rows.length > 0 && this.rows.every((r) => this.rowSelection.has(r.id));
      box.addEventListener('change', () => onToggleAll(box.checked));
      checkLead.appendChild(box);
    }
    this.header.appendChild(checkLead);
    const hash = this.createLead('num', '2', 1);
    hash.textContent = '#';
    this.header.appendChild(hash);
    const primarySort = this.sortState[0];
    this.fields.forEach((field, colIndex) => {
      const cell = document.createElement('div');
      this.styleCell(cell, colIndex, '2');
      cell.classList.add('tablify__header-cell');
      cell.setAttribute('role', 'columnheader');
      cell.setAttribute('aria-colindex', String(colIndex + 1 + this.ariaColBase()));
      // The column's accessible name is the field name, not name + button labels.
      cell.setAttribute('aria-label', field.name);
      cell.setAttribute('data-field-type', field.type);
      // P6-03 (a11y): announce the primary sort column (attribute-only).
      if (primarySort && primarySort.fieldId === field.id) {
        cell.setAttribute('aria-sort', primarySort.direction === 'desc' ? 'descending' : 'ascending');
      } else {
        cell.removeAttribute('aria-sort');
      }
      cell.dataset.colIndex = String(colIndex);
      cell.setAttribute('data-field-id', field.id);
      cell.appendChild(this.buildHeaderCapsule(field, colIndex));
      if (this.opts.onColumnResize) cell.appendChild(this.buildResizeHandle(field, colIndex));
      this.header.appendChild(cell);
    });
  }

  /**
   * Prototype `headCellHtml` capsule. textContent stays exactly the field name (every
   * consumer and test reads it): glyphs are text-free SVGs, and the sort arrow and badge
   * type text are CSS `attr()` content.
   */
  private buildHeaderCapsule(field: FieldDefinition, colIndex: number): HTMLElement {
    const capsule = document.createElement('div');
    capsule.className = 'tablify__header-capsule';
    const main = document.createElement('div');
    main.className = 'tablify__hc-main';
    capsule.appendChild(main);

    if (this.opts.onColumnMove) {
      const grip = document.createElement('span');
      grip.className = 'tablify__hc-grip';
      grip.title = 'Drag to reorder';
      grip.setAttribute('aria-hidden', 'true');
      grip.innerHTML = faIcon('grip-vertical');
      grip.addEventListener('pointerdown', (e) => this.startColumnDrag(e, field.id));
      main.appendChild(grip);
    }
    if (field.primary) {
      const key = document.createElement('span');
      key.className = 'tablify__hc-key';
      key.title = 'Primary field';
      key.setAttribute('aria-hidden', 'true');
      key.innerHTML = faIcon('key');
      main.appendChild(key);
    }
    let name: HTMLElement;
    if (this.opts.onSortClick) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = 'Click: sort · Shift-click: add sort';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.opts.onSortClick?.(colIndex, e.shiftKey);
      });
      btn.className = 'tablify__hc-name';
      name = btn;
    } else {
      // Read-only grids (embeds): the name is text, never a button that does nothing.
      name = document.createElement('span');
      name.className = 'tablify__hc-name--static';
    }
    name.textContent = field.name;
    main.appendChild(name);

    const sortIdx = this.sortState.findIndex((s) => s.fieldId === field.id);
    if (sortIdx >= 0) {
      const sort = document.createElement('span');
      sort.className = 'tablify__hc-sort';
      sort.setAttribute('aria-hidden', 'true');
      const arrow = this.sortState[sortIdx].direction === 'desc' ? '▼' : '▲';
      sort.setAttribute('data-sort', arrow + (this.sortState.length > 1 ? String(sortIdx + 1) : ''));
      main.appendChild(sort);
    }

    const badge = document.createElement('span');
    badge.className = 'tablify__hc-badge';
    badge.title = typeLabel(field.type);
    badge.setAttribute('aria-hidden', 'true');
    badge.setAttribute('data-type', field.type);
    badge.innerHTML = faIcon(typeIcon(field.type));
    main.appendChild(badge);

    if (this.opts.onHeaderMenu) {
      const menu = document.createElement('button');
      menu.type = 'button';
      menu.className = 'tablify__hc-menu';
      // SAD-109: aria-label only (one tooltip).
      menu.setAttribute('aria-label', `Field menu: ${field.name}`);
      menu.innerHTML = faIcon('ellipsis-vertical');
      menu.addEventListener('click', (e) => {
        e.stopPropagation();
        const r = menu.getBoundingClientRect();
        this.opts.onHeaderMenu?.(colIndex, { x: r.left, y: r.bottom });
      });
      capsule.appendChild(menu);
    }
    return capsule;
  }

  private buildResizeHandle(field: FieldDefinition, colIndex: number): HTMLElement {
    const handle = document.createElement('div');
    handle.className = 'tablify__hc-resize';
    handle.title = 'Drag to resize';
    handle.setAttribute('aria-hidden', 'true');
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = this.widths[colIndex] ?? DEFAULT_COLUMN_WIDTH;
      let current: number | null = null;
      capturePointer(handle, e.pointerId);
      this.root.classList.add('tablify--col-resizing');
      const move = (ev: PointerEvent): void => {
        current = clampWidth(startW + (ev.clientX - startX));
        this.resizePreview = { fieldId: field.id, width: current };
        this.measure(this.view);
        this.restyleGeometry();
      };
      const end = (ev: PointerEvent): void => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        this.root.classList.remove('tablify--col-resizing');
        this.resizePreview = null;
        if (current !== null && ev.type === 'pointerup') {
          this.opts.onColumnResize?.(field.id, Math.round(current));
        } else {
          this.measure(this.view);
          this.restyleGeometry();
        }
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
    // A press on the handle is never a sort click.
    handle.addEventListener('click', (e) => e.stopPropagation());
    return handle;
  }

  /** Header-grip drag (prototype colDragStart/colDrop), pointer-based so it also works on touch. */
  private startColumnDrag(e: PointerEvent, fieldId: string): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const grip = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let target: HTMLElement | null = null;
    capturePointer(grip, e.pointerId);
    const source = grip.closest('.tablify__header-cell') as HTMLElement | null;
    const setTarget = (next: HTMLElement | null): void => {
      if (next === target) return;
      target?.classList.remove('tablify__header-cell--drop-target');
      target = next;
      target?.classList.add('tablify__header-cell--drop-target');
    };
    const move = (ev: PointerEvent): void => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        source?.classList.add('tablify__header-cell--dragging');
        this.root.classList.add('tablify--col-dragging');
      }
      const doc = this.root.ownerDocument;
      const hit = typeof doc.elementFromPoint === 'function' ? doc.elementFromPoint(ev.clientX, ev.clientY) : null;
      const cell = hit?.closest?.('.tablify__header-cell') as HTMLElement | null;
      setTarget(cell && this.header.contains(cell) && cell !== source ? cell : null);
    };
    const end = (ev: PointerEvent): void => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', end);
      grip.removeEventListener('pointercancel', end);
      source?.classList.remove('tablify__header-cell--dragging');
      this.root.classList.remove('tablify--col-dragging');
      const targetId = target?.getAttribute('data-field-id') ?? null;
      setTarget(null);
      if (dragging && ev.type === 'pointerup' && targetId && targetId !== fieldId) {
        this.opts.onColumnMove?.(fieldId, targetId);
      }
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }

  // ---- row drag (SAD-80) ----

  /**
   * `#`-cell row drag (prototype `rowDragStart` / `rowDragMove` / `rowDragEnd`). Pointer
   * events, so mouse, pen and touch all work. Listeners sit on the document, as in the
   * prototype: the row under the pointer can be recycled by virtual scrolling mid-drag.
   * The press is not prevented, so focus still leaves an open cell editor and commits it.
   */
  private startRowDrag(e: PointerEvent, rowId: string): void {
    if (e.button !== undefined && e.button !== 0) return; // primary button / touch only
    this.cancelRowDrag?.();
    const doc = this.root.ownerDocument;
    const win = doc.defaultView;
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
    // undefined = no drop slot yet; null = after the last row.
    let before: string | null | undefined;

    const blockMenu = (ev: Event): void => {
      // A touch long-press on the handle must not pop the row menu mid-drag (prototype).
      ev.preventDefault();
      ev.stopPropagation();
    };
    const cleanup = (): void => {
      doc.removeEventListener('pointermove', move);
      doc.removeEventListener('pointerup', up);
      doc.removeEventListener('pointercancel', cleanup);
      win?.removeEventListener('blur', cleanup);
      this.root.removeEventListener('contextmenu', blockMenu, true);
      this.root.classList.remove('tablify--row-dragging');
      if (this.rowDropIndicator) this.rowDropIndicator.style.display = 'none';
      this.draggingRowId = null;
      this.content.querySelectorAll('.tablify__row--dragging').forEach((el) => el.classList.remove('tablify__row--dragging'));
      this.cancelRowDrag = null;
    };
    const move = (ev: PointerEvent): void => {
      if (!active) {
        if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < ROW_DRAG_THRESHOLD_PX) return;
        const reason = this.opts.rowMoveBlocked?.() ?? null;
        if (reason) {
          cleanup();
          this.opts.onRowMoveBlocked?.(reason);
          return;
        }
        active = true;
        this.draggingRowId = rowId;
        this.root.classList.add('tablify--row-dragging');
        this.content.querySelector(`.tablify__row[data-row-id="${cssEscape(rowId)}"]`)?.classList.add('tablify__row--dragging');
        // SAD-97: the menu blocker is armed only once this is really a drag, and only on the
        // grid — an inert press on the handle must not swallow context menus (inside or out),
        // and a lost pointerup can never block the rest of Obsidian. `blur` guarantees
        // teardown when the release event is never delivered.
        this.root.addEventListener('contextmenu', blockMenu, true);
      }
      if (ev.cancelable) ev.preventDefault();
      before = this.dropSlotAt(ev.clientY);
      this.autoScrollRowDrag(ev.clientY);
    };
    const up = (): void => {
      const commit = active && before !== undefined;
      const target = before;
      cleanup();
      if (commit && target !== undefined) this.opts.onRowMove?.(rowId, target);
    };
    doc.addEventListener('pointermove', move);
    doc.addEventListener('pointerup', up);
    doc.addEventListener('pointercancel', cleanup);
    win?.addEventListener('blur', cleanup);
    this.cancelRowDrag = cleanup;
  }

  /**
   * The insertion point under the pointer: the first rendered row whose midpoint is below it
   * (prototype), and the drop line drawn in the gap above that row — or under the last row.
   */
  private dropSlotAt(clientY: number): string | null {
    const rowsEls = (Array.from(this.content.children) as HTMLElement[]).filter((el) => el.dataset.rowId);
    let beforeEl: HTMLElement | null = null;
    for (const el of rowsEls) {
      const r = el.getBoundingClientRect();
      // The row element starts with the 8px row gap; the capsule slot (the prototype's <tr>)
      // is the part below it.
      const slotTop = r.top + ROW_GAP;
      if (clientY < slotTop + (r.bottom - slotTop) / 2) {
        beforeEl = el;
        break;
      }
    }
    let before: string | null;
    if (beforeEl) {
      before = beforeEl.dataset.rowId ?? null;
    } else {
      // Below every rendered row: the row after the rendered window, or the end of the table.
      const last = rowsEls[rowsEls.length - 1];
      const lastIdx = last ? Number(last.dataset.rowIndex) : -1;
      before = this.rows[lastIdx + 1]?.id ?? null;
    }
    const ind = this.ensureRowDropIndicator();
    // The line lives in the (position: relative) viewport, so it scrolls with the rows.
    const vpRect = this.viewport.getBoundingClientRect();
    const rootRect = this.root.getBoundingClientRect();
    let y: number;
    // Prototype: 5px above the target row's <tr>, or 2px under the last one.
    if (beforeEl) y = beforeEl.getBoundingClientRect().top + ROW_GAP - 5;
    else if (rowsEls.length) y = rowsEls[rowsEls.length - 1].getBoundingClientRect().bottom + 2;
    else y = vpRect.top;
    ind.style.top = `${y - vpRect.top}px`;
    // Prototype: left/right 10px inside the scroll container. Measured from the visible box,
    // so the line stays in view when the grid is scrolled sideways (same result at scroll 0).
    ind.style.left = `${rootRect.left + this.root.clientLeft + ROW_DROP_INSET_PX - vpRect.left}px`;
    ind.style.width = `${Math.max(0, this.root.clientWidth - 2 * ROW_DROP_INSET_PX)}px`;
    ind.style.display = 'block';
    return before;
  }

  private ensureRowDropIndicator(): HTMLElement {
    if (!this.rowDropIndicator) {
      const ind = document.createElement('div');
      ind.className = 'tablify__row-drop';
      ind.setAttribute('aria-hidden', 'true');
      this.viewport.appendChild(ind);
      this.rowDropIndicator = ind;
    }
    return this.rowDropIndicator;
  }

  /** Edge auto-scroll so a long table can be crossed mid-drag (prototype: window edges). */
  private autoScrollRowDrag(clientY: number): void {
    const r = this.root.getBoundingClientRect();
    const top = r.top + this.header.offsetHeight;
    if (clientY < top + ROW_DRAG_EDGE_PX && this.root.scrollTop > 0) {
      this.root.scrollTop = Math.max(0, this.root.scrollTop - ROW_DRAG_SCROLL_STEP);
    } else if (clientY > r.bottom - ROW_DRAG_EDGE_PX) {
      this.root.scrollTop += ROW_DRAG_SCROLL_STEP;
    }
  }

  // ---- insert row ----

  private buildInsertRow(onInsert: () => void): void {
    const wrap = document.createElement('div');
    wrap.className = 'tablify__insert-wrap';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tablify__insert-row';
    btn.dataset.testid = 'tablify-insert-row';
    btn.innerHTML = `<span class="tablify__insert-row-icon">${faIcon('plus')}</span>`;
    const label = document.createElement('span');
    label.textContent = 'Insert Row';
    btn.appendChild(label);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onInsert();
    });
    wrap.addEventListener('keydown', stopButtonKeys);
    wrap.appendChild(btn);
    this.root.appendChild(wrap);
    this.insertWrap = wrap;
  }

  // ---- body ----

  /** Rows rendered by the last render(), as a comparable key (see the scroll listener). */
  private renderedRange: string | null = null;

  private rangeFor(scrollTop: number): string {
    const viewportH = this.root.clientHeight || this.opts.viewportHeight || 600;
    if (this.layout) {
      const g = this.groupedRange(this.layout, scrollTop, viewportH);
      return `g${g.start}:${g.end}:${this.rowHeight}:${this.layout.items.length}`;
    }
    const { start, end } = getVisibleRange(scrollTop, viewportH, this.rowHeight, this.totalRows, OVERSCAN);
    return `${start}:${end}:${this.rowHeight}:${this.totalRows}`;
  }

  private render(): void {
    if (this.layout) {
      this.renderGrouped(this.layout);
      return;
    }
    const viewportH = this.root.clientHeight || this.opts.viewportHeight || 600;
    const { start, end } = getVisibleRange(this.scrollTop, viewportH, this.rowHeight, this.totalRows, OVERSCAN);
    this.renderedRange = `${start}:${end}:${this.rowHeight}:${this.totalRows}`;
    const rows = this.pool.update(start, end);
    // Clear content and re-append in order
    this.content.innerHTML = '';
    // Position content via top offset
    this.content.style.transform = `translateY(${start * this.rowHeight}px)`;
    for (let i = 0; i < rows.length; i++) {
      const rowEl = rows[i];
      const rowIdx = start + i;
      this.fillRow(rowEl, rowIdx, rowIdx + 1, rowIdx + 2);
      this.content.appendChild(rowEl);
    }
  }

  /**
   * SAD-81: grouped render — the same pooled data rows, interleaved with group headers. Data
   * rows keep contiguous `data-row-index` values (indices into the grouped rows), so selection,
   * editors and menus address them exactly as in the flat grid.
   */
  private renderGrouped(layout: GroupedLayout): void {
    const viewportH = this.root.clientHeight || this.opts.viewportHeight || 600;
    const { start, end } = this.groupedRange(layout, this.scrollTop, viewportH);
    this.renderedRange = `g${start}:${end}:${this.rowHeight}:${layout.items.length}`;
    let rStart = -1;
    let rEnd = -1;
    for (let i = start; i < end; i++) {
      const item = layout.items[i];
      if (item.kind !== 'row') continue;
      if (rStart < 0) rStart = item.rowIdx;
      rEnd = item.rowIdx + 1;
    }
    const pooled = rStart < 0 ? this.pool.update(0, 0) : this.pool.update(rStart, rEnd);
    this.content.innerHTML = '';
    this.content.style.transform = `translateY(${layout.tops[start] ?? 0}px)`;
    let next = 0;
    for (let i = start; i < end; i++) {
      const item = layout.items[i];
      if (item.kind === 'group') {
        this.content.appendChild(this.buildGroupHeader(item.group, i + 2));
        continue;
      }
      const rowEl = pooled[next++];
      if (!rowEl) continue;
      this.fillRow(rowEl, item.rowIdx, item.number, i + 2);
      this.content.appendChild(rowEl);
    }
  }

  /**
   * SAD-81: prototype group header row — chevron, label (an option chip for selects) and the
   * mono row count, in a button that collapses or expands the group.
   */
  private buildGroupHeader(group: GridGroup, ariaRowIndex: number): HTMLElement {
    const el = document.createElement('div');
    el.className = 'tablify__group-row';
    el.setAttribute('role', 'row');
    el.setAttribute('aria-rowindex', String(ariaRowIndex));
    el.dataset.groupKey = group.key;
    el.style.height = `${group.color ? GROUP_HEADER_CHIP_PX : GROUP_HEADER_TEXT_PX}px`;
    el.style.minWidth = '100%';
    el.style.width = `${this.totalWidth}px`;
    const cell = document.createElement('div');
    cell.className = 'tablify__group-cell';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-colindex', '1');
    cell.setAttribute('aria-colspan', String(this.fields.length + this.ariaColBase()));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tablify__group-toggle';
    btn.setAttribute('aria-expanded', String(!group.collapsed));
    const chevron = document.createElement('span');
    chevron.className = 'tablify__group-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = faIcon(group.collapsed ? 'chevron-right' : 'chevron-down');
    btn.appendChild(chevron);
    if (group.color) {
      const colors = optionChipColors(group.color, this.root.classList.contains('tablify--dark') ? 'dark' : 'light');
      const chip = document.createElement('span');
      chip.className = 'tablify__group-chip';
      chip.style.background = colors.background;
      chip.style.borderColor = colors.border;
      chip.style.color = colors.text;
      const dot = document.createElement('span');
      dot.className = 'tablify__group-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.background = colors.dot;
      chip.appendChild(dot);
      chip.appendChild(document.createTextNode(group.label));
      btn.appendChild(chip);
    } else {
      const label = document.createElement('span');
      label.className = 'tablify__group-label';
      label.textContent = group.label;
      btn.appendChild(label);
    }
    const count = document.createElement('span');
    count.className = 'tablify__group-count';
    count.textContent = String(group.count);
    btn.appendChild(count);
    btn.title = group.collapsed ? 'Expand group' : 'Collapse group';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.opts.onToggleGroup?.(group.key);
    });
    // Enter/Space press the button; they must not reach the grid's editor shortcut.
    btn.addEventListener('keydown', stopButtonKeys);
    cell.appendChild(btn);
    el.appendChild(cell);
    return el;
  }

  /**
   * Fill one pooled row element. `number` is the row's displayed number (`#`, labels) and
   * `ariaRowIndex` its ARIA row; in the flat grid they are rowIdx + 1 and rowIdx + 2.
   */
  private fillRow(rowEl: HTMLElement, rowIdx: number, number: number, ariaRowIndex: number): void {
    {
      rowEl.dataset.rowIndex = String(rowIdx);
      rowEl.setAttribute('role', 'row');
      // The pool reuses row elements, so the height has to be reapplied on every render.
      // Setting it only at creation meant the Options menu's row-height control did nothing
      // to rows that were already on screen (SAD-69).
      rowEl.style.height = `${this.rowHeight}px`;
      // Span the columns, so the row covers the full scrollable width and not just the
      // visible part. min-width keeps short tables filling the viewport.
      rowEl.style.minWidth = '100%';
      rowEl.style.width = `${this.totalWidth}px`;
      // P6-03 (a11y): 1-based row index; the header is row 1 (attribute-only).
      rowEl.setAttribute('aria-rowindex', String(ariaRowIndex));
      // Render cells for all fields (no column virtualization)
      // Clear previous cells
      rowEl.innerHTML = '';
      const row = this.rows[rowIdx];
      if (!row) delete rowEl.dataset.rowId;
      if (row) {
        // stripe
        if (rowIdx % 2 === 1) rowEl.classList.add('tablify__row--stripe');
        else rowEl.classList.remove('tablify__row--stripe');
        rowEl.dataset.rowId = row.id;
        rowEl.classList.toggle('tablify__row--dragging', row.id === this.draggingRowId);
        // SAD-79: leading slots — checkbox and the row number. SAD-80: the checkbox selects
        // the row (one delegated change listener on the content, see the constructor).
        const checkLead = this.createLead('check', '1', 0);
        if (this.opts.onToggleRow) {
          checkLead.removeAttribute('aria-hidden');
          checkLead.setAttribute('role', 'gridcell');
          checkLead.setAttribute('aria-colindex', '1');
          const box = document.createElement('input');
          box.type = 'checkbox';
          box.className = 'tablify__row-check';
          box.checked = this.rowSelection.has(row.id);
          box.setAttribute('aria-label', `Select row ${number}`);
          checkLead.appendChild(box);
        }
        rowEl.appendChild(checkLead);
        const num = this.createLead('num', '1', 1);
        if (this.opts.onRowMove) {
          num.classList.add('tablify__lead--drag');
          num.title = 'Drag to reorder row';
        }
        num.appendChild(this.rowGrip().cloneNode(true));
        num.appendChild(document.createTextNode(String(number)));
        rowEl.appendChild(num);
        this.fields.forEach((field, colIndex) => {
          const cell = document.createElement('div');
          this.styleCell(cell, colIndex, '1');
          const capsule = document.createElement('div');
          capsule.className = 'tablify__capsule';
          const val = row.values[field.id];
          // P8-03: a formula error shows its code, with the reason in the tooltip.
          const formulaErr = field.type === 'formula' && this.opts.formulaError ? this.opts.formulaError(row.id, field.id) : null;
          // SAD-71 Step 4: the value lives in a span so the capsule can be a flex box with
          // a real ellipsis; cell.textContent is unchanged for every consumer.
          const text = document.createElement('span');
          text.className = 'tablify__cell-text';
          if (formulaErr) {
            text.textContent = formulaErr.code;
            cell.classList.add('tablify__cell--error');
            cell.title = formulaErr.message;
            cell.setAttribute('data-formula-error', formulaErr.code);
          } else if (field.type === 'link') {
            // P8-04: resolved row names. A broken link is marked, never removed from the cell.
            const summary = this.opts.linkSummary
              ? this.opts.linkSummary(val)
              : { text: getFieldType('link').format(val ?? null, field), broken: 0 };
            if (summary.chips && summary.chips.length > 0) {
              // One chip per link. A broken link keeps its chip, dashed and muted.
              for (const chip of summary.chips) {
                text.createSpan({
                  cls: chip.broken ? 'tablify-link-chip tablify-link-chip--broken' : 'tablify-link-chip',
                  text: chip.label,
                });
              }
            } else {
              text.textContent = summary.text;
            }
            if (summary.broken > 0) {
              cell.classList.add('tablify__cell--broken-link');
              cell.title = `${summary.broken} broken ${summary.broken === 1 ? 'link' : 'links'}: the linked row or table was not found.`;
              cell.setAttribute('data-broken-links', String(summary.broken));
            }
          } else {
            text.textContent = val === undefined || val === null ? '' : String(Array.isArray(val) ? val.join(', ') : val);
          }
          // An empty value shows the prototype's em dash through CSS (:empty::before), so
          // textContent stays '' for every consumer.
          capsule.appendChild(text);
          cell.appendChild(capsule);
          cell.setAttribute('data-field-id', field.id);
          cell.dataset.colIndex = String(colIndex);
          cell.setAttribute('role', 'gridcell');
          cell.setAttribute('aria-colindex', String(colIndex + 1 + this.ariaColBase()));
          // P6-03 (a11y): give screen readers a stable name for each cell
          // ("RowIndex, ColumnName, value") without changing any behavior.
          cell.setAttribute('aria-description', `Row ${number}, column ${field.name}`);
          if (this.selected && this.selected.row === rowIdx && this.selected.col === colIndex) {
            cell.classList.add('tablify__cell--selected');
            cell.setAttribute('aria-selected', 'true');
            // SAD-69 D: a plugin token, never `var(--interactive-accent)`. SAD-79: drawn on
            // the capsule (prototype `.cell-focus`: 2px, offset -1px), not the slot.
            capsule.style.outline = '2px solid var(--tablify-selection)';
            capsule.style.outlineOffset = '-1px';
          }
          rowEl.appendChild(cell);
        });
      }
    }
  }

  destroy(): void {
    this.cancelRowDrag?.();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.root.remove();
    this.pool.clear();
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampWidth(w: number): number {
  return Math.max(RESIZE_MIN_WIDTH, Math.min(RESIZE_MAX_WIDTH, w));
}

function capturePointer(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture?.(pointerId);
  } catch {
    // Synthetic events (tests) have no active pointer to capture.
  }
}

/** Keep Enter/Space/arrows on a focused button from reaching the grid's keyboard handler. */
/**
 * SAD-80: Space toggles a focused row checkbox natively and Enter must not open the cell
 * editor through the grid's keydown handler. Other keys (undo, arrows) still reach the grid.
 */
function stopCheckboxKeys(e: KeyboardEvent): void {
  const t = e.target as HTMLInputElement | null;
  if (t && t.tagName === 'INPUT' && t.type === 'checkbox' && (e.key === 'Enter' || e.key === ' ')) {
    e.stopPropagation();
  }
}

/** CSS.escape where available (row ids are generated, but stay safe in a selector). */
function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}

function stopButtonKeys(e: KeyboardEvent): void {
  const t = e.target as HTMLElement | null;
  if (t && t.tagName === 'BUTTON') e.stopPropagation();
}
