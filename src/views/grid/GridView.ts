/**
 * Grid shell with virtual rows — MVP shell.
 * Renders only visible rows + overscan, recycles row elements, supports touch scrolling.
 * Column virtualization is NOT implemented; all columns are rendered per row (horizontal scroll via overflow-x).
 * Row height comes from ViewDefinition.rowHeight via src/model/view.ts (compact/medium/tall).
 * Theme is applied via src/ui/theme/tokens.ts applyTheme on the root.
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
}

export class GridView {
  root: HTMLElement;
  viewport: HTMLElement;
  content: HTMLElement;
  private pool: RowPool;
  private scrollTop = 0;
  private rowHeight: number;
  private totalRows: number;
  private fields: FieldDefinition[];
  private rows: Row[];

  constructor(private opts: GridOptions) {
    this.fields = opts.fields;
    this.rows = opts.rows;
    this.totalRows = opts.rows.length;
    this.rowHeight = rowHeightPx(opts.view.rowHeight);

    this.root = document.createElement('div');
    this.root.className = 'tablify tablify--grid';
    // touch scrolling without blocking page
    this.root.style.overflow = 'auto';
    this.root.style.webkitOverflowScrolling = 'touch' as unknown as string;
    this.root.style.height = `${opts.viewportHeight ?? 600}px`;
    this.root.style.width = `${opts.viewportWidth ?? 800}px`;
    this.root.style.position = 'relative';
    applyTheme(this.root, opts.theme);

    this.viewport = document.createElement('div');
    this.viewport.className = 'tablify__viewport';
    this.viewport.style.position = 'relative';
    this.viewport.style.height = `${totalHeight(this.totalRows, this.rowHeight)}px`;
    this.viewport.style.overflowX = 'auto';

    this.content = document.createElement('div');
    this.content.className = 'tablify__content';
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
      el.style.borderBottom = '1px solid var(--tablify-border)';
      return el;
    });

    // scroll handler
    this.root.addEventListener('scroll', () => {
      this.scrollTop = this.root.scrollTop;
      this.render();
    });

    this.render();
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
      // Render cells for all fields (no column virtualization)
      // Clear previous cells
      rowEl.innerHTML = '';
      const row = this.rows[rowIdx];
      if (row) {
        // stripe
        if (rowIdx % 2 === 1) rowEl.classList.add('tablify__row--stripe');
        else rowEl.classList.remove('tablify__row--stripe');
        for (const field of this.fields) {
          const cell = document.createElement('div');
          cell.className = 'tablify__cell';
          cell.style.flex = '1';
          cell.style.minWidth = '120px';
          cell.style.padding = '4px 8px';
          cell.style.overflow = 'hidden';
          cell.style.textOverflow = 'ellipsis';
          cell.style.whiteSpace = 'nowrap';
          cell.style.borderRight = '1px solid var(--tablify-border)';
          const val = row.values[field.id];
          cell.textContent = val === undefined || val === null ? '' : String(Array.isArray(val) ? val.join(', ') : val);
          cell.setAttribute('data-field-id', field.id);
          rowEl.appendChild(cell);
        }
      }
      this.content.appendChild(rowEl);
    }
  }

  destroy(): void {
    this.root.remove();
    this.pool.clear();
  }
}
