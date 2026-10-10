/**
 * Grid view with virtual rows.
 * Renders only visible rows + overscan, recycles row elements, supports touch scrolling.
 * Column virtualization is NOT implemented; all visible columns are rendered per row (horizontal scroll via overflow-x).
 * Row height comes from ViewDefinition.rowHeight via src/model/view.ts (small/medium/large).
 * Column widths and frozen columns come from the view too (SAD-69 C).
 * Theme is applied via src/ui/theme/tokens.ts applyTheme on the root.
 *
 * P5-00: adds a sticky header, a single selected cell, click-to-select, and setModel() so the
 * table view can swap rows/fields after each undoable change. Fields passed in are already
 * in view order and exclude hidden columns (see src/model/viewOrder.ts).
 */

import { getVisibleRange, rowHeightPx, totalHeight, OVERSCAN } from './virtual.js';
import { RowPool } from './rowPool.js';
import { applyTheme } from '../../ui/theme/tokens.js';
import type { Row, FieldDefinition } from '../../model/types.js';
import type { ViewDefinition } from '../../model/types.js';

export interface GridOptions {
  rows: Row[];
  fields: FieldDefinition[];
  view: ViewDefinition;
  theme: 'light' | 'dark';
  viewportHeight?: number; // default 600
  viewportWidth?: number; // default 800, for column measurement
  /** Called when a body cell is clicked. Indexes refer to the current rows and fields. */
  onCellClick?: (rowIndex: number, colIndex: number) => void;
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

export class GridView {
  root: HTMLElement;
  header: HTMLElement;
  viewport: HTMLElement;
  content: HTMLElement;
  private pool: RowPool;
  private scrollTop = 0;
  private rowHeight: number;
  private totalRows: number;
  private fields: FieldDefinition[];
  private rows: Row[];
  private selected: GridSelection | null = null;
  private sortState: { fieldId: string; direction: string }[] = [];
  /** Column geometry, recomputed by measure(). Header and body share it. */
  private widths: number[] = [];
  private offsets: number[] = [];
  private frozenColumns = 0;
  private totalWidth = 0;

  constructor(private opts: GridOptions) {
    this.fields = opts.fields;
    this.rows = opts.rows;
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
    this.measure(opts.view);
    // touch scrolling without blocking page
    this.root.style.overflow = 'auto';
    this.root.style.webkitOverflowScrolling = 'touch' as unknown as string;
    // SAD-71 Step 1: no inline px size here. A px width/height captured at construction
    // froze the grid: after a pane resize the table covered part of the view and a fixed
    // 600px height left a black void under short tables (owner screenshot, v1.0.1).
    // Sizing is CSS-driven instead (.tablify--grid fills .tablify__body); the opts remain
    // as the jsdom/measure fallback wherever clientHeight is 0.
    this.root.style.position = 'relative';
    applyTheme(this.root, opts.theme);

    this.header = document.createElement('div');
    this.header.className = 'tablify__header';
    this.header.setAttribute('role', 'row');
    this.header.style.position = 'sticky';
    this.header.style.top = '0';
    // Above frozen body cells (z-index 1). The header is a positioned element with a
    // z-index, so it is its own stacking context and its frozen cells rank inside it.
    this.header.style.zIndex = '3';
    this.header.style.display = 'flex';
    // SAD-69 C: the header has to be its own scroll container, or the horizontal scroll
    // below has nothing to set scrollLeft on and the columns drift out of alignment.
    // `hidden` rather than `auto` so no second scrollbar appears.
    this.header.style.overflow = 'hidden';
    // SAD-69 D: no inline background here. An inline value used to be
    // `var(--background-primary)`, an Obsidian variable, which overrode the plugin token
    // in styles.css (.tablify__header { background: var(--tablify-bg-subtle) }) and made the
    // header follow the host Obsidian theme instead of the Tablify theme. That broke P3-09.
    // The opaque background now comes from styles.css, which also keeps sticky rows hidden.
    // SAD-71 Step 4: no inline bottom separator either — header capsules float on the
    // shell, and styles.css paints the header with the inner surface so capsules
    // scrolling underneath stay masked.
    this.root.appendChild(this.header);

    this.viewport = document.createElement('div');
    this.viewport.className = 'tablify__viewport';
    this.viewport.setAttribute('role', 'presentation'); // keep grid → row ownership intact for assistive tech
    this.viewport.style.position = 'relative';
    this.viewport.style.height = `${totalHeight(this.totalRows, this.rowHeight)}px`;
    this.viewport.style.overflowX = 'auto';

    this.content = document.createElement('div');
    this.content.className = 'tablify__content';
    this.content.setAttribute('role', 'presentation'); // keep grid → row ownership intact for assistive tech
    this.content.style.position = 'absolute';
    this.content.style.top = '0';
    this.content.style.left = '0';
    this.content.style.right = '0';
    this.viewport.appendChild(this.content);
    this.root.appendChild(this.viewport);

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
      this.render();
    });

    // SAD-69 C: horizontal scroll lives on the viewport, but the header is its sibling, so
    // the two scroll independently and the header separates from its columns. Mirror the
    // offset onto the header. Frozen cells are sticky, so they stay put inside both.
    this.viewport.addEventListener('scroll', () => {
      this.header.scrollLeft = this.viewport.scrollLeft;
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

    this.renderHeader();
    this.render();
  }

  /** Replace rows, fields, and view settings, then re-render. Scroll position is kept. */
  setModel(rows: Row[], fields: FieldDefinition[], view: ViewDefinition): void {
    this.rows = rows;
    this.fields = fields;
    this.totalRows = rows.length;
    this.rowHeight = rowHeightPx(view.rowHeight);
    this.sortState = Array.isArray(view.sort)
      ? view.sort.map((s) => ({ fieldId: s.fieldId, direction: s.direction }))
      : [];
    this.measure(view);
    this.root.setAttribute('aria-rowcount', String(this.totalRows + 1)); // keep counts in sync (P6-03)
    this.root.setAttribute('aria-colcount', String(this.fields.length));
    this.viewport.style.height = `${totalHeight(this.totalRows, this.rowHeight)}px`;
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
   * by itself; what needs redoing is the virtual-row math, which reads clientHeight.
   */
  handleResize(): void {
    this.render();
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
    return Array.from(this.header.children).map((c) => c.textContent ?? '');
  }

  /**
   * Recompute column geometry from the view. Called from the constructor and setModel(),
   * so a frozen-columns or column-width change takes effect on the next render.
   */
  private measure(view: ViewDefinition): void {
    this.widths = columnWidths(this.fields, view);
    this.frozenColumns = Math.max(
      0,
      Math.min(this.fields.length, Math.round(view.frozenColumns ?? 0)),
    );
    this.offsets = [];
    let x = 0;
    for (const w of this.widths) {
      this.offsets.push(x);
      x += w;
    }
    this.totalWidth = x;
  }

  /**
   * @param frozenZIndex stacking order for a frozen cell. Body cells pass '1', header cells
   *   '2' — the header is its own stacking context, so this only has to outrank the other
   *   header cells, while the header element itself outranks the whole body.
   */
  private styleCell(cell: HTMLElement, colIndex: number, frozenZIndex: string): void {
    cell.className = 'tablify__cell';
    // Fixed width rather than `flex: 1`: sticky frozen columns need a stable geometry, and
    // header and body have to agree on it. min-width is dropped for the same reason.
    cell.style.flex = '0 0 auto';
    cell.style.boxSizing = 'border-box';
    cell.style.width = `${this.widths[colIndex] ?? DEFAULT_COLUMN_WIDTH}px`;
    // SAD-71 Step 4: capsule language. Padding, separators and ellipsis live in CSS
    // (.tablify__cell / .tablify__cell-text); the capsule gap is a transparent 3px border
    // inside the border-box, so outer geometry — widths, frozen offsets, row pitch — is
    // exactly what the SAD-69 C tests assert. Nothing inline but the geometry itself.
    if (colIndex < this.frozenColumns) {
      // Pinned to a fixed offset, so it holds position while the rest scrolls under it.
      // The opaque background comes from .tablify__cell--frozen in styles.css, which
      // accounts for row striping and the header's own background.
      cell.classList.add('tablify__cell--frozen');
      cell.style.position = 'sticky';
      cell.style.left = `${this.offsets[colIndex]}px`;
      cell.style.zIndex = frozenZIndex;
    }
  }

  private renderHeader(): void {
    this.header.innerHTML = '';
    // Span the columns; min-width keeps the header filling the grid when they are narrower
    // than the viewport, so its background never stops short of the body.
    this.header.style.minWidth = '100%';
    this.header.style.width = `${this.totalWidth}px`;
    const primarySort = this.sortState[0];
    this.fields.forEach((field, colIndex) => {
      const cell = document.createElement('div');
      this.styleCell(cell, colIndex, '2');
      cell.classList.add('tablify__header-cell');
      cell.style.fontWeight = '600';
      cell.setAttribute('role', 'columnheader');
      cell.setAttribute('aria-colindex', String(colIndex + 1));
      // SAD-71 Step 4: the header capsule's type badge is a ::after reading this
      // attribute, so the prototype's badge ships without touching textContent.
      cell.setAttribute('data-field-type', field.type);
      // P6-03 (a11y): announce the primary sort column (attribute-only).
      if (primarySort && primarySort.fieldId === field.id) {
        cell.setAttribute('aria-sort', primarySort.direction === 'desc' ? 'descending' : 'ascending');
      } else {
        cell.removeAttribute('aria-sort');
      }
      cell.dataset.colIndex = String(colIndex);
      cell.setAttribute('data-field-id', field.id);
      cell.textContent = field.name;
      this.header.appendChild(cell);
    });
  }

  private render(): void {
    const viewportH = this.root.clientHeight || this.opts.viewportHeight || 600;
    const { start, end } = getVisibleRange(this.scrollTop, viewportH, this.rowHeight, this.totalRows, OVERSCAN);
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
      // Span the columns, so striping covers the full scrollable width and not just the
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
        this.fields.forEach((field, colIndex) => {
          const cell = document.createElement('div');
          this.styleCell(cell, colIndex, '1');
          const val = row.values[field.id];
          // SAD-71 Step 4: the value lives in a span so the capsule can be a flex box with
          // a real ellipsis; cell.textContent is unchanged for every consumer.
          const text = document.createElement('span');
          text.className = 'tablify__cell-text';
          text.textContent = val === undefined || val === null ? '' : String(Array.isArray(val) ? val.join(', ') : val);
          cell.appendChild(text);
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
            // SAD-69 D: was `var(--interactive-accent)`, an Obsidian variable. The plugin
            // token carries the same value on both themes and keeps the grid theme-independent.
            cell.style.outline = '2px solid var(--tablify-selection)';
            cell.style.outlineOffset = '-2px';
          }
          rowEl.appendChild(cell);
        });
      }
      this.content.appendChild(rowEl);
    }
  }

  destroy(): void {
    this.root.remove();
    this.pool.clear();
  }
}
