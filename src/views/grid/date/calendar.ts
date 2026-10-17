/**
 * COD-75: month arithmetic for the date & time panel.
 *
 * Pure functions over plain `{ year, month, day }` parts — no DOM, no time zones, no `Date`
 * formatting. The picker's calendar grid is the one place where "how many weeks does this month
 * need", "what weekday is the 1st" and "what is the previous month" can silently go wrong (leap
 * years, December → January, a locale that starts the week on Sunday), so all of it lives here
 * where `calendar.test.ts` can pin it.
 *
 * Conventions, matching JavaScript's own `Date`: `month` is **0-based** (0 = January) and
 * `weekStart` / weekday indexes are **0 = Sunday … 6 = Saturday** (`Date.getDay()`).
 */

export interface DateParts {
  readonly year: number;
  /** 0–11, like `Date.getMonth()`. */
  readonly month: number;
  readonly day: number;
}

/** `['Mo','Tu','We','Th','Fr','Sa','Su']` rotated to the locale's first day of the week. */
const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Days in a month, leap years included. */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one — the standard trick, and it handles
  // February in leap years without a table.
  return new Date(year, month + 1, 0).getDate();
}

/** The month `delta` months away, rolling the year when needed (December + 1 → January). */
export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** `delta` days away from a date, rolling months and years. */
export function addDays(parts: DateParts, delta: number): DateParts {
  // Noon, not midnight: a local midnight can fall in a DST gap in some zones and shift the day.
  const d = new Date(parts.year, parts.month, parts.day + delta, 12, 0, 0, 0);
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

/** How many days the first of the month sits after the week's first day (0–6). */
export function leadingDays(year: number, month: number, weekStart: number): number {
  const firstWeekday = new Date(year, month, 1, 12, 0, 0, 0).getDay();
  return (firstWeekday - weekStart + 7) % 7;
}

/**
 * The weeks a calendar shows for a month — 5 rows for October 2026, 6 for August 2026, never a
 * padded sixth row the month does not need. Days outside the month carry `inMonth: false`; they
 * are still real, clickable days that jump the view to their month.
 */
export function gridFor(year: number, month: number, weekStart = 1): DateParts[][] {
  const offset = leadingDays(year, month, weekStart);
  const total = offset + daysInMonth(year, month);
  const weeks = Math.ceil(total / 7);
  const first: DateParts = addDays({ year, month, day: 1 }, -offset);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)),
  );
}

/** Weekday labels in the order the grid draws them. */
export function weekdayLabels(weekStart = 1): string[] {
  return Array.from({ length: 7 }, (_, i) => WEEKDAY_SHORT[(weekStart + i) % 7]);
}

export function monthLabel(month: number): string {
  return MONTH_LONG[((month % 12) + 12) % 12];
}

/** The screen-reader label of a day: `Friday 17 October 2026` (not a bare "17"). */
export function dayLabel(parts: DateParts): string {
  return `${WEEKDAY_LONG[new Date(parts.year, parts.month, parts.day, 12).getDay()]} ${parts.day} ${monthLabel(
    parts.month,
  )} ${parts.year}`;
}

/** `2026-10-17` — the stored form of a `date` cell. */
export function formatYmd(parts: DateParts): string {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/** Strict `YYYY-MM-DD` → parts, or null. Rejects `2026-02-30` and `2026-13-01`. */
export function parseYmd(text: string): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month < 0 || month > 11 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function sameDay(a: DateParts | null, b: DateParts | null): boolean {
  return !!a && !!b && a.year === b.year && a.month === b.month && a.day === b.day;
}

/** `{ year, month, day }` of an instant, in the reader's own time zone. */
export function partsOf(date: Date): DateParts {
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

/**
 * The locale's first day of the week as a `Date.getDay()` index (0 = Sunday).
 *
 * `Intl.Locale.prototype.weekInfo` is the only way to know that en-US starts on Sunday and
 * en-GB on Monday; engines without it (and any exception) fall back to Monday, which is what
 * the rest of the plugin's date UI already assumes. The result is never used for date maths —
 * only for which column the 1st lands in — so a wrong answer can never corrupt a value.
 */
export function localeWeekStart(language?: string): number {
  try {
    const LocaleCtor = (
      Intl as unknown as {
        Locale?: new (tag?: string) => {
          getWeekInfo?: () => { firstDay?: number };
          weekInfo?: { firstDay?: number };
        };
      }
    ).Locale;
    if (LocaleCtor) {
      const tag = language ?? (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en');
      const locale = new LocaleCtor(tag);
      const info = typeof locale.getWeekInfo === 'function' ? locale.getWeekInfo() : locale.weekInfo;
      const first = info?.firstDay;
      // The spec numbers days 1 = Monday … 7 = Sunday; `Date.getDay()` numbers 0 = Sunday.
      if (typeof first === 'number' && first >= 1 && first <= 7) return first === 7 ? 0 : first;
    }
  } catch {
    /* engines without week info — Monday */
  }
  return 1;
}
