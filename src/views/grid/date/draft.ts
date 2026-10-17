/**
 * COD-75: the value being edited in the date & time panel.
 *
 * Every rule about *what a click means* lives here, away from the DOM, because the rules are
 * subtle and each one has a way to lose data:
 *
 *   • Opening a cell and dismissing it must never write — so an untouched draft returns the
 *     **original stored value, byte for byte** (COD-68's guarantee, kept).
 *   • Changing only the day must keep the time, **seconds and milliseconds included** — so the
 *     draft keeps the parts, not a formatted string.
 *   • Typing a time means whole minutes — but only when the typed clock actually differs from
 *     the current one, so re-confirming `09:30` on a value stored as `09:30:45` changes nothing.
 *
 * The panel calls a method, reads `text`, and commits `toStored()`; it never does date maths.
 */

import { getFieldType } from '../../../model/fieldTypes/registry.js';
import type { CellValue } from '../../../model/types.js';
import type { DateParts } from './calendar.js';
import { formatYmd, parseYmd, partsOf } from './calendar.js';

export type DateTimeType = 'date' | 'date_time';

export interface TimeParts {
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly millis: number;
}

export type ParseResult = { ok: true } | { ok: false; error: string };

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** True for the two field types this panel edits. */
export function isDateType(type: string): type is DateTimeType {
  return type === 'date' || type === 'date_time';
}

/**
 * Are two stored values the same moment? `date` is compared as text (it has no time part);
 * `date_time` as an instant, because `2026-10-16T09:30:00Z` and `...09:30:00.000Z` are the same
 * value and must not make the panel write on close.
 */
export function equivalentStored(type: DateTimeType, a: CellValue | undefined, b: CellValue | undefined): boolean {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty || bEmpty) return aEmpty && bEmpty;
  if (type === 'date') return String(a) === String(b);
  const ta = Date.parse(String(a));
  const tb = Date.parse(String(b));
  if (Number.isNaN(ta) || Number.isNaN(tb)) return String(a) === String(b);
  return ta === tb;
}

export class DateDraft {
  readonly type: DateTimeType;
  /** The stored value as it arrived — returned untouched while the draft is clean. */
  private readonly original: CellValue;
  private parts: DateParts;
  private time: TimeParts;
  private hasValue: boolean;
  /** True once any control in the panel has been used; see `toStored`. */
  private dirty = false;
  /** A stored value the field type cannot parse — shown verbatim rather than silently dropped. */
  private corrupt = false;
  private readonly rawText: string;
  private readonly now: () => Date;

  private constructor(type: DateTimeType, original: CellValue, now: () => Date) {
    this.type = type;
    this.original = original;
    this.now = now;
    const today = partsOf(now());
    this.parts = today;
    this.time = { hours: 0, minutes: 0, seconds: 0, millis: 0 };
    this.hasValue = false;
    this.rawText = original === null || original === undefined ? '' : String(original);
  }

  /** Build a draft from a stored cell value. */
  static fromStored(type: DateTimeType, value: CellValue | undefined, now: () => Date = () => new Date()): DateDraft {
    const draft = new DateDraft(type, value ?? null, now);
    if (value === null || value === undefined || value === '') return draft;
    if (type === 'date') {
      const day = parseYmd(String(value));
      if (!day) {
        // A hand-edited file can hold anything. Keep the text, do not pretend it is a date, and
        // (because the draft is clean) closing the panel writes nothing over it.
        draft.corrupt = true;
        draft.hasValue = true;
        return draft;
      }
      draft.parts = day;
      draft.hasValue = true;
      return draft;
    }
    const stamp = dateTimeParts(String(value));
    if (!stamp) {
      draft.corrupt = true;
      draft.hasValue = true;
      return draft;
    }
    draft.parts = stamp.date;
    draft.time = stamp.time;
    draft.hasValue = true;
    return draft;
  }

  get hasDate(): boolean {
    return this.hasValue;
  }

  get dateParts(): DateParts {
    return this.parts;
  }

  get timeParts(): TimeParts {
    return this.time;
  }

  /** True once the user has used any control. */
  get touched(): boolean {
    return this.dirty;
  }

  /** What the field shows — the same shape the cell shows, so copy/paste round-trips. */
  get text(): string {
    if (this.corrupt && !this.dirty) return this.rawText;
    if (!this.hasValue) return '';
    if (this.type === 'date') return formatYmd(this.parts);
    return `${formatYmd(this.parts)}T${pad2(this.time.hours)}:${pad2(this.time.minutes)}`;
  }

  /** Pick a day from the calendar. Keeps the time, seconds and milliseconds. */
  pickDay(year: number, month: number, day: number): void {
    this.parts = { year, month, day };
    this.hasValue = true;
    this.dirty = true;
  }

  /** Set the clock from the `hh` / `mm` inputs: an explicit time is a whole-minute time. */
  setTime(hours: number, minutes: number): void {
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
    const h = Math.min(23, Math.max(0, Math.trunc(hours)));
    const m = Math.min(59, Math.max(0, Math.trunc(minutes)));
    if (!this.hasValue) {
      this.parts = partsOf(this.now());
      this.hasValue = true;
    }
    this.time = { hours: h, minutes: m, seconds: 0, millis: 0 };
    this.dirty = true;
  }

  /** Move the date to today, keeping the time (the footer's **Today**). */
  setToday(): void {
    this.parts = partsOf(this.now());
    this.hasValue = true;
    this.dirty = true;
  }

  /** The current instant to the minute (the time row's **Now**). */
  setNow(): void {
    const now = this.now();
    this.parts = partsOf(now);
    this.time = { hours: now.getHours(), minutes: now.getMinutes(), seconds: 0, millis: 0 };
    this.hasValue = true;
    this.dirty = true;
  }

  /** Empty the cell (the footer's **Clear**). */
  clear(): void {
    this.hasValue = false;
    this.dirty = true;
  }

  /**
   * Read the text field. Returns the same verdicts the cell editor always had: empty clears,
   * anything the field type refuses is an error with a message the panel shows.
   */
  setText(input: string): ParseResult {
    const trimmed = input.trim();
    if (trimmed === '') {
      this.clear();
      return { ok: true };
    }
    const parsed = getFieldType(this.type).parse(trimmed);
    if (parsed === null) {
      return {
        ok: false,
        error: this.type === 'date' ? 'Enter a date like 2026-10-17' : 'Enter a date and time like 2026-10-17T14:30',
      };
    }
    if (this.type === 'date') {
      const next = parseYmd(String(parsed));
      if (!next) return { ok: false, error: 'Enter a date like 2026-10-17' };
      this.parts = next;
      this.hasValue = true;
      this.dirty = true;
      return { ok: true };
    }
    const next = dateTimeParts(String(parsed));
    if (!next) return { ok: false, error: 'Enter a date and time like 2026-10-17T14:30' };
    // Typing a clock different from the current one means whole minutes; retyping the same
    // clock (or a string that spells out seconds) keeps what the value already carried.
    const sameClock = this.hasValue && next.time.hours === this.time.hours && next.time.minutes === this.time.minutes;
    const spellsSeconds = /\d{2}:\d{2}:\d{2}/.test(trimmed);
    this.parts = next.date;
    this.time = sameClock && !spellsSeconds ? { ...next.time, seconds: this.time.seconds, millis: this.time.millis } : next.time;
    this.hasValue = true;
    this.dirty = true;
    return { ok: true };
  }

  /**
   * The value to store. While the draft is untouched this is the **original value**, so an
   * opened-and-dismissed panel cannot rewrite milliseconds, a time zone, or a value the type
   * cannot parse.
   */
  toStored(): CellValue {
    if (!this.dirty) return this.original;
    if (!this.hasValue) return null;
    if (this.type === 'date') return formatYmd(this.parts);
    return new Date(
      this.parts.year,
      this.parts.month,
      this.parts.day,
      this.time.hours,
      this.time.minutes,
      this.time.seconds,
      this.time.millis,
    ).toISOString();
  }
}

/**
 * Split a stored `date_time` string into local parts. An unparseable string has no parts —
 * the caller keeps the text instead of inventing a date for it.
 */
function dateTimeParts(value: string): { date: DateParts; time: TimeParts } | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: partsOf(d),
    time: { hours: d.getHours(), minutes: d.getMinutes(), seconds: d.getSeconds(), millis: d.getMilliseconds() },
  };
}
