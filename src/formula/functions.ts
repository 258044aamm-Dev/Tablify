/**
 * Function library for the P8 formula language (docs/formula-spec.md §10).
 * 54 functions. Eager functions receive evaluated arguments. Lazy functions
 * (IF, AND, OR, SWITCH) are dispatched in evaluate.ts.
 */
import {
  BLANK,
  MAX_TEXT,
  addMonthsParts,
  dateFromDayNumber,
  dayNumber,
  err,
  fault,
  formatDate,
  formatMinute,
  formatNumber,
  isTemporal,
  msToParts,
  numValue,
  parseDateText,
  partsOf,
  partsToMs,
  temporalMs,
  textValue,
  type Parts,
  type Value,
} from './value';

export interface FnContext {
  readonly rowId: string;
  readonly createdMs: number;
  readonly modifiedMs: number;
  readonly now: number;
}

export interface FnDef {
  readonly min: number;
  readonly max: number;
  readonly lazy: boolean;
  readonly run?: (args: Value[], ctx: FnContext) => Value;
}

const VARIADIC = 30;
const DAY_MS = 86_400_000;

// ---------- argument conversion (internal; throws FormulaFault) ----------

export function asNumber(v: Value): number {
  switch (v.t) {
    case 'num':
      return v.v;
    case 'blank':
      return 0;
    case 'err':
      return fault(v.code);
    default:
      return fault('#VALUE!');
  }
}

export function asInt(v: Value): number {
  return Math.trunc(asNumber(v));
}

export function asText(v: Value): string {
  switch (v.t) {
    case 'blank':
      return '';
    case 'text':
      return v.v;
    case 'num':
      return formatNumber(v.v);
    case 'bool':
      return v.v ? 'TRUE' : 'FALSE';
    case 'date':
      return formatDate(v.y, v.m, v.d);
    case 'dt':
      return formatMinute(v.ms);
    case 'err':
      return fault(v.code);
  }
}

export function asBool(v: Value): boolean {
  switch (v.t) {
    case 'bool':
      return v.v;
    case 'num':
      return v.v !== 0;
    case 'blank':
      return false;
    case 'err':
      return fault(v.code);
    default:
      return fault('#VALUE!');
  }
}

function asTemporal(v: Value): Value {
  if (isTemporal(v)) return v;
  if (v.t === 'err') return fault(v.code);
  return fault('#VALUE!');
}

function cps(s: string): string[] {
  return Array.from(s);
}

function lowerCp(c: string): string {
  const l = c.toLowerCase();
  return Array.from(l).length === 1 ? l : c;
}

function roundTo(n: number, digits: number, mode: 'nearest' | 'up' | 'down'): number {
  const sign = n < 0 ? -1 : 1;
  const a = Math.abs(n);
  const scaled = Number((digits >= 0 ? a * 10 ** digits : a / 10 ** -digits).toPrecision(15));
  let r: number;
  if (mode === 'nearest') r = Math.round(scaled);
  else if (mode === 'up') r = Math.ceil(scaled);
  else r = Math.floor(scaled);
  const out = digits >= 0 ? r / 10 ** digits : r * 10 ** -digits;
  return sign * out;
}

function roundArgs(args: Value[], mode: 'nearest' | 'up' | 'down'): Value {
  const n = asNumber(args[0]!);
  const digits = args.length > 1 ? asInt(args[1]!) : 0;
  if (digits < -15 || digits > 15) return err('#NUM!');
  return numValue(roundTo(n, digits, mode));
}

/** Collect numeric arguments for SUM, MIN, MAX, AVERAGE. Blank is skipped; text and booleans are #VALUE!. */
function numericArgs(args: Value[]): number[] {
  const out: number[] = [];
  for (const a of args) {
    if (a.t === 'num') out.push(a.v);
    else if (a.t === 'blank') continue;
    else if (a.t === 'err') fault(a.code);
    else fault('#VALUE!');
  }
  return out;
}

function monthsBetween(a: Value, b: Value, perMonth: number): number {
  const ta = temporalMs(a);
  const tb = temporalMs(b);
  const sign = ta >= tb ? 1 : -1;
  const bp = partsOf(b);
  let k = 0;
  for (;;) {
    const next = partsToMs(addMonthsParts(bp, sign * perMonth * (k + 1)));
    if (sign > 0 ? next <= ta : next >= ta) k++;
    else break;
  }
  return sign * k;
}

const UNITS = new Set(['days', 'weeks', 'months', 'years', 'hours', 'minutes', 'seconds']);
const TIME_UNIT_MS: Record<string, number> = { hours: 3_600_000, minutes: 60_000, seconds: 1_000 };

function dateAdd(v: Value, n: number, unit: string): Value {
  const isDate = v.t === 'date';
  const p = partsOf(v);
  switch (unit) {
    case 'days':
    case 'weeks': {
      const k = unit === 'weeks' ? n * 7 : n;
      if (isDate) {
        const dn = dayNumber(p.y, p.m, p.d) + k;
        const r = dateFromDayNumber(dn);
        return { t: 'date', y: r.y, m: r.m, d: r.d };
      }
      const t = new Date(0);
      t.setFullYear(p.y, p.m - 1, p.d + k);
      t.setHours(p.hh, p.mm, p.ss, 0);
      return { t: 'dt', ms: t.getTime() };
    }
    case 'months':
    case 'years': {
      const months = unit === 'years' ? n * 12 : n;
      const r = addMonthsParts(p, months);
      if (isDate) return { t: 'date', y: r.y, m: r.m, d: r.d };
      return { t: 'dt', ms: partsToMs(r) };
    }
    default: {
      const ms = temporalMs(v) + n * TIME_UNIT_MS[unit]!;
      return { t: 'dt', ms };
    }
  }
}

function dateDiff(a: Value, b: Value, unit: string): number {
  if (unit === 'months' || unit === 'years') return monthsBetween(a, b, unit === 'years' ? 12 : 1);
  if (a.t === 'date' && b.t === 'date' && (unit === 'days' || unit === 'weeks')) {
    // Calendar days for date-only operands: immune to DST offsets.
    const days = dayNumber(a.y, a.m, a.d) - dayNumber(b.y, b.m, b.d);
    return Math.trunc(unit === 'weeks' ? days / 7 : days);
  }
  const dms = temporalMs(a) - temporalMs(b);
  if (unit === 'days') return Math.trunc(dms / DAY_MS);
  if (unit === 'weeks') return Math.trunc(dms / (7 * DAY_MS));
  return Math.trunc(dms / TIME_UNIT_MS[unit]!);
}

function weekdayIso(p: Parts): number {
  const n = dayNumber(p.y, p.m, p.d);
  return (((n + 3) % 7) + 7) % 7 + 1; // 1970-01-01 was a Thursday (ISO 4)
}

function formatPattern(v: Value, pattern: string): string {
  const p = partsOf(v);
  const tokens: [string, () => string][] = [
    ['YYYY', () => String(p.y).padStart(4, '0')],
    ['MM', () => String(p.m).padStart(2, '0')],
    ['DD', () => String(p.d).padStart(2, '0')],
    ['HH', () => String(p.hh).padStart(2, '0')],
    ['mm', () => String(p.mm).padStart(2, '0')],
    ['ss', () => String(p.ss).padStart(2, '0')],
  ];
  let out = '';
  let i = 0;
  outer: while (i < pattern.length) {
    for (const [tok, render] of tokens) {
      if (pattern.startsWith(tok, i)) {
        out += render();
        i += tok.length;
        continue outer;
      }
    }
    out += pattern.charAt(i);
    i++;
  }
  return out;
}

const cell = (fn: (args: Value[], ctx: FnContext) => Value, min: number, max: number): FnDef => ({
  min,
  max,
  lazy: false,
  run: fn,
});

/** Arguments are already evaluated and error-free when these run. */
export const FUNCTIONS: Readonly<Record<string, FnDef>> = {
  // ----- numeric (15) -----
  ABS: cell((a) => numValue(Math.abs(asNumber(a[0]!))), 1, 1),
  ROUND: cell((a) => roundArgs(a, 'nearest'), 1, 2),
  ROUNDUP: cell((a) => roundArgs(a, 'up'), 1, 2),
  ROUNDDOWN: cell((a) => roundArgs(a, 'down'), 1, 2),
  CEILING: cell((a) => numValue(Math.ceil(asNumber(a[0]!))), 1, 1),
  FLOOR: cell((a) => numValue(Math.floor(asNumber(a[0]!))), 1, 1),
  INT: cell((a) => numValue(Math.floor(asNumber(a[0]!))), 1, 1),
  MOD: cell((a) => {
    const n = asNumber(a[0]!);
    const m = asNumber(a[1]!);
    if (m === 0) return err('#DIV/0!');
    return numValue(n - m * Math.floor(n / m));
  }, 2, 2),
  POWER: cell((a) => {
    const x = asNumber(a[0]!);
    const y = asNumber(a[1]!);
    if (x === 0 && y < 0) return err('#DIV/0!');
    const r = x ** y;
    if (Number.isNaN(r)) return err('#NUM!');
    return numValue(r);
  }, 2, 2),
  SQRT: cell((a) => {
    const n = asNumber(a[0]!);
    if (n < 0) return err('#NUM!');
    return numValue(Math.sqrt(n));
  }, 1, 1),
  MIN: cell((a) => {
    const xs = numericArgs(a);
    return xs.length === 0 ? BLANK : numValue(Math.min(...xs));
  }, 1, VARIADIC),
  MAX: cell((a) => {
    const xs = numericArgs(a);
    return xs.length === 0 ? BLANK : numValue(Math.max(...xs));
  }, 1, VARIADIC),
  SUM: cell((a) => {
    let s = 0;
    for (const x of numericArgs(a)) s += x;
    return numValue(s);
  }, 0, VARIADIC),
  AVERAGE: cell((a) => {
    const xs = numericArgs(a);
    if (xs.length === 0) return err('#DIV/0!');
    let s = 0;
    for (const x of xs) s += x;
    return numValue(s / xs.length);
  }, 1, VARIADIC),
  COUNT: cell((a) => numValue(a.filter((x) => x.t === 'num').length), 1, VARIADIC),

  // ----- text (14) -----
  CONCATENATE: cell((a) => textValue(a.map(asText).join('')), 1, VARIADIC),
  LEN: cell((a) => numValue(cps(asText(a[0]!)).length), 1, 1),
  LOWER: cell((a) => textValue(asText(a[0]!).toLowerCase()), 1, 1),
  UPPER: cell((a) => textValue(asText(a[0]!).toUpperCase()), 1, 1),
  TRIM: cell((a) => textValue(asText(a[0]!).replace(/ +/g, ' ').replace(/^ | $/g, '')), 1, 1),
  LEFT: cell((a) => {
    const s = cps(asText(a[0]!));
    const n = a.length > 1 ? asInt(a[1]!) : 1;
    if (n < 0) return err('#NUM!');
    return textValue(s.slice(0, n).join(''));
  }, 1, 2),
  RIGHT: cell((a) => {
    const s = cps(asText(a[0]!));
    const n = a.length > 1 ? asInt(a[1]!) : 1;
    if (n < 0) return err('#NUM!');
    return textValue(s.slice(Math.max(0, s.length - n)).join(''));
  }, 1, 2),
  MID: cell((a) => {
    const s = cps(asText(a[0]!));
    const start = asInt(a[1]!);
    const n = asInt(a[2]!);
    if (start < 1 || n < 0) return err('#NUM!');
    return textValue(s.slice(start - 1, start - 1 + n).join(''));
  }, 3, 3),
  FIND: cell((a) => findText(a, false), 2, 3),
  SEARCH: cell((a) => findText(a, true), 2, 3),
  SUBSTITUTE: cell((a) => {
    const s = asText(a[0]!);
    const oldText = asText(a[1]!);
    const newText = asText(a[2]!);
    if (oldText === '') return textValue(s);
    return textValue(s.split(oldText).join(newText));
  }, 3, 3),
  REPLACE: cell((a) => {
    const s = cps(asText(a[0]!));
    const start = asInt(a[1]!);
    const count = asInt(a[2]!);
    const repl = asText(a[3]!);
    if (start < 1 || count < 0) return err('#NUM!');
    if (start > s.length) return textValue(s.join('') + repl);
    return textValue(s.slice(0, start - 1).join('') + repl + s.slice(start - 1 + count).join(''));
  }, 4, 4),
  REPT: cell((a) => {
    const s = asText(a[0]!);
    const n = asInt(a[1]!);
    if (n < 0) return err('#NUM!');
    if (s.length * n > MAX_TEXT) return err('#OVERFLOW!');
    return textValue(s.repeat(n));
  }, 2, 2),
  VALUE: cell((a) => {
    const v = a[0]!;
    if (v.t === 'num') return v;
    if (v.t !== 'text') return err('#VALUE!');
    const t = v.v.replace(/^ +| +$/g, '');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return err('#VALUE!');
    return numValue(Number(t));
  }, 1, 1),

  // ----- logic (7) — IF, AND, OR, SWITCH are lazy -----
  IF: { min: 2, max: 3, lazy: true },
  AND: { min: 1, max: VARIADIC, lazy: true },
  OR: { min: 1, max: VARIADIC, lazy: true },
  NOT: cell((a) => ({ t: 'bool', v: !asBool(a[0]!) }), 1, 1),
  XOR: cell((a) => ({ t: 'bool', v: asBool(a[0]!) !== asBool(a[1]!) }), 2, 2),
  SWITCH: { min: 3, max: VARIADIC, lazy: true },
  BLANK: cell(() => BLANK, 0, 0),

  // ----- date and time (15) -----
  DATE: cell((a) => {
    const p = parseDateText(asText(a[0]!));
    if (!p) return err('#VALUE!');
    return { t: 'date', y: p.y, m: p.m, d: p.d };
  }, 1, 1),
  TODAY: cell((_a, ctx) => {
    const p = msToParts(ctx.now);
    return { t: 'date', y: p.y, m: p.m, d: p.d };
  }, 0, 0),
  NOW: cell((_a, ctx) => ({ t: 'dt', ms: ctx.now }), 0, 0),
  DATEADD: cell((a) => {
    const v = asTemporal(a[0]!);
    const n = Math.trunc(asNumber(a[1]!));
    const unit = asText(a[2]!).toLowerCase();
    if (!UNITS.has(unit)) return err('#VALUE!');
    return dateAdd(v, n, unit);
  }, 3, 3),
  DATETIME_DIFF: cell((a) => {
    const x = asTemporal(a[0]!);
    const y = asTemporal(a[1]!);
    const unit = asText(a[2]!).toLowerCase();
    if (!UNITS.has(unit)) return err('#VALUE!');
    return numValue(dateDiff(x, y, unit));
  }, 3, 3),
  IS_BEFORE: cell((a) => {
    const x = asTemporal(a[0]!);
    const y = asTemporal(a[1]!);
    return { t: 'bool', v: temporalMs(x) < temporalMs(y) };
  }, 2, 2),
  IS_AFTER: cell((a) => {
    const x = asTemporal(a[0]!);
    const y = asTemporal(a[1]!);
    return { t: 'bool', v: temporalMs(x) > temporalMs(y) };
  }, 2, 2),
  YEAR: cell((a) => numValue(partsOf(asTemporal(a[0]!)).y), 1, 1),
  MONTH: cell((a) => numValue(partsOf(asTemporal(a[0]!)).m), 1, 1),
  DAY: cell((a) => numValue(partsOf(asTemporal(a[0]!)).d), 1, 1),
  WEEKDAY: cell((a) => numValue(weekdayIso(partsOf(asTemporal(a[0]!)))), 1, 1),
  HOUR: cell((a) => numValue(partsOf(asTemporal(a[0]!)).hh), 1, 1),
  MINUTE: cell((a) => numValue(partsOf(asTemporal(a[0]!)).mm), 1, 1),
  SECOND: cell((a) => numValue(partsOf(asTemporal(a[0]!)).ss), 1, 1),
  DATETIME_FORMAT: cell((a) => {
    const v = asTemporal(a[0]!);
    return textValue(formatPattern(v, asText(a[1]!)));
  }, 2, 2),

  // ----- record (3) -----
  RECORD_ID: cell((_a, ctx) => textValue(ctx.rowId), 0, 0),
  CREATED_TIME: cell((_a, ctx) => ({ t: 'dt', ms: ctx.createdMs }), 0, 0),
  LAST_MODIFIED_TIME: cell((_a, ctx) => ({ t: 'dt', ms: ctx.modifiedMs }), 0, 0),
};

function findText(a: Value[], ci: boolean): Value {
  const hay = cps(asText(a[1]!));
  const needle = cps(asText(a[0]!));
  const start = a.length > 2 ? asInt(a[2]!) : 1;
  if (start < 1 || start > hay.length + 1) return err('#NUM!');
  if (needle.length === 0) return numValue(start);
  const norm = (c: string): string => (ci ? lowerCp(c) : c);
  const h = hay.map(norm);
  const nd = needle.map(norm);
  for (let i = start - 1; i + nd.length <= h.length; i++) {
    let ok = true;
    for (let j = 0; j < nd.length; j++) {
      if (h[i + j] !== nd[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return numValue(i + 1);
  }
  return numValue(0);
}
