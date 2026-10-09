// Column type inference for CSV and XLSX import — pure logic, no Obsidian or Node imports.
// Step P4-03 (SAD-38). Spec: spec/steps/P4-03.md, spec/guidelines.md P4-03 and G-P3, G-A5.
//
// Rules (recorded for evidence; applied in this order, first match wins):
//  0. Empty values (null, undefined, empty or whitespace-only text) are ignored.
//     A column with no non-empty values is text.
//  1. checkbox — every non-empty value is a boolean, or text true/false/yes/no/1/0
//     (case-insensitive, trimmed), or the number 0 or 1. Spec word list; Y/N is NOT included.
//  2. number   — every non-empty value is a finite number, or text matching
//     [+-]?(digits[.digits?] | .digits)([eE][+-]?digits)?  (decimal point only, G-A5).
//     "1,5", "1,000", "NaN", "Infinity" are not numbers.
//  3. date     — every non-empty value is a Date (UTC components used), or text in one of:
//     - YYYY-MM-DD                    (ISO, always unambiguous)
//     - YYYY/MM/DD                    (year first, always unambiguous)
//     - D Mon YYYY / D Month YYYY     (English month name, always unambiguous)
//     - A/B/YYYY or A.B.YYYY          (one part > 12 decides day vs month;
//                                      if both parts <= 12 the value is AMBIGUOUS and not a date)
//     All dates must be valid calendar dates (e.g. 2026-02-30 is not a date).
//  4. single_select — the column is not checkbox, number, or date, AND the number of distinct
//     non-empty values is <= 20 AND distinct / non-empty rows <= 0.5. Thresholds are *proposed*
//     (G-P3) and recorded in the decision log. Values are compared after trimming.
//  5. text     — everything else, including all ambiguous columns (G-P3).
//
// Tolerance: by default a type applies only when 100% of non-empty values match (no cell
// would be lost or altered on import). An optional `tolerance` (e.g. 0.05) allows that
// fraction of non-matching values. Those cells would then be lost on import, so this is
// for accuracy sensitivity analysis only and is NOT the default.

export type InferredType = 'text' | 'number' | 'date' | 'checkbox' | 'single_select';

/** A raw cell as read from CSV (string) or XLSX (number, boolean, Date, string, null). */
export type InputCell = string | number | boolean | Date | null | undefined;

export interface InferenceOptions {
  /** Fraction of non-empty values allowed to not match. Default 0 (strict). */
  tolerance?: number;
  /** Max distinct values for single_select. Default 20 (proposed). */
  maxSelectDistinct?: number;
  /** Max distinct / non-empty ratio for single_select. Default 0.5 (proposed). */
  maxSelectRatio?: number;
}

export interface ColumnInference {
  type: InferredType;
  /** Human-readable reason, for the import report. */
  reason: string;
  /** Non-empty values considered. */
  nonEmpty: number;
  /** Distinct trimmed string values among non-empty cells. */
  distinct: number;
  /** Fraction of non-empty values that matched the chosen type (1 when strict). */
  matchRatio: number;
  /** Distinct trimmed values, in first-seen order. Only set for single_select. */
  selectOptions?: string[];
}

const NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YMD_SLASH_RE = /^(\d{4})\/(\d{2})\/(\d{2})$/;
const NUMERIC_DMY_RE = /^(\d{1,2})([/.])(\d{1,2})\2(\d{4})$/;
const DAY_MONTHNAME_YEAR_RE = /^(\d{1,2}) ([A-Za-z]+) (\d{4})$/;
const CHECKBOX_WORDS: ReadonlySet<string> = new Set(['true', 'false', 'yes', 'no', '1', '0']);
const MONTHS: Readonly<Record<string, number>> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Calendar day (UTC) of a Date that is exactly UTC midnight, or null.
 * read-excel-file returns integer Excel date serials as UTC midnight in every time zone (verified in
 * UTC, Asia/Dhaka, America/Los_Angeles). A Date with a time-of-day is not date-only: importing it
 * would silently drop the time, so it is not a date.
 */
export function dateOnlyIso(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0 || d.getUTCMilliseconds() !== 0) return null;
  return d.toISOString().slice(0, 10);
}

/** Key used for distinct counting and select option matching: trimmed text, or ISO for Dates. */
export function cellKey(v: InputCell): string {
  return v instanceof Date ? v.toISOString() : String(v).trim();
}

/** True for null, undefined, and empty or whitespace-only text. */
export function isEmptyCell(v: InputCell): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function validYMD(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

function ymd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Parse a date text under the accepted formats. Returns YYYY-MM-DD or null.
 * Returns null for ambiguous numeric dates (both parts <= 12).
 */
export function parseDateText(input: string): string | null {
  const s = input.trim();
  let m = ISO_RE.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return validYMD(y, mo, d) ? ymd(y, mo, d) : null;
  }
  m = YMD_SLASH_RE.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return validYMD(y, mo, d) ? ymd(y, mo, d) : null;
  }
  m = NUMERIC_DMY_RE.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[3]);
    const y = Number(m[4]);
    let day: number;
    let month: number;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      day = b;
      month = a;
    } else {
      return null; // ambiguous (both <= 12) or impossible (both > 12)
    }
    return validYMD(y, month, day) ? ymd(y, month, day) : null;
  }
  m = DAY_MONTHNAME_YEAR_RE.exec(s);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month === undefined) return null;
    const d = Number(m[1]);
    const y = Number(m[3]);
    return validYMD(y, month, d) ? ymd(y, month, d) : null;
  }
  return null;
}

function matchesCheckbox(v: InputCell): boolean {
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return v === 0 || v === 1;
  if (typeof v === 'string') return CHECKBOX_WORDS.has(v.trim().toLowerCase());
  return false;
}

function matchesNumber(v: InputCell): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') {
    const t = v.trim();
    return NUMBER_RE.test(t) && Number.isFinite(Number(t));
  }
  return false;
}

function matchesDate(v: InputCell): boolean {
  if (v instanceof Date) return dateOnlyIso(v) !== null;
  if (typeof v === 'string') return parseDateText(v) !== null;
  return false;
}

const MATCHERS: ReadonlyArray<readonly [InferredType, (v: InputCell) => boolean]> = [
  ['checkbox', matchesCheckbox],
  ['number', matchesNumber],
  ['date', matchesDate],
];

/** Infer the type of one column from its raw cell values. */
export function inferColumn(values: readonly InputCell[], options: InferenceOptions = {}): ColumnInference {
  const tolerance = options.tolerance ?? 0;
  const maxDistinct = options.maxSelectDistinct ?? 20;
  const maxRatio = options.maxSelectRatio ?? 0.5;

  const nonEmptyValues: InputCell[] = [];
  for (const v of values) if (!isEmptyCell(v)) nonEmptyValues.push(v);
  const nonEmpty = nonEmptyValues.length;

  const distinctSet = new Set<string>();
  const selectOptions: string[] = [];
  for (const v of nonEmptyValues) {
    const key = cellKey(v);
    if (!distinctSet.has(key)) {
      distinctSet.add(key);
      selectOptions.push(key);
    }
  }
  const distinct = distinctSet.size;

  if (nonEmpty === 0) {
    return { type: 'text', reason: 'no non-empty values', nonEmpty, distinct, matchRatio: 1 };
  }

  for (const [type, matches] of MATCHERS) {
    let ok = 0;
    for (const v of nonEmptyValues) if (matches(v)) ok++;
    const ratio = ok / nonEmpty;
    if (ratio >= 1 - tolerance) {
      return {
        type,
        reason: ratio === 1 ? `all ${nonEmpty} non-empty values match ${type}` : `${(ratio * 100).toFixed(1)}% of values match ${type}`,
        nonEmpty,
        distinct,
        matchRatio: ratio,
      };
    }
  }

  if (distinct <= maxDistinct && distinct / nonEmpty <= maxRatio) {
    return {
      type: 'single_select',
      reason: `${distinct} distinct values (<= ${maxDistinct}) and ${(distinct / nonEmpty * 100).toFixed(0)}% of rows (<= ${maxRatio * 100}%)`,
      nonEmpty,
      distinct,
      matchRatio: 1,
      selectOptions,
    };
  }

  return {
    type: 'text',
    reason: `no strict type match; ${distinct} distinct values does not qualify for single_select`,
    nonEmpty,
    distinct,
    matchRatio: 1,
  };
}

/** Infer every column of a row-major table. Rows may be ragged; missing cells count as empty. */
export function inferTable(rows: readonly (readonly InputCell[])[], columnCount: number, options: InferenceOptions = {}): ColumnInference[] {
  const out: ColumnInference[] = [];
  for (let c = 0; c < columnCount; c++) {
    const column: InputCell[] = new Array<InputCell>(rows.length);
    for (let r = 0; r < rows.length; r++) column[r] = rows[r][c];
    out.push(inferColumn(column, options));
  }
  return out;
}
