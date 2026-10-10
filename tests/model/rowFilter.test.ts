/**
 * Row filtering for the saved view search and query (SAD-69 Step 3).
 *
 * These are the model-level tests for src/model/rowFilter.ts. The matching rules come from
 * P3-08: search is a case-insensitive substring test over each cell's *display* text, so a
 * select matches its label and never its raw option id.
 */

import { describe, it, expect } from 'vitest';
import { filterRows, searchRows, searchableText, compileQuery } from '../../src/model/rowFilter.js';
import { FIELDS, makeFile } from '../io/export.fixtures.js';
import type { CellValue, FieldDefinition, Row } from '../../src/model/types.js';

const STATUS = FIELDS.find((f) => f.id === 'fld_status') as FieldDefinition;
const AMOUNT = FIELDS.find((f) => f.id === 'fld_amount') as FieldDefinition;

function mkRow(id: string, values: Record<string, CellValue>): Row {
  return {
    id,
    rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    values,
    sync: null,
  };
}

const ROWS: Row[] = [
  mkRow('row_1', { fld_name: 'Alpha', fld_amount: 5, fld_status: 'opt_done' }),
  mkRow('row_2', { fld_name: 'Beta', fld_amount: 15, fld_status: 'opt_todo' }),
  mkRow('row_3', { fld_name: 'gamma', fld_amount: 25, fld_status: 'opt_doing' }),
];

const ids = (rows: Row[]): string[] => rows.map((r) => r.id);

describe('rowFilter — searchableText', () => {
  it('formats a select as its label, not its raw option id', () => {
    // The whole point of using display text: searching must never leak raw ids like opt_done.
    expect(searchableText('opt_done' as CellValue, STATUS)).toBe('Done');
  });

  it('returns an empty string for null and undefined', () => {
    expect(searchableText(null, STATUS)).toBe('');
    expect(searchableText(undefined, STATUS)).toBe('');
  });

  it('formats a number as its plain text', () => {
    expect(searchableText(15 as CellValue, AMOUNT)).toBe('15');
  });
});

describe('rowFilter — searchRows', () => {
  it('matches case-insensitively', () => {
    expect(ids(searchRows(ROWS, FIELDS, 'alpha'))).toEqual(['row_1']);
    expect(ids(searchRows(ROWS, FIELDS, 'ALPHA'))).toEqual(['row_1']);
    expect(ids(searchRows(ROWS, FIELDS, 'Gamma'))).toEqual(['row_3']);
  });

  it('returns every row for an empty or whitespace-only term', () => {
    expect(ids(searchRows(ROWS, FIELDS, ''))).toEqual(['row_1', 'row_2', 'row_3']);
    expect(ids(searchRows(ROWS, FIELDS, '   '))).toEqual(['row_1', 'row_2', 'row_3']);
    expect(ids(searchRows(ROWS, FIELDS, undefined))).toEqual(['row_1', 'row_2', 'row_3']);
  });

  it('matches a select by its visible label', () => {
    expect(ids(searchRows(ROWS, FIELDS, 'done'))).toEqual(['row_1']);
    expect(ids(searchRows(ROWS, FIELDS, 'todo'))).toEqual(['row_2']);
  });

  it('does not match a select by its raw option id', () => {
    // Guards P3-08's rule that a select is searchable only by text visible in the view.
    expect(searchRows(ROWS, FIELDS, 'opt_done')).toEqual([]);
    expect(searchRows(ROWS, FIELDS, 'opt_')).toEqual([]);
  });

  it('matches on any field, including a hidden one', () => {
    const rows = [mkRow('row_1', { fld_name: 'Visible', fld_hidden: 4242 })];
    expect(ids(searchRows(rows, FIELDS, '4242'))).toEqual(['row_1']);
  });

  it('does not mutate the input array', () => {
    const input = [...ROWS];
    searchRows(input, FIELDS, 'alpha');
    expect(input).toEqual(ROWS);
  });
});

describe('rowFilter — query', () => {
  it('filters by a field-name equality term using the option label', () => {
    const res = filterRows(ROWS, FIELDS, undefined, 'Status:Done');
    expect(res.error).toBeNull();
    expect(ids(res.rows)).toEqual(['row_1']);
  });

  it('filters with a greater-than term', () => {
    const res = filterRows(ROWS, FIELDS, undefined, 'Amount:>10');
    expect(res.error).toBeNull();
    expect(ids(res.rows)).toEqual(['row_2', 'row_3']);
  });

  it('returns all rows and no error for an empty or null query', () => {
    expect(filterRows(ROWS, FIELDS, undefined, '').rows).toHaveLength(3);
    expect(filterRows(ROWS, FIELDS, undefined, '').error).toBeNull();
    expect(filterRows(ROWS, FIELDS, undefined, null).rows).toHaveLength(3);
    expect(filterRows(ROWS, FIELDS, undefined, null).error).toBeNull();
  });

  it('reports an error and leaves rows unfiltered for an unparsable query', () => {
    // Fail open: the toolbar shows the inline error, and hiding every row would be worse.
    const res = filterRows(ROWS, FIELDS, undefined, 'Amount:"unclosed');
    expect(res.error).not.toBeNull();
    expect(res.error?.message).toBeTruthy();
    expect(ids(res.rows)).toEqual(['row_1', 'row_2', 'row_3']);
  });

  it('reports an error for a query naming an unknown field', () => {
    const res = filterRows(ROWS, FIELDS, undefined, 'Nope:1');
    expect(res.error).not.toBeNull();
    expect(ids(res.rows)).toEqual(['row_1', 'row_2', 'row_3']);
  });

  it('combines search and query with AND', () => {
    const res = filterRows(ROWS, FIELDS, 'a', 'Amount:>10');
    expect(res.error).toBeNull();
    expect(ids(res.rows)).toEqual(['row_2', 'row_3']);

    const narrowed = filterRows(ROWS, FIELDS, 'beta', 'Amount:>10');
    expect(ids(narrowed.rows)).toEqual(['row_2']);

    const empty = filterRows(ROWS, FIELDS, 'beta', 'Amount:>20');
    expect(empty.rows).toEqual([]);
  });
});

describe('rowFilter — compileQuery', () => {
  it('returns a null predicate for an empty query', () => {
    const res = compileQuery('', FIELDS);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.predicate).toBeNull();
  });

  it('returns the parse error for an invalid query', () => {
    const res = compileQuery('Amount:"unclosed', FIELDS);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.position).toBeGreaterThanOrEqual(0);
  });
});

describe('rowFilter — performance (PERF-2)', () => {
  it('filters 5k rows with search and query well under the 200 ms budget', () => {
    const rows = makeFile(5000).rows;
    const t0 = performance.now();
    const res = filterRows(rows, FIELDS, 'note', 'Amount:>10');
    const elapsed = performance.now() - t0;
    expect(res.error).toBeNull();
    expect(res.rows.length).toBeGreaterThan(0);
    expect(res.rows.length).toBeLessThan(rows.length);
    expect(elapsed, `filter took ${elapsed.toFixed(1)}ms`).toBeLessThan(200);
  });
});
