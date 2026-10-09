// Obsidian view for .tablify files (P5-00).
// Thin layer: load/save via TextFileView, DOM via GridView, logic via tableSession and tableController.
// Every change goes through the command stack (undoable). Save is requested after each change.

import { TextFileView, WorkspaceLeaf } from 'obsidian';
import { parse } from '../format/parse.js';
import { serialize } from '../format/serialize.js';
import { createSession, type TableSession } from '../model/tableSession.js';
import { createEditor } from './grid/editors/index.js';
import { GridView, type GridSelection } from './grid/GridView.js';
import { getGridAction, shouldHandleForGrid } from './grid/keyboard.js';
import { isMoveAction, moveSelection } from './tableController.js';

export const TABLIFY_VIEW_TYPE = 'tablify';

export class TableView extends TextFileView {
  private session: TableSession | null = null;
  private grid: GridView | null = null;
  private rawData = '';
  private editing: HTMLElement | null = null;
  private toolbar: HTMLElement | null = null;
  private body: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return TABLIFY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file?.basename ?? 'Tablify table';
  }

  canAcceptExtension(extension: string): boolean {
    return extension === 'tablify';
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('tablify-view');
    this.toolbar = this.contentEl.createDiv({ cls: 'tablify__toolbar' });
    this.addToolbarButton('Add row', () => this.mutate((s) => s.addRow()));
    this.addToolbarButton('Undo', () => this.mutate((s) => s.undo()));
    this.addToolbarButton('Redo', () => this.mutate((s) => s.redo()));
    this.body = this.contentEl.createDiv({ cls: 'tablify__body' });
  }

  setViewData(data: string, clear: boolean): void {
    if (clear) this.clear();
    this.rawData = data;
    const parsed = parse(data);
    if (!parsed.ok) {
      this.session = null;
      this.showError(parsed.error ?? 'Could not read this .tablify file.');
      return;
    }
    this.session = createSession(parsed.data);
    this.renderGrid();
  }

  getViewData(): string {
    // Never overwrite the file with a view state we could not parse.
    if (!this.session) return this.rawData;
    return serialize(this.session.toFile());
  }

  clear(): void {
    this.grid?.destroy();
    this.grid = null;
    this.session = null;
    this.editing = null;
    if (this.body) this.body.empty();
  }

  async onClose(): Promise<void> {
    this.clear();
  }

  // ---- internals ----

  private addToolbarButton(label: string, onClick: () => void): void {
    const btn = this.toolbar!.createEl('button', { text: label, cls: 'tablify__toolbar-button' });
    btn.addEventListener('click', onClick);
  }

  private showError(message: string): void {
    this.clear();
    this.body?.createDiv({ cls: 'tablify__error', text: message });
  }

  /** Apply a model change, then re-render and request a save. */
  private mutate(change: (s: TableSession) => void): void {
    if (!this.session) return;
    change(this.session);
    this.renderGrid();
    this.requestSave();
  }

  private renderGrid(): void {
    if (!this.session || !this.body) return;
    const s = this.session;
    const rows = s.getDisplayRows();
    const fields = s.getVisibleFields();
    const theme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    if (!this.grid) {
      this.body.empty();
      this.grid = new GridView({
        rows,
        fields,
        view: s.getView(),
        theme,
        viewportWidth: this.contentEl.clientWidth || 800,
        onCellClick: () => this.grid?.root.focus(),
      });
      this.body.appendChild(this.grid.root);
      this.grid.root.tabIndex = 0;
      this.grid.root.addEventListener('keydown', (e) => this.onKeyDown(e));
    } else {
      this.grid.setModel(rows, fields, s.getView());
    }
    this.clampSelection();
  }

  private clampSelection(): void {
    if (!this.grid) return;
    const sel = this.grid.getSelection();
    if (!sel) return;
    this.grid.setSelection(sel);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.grid || !this.session || this.editing) return;
    const root = this.grid.root;
    if (!shouldHandleForGrid(root, document.activeElement)) return;
    const action = getGridAction(e);
    if (action === 'none') return;
    e.preventDefault();

    if (isMoveAction(action) || action === 'enterEdit') {
      let sel = this.grid.getSelection() ?? { row: 0, col: 0 };
      if (action === 'enterEdit') {
        this.startEdit(sel);
        return;
      }
      const rowCount = this.session.getDisplayRows().length;
      const colCount = this.session.getVisibleFields().length;
      sel = moveSelection(sel, action, rowCount, colCount);
      this.grid.setSelection(sel);
      this.grid.scrollToRow(sel.row);
      return;
    }
    if (action === 'undo') this.mutate((s) => s.undo());
    if (action === 'redo') this.mutate((s) => s.redo());
  }

  /** Open the inline editor over the selected cell. Commit goes through the command stack. */
  private startEdit(sel: GridSelection): void {
    const s = this.session;
    const grid = this.grid;
    if (!s || !grid) return;
    const rows = s.getDisplayRows();
    const fields = s.getVisibleFields();
    const row = rows[sel.row];
    const field = fields[sel.col];
    if (!row || !field) return;
    const storeRow = s.store.getRow(row.id);
    if (!storeRow) return;

    grid.scrollToRow(sel.row);
    const cell = grid.root.querySelector(`.tablify__row[data-row-index="${sel.row}"] .tablify__cell[data-col-index="${sel.col}"]`) as HTMLElement | null;
    const editor = createEditor(field, storeRow, s.store, s.stack, (committed) => {
      this.editing = null;
      editor?.remove();
      this.renderGrid();
      grid.root.focus();
      if (committed) this.requestSave();
    });
    if (!editor || !cell) return;
    this.editing = editor;
    editor.style.position = 'absolute';
    const rootRect = grid.root.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    editor.style.left = `${cellRect.left - rootRect.left + grid.root.scrollLeft}px`;
    editor.style.top = `${cellRect.top - rootRect.top + grid.root.scrollTop}px`;
    editor.style.width = `${cellRect.width}px`;
    editor.style.height = `${cellRect.height}px`;
    grid.root.appendChild(editor);
  }
}
