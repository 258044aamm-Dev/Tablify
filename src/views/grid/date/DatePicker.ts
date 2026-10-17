/**
 * COD-75: the date & time panel.
 *
 * Before this, `date` and `date_time` cells opened an `<input type="date">` /
 * `<input type="datetime-local">` whose calendar was **Chromium's own** — outside the DOM, outside
 * the plugin's theme, and on Android the OS dialog. It cannot be styled, so the window had to
 * become ours.
 *
 * The card is the prototype's `#floatPanel` (the one the select and attachment panels use):
 * 320 px, radius 16, `--tablify-bg-pill`, 6 px under the cell, flipped above it near the bottom
 * edge. Only the inside is new.
 *
 * Everything the buttons mean lives in `draft.ts`; this class owns the DOM, focus and dismissal.
 * Nothing here touches the store — the host passes `onCommit`, so the write is still exactly one
 * `setValue` command, one undo step, in `tableView.ts`.
 */

import { faIcon } from '../../../ui/faIcons.js';
import type { CellValue, FieldDefinition } from '../../../model/types.js';
import { anchorPanel, createPanelCard } from '../select/panel.js';
import {
  addDays,
  addMonths,
  dayLabel,
  daysInMonth,
  formatYmd,
  gridFor,
  localeWeekStart,
  monthLabel,
  sameDay,
  weekdayLabels,
  type DateParts,
} from './calendar.js';
import { DateDraft, type DateTimeType } from './draft.js';

export interface DatePickerOptions {
  field: FieldDefinition;
  value: CellValue | undefined;
  theme?: 'light' | 'dark';
  /** First day of the week (0 = Sunday). Defaults to the locale's. */
  weekStart?: number;
  /** The clock. Injectable so the tests can pin "now"; the plugin never passes it. */
  now?: () => Date;
  /** The value to store. The host writes it (one undo step) and returns focus to the grid. */
  onCommit: (value: CellValue) => void;
  /** Escape, or a dismissal the host must not write. */
  onCancel?: () => void;
}

let uid = 0;

const pad2 = (n: number): string => String(n).padStart(2, '0');

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function makeButton(className: string, label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.setAttribute('aria-label', label);
  return b;
}

export class DatePicker {
  private readonly opts: DatePickerOptions;
  private readonly type: DateTimeType;
  private readonly weekStart: number;
  private readonly now: () => Date;
  private readonly card: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly error: HTMLElement;
  private readonly title: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly hh: HTMLInputElement | null;
  private readonly mm: HTMLInputElement | null;
  private readonly ids = { error: `tablify-date-error-${(uid += 1)}`, title: `tablify-date-title-${uid}` };
  private draft: DateDraft;
  private view: { year: number; month: number };
  private focusDate: DateParts;
  private invalid = false;
  private closed = false;
  private unwire: (() => void) | null = null;

  constructor(options: DatePickerOptions) {
    this.opts = options;
    this.type = options.field.type === 'date' ? 'date' : 'date_time';
    this.weekStart = options.weekStart ?? localeWeekStart();
    this.now = options.now ?? (() => new Date());
    this.draft = DateDraft.fromStored(this.type, options.value, this.now);
    this.view = { year: this.draft.dateParts.year, month: this.draft.dateParts.month };
    this.focusDate = this.draft.dateParts;

    const { card, body } = createPanelCard('tablify-date-panel', options.theme ?? 'light', 'tablify__date-body');
    this.card = card;
    this.card.classList.add('tablify__date-panel');
    this.card.setAttribute('aria-label', this.type === 'date' ? 'Pick a date' : 'Pick a date and time');

    // ---- value field ----
    const field = el('div', 'tablify__date-field');
    this.input = document.createElement('input');
    this.input.className = 'tablify__date-input';
    this.input.type = 'text';
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';
    this.input.value = this.draft.text;
    this.input.placeholder = this.type === 'date' ? 'No date' : 'No date and time';
    this.input.setAttribute('aria-label', this.type === 'date' ? 'Date' : 'Date and time');
    this.input.setAttribute('aria-describedby', this.ids.error);
    this.input.addEventListener('input', () => this.onTextInput());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this.commit();
      }
    });
    const glyph = el('span', 'tablify__date-glyph');
    glyph.setAttribute('aria-hidden', 'true');
    glyph.innerHTML = faIcon('calendar', 14);
    field.appendChild(this.input);
    field.appendChild(glyph);

    this.error = el('div', 'tablify__date-error');
    this.error.id = this.ids.error;
    this.error.setAttribute('role', 'status');
    this.error.hidden = true;

    // ---- month header ----
    const head = el('div', 'tablify__date-head');
    const prev = makeButton('tablify__date-nav', 'Previous month');
    prev.innerHTML = faIcon('chevron-left', 11);
    prev.addEventListener('click', () => this.stepMonth(-1));
    const next = makeButton('tablify__date-nav', 'Next month');
    next.innerHTML = faIcon('chevron-right', 11);
    next.addEventListener('click', () => this.stepMonth(1));
    this.title = el('div', 'tablify__date-month');
    this.title.id = this.ids.title;
    this.title.setAttribute('aria-live', 'polite');
    head.appendChild(prev);
    head.appendChild(this.title);
    head.appendChild(next);

    // ---- calendar ----
    this.grid = el('div', 'tablify__date-grid');
    this.grid.setAttribute('role', 'grid');
    this.grid.setAttribute('aria-labelledby', this.ids.title);

    // ---- time row (date_time only) ----
    let timeRow: HTMLElement | null = null;
    if (this.type === 'date_time') {
      timeRow = el('div', 'tablify__date-time');
      const label = el('span', 'tablify__date-time-label');
      label.textContent = 'Time';
      const capsule = el('div', 'tablify__date-clock');
      this.hh = this.clockInput('Hours', 23);
      this.mm = this.clockInput('Minutes', 59);
      const colon = el('span', 'tablify__date-colon');
      colon.textContent = ':';
      colon.setAttribute('aria-hidden', 'true');
      capsule.appendChild(this.hh);
      capsule.appendChild(colon);
      capsule.appendChild(this.mm);
      const now = makeButton('tablify__date-now', 'Now');
      now.textContent = 'Now';
      now.addEventListener('click', () => this.setNow());
      timeRow.appendChild(label);
      timeRow.appendChild(capsule);
      timeRow.appendChild(now);
    } else {
      this.hh = null;
      this.mm = null;
    }

    // ---- footer ----
    const foot = el('div', 'tablify__date-foot');
    const today = makeButton('tablify__date-quiet', 'Today');
    today.textContent = 'Today';
    today.addEventListener('click', () => this.setToday());
    const clear = makeButton('tablify__date-quiet tablify__date-quiet--danger', 'Clear');
    clear.textContent = 'Clear';
    clear.addEventListener('click', () => {
      this.draft.clear();
      this.commit();
    });
    const done = makeButton('tablify__date-done', 'Done');
    done.textContent = 'Done';
    done.addEventListener('click', () => this.commit());
    foot.appendChild(today);
    foot.appendChild(clear);
    foot.appendChild(done);

    body.appendChild(field);
    body.appendChild(this.error);
    body.appendChild(head);
    body.appendChild(this.grid);
    if (timeRow) body.appendChild(timeRow);
    body.appendChild(foot);

    this.render();
  }

  get element(): HTMLElement {
    return this.card;
  }

  /** Anchor under the cell, take over dismissal, and put the caret in the value field. */
  open(anchor: HTMLElement): void {
    if (this.closed) return;
    document.body.appendChild(this.card);
    anchorPanel(this.card, anchor);
    const onPress = (ev: Event): void => {
      if (!this.card.contains(ev.target as Node)) this.commit();
    };
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.cancel();
      }
    };
    document.addEventListener('mousedown', onPress);
    document.addEventListener('touchstart', onPress, { passive: true });
    document.addEventListener('keydown', onKey);
    this.unwire = () => {
      document.removeEventListener('mousedown', onPress);
      document.removeEventListener('touchstart', onPress);
      document.removeEventListener('keydown', onKey);
    };
    this.input.focus();
    this.input.select();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.unwire?.();
    this.unwire = null;
    this.card.remove();
  }

  // ---- actions ---------------------------------------------------------------------------

  private commit(): void {
    if (this.closed || this.invalid) return;
    const value = this.draft.toStored();
    this.close();
    this.opts.onCommit(value);
  }

  private cancel(): void {
    if (this.closed) return;
    this.close();
    this.opts.onCancel?.();
  }

  private pick(parts: DateParts): void {
    this.draft.pickDay(parts.year, parts.month, parts.day);
    this.focusDate = parts;
    if (this.type === 'date') {
      this.commit();
      return;
    }
    this.view = { year: parts.year, month: parts.month };
    this.render();
    this.focusDay(parts);
  }

  private setNow(): void {
    this.draft.setNow();
    const parts = this.draft.dateParts;
    this.focusDate = parts;
    this.view = { year: parts.year, month: parts.month };
    this.render();
  }

  private setToday(): void {
    this.draft.setToday();
    const parts = this.draft.dateParts;
    this.focusDate = parts;
    this.view = { year: parts.year, month: parts.month };
    if (this.type === 'date') {
      this.commit();
      return;
    }
    this.render();
    this.focusDay(parts);
  }

  private stepMonth(delta: number): void {
    this.view = addMonths(this.view.year, this.view.month, delta);
    // Keep the roving tab stop on a day that is on screen; the 31st does not exist in February.
    this.focusDate = {
      year: this.view.year,
      month: this.view.month,
      day: Math.min(this.focusDate.day, daysInMonth(this.view.year, this.view.month)),
    };
    const hadFocus = this.grid.contains(document.activeElement as unknown as Node);
    this.renderCalendar();
    if (hadFocus) this.focusDay(this.focusDate);
  }

  // ---- input handling --------------------------------------------------------------------

  private onTextInput(): void {
    const result = this.draft.setText(this.input.value);
    if (!result.ok) {
      this.invalid = true;
      this.input.setAttribute('aria-invalid', 'true');
      this.showError(result.error);
      return;
    }
    this.invalid = false;
    this.input.removeAttribute('aria-invalid');
    this.showError(null);
    const parts = this.draft.dateParts;
    this.focusDate = parts;
    this.view = { year: parts.year, month: parts.month };
    this.renderCalendar();
    this.syncClock();
  }

  private clockInput(label: string, max: number): HTMLInputElement {
    const input = document.createElement('input');
    input.className = 'tablify__date-clock-input';
    input.type = 'text';
    input.inputMode = 'numeric';
    input.maxLength = 2;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', label);
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 2);
      this.applyClock();
    });
    input.addEventListener('change', () => this.normalizeClock());
    input.addEventListener('blur', () => this.normalizeClock());
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const step = e.key === 'ArrowUp' ? 1 : -1;
      const current = Number(input.value || '0');
      const next = (current + step + (max + 1)) % (max + 1);
      input.value = pad2(next);
      this.applyClock(true);
    });
    return input;
  }

  private applyClock(fillEmpty = false): void {
    if (!this.hh || !this.mm) return;
    const h = this.hh.value === '' ? (fillEmpty ? 0 : NaN) : Number(this.hh.value);
    const m = this.mm.value === '' ? (fillEmpty ? 0 : NaN) : Number(this.mm.value);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    if (h > 23 || m > 59) return;
    this.draft.setTime(h, m);
    this.syncInput();
    this.renderCalendar();
  }

  private normalizeClock(): void {
    if (!this.hh || !this.mm) return;
    const rawH = Number(this.hh.value);
    const rawM = Number(this.mm.value);
    const h = Number.isNaN(rawH) ? 0 : Math.min(23, Math.max(0, Math.trunc(rawH)));
    const m = Number.isNaN(rawM) ? 0 : Math.min(59, Math.max(0, Math.trunc(rawM)));
    this.hh.value = pad2(h);
    this.mm.value = pad2(m);
    this.draft.setTime(h, m);
    this.syncClock();
    this.syncInput();
    this.renderCalendar();
  }

  private onGridKey(ev: KeyboardEvent, parts: DateParts): void {
    const key = ev.key;
    let next: DateParts | null = null;
    if (key === 'ArrowLeft') next = addDays(parts, -1);
    else if (key === 'ArrowRight') next = addDays(parts, 1);
    else if (key === 'ArrowUp') next = addDays(parts, -7);
    else if (key === 'ArrowDown') next = addDays(parts, 7);
    else if (key === 'Home') next = addDays(parts, -this.columnOf(parts));
    else if (key === 'End') next = addDays(parts, 6 - this.columnOf(parts));
    else if (key === 'PageUp' || key === 'PageDown') {
      const months = key === 'PageUp' ? -1 : 1;
      const target = addMonths(parts.year, parts.month, ev.shiftKey ? months * 12 : months);
      next = { year: target.year, month: target.month, day: Math.min(parts.day, daysInMonth(target.year, target.month)) };
    } else if (key === 'Enter' || key === ' ') {
      ev.preventDefault();
      this.pick(parts);
      return;
    }
    if (!next) return;
    ev.preventDefault();
    this.focusDate = next;
    this.view = { year: next.year, month: next.month };
    this.renderCalendar();
    this.focusDay(next);
  }

  private columnOf(parts: DateParts): number {
    const weekday = new Date(parts.year, parts.month, parts.day, 12).getDay();
    return (weekday - this.weekStart + 7) % 7;
  }

  private focusDay(parts: DateParts): void {
    const button = this.grid.querySelector(`[data-date="${formatYmd(parts)}"]`) as HTMLElement | null;
    button?.focus();
  }

  // ---- rendering -------------------------------------------------------------------------

  private showError(message: string | null): void {
    this.error.textContent = message ?? '';
    this.error.hidden = message === null;
  }

  private render(): void {
    this.syncInput();
    this.syncClock();
    this.renderCalendar();
  }

  private syncInput(): void {
    // Always mirror the draft: the only writer that must not be clobbered is the field itself,
    // and its own input handler never calls render().
    this.input.value = this.draft.text;
  }

  private syncClock(): void {
    if (!this.hh || !this.mm) return;
    const t = this.draft.timeParts;
    this.hh.value = pad2(t.hours);
    this.mm.value = pad2(t.minutes);
  }

  private renderCalendar(): void {
    this.title.textContent = '';
    const month = el('span', 'tablify__date-month-name');
    month.textContent = monthLabel(this.view.month);
    const year = el('span', 'tablify__date-year');
    year.textContent = String(this.view.year);
    this.title.append(month, year);

    const today = this.now();
    const todayParts: DateParts = { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() };
    const selected = this.draft.hasDate ? this.draft.dateParts : null;

    this.grid.textContent = '';

    const headRow = el('div', 'tablify__date-week-row');
    headRow.setAttribute('role', 'row');
    for (const label of weekdayLabels(this.weekStart)) {
      const cell = el('div', 'tablify__date-weekday');
      cell.setAttribute('role', 'columnheader');
      cell.textContent = label;
      headRow.appendChild(cell);
    }
    this.grid.appendChild(headRow);

    for (const week of gridFor(this.view.year, this.view.month, this.weekStart)) {
      const row = el('div', 'tablify__date-week');
      row.setAttribute('role', 'row');
      for (const parts of week) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tablify__date-day';
        button.setAttribute('role', 'gridcell');
        button.setAttribute('aria-label', dayLabel(parts));
        button.dataset.date = formatYmd(parts);
        button.textContent = String(parts.day);
        if (parts.month !== this.view.month) button.classList.add('is-outside');
        if (sameDay(parts, todayParts)) button.classList.add('is-today');
        const isSelected = sameDay(parts, selected);
        if (isSelected) {
          button.classList.add('is-selected');
          button.setAttribute('aria-selected', 'true');
        }
        button.tabIndex = sameDay(parts, this.focusDate) ? 0 : -1;
        button.addEventListener('click', () => this.pick(parts));
        button.addEventListener('keydown', (ev) => this.onGridKey(ev, parts));
        row.appendChild(button);
      }
      this.grid.appendChild(row);
    }
  }
}
