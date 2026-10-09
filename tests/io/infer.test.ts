// T-U for P4-03: each inference rule has tests (guidelines §0.2).
import { describe, it, expect } from 'vitest';
import { inferColumn, inferTable, parseDateText, isEmptyCell } from '../../src/io/infer.js';

describe('date rules (P4-03 G-P3)', () => {
  it('accepts ISO YYYY-MM-DD', () => {
    expect(parseDateText('2026-02-13')).toBe('2026-02-13');
    expect(parseDateText(' 2024-02-29 ')).toBe('2024-02-29');
  });
  it('rejects invalid calendar dates', () => {
    expect(parseDateText('2026-02-30')).toBeNull();
    expect(parseDateText('2025-02-29')).toBeNull();
    expect(parseDateText('2026-13-01')).toBeNull();
    expect(parseDateText('2026-00-10')).toBeNull();
  });
  it('accepts year-first slashes', () => {
    expect(parseDateText('2026/01/31')).toBe('2026-01-31');
  });
  it('treats A/B/YYYY with both parts <= 12 as ambiguous (not a date)', () => {
    expect(parseDateText('01/02/2026')).toBeNull();
    expect(parseDateText('12.12.2026')).toBeNull();
  });
  it('decides day vs month when one part is > 12', () => {
    expect(parseDateText('13/02/2026')).toBe('2026-02-13'); // day first
    expect(parseDateText('02/13/2026')).toBe('2026-02-13'); // month first
    expect(parseDateText('31.01.2026')).toBe('2026-01-31');
  });
  it('rejects impossible numeric dates (both parts > 12, or invalid day for the month)', () => {
    expect(parseDateText('13/13/2026')).toBeNull();
    expect(parseDateText('31/04/2026')).toBeNull();
  });
  it('accepts day, English month name, year', () => {
    expect(parseDateText('12 Jan 2026')).toBe('2026-01-12');
    expect(parseDateText('3 September 2025')).toBe('2025-09-03');
    expect(parseDateText('3 Janxyz 2025')).toBeNull();
  });
});

describe('empty cells', () => {
  it('treats null, undefined, empty and whitespace-only text as empty', () => {
    expect(isEmptyCell(null)).toBe(true);
    expect(isEmptyCell(undefined)).toBe(true);
    expect(isEmptyCell('')).toBe(true);
    expect(isEmptyCell('  \t')).toBe(true);
    expect(isEmptyCell(0)).toBe(false);
    expect(isEmptyCell(false)).toBe(false);
  });
  it('ignores empty cells when inferring', () => {
    const r = inferColumn(['1.5', '', null, '  ', '2']);
    expect(r.type).toBe('number');
    expect(r.nonEmpty).toBe(2);
  });
  it('a column with no values is text', () => {
    expect(inferColumn(['', null, undefined]).type).toBe('text');
  });
});

describe('checkbox rule', () => {
  it('accepts the spec word list, case-insensitive', () => {
    expect(inferColumn(['true', 'FALSE', 'Yes', 'no', '1', '0']).type).toBe('checkbox');
  });
  it('accepts native booleans', () => {
    expect(inferColumn([true, false, true]).type).toBe('checkbox');
  });
  it('accepts native 0 and 1', () => {
    expect(inferColumn([1, 0, 1, 0]).type).toBe('checkbox');
  });
  it('does not accept Y/N (outside the spec word list)', () => {
    expect(inferColumn(['Y', 'N', 'Y']).type).not.toBe('checkbox');
  });
  it('a single noisy value makes the column not checkbox (strict)', () => {
    expect(inferColumn(['yes', 'no', 'maybe']).type).not.toBe('checkbox');
  });
});

describe('number rule', () => {
  it('accepts decimals, signs, leading dot, exponent', () => {
    const r = inferColumn(['1.5', '-3', '+2', '.5', '1e3', '0.25', '42']);
    expect(r.type).toBe('number');
    expect(r.matchRatio).toBe(1);
  });
  it('accepts native numbers and rejects NaN/Infinity', () => {
    expect(inferColumn([1.5, 2, -7]).type).toBe('number');
    expect(inferColumn([Number.NaN, 2, 3]).type).not.toBe('number');
  });
  it('rejects thousands separators and comma decimals (locale-free rule, G-A5)', () => {
    expect(inferColumn(['1,5', '2,25']).type).toBe('text');
    expect(inferColumn(['1,000', '2,500']).type).toBe('text');
  });
  it('rejects NaN and Infinity text', () => {
    expect(inferColumn(['NaN', 'Infinity', '1']).type).toBe('text');
  });
});

describe('date column rule', () => {
  it('a column of ISO dates is date', () => {
    expect(inferColumn(['2026-01-02', '2025-12-31', '2024-02-29']).type).toBe('date');
  });
  it('a column of ambiguous-only dates is text (documented misclassification)', () => {
    expect(inferColumn(['01/02/2026', '03/04/2026', '05/06/2026']).type).toBe('text');
  });
  it('accepts native Date objects using UTC components', () => {
    expect(inferColumn([new Date(Date.UTC(2026, 0, 2)), new Date(Date.UTC(2026, 11, 31))]).type).toBe('date');
  });
});

describe('single_select rule', () => {
  it('<= 20 distinct and <= 50% of rows is single_select', () => {
    const values = Array.from({ length: 100 }, (_, i) => `Opt ${i % 5}`);
    const r = inferColumn(values);
    expect(r.type).toBe('single_select');
    expect(r.selectOptions).toEqual(['Opt 0', 'Opt 1', 'Opt 2', 'Opt 3', 'Opt 4']);
  });
  it('21 distinct values is text', () => {
    const values = Array.from({ length: 100 }, (_, i) => `Opt ${i % 21}`);
    expect(inferColumn(values).type).toBe('text');
  });
  it('more than 50% distinct rows is text', () => {
    const values = Array.from({ length: 10 }, (_, i) => `v${i % 6}`); // 6 distinct / 10 rows = 60%
    expect(inferColumn(values).type).toBe('text');
  });
  it('compares trimmed values', () => {
    const r = inferColumn(['A', ' A ', 'B', 'B', 'A', 'B']);
    expect(r.type).toBe('single_select');
    expect(r.distinct).toBe(2);
  });
  it('selectOptions is undefined for other types', () => {
    expect(inferColumn(['1', '2', '3']).selectOptions).toBeUndefined();
  });
});

describe('tolerance option (sensitivity only, not default)', () => {
  const noisy = Array.from({ length: 100 }, (_, i) => (i === 0 ? 'N/A' : String(i)));
  it('default strict: one bad value makes the column text', () => {
    expect(inferColumn(noisy).type).toBe('text');
  });
  it('with 5% tolerance the column is number and matchRatio reports it', () => {
    const r = inferColumn(noisy, { tolerance: 0.05 });
    expect(r.type).toBe('number');
    expect(r.matchRatio).toBeCloseTo(0.99, 5);
  });
});

describe('inferTable', () => {
  it('infers each column of a row-major table, ragged rows allowed', () => {
    const rows = [
      ['2026-01-02', '1.5', 'yes'],
      ['2026-01-03', '2', 'no'],
      ['2026-01-04'],
    ];
    const cols = inferTable(rows, 3);
    expect(cols.map((c) => c.type)).toEqual(['date', 'number', 'checkbox']);
  });
});

describe('Date values (native)', () => {
  it('a Date with a time-of-day is not a date (would lose the time)', () => {
    expect(inferColumn([new Date(Date.UTC(2026, 0, 2, 12, 30)), new Date(Date.UTC(2026, 0, 3))]).type).toBe('text');
  });
});
