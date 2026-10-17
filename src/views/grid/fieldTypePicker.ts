/**
 * The field type picker (COD-76).
 *
 * The Field type row used to be a native `<select>` with `<optgroup>`s. The closed control was the
 * plugin's, but the list that opened was the browser's — or, on Android, the operating system's:
 * outside the DOM, outside the theme, one word per row, and (in Modify) silently missing any type
 * that would drop values. This module is that list, drawn by the plugin.
 *
 * Where it lives: the trigger is an ordinary element in the Add / Modify Field window; the PANEL is
 * appended to `document.body` and positioned against the trigger's rect, exactly like the select,
 * attachment and date panels (`src/views/grid/select/panel.ts`) and for the same two reasons — the
 * window is an `overflow: auto` Obsidian modal that would clip it, and the panel has to sit above
 * the host modal's own layer (z-index 1000, the value the option manager already uses, COD-69).
 *
 * What it may change: `this.type` in the window, through `onChange`. It never touches the model, the
 * save path or the type-change rules — `typeBlockReason` only REPORTS the verdict `planTypeChange`
 * already reached, and a blocked row is `aria-disabled` rather than absent, so the reason can be read.
 *
 * See docs/plans/cod-76-field-type-picker-plan.md and tests/views/grid/fieldTypePicker.test.ts.
 */

import { applyTheme } from '../../ui/theme/tokens.js';
import { faIcon, type FaGlyph } from '../../ui/faIcons.js';
import { CHANGE_TARGET_TYPES, TYPE_LABELS } from '../../menus/tableMenuModel.js';
import type { FieldTypeName } from '../../model/types.js';

/**
 * The prototype's type groups (`FT_GROUPS`), limited to the types a new field can take. System
 * types are not offered (as when changing a type), and the prototype's "(v2)" note is dropped.
 * COD-76 moved this here from AddFieldModal; the window re-exports it so existing imports keep working.
 */
export const TYPE_GROUPS: ReadonlyArray<readonly [string, readonly FieldTypeName[]]> = [
  ['Basic', ['text', 'long_text', 'number', 'currency', 'percent', 'duration', 'rating', 'checkbox']],
  ['Date', ['date', 'date_time']],
  ['Links & contact', ['url', 'email', 'phone']],
  ['Select & attachment', ['single_select', 'multi_select', 'attachment']],
  ['Computed', ['formula', 'link']],
];

/** Where a type that is not a change target (a system field's own type) is shown in Modify. */
const SYSTEM_GROUP = 'System';

export interface FieldTypeMeta {
  /** Glyph already shipped in `src/ui/faIcons.ts` — the SAD-79 type badges, unused since COD-67. */
  icon: FaGlyph;
  /** One line, and every word of it is true of this codebase (see the plan's §3.3 table). */
  description: string;
  /** Extra words the search matches: the word a user actually has in mind. */
  keywords: string;
}

/**
 * Icon, description and search words for every type the picker can draw. Keyed by the model's own
 * type names, so a new type cannot be added to the model without showing up here in a type error.
 */
export const FIELD_TYPE_META: Record<FieldTypeName, FieldTypeMeta> = {
  text: { icon: 'font', description: 'One line of words', keywords: 'string words name title' },
  long_text: { icon: 'align-left', description: 'A paragraph that wraps in the cell', keywords: 'notes paragraph body description' },
  number: { icon: 'hashtag', description: 'Digits, grouped like 1,234,567', keywords: 'integer decimal quantity amount' },
  currency: { icon: 'dollar-sign', description: 'Money, shown to two decimals', keywords: 'price cost money budget salary' },
  percent: { icon: 'percent', description: 'A 0–1 fraction, shown as 25%', keywords: 'rate share ratio' },
  duration: { icon: 'stopwatch', description: 'Stored in milliseconds, shown as 1m 30s', keywords: 'timer hours minutes elapsed' },
  rating: { icon: 'star', description: 'Stars up to the field’s Max, then 4/5', keywords: 'stars score review' },
  checkbox: { icon: 'square-check', description: 'A box you click', keywords: 'boolean done yes no toggle' },
  date: { icon: 'calendar', description: 'A day, yyyy-mm-dd', keywords: 'calendar due day' },
  date_time: { icon: 'clock', description: 'Your clock on screen, UTC in the file', keywords: 'timestamp when schedule clock' },
  url: { icon: 'link', description: 'Opens in your browser', keywords: 'website http hyperlink' },
  email: { icon: 'envelope', description: 'Opens your mail app', keywords: 'mail contact address' },
  phone: { icon: 'phone', description: 'Starts a call', keywords: 'call mobile tel number' },
  single_select: { icon: 'circle-dot', description: 'One chip from a list of options', keywords: 'dropdown tag status option' },
  multi_select: { icon: 'list-check', description: 'One chip per choice', keywords: 'tags dropdown multiple status' },
  attachment: { icon: 'paperclip', description: 'A file already in your vault', keywords: 'file upload pdf image vault' },
  formula: { icon: 'square-root-variable', description: 'Computed from other fields, read-only', keywords: 'calculate expression computed' },
  link: { icon: 'diagram-project', description: 'Rows in another table', keywords: 'relation reference relate' },
  // System types are never offered, but a field that already has one shows it in Modify.
  auto_number: { icon: 'arrow-down-1-9', description: 'A number the table assigns, read-only', keywords: 'sequence numbering row' },
  created_time: { icon: 'calendar-plus', description: 'When the row was created, read-only', keywords: 'timestamp created' },
  modified_time: { icon: 'calendar-check', description: 'When the row last changed, read-only', keywords: 'timestamp modified updated' },
};

/** Data the picker needs from the window it is mounted in. */
export interface FieldTypePickerOptions {
  /** The type to show in the trigger. */
  value: FieldTypeName;
  /**
   * True in Modify mode. Only then can a row be blocked: in create mode every type is available,
   * which is the same guarantee the native select gave.
   */
  edit?: boolean;
  /**
   * Modify mode: why a type cannot be picked, or null. The window passes `planTypeChange`'s own
   * `reason`, so the sentence in the row is the sentence the model would have used.
   */
  typeBlockReason?: (type: FieldTypeName) => string | null;
  /**
   * Modify mode, older callers: whether a type may be offered at all. Used only when the caller did
   * not pass `typeBlockReason`; a refusal becomes a generic greyed row rather than a vanished one.
   */
  canPickType?: (type: FieldTypeName) => boolean;
  /** Called with the picked type. The window sets `this.type` here and nothing else. */
  onChange: (type: FieldTypeName) => void;
  /** `light` / `dark`; defaults to the host's `theme-dark` class, as the other panels do. */
  theme?: 'light' | 'dark';
  /** The trigger's id — `tablify__af-type` keeps the element findable by tests and capture scripts. */
  id?: string;
}

function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/** The pixel height the list may take before it scrolls (mirrors the plan's spec table). */
const LIST_MAX = 348;
/** The least room the list is ever squeezed into before the panel gives up on a side. */
const LIST_MIN = 120;

export class FieldTypePicker {
  private readonly opts: FieldTypePickerOptions;
  private readonly trigger: HTMLButtonElement;
  private readonly theme: 'light' | 'dark';
  private panel: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private searchEl: HTMLInputElement | null = null;
  private countEl: HTMLElement | null = null;
  private current: FieldTypeName;
  private activeId: FieldTypeName | null = null;
  private query = '';
  private unwire: (() => void) | null = null;

  constructor(opts: FieldTypePickerOptions) {
    this.opts = opts;
    this.current = opts.value;
    this.theme = opts.theme ?? (document.body.classList.contains('theme-dark') ? 'dark' : 'light');
    this.trigger = this.buildTrigger();
  }

  /** The trigger element; the window mounts it in the Field type row. */
  get element(): HTMLElement {
    return this.trigger;
  }

  /** The type on show. Reads back what the window would commit. */
  get value(): FieldTypeName {
    return this.current;
  }

  /** True while the list is on screen (tests and the window's Escape handling). */
  get isOpen(): boolean {
    return this.panel !== null;
  }

  // ---------------------------------------------------------------- the closed row

  private buildTrigger(): HTMLButtonElement {
    const b = el('button', 'tablify__tp-trigger') as HTMLButtonElement;
    b.type = 'button';
    if (this.opts.id) b.id = this.opts.id;
    b.setAttribute('aria-haspopup', 'dialog');
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', () => (this.panel ? this.close() : this.open()));
    b.addEventListener('keydown', (ev) => {
      if (this.panel) return;
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        this.open();
        return;
      }
      // A printable character opens the list with that character already in the search —
      // the behaviour a native <select> has, and the fastest way in with a keyboard.
      if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        this.open(ev.key);
      }
    });
    // `this.trigger` is not assigned yet while the constructor builds it, so paint the node itself.
    this.paintTrigger(b);
    return b;
  }

  private paintTrigger(target: HTMLElement = this.trigger): void {
    const meta = FIELD_TYPE_META[this.current];
    target.innerHTML =
      `<span class="tablify__tp-glyph" aria-hidden="true">${faIcon(meta.icon, 13)}</span>` +
      `<span class="tablify__tp-name"></span>` +
      `<span class="tablify__tp-chevron" aria-hidden="true">${faIcon('chevron-down', 11)}</span>`;
    const name = target.querySelector('.tablify__tp-name');
    if (name) name.textContent = TYPE_LABELS[this.current] ?? this.current;
    target.setAttribute('aria-label', `Field type: ${TYPE_LABELS[this.current] ?? this.current}`);
  }

  // ---------------------------------------------------------------- open / close

  /** Open the list. `seed` pre-fills the search (the printable-character path). */
  open(seed = ''): void {
    if (this.panel) return;
    const panel = el('div', 'tablify__tp-panel');
    panel.dataset.testid = 'tablify-field-type-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-label', 'Choose a field type');
    applyTheme(panel, this.theme);

    // Search row
    const search = el('div', 'tablify__tp-search');
    search.innerHTML = `<span class="tablify__tp-search-glyph" aria-hidden="true">${faIcon('magnifying-glass', 11)}</span>`;
    const input = el('input', 'tablify__tp-input') as HTMLInputElement;
    input.type = 'text';
    input.placeholder = 'Search field types…';
    input.setAttribute('aria-label', 'Search field types');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', 'tablify__tp-list');
    input.setAttribute('aria-autocomplete', 'list');
    input.autocomplete = 'off';
    input.value = seed;
    const clear = el('button', 'tablify__tp-clear') as HTMLButtonElement;
    clear.type = 'button';
    clear.setAttribute('aria-label', 'Clear search');
    clear.innerHTML = faIcon('xmark', 8);
    clear.hidden = seed === '';
    search.append(input, clear);

    // List
    const list = el('div', 'tablify__tp-list');
    list.id = 'tablify__tp-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Field types');

    // Hint bar
    const hint = el('div', 'tablify__tp-hint');
    hint.innerHTML =
      '<span><kbd>↑</kbd><kbd>↓</kbd> move</span>' +
      '<span><kbd>↵</kbd> choose</span>' +
      '<span><kbd>esc</kbd> close</span>';
    const count = el('span', 'tablify__tp-count');
    hint.append(count);

    panel.append(search, list, hint);

    this.panel = panel;
    this.listEl = list;
    this.searchEl = input;
    this.countEl = count;
    this.query = seed;
    this.trigger.setAttribute('aria-expanded', 'true');
    this.trigger.setAttribute('aria-controls', `tablify__tp-list`);

    document.body.appendChild(panel);
    this.render();
    this.position();
    this.focusOnOpen();

    input.addEventListener('input', () => {
      this.query = input.value;
      clear.hidden = input.value === '';
      this.render();
      this.setActive(this.firstPickable(), false);
    });
    clear.addEventListener('click', () => {
      input.value = '';
      this.query = '';
      clear.hidden = true;
      this.render();
      this.setActive(this.firstPickable(), false);
      input.focus();
    });
    panel.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement;
      if (target.closest('[data-clear]')) {
        input.value = '';
        this.query = '';
        clear.hidden = true;
        this.render();
        input.focus();
        return;
      }
      const row = target.closest('[data-type]') as HTMLElement | null;
      if (row) this.pick(row.dataset.type as FieldTypeName);
    });
    panel.addEventListener('keydown', (ev) => this.onKey(ev));

    this.unwire = this.wireDismiss();
  }

  close(): void {
    if (!this.panel) return;
    this.unwire?.();
    this.unwire = null;
    this.panel.remove();
    this.panel = null;
    this.listEl = null;
    this.searchEl = null;
    this.countEl = null;
    this.activeId = null;
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.removeAttribute('aria-controls');
  }

  /** Close and repaint from the outside (the window closing mid-pick). */
  setValue(type: FieldTypeName): void {
    this.current = type;
    this.paintTrigger();
    if (this.panel) this.render();
  }

  // ---------------------------------------------------------------- picking

  private pick(type: FieldTypeName): void {
    if (this.blockReason(type)) return;
    this.current = type;
    this.paintTrigger();
    this.close();
    this.trigger.focus();
    this.opts.onChange(type);
  }

  /** A row that would drop values keeps its place and says why — never silently absent. */
  private blockReason(type: FieldTypeName): string | null {
    if (!this.opts.edit || type === this.current) return null;
    if (this.opts.typeBlockReason) return this.opts.typeBlockReason(type);
    if (this.opts.canPickType && !this.opts.canPickType(type)) return 'Not available for this field';
    return null;
  }

  // ---------------------------------------------------------------- rendering

  /** The groups to draw, in the model's order, with the field's own system type appended. */
  private groups(): Array<readonly [string, readonly FieldTypeName[]]> {
    const out = TYPE_GROUPS.map(([label, types]) => [label, types.filter((t) => CHANGE_TARGET_TYPES.includes(t))] as const).filter(
      ([, types]) => types.length > 0,
    );
    // A field whose type is not a change target (auto number, created time…) still has to show its
    // own type in Modify mode rather than silently reading as Text.
    if (this.opts.edit && !CHANGE_TARGET_TYPES.includes(this.current)) {
      out.push([SYSTEM_GROUP, [this.current]] as const);
    }
    return out;
  }

  private matches(type: FieldTypeName): boolean {
    const q = this.query.trim().toLowerCase();
    if (!q) return true;
    const meta = FIELD_TYPE_META[type];
    const label = TYPE_LABELS[type] ?? type;
    return `${label} ${meta.description} ${meta.keywords}`.toLowerCase().includes(q);
  }

  private rows(): HTMLElement[] {
    return this.listEl ? Array.from(this.listEl.querySelectorAll<HTMLElement>('[data-type]')) : [];
  }

  private pickable(): HTMLElement[] {
    return this.rows().filter((r) => r.getAttribute('aria-disabled') !== 'true');
  }

  private firstPickable(): FieldTypeName | null {
    const first = this.pickable()[0];
    return first ? (first.dataset.type as FieldTypeName) : null;
  }

  private render(): void {
    const list = this.listEl;
    if (!list) return;
    list.textContent = '';
    let shown = 0;
    for (const [label, types] of this.groups()) {
      const visible = types.filter((t) => this.matches(t));
      if (visible.length === 0) continue;
      const group = el('div', 'tablify__tp-group');
      const heading = el('span', 'tablify__tp-group-name');
      heading.id = `tablify__tp-group-${label.toLowerCase().replace(/\W+/g, '-')}`;
      heading.textContent = label;
      group.setAttribute('role', 'group');
      group.setAttribute('aria-labelledby', heading.id);
      group.appendChild(heading);
      list.appendChild(group);
      const holder = el('div', 'tablify__tp-groupbody');
      for (const type of visible) {
        holder.appendChild(this.row(type, group.id));
        shown += 1;
      }
      list.appendChild(holder);
    }
    if (shown === 0) {
      const empty = el('div', 'tablify__tp-empty');
      const p = el('p');
      p.textContent = `No field type matches “${this.query.trim()}”.`;
      const button = el('button', 'tablify__tp-empty-btn') as HTMLButtonElement;
      button.type = 'button';
      button.dataset.clear = 'true';
      button.textContent = 'Clear search';
      empty.append(p, button);
      list.appendChild(empty);
    }
    if (this.countEl) {
      this.countEl.textContent = shown === 0 ? 'no match' : `${shown} type${shown === 1 ? '' : 's'}`;
    }
    if (this.activeId) this.setActive(this.activeId, false);
  }

  private row(type: FieldTypeName, groupId: string): HTMLElement {
    const meta = FIELD_TYPE_META[type];
    const reason = this.blockReason(type);
    const row = el('button', 'tablify__tp-row') as HTMLButtonElement;
    row.type = 'button';
    row.dataset.type = type;
    row.id = `tablify__tp-${type}`;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(type === this.current));
    if (type === this.current) {
      row.classList.add('tablify__tp-row--current');
      row.setAttribute('aria-current', 'true');
    }
    if (reason) {
      row.setAttribute('aria-disabled', 'true');
      row.classList.add('tablify__tp-row--blocked');
    }
    row.setAttribute('aria-describedby', `${groupId}`);
    row.innerHTML =
      `<span class="tablify__tp-row-glyph" aria-hidden="true">${faIcon(meta.icon, 13)}</span>` +
      '<span class="tablify__tp-row-text">' +
      `<span class="tablify__tp-row-name"></span>` +
      `<span class="tablify__tp-row-desc${reason ? ' tablify__tp-row-desc--blocked' : ''}"></span>` +
      '</span>' +
      `<span class="tablify__tp-row-check" aria-hidden="true">${type === this.current ? faIcon('check', 11) : ''}</span>`;
    const name = row.querySelector('.tablify__tp-row-name');
    if (name) name.textContent = TYPE_LABELS[type] ?? type;
    const desc = row.querySelector('.tablify__tp-row-desc');
    if (desc) desc.textContent = reason ?? meta.description;
    if (reason) row.title = reason;
    return row;
  }

  private setActive(type: FieldTypeName | null, scroll = true): void {
    this.activeId = type;
    for (const row of this.rows()) row.classList.toggle('tablify__tp-row--active', row.dataset.type === type);
    this.updateActiveDescendant();
    if (!scroll || !type) return;
    const active = this.listEl?.querySelector('.tablify__tp-row--active') as HTMLElement | null;
    if (active && typeof active.scrollIntoView === 'function') active.scrollIntoView({ block: 'nearest' });
  }

  private updateActiveDescendant(): void {
    if (!this.searchEl) return;
    if (this.activeId) this.searchEl.setAttribute('aria-activedescendant', `tablify__tp-${this.activeId}`);
    else this.searchEl.removeAttribute('aria-activedescendant');
  }

  // ---------------------------------------------------------------- keyboard

  private onKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      // The window is an Obsidian modal whose own Escape closes it: stop here so the picker
      // closes first, and only the picker.
      ev.preventDefault();
      ev.stopPropagation();
      this.close();
      this.trigger.focus();
      return;
    }
    if (ev.key === 'Tab') {
      // Close, then let focus move on through the window — a popup must never trap Tab.
      this.close();
      this.trigger.focus();
      ev.stopPropagation();
      return;
    }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      ev.stopPropagation();
      const rows = this.pickable();
      if (rows.length === 0) return;
      const index = rows.findIndex((r) => r.dataset.type === this.activeId);
      const next = ev.key === 'ArrowDown' ? (index + 1) % rows.length : (index - 1 + rows.length) % rows.length;
      this.setActive(rows[next < 0 ? 0 : next].dataset.type as FieldTypeName);
      return;
    }
    if (ev.key === 'PageDown' || ev.key === 'PageUp') {
      ev.preventDefault();
      const rows = this.pickable();
      if (rows.length === 0) return;
      const index = rows.findIndex((r) => r.dataset.type === this.activeId);
      const step = ev.key === 'PageDown' ? 5 : -5;
      const next = Math.min(rows.length - 1, Math.max(0, (index < 0 ? 0 : index) + step));
      this.setActive(rows[next].dataset.type as FieldTypeName);
      return;
    }
    if (ev.key === 'Home' || ev.key === 'End') {
      ev.preventDefault();
      const rows = this.pickable();
      if (rows.length === 0) return;
      this.setActive((ev.key === 'Home' ? rows[0] : rows[rows.length - 1]).dataset.type as FieldTypeName);
      return;
    }
    if (ev.key === 'Enter') {
      // Enter must never reach the window: AddFieldModal submits on Enter in an input.
      ev.preventDefault();
      ev.stopPropagation();
      if (this.activeId) this.pick(this.activeId);
    }
  }

  // ---------------------------------------------------------------- placement

  /**
   * Anchor the panel to the trigger: trigger width, 6 px below, and never off screen.
   *
   * The list is capped to the room the chosen side actually has — a shorter list is better than a
   * panel hanging off the bottom of the screen — and the side itself is chosen by that room, so a
   * phone flips the panel above the trigger instead of covering it. `z-index: 1000` is COD-69's
   * value for "above the host modal's layer".
   */
  private position(): void {
    const panel = this.panel;
    if (!panel) return;
    const r = this.trigger.getBoundingClientRect();
    const vw = window.innerWidth || 1024;
    const vh = window.innerHeight || 768;
    const width = Math.min(r.width || 320, vw - 32);
    const left = Math.max(8, Math.min(r.left, vw - width - 12));

    panel.style.position = 'fixed';
    panel.style.width = `${width}px`;
    panel.style.left = `${left}px`;
    panel.style.zIndex = '1000';

    // Everything in the panel that is not the list: the search row, the hint bar, two borders.
    const CHROME = 86;
    const below = vh - 8 - (r.bottom + 6) - CHROME;
    const above = r.top - 6 - 8 - CHROME;
    const flip = above > below && above >= LIST_MIN;
    const listMax = Math.max(LIST_MIN, Math.min(LIST_MAX, flip ? above : below, Math.floor(vh * 0.45)));
    if (this.listEl) this.listEl.style.maxHeight = `${listMax}px`;

    const height = panel.getBoundingClientRect().height;
    const top = flip
      ? Math.max(8, r.top - height - 6)
      : Math.min(r.bottom + 6, Math.max(8, vh - height - 8));
    panel.style.top = `${top}px`;
  }

  /** Focus the search unless the pointer is coarse: on a phone the keyboard would cover the list. */
  private focusOnOpen(): void {
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    if (coarse) {
      // Scroll the current type's group to the top instead, so the list opens where the value is.
      const current = this.listEl?.querySelector('.tablify__tp-row--current') as HTMLElement | null;
      const group = current?.closest('.tablify__tp-group') as HTMLElement | null;
      if (this.listEl && group) this.listEl.scrollTop = Math.max(0, group.offsetTop - 2);
      this.setActive(this.current, false);
      return;
    }
    this.setActive(this.current, false);
    this.searchEl?.focus();
    const current = this.listEl?.querySelector('.tablify__tp-row--current') as HTMLElement | null;
    const group = current?.closest('.tablify__tp-group') as HTMLElement | null;
    if (this.listEl && group) this.listEl.scrollTop = Math.max(0, group.offsetTop - 2);
  }

  /** Press outside closes; resize and any scroll (the modal's own scroller included) re-anchor. */
  private wireDismiss(): () => void {
    const onPress = (ev: Event): void => {
      const target = ev.target as Node;
      if (!this.panel || this.panel.contains(target)) return;
      // The trigger's own click toggles; closing here first would make it close then reopen.
      if (this.trigger.contains(target)) return;
      this.close();
    };
    const onMove = (): void => this.position();
    document.addEventListener('pointerdown', onPress, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('pointerdown', onPress, true);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }
}
