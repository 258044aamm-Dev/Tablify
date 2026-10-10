/**
 * Formula values and date helpers (P8-02, SAD-61).
 *
 * Errors are values (`{ t: 'err' }`), never thrown to callers. Internally the
 * function library uses `fault()` to unwind a single call; `evaluate` converts
 * the unwind back into an error value at the call boundary.
 */

export type ErrorCode =
  | '#PARSE!'
  | '#NAME?'
  | '#ARGS!'
  | '#TYPE!'
  | '#VALUE!'
  | '#DIV/0!'
  | '#NUM!'
  | '#OVERFLOW!'
  | '#CYCLE!';

export type Value =
  | { readonly t: 'blank' }
  | { readonly t: 'num'; readonly v: number }
  | { readonly t: 'text'; readonly v: string }
  | { readonly t: 'bool'; readonly v: boolean }
  | { readonly t: 'date'; readonly y: number; readonly m: number; readonly d: number }
  | { readonly t: 'dt'; readonly ms: number }
  | { readonly t: 'err'; readonly code: ErrorCode };

export const BLANK: Value = { t: 'blank' };

/** Maximum length in UTF-16 code units of any text value the engine produces. */
export const MAX_TEXT = 100_000;

export class FormulaFault extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.name = 'FormulaFault';
    this.code = code;
  }
}

/** Internal unwind. Never escapes the formula module. */
export function fault(code: ErrorCode): never {
  throw new FormulaFault(code);
}

export function err(code: ErrorCode): Value {
  return { t: 'err', code };
}

export function faultValue(e: unknown): Value {
  if (e instanceof FormulaFault) return err(e.code);
  throw e;
}

export function numValue(v: number): Value {
  if (!Number.isFinite(v)) return err('#OVERFLOW!');
  return { t: 'num', v: v === 0 ? 0 : v }; // normalise -0
}

export function textValue(v: string): Value {
  if (v.length > MAX_TEXT) return err('#OVERFLOW!');
  return { t: 'text', v };
}

export function isTemporal(v: Value): v is Extract<Value, { t: 'date' | 'dt' }> {
  return v.t === 'date' || v.t === 'dt';
}

// ---------- number formatting ----------

/**
 * Plain decimal text for a number: up to 15 significant digits, no exponent,
 * no trailing zeros. Used by `&`, CONCATENATE, and text conversion.
 */
export function formatNumber(n: number): string {
  if (n === 0) return '0';
  const s = Number(n.toPrecision(15)).toString();
  if (!/e/i.test(s)) return s;
  return expandExponent(s);
}

function expandExponent(s: string): string {
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const [mant, expPart] = body.toLowerCase().split('e');
  const exp = Number(expPart);
  const [ip, fp = ''] = (mant ?? '').split('.');
  const digits = (ip ?? '') + fp;
  const point = (ip ?? '').length + exp;
  let out: string;
  if (point <= 0) out = '0.' + '0'.repeat(-point) + digits;
  else if (point >= digits.length) out = digits + '0'.repeat(point - digits.length);
  else out = digits.slice(0, point) + '.' + digits.slice(point);
  return (neg ? '-' : '') + out;
}

// ---------- local date and time ----------

export interface Parts {
  readonly y: number;
  readonly m: number; // 1-12
  readonly d: number; // 1-31
  readonly hh: number;
  readonly mm: number;
  readonly ss: number;
}

/** Local-time components of an epoch-millisecond instant. */
export function msToParts(ms: number): Parts {
  const t = new Date(ms);
  return {
    y: t.getFullYear(),
    m: t.getMonth() + 1,
    d: t.getDate(),
    hh: t.getHours(),
    mm: t.getMinutes(),
    ss: t.getSeconds(),
  };
}

/** Epoch milliseconds for local-time components (handles years 0-99). */
export function partsToMs(p: Parts): number {
  const t = new Date(0);
  t.setFullYear(p.y, p.m - 1, p.d);
  t.setHours(p.hh, p.mm, p.ss, 0);
  return t.getTime();
}

export function daysInMonth(y: number, m: number): number {
  const t = new Date(0);
  t.setUTCFullYear(y, m, 0); // day 0 of the next month = last day of month m
  return t.getUTCDate();
}

/** Day count since 1970-01-01 for a calendar date (timezone-free). */
export function dayNumber(y: number, m: number, d: number): number {
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  return Math.round(t.getTime() / 86_400_000);
}

export function dateFromDayNumber(n: number): { y: number; m: number; d: number } {
  const t = new Date(n * 86_400_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Components of a date or datetime value (dates have time 00:00:00). */
export function partsOf(v: Value): Parts {
  if (v.t === 'date') return { y: v.y, m: v.m, d: v.d, hh: 0, mm: 0, ss: 0 };
  if (v.t === 'dt') return msToParts(v.ms);
  return fault('#VALUE!');
}

/** Instant used for comparison. A date means local midnight. */
export function temporalMs(v: Value): number {
  if (v.t === 'dt') return v.ms;
  if (v.t === 'date') return partsToMs({ y: v.y, m: v.m, d: v.d, hh: 0, mm: 0, ss: 0 });
  return fault('#VALUE!');
}

export function addMonthsParts(p: Parts, months: number): Parts {
  const total = p.y * 12 + (p.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  const d = Math.min(p.d, daysInMonth(y, m));
  return { ...p, y, m, d };
}

const pad = (n: number, w: number): string => String(n).padStart(w, '0');

export function formatDate(y: number, m: number, d: number): string {
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

/** Text form used by `&` and CONCATENATE: `YYYY-MM-DD HH:mm` (local time). */
export function formatMinute(ms: number): string {
  const p = msToParts(ms);
  return `${formatDate(p.y, p.m, p.d)} ${pad(p.hh, 2)}:${pad(p.mm, 2)}`;
}

export function parseDateText(s: string): { y: number; m: number; d: number } | null {
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!mt) return null;
  const y = Number(mt[1]);
  const m = Number(mt[2]);
  const d = Number(mt[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

/** Accepts `YYYY-MM-DD HH:mm[:ss]` or with `T`. Local time. */
export function parseDateTimeText(s: string): Parts | null {
  const mt = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!mt) return null;
  const p = {
    y: Number(mt[1]),
    m: Number(mt[2]),
    d: Number(mt[3]),
    hh: Number(mt[4]),
    mm: Number(mt[5]),
    ss: mt[6] === undefined ? 0 : Number(mt[6]),
  };
  if (p.m < 1 || p.m > 12 || p.d < 1 || p.d > daysInMonth(p.y, p.m)) return null;
  if (p.hh > 23 || p.mm > 59 || p.ss > 59) return null;
  return p;
}

// ---------- comparison ----------

/** Zero value of the other operand, used when one side is blank. */
function zeroLike(v: Value): Value {
  switch (v.t) {
    case 'num':
      return { t: 'num', v: 0 };
    case 'text':
      return { t: 'text', v: '' };
    case 'bool':
      return { t: 'bool', v: false };
    case 'blank':
      return BLANK;
    default:
      return fault('#VALUE!'); // blank against a date or datetime
  }
}

function compareCodePoints(a: string, b: string): number {
  const A = Array.from(a);
  const B = Array.from(b);
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const x = A[i]!.codePointAt(0)!;
    const y = B[i]!.codePointAt(0)!;
    if (x !== y) return x < y ? -1 : 1;
  }
  if (A.length === B.length) return 0;
  return A.length < B.length ? -1 : 1;
}

/**
 * `=` semantics. Blank rules first; date and datetime compare as instants;
 * values of different types are not equal (no error).
 */
export function equalValues(l: Value, r: Value): boolean {
  if (l.t === 'err') fault(l.code);
  if (r.t === 'err') fault(r.code);
  if (l.t === 'blank' && r.t === 'blank') return true;
  if (l.t === 'blank') return equalValues(zeroLike(r), r);
  if (r.t === 'blank') return equalValues(l, zeroLike(l));
  if (isTemporal(l) && isTemporal(r)) return temporalMs(l) === temporalMs(r);
  if (isTemporal(l) || isTemporal(r)) return false;
  if (l.t !== r.t) return false;
  switch (l.t) {
    case 'num':
      return l.v === (r as { v: number }).v;
    case 'text':
      return l.v === (r as { v: string }).v;
    case 'bool':
      return l.v === (r as { v: boolean }).v;
    default:
      return false;
  }
}

/**
 * Ordering for `<`, `<=`, `>`, `>=`. Mixed types are #VALUE!. Booleans order
 * FALSE before TRUE.
 */
export function orderValues(l: Value, r: Value): number {
  if (l.t === 'err') fault(l.code);
  if (r.t === 'err') fault(r.code);
  if (l.t === 'blank' && r.t === 'blank') return 0;
  if (l.t === 'blank') return orderValues(zeroLike(r), r);
  if (r.t === 'blank') return orderValues(l, zeroLike(l));
  if (isTemporal(l) && isTemporal(r)) {
    const a = temporalMs(l);
    const b = temporalMs(r);
    return a === b ? 0 : a < b ? -1 : 1;
  }
  if (l.t !== r.t) return fault('#VALUE!');
  switch (l.t) {
    case 'num': {
      const b = (r as { v: number }).v;
      return l.v === b ? 0 : l.v < b ? -1 : 1;
    }
    case 'text':
      return compareCodePoints(l.v, (r as { v: string }).v);
    case 'bool': {
      const b = (r as { v: boolean }).v;
      return l.v === b ? 0 : l.v ? 1 : -1;
    }
    default:
      return fault('#VALUE!');
  }
}
