/**
 * Table toolbar — SAD-69 plan item A, plus B (the show-hidden path).
 *
 * This is the file P3-08 specified as its output and that never existed. It is pure DOM:
 * `document.createElement`, no Obsidian imports, exactly like GridView. That matters —
 * it is what makes the toolbar testable in jsdom. The Obsidian-facing layer (TableView)
 * only mounts it and hands it callbacks.
 *
 * Layout follows the prototype's #toolbarRow (SAD-78, owner decision S-3): one "Search or
 * query" capsule on the left, then Sync · ↶ · ↷ · Filter · Add Row · Add Field · Options, with
 * the query's inline error beneath and the meta row (row count) below that. The box's text is
 * split into the persisted view.search + view.query halves by src/query/combined.ts.
 *
 * Build once, update often: the DOM is constructed in the constructor and `update()` only
 * refreshes derived pieces. Rebuilding on every keystroke would destroy focus and caret
 * position, and TableView re-renders on every change.
 */

import { applyTheme } from '../../ui/theme/tokens.js';
import { parseQuery } from '../../query/parse.js';
import type { QueryError } from '../../query/parse.js';
import { joinSearchQuery, splitSearchQuery, toInputPosition } from '../../query/combined.js';
import { faIcon, type FaGlyph } from '../../ui/faIcons.js';
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

/** Search-or-query debounce in ms. P3-08 specifies 200 ms (proposed). */
export const DEBOUNCE_MS = 200;

/** Placeholder of the single box: the prototype's wording with a generic example (S-3). */
export const SEARCH_PLACEHOLDER = 'Search or query — e.g. Status:Done Amount:>10';

export interface ToolbarCallbacks {
  /**
   * The "Search or query" box changed (debounced), already split into its free-text search
   * and `field:value` query halves. Persisted, not undoable.
   */
  onFilter(search: string, query: string): void;
  /** Sync button: the same entry point as the "Airtable sync for this table" command. */
  onSync(): void;
  /** Filter button: open the filter builder for the box's current text. */
  onOpenFilter(): void;
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

/**
 * Toolbar glyphs: the prototype's Font Awesome 6.4.0 solid icons (src/ui/faIcons.ts), inlined
 * because the plugin ships offline. `currentColor` only — styles.css colours them via tokens.
 */
const ICONS = {
  search: 'magnifying-glass',
  sync: 'cloud-arrow-up',
  undo: 'rotate-left',
  redo: 'rotate-right',
  filter: 'filter',
  plus: 'plus',
  columns: 'table-columns',
  sliders: 'sliders',
} as const satisfies Record<string, FaGlyph>;

/** Wrap a glyph in the icon span the styles colour with the accent token. */
function iconSpan(glyph: keyof typeof ICONS): HTMLElement {
  const span = document.createElement('span');
  span.className = 'tablify__btn-icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = faIcon(ICONS[glyph]);
  return span;
}

/** Stable data-action values, so tests and the DOM agree. */
const ACTIONS = {
  sync: 'sync',
  filter: 'filter',
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
  private readonly queryError: HTMLElement;
  private readonly optionsPanel: HTMLElement;
  private readonly optionsButton: HTMLElement;
  private readonly rowCount: HTMLElement;
  private readonly hiddenList: HTMLElement;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

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
    searchIcon.innerHTML = faIcon(ICONS.search); // inline svg glyph, no external asset
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.className = 'tablify__search-input';
    this.searchInput.placeholder = SEARCH_PLACEHOLDER;
    this.searchInput.setAttribute('aria-label', 'Search or query rows');
    this.searchInput.spellcheck = false;
    this.searchInput.dataset.testid = 'tablify-search';
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(this.searchInput);

    // Prototype order: Sync · ↶ · ↷ · Filter · Add Row · Add Field · Options.
    const actions = document.createElement('div');
    actions.className = 'tablify__toolbar-actions';
    actions.appendChild(this.makeButton(ACTIONS.sync, 'Sync', 'Airtable sync for this table', 'sync'));
    actions.appendChild(this.makeButton(ACTIONS.undo, '', 'Undo', 'undo'));
    actions.appendChild(this.makeButton(ACTIONS.redo, '', 'Redo', 'redo'));
    const filterButton = this.makeButton(ACTIONS.filter, 'Filter', 'Filter builder', 'filter');
    filterButton.setAttribute('aria-haspopup', 'dialog');
    actions.appendChild(filterButton);
    actions.appendChild(this.makeButton(ACTIONS.addRow, 'Add Row', 'Add row', 'plus'));
    actions.appendChild(this.makeButton(ACTIONS.addField, 'Add Field', 'Add field', 'columns'));
    this.optionsButton = this.makeButton(ACTIONS.options, 'Options', 'View settings', 'sliders');
    this.optionsButton.setAttribute('aria-haspopup', 'true');
    this.optionsButton.setAttribute('aria-expanded', 'false');
    actions.appendChild(this.optionsButton);

    topRow.appendChild(searchWrap);
    topRow.appendChild(actions);
    this.root.appendChild(topRow);

    // ---- inline query error (the box's `field:value` part) ----
    this.queryError = document.createElement('div');
    this.queryError.className = 'tablify__query-error';
    this.queryError.setAttribute('role', 'alert');
    this.queryError.dataset.testid = 'tablify-query-error';
    this.queryError.hidden = true;
    this.root.appendChild(this.queryError);

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

    // ---- meta row (SAD-77): prototype #metaRow — selection summary left, badges right ----
    const metaRow = document.createElement('div');
    metaRow.className = 'tablify__meta-row';
    // Left slot for the prototype's "N selected · Delete" summary (filled by the row-selection
    // step, SAD-80). Empty and hidden until then.
    const selection = document.createElement('div');
    selection.className = 'tablify__selection-summary';
    selection.dataset.testid = 'tablify-selection-summary';
    selection.hidden = true;
    const badges = document.createElement('div');
    badges.className = 'tablify__badges';
    this.rowCount = document.createElement('span');
    this.rowCount.className = 'tablify__rowcount';
    this.rowCount.dataset.testid = 'tablify-rowcount';
    this.rowCount.setAttribute('aria-live', 'polite');
    badges.appendChild(this.rowCount);
    metaRow.appendChild(selection);
    metaRow.appendChild(badges);
    this.root.appendChild(metaRow);

    this.wireEvents();
    this.update(options);
  }

  // ---- construction helpers ----

  private makeButton(action: string, label: string, title: string, glyph: keyof typeof ICONS): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tablify__toolbar-button';
    btn.appendChild(iconSpan(glyph));
    if (label) {
      const text = document.createElement('span');
      text.className = 'tablify__btn-label';
      text.textContent = label;
      btn.appendChild(text);
    }
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.dataset.action = action;
    return btn;
  }

  /** Outside press closes the view-settings popover (SAD-71 Step 3). */
  private readonly outsideClose = (event: Event): void => {
    const target = event.target as Node | null;
    if (target && !this.root.contains(target)) this.setOptionsOpen(false);
  };

  private wireEvents(): void {
    this.searchInput.addEventListener('input', () => {
      // The error is shown immediately so typing is responsive; applying the filter waits
      // for the debounce, so a half-typed query does not thrash the grid.
      this.showQueryError(this.searchInput.value);
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
      const value = this.searchInput.value;
      this.searchTimer = setTimeout(() => {
        this.searchTimer = null;
        this.emitFilter(value);
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
      case ACTIONS.sync:
        this.opts.callbacks.onSync();
        break;
      case ACTIONS.filter:
        this.opts.callbacks.onOpenFilter();
        break;
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
    // The box shows search + query; it is only rewritten when its own split disagrees with
    // the persisted halves (a clear, an undo, a file change), so the user's spacing survives.
    if (document.activeElement !== this.searchInput) {
      const split = splitSearchQuery(this.searchInput.value);
      if (split.search !== (state.search ?? '').trim() || split.query.trim() !== (state.query ?? '').trim()) {
        this.searchInput.value = joinSearchQuery(state.search, state.query);
      }
    }

    this.showQueryError(this.searchInput.value);
    this.renderRowCount();
    this.renderOptions();
  }

  /** The box's current text (including anything typed but not yet applied). */
  getFilterText(): string {
    return this.searchInput.value;
  }

  /**
   * Replace the box's text and apply it at once (filter builder Apply). Cancels a pending
   * debounce so stale typing cannot overwrite the new filter afterwards.
   */
  setFilterText(text: string): void {
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = null;
    this.searchInput.value = text;
    this.showQueryError(text);
    this.emitFilter(text);
  }

  private emitFilter(text: string): void {
    const split = splitSearchQuery(text);
    this.opts.callbacks.onFilter(split.search, split.query);
  }

  /** True when the view settings popover is open. */
  isOptionsOpen(): boolean {
    return !this.optionsPanel.hidden;
  }

  destroy(): void {
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = null;
    document.removeEventListener('pointerdown', this.outsideClose);
    this.root.remove();
  }

  // ---- rendering ----

  private showQueryError(raw: string): void {
    const split = splitSearchQuery(raw ?? '');
    const query = split.query.trim();
    if (!query) {
      // Fall back to the session's persisted-query error (e.g. loaded from a file).
      const persisted = this.opts.queryError;
      if (persisted) {
        this.setError(`${persisted.message} (position ${persisted.position})`);
        return;
      }
      this.setError(null);
      return;
    }
    const parsed = parseQuery(split.query);
    if (parsed.ok) {
      this.setError(null);
      return;
    }
    // Positions refer to the box text, not the extracted query part.
    this.setError(`${parsed.error.message} (position ${toInputPosition(split, parsed.error.position)})`);
  }

  private setError(message: string | null): void {
    this.queryError.textContent = message ?? '';
    this.queryError.hidden = message === null;
    this.searchInput.classList.toggle('tablify__search-input--invalid', message !== null);
  }

  private renderRowCount(): void {
    const { visibleRowCount, totalRowCount } = this.opts;
    const filtered = visibleRowCount !== totalRowCount;
    // Prototype wording (SAD-77): "12 rows", "1 row", "3 rows (of 40)" when filtered.
    const shown = `${visibleRowCount} ${visibleRowCount === 1 ? 'row' : 'rows'}`;
    this.rowCount.textContent = filtered ? `${shown} (of ${totalRowCount})` : shown;
  }

  private setOptionsOpen(open: boolean): void {
    this.optionsPanel.hidden = !open;
    this.optionsButton.setAttribute('aria-expanded', String(open));
    // The popover floats over the grid, so a press anywhere else dismisses it; Escape
    // already does (wireEvents). Listening only while open keeps the cost at zero.
    if (open) document.addEventListener('pointerdown', this.outsideClose);
    else document.removeEventListener('pointerdown', this.outsideClose);
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
