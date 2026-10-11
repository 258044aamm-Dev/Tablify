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
import { applyTheme } from '../../ui/theme/tokens.js';
import { faIcon } from '../../ui/faIcons.js';
import { typeIcon, typeLabel } from './fieldTypeBadge.js';
import type { Row, FieldDefinition, CellValue } from '../../model/types.js';
import type { ViewDefinition } from '../../model/types.js';
import { getFieldType } from '../../model/fieldTypes/registry.js';

export interface GridOptions {
  rows: Row[];
  fields: FieldDefinition[];
  view: ViewDefinition;
  theme: 'light' | 'dark';
  viewportHeight?: number; // default 600
  viewportWidth?: number; // default 800, for column measurement
  /** Called when a body cell is clicked. Indexes refer to the current rows and fields. */
  onCellClick?: (rowIndex: number, colIndex: number) => void;
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

  constructor(private opts: GridOptions) {
    this.fields = opts.fields;
    this.rows = opts.rows;
    this.view = opts.view;
    this.totalRows = opts.rows.length;
    this.rowHeight = rowHeightPx(opts.view.rowHeight);

    this.root = document.createElement('div');
    this.root.className = 'tablify tablify--grid';
    // P6-03 (a11y): grid semantics. Attribute-only; no behavior change.
    this.root.setAttribute('role', 'grid');
    this.root.setAttribute('aria-rowcount', String(this.totalRows + 1)); // +1 header row
    this.root.setAttribute('aria-colcount', String(this.fields.length));
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

    // click-to-select (delegated)
    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const cell = target?.closest?.('.tablify__cell') as HTMLElement | null;
      if (!cell) return;
      const rowEl = cell.parentElement as HTMLElement | null;
      const row = Number(rowEl?.dataset.rowIndex);
      const col = Number(cell.dataset.colIndex);
      if (Number.isNaN(row) || Number.isNaN(col)) return;
      this.setSelection({ row, col });
      this.opts.onCellClick?.(row, col);
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

  /** Replace rows, fields, and view settings, then re-render. Scroll position is kept. */
  setModel(rows: Row[], fields: FieldDefinition[], view: ViewDefinition): void {
    this.rows = rows;
    this.fields = fields;
    this.view = view;
    this.totalRows = rows.length;
    this.rowHeight = rowHeightPx(view.rowHeight);
    this.sortState = Array.isArray(view.sort)
      ? view.sort.map((s) => ({ fieldId: s.fieldId, direction: s.direction }))
      : [];
    this.applyRowHeightClass(view.rowHeight);
    this.readAvailableWidth();
    this.measure(view);
    this.root.setAttribute('aria-rowcount', String(this.totalRows + 1)); // keep counts in sync (P6-03)
    this.root.setAttribute('aria-colcount', String(this.fields.length));
    this.viewport.style.height = `${this.bodyHeight()}px`;
    if (this.selected && (this.selected.row >= rows.length || this.selected.col >= fields.length)) {
      this.selected = null;
    }
    this.renderHeader();
    this.render();
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
    const top = rowIndex * this.rowHeight;
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
    return totalHeight(this.totalRows, this.rowHeight) + ROW_GAP;
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
    this.frozenColumns = Math.max(
      0,
      Math.min(this.fields.length, Math.round(view.frozenColumns ?? 0)),
    );
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
    // SAD-79: leading slots — checkbox (row selection arrives with SAD-80) and `#`.
    this.header.appendChild(this.createLead('check', '2', 0));
    const hash = this.createLead('num', '2', 1);
    hash.textContent = '#';
    this.header.appendChild(hash);
    const primarySort = this.sortState[0];
    this.fields.forEach((field, colIndex) => {
      const cell = document.createElement('div');
      this.styleCell(cell, colIndex, '2');
      cell.classList.add('tablify__header-cell');
      cell.setAttribute('role', 'columnheader');
      cell.setAttribute('aria-colindex', String(colIndex + 1));
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
      menu.title = 'Field menu';
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
    const { start, end } = getVisibleRange(scrollTop, viewportH, this.rowHeight, this.totalRows, OVERSCAN);
    return `${start}:${end}:${this.rowHeight}:${this.totalRows}`;
  }

  private render(): void {
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
      rowEl.setAttribute('aria-rowindex', String(rowIdx + 2));
      // Render cells for all fields (no column virtualization)
      // Clear previous cells
      rowEl.innerHTML = '';
      const row = this.rows[rowIdx];
      if (row) {
        // stripe
        if (rowIdx % 2 === 1) rowEl.classList.add('tablify__row--stripe');
        else rowEl.classList.remove('tablify__row--stripe');
        // SAD-79: leading slots — checkbox (SAD-80 adds the control) and the row number.
        rowEl.appendChild(this.createLead('check', '1', 0));
        const num = this.createLead('num', '1', 1);
        num.appendChild(this.rowGrip().cloneNode(true));
        num.appendChild(document.createTextNode(String(rowIdx + 1)));
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
          cell.setAttribute('aria-colindex', String(colIndex + 1));
          // P6-03 (a11y): give screen readers a stable name for each cell
          // ("RowIndex, ColumnName, value") without changing any behavior.
          cell.setAttribute('aria-description', `Row ${rowIdx + 1}, column ${field.name}`);
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
      this.content.appendChild(rowEl);
    }
  }

  destroy(): void {
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
function stopButtonKeys(e: KeyboardEvent): void {
  const t = e.target as HTMLElement | null;
  if (t && t.tagName === 'BUTTON') e.stopPropagation();
}
