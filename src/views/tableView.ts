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
import { createDefaultView, effectiveFrozenColumns, MOBILE_PANE_MAX_WIDTH } from '../model/view.js';
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
import { cellOverflowConfig, type TablifySettings } from '../settings.js';
import { DEFAULT_OVERFLOW_CONFIG, offersOverflow, type CellOverflowConfig } from './grid/cellOverflow.js';
import { ExportShareRetryModal, deviceExportRuntime, openExportModal } from '../commands/export.js';
import {
  beginExportSave,
  exportDeliveryMethod,
  saveExportArtifact,
  shareExportArtifact,
} from '../io/export/destination.js';
import { buildExportArtifact, exportFileName, exportMimeType } from '../io/export/exporter.js';
import { toMarkdown } from '../io/export/markdown.js';
import type { ExportTable } from '../io/export/view.js';
import { FilterBuilderModal } from './grid/FilterBuilderModal.js';
import { SelectDropdown } from './grid/select/Dropdown.js';
import { OptionManagerDialog } from './grid/select/OptionManager.js';
import { AttachmentPanel } from './grid/AttachmentPanel.js';
import { AttachmentMenu } from './grid/AttachmentMenu.js';
import { ImagePreviewModal } from './grid/ImagePreviewModal.js';
import { DatePicker } from './grid/date/DatePicker.js';
import { PhonePanel } from './grid/phone/PhonePanel.js';
import { RatingPanel } from './grid/rating/RatingPanel.js';
import { readerLocale } from '../model/phone/phoneValue.js';
import { equivalentStored } from './grid/date/draft.js';
import {
  checkAttachmentPath,
  isAttachmentValueEmpty,
  isRemoteAttachmentPath,
  normalizeAttachmentPath,
  resolveAttachmentImageUrl,
} from './grid/attachment.js';
import { importPickedFile, pickFileFromDevice, type AttachmentVaultIo } from './grid/attachmentImport.js';
import { createSetFieldOptionsCommand } from '../model/commands.js';
import { planOptionAdd } from '../model/selectOptions.js';
import type { SelectOption } from '../model/types.js';

/** Plugin-level services the view cannot reach itself (it has no access to plugin settings). */
export interface TableViewHooks {
  /** Open the Airtable sync modal for this view — the "Airtable sync for this table" command. */
  openSync?(view: TableView): void;
  /**
   * SAD-376: the plugin settings, read when the grid is (re)rendered. This view has no handle on
   * the plugin, so the hook is the channel — the same reason `openSync` exists.
   */
  readSettings?(): TablifySettings;
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
  /** SAD-305: grid coordinates of the open inline editor, so keyboard resizes keep it in view. */
  private editingCell: GridSelection | null = null;
  /** SAD-305: removes the visualViewport resize/scroll listeners wired while an editor is open. */
  private unwireEditingViewport?: () => void;
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
  /** COD-77: removes the document-level outside-press listener (wired in renderGrid). */
  private unwireOutsideTapClear?: () => void;
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

  /**
   * COD-74: the tab / file-explorer glyph. `View.icon` was never set, so Obsidian drew its own
   * generic file icon for every Tablify tab. `table` is the same Lucide id the file menu uses
   * for "Open Tablify Table". `View.getIcon()` returns this field.
   */
  readonly icon = 'table';

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
    this.syncMobileBottomInset();
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
    this.unwireOutsideTapClear?.();
    this.unwireOutsideTapClear = null;
    this.unwireEditingViewport?.();
    this.unwireEditingViewport = undefined;
    this.grid?.destroy();
    this.grid = null;
    this.session = null;
    this.editing = null;
    this.editingCell = null;
    this.menuTarget = null;
    this.rowSelection = new Set();
    if (this.body) this.body.empty();
    this.syncMobileBottomInset();
    this.syncLayoutFloor();
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
    this.handleViewportResize();
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
    // COD-72: the Options switch shows the *effective* state — on a narrow pane the primary
    // column is not rendered frozen, so the switch reads off and is disabled instead of
    // pretending a click would do something. The write always targets the stored 0/1 flag.
    const paneWidth = this.grid?.currentPaneWidth ?? (this.contentEl.clientWidth || 800);
    return {
      fields: s.getFields(),
      view: { ...view, frozenColumns: effectiveFrozenColumns(view, paneWidth) },
      freezeUnavailable: paneWidth <= MOBILE_PANE_MAX_WIDTH,
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

    const runtime = deviceExportRuntime(this.app, file);

    // SAD-350: on a share-destination device (iOS), build the CSV from the in-memory view —
    // synchronous work, so the command's tap still holds user activation for the share call.
    // A lost-activation refusal falls back to the retry modal with the already-built file.
    if (exportDeliveryMethod(runtime) === 'share') {
      const table = this.currentViewTable();
      if (!table) return;
      let artifact;
      try {
        artifact = await buildExportArtifact(table, 'csv', file.basename);
      } catch (error) {
        new Notice(`Export failed. No file was saved. ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      const shared = await shareExportArtifact(artifact, runtime);
      if (shared.ok) {
        new Notice(exportSuccessMessage('share', shared.fileName, table.rows.length, table.fields.length));
        return;
      }
      if (shared.kind === 'cancelled') {
        new Notice('Export cancelled. No file was saved.');
        return;
      }
      if (shared.kind === 'activation') {
        new ExportShareRetryModal(this.app, { artifact, rowCount: table.rows.length, columnCount: table.fields.length }, runtime).open();
        return;
      }
      new Notice(`Export failed. No file was saved. ${shared.error}`);
      return;
    }

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
    new Notice(exportSuccessMessage(saved.method, saved.fileName, table.rows.length, table.fields.length, saved.displayPath));
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
        // COD-76: the same verdict, with the sentence — a blocked type stays visible in the picker.
        typeBlockReason: (type) => {
          const plan = planTypeChange(s.store.getAllRows(), field, type);
          return plan.ok ? null : plan.reason;
        },
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

  /** SAD-376: the overflow configuration the grid renders with, from the plugin settings. */
  private overflowConfig(): CellOverflowConfig {
    return this.hooks.readSettings ? cellOverflowConfig(this.hooks.readSettings()) : DEFAULT_OVERFLOW_CONFIG;
  }

  /**
   * SAD-376: repaint after the overflow settings changed. Nothing is written, nothing is
   * saved and no model is touched — the grid simply re-reads which cells offer Expand.
   */
  refreshGrid(): void {
    this.renderGrid();
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
        // SAD-305: when the mobile keyboard shrinks or restores the grid shell, re-sync the
        // card floor and keep any open cell editor aligned and scrolled into view.
        onViewportResize: () => this.handleViewportResize(),
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
        onToggleCheckbox: (row, col) => this.toggleCheckboxAt(row, col),
        // SAD-304: a star in a rating cell is a one-click edit; read-only ratings stay decoration.
        onRate: (row, col, value) => this.rateAt(row, col, value),
        canRate: (field) => !isReadOnly(field),
        // SAD-347: inline image thumbnails in attachment cells and click-to-preview lightbox.
        resolveAttachmentUrl: (path) => resolveAttachmentImageUrl(path, this.app.vault),
        onPreviewAttachment: (path, url) => new ImagePreviewModal(this.app, { path, url }).open(),
        // SAD-376: which cells offer Expand, straight from the plugin settings.
        overflow: this.overflowConfig(),
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
      this.wireEditSwitchPress(this.grid.root);
      this.wireOutsideTapClear();
    } else {
      this.grid.setTheme(theme);
      // SAD-376: a settings change reaches an already-open table through here; setOverflow only
      // repaints when something actually changed.
      this.grid.setOverflow(this.overflowConfig());
      this.grid.setModel(rows, fields, s.getView(), groups);
      this.grid.setRowSelection(this.rowSelection);
    }
    this.syncMobileBottomInset();
    this.syncLayoutFloor();
  }

  /**
   * SAD-307: detect whether the table view is running in a mobile context (Obsidian mobile,
   * narrow pane/viewport ≤ 639px, or coarse-pointer mobile landscape).
   */
  private isMobileContext(): boolean {
    if (typeof Platform !== 'undefined' && Platform.isMobile) return true;
    if (typeof document !== 'undefined') {
      if (
        document.body.classList.contains('is-mobile') ||
        document.body.classList.contains('is-phone')
      ) {
        return true;
      }
      if (document.querySelector('.mobile-navbar, .mobile-toolbar')) return true;
    }
    const paneW = this.contentEl.clientWidth;
    if (paneW > 0 && paneW <= MOBILE_PANE_MAX_WIDTH) return true;
    if (typeof window !== 'undefined') {
      if (window.innerWidth > 0 && window.innerWidth <= MOBILE_PANE_MAX_WIDTH) return true;
      if (
        window.innerHeight > 0 &&
        window.innerHeight <= MOBILE_PANE_MAX_WIDTH &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * SAD-307: measure how many pixels at the bottom of `.tablify-view` are covered by Obsidian's
   * native mobile bottom bar (`.mobile-navbar` / `.mobile-toolbar`) or `visualViewport`.
   */
  private measureMobileBottomBarOverlap(viewRect: DOMRect): number {
    let overlap = 0;
    if (typeof document !== 'undefined') {
      const bars = document.querySelectorAll<HTMLElement>('.mobile-navbar, .mobile-toolbar');
      for (const bar of Array.from(bars)) {
        if (bar.hidden || bar.getAttribute('aria-hidden') === 'true') continue;
        if (typeof getComputedStyle === 'function') {
          const cs = getComputedStyle(bar);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        }
        const barRect = bar.getBoundingClientRect();
        const barH = barRect.height || bar.offsetHeight || 0;
        if (barH <= 0) continue;
        if (viewRect.height > 0 && barRect.height > 0) {
          if (barRect.top < viewRect.bottom && barRect.bottom > viewRect.top) {
            overlap = Math.max(overlap, Math.max(0, Math.ceil(viewRect.bottom - barRect.top)));
          }
        } else {
          overlap = Math.max(overlap, Math.ceil(barH));
        }
      }
    }
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (viewRect.height > 0 && vv && vv.height > 0) {
      const vvOverlap = Math.max(0, Math.ceil(viewRect.bottom - (vv.offsetTop + vv.height)));
      overlap = Math.max(overlap, vvOverlap);
    }
    return overlap;
  }

  /**
   * SAD-307: expose the measured mobile bottom-bar / viewport overlap as
   * `--tablify-mobile-bottom-inset` on `.tablify-view` so CSS bottom padding keeps the card and
   * the Insert Row button above Obsidian's mobile bottom bar.
   */
  private syncMobileBottomInset(): void {
    if (!this.isMobileContext()) {
      this.contentEl.style.removeProperty('--tablify-mobile-bottom-inset');
      return;
    }
    const viewRect = this.contentEl.getBoundingClientRect();
    const inset = this.measureMobileBottomBarOverlap(viewRect);
    if (inset > 0) {
      this.contentEl.style.setProperty('--tablify-mobile-bottom-inset', `${inset}px`);
    } else {
      this.contentEl.style.removeProperty('--tablify-mobile-bottom-inset');
    }
  }

  /**
   * SAD-305: propagate the grid's content-bounded minimum height floor to `.tablify__card` and
   * `.tablify__body` so that when the mobile on-screen keyboard shrinks `.tablify-view`, the card
   * stops shrinking at the grid floor and `.tablify-view` scrolls instead of crushing the rows
   * under the sticky column header.
   */
  private syncLayoutFloor(): void {
    const card = this.card;
    if (!card) return;
    const gridMin = this.grid?.minHeightFloor() ?? 0;
    if (gridMin <= 0) {
      card.style.removeProperty('--tablify-grid-min-height');
      card.style.removeProperty('--tablify-card-min-height');
      return;
    }
    card.style.setProperty('--tablify-grid-min-height', `${gridMin}px`);
    let cardChrome = 220;
    if (this.body) {
      const topChrome = this.body.getBoundingClientRect().top - card.getBoundingClientRect().top;
      if (topChrome > 0) {
        const cs = typeof getComputedStyle === 'function' ? getComputedStyle(card) : null;
        const bottomPad = cs
          ? (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0)
          : 17;
        cardChrome = Math.round(topChrome + bottomPad);
      }
    }
    card.style.setProperty('--tablify-card-min-height', `${cardChrome + gridMin}px`);
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

  /** SAD-376: one cell's rendered display text, exactly as the grid drew it. */
  private cellTextAt(row: number, col: number): string {
    const cell = this.cellElement({ row, col });
    return cell?.querySelector('.tablify__cell-text')?.textContent ?? '';
  }

  /** SAD-376: open the expanded view for a cell from the menu — the same panel, same anchor. */
  private openOverflowPanelAt(row: number, col: number): void {
    const cell = this.cellElement({ row, col });
    if (cell) this.grid?.openCellOverflow(cell);
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

  /**
   * COD-71: flip a checkbox cell through the store, so the toggle is one undo step and is
   * saved like any other edit. Shared by the grid's box control and the press that ends an
   * editor on another cell (COD-70).
   */
  private toggleCheckboxAt(row: number, col: number): void {
    const s = this.session;
    if (!s) return;
    const rowData = this.displayRows()[row];
    const field = s.getVisibleFields()[col];
    if (!rowData || !field || field.type !== 'checkbox') return;
    s.setValue(rowData.id, field.id, rowData.values[field.id] !== true);
    this.afterChange();
  }

  /**
   * SAD-304: a click on the k-th star writes k. Same path as the checkbox — one `setValue`, so
   * one undo step and one save — and clicking the star that already holds the value writes
   * nothing (no empty entry in the undo history).
   */
  private rateAt(row: number, col: number, value: number): void {
    const s = this.session;
    if (!s) return;
    const rowData = this.displayRows()[row];
    const field = s.getVisibleFields()[col];
    if (!rowData || !field || field.type !== 'rating' || isReadOnly(field)) return;
    if (rowData.values[field.id] === value) return;
    s.setValue(rowData.id, field.id, value);
    this.grid?.root.focus();
    this.afterChange();
  }

  // ---- switching cells while an editor is open (COD-70) ----

  /**
   * COD-70: one click on another cell while editing commits the edit *and* selects the cell.
   *
   * The commit itself already happened on blur, but the blur runs during `mousedown` and its
   * re-render empties every row (`fillRow` rebuilds the cells), so the element the press began
   * on is detached long before `mouseup`. Chromium dispatches no `click` when the pressed node
   * is gone, and the browser's click is what selects a cell — hence the second click the ticket
   * describes. Finishing the edit from the press keeps the browser's intended order (commit,
   * then select) without waiting for an event that will not arrive.
   *
   * Only the mouse path needs this: touch presses never reach here while editing (the long
   * press handler ignores them, and a tap's own `click` follows a still-attached cell).
   */
  private wireEditSwitchPress(root: HTMLElement): void {
    root.addEventListener('pointerdown', (e) => {
      const editor = this.editing;
      if (!editor || e.pointerType === 'touch' || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      const cell = target?.closest?.('.tablify__cell') as HTMLElement | null;
      if (!cell) return;
      const row = Number((cell.parentElement as HTMLElement | null)?.dataset.rowIndex);
      const col = Number(cell.dataset.colIndex);
      if (Number.isNaN(row) || Number.isNaN(col)) return;
      const sel = this.grid?.getSelection();
      // The editor covers its own cell; a press there belongs to the editor, not to the grid.
      if (sel && sel.row === row && sel.col === col) return;
      // An invalid value keeps the editor open (the editor's own blur rule) — and the caret
      // stays in it, so the user can correct the value or press Escape without clicking back.
      if (!this.finishEditOnPress(editor)) {
        e.preventDefault();
        // The press still moves focus to the grid (below the editor); put the caret back in the
        // field once the press is over, so the invalid value can be corrected or escaped.
        setTimeout(() => {
          if (this.editing === editor) editor.focus();
        }, 0);
        return;
      }
      // Commit first, then activate — and own the rest of the gesture, so no half-finished
      // press lands on the freshly rendered rows.
      e.preventDefault();
      if (target?.closest?.('.tablify__check')) {
        // COD-71: the box owns its click — the press toggles it and leaves the selection
        // alone, exactly like a click on the box with no editor open.
        this.toggleCheckboxAt(row, col);
      } else {
        this.grid?.setSelection({ row, col });
      }
      this.grid?.root.focus();
    });
  }

  /**
   * Finish the open editor through the commit path its blur listener owns. Returns true when
   * the editor closed — false when validation kept it open.
   */
  private finishEditOnPress(editor: HTMLElement): boolean {
    // The editor's blur listener owns the commit; dispatch the event instead of moving focus,
    // so a value that fails validation keeps the caret in the editor.
    editor.dispatchEvent(new Event('blur'));
    return this.editing === null;
  }

  // ---- outside-press clearing (COD-77) ----

  /**
   * COD-77 (prototype `outsideTapClear`, Prototype/script.js:866): a press
   * anywhere outside the table surface drops the focused cell. Pointerdown,
   * not click — the highlight is gone the instant the tap lands, before any
   * re-render can detach the target — and one listener covers mouse, pen and
   * touch. Never prevented, so the press detection flows are untouched.
   *
   * Captured on the way down, deliberately: a press on another cell while an
   * editor is open is committed by `wireEditSwitchPress` during the bubble
   * phase, and that commit re-renders the rows — detaching the press target
   * before a bubble listener on the document could ask it `closest()`. In the
   * capture phase the target is still attached, so the keep-zone decision is
   * always made against the DOM the press actually landed on.
   */
  private outsideTapClear(ev: Event): void {
    const t = ev.target as HTMLElement | null;
    if (!t?.closest) return;
    // Keep-zones — the prototype's #mainTable and #floatPanel, plus the
    // surfaces Tablify draws at document level, and the open editor (it floats
    // in the grid root but outside the viewport, so it needs its own check:
    // tapping into it to move the caret must not commit-and-clear).
    if (
      t === this.grid?.root ||
      t.closest(
        '.tablify__header, .tablify__viewport, .tablify__panel, .menu, .menu-container, .modal-container',
      ) ||
      (this.editing !== null && this.editing.contains(t))
    ) {
      return;
    }
    if (!this.grid?.getSelection() && !this.editing) return;
    // Commit a pending edit first — never lose input (the prototype's rule).
    // An invalid value keeps the editor open, and with it the highlight.
    if (this.editing && !this.finishEditOnPress(this.editing)) return;
    this.grid?.setSelection(null);
  }

  /** COD-77: the listener lives at document level, like the panels' own dismissal. */
  private wireOutsideTapClear(): void {
    this.unwireOutsideTapClear?.();
    const bound = (ev: Event): void => this.outsideTapClear(ev);
    document.addEventListener('pointerdown', bound, true);
    this.unwireOutsideTapClear = () => document.removeEventListener('pointerdown', bound, true);
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
    // SAD-376: the cell's rendered text is the one source of truth for "is there more to read" —
    // re-deriving it here would be a second formatting path that could drift from the grid's.
    // The item belongs to the same switch as the touch-revealed control (one setting covers both
    // ways a touch reader can reach the content) and is offered on a read-only field too, because
    // reading is not editing.
    const overflow = this.overflowConfig();
    const entries = cellMenu(
      {
        readOnly: isReadOnly(field),
        cellEmpty: isEmptyValue(value),
        hasClipboard: this.clipboardText !== null,
        isLink: field.type === 'link',
        foreignLinks: field.type === 'link' ? countForeignRefs(value, field.linkTableId) : 0,
        overflowText: overflow.touchReveal && offersOverflow(overflow, this.cellTextAt(row, col)),
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
        case 'cell.expand':
          // SAD-376: the same panel the in-cell control opens, anchored the same way.
          this.openOverflowPanelAt(t.row, t.col);
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
    // COD-75: date and date_time join them — the browser's own picker cannot be themed.
    if (
      field.type === 'single_select' ||
      field.type === 'multi_select' ||
      field.type === 'attachment' ||
      field.type === 'date' ||
      field.type === 'date_time' ||
      field.type === 'phone' ||
      field.type === 'rating'
    ) {
      if (cell) this.openCellPanel(row.id, field, cell);
      return;
    }
    const editor = createEditor(field, storeRow, s.store, s.stack, (committed) => {
      this.unwireEditingViewport?.();
      this.unwireEditingViewport = undefined;
      this.editing = null;
      this.editingCell = null;
      editor?.remove();
      if (committed) this.publishLive();
      this.renderGrid();
      grid.root.focus();
      if (committed) this.requestSave();
    });
    if (!editor || !cell) return;
    this.editing = editor;
    this.editingCell = { ...sel };
    editor.style.position = 'absolute';
    this.positionEditor(editor, sel);
    grid.root.appendChild(editor);
    this.wireEditingViewport();
    this.syncEditingViewport();
  }

  /**
   * SAD-305: align the floating inline editor over the active cell's capsule inside `grid.root`.
   * Returns the measured capsule/cell element so callers can scroll it into the outer view.
   */
  private positionEditor(editor: HTMLElement, sel: GridSelection): HTMLElement | null {
    const grid = this.grid;
    if (!grid) return null;
    const cell = this.cellElement(sel);
    if (!cell) return null;
    const rootRect = grid.root.getBoundingClientRect();
    // SAD-79: the visible cell is the capsule inside the slot; edit over it.
    const target = cell.querySelector<HTMLElement>('.tablify__capsule') ?? cell;
    const cellRect = target.getBoundingClientRect();
    // Absolute offsets start inside the root's border (SAD-85: the outline showed a 1px shift).
    editor.style.left = `${cellRect.left - rootRect.left - grid.root.clientLeft + grid.root.scrollLeft}px`;
    editor.style.top = `${cellRect.top - rootRect.top - grid.root.clientTop + grid.root.scrollTop}px`;
    editor.style.width = `${cellRect.width}px`;
    editor.style.height = `${cellRect.height}px`;
    return target;
  }

  /**
   * SAD-305: handle pane or keyboard viewport size changes — update the card floor, recover
   * outer scroll when the keyboard closes and the card fits again, and keep an open editor in view.
   */
  private handleViewportResize(): void {
    this.syncMobileBottomInset();
    this.syncLayoutFloor();
    if (
      !this.editing &&
      this.contentEl.clientHeight > 0 &&
      this.contentEl.scrollHeight <= this.contentEl.clientHeight &&
      this.contentEl.scrollTop !== 0
    ) {
      this.contentEl.scrollTop = 0;
    }
    this.syncEditingViewport();
  }

  /**
   * SAD-305: when the mobile on-screen keyboard opens after `startEdit` (triggered by the async
   * `input.focus()`), re-scroll the grid to the active row, re-align the editor over the cell's
   * capsule, and scroll `.tablify-view` if the active cell was pushed below the keyboard fold.
   */
  private syncEditingViewport(): void {
    const editor = this.editing;
    const sel = this.editingCell;
    const grid = this.grid;
    if (!editor || !sel || !grid) return;
    grid.scrollToRow(sel.row);
    const target = this.positionEditor(editor, sel) ?? editor;
    const viewRect = this.contentEl.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (!(viewRect.height > 0) || !(targetRect.height > 0)) return;
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const vvBottom =
      vv && vv.height > 0 ? Math.min(viewRect.bottom, vv.offsetTop + vv.height) : viewRect.bottom;
    const barOverlap = this.isMobileContext() ? this.measureMobileBottomBarOverlap(viewRect) : 0;
    const visibleBottom = Math.min(vvBottom, viewRect.bottom - barOverlap);
    const pad = 12;
    if (targetRect.bottom > visibleBottom) {
      this.contentEl.scrollTop += targetRect.bottom - visibleBottom + pad;
    } else if (targetRect.top < viewRect.top) {
      this.contentEl.scrollTop = Math.max(0, this.contentEl.scrollTop - (viewRect.top - targetRect.top + pad));
    }
  }

  /** SAD-305: listen to mobile `visualViewport` resize/scroll while an inline editor is open. */
  private wireEditingViewport(): void {
    this.unwireEditingViewport?.();
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const onViewport = (): void => this.handleViewportResize();
    vv.addEventListener('resize', onViewport);
    vv.addEventListener('scroll', onViewport);
    this.unwireEditingViewport = () => {
      vv.removeEventListener('resize', onViewport);
      vv.removeEventListener('scroll', onViewport);
    };
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

    // COD-75: date / date_time — the anchored picker replaces `<input type="date">` and the
    // browser's unstyleable dialog. One `setValue` per commit, so one undo step, and an untouched
    // draft writes nothing at all (the COD-68 rule).
    if (field.type === 'date' || field.type === 'date_time') {
      const stored = value();
      let settled = false;
      const finish = (commit: boolean, next?: CellValue): void => {
        if (settled) return;
        settled = true;
        picker.close();
        if (commit && next !== undefined && !equivalentStored(field.type, next, stored)) {
          s.setValue(rowId, field.id, next);
          this.afterChange();
        }
        grid.root.focus();
      };
      const picker = new DatePicker({
        field,
        value: stored,
        theme: this.isDark() ? 'dark' : 'light',
        onCommit: (next) => finish(true, next),
        onCancel: () => finish(false),
      });
      picker.open(anchor);
      return;
    }

    // SAD-303: phone — the country and the number in one card. The panel hands back the value
    // the field type would store; an untouched panel hands back the stored value, and the
    // comparison below turns that into "no write at all".
    if (field.type === 'phone') {
      const stored = value();
      let settled = false;
      const finish = (commit: boolean, next?: CellValue): void => {
        if (settled) return;
        settled = true;
        if (commit) {
          const same = String(next ?? '') === String(stored ?? '');
          if (!same) {
            s.setValue(rowId, field.id, next ?? null);
            this.afterChange();
          }
        }
        grid.root.focus();
      };
      const panel = new PhonePanel({
        field,
        value: stored,
        theme: this.isDark() ? 'dark' : 'light',
        locale: readerLocale(),
        onCommit: (next) => finish(true, next),
        onCancel: () => finish(false),
      });
      panel.open(anchor);
      return;
    }

    // SAD-304: rating — big stars, half-star zones and a numeric field. Like the phone panel,
    // it hands back the value to store; an untouched panel hands back the stored one, and the
    // comparison below turns that into "no write at all".
    if (field.type === 'rating') {
      if (isReadOnly(field)) return;
      const stored = value();
      let settled = false;
      const finish = (commit: boolean, next?: CellValue): void => {
        if (settled) return;
        settled = true;
        if (commit) {
          const same = String(next ?? '') === String(stored ?? '');
          if (!same) {
            s.setValue(rowId, field.id, next ?? null);
            this.afterChange();
          }
        }
        grid.root.focus();
      };
      const ratingPanel = new RatingPanel({
        field,
        value: stored,
        theme: this.isDark() ? 'dark' : 'light',
        onCommit: (next) => finish(true, next),
        onCancel: () => finish(false),
      });
      ratingPanel.open(anchor);
      return;
    }

    if (field.type === 'attachment') {
      // SAD-356: an empty cell asks how to fill it — a file from this device, or a URL / vault path.
      if (isAttachmentValueEmpty(value())) this.openAttachmentMenu(rowId, field, anchor);
      else this.openAttachmentPanelAt(rowId, field, anchor);
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

  // ---- SAD-356: attachment from the device ------------------------------------------------

  /**
   * The panel for a cell that already holds an attachment — exactly what `openCellPanel` used to
   * build inline, plus the new device picker. Split out so the empty-cell menu can open it directly:
   * going back through `openCellPanel` would land on the menu again while the cell is still empty.
   */
  private openAttachmentPanelAt(rowId: string, field: FieldDefinition, anchor: HTMLElement): void {
    const s = this.session;
    const grid = this.grid;
    if (!s || !grid) return;
    const value = (): CellValue => s.store.getRow(rowId)?.values[field.id] ?? null;
    const closePanel = (focusGrid = true): void => {
      panel.close();
      if (focusGrid) grid.root.focus();
    };
    const panel = new AttachmentPanel({
      field,
      value: value(),
      theme: this.isDark() ? 'dark' : 'light',
      checkPath: (raw) => checkAttachmentPath(raw, this.app.vault),
      resolveImageUrl: (path) => resolveAttachmentImageUrl(path, this.app.vault),
      onPreviewImage: (path, url) => new ImagePreviewModal(this.app, { path, url }).open(),
      // SAD-356: a filled cell can also take a file from the device.
      onChooseFile: () => void this.chooseAttachmentFile(rowId, field, panel),
      onAdd: (raw) => {
        // SAD-356: a URL is stored exactly as typed. `normalizeAttachmentPath` collapses `//`
        // (it is written for vault paths), which would turn `https://…` into `https:/…`.
        const path = isRemoteAttachmentPath(raw) ? raw.trim() : normalizeAttachmentPath(raw);
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
  }

  /**
   * SAD-356 — an empty Attachment cell: two ways in. The menu is the same `#floatPanel` card as
   * every other cell panel, so placement and dismissal are the ones the grid already uses.
   */
  private openAttachmentMenu(rowId: string, field: FieldDefinition, anchor: HTMLElement): void {
    const grid = this.grid;
    if (!grid) return;
    const menu = new AttachmentMenu({
      field,
      theme: this.isDark() ? 'dark' : 'light',
      onChooseFile: () => void this.chooseAttachmentFile(rowId, field, menu),
      onEnterPath: () => {
        menu.close();
        this.openAttachmentPanelAt(rowId, field, anchor);
      },
      onDismiss: () => grid.root.focus(),
    });
    menu.open(anchor);
  }

  /**
   * SAD-356 — pick a file, copy it into the vault, store the vault-relative path.
   *
   * One `setValue` + `afterChange()`, so the write is exactly one undo step (the same contract the
   * panel's path entry has). The copy itself is not undoable: the file is a vault artefact, not a
   * cell value — the Notice says where it went.
   */
  private async chooseAttachmentFile(
    rowId: string,
    field: FieldDefinition,
    ui: { setBusy(label: string | null): void; setMessage(text: string): void; close?(): void },
  ): Promise<void> {
    const s = this.session;
    if (!s) return;
    ui.setBusy('Opening your file picker…');
    const picked = await pickFileFromDevice();
    if (picked.kind === 'unavailable') {
      ui.setBusy(null);
      // Owner decision D4: say so, and leave the user on the path/URL entry rather than a dead end.
      ui.setMessage('This device did not open a file picker. Enter the file path or a URL instead.');
      return;
    }
    if (picked.kind === 'cancelled') {
      ui.setBusy(null);
      return;
    }

    const io: AttachmentVaultIo = {
      getAvailablePathForAttachment: this.app.fileManager.getAvailablePathForAttachment?.bind(
        this.app.fileManager,
      ),
      createBinary: (path, data) => this.app.vault.createBinary(path, data),
      getAbstractFileByPath: (path) => this.app.vault.getAbstractFileByPath(path),
    };
    ui.setBusy('Copying into your vault…');
    const result = await importPickedFile(picked.file, io, this.file?.path ?? '');
    ui.setBusy(null);
    if (!result.ok) {
      ui.setMessage(result.message);
      return;
    }

    s.setValue(rowId, field.id, result.path);
    this.afterChange();
    new Notice(`Saved to ${result.path}`);
    ui.close?.();
    this.grid?.root.focus();
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
  method: 'picker' | 'share' | 'download' | 'folder' | 'vault',
  fileName: string,
  rowCount: number,
  columnCount: number,
  displayPath?: string,
): string {
  if (method === 'picker') return `Exported ${rowCount} rows and ${columnCount} columns to ${fileName} in the selected location.`;
  if (method === 'share') return `Shared ${rowCount} rows and ${columnCount} columns as ${fileName}.`;
  if (method === 'folder') return `Saved ${fileName} (${rowCount} rows, ${columnCount} columns) to ${displayPath ?? 'a shared folder'}.`;
  if (method === 'vault') return `Saved ${fileName} (${rowCount} rows, ${columnCount} columns) to the vault at ${displayPath ?? fileName}.`;
  return `Download started: ${fileName} (${rowCount} rows, ${columnCount} columns).`;
}

function formatValue(value: CellValue | undefined, field: FieldDefinition): string {
  return getFieldType(field.type).format(value ?? null, field);
}

function isEmptyValue(v: CellValue | undefined): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}
