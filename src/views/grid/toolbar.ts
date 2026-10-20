/**
 * Table toolbar — SAD-69 plan item A, plus B (the show-hidden path).
 *
 * This is the file P3-08 specified as its output and that never existed. It is pure DOM:
 * `document.createElement`, no Obsidian imports, exactly like GridView. That matters —
 * it is what makes the toolbar testable in jsdom. The Obsidian-facing layer (TableView)
 * only mounts it and hands it callbacks.
 *
 * Layout follows #toolbarRow (SAD-78, owner decision S-3; reordered in SAD-308): one "Search or
 * query" capsule on the left, then ↶ · ↷ · Add Field · Add Row · Filter · Sync · Options, with
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
import { selectionLabel } from './selection.js';
import { isGroupable } from './grouping.js';
import { MOBILE_PANE_MAX_WIDTH } from '../../model/view.js';
import type { FieldDefinition, SortEntry, ViewDefinition } from '../../model/types.js';

/**
 * Row heights offered in the Options menu.
 * Restricted to the three values tablify.schema.json allows — see columns.ts::setRowHeight.
 * Narrower than the model's RowHeight type on purpose: 'compact' and 'tall' render fine but
 * produce a file the schema rejects, so the UI must never offer them.
 */
export type ToolbarRowHeight = 'small' | 'medium' | 'large';

export const ROW_HEIGHTS: ToolbarRowHeight[] = ['small', 'medium', 'large'];

/** SAD-81: the prototype's Options labels (Short / Medium / Tall) for the schema's three values. */
export const ROW_HEIGHT_LABELS: Record<string, string> = {
  small: 'Short',
  medium: 'Medium',
  large: 'Tall',
};

/** SAD-81: prototype `openPanel` geometry — panel width cap, viewport margins, anchor gap. */
const PANEL_MAX_WIDTH = 320;
const PANEL_GAP = 6;

/** Search-or-query debounce in ms. P3-08 specifies 200 ms (proposed). */
export const DEBOUNCE_MS = 200;

/** Placeholder of the single box: the prototype's wording with a generic example (S-3). */
export const SEARCH_PLACEHOLDER = 'Search or query — e.g. Status:Done Amount:>10';

/** SAD-306: concise mobile placeholder so the example text fits narrow screens (≤ 639px). */
export const MOBILE_SEARCH_PLACEHOLDER = 'Search or query — e.g. Status:Done';

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
  /** SAD-81: the Options switch sends 1 (freeze the primary column) or 0. */
  onFreezeColumns(count: number): void;
  /** Show a previously hidden field again — SAD-69 plan item B. */
  onShowField(fieldId: string): void;
  /** SAD-81: Options → Fields → Hide. Never offered for the primary field (R-D13). */
  onHideField?(fieldId: string): void;
  /** SAD-81: Options → Group by; null = None. */
  onGroupBy?(fieldId: string | null): void;
  /** SAD-81: Options → Sort — the full next sort list (add, flip direction, remove). */
  onSortChange?(sort: SortEntry[]): void;
  onClearFilters(): void;
  onUndo(): void;
  onRedo(): void;
  /** SAD-80: the meta row's Delete — delete every selected row in one undo step. */
  onDeleteSelected?(): void;
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
  /** SAD-80: selected rows that still exist (0 or absent hides the summary). */
  selectedCount?: number;
  /** SAD-113: every field in the table, hidden ones included. Absent hides the field count. */
  totalFieldCount?: number;
  /**
   * COD-72: the table pane is too narrow to freeze (≤ 639px). The switch stays visible but is
   * disabled — the grid never renders the freeze at that width, so an enabled switch would
   * look like a no-op.
   */
  freezeUnavailable?: boolean;
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

/**
 * The font-size each glyph renders at, mirroring `.tablify__btn-icon` in styles.css (10px, and
 * 11px for the Sync / undo / redo / Options pills). `faIcon` needs it to reproduce Font Awesome's
 * rounded icon boxes (SAD-92); `tests/ui/faIconBox.test.ts` fails if these drift from the CSS.
 */
export const ICON_PX: Record<keyof typeof ICONS, number> = {
  search: 12,
  sync: 11,
  undo: 11,
  redo: 11,
  filter: 10,
  plus: 10,
  columns: 10,
  sliders: 11,
};

/** Wrap a glyph in the icon span the styles colour with the accent token. */
function iconSpan(glyph: keyof typeof ICONS): HTMLElement {
  const span = document.createElement('span');
  span.className = 'tablify__btn-icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = faIcon(ICONS[glyph], ICON_PX[glyph]);
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
  deleteSelected: 'delete-selected',
  toggleFreeze: 'toggle-freeze',
} as const;

export class Toolbar {
  root: HTMLElement;

  private readonly opts: ToolbarOptions;
  private readonly searchInput: HTMLInputElement;
  private readonly queryError: HTMLElement;
  private readonly optionsPanel: HTMLElement;
  private readonly optionsButton: HTMLElement;
  private readonly rowCount: HTMLElement;
  /** SAD-113: field count and its separator, shown only when a field count is supplied. */
  private readonly fieldCount: HTMLElement;
  private readonly fieldSep: HTMLElement;
  private readonly selectionSummary: HTMLElement;
  private readonly selectedCount: HTMLElement;
  /** SAD-375: the tool-row scroller and its fade wrapper. */
  private readonly actions: HTMLElement;
  private readonly actionsWrap: HTMLElement;
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
    searchIcon.innerHTML = faIcon(ICONS.search, ICON_PX.search); // inline svg glyph, no external asset
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.className = 'tablify__search-input';
    this.searchInput.placeholder = SEARCH_PLACEHOLDER;
    this.searchInput.setAttribute('aria-label', 'Search or query rows');
    this.searchInput.spellcheck = false;
    this.searchInput.dataset.testid = 'tablify-search';
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(this.searchInput);

    // SAD-308 order: ↶ · ↷ · Add Field · Add Row · Filter · Sync · Options.
    this.actions = document.createElement('div');
    this.actions.className = 'tablify__toolbar-actions';
    this.actions.appendChild(this.makeButton(ACTIONS.undo, '', 'Undo', 'undo'));
    this.actions.appendChild(this.makeButton(ACTIONS.redo, '', 'Redo', 'redo'));
    this.actions.appendChild(this.makeButton(ACTIONS.addField, 'Add Field', 'Add field', 'columns'));
    this.actions.appendChild(this.makeButton(ACTIONS.addRow, 'Add Row', 'Add row', 'plus'));
    const filterButton = this.makeButton(ACTIONS.filter, 'Filter', 'Filter builder', 'filter');
    filterButton.setAttribute('aria-haspopup', 'dialog');
    this.actions.appendChild(filterButton);
    this.actions.appendChild(this.makeButton(ACTIONS.sync, 'Sync', 'Airtable sync for this table', 'sync'));
    this.optionsButton = this.makeButton(ACTIONS.options, 'Options', 'View settings', 'sliders');
    this.optionsButton.setAttribute('aria-haspopup', 'true');
    this.optionsButton.setAttribute('aria-expanded', 'false');
    this.actions.appendChild(this.optionsButton);

    // SAD-375: fade wrapper — the edge fades must sit on a non-scrolling box (plan §3.2).
    this.actionsWrap = document.createElement('div');
    this.actionsWrap.className = 'tablify__toolbar-actions-wrap';
    this.actionsWrap.appendChild(this.actions);

    topRow.appendChild(searchWrap);
    topRow.appendChild(this.actionsWrap);
    this.root.appendChild(topRow);

    // ---- inline query error (the box's `field:value` part) ----
    this.queryError = document.createElement('div');
    this.queryError.className = 'tablify__query-error';
    this.queryError.setAttribute('role', 'alert');
    this.queryError.dataset.testid = 'tablify-query-error';
    this.queryError.hidden = true;
    this.root.appendChild(this.queryError);

    // ---- options popover (view settings) ----
    // SAD-81: the prototype's `#floatPanel` — fixed, anchored under the Options button by
    // positionOptions(). It stays inside the toolbar root so the outside-press check holds.
    this.optionsPanel = document.createElement('div');
    this.optionsPanel.className = 'tablify__options';
    this.optionsPanel.hidden = true;
    this.optionsPanel.dataset.testid = 'tablify-options';
    this.optionsPanel.setAttribute('role', 'dialog');
    this.optionsPanel.setAttribute('aria-label', 'View settings');
    this.root.appendChild(this.optionsPanel);

    // ---- meta row (SAD-77): prototype #metaRow — selection summary left, badges right ----
    const metaRow = document.createElement('div');
    metaRow.className = 'tablify__meta-row';
    // Left slot: the prototype's #selectionSummary — "N selected" and a red Delete (SAD-80).
    // Hidden while nothing is selected.
    const selection = document.createElement('div');
    selection.className = 'tablify__selection-summary';
    selection.dataset.testid = 'tablify-selection-summary';
    selection.hidden = true;
    this.selectedCount = document.createElement('span');
    this.selectedCount.className = 'tablify__selected-count';
    this.selectedCount.setAttribute('aria-live', 'polite');
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'tablify__delete-selected';
    del.dataset.action = ACTIONS.deleteSelected;
    const delIcon = document.createElement('span');
    delIcon.className = 'tablify__delete-selected-icon';
    delIcon.setAttribute('aria-hidden', 'true');
    delIcon.innerHTML = faIcon('trash-can');
    del.appendChild(delIcon);
    del.appendChild(document.createTextNode('Delete'));
    del.title = 'Delete the selected rows';
    del.addEventListener('click', () => this.opts.callbacks.onDeleteSelected?.());
    selection.appendChild(this.selectedCount);
    selection.appendChild(del);
    this.selectionSummary = selection;
    const badges = document.createElement('div');
    badges.className = 'tablify__badges';
    this.rowCount = document.createElement('span');
    this.rowCount.className = 'tablify__rowcount';
    this.rowCount.dataset.testid = 'tablify-rowcount';
    this.rowCount.setAttribute('aria-live', 'polite');
    this.fieldSep = document.createElement('span');
    this.fieldSep.className = 'tablify__badge-sep';
    this.fieldSep.setAttribute('aria-hidden', 'true');
    this.fieldSep.textContent = '·';
    this.fieldCount = document.createElement('span');
    this.fieldCount.className = 'tablify__fieldcount';
    this.fieldCount.dataset.testid = 'tablify-fieldcount';
    this.fieldCount.setAttribute('aria-live', 'polite');
    badges.appendChild(this.rowCount);
    badges.appendChild(this.fieldSep);
    badges.appendChild(this.fieldCount);
    metaRow.appendChild(selection);
    metaRow.appendChild(badges);
    this.root.appendChild(metaRow);

    this.wireEvents();
    window.addEventListener('resize', this.syncPlaceholder);
    window.addEventListener('resize', this.syncFade);
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
    // SAD-109: aria-label alone — Obsidian shows it as the tooltip. A `title` on the same
    // element would show a second, native tooltip.
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
      if (this.handleOptionsClick(target)) return;
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

    // SAD-81: the panel's two selects (Group by, + Add sort…).
    this.optionsPanel.addEventListener('change', (event) => {
      const select = event.target as HTMLSelectElement | null;
      const kind = select?.dataset?.option;
      if (!select || !kind) return;
      if (kind === 'group-by') {
        this.opts.callbacks.onGroupBy?.(select.value || null);
      } else if (kind === 'add-sort' && select.value) {
        const fieldId = select.value;
        select.value = '';
        this.opts.callbacks.onSortChange?.([...this.currentSort(), { fieldId, direction: 'asc' }]);
      }
    });

    // SAD-375: the edge fades follow the tool row's scroll position.
    this.actions.addEventListener('scroll', this.syncFade, { passive: true });
  }

  /** SAD-81: sort entries whose field still exists (prototype skips the rest). */
  private currentSort(): SortEntry[] {
    const ids = new Set(this.opts.fields.map((f) => f.id));
    return (this.opts.view.sort ?? []).filter((s) => ids.has(s.fieldId));
  }

  /** SAD-81: Options panel buttons that are not plain actions. True when handled. */
  private handleOptionsClick(target: HTMLElement): boolean {
    const hide = target.closest<HTMLElement>('[data-hide-field]');
    if (hide?.dataset.hideField) {
      if (!(hide as HTMLButtonElement).disabled) this.opts.callbacks.onHideField?.(hide.dataset.hideField);
      return true;
    }
    const dir = target.closest<HTMLElement>('[data-sort-dir]');
    if (dir?.dataset.sortDir !== undefined) {
      const i = Number(dir.dataset.sortDir);
      const sort = this.currentSort().map((s, j) =>
        j === i ? { ...s, direction: s.direction === 'asc' ? ('desc' as const) : ('asc' as const) } : s,
      );
      this.opts.callbacks.onSortChange?.(sort);
      return true;
    }
    const remove = target.closest<HTMLElement>('[data-sort-remove]');
    if (remove?.dataset.sortRemove !== undefined) {
      const i = Number(remove.dataset.sortRemove);
      this.opts.callbacks.onSortChange?.(this.currentSort().filter((_, j) => j !== i));
      return true;
    }
    return false;
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
      case ACTIONS.toggleFreeze:
        // S-5: an on/off switch for the primary column. Any count ≥ 1 reads as on.
        this.opts.callbacks.onFreezeColumns((this.opts.view.frozenColumns ?? 0) >= 1 ? 0 : 1);
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
    this.opts.selectedCount = state.selectedCount;
    this.opts.totalFieldCount = state.totalFieldCount;
    this.opts.freezeUnavailable = state.freezeUnavailable === true;
    this.syncPlaceholder();
    this.syncFade();
    this.renderSelection();
    this.renderFieldCount();

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
    this.renderFieldCount();
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
    this.actions.removeEventListener('scroll', this.syncFade);
    document.removeEventListener('pointerdown', this.outsideClose);
    window.removeEventListener('resize', this.reposition);
    window.removeEventListener('resize', this.syncPlaceholder);
    window.removeEventListener('resize', this.syncFade);
    this.root.remove();
  }

  // ---- rendering ----

  /** SAD-306: true when the table pane or viewport is at or below the phone breakpoint (≤ 639px). */
  private isMobileWidth(): boolean {
    if (this.opts.freezeUnavailable === true) return true;
    const win = this.root.ownerDocument?.defaultView ?? (typeof window !== 'undefined' ? window : null);
    const w = win?.innerWidth ?? 0;
    return w > 0 && w <= MOBILE_PANE_MAX_WIDTH;
  }

  /** SAD-306: adapt the search box placeholder to mobile vs. desktop widths. */
  private readonly syncPlaceholder = (): void => {
    const next = this.isMobileWidth() ? MOBILE_SEARCH_PLACEHOLDER : SEARCH_PLACEHOLDER;
    if (this.searchInput.placeholder !== next) {
      this.searchInput.placeholder = next;
    }
  };

  /**
   * SAD-375: track the tool row's scroll position for the phone edge fades — the right fade
   * shows while tools remain off-screen, the left one once the row is scrolled. The 1px
   * tolerance absorbs subpixel rounding so the fades never flicker at the exact ends.
   */
  private readonly syncFade = (): void => {
    const el = this.actions;
    const overflow = el.scrollWidth - el.clientWidth;
    const scrollable = overflow > 1;
    this.actionsWrap.classList.toggle('is-fade-end', scrollable && el.scrollLeft < overflow - 1);
    this.actionsWrap.classList.toggle('is-fade-start', scrollable && el.scrollLeft > 1);
  };

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

  /** SAD-80: prototype `#selectionSummary` — shown only while rows are selected. */
  private renderSelection(): void {
    const count = this.opts.selectedCount ?? 0;
    this.selectionSummary.hidden = count === 0;
    const text = selectionLabel(count);
    if (this.selectedCount.textContent !== text) this.selectedCount.textContent = text;
  }

  /** SAD-113: \"N fields\" beside the row count. Hidden when no field count is supplied. */
  private renderFieldCount(): void {
    const n = this.opts.totalFieldCount;
    const show = n !== undefined;
    this.fieldSep.hidden = !show;
    this.fieldCount.hidden = !show;
    if (!show) return;
    const text = `${n} ${n === 1 ? 'field' : 'fields'}`;
    if (this.fieldCount.textContent !== text) this.fieldCount.textContent = text;
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
    if (open) window.addEventListener('resize', this.reposition);
    else window.removeEventListener('resize', this.reposition);
    if (open) this.renderOptions();
  }

  private readonly reposition = (): void => this.positionOptions();

  /**
   * SAD-81: prototype `openPanel` — left-aligned under the button, kept 12px inside the right
   * edge (8px on the left), and flipped above the button when it would run off the bottom.
   * Coordinates are viewport-based; if an ancestor makes `position: fixed` resolve against
   * itself (a transform, e.g. Obsidian's mobile drawers), the measured offset is subtracted.
   */
  private positionOptions(): void {
    const panel = this.optionsPanel;
    if (panel.hidden) return;
    const win = panel.ownerDocument.defaultView ?? window;
    const anchor = this.optionsButton.getBoundingClientRect();
    const pw = Math.min(PANEL_MAX_WIDTH, win.innerWidth - 24);
    const left = Math.max(8, Math.min(anchor.left, win.innerWidth - pw - 12));
    let top = anchor.bottom + PANEL_GAP;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    const box = panel.getBoundingClientRect();
    // Not laid out (jsdom, detached): nothing to correct.
    if (box.width === 0 && box.height === 0) return;
    const dx = box.left - left;
    const dy = box.top - top;
    if (top + box.height > win.innerHeight - 8) top = Math.max(8, anchor.top - box.height - PANEL_GAP);
    panel.style.left = `${left - dx}px`;
    panel.style.top = `${top - dy}px`;
  }

  /**
   * SAD-81: the prototype's View settings panel (`renderOptionsPanel`): row height, freeze
   * switch, Group by, multi-sort list, field visibility, and Clear search & filters. Rebuilt on
   * every update like the prototype's; keyboard focus is carried over to the same control.
   */
  private renderOptions(): void {
    const { view, fields } = this.opts;
    const panel = this.optionsPanel;
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active && panel.contains(active) ? active.dataset.focusKey : undefined;
    panel.textContent = '';
    const inner = document.createElement('div');
    inner.className = 'tablify__options-inner';
    panel.appendChild(inner);

    const title = document.createElement('div');
    title.className = 'tablify__options-title';
    title.textContent = 'View settings';
    inner.appendChild(title);

    // ---- row height ----
    const heightGroup = this.optionGroup(inner, 'option-rowheight', 'Row height');
    const pills = document.createElement('div');
    pills.className = 'tablify__option-pills';
    for (const h of ROW_HEIGHTS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tablify__option-button tablify__option-pill';
      btn.textContent = ROW_HEIGHT_LABELS[h] ?? h;
      btn.dataset.rowHeight = h;
      btn.dataset.focusKey = `rh-${h}`;
      if (view.rowHeight === h) btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', String(view.rowHeight === h));
      pills.appendChild(btn);
    }
    heightGroup.appendChild(pills);

    // ---- freeze primary column (COD-72: on/off; the only freeze control) ----
    const freezeUnavailable = this.opts.freezeUnavailable === true;
    const freezeOn = !freezeUnavailable && (view.frozenColumns ?? 0) >= 1;
    const freezeGroup = document.createElement('div');
    freezeGroup.className = 'tablify__option-group tablify__option-group--inline';
    freezeGroup.dataset.testid = 'option-freeze';
    const freezeLabel = document.createElement('span');
    freezeLabel.className = 'tablify__option-label';
    freezeLabel.id = this.uid('freeze');
    freezeLabel.textContent = 'Freeze primary column';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'tablify__switch';
    toggle.classList.toggle('is-on', freezeOn);
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', String(freezeOn));
    toggle.setAttribute('aria-labelledby', freezeLabel.id);
    toggle.dataset.action = ACTIONS.toggleFreeze;
    toggle.dataset.focusKey = 'freeze';
    if (freezeUnavailable) {
      // SAD-109 pattern: the reason is folded into the aria-label (one tooltip, not a title too).
      toggle.classList.add('tablify__switch--narrow');
      toggle.disabled = true;
      toggle.setAttribute('aria-label', 'Freeze primary column. Not available in a narrow window');
    }
    const knob = document.createElement('span');
    knob.className = 'tablify__switch-knob';
    knob.setAttribute('aria-hidden', 'true');
    toggle.appendChild(knob);
    freezeGroup.appendChild(freezeLabel);
    freezeGroup.appendChild(toggle);
    inner.appendChild(freezeGroup);

    // ---- group by ----
    const groupGroup = this.optionGroup(inner, 'option-groupby', 'Group by');
    const groupSelect = this.optionSelect('group-by', 'Group by');
    groupSelect.appendChild(new Option('None', ''));
    for (const f of fields) {
      // A non-groupable field set by hand stays listed, so the select shows the real state.
      if (!isGroupable(f) && f.id !== view.groupBy) continue;
      groupSelect.appendChild(new Option(f.name, f.id, false, f.id === view.groupBy));
    }
    groupSelect.value = view.groupBy ?? '';
    groupGroup.appendChild(groupSelect);

    // ---- sort (multi — top first) ----
    const sortGroup = this.optionGroup(inner, 'option-sort', 'Sort', '(multi — top first)');
    const sort = this.currentSort();
    sort.forEach((entry, i) => {
      const field = fields.find((f) => f.id === entry.fieldId);
      if (!field) return;
      const row = document.createElement('div');
      row.className = 'tablify__sort-row';
      const name = document.createElement('span');
      name.className = 'tablify__sort-name';
      name.textContent = field.name;
      const dir = document.createElement('button');
      dir.type = 'button';
      dir.className = 'tablify__sort-dir';
      dir.textContent = entry.direction === 'asc' ? 'A→Z' : 'Z→A';
      dir.dataset.sortDir = String(i);
      dir.dataset.focusKey = `sort-dir-${i}`;
      dir.setAttribute('aria-label', `${field.name}: ${entry.direction === 'asc' ? 'ascending' : 'descending'} — reverse`);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tablify__sort-remove';
      remove.innerHTML = faIcon('xmark');
      remove.dataset.sortRemove = String(i);
      remove.dataset.focusKey = `sort-remove-${i}`;
      remove.setAttribute('aria-label', `Remove sort by ${field.name}`);
      row.appendChild(name);
      row.appendChild(dir);
      row.appendChild(remove);
      sortGroup.appendChild(row);
    });
    const addSort = this.optionSelect('add-sort', 'Add sort');
    addSort.appendChild(new Option('+ Add sort…', ''));
    const sorted = new Set(sort.map((s) => s.fieldId));
    for (const f of fields) if (!sorted.has(f.id)) addSort.appendChild(new Option(f.name, f.id));
    addSort.value = '';
    sortGroup.appendChild(addSort);

    // ---- fields: every field in column order, Hide / Show (plan item B lives on here) ----
    const hidden = new Set(view.hidden ?? []);
    const byId = new Map(fields.map((f) => [f.id, f]));
    const order = (view.columnOrder ?? []).filter((id) => byId.has(id));
    for (const f of fields) if (!order.includes(f.id)) order.push(f.id);
    const hiddenCount = order.filter((id) => hidden.has(id)).length;
    const fieldGroup = this.optionGroup(inner, 'tablify-hidden-fields', 'Fields', `(${hiddenCount} hidden)`);
    const list = document.createElement('div');
    list.className = 'tablify__field-list';
    for (const id of order) {
      const field = byId.get(id);
      if (!field) continue;
      const isHidden = hidden.has(id);
      const row = document.createElement('div');
      row.className = 'tablify__field-row';
      row.classList.toggle('is-hidden', isHidden);
      const name = document.createElement('span');
      name.className = 'tablify__field-name';
      name.textContent = field.name;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tablify__option-button tablify__field-toggle';
      btn.dataset.focusKey = `field-${id}`;
      if (isHidden) {
        // A hidden primary field (corrupt file) can still be shown — the recovery path.
        btn.classList.add('is-active');
        btn.textContent = 'Show';
        btn.dataset.showField = id;
        btn.setAttribute('aria-label', `Show field ${field.name}`);
      } else {
        btn.textContent = 'Hide';
        btn.dataset.hideField = id;
        // SAD-109: the disabled reason is folded into the aria-label (one tooltip, not a title too).
        btn.setAttribute('aria-label', `Hide field ${field.name}`);
        if (field.primary) {
          btn.disabled = true;
          btn.setAttribute('aria-label', `Hide field ${field.name}. Primary field cannot be hidden`);
        }
      }
      row.appendChild(name);
      row.appendChild(btn);
      list.appendChild(row);
    }
    fieldGroup.appendChild(list);

    // ---- clear search & filters ----
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'tablify__option-clear';
    clear.dataset.action = ACTIONS.clearFilters;
    clear.dataset.focusKey = 'clear';
    const clearIcon = document.createElement('span');
    clearIcon.className = 'tablify__option-clear-icon';
    clearIcon.setAttribute('aria-hidden', 'true');
    clearIcon.innerHTML = faIcon('filter-circle-xmark');
    clear.appendChild(clearIcon);
    clear.appendChild(document.createTextNode('Clear search & filters'));
    inner.appendChild(clear);

    if (focusKey) {
      const again = Array.from(panel.querySelectorAll<HTMLElement>('[data-focus-key]')).find(
        (el) => el.dataset.focusKey === focusKey,
      );
      again?.focus();
    }
    this.positionOptions();
  }

  /** A labelled panel section (`mb-3` block with a `font-medium` label and optional hint). */
  private optionGroup(parent: HTMLElement, testid: string, label: string, hint?: string): HTMLElement {
    const group = document.createElement('div');
    group.className = 'tablify__option-group';
    group.dataset.testid = testid;
    const head = document.createElement('div');
    head.className = 'tablify__option-label';
    head.textContent = label;
    if (hint) {
      head.appendChild(document.createTextNode(' '));
      const span = document.createElement('span');
      span.className = 'tablify__option-hint';
      span.textContent = hint;
      head.appendChild(span);
    }
    group.appendChild(head);
    parent.appendChild(group);
    return group;
  }

  private optionSelect(kind: string, label: string): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'tablify__option-select';
    select.dataset.option = kind;
    select.dataset.focusKey = kind;
    select.setAttribute('aria-label', label);
    return select;
  }

  private static nextUid = 0;
  private readonly uidBase = `tablify-opt-${++Toolbar.nextUid}`;

  private uid(name: string): string {
    return `${this.uidBase}-${name}`;
  }
}
