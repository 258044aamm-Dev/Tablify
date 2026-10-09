// Obsidian view for .tablify files (P5-00, extended in P5-02).
// Thin layer: load/save via TextFileView, DOM via GridView, logic via tableSession, tableController,
// and the menu models. Every change goes through the command stack (undoable). Save follows each change.

import { Notice, TextFileView, WorkspaceLeaf } from 'obsidian';
import { parse } from '../format/parse.js';
import { serialize } from '../format/serialize.js';
import { createSession, type TableSession } from '../model/tableSession.js';
import { planTypeChange } from '../model/fieldChange.js';
import { getFieldType } from '../model/fieldTypes/registry.js';
import type { CellValue, FieldDefinition, Row } from '../model/types.js';
import { createEditor, isReadOnly, parseInput } from './grid/editors/index.js';
import { GridView, type GridSelection } from './grid/GridView.js';
import { getGridAction, shouldHandleForGrid } from './grid/keyboard.js';
import { isMoveAction, moveSelection } from './tableController.js';
import { buildTableMenu, TypePickerModal } from '../menus/tableMenu.js';
import { cellMenu, CHANGE_TARGET_TYPES, headerEntries, type MenuEntry, type TypeTarget } from '../menus/tableMenuModel.js';

export const TABLIFY_VIEW_TYPE = 'tablify';

interface MenuTarget {
  /** Display row index, or -1 for a header target. */
  row: number;
  /** Visible column index. */
  col: number;
}

export class TableView extends TextFileView {
  private session: TableSession | null = null;
  private grid: GridView | null = null;
  private rawData = '';
  private editing: HTMLElement | null = null;
  private toolbar: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private menuTarget: MenuTarget | null = null;
  /** Text copied from a cell or row (system clipboard is also written when available). */
  private clipboardText: string | null = null;

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
    this.menuTarget = null;
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
    this.afterChange();
  }

  private afterChange(): void {
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
      this.grid.root.addEventListener('contextmenu', (e) => this.onContextMenu(e));
    } else {
      this.grid.setModel(rows, fields, s.getView());
    }
  }

  // ---- keyboard ----

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.grid || !this.session || this.editing) return;
    const root = this.grid.root;
    if (!shouldHandleForGrid(root, document.activeElement)) return;

    // Keyboard menu key or Shift+F10 opens the menu for the selected cell (P5-02).
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      const sel = this.grid.getSelection() ?? { row: 0, col: 0 };
      this.grid.setSelection(sel);
      const cellEl = this.cellElement(sel);
      const rect = cellEl?.getBoundingClientRect();
      this.openCellMenu(sel.row, sel.col, rect ? { x: rect.left, y: rect.bottom } : { x: 0, y: 0 });
      return;
    }

    const action = getGridAction(e);
    if (action === 'none') return;
    e.preventDefault();

    if (isMoveAction(action) || action === 'enterEdit') {
      const sel = this.grid.getSelection() ?? { row: 0, col: 0 };
      if (action === 'enterEdit') {
        this.startEdit(sel);
        return;
      }
      const rowCount = this.session.getDisplayRows().length;
      const colCount = this.session.getVisibleFields().length;
      const next = moveSelection(sel, action, rowCount, colCount);
      this.grid.setSelection(next);
      this.grid.scrollToRow(next.row);
      return;
    }
    if (action === 'undo') this.mutate((s) => s.undo());
    if (action === 'redo') this.mutate((s) => s.redo());
  }

  private cellElement(sel: GridSelection): HTMLElement | null {
    if (!this.grid) return null;
    return this.grid.root.querySelector(
      `.tablify__row[data-row-index="${sel.row}"] .tablify__cell[data-col-index="${sel.col}"]`,
    ) as HTMLElement | null;
  }

  // ---- context menus (P5-02) ----

  private onContextMenu(e: MouseEvent): void {
    if (!this.grid) return;
    const target = e.target as HTMLElement | null;
    const headerCell = target?.closest?.('.tablify__header-cell') as HTMLElement | null;
    if (headerCell) {
      e.preventDefault();
      this.openHeaderMenu(Number(headerCell.dataset.colIndex), e);
      return;
    }
    const cell = target?.closest?.('.tablify__cell') as HTMLElement | null;
    if (!cell) return;
    e.preventDefault();
    const row = Number((cell.parentElement as HTMLElement).dataset.rowIndex);
    const col = Number(cell.dataset.colIndex);
    this.grid.setSelection({ row, col });
    this.openCellMenu(row, col, e);
  }

  private openCellMenu(row: number, col: number, pos: MouseEvent | { x: number; y: number }): void {
    if (!this.session) return;
    const rowData = this.session.getDisplayRows()[row];
    const field = this.session.getVisibleFields()[col];
    if (!rowData || !field) return;
    const value = rowData.values[field.id];
    const entries = cellMenu({
      readOnly: isReadOnly(field),
      cellEmpty: isEmptyValue(value),
      hasClipboard: this.clipboardText !== null,
    });
    this.showMenu(entries, { row, col }, pos);
  }

  private openHeaderMenu(col: number, pos: MouseEvent | { x: number; y: number }): void {
    if (!this.session) return;
    const field = this.session.getVisibleFields()[col];
    if (!field) return;
    const entries = headerEntries({
      fieldId: field.id,
      isPrimary: field.primary === true,
      colIndex: col,
      view: this.session.getView(),
    });
    this.showMenu(entries, { row: -1, col }, pos);
  }

  private showMenu(entries: MenuEntry[], target: MenuTarget, pos: MouseEvent | { x: number; y: number }): void {
    this.menuTarget = target;
    const menu = buildTableMenu(entries, (id) => this.runMenuAction(id));
    if ('clientX' in pos) menu.showAtMouseEvent(pos);
    else menu.showAtPosition(pos);
  }

  /** Run one menu item against the target captured when the menu opened. */
  private runMenuAction(id: string): void {
    const s = this.session;
    const t = this.menuTarget;
    if (!s || !t) return;
    const rows = s.getDisplayRows();
    const fields = s.getVisibleFields();

    if (id.startsWith('cell.') || id.startsWith('row.')) {
      const row = rows[t.row];
      const field = fields[t.col];
      if (!row || !field) return;
      switch (id) {
        case 'cell.copy':
          this.copyText(formatValue(row.values[field.id], field));
          return;
        case 'cell.paste':
          this.pasteInto(row, field);
          return;
        case 'cell.clear':
          s.setValue(row.id, field.id, null);
          break;
        case 'row.insertAbove':
          s.insertRowNear(row.id, 'above');
          break;
        case 'row.insertBelow':
          s.insertRowNear(row.id, 'below');
          break;
        case 'row.duplicate':
          s.duplicateRow(row.id);
          break;
        case 'row.copy':
          this.copyText(fields.map((f) => formatValue(row.values[f.id], f)).join('\t'));
          return;
        case 'row.delete':
          s.deleteRow(row.id);
          break;
        default:
          return;
      }
      this.afterChange();
      return;
    }

    const field = fields[t.col];
    if (!field) return;
    switch (id) {
      case 'header.type': {
        const allRows = s.store.getAllRows();
        const targets: TypeTarget[] = CHANGE_TARGET_TYPES.map((type) => {
          const plan = planTypeChange(allRows, field, type);
          return plan.ok ? { type, ok: true } : { type, ok: false, reason: plan.reason };
        });
        new TypePickerModal(this.app, targets, (target) => {
          const result = s.changeFieldType(field.id, target.type);
          if (!result.ok) new Notice(result.reason);
          this.afterChange();
        }).open();
        return;
      }
      case 'header.hide':
        s.setView({ ...s.getView(), hidden: [...s.getView().hidden, field.id] });
        break;
      case 'header.sortAsc':
        s.setView({ ...s.getView(), sort: [{ fieldId: field.id, direction: 'asc' }] });
        break;
      case 'header.sortDesc':
        s.setView({ ...s.getView(), sort: [{ fieldId: field.id, direction: 'desc' }] });
        break;
      case 'header.freeze':
        s.setView({ ...s.getView(), frozenColumns: t.col + 1 });
        break;
      default:
        return;
    }
    this.afterChange();
  }

  private pasteInto(row: Row, field: FieldDefinition): void {
    if (this.clipboardText === null) {
      new Notice('Nothing copied yet.');
      return;
    }
    const res = parseInput(field, this.clipboardText);
    if (!res.ok) {
      new Notice(`Cannot paste here: ${res.error}`);
      return;
    }
    this.session?.setValue(row.id, field.id, res.value);
    this.afterChange();
  }

  private copyText(text: string): void {
    this.clipboardText = text;
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  // ---- inline editing ----

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
    const cell = this.cellElement(sel);
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

function formatValue(value: CellValue | undefined, field: FieldDefinition): string {
  return getFieldType(field.type).format(value ?? null, field);
}

function isEmptyValue(v: CellValue | undefined): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}
