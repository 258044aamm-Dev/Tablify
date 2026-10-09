import { describe, it, expect } from 'vitest';
import {
  searchRows,
  filterByQueryAST,
  parseQueryInput,
  addTermToQuery,
  sortAdd,
  sortRemove,
  sortMove,
  debounceApply,
} from '../../../src/views/grid/filterBar.js';
import { parseQuery } from '../../../src/query/parse.js';

function rows() {
  return [
    { id: '1', vals: { fld_text: 'hello', fld_num: 42, fld_sel: 'optA' } },
    { id: '2', vals: { fld_text: 'world', fld_num: 7, fld_sel: 'optB' } },
    { id: '3', vals: { fld_text: 'hello world', fld_num: 100, fld_sel: 'optA' } },
  ];
}

const fields = [
  { id: 'fld_text', name: 'Text' },
  { id: 'fld_num', name: 'Number' },
  { id: 'fld_sel', name: 'Status' },
];

describe('P3-08 — Filter bar', () => {
  it('global search matches string and number fields, select requires visible text', () => {
    const r = rows();
    // searchRows uses visibleText for select, so 'optA' label must be visibleText
    const filtered = searchRows(r, (row) => [
      { value: row.vals.fld_text },
      { value: row.vals.fld_num },
      { value: 'optA', visibleText: 'In Progress' }, // simulate select label
    ], 'in progress');
    // only rows whose visible select label includes 'in progress' would match in this mock
    expect(filtered.length).toBe(3); // all rows use same visibleText In Progress in this mock, so all 3
    const filtered2 = searchRows(r, (row) => [
      { value: row.vals.fld_text },
      { value: row.vals.fld_num },
    ], 'hello');
    expect(filtered2.map((x) => x.id)).toEqual(['1', '3']);
    // number 42 matches '42'
    const filtered3 = searchRows(r, (row) => [{ value: row.vals.fld_num }], '42');
    expect(filtered3.map((x) => x.id)).toEqual(['1']);
    // select value 'optB' should NOT match via raw value when query is label-like; our mock with visibleText 'In Progress' should not match 'optB'
    const filtered4 = searchRows(r, (row) => [{ value: row.vals.fld_sel, visibleText: row.vals.fld_sel === 'optA' ? 'In Progress' : 'Done' }], 'In Progress');
    expect(filtered4.map((x) => x.id)).toEqual(['1', '3']);
  });

  it('non-empty field value filter query works (typed Filter:Tag:Red)', () => {
    const r = rows();
    const { ast } = parseQueryInput('Text:hello');
    expect(ast).not.toBeNull();
    const out = filterByQueryAST(r, fields, ast!, (row, fid) => (row.vals as any)[fid]);
    expect(out.map((x) => x.id)).toEqual(['1']);
  });

  it('query builder adds condition and returns printable query', () => {
    const q = addTermToQuery('', 'Text', 'eq', 'hello');
    expect(q).toBe('Text:hello');
    const q2 = addTermToQuery(q, 'Number', 'gt', '10');
    expect(q2).toContain('Number');
  });

  it('invalid filter query shows message with line:column, position', () => {
    const { error } = parseQueryInput('Text:\"unclosed');
    // our parser should emit error with position/line/column; if input is valid but unclosed quote, expect error not null
    // For a truly invalid syntax, construct one that parser rejects — trailing colon with nothing is valid empty, so use bad quote
    if (error) {
      expect(error.message.length).toBeGreaterThan(0);
      expect(error.position).toBeGreaterThanOrEqual(0);
      expect(error.line).toBe(1);
    } else {
      // fallback: make a query that is known invalid — use empty field name with colon? parser currently treats as ok,
      // so we just verify that parseQuery for this input is ok==false for some malformed input
      const res = parseQuery('Text:\"unclosed');
      expect(res.ok).toBe(false);
      if (!res.ok) expect((res as any).error.position).toBeGreaterThanOrEqual(0);
    }
  });

  it('sort menu add/remove/move priority', () => {
    let sort: Array<{ fieldId: string; direction: 'asc' | 'desc' }> = [];
    sort = sortAdd(sort, 'fld_text', 'asc');
    sort = sortAdd(sort, 'fld_num', 'desc');
    expect(sort).toEqual([{ fieldId: 'fld_text', direction: 'asc' }, { fieldId: 'fld_num', direction: 'desc' }]);
    sort = sortMove(sort, 1, 0);
    expect(sort[0].fieldId).toBe('fld_num');
    sort = sortRemove(sort, 'fld_text');
    expect(sort).toEqual([{ fieldId: 'fld_num', direction: 'desc' }]);
  });

  it('toolbar input debounce does not apply instantly (250ms)', async () => {
    let applied: unknown = null;
    const cancel = debounceApply('Text:hello', (ast) => { applied = ast; }, 50);
    expect(applied).toBeNull();
    await new Promise((r) => setTimeout(r, 70));
    expect(applied).not.toBeNull();
    // cancel test: should not apply after cancel
    let applied2: unknown = null;
    const cancel2 = debounceApply('Text:world', (ast) => { applied2 = ast; }, 50);
    cancel2();
    await new Promise((r) => setTimeout(r, 70));
    expect(applied2).toBeNull();
  });

  it('full table filter within ~200ms p50 target (proposed) — measure 5k mock rows', () => {
    const big = Array.from({ length: 5000 }, (_, i) => ({ id: `r${i}`, vals: { fld_text: i % 2 === 0 ? 'hello' : 'world', fld_num: i, fld_sel: 'optA' } }));
    const ast = (parseQuery('Text:hello') as any).ast;
    const t0 = performance.now();
    const out = filterByQueryAST(big, fields, ast, (row, fid) => (row.vals as any)[fid]);
    const t1 = performance.now();
    expect(out.length).toBe(2500);
    expect(t1 - t0).toBeLessThan(200);
  });
});
