/**
 * Table toolbar — SAD-69 plan item A, plus B (the show-hidden path).
 *
 * This is the file P3-08 specified as its output and that never existed. It is pure DOM:
 * `document.createElement`, no Obsidian imports, exactly like GridView. That matters —
 * it is what makes the toolbar testable in jsdom. The Obsidian-facing layer (TableView)
 * only mounts it and hands it callbacks.
 *
 * Layout follows Prototype/Anthropic Table Workspace.html: a search capsule on the left,
 * Add Row / Add Field / Options on the right, a row-count badge beneath, and a query row
 * with inline errors.
 *
 * Build once, update often: the DOM is constructed in the constructor and `update()` only
 * refreshes derived pieces. Rebuilding on every keystroke would destroy focus and caret
 * position, and TableView re-renders on every change.
 */

import { applyTheme } from '../../ui/theme/tokens.js';
import { parseQuery } from '../../query/parse.js';
import type { QueryError } from '../../query/parse.js';
import type { FieldDefinition, ViewDefinition } from '../../model/types.js';

/**
 * Row heights offered in the Options menu.
 * Restricted to the three values tablify.schema.json allows — see columns.ts::setRowHeight.
 * Narrower than the model's RowHeight type on purpose: 'compact' and 'tall' render fine but
 * produce a file the schema rejects, so the UI must never offer them.
 */
export type ToolbarRowHeight = 'small' | 'medium' | 'large';

export const ROW_HEIGHTS: ToolbarRowHeight[] = ['small', 'medium', 'large'];

export const ROW_HEIGHT_LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

/** Search and query debounce in ms. P3-08 specifies 200 ms (proposed). */
export const DEBOUNCE_MS = 200;

export interface ToolbarCallbacks {
  /** Search text changed (debounced). Persisted, not undoable. */
  onSearch(term: string): void;
  /** Query text changed (debounced). Persisted, not undoable. */
  onQuery(query: string): void;
  onAddRow(): void;
  onAddField(): void;
  onRowHeight(height: ToolbarRowHeight): void;
  onFreezeColumns(count: number): void;
  /** Show a previously hidden field again — SAD-69 plan item B. */
  onShowField(fieldId: string): void;
  onClearFilters(): void;
  onUndo(): void;
  onRedo(): void;
}

export interface ToolbarState {
  fields: FieldDefinition[];
  view: ViewDefinition;
  /** Rows visible after the current filter. */
  visibleRowCount: number;
  /** Rows before filtering. */
  totalRowCount: number;
  /** Persisted search text. */
  search: string;
  /** Persisted query text. */
  query: string;
  /** Error from the persisted query, or null. */
  queryError: QueryError | null;
  theme: 'light' | 'dark';
}

export interface ToolbarOptions extends ToolbarState {
  callbacks: ToolbarCallbacks;
}

/** Stable data-action values, so tests and the DOM agree. */
const ACTIONS = {
  addRow: 'add-row',
  addField: 'add-field',
  options: 'options',
  undo: 'undo',
  redo: 'redo',
  clearFilters: 'clear-filters',
} as const;

export class Toolbar {
  root: HTMLElement;

  private readonly opts: ToolbarOptions;
  private readonly searchInput: HTMLInputElement;
  private readonly queryInput: HTMLInputElement;
  private readonly queryError: HTMLElement;
  private readonly optionsPanel: HTMLElement;
  private readonly optionsButton: HTMLElement;
  private readonly rowCount: HTMLElement;
  private readonly hiddenList: HTMLElement;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private queryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ToolbarOptions) {
    this.opts = options;

    this.root = document.createElement('div');
    this.root.className = 'tablify__toolbar';
    // Plugin tokens, so the toolbar matches the grid in both themes and ignores the host
    // Obsidian theme. applyTheme also sets the --tablify-* CSS variables inline.
    applyTheme(this.root, options.theme);

    // ---- top row: search capsule + action buttons ----
    const topRow = document.createElement('div');
    topRow.className = 'tablify__toolbar-row';

    const searchWrap = document.createElement('div');
    searchWrap.className = 'tablify__search';
    const searchIcon = document.createElement('span');
    searchIcon.className = 'tablify__search-icon';
    searchIcon.setAttribute('aria-hidden', 'true');
    searchIcon.textContent = '\u2315'; // ⌕ — inline glyph, no external asset
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.className = 'tablify__search-input';
    this.searchInput.placeholder = 'Search rows…';
    this.searchInput.setAttribute('aria-label', 'Search rows');
    this.searchInput.dataset.testid = 'tablify-search';
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(this.searchInput);

    const actions = document.createElement('div');
    actions.className = 'tablify__toolbar-actions';
    actions.appendChild(this.makeButton(ACTIONS.addRow, 'Add row', 'Add row'));
    actions.appendChild(this.makeButton(ACTIONS.addField, 'Add Field', 'Add field'));
    this.optionsButton = this.makeButton(ACTIONS.options, 'Options', 'View settings');
    this.optionsButton.setAttribute('aria-haspopup', 'true');
    this.optionsButton.setAttribute('aria-expanded', 'false');
    actions.appendChild(this.optionsButton);
    actions.appendChild(this.makeButton(ACTIONS.undo, '\u21B6', 'Undo'));
    actions.appendChild(this.makeButton(ACTIONS.redo, '\u21B7', 'Redo'));

    topRow.appendChild(searchWrap);
    topRow.appendChild(actions);
    this.root.appendChild(topRow);

    // ---- query row ----
    const queryRow = document.createElement('div');
    queryRow.className = 'tablify__query-row';
    this.queryInput = document.createElement('input');
    this.queryInput.type = 'text';
    this.queryInput.className = 'tablify__query-input';
    this.queryInput.placeholder = 'Filter, e.g. Status:Done Amount:>10';
    this.queryInput.setAttribute('aria-label', 'Filter rows with a query');
    this.queryInput.dataset.testid = 'tablify-query';
    this.queryError = document.createElement('div');
    this.queryError.className = 'tablify__query-error';
    this.queryError.setAttribute('role', 'alert');
    this.queryError.dataset.testid = 'tablify-query-error';
    queryRow.appendChild(this.queryInput);
    queryRow.appendChild(this.queryError);
    this.root.appendChild(queryRow);

    // ---- options popover (view settings) ----
    this.optionsPanel = document.createElement('div');
    this.optionsPanel.className = 'tablify__options';
    this.optionsPanel.hidden = true;
    this.optionsPanel.dataset.testid = 'tablify-options';
    this.hiddenList = document.createElement('div');
    this.hiddenList.className = 'tablify__hidden-fields';
    this.hiddenList.dataset.testid = 'tablify-hidden-fields';
    this.optionsPanel.appendChild(this.hiddenList);
    this.root.appendChild(this.optionsPanel);

    // ---- row count badge ----
    this.rowCount = document.createElement('div');
    this.rowCount.className = 'tablify__rowcount';
    this.rowCount.dataset.testid = 'tablify-rowcount';
    this.rowCount.setAttribute('aria-live', 'polite');
    this.root.appendChild(this.rowCount);

    this.wireEvents();
    this.update(options);
  }

  // ---- construction helpers ----

  private makeButton(action: string, label: string, title: string): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tablify__toolbar-button';
    btn.textContent = label;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.dataset.action = action;
    return btn;
  }

  private wireEvents(): void {
    this.searchInput.addEventListener('input', () => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
      const value = this.searchInput.value;
      this.searchTimer = setTimeout(() => {
        this.searchTimer = null;
        this.opts.callbacks.onSearch(value);
      }, DEBOUNCE_MS);
    });

    this.queryInput.addEventListener('input', () => {
      // The error is shown immediately so typing is responsive; applying the filter waits
      // for the debounce, so a half-typed query does not thrash the grid.
      this.showQueryError(this.queryInput.value);
      if (this.queryTimer !== null) clearTimeout(this.queryTimer);
      const value = this.queryInput.value;
      this.queryTimer = setTimeout(() => {
        this.queryTimer = null;
        this.opts.callbacks.onQuery(value);
      }, DEBOUNCE_MS);
    });

    this.root.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const showBtn = target.closest<HTMLElement>('[data-show-field]');
      const fieldId = showBtn?.dataset.showField;
      if (fieldId) {
        this.opts.callbacks.onShowField(fieldId);
        return;
      }
      const heightBtn = target.closest<HTMLElement>('[data-row-height]');
      const height = heightBtn?.dataset.rowHeight;
      if (height) {
        this.opts.callbacks.onRowHeight(height as ToolbarRowHeight);
        return;
      }
      const button = target.closest<HTMLElement>('[data-action]');
      const action = button?.dataset.action;
      if (action) this.handleAction(action);
    });

    this.root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.optionsPanel.hidden) this.setOptionsOpen(false);
    });
  }

  private handleAction(action: string): void {
    switch (action) {
      case ACTIONS.addRow:
        this.opts.callbacks.onAddRow();
        break;
      case ACTIONS.addField:
        this.opts.callbacks.onAddField();
        break;
      case ACTIONS.options:
        this.setOptionsOpen(this.optionsPanel.hidden);
        break;
      case ACTIONS.clearFilters:
        this.opts.callbacks.onClearFilters();
        break;
      case ACTIONS.undo:
        this.opts.callbacks.onUndo();
        break;
      case ACTIONS.redo:
        this.opts.callbacks.onRedo();
        break;
      default:
        break;
    }
  }

  // ---- public API ----

  /** Refresh derived state without rebuilding the inputs (that would drop focus/caret). */
  update(state: ToolbarState): void {
    this.opts.fields = state.fields;
    this.opts.view = state.view;
    this.opts.visibleRowCount = state.visibleRowCount;
    this.opts.totalRowCount = state.totalRowCount;
    this.opts.search = state.search;
    this.opts.query = state.query;
    this.opts.queryError = state.queryError;

    if (state.theme !== this.opts.theme) {
      this.opts.theme = state.theme;
      applyTheme(this.root, state.theme);
    }

    // Only write when different, and never while the field is focused. Assigning .value
    // moves the caret to the end, and overwriting a field mid-keystroke would fight the
    // user: a re-render triggered by something else (an undo, a row insert) would otherwise
    // wipe text that the debounce has not applied yet.
    if (document.activeElement !== this.searchInput && this.searchInput.value !== (state.search ?? '')) {
      this.searchInput.value = state.search ?? '';
    }
    if (document.activeElement !== this.queryInput && this.queryInput.value !== (state.query ?? '')) {
      this.queryInput.value = state.query ?? '';
    }

    this.showQueryError(this.queryInput.value);
    this.renderRowCount();
    this.renderOptions();
  }

  /** True when the view settings popover is open. */
  isOptionsOpen(): boolean {
    return !this.optionsPanel.hidden;
  }

  destroy(): void {
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    if (this.queryTimer !== null) clearTimeout(this.queryTimer);
    this.searchTimer = null;
    this.queryTimer = null;
    this.root.remove();
  }

  // ---- rendering ----

  private showQueryError(raw: string): void {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) {
      // Fall back to the session's persisted-query error (e.g. loaded from a file).
      const persisted = this.opts.queryError;
      if (persisted) {
        this.queryError.textContent = `${persisted.message} (position ${persisted.position})`;
        this.queryError.hidden = false;
        this.queryInput.classList.add('tablify__query-input--invalid');
        return;
      }
      this.queryError.textContent = '';
      this.queryError.hidden = true;
      this.queryInput.classList.remove('tablify__query-input--invalid');
      return;
    }
    const parsed = parseQuery(trimmed);
    if (parsed.ok) {
      this.queryError.textContent = '';
      this.queryError.hidden = true;
      this.queryInput.classList.remove('tablify__query-input--invalid');
      return;
    }
    this.queryError.textContent = `${parsed.error.message} (position ${parsed.error.position})`;
    this.queryError.hidden = false;
    this.queryInput.classList.add('tablify__query-input--invalid');
  }

  private renderRowCount(): void {
    const { visibleRowCount, totalRowCount } = this.opts;
    const filtered = visibleRowCount !== totalRowCount;
    this.rowCount.textContent = filtered
      ? `${visibleRowCount} of ${totalRowCount} rows`
      : `${totalRowCount} ${totalRowCount === 1 ? 'row' : 'rows'}`;
  }

  private setOptionsOpen(open: boolean): void {
    this.optionsPanel.hidden = !open;
    this.optionsButton.setAttribute('aria-expanded', String(open));
    if (open) this.renderOptions();
  }

  private renderOptions(): void {
    const { view, fields } = this.opts;
    this.optionsPanel.textContent = '';

    // ---- row height ----
    const heightGroup = document.createElement('div');
    heightGroup.className = 'tablify__option-group';
    heightGroup.dataset.testid = 'option-rowheight';
    const heightLabel = document.createElement('span');
    heightLabel.className = 'tablify__option-label';
    heightLabel.textContent = 'Row height';
    heightGroup.appendChild(heightLabel);
    for (const h of ROW_HEIGHTS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tablify__option-button';
      btn.textContent = ROW_HEIGHT_LABELS[h] ?? h;
      btn.dataset.rowHeight = h;
      if (view.rowHeight === h) btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', String(view.rowHeight === h));
      heightGroup.appendChild(btn);
    }
    this.optionsPanel.appendChild(heightGroup);

    // ---- frozen columns ----
    const freezeGroup = document.createElement('div');
    freezeGroup.className = 'tablify__option-group';
    freezeGroup.dataset.testid = 'option-freeze';
    const freezeLabel = document.createElement('label');
    freezeLabel.className = 'tablify__option-label';
    freezeLabel.textContent = 'Freeze columns';
    const select = document.createElement('select');
    select.className = 'tablify__option-select';
    select.setAttribute('aria-label', 'Number of frozen columns');
    for (let n = 0; n <= fields.length; n++) {
      const option = document.createElement('option');
      option.value = String(n);
      option.textContent = String(n);
      if (view.frozenColumns === n) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      this.opts.callbacks.onFreezeColumns(Number(select.value));
    });
    freezeGroup.appendChild(freezeLabel);
    freezeGroup.appendChild(select);
    this.optionsPanel.appendChild(freezeGroup);

    // ---- hidden fields, with a Show button for each (plan item B) ----
    const hiddenGroup = document.createElement('div');
    hiddenGroup.className = 'tablify__option-group';
    hiddenGroup.dataset.testid = 'tablify-hidden-fields';
    const hiddenLabel = document.createElement('span');
    hiddenLabel.className = 'tablify__option-label';
    hiddenLabel.textContent = 'Hidden fields';
    hiddenGroup.appendChild(hiddenLabel);

    const hidden = new Set(view.hidden ?? []);
    const hiddenFields = fields.filter((f) => hidden.has(f.id));
    if (hiddenFields.length === 0) {
      const none = document.createElement('span');
      none.className = 'tablify__option-empty';
      none.textContent = 'None';
      hiddenGroup.appendChild(none);
    } else {
      for (const field of hiddenFields) {
        const row = document.createElement('div');
        row.className = 'tablify__hidden-field';
        const name = document.createElement('span');
        name.className = 'tablify__hidden-field-name';
        name.textContent = field.name;
        const show = document.createElement('button');
        show.type = 'button';
        show.className = 'tablify__option-button';
        show.textContent = 'Show';
        show.dataset.showField = field.id;
        show.setAttribute('aria-label', `Show field ${field.name}`);
        row.appendChild(name);
        row.appendChild(show);
        hiddenGroup.appendChild(row);
      }
    }
    this.optionsPanel.appendChild(hiddenGroup);

    // ---- clear filters ----
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'tablify__option-button tablify__option-button--wide';
    clear.textContent = 'Clear filters';
    clear.dataset.action = ACTIONS.clearFilters;
    this.optionsPanel.appendChild(clear);
  }
}
