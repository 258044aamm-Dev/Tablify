// Obsidian view for .tablify files (P5-00, extended in P5-02).
// Thin layer: load/save via TextFileView, DOM via GridView, logic via tableSession, tableController,
// and the menu models. Every change goes through the command stack (undoable). Save follows each change.

import { Notice, Platform, TextFileView, TFile, WorkspaceLeaf } from 'obsidian';
import { parse } from '../format/parse.js';
import { serialize } from '../format/serialize.js';
import { countForeignRefs, removeForeignRefs } from '../model/link.js';
import { createSession, type TableSession } from '../model/tableSession.js';
import { planTypeChange } from '../model/fieldChange.js';
import { getFieldType } from '../model/fieldTypes/registry.js';
import type { CellValue, FieldDefinition, LinkRef, Row } from '../model/types.js';
import { createEditor, isReadOnly, parseInput } from './grid/editors/index.js';
import { GridView, type GridSelection } from './grid/GridView.js';
import { getGridAction, shouldHandleForGrid } from './grid/keyboard.js';
import { isMoveAction, moveSelection } from './tableController.js';
import { LongPressDetector } from './longPress.js';
import { buildTableMenu } from '../menus/tableMenu.js';
import { cellMenu, headerEntries, rowEntries, type MenuEntry } from '../menus/tableMenuModel.js';
import { createDefaultView, effectiveFrozenColumns } from '../model/view.js';
import { cycleHeaderSort, hideField, moveColumnOnto, resizeColumn, setFrozenColumns, setGroupBy, setRowHeight, setSort } from './grid/columns.js';
import { groupRows, toggleCollapsed, type GroupedRows } from './grid/grouping.js';
import { addRowRange, pruneSelection, toggleRow } from './grid/selection.js';
import { Toolbar, type ToolbarCallbacks, type ToolbarState } from './grid/toolbar.js';
import { AddFieldModal, FieldEditorModal } from './grid/AddFieldModal.js';
import { previewFormula } from '../model/formulaPreview.js';
import { LinkPickerModal } from './grid/LinkPickerModal.js';
import { linkIndexFor } from '../links/vaultLinkIndex.js';
import { snapshotTable, summarizeLinks } from '../model/link.js';
import { FormulaEditModal } from './grid/FormulaEditModal.js';
import { applyTheme } from '../ui/theme/tokens.js';
import { TitleRow, type TitleRowCallbacks, type TitleRowState } from './titleRow.js';
import { openExportModal } from '../commands/export.js';
import { beginExportSave, browserExportSaveRuntime, saveExportArtifact } from '../io/export/destination.js';
import { buildExportArtifact, exportFileName, exportMimeType } from '../io/export/exporter.js';
import { toMarkdown } from '../io/export/markdown.js';
import type { ExportTable } from '../io/export/view.js';
import { FilterBuilderModal } from './grid/FilterBuilderModal.js';
import { SelectDropdown } from './grid/select/Dropdown.js';
import { OptionManagerDialog } from './grid/select/OptionManager.js';
import { AttachmentPanel } from './grid/AttachmentPanel.js';
import { checkAttachmentPath, normalizeAttachmentPath } from './grid/attachment.js';
import { createSetFieldOptionsCommand } from '../model/commands.js';
import { planOptionAdd } from '../model/selectOptions.js';
import type { SelectOption } from '../model/types.js';

/** Plugin-level services the view cannot reach itself (it has no access to plugin settings). */
export interface TableViewHooks {
  /** Open the Airtable sync modal for this view — the "Airtable sync for this table" command. */
  openSync?(view: TableView): void;
}

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
  /** SAD-80: selected row ids — UI state only, never saved and never undoable. */
  private rowSelection: ReadonlySet<string> = new Set();
  private toolbar: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private menuTarget: MenuTarget | null = null;
  /** Workspace card wrapping toolbar + grid (SAD-71 Step 6). */
  private card: HTMLElement | null = null;
  /** Prototype title row: editable name, file chip, Import/Export/Copy links (SAD-77). */
  private titleRow: TitleRow | null = null;
  /** Text copied from a cell or row (system clipboard is also written when available). */
  private clipboardText: string | null = null;
  /** Long-press state for touch (P5-03). */
  private readonly press = new LongPressDetector({ onLongPress: (p) => this.onLongPress(p) });
  private pressTarget: HTMLElement | null = null;
  /** Set when a long press opened the menu, so the following click does nothing. */
  private suppressClick = false;
  /** SAD-114: the row a Shift-click range starts from (set by any row selection change). */
  private selectionAnchor: string | null = null;
  /** Time of the last touch (P5-03), used to ignore the native touch context menu. SAD-97:
   * stamped on touch contact only — never on mouse/pen — so desktop right-clicks are unaffected. */
  private lastTouchAt = 0;
  /** SAD-96: pointer type of the most recent press — touch taps edit differently from mouse. */
  private lastPointerType = 'mouse';
  /** P8-04: unsubscribe from the vault link index on close. */
  private linkUnsub: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly hooks: TableViewHooks = {},
  ) {
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
    // SAD-71 Step 6: the view surface carries the tokens, so the workspace card resolves
    // them even before a file loads. Plugin-scoped like every other applyTheme call —
    // document.body and the host Obsidian theme are never touched (branding §3).
    applyTheme(this.contentEl, this.currentTheme());
    // One rounded card around toolbar + grid, per the prototype's outer container.
    this.card = document.createElement('div');
    this.card.className = 'tablify__card';
    this.contentEl.appendChild(this.card);
    // SAD-77: the prototype's title row sits above the toolbar inside the card.
    this.titleRow = new TitleRow(this.titleState(), this.titleCallbacks());
    this.card.appendChild(this.titleRow.root);
    // SAD-69: the toolbar P3-08 specified and that never existed. Built once here and
    // refreshed through update() on every render — rebuilding would drop focus and caret.
    this.toolbarView = new Toolbar({ ...this.toolbarState(), callbacks: this.toolbarCallbacks() });
    this.card.appendChild(this.toolbarView.root);
    this.body = document.createElement('div');
    this.body.className = 'tablify__body';
    this.card.appendChild(this.body);
    // P8-04: a change in any table (a target renamed, a row deleted) redraws link markers here.
    this.linkUnsub = linkIndexFor(this.app).onChange(() => {
      if (this.session) this.renderGrid();
    });
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
    // A (re)loaded file starts with nothing selected, like the prototype's switchTable().
    this.rowSelection = new Set();
    this.titleRow?.update(this.titleState());
    this.publishLive();
    this.renderGrid();
  }

  /** Obsidian calls this after the file is renamed or moved; keep the title and chip in step. */
  async onRename(file: TFile): Promise<void> {
    await super.onRename(file);
    this.titleRow?.update(this.titleState());
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
    this.rowSelection = new Set();
    if (this.body) this.body.empty();
    this.syncToolbar();
  }

  async onClose(): Promise<void> {
    const path = this.file?.path;
    this.clear();
    this.linkUnsub?.();
    this.linkUnsub = null;
    if (path) linkIndexFor(this.app).dropLive(path);
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
    // SAD-100: the Options freeze switch shows the *effective* state (the viewport default
    // follows the pane width), so its toggle inverts exactly what the user sees. The write
    // goes to the stored view via setFrozenColumns as an explicit 'fixed' choice.
    const paneWidth = this.grid?.currentPaneWidth ?? (this.contentEl.clientWidth || 800);
    return {
      fields: s.getFields(),
      view: { ...view, frozenColumns: effectiveFrozenColumns(view, paneWidth) },
      visibleRowCount: s.getDisplayRows().length,
      totalRowCount: s.store.getAllRows().length,
      // SAD-113: every field, hidden ones included (the field count is about the table, not the view).
      totalFieldCount: s.getFields().length,
      // SAD-80: only rows that still exist count (prototype selectedCount).
      selectedCount: [...this.rowSelection].filter((id) => s.store.getRow(id) !== undefined).length,
      search: view.search ?? '',
      query: view.query ?? '',
      queryError: s.getFilterError(),
      theme,
    };
  }

  /** Push the current model state into the toolbar without rebuilding it. */
  // ---- title row (SAD-77) ----

  private titleState(): TitleRowState {
    return { title: this.file?.basename ?? '' };
  }

  private titleCallbacks(): TitleRowCallbacks {
    return {
      onRename: (name) => this.renameTable(name),
      onInvalidName: (message) => new Notice(message),
      onExport: () => void this.openExport(),
    };
  }

  /** Rename the table file in place (same folder, same extension) through Obsidian's file manager. */
  private async renameTable(name: string): Promise<boolean> {
    const file = this.file;
    if (!file) return false;
    const folder = file.path.slice(0, file.path.length - file.name.length);
    const newPath = `${folder}${name}.${file.extension}`;
    if (newPath === file.path) return true;
    if (this.app.vault.getAbstractFileByPath(newPath)) {
      new Notice(`A file named "${name}.${file.extension}" already exists in this folder.`);
      return false;
    }
    try {
      await this.app.fileManager.renameFile(file, newPath);
      return true;
    } catch (e) {
      new Notice(`Could not rename the table: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  /** The rows and fields exactly as shown: view sort, live search and query, visible columns. */
  private currentViewTable(): ExportTable | null {
    const s = this.session;
    if (!s) return null;
    return { name: this.file?.basename ?? s.toFile().name, fields: s.getVisibleFields(), rows: s.getDisplayRows() };
  }

  /** Export… opens the existing Export modal. It reads the file, so pending edits are saved first. */
  private async openExport(): Promise<void> {
    const file = this.file;
    if (!file) return;
    if (this.session) await this.save();
    openExportModal(this.app, file);
  }

  /**
   * Export current view as CSV (SAD-98 command target; was the title-row Export CSV button).
   * The current view, sent to the same explicit external save destination as the Export modal.
   */
  async exportCurrentViewCsv(): Promise<void> {
    const file = this.file;
    if (!file || !this.session) return;

    const runtime = browserExportSaveRuntime(typeof Platform === 'undefined' ? false : Platform.isMobile);
    const pickerStart = beginExportSave(exportFileName(file.basename, 'csv'), exportMimeType('csv'), runtime);
    const picker = await pickerStart;
    if (picker.kind === 'cancelled') {
      new Notice('Export cancelled. No file was saved.');
      return;
    }

    const table = this.currentViewTable();
    if (!table) return;
    let artifact;
    try {
      artifact = await buildExportArtifact(table, 'csv', file.basename);
    } catch (error) {
      new Notice(`Export failed. No file was saved. ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    const saved = await saveExportArtifact(artifact, runtime, Promise.resolve(picker));
    if (!saved.ok) {
      if (!saved.cancelled) new Notice(`Export failed. No file was saved. ${saved.error}`);
      else new Notice('Export cancelled. No file was saved.');
      return;
    }
    new Notice(exportSuccessMessage(saved.method, saved.fileName, table.rows.length, table.fields.length));
  }

  /**
   * Copy current view as Markdown (SAD-98 command target; was the title-row Copy Markdown
   * button). The current view as a Markdown table on the system clipboard.
   */
  async copyCurrentViewMarkdown(): Promise<void> {
    const table = this.currentViewTable();
    if (!table) return;
    const markdown = toMarkdown(table);
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(markdown);
      new Notice(`Copied ${table.rows.length} ${table.rows.length === 1 ? 'row' : 'rows'} as a Markdown table.`);
    } catch {
      new Notice('Could not copy to the clipboard.');
    }
  }

  private syncToolbar(): void {
    this.toolbarView?.update(this.toolbarState());
  }

  private toolbarCallbacks(): ToolbarCallbacks {
    return {
      // Search and query are persisted but not undoable — see patchView().
      // SAD-78: one "Search or query" box, split into the persisted halves; one patch, one render.
      onFilter: (search, query) => this.applyFilter({ search, query }),
      onSync: () => this.openSync(),
      onOpenFilter: () => this.openFilterBuilder(),
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
      // SAD-81: Options → Fields → Hide; the primary field is refused (R-D13), as in the header menu.
      onHideField: (fieldId) => this.applyViewChange((view, fields) => hideField(view, fieldId, fields)),
      // SAD-81: Group by and the multi-sort list are layout changes — undoable, like the header's.
      onGroupBy: (fieldId) => this.applyViewChange((view, fields) => setGroupBy(view, fieldId, fields)),
      onSortChange: (sort) => this.applyViewChange((view, fields) => setSort(view, sort, fields)),
      onClearFilters: () => {
        this.applyFilter({ search: '', query: '' });
        // SAD-81: prototype `optClearFilters` toast.
        new Notice('Search & filters cleared');
      },
      onUndo: () => this.mutate((s) => s.undo()),
      onRedo: () => this.mutate((s) => s.redo()),
      onDeleteSelected: () => this.deleteSelectedRows(),
    };
  }

  // ---- row selection and reorder (SAD-80) ----

  /** Meta-row Delete (prototype `deleteSelectedRows`): one undo step, then the selection clears. */
  private deleteSelectedRows(): void {
    const s = this.session;
    if (!s || this.rowSelection.size === 0) return;
    const deleted = s.deleteRows([...this.rowSelection]);
    this.rowSelection = new Set();
    if (deleted > 0) new Notice(`Deleted ${deleted} ${deleted === 1 ? 'row' : 'rows'}`);
    this.afterChange();
  }

  /**
   * SAD-114: Shift-click adds the rows from the anchor to this row. Ctrl/Cmd-click flips this
   * row; Shift-click with no anchor just selects it. Rows in collapsed groups are not in
   * `displayRows()`, so they are skipped.
   */
  private onRowModifierClick(rowIndex: number, mods: { shift: boolean; toggle: boolean }): void {
    const rows = this.displayRows();
    const row = rows[rowIndex];
    if (!row) return;
    const ids = rows.map((r) => r.id);
    if (mods.shift && this.selectionAnchor && ids.includes(this.selectionAnchor)) {
      this.showRowSelection(addRowRange(this.rowSelection, ids, this.selectionAnchor, row.id));
    } else {
      this.showRowSelection(toggleRow(this.rowSelection, row.id, mods.toggle ? undefined : true));
    }
    this.selectionAnchor = row.id;
  }

  /** Re-show the selection without touching the model: no save, no undo entry, no re-render. */
  private showRowSelection(next: ReadonlySet<string>): void {
    this.rowSelection = next;
    this.grid?.setRowSelection(next);
    this.syncToolbar();
  }

  /** Why rows cannot be dragged now — the prototype's two toasts — or null. */
  private rowMoveBlocked(): string | null {
    const view = this.session?.getView();
    if (!view) return null;
    if (view.sort.length > 0) return 'Clear sorting to reorder rows manually';
    if (view.groupBy) return 'Disable grouping to reorder rows manually';
    return null;
  }

  /** Toolbar Sync: the plugin's sync entry point, same as the command. */
  private openSync(): void {
    if (!this.hooks.openSync) {
      new Notice('Airtable sync is not available here.');
      return;
    }
    this.hooks.openSync(this);
  }

  /** Toolbar Filter: the builder reads the box's text and writes the result back into it. */
  private openFilterBuilder(): void {
    const s = this.session;
    const toolbar = this.toolbarView;
    if (!s || !toolbar) return;
    new FilterBuilderModal(this.app, s.getFields(), toolbar.getFilterText(), (input) =>
      toolbar.setFilterText(input),
    ).open();
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
    const s = this.session;
    const selfId = s.toFile().tableId;
    const others = linkIndexFor(this.app).index
      .tables()
      .filter((t) => t.tableId !== selfId)
      .map((t) => ({ tableId: t.tableId, name: t.name }));
    const selfName = this.file?.basename ?? 'This table';
    new AddFieldModal(
      this.app,
      (name, type, formula, linkTableId, extras) => {
        if (!this.session) return;
        // SAD-86: extras (options, validation rules) only when the dialog set any.
        if (extras) this.session.addField(name, type, formula, linkTableId, extras);
        else this.session.addField(name, type, formula, linkTableId);
        this.afterChange();
      },
      {
        linkTargets: [{ tableId: selfId, name: selfName }, ...others],
        defaultLinkTableId: selfId,
        // SAD-86: "Preview (row 1)" — evaluated on a throwaway engine, never on the live table.
        formulaPreview: (expression) => {
          const firstId = s.store.getDisplayOrder()[0];
          return previewFormula(s.store.getFields() as FieldDefinition[], firstId === undefined ? undefined : s.store.getRow(firstId), expression);
        },
      },
    ).open();
  }

  /**
   * COD-67: open the field editor on an existing field. The editor offers only types the
   * change planner accepts, so what the window lets the user pick and what session.editField
   * will do cannot disagree.
   */
  private promptEditField(fieldId: string): void {
    if (!this.session) return;
    const s = this.session;
    const field = s.getFields().find((f) => f.id === fieldId);
    if (!field) return;
    const selfId = s.toFile().tableId;
    const selfName = this.file?.basename ?? 'This table';
    const others = linkIndexFor(this.app).index
      .tables()
      .filter((t) => t.tableId !== selfId)
      .map((t) => ({ tableId: t.tableId, name: t.name }));
    const modal = new FieldEditorModal(
      this.app,
      () => {},
      {
        mode: 'edit',
        // COD-69: the whole field, so every row the create window draws is pre-filled.
        initial: { field },
        canPickType: (type) => planTypeChange(s.store.getAllRows(), field, type).ok,
        linkTargets: [{ tableId: selfId, name: selfName }, ...others],
        formulaPreview: (expression) => {
          const firstId = s.store.getDisplayOrder()[0];
          return previewFormula(
            s.store.getFields() as FieldDefinition[],
            firstId === undefined ? undefined : s.store.getRow(firstId),
            expression,
          );
        },
        getField: () => s.getField(fieldId),
        onManageOptions: () =>
          this.openOptionManager(s.getField(fieldId) ?? field, () => modal.refreshOptionSummary()),
        onEdit: (edit) => {
          const result = s.editField(field.id, edit);
          if (!result.ok) new Notice(result.reason);
          this.afterChange();
        },
      },
    );
    modal.open();
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
    this.publishLive();
    this.renderGrid();
    this.requestSave();
  }

  /** P8-04: publish this table's live state to the vault link index (unsaved edits included). */
  private publishLive(): void {
    const s = this.session;
    const path = this.file?.path;
    if (!s || !path) return;
    linkIndexFor(this.app).noteLive(path, snapshotTable(s.toFile(), path));
  }

  /** Sync hooks (P7-10). The sync modal works on this view's session and saves through the view. */
  syncSession(): TableSession | null {
    return this.session;
  }

  afterSyncChange(): void {
    this.afterChange();
  }

  private renderGrid(): void {
    // SAD-80: a deleted (or undone) row leaves the selection before anything shows it.
    if (this.session) {
      this.rowSelection = pruneSelection(this.rowSelection, this.session.store.getDisplayOrder());
    }
    // Refresh the toolbar on every render: row counts, hidden fields, row height, theme and
    // the persisted search/query all feed it. Runs before the guard so it also resets when
    // the session goes away.
    this.syncToolbar();
    if (!this.session || !this.body) return;
    const s = this.session;
    const grouped = this.groupedRows();
    const rows = grouped.rows;
    const groups = grouped.groups;
    const fields = s.getVisibleFields();
    const theme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    // SAD-71 Step 6: keep the view surface (card tokens) and the grid on the active theme
    // even when the host flips mode without a model change.
    applyTheme(this.contentEl, theme);
    if (!this.grid) {
      this.body.empty();
      this.grid = new GridView({
        rows,
        fields,
        view: s.getView(),
        theme,
        viewportWidth: this.contentEl.clientWidth || 800,
        // SAD-100: a pane-width change can flip the viewport freeze default — mirror the new
        // effective state into the Options switch.
        onPaneWidthChange: () => this.syncToolbar(),
        onCellClick: () => this.grid?.root.focus(),
        // SAD-96: on touch the second tap on the selected cell opens the editor — the
        // documented gesture where there is no Enter key. Mouse editing is double-click.
        onCellReselect: (row, col) => {
          this.grid?.root.focus();
          if (this.lastPointerType === 'touch') this.startEdit({ row, col });
        },
        // SAD-96: double-click (the README's documented gesture) opens the cell's editor.
        onCellActivate: (row, col) => this.startEdit({ row, col }),
        // COD-71: a checkbox cell is a real box; one click is one undo step, saved like any edit.
        onToggleCheckbox: (row, col) => {
          const s = this.session;
          if (!s) return;
          const rowData = this.displayRows()[row];
          const field = s.getVisibleFields()[col];
          if (!rowData || !field || field.type !== 'checkbox') return;
          s.setValue(rowData.id, field.id, rowData.values[field.id] !== true);
          this.afterChange();
        },
        // P8-03: formula cells show their error code, with the reason in the tooltip.
        formulaError: (rowId, fieldId) => this.session?.getFormulaError(rowId, fieldId) ?? null,
        // P8-04: resolved row names for link cells; broken links are counted for the marker.
        linkSummary: (value) => summarizeLinks(value, linkIndexFor(this.app).index),
        // SAD-79: prototype header capsule controls. Every one writes through setView(), so
        // each sort, resize and reorder is a single undo step, like the header menu's.
        onSortClick: (col, additive) => {
          const field = this.session?.getVisibleFields()[col];
          if (field) this.applyViewChange((view, all) => cycleHeaderSort(view, field.id, additive, all));
        },
        onHeaderMenu: (col, pos) => this.openHeaderMenu(col, pos),
        // COD-67: clicking the field opens its editor (the ticket's first requirement).
        onHeaderActivate: (col) => {
          const field = this.session?.getVisibleFields()[col];
          if (field) this.promptEditField(field.id);
        },
        onColumnResize: (fieldId, width) =>
          this.applyViewChange((view, all) => resizeColumn(view, fieldId, width, all)),
        onColumnMove: (fieldId, targetId) =>
          this.applyViewChange((view, all) => moveColumnOnto(view, fieldId, targetId, all)),
        // SAD-79 (S-6): the Insert Row pill lives inside the shell (prototype #insertRowWrap)
        // and the grid shrinks to its content, so the empty-state hint is retired.
        onInsertRow: () => this.mutate((st) => st.addRow()),
        // SAD-114: Shift / Ctrl-click on a row selects rows (the row menu does the rest).
        onRowModifierClick: (rowIndex, mods) => this.onRowModifierClick(rowIndex, mods),
        // SAD-80: `#`-cell drag to reorder.
        onRowMove: (rowId, beforeRowId) => {
          if (this.session?.moveRowBefore(rowId, beforeRowId)) {
            new Notice('Row moved');
            this.afterChange();
          }
        },
        rowMoveBlocked: () => this.rowMoveBlocked(),
        onRowMoveBlocked: (reason) => new Notice(reason),
        // SAD-81: Options → Group by headers; a click collapses or expands one group.
        groups,
        onToggleGroup: (key) => this.toggleGroup(key),
      });
      this.grid.setRowSelection(this.rowSelection);
      this.body.appendChild(this.grid.root);
      this.grid.root.tabIndex = 0;
      this.grid.root.addEventListener('keydown', (e) => this.onKeyDown(e));
      this.grid.root.addEventListener('contextmenu', (e) => this.onContextMenu(e));
      this.wirePressEvents(this.grid.root);
    } else {
      this.grid.setTheme(theme);
      this.grid.setModel(rows, fields, s.getView(), groups);
      this.grid.setRowSelection(this.rowSelection);
    }
  }

  // ---- group by (SAD-81) ----

  /**
   * The display rows grouped by `view.groupBy`, collapsed groups left out. Without a groupBy
   * (or with a field that no longer exists) this is exactly session.getDisplayRows() with no
   * groups, so every flat-grid path is unchanged.
   */
  private groupedRows(): { rows: Row[]; groups: GroupedRows['groups'] | null } {
    const s = this.session;
    if (!s) return { rows: [], groups: null };
    const rows = s.getDisplayRows();
    const view = s.getView();
    const field = view.groupBy ? s.getField(view.groupBy) : undefined;
    if (!field) return { rows, groups: null };
    return groupRows(rows, field, view.collapsedGroups ?? []);
  }

  /** Rows by grid row index — the grid, keyboard, menus and editors all address these. */
  private displayRows(): Row[] {
    return this.groupedRows().rows;
  }

  /**
   * Group header click (prototype `toggleGroup`). Persisted with the view but not undoable —
   * like search, it is a reading aid, not an edit. An empty list drops the key.
   */
  private toggleGroup(key: string): void {
    const s = this.session;
    if (!s) return;
    const next = toggleCollapsed(s.getView().collapsedGroups, key);
    // undefined, not [], so the key leaves the file once every group is open again.
    s.patchView({ collapsedGroups: next.length > 0 ? next : undefined });
    // The selected cell's row index may now point at another row.
    this.grid?.setSelection(null);
    this.afterChange();
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
      const rowCount = this.displayRows().length;
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
    // that follows is ignored, so the menu does not open twice (P5-03). The dedupe window is
    // armed by touch presses only (SAD-97): a mouse or pen right-click always opens the menu,
    // even right after a click. When the event reports its input device (Chromium), only
    // touch-originated menus are suppressed; elsewhere the time window decides.
    const caps = (e as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } | null })
      .sourceCapabilities;
    const touchOriginated = caps ? caps.firesTouchEvents === true : true;
    if (touchOriginated && Date.now() - this.lastTouchAt < 1500) {
      e.preventDefault();
      return;
    }
    const target = e.target as HTMLElement | null;
    // Inside the grid's table surface (header + body) the prototype replaces the native menu
    // entirely (SAD-97); chrome such as the Insert Row pill keeps the platform menu.
    const inTable = !!target?.closest?.('.tablify__header, .tablify__viewport');
    if (this.openMenuFromTarget(target, e) || inTable) e.preventDefault();
  }

  /**
   * Open the header, cell or row menu for a DOM target. Returns false when the target is
   * neither. SAD-97: a row target (the `#` lead, the row itself) opens the row
   * menu — the prototype does this for any `tr[data-row]`.
   */
  private openMenuFromTarget(target: HTMLElement | null, pos: MouseEvent | { x: number; y: number }): boolean {
    if (!this.grid) return false;
    const headerCell = target?.closest?.('.tablify__header-cell') as HTMLElement | null;
    if (headerCell) {
      this.openHeaderMenu(Number(headerCell.dataset.colIndex), pos);
      return true;
    }
    const cell = target?.closest?.('.tablify__cell') as HTMLElement | null;
    if (cell) {
      const row = Number((cell.parentElement as HTMLElement).dataset.rowIndex);
      const col = Number(cell.dataset.colIndex);
      this.grid.setSelection({ row, col });
      this.openCellMenu(row, col, pos);
      return true;
    }
    const rowEl = target?.closest?.('.tablify__row') as HTMLElement | null;
    if (rowEl) {
      const row = Number(rowEl.dataset.rowIndex);
      if (!Number.isNaN(row)) {
        this.openRowMenu(row, pos);
        return true;
      }
    }
    return false;
  }

  // ---- touch long press (P5-03) ----

  private wirePressEvents(root: HTMLElement): void {
    root.addEventListener('pointerdown', (e) => {
      // Reset on every press, so a long press that gets no click cannot swallow the next click.
      this.suppressClick = false;
      this.lastPointerType = e.pointerType || 'mouse';
      if (this.editing || e.pointerType !== 'touch') return;
      this.lastTouchAt = Date.now();
      this.pressTarget = e.target as HTMLElement | null;
      this.press.pointerDown(e.clientX, e.clientY, e.pointerType);
    });
    root.addEventListener('pointermove', (e) => this.press.pointerMove(e.clientX, e.clientY));
    root.addEventListener('pointerup', (e) => {
      // SAD-97: only touch stamps the dedupe window; a mouse click must never suppress a
      // right-click that follows it.
      if (e.pointerType === 'touch') this.lastTouchAt = Date.now();
      this.suppressClick = this.press.pointerUp() || this.suppressClick;
    });
    root.addEventListener('pointercancel', (e) => {
      if (e.pointerType === 'touch') this.lastTouchAt = Date.now();
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
    const rowData = this.displayRows()[row];
    const field = this.session.getVisibleFields()[col];
    if (!rowData || !field) return;
    const value = rowData.values[field.id];
    const entries = cellMenu(
      {
        readOnly: isReadOnly(field),
        cellEmpty: isEmptyValue(value),
        hasClipboard: this.clipboardText !== null,
        isLink: field.type === 'link',
        foreignLinks: field.type === 'link' ? countForeignRefs(value, field.linkTableId) : 0,
      },
      this.rowSelection.has(rowData.id),
    );
    this.showMenu(entries, { row, col }, pos);
  }

  /** SAD-97: row targets (the `#` lead) open the row items, as the prototype's `tr` menu. */
  private openRowMenu(row: number, pos: MouseEvent | { x: number; y: number }): void {
    if (!this.session) return;
    const rowData = this.displayRows()[row];
    if (!rowData) return;
    this.showMenu(rowEntries(this.rowSelection.has(rowData.id)), { row, col: 0 }, pos);
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
      fieldType: field.type,
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
    const rows = this.displayRows();
    const fields = s.getVisibleFields();

    if (id.startsWith('cell.') || id.startsWith('row.')) {
      const row = rows[t.row];
      const field = fields[t.col];
      if (!row || !field) return;
      switch (id) {
        case 'cell.edit':
          // SAD-96: opens the editor / panel / picker for this cell's type.
          this.startEdit({ row: t.row, col: t.col });
          return;
        case 'cell.copy':
          this.copyText(formatValue(row.values[field.id], field));
          return;
        case 'cell.paste':
          this.pasteInto(row, field);
          return;
        case 'cell.links':
          this.openLinkPicker(row.id, field);
          return;
        case 'cell.removeForeign': {
          // P8-04 follow-up (R-5): drop links to other tables. Goes through setValue, so it can be undone.
          const current = s.store.getRow(row.id)?.values[field.id];
          if (Array.isArray(current)) {
            s.setValue(row.id, field.id, removeForeignRefs(current as LinkRef[], field.linkTableId));
          }
          return;
        }
        case 'cell.clear':
          s.setValue(row.id, field.id, null);
          break;
        case 'row.select':
          // SAD-114: the row menu's selection item (no undo entry, no save).
          this.showRowSelection(toggleRow(this.rowSelection, row.id));
          this.selectionAnchor = row.id;
          return;
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
      case 'header.modify': {
        // COD-67/COD-69: the header menu opens the same window Add field uses, pre-filled.
        this.promptEditField(field.id);
        return;
      }
      case 'header.formula': {
        // P8-03: Edit formula. Save goes through the command path, so undo works.
        const current = field.formula ?? '';
        new FormulaEditModal(this.app, current, (expression) => {
          const result = s.setFormula(field.id, expression);
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
        // SAD-100: the header Freeze item is a deliberate choice at every pane width.
        s.setView({ ...s.getView(), frozenColumns: t.col + 1, freezeMode: 'fixed' });
        break;
      default:
        return;
    }
    this.afterChange();
  }

  private pasteInto(row: Row, field: FieldDefinition): void {
    // P8-04: pasted text cannot name a row ID, so it never changes a link cell.
    if (field.type === 'link') {
      new Notice('Use Choose linked rows to change links.');
      return;
    }
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

  // ---- link picker (P8-04) ----

  /** Row picker for a link cell. Save goes through setValue, so it is undoable and saved with the file. */
  private openLinkPicker(rowId: string, field: FieldDefinition): void {
    const s = this.session;
    if (!s) return;
    const stored = s.store.getRow(rowId);
    if (!stored) return;
    const value = stored.values[field.id];
    const current: LinkRef[] = Array.isArray(value) ? (value as LinkRef[]) : [];
    new LinkPickerModal({
      app: this.app,
      field,
      current,
      index: linkIndexFor(this.app).index,
      onSave: (refs) => {
        s.setValue(rowId, field.id, refs);
        this.afterChange();
      },
    }).open();
  }

  // ---- inline editing ----

  /** Open the inline editor over the selected cell. Commit goes through the command stack. */
  private startEdit(sel: GridSelection): void {
    const s = this.session;
    const grid = this.grid;
    if (!s || !grid || this.editing) return;
    const rows = this.displayRows();
    const fields = s.getVisibleFields();
    const row = rows[sel.row];
    const field = fields[sel.col];
    if (!row || !field) return;
    const storeRow = s.store.getRow(row.id);
    if (!storeRow) return;
    // P8-04: link cells are changed in the row picker, never in an inline editor.
    if (field.type === 'link') {
      this.openLinkPicker(row.id, field);
      return;
    }

    grid.scrollToRow(sel.row);
    const cell = this.cellElement(sel);
    // Step 11: select and attachment cells open the prototype's anchored float panel.
    if (field.type === 'single_select' || field.type === 'multi_select' || field.type === 'attachment') {
      if (cell) this.openCellPanel(row.id, field, cell);
      return;
    }
    const editor = createEditor(field, storeRow, s.store, s.stack, (committed) => {
      this.editing = null;
      editor?.remove();
      if (committed) this.publishLive();
      this.renderGrid();
      grid.root.focus();
      if (committed) this.requestSave();
    });
    if (!editor || !cell) return;
    this.editing = editor;
    editor.style.position = 'absolute';
    const rootRect = grid.root.getBoundingClientRect();
    // SAD-79: the visible cell is the capsule inside the slot; edit over it.
    const cellRect = (cell.querySelector<HTMLElement>('.tablify__capsule') ?? cell).getBoundingClientRect();
    // Absolute offsets start inside the root's border (SAD-85: the outline showed a 1px shift).
    editor.style.left = `${cellRect.left - rootRect.left - grid.root.clientLeft + grid.root.scrollLeft}px`;
    editor.style.top = `${cellRect.top - rootRect.top - grid.root.clientTop + grid.root.scrollTop}px`;
    editor.style.width = `${cellRect.width}px`;
    editor.style.height = `${cellRect.height}px`;
    grid.root.appendChild(editor);
  }

  // ---- cell panels (Step 11): select, attachment, option manager ----

  /** Theme of the host surface, as the modals elsewhere read it. */
  private isDark(): boolean {
    return document.body.classList.contains('theme-dark');
  }

  /**
   * The prototype's `#floatPanel` screens for `single_select` / `multi_select` /
   * `attachment` cells (`renderSelectPanel` ~895, `openAttachmentPanel` ~987).
   *
   * The panel lives in `document.body`, not in the grid: re-rendering the grid after each write
   * must not take the panel down with it (multi-select stays open). Every write goes through
   * `setValue` or an option command, so each change is exactly one undo step.
   */
  private openCellPanel(rowId: string, field: FieldDefinition, cell: HTMLElement): void {
    const s = this.session;
    const grid = this.grid;
    if (!s || !grid) return;
    const anchor = cell.querySelector<HTMLElement>('.tablify__capsule') ?? cell;
    const value = (): CellValue => s.store.getRow(rowId)?.values[field.id] ?? null;
    const closePanel = (focusGrid = true): void => {
      panel.close();
      if (focusGrid) grid.root.focus();
    };

    if (field.type === 'attachment') {
      const panel = new AttachmentPanel({
        field,
        value: value(),
        theme: this.isDark() ? 'dark' : 'light',
        checkPath: (raw) => checkAttachmentPath(raw, this.app.vault),
        onAdd: (raw) => {
          const path = normalizeAttachmentPath(raw);
          if (!path) return;
          s.setValue(rowId, field.id, path);
          panel.setValue(path);
          this.afterChange();
        },
        onRemove: () => {
          s.setValue(rowId, field.id, null);
          panel.setValue(null);
          this.afterChange();
        },
        onDismiss: () => closePanel(),
      });
      panel.open(anchor);
      return;
    }

    /** Write the cell (one undo step) and keep the panel in step with the new value. */
    const write = (next: CellValue, close: boolean): void => {
      s.setValue(rowId, field.id, next);
      this.afterChange();
      if (close) closePanel();
      else panel.setValue(next);
    };
    /** Prototype `selectPanelPick`: set for single, toggle for multi. */
    const pick = (option: SelectOption): void => {
      if (field.type === 'multi_select') {
        const ids = Array.isArray(value()) ? (value() as string[]).map(String) : [];
        const next = ids.includes(option.id)
          ? ids.filter((id) => id !== option.id)
          : [...ids, option.id];
        write(next.length ? next : null, false);
      } else {
        write(option.id, true);
      }
    };

    const panel = new SelectDropdown({
      field,
      value: value(),
      theme: this.isDark() ? 'dark' : 'light',
      onSelect: pick,
      /**
       * Prototype `selectPanelCreate`: the new option and the cell write land in one undo step, so
       * one undo takes back both. The option colour and the case-insensitive dedup come from the
       * model (`planOptionAdd`).
       */
      createOption: (name) => {
        const live = s.getField(field.id) ?? field;
        const plan = planOptionAdd(name, live);
        const next = plan.created
          ? field.type === 'multi_select'
            ? [...(Array.isArray(value()) ? (value() as string[]).map(String) : []), plan.option.id]
            : plan.option.id
          : value();
        const before = {
          field: { ...live, options: (live.options ?? []).map((o) => ({ ...o })) },
          valuesByRow: { [rowId]: value() },
        };
        const after = {
          field: { ...live, options: plan.options },
          valuesByRow: { [rowId]: next },
        };
        s.stack.execute(createSetFieldOptionsCommand({ before, after }));
        this.afterChange();
        panel.setField(s.getField(field.id) ?? live);
        if (plan.created) new Notice(`Created option "${plan.option.name}"`);
        return plan.option;
      },
      // `createOption` already wrote the cell, so only the panel's own state is left to settle.
      onCreate: () => {
        panel.setValue(value());
        if (field.type !== 'multi_select') closePanel();
      },
      onClear: () => {
        s.setValue(rowId, field.id, null);
        this.afterChange();
      },
      onManageOptions: () => this.openOptionManager(field),
      onDismiss: () => closePanel(),
    });
    panel.open(anchor);
  }

  /**
   * Prototype `#optMgrModal`: rename / recolor / reorder / delete / add. Each change is one undo
   * step — `apply` carries it through the command stack, the same shape as a delete-option command,
   * whose cells are cleared by `planOptionRemoval` (R-D12).
   */
  private openOptionManager(field: FieldDefinition, onClose?: () => void): void {
    const s = this.session;
    if (!s) return;
    new OptionManagerDialog(field, s.store, {
      onClose,
      apply: (options, values) => {
        const live = s.getField(field.id) ?? field;
        const before = {
          field: { ...live, options: (live.options ?? []).map((o) => ({ ...o })) },
          valuesByRow: Object.fromEntries(
            Object.keys(values).map((rowId) => [rowId, (s.store.getRow(rowId)?.values[field.id] ?? null) as CellValue]),
          ),
        };
        s.stack.execute(
          createSetFieldOptionsCommand({
            before,
            after: { field: { ...live, options }, valuesByRow: values },
          }),
        );
      },
      onChanged: () => this.afterChange(),
    }, { stacked: onClose !== undefined }).open();
  }
}

function exportSuccessMessage(
  method: 'picker' | 'share' | 'download',
  fileName: string,
  rowCount: number,
  columnCount: number,
): string {
  if (method === 'picker') return `Exported ${rowCount} rows and ${columnCount} columns to ${fileName} in the selected location.`;
  if (method === 'share') return `Shared ${rowCount} rows and ${columnCount} columns as ${fileName}.`;
  return `Download started: ${fileName} (${rowCount} rows, ${columnCount} columns).`;
}

function formatValue(value: CellValue | undefined, field: FieldDefinition): string {
  return getFieldType(field.type).format(value ?? null, field);
}

function isEmptyValue(v: CellValue | undefined): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}
