/**
 * The country search list (SAD-303), shared by the phone cell panel and the field window.
 *
 * One component, two hosts: the cell panel opens it as its second view, and Add / Modify Field
 * opens it in a popover above the modal. It owns the search box, the rows, the keyboard and the
 * ARIA wiring, and nothing else — it never touches the store, the field or the document.
 *
 * Markup follows the surfaces the plugin already has: `.tablify__dropdown-input` for the search
 * field and `.tablify__dropdown-list` for the scroller (the select panel's own classes), with
 * `.tablify__country-*` for the badge row the select panel has no equivalent for.
 *
 * A "suggested" group is drawn above the full list: the countries a person is most likely to
 * want (the value's own country, the field default, the reader's region), de-duplicated. They
 * also appear in the full list; the group is a shortcut, not a filter.
 */

import { allCountries, countryRow, searchCountries, type CountryRow } from '../../../model/phone/countries.js';
import { faIcon } from '../../../ui/faIcons.js';

export interface CountryListOptions {
  /** BCP-47 tag for country names. Defaults to English. */
  locale?: string;
  /** ISO codes drawn under a "Suggested" heading before the full list. Order is kept. */
  suggested?: readonly string[];
  /** Currently selected ISO code, ticked in the list. */
  selected?: string | null;
  /** A row was chosen (click or Enter). */
  onPick: (row: CountryRow) => void;
  /** Escape, when the list owns the keystroke. */
  onCancel?: () => void;
  placeholder?: string;
  /** Test hook: the id prefix for aria-activedescendant. */
  idPrefix?: string;
}

const ACTIVE_CLASS = 'tablify__dropdown-item--active';

let uid = 0;

export class CountryList {
  private readonly opts: CountryListOptions;
  private readonly locale: string;
  private readonly idPrefix: string;
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private readonly rows: HTMLButtonElement[] = [];
  private selected: string | null;
  private activeIndex = -1;
  private query = '';

  readonly search: HTMLInputElement;

  constructor(options: CountryListOptions) {
    this.opts = options;
    this.locale = options.locale ?? 'en';
    this.selected = options.selected ?? null;
    this.idPrefix = options.idPrefix ?? `tablify-country-${(uid += 1)}`;

    this.root = document.createElement('div');
    this.root.className = 'tablify__country';

    this.search = document.createElement('input');
    this.search.className = 'tablify__dropdown-input';
    this.search.type = 'text';
    this.search.placeholder = options.placeholder ?? 'Search country or +code';
    this.search.setAttribute('aria-label', 'Search country or dialling code');
    this.search.setAttribute('role', 'combobox');
    this.search.setAttribute('aria-expanded', 'true');
    this.search.setAttribute('aria-autocomplete', 'list');
    this.search.setAttribute('autocomplete', 'off');
    this.search.setAttribute('aria-controls', `${this.idPrefix}-list`);
    this.search.addEventListener('input', () => {
      this.query = this.search.value;
      this.render();
    });
    this.search.addEventListener('keydown', (event) => this.onKey(event));

    this.list = document.createElement('div');
    this.list.className = 'tablify__dropdown-list tablify__country-list';
    this.list.id = `${this.idPrefix}-list`;
    this.list.setAttribute('role', 'listbox');
    this.list.setAttribute('aria-label', 'Countries');

    this.root.appendChild(this.search);
    this.root.appendChild(this.list);
    this.render();
  }

  /** The element to place: search box then list. */
  get element(): HTMLElement {
    return this.root;
  }

  /** Mark a country selected (the ticked row). */
  setSelected(iso: string | null): void {
    this.selected = iso;
    this.render();
  }

  /** Focus the search box with the caret at the end. */
  focus(): void {
    this.search.focus();
    const end = this.search.value.length;
    try {
      this.search.setSelectionRange(end, end);
    } catch {
      // Some environments (jsdom without a layout) refuse selection ranges; focus is enough.
    }
  }

  /** Replace the query text without firing an input event. */
  setQuery(text: string): void {
    this.search.value = text;
    this.query = text;
    this.render();
  }

  destroy(): void {
    this.root.remove();
    this.rows.length = 0;
  }

  // ---- rows ---------------------------------------------------------------------------

  /** The suggested codes that actually exist, in the caller's order, without repeats. */
  private suggestedCodes(): string[] {
    const out: string[] = [];
    for (const iso of this.opts.suggested ?? []) {
      const row = countryRow(iso, this.locale);
      if (row && !out.includes(row.iso)) out.push(row.iso);
    }
    return out;
  }

  private rowButton(row: CountryRow, id: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tablify__dropdown-item tablify__country-row';
    button.id = id;
    button.dataset.iso = row.iso;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', row.iso === this.selected ? 'true' : 'false');

    const badge = document.createElement('span');
    badge.className = 'tablify__country-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = row.iso;

    const name = document.createElement('span');
    name.className = 'tablify__country-name';
    name.textContent = row.name;

    const dial = document.createElement('span');
    dial.className = 'tablify__country-dial';
    dial.textContent = `+${row.dial}`;

    button.appendChild(badge);
    button.appendChild(name);
    button.appendChild(dial);

    if (row.iso === this.selected) {
      const check = document.createElement('span');
      check.className = 'tablify__dropdown-check';
      check.innerHTML = faIcon('check', 12);
      button.appendChild(check);
    }
    button.addEventListener('click', () => this.pick(row));
    return button;
  }

  private heading(text: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'tablify__country-heading';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = text;
    return el;
  }

  private render(): void {
    this.list.textContent = '';
    this.rows.length = 0;
    this.activeIndex = -1;

    const typed = this.query.trim();
    const matches = typed === '' ? allCountries(this.locale) : searchCountries(typed, this.locale);

    if (typed === '') {
      const suggested = this.suggestedCodes();
      if (suggested.length > 0) {
        this.list.appendChild(this.heading('Suggested'));
        for (const iso of suggested) {
          const row = countryRow(iso, this.locale);
          if (row) this.appendRow(row);
        }
        this.list.appendChild(this.heading('All countries'));
      }
    }

    for (const row of matches) {
      // A suggested row already drawn above is not repeated in the first screen-full.
      if (typed === '' && this.suggestedCodes().includes(row.iso)) continue;
      this.appendRow(row);
    }

    if (this.rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tablify__dropdown-empty';
      empty.textContent = 'No country matches.';
      this.list.appendChild(empty);
    }
    this.setActive(this.rows.length > 0 ? 0 : -1, false);
  }

  private appendRow(row: CountryRow): void {
    const id = `${this.idPrefix}-row-${row.iso}`;
    const button = this.rowButton(row, id);
    this.list.appendChild(button);
    this.rows.push(button);
  }

  // ---- keyboard -----------------------------------------------------------------------

  private onKey(event: KeyboardEvent): void {
    // IME composition owns these keys while a candidate window is open.
    if (event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = this.activeIndex + delta;
      this.setActive(next < 0 ? this.rows.length - 1 : next >= this.rows.length ? 0 : next);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const active = this.rows[this.activeIndex];
      if (active) this.pickByIso(active.dataset.iso ?? '');
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.opts.onCancel?.();
    }
  }

  private setActive(index: number, scroll = true): void {
    this.activeIndex = index;
    this.rows.forEach((row, i) => row.classList.toggle(ACTIVE_CLASS, i === index));
    const active = this.rows[index];
    if (!active) {
      this.search.removeAttribute('aria-activedescendant');
      return;
    }
    this.search.setAttribute('aria-activedescendant', active.id);
    if (scroll) {
      // jsdom has no layout; scrollIntoView may not exist there.
      (active as HTMLElement & { scrollIntoView?: (o?: unknown) => void }).scrollIntoView?.({ block: 'nearest' });
    }
  }

  private pick(row: CountryRow): void {
    this.selected = row.iso;
    // Repaint the tick in place: a full re-render would jump the scroller back to the top.
    for (const button of this.rows) {
      const chosen = button.dataset.iso === row.iso;
      button.setAttribute('aria-selected', chosen ? 'true' : 'false');
      const existing = button.querySelector('.tablify__dropdown-check');
      if (chosen && !existing) {
        const check = document.createElement('span');
        check.className = 'tablify__dropdown-check';
        check.innerHTML = faIcon('check', 12);
        button.appendChild(check);
      } else if (!chosen) {
        existing?.remove();
      }
    }
    this.opts.onPick(row);
  }

  private pickByIso(iso: string): void {
    const row = countryRow(iso, this.locale);
    if (row) this.pick(row);
  }
}
