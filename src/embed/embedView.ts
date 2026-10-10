// P7-01 — the DOM for one embed of a .tablify file inside a note (v1.1).
//
// Shows a fence-style header (file path, "Open full table") and a height-limited grid. The grid
// is GridView, and edits go through the shared document's command stack, the same path the full
// view uses. Every embed of a file re-renders when that file's document changes.

import type { CellValue, FieldDefinition, Row } from '../model/types.js';
import type { TableSession } from '../model/tableSession.js';
import { createEditor } from '../views/grid/editors/index.js';
import { GridView, type GridSelection } from '../views/grid/GridView.js';
import { getGridAction } from '../views/grid/keyboard.js';
import { moveSelection } from '../views/tableController.js';
import type { EmbedDocument } from './embedDocument.js';
import type { VaultLinkIndex } from '../links/vaultLinkIndex.js';
import { summarizeLinks } from '../model/link.js';
import { Notice } from 'obsidian';

/** Height limit for an embed. The full view is not limited. */
export const EMBED_VIEWPORT_HEIGHT = 320;

export interface EmbedViewOptions {
  doc: EmbedDocument;
  onOpenFull: (path: string) => void;
  theme?: 'light' | 'dark';
  viewportWidth?: number;
  /** P8-04: the vault link index. Link cells then show resolved names and broken-link markers. */
  links?: VaultLinkIndex;
}

export class EmbedView {
  readonly root: HTMLElement;
  private readonly doc: EmbedDocument;
  private readonly opts: EmbedViewOptions;
  private readonly header: HTMLElement;
  private readonly body: HTMLElement;
  private grid: GridView | null = null;
  private sel: GridSelection = { row: 0, col: 0 };
  private editing: HTMLElement | null = null;
  private readonly unsubscribe: () => void;
  private unlinks: (() => void) | null = null;
  private destroyed = false;

  constructor(opts: EmbedViewOptions) {
    this.opts = opts;
    this.doc = opts.doc;
    this.root = document.createElement('div');
    this.root.className = 'tablify-embed';
    this.root.dataset.testid = 'tablify-embed';

    this.header = document.createElement('div');
    this.header.className = 'tablify-embed__head';
    const label = document.createElement('span');
    label.className = 'tablify-embed__path';
    label.textContent = 'file: ' + this.doc.path;
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'tablify-embed__open';
    open.textContent = 'Open full table';
    open.dataset.testid = 'tablify-embed-open';
    open.addEventListener('click', () => this.opts.onOpenFull(this.doc.path));
    this.header.append(label, open);
    this.root.appendChild(this.header);

    this.body = document.createElement('div');
    this.body.className = 'tablify-embed__body';
    this.root.appendChild(this.body);

    this.unsubscribe = this.doc.subscribe(() => this.render());
    // P8-04: a change in a linked table redraws this embed's link markers.
    this.unlinks = this.opts.links?.onChange(() => this.render()) ?? null;
    this.render();
  }

  /** Re-renders from the document. Safe to call at any time. */
  render(): void {
    if (this.destroyed) return;
    const error = this.doc.getError();
    const session = this.doc.getSession();
    if (error || !session) {
      this.showError(error ?? 'Tablify embed: the file could not be read.');
      return;
    }
    this.clearError();
    this.ensureGrid();
    if (!this.grid) return;
    const rows = session.getDisplayRows();
    const fields = session.getVisibleFields();
    this.clampSelection(rows.length, fields.length);
    this.grid.setTheme(this.theme());
    this.grid.setModel(rows, fields, session.getView());
    this.grid.setSelection(this.sel);
  }

  /** Moves the selection, as the arrow keys do. Exposed for tests and for the key handler. */
  moveBy(action: 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight' | 'tabNext' | 'tabPrev'): void {
    const s = this.doc.getSession();
    if (!s) return;
    this.sel = moveSelection(this.sel, action, s.getDisplayRows().length, s.getVisibleFields().length);
    this.grid?.setSelection(this.sel);
  }

  getSelection(): GridSelection {
    return { ...this.sel };
  }

  /** Opens the inline editor for the selected cell. Returns false when the cell is read-only or missing. */
  startEdit(): boolean {
    const s = this.doc.getSession();
    const grid = this.grid;
    if (!s || !grid || this.editing) return false;
    const rows = s.getDisplayRows();
    const fields = s.getVisibleFields();
    const row = rows[this.sel.row];
    const field = fields[this.sel.col];
    if (!row || !field) return false;
    const storeRow = s.store.getRow(row.id);
    if (!storeRow) return false;
    // P8-04: link cells use the row picker, which lives in the full table view.
    if (field.type === 'link') {
      new Notice('Open the full table to change links.');
      return false;
    }
    const editor = createEditor(field, storeRow, s.store, s.stack, (committed) => {
      this.editing = null;
      editor?.remove();
      if (committed) this.doc.commit();
      else this.render();
      grid.root.focus();
    });
    if (!editor) return false;
    this.editing = editor;
    editor.style.position = 'absolute';
    const cell = this.cellElement();
    if (cell) {
      const rootRect = grid.root.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      editor.style.left = `${cellRect.left - rootRect.left + grid.root.scrollLeft}px`;
      editor.style.top = `${cellRect.top - rootRect.top + grid.root.scrollTop}px`;
      editor.style.width = `${cellRect.width}px`;
      editor.style.height = `${cellRect.height}px`;
    }
    grid.root.appendChild(editor);
    return true;
  }

  /** Adds a row through the command stack and saves. */
  insertRow(): void {
    this.doc.mutate((s) => s.addRow());
  }

  /** Reads the displayed value of one cell. Used by tests. */
  cellValue(rowIndex: number, colIndex: number): CellValue | undefined {
    const s = this.doc.getSession();
    if (!s) return undefined;
    const row: Row | undefined = s.getDisplayRows()[rowIndex];
    const field: FieldDefinition | undefined = s.getVisibleFields()[colIndex];
    if (!row || !field) return undefined;
    return row.values[field.id];
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe();
    this.unlinks?.();
    this.editing?.remove();
    this.editing = null;
    this.grid?.destroy();
    this.grid = null;
    this.root.remove();
  }

  // ---- internals ----

  private theme(): 'light' | 'dark' {
    if (this.opts.theme) return this.opts.theme;
    return typeof document !== 'undefined' && document.body.classList.contains('theme-dark') ? 'dark' : 'light';
  }

  private ensureGrid(): void {
    if (this.grid) return;
    const s = this.doc.getSession() as TableSession;
    const links = this.opts.links;
    this.grid = new GridView({
      rows: s.getDisplayRows(),
      fields: s.getVisibleFields(),
      view: s.getView(),
      theme: this.theme(),
      viewportHeight: EMBED_VIEWPORT_HEIGHT,
      viewportWidth: this.opts.viewportWidth ?? 800,
      onCellClick: (row, col) => {
        this.sel = { row, col };
      },
      linkSummary: links ? (value) => summarizeLinks(value, links.index) : undefined,
    });
    this.grid.root.tabIndex = 0;
    this.grid.root.addEventListener('keydown', (e) => this.onKeyDown(e));
    this.grid.root.addEventListener('dblclick', () => this.startEdit());
    this.body.appendChild(this.grid.root);

    const insert = document.createElement('button');
    insert.type = 'button';
    insert.className = 'tablify-embed__insert';
    insert.textContent = 'Insert Row';
    insert.dataset.testid = 'tablify-embed-insert';
    insert.addEventListener('click', () => this.insertRow());
    this.body.appendChild(insert);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.editing || !this.grid) return;
    const action = getGridAction(e);
    if (action === 'none') return;
    e.preventDefault();
    if (action === 'enterEdit') {
      this.startEdit();
      return;
    }
    if (action === 'undo') {
      this.doc.mutate((s) => s.undo());
      return;
    }
    if (action === 'redo') {
      this.doc.mutate((s) => s.redo());
      return;
    }
    if (
      action === 'moveUp' ||
      action === 'moveDown' ||
      action === 'moveLeft' ||
      action === 'moveRight' ||
      action === 'tabNext' ||
      action === 'tabPrev'
    ) {
      this.moveBy(action);
    }
  }

  private cellElement(): HTMLElement | null {
    if (!this.grid) return null;
    return this.grid.root.querySelector(
      `.tablify__row[data-row-index="${this.sel.row}"] .tablify__cell[data-col-index="${this.sel.col}"]`,
    ) as HTMLElement | null;
  }

  private clampSelection(rowCount: number, colCount: number): void {
    const row = Math.max(0, Math.min(this.sel.row, rowCount - 1));
    const col = Math.max(0, Math.min(this.sel.col, colCount - 1));
    this.sel = { row: Math.max(0, row), col: Math.max(0, col) };
  }

  private showError(message: string): void {
    this.grid?.destroy();
    this.grid = null;
    this.body.replaceChildren();
    const err = document.createElement('div');
    err.className = 'tablify__error tablify-embed__error';
    err.dataset.testid = 'tablify-embed-error';
    err.textContent = message;
    this.body.appendChild(err);
  }

  private clearError(): void {
    const err = this.body.querySelector('.tablify-embed__error');
    if (err) this.body.replaceChildren();
  }
}
