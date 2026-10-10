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
import { LongPressDetector } from './longPress.js';
import { buildTableMenu, TypePickerModal } from '../menus/tableMenu.js';
import { cellMenu, CHANGE_TARGET_TYPES, headerEntries, type MenuEntry, type TypeTarget } from '../menus/tableMenuModel.js';
import { createDefaultView } from '../model/view.js';
import { setFrozenColumns, setRowHeight } from './grid/columns.js';
import { Toolbar, type ToolbarCallbacks, type ToolbarState } from './grid/toolbar.js';
import { AddFieldModal } from './grid/AddFieldModal.js';

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
  /** Bottom-of-shell "Insert Row" pill (SAD-71 Step 1, prototype parity). */
  private insertBtn: HTMLButtonElement | null = null;
  /** Empty-table hint shown above the Insert Row pill (SAD-71 Step 1). */
  private emptyHint: HTMLElement | null = null;
  /** Text copied from a cell or row (system clipboard is also written when available). */
  private clipboardText: string | null = null;
  /** Long-press state for touch (P5-03). */
  private readonly press = new LongPressDetector({ onLongPress: (p) => this.onLongPress(p) });
  private pressTarget: HTMLElement | null = null;
  /** Set when a long press opened the menu, so the following click does nothing. */
  private suppressClick = false;
  /** Time of the last touch, used to ignore the native touch context menu (P5-03). */
  private lastTouchAt = 0;

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
    // SAD-69: the toolbar P3-08 specified and that never existed. Built once here and
    // refreshed through update() on every render — rebuilding would drop focus and caret.
    this.toolbarView = new Toolbar({ ...this.toolbarState(), callbacks: this.toolbarCallbacks() });
    this.contentEl.appendChild(this.toolbarView.root);
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
    this.insertBtn = null;
    this.emptyHint = null;
    if (this.body) this.body.empty();
    this.syncToolbar();
  }

  async onClose(): Promise<void> {
    this.clear();
    this.toolbarView?.destroy();
    this.toolbarView = null;
  }

  /**
   * Obsidian lifecycle: the pane changed size (SAD-71 Step 1). The grid is CSS-sized, so
   * only the virtual-row math needs redoing — it reads clientHeight, which just changed.
   */
  onResize(): void {
    this.grid?.handleResize();
  }

  // ---- internals ----

  private currentTheme(): 'light' | 'dark' {
    return document.body.classList.contains('theme-dark') ? 'dark' : 'light';
  }

  /** Snapshot of everything the toolbar renders from. */
  private toolbarState(): ToolbarState {
    const theme = this.currentTheme();
    const s = this.session;
    if (!s) {
      return {
        fields: [],
        view: createDefaultView([]),
        visibleRowCount: 0,
        totalRowCount: 0,
        search: '',
        query: '',
        queryError: null,
        theme,
      };
    }
    const view = s.getView();
    return {
      fields: s.getFields(),
      view,
      visibleRowCount: s.getDisplayRows().length,
      totalRowCount: s.store.getAllRows().length,
      search: view.search ?? '',
      query: view.query ?? '',
      queryError: s.getFilterError(),
      theme,
    };
  }

  /** Push the current model state into the toolbar without rebuilding it. */
  private syncToolbar(): void {
    this.toolbarView?.update(this.toolbarState());
  }

  private toolbarCallbacks(): ToolbarCallbacks {
    return {
      // Search and query are persisted but not undoable — see patchView().
      onSearch: (term) => this.applyFilter({ search: term }),
      onQuery: (query) => this.applyFilter({ query }),
      onAddRow: () => this.mutate((s) => s.addRow()),
      onAddField: () => this.promptAddField(),
      onRowHeight: (height) =>
        this.applyViewChange((view, fields) => setRowHeight(view, height, fields)),
      onFreezeColumns: (count) =>
        this.applyViewChange((view, fields) => setFrozenColumns(view, count, fields)),
      // SAD-69 plan item B: the only way to bring a hidden field back.
      onShowField: (fieldId) =>
        this.mutate((s) => {
          const view = s.getView();
          s.setView({ ...view, hidden: view.hidden.filter((id) => id !== fieldId) });
        }),
      onClearFilters: () => this.applyFilter({ search: '', query: '' }),
      onUndo: () => this.mutate((s) => s.undo()),
      onRedo: () => this.mutate((s) => s.redo()),
    };
  }

  /**
   * Persist search/query. Goes through patchView(), not setView(), so typing does not push
   * an undo entry per debounce tick — see the note on TableSession.patchView.
   */
  private applyFilter(patch: { search?: string; query?: string }): void {
    if (!this.session) return;
    this.session.patchView(patch);
    this.afterChange();
  }

  /** Apply an undoable view change through setView(). */
  private applyViewChange(
    change: (view: ViewDefinition, fields: FieldDefinition[]) => ViewDefinition,
  ): void {
    if (!this.session) return;
    const s = this.session;
    const before = s.getView();
    const next = change(before, s.getFields());
    if (next === before) return;
    s.setView(next);
    this.afterChange();
  }

  private promptAddField(): void {
    if (!this.session) return;
    new AddFieldModal(this.app, (name, type) => {
      if (!this.session) return;
      this.session.addField(name, type);
      this.afterChange();
    }).open();
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
    // Refresh the toolbar on every render: row counts, hidden fields, row height, theme and
    // the persisted search/query all feed it. Runs before the guard so it also resets when
    // the session goes away.
    this.syncToolbar();
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
      this.wirePressEvents(this.grid.root);
      // SAD-71 Step 1: the prototype keeps an "Insert Row" pill at the bottom of the table
      // container, and an empty table gets a hint instead of a black void. Plain DOM (not
      // createEl) so the jsdom mock and the browser agree, exactly like toolbar/GridView.
      this.emptyHint = document.createElement('div');
      this.emptyHint.className = 'tablify__empty-hint';
      this.emptyHint.textContent = 'This table is empty. Insert a row to get started.';
      this.emptyHint.dataset.testid = 'tablify-empty-hint';
      this.body.appendChild(this.emptyHint);
      this.insertBtn = document.createElement('button');
      this.insertBtn.type = 'button';
      this.insertBtn.className = 'tablify__insert-row';
      this.insertBtn.textContent = 'Insert Row';
      this.insertBtn.dataset.testid = 'tablify-insert-row';
      this.insertBtn.addEventListener('click', () => this.mutate((st) => st.addRow()));
      this.body.appendChild(this.insertBtn);
    } else {
      this.grid.setModel(rows, fields, s.getView());
    }
    if (this.emptyHint) this.emptyHint.hidden = rows.length !== 0;
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
    // A touch long press opens the menu through LongPressDetector. The native touch context menu
    // that follows is ignored, so the menu does not open twice (P5-03).
    if (Date.now() - this.lastTouchAt < 1500) {
      e.preventDefault();
      return;
    }
    if (this.openMenuFromTarget(e.target as HTMLElement | null, e)) e.preventDefault();
  }

  /** Open the header or cell menu for a DOM target. Returns false when the target is neither. */
  private openMenuFromTarget(target: HTMLElement | null, pos: MouseEvent | { x: number; y: number }): boolean {
    if (!this.grid) return false;
    const headerCell = target?.closest?.('.tablify__header-cell') as HTMLElement | null;
    if (headerCell) {
      this.openHeaderMenu(Number(headerCell.dataset.colIndex), pos);
      return true;
    }
    const cell = target?.closest?.('.tablify__cell') as HTMLElement | null;
    if (!cell) return false;
    const row = Number((cell.parentElement as HTMLElement).dataset.rowIndex);
    const col = Number(cell.dataset.colIndex);
    this.grid.setSelection({ row, col });
    this.openCellMenu(row, col, pos);
    return true;
  }

  // ---- touch long press (P5-03) ----

  private wirePressEvents(root: HTMLElement): void {
    root.addEventListener('pointerdown', (e) => {
      // Reset on every press, so a long press that gets no click cannot swallow the next click.
      this.suppressClick = false;
      if (this.editing || e.pointerType !== 'touch') return;
      this.lastTouchAt = Date.now();
      this.pressTarget = e.target as HTMLElement | null;
      this.press.pointerDown(e.clientX, e.clientY, e.pointerType);
    });
    root.addEventListener('pointermove', (e) => this.press.pointerMove(e.clientX, e.clientY));
    root.addEventListener('pointerup', () => {
      this.lastTouchAt = Date.now();
      this.suppressClick = this.press.pointerUp() || this.suppressClick;
    });
    root.addEventListener('pointercancel', () => {
      this.lastTouchAt = Date.now();
      this.press.pointerCancel();
    });
    // A scroll that starts on a cell cancels the press, so the menu does not open (P5-03).
    root.addEventListener('scroll', () => this.press.scroll());
    // Block native text selection while a touch press is being evaluated.
    root.addEventListener('selectstart', (e) => {
      if (this.press.isPending() || this.press.state === 'fired') e.preventDefault();
    });
    // Swallow the click that follows a fired long press.
    root.addEventListener(
      'click',
      (e) => {
        if (this.suppressClick) {
          this.suppressClick = false;
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true,
    );
    root.style.setProperty('-webkit-touch-callout', 'none');
  }

  private onLongPress(point: { x: number; y: number }): void {
    const target = this.pressTarget;
    this.pressTarget = null;
    if (!target || this.editing) return;
    this.suppressClick = true;
    this.openMenuFromTarget(target, point);
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
