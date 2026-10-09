import { describe, it, expect } from 'vitest';
import { parseQuery } from '../../src/query/parse.js';
import { evaluateQuery } from '../../src/query/evaluate.js';
import { HAND_FIELDS, HAND_ROWS } from './fixtures.js';

function evalQuery(q: string): ReturnType<typeof evaluateQuery> {
  const parsed = parseQuery(q);
  if (!parsed.ok) throw new Error(`Parse failed for "${q}": ${parsed.error.message}`);
  return evaluateQuery(parsed.ast, HAND_ROWS, HAND_FIELDS);
}

describe('P2-02 — Filter engine — hand-written cases (30)', () => {
  const cases: Array<{ query: string; expectIds: string[]; description: string }> = [
    { query: '', expectIds: ['row_1', 'row_2', 'row_3', 'row_4', 'row_5'], description: 'empty query → match-all' },
    { query: 'Status:Done', expectIds: ['row_1', 'row_4'], description: 'single_select eq case-insensitive name' },
    { query: 'Status:done', expectIds: ['row_1', 'row_4'], description: 'CI value via option name lower' },
    { query: '"Status":Done', expectIds: ['row_1', 'row_4'], description: 'quoted field name' },
    { query: 'Name:~ali', expectIds: ['row_1'], description: 'text contains case-insensitive' },
    { query: 'Name:~ALICE', expectIds: ['row_1'], description: 'contains CI' },
    { query: 'Name:ship,boat', expectIds: ['row_1', 'row_3', 'row_4'], description: 'text containsAny via comma (strict_each)' },
    { query: 'Status:Todo', expectIds: ['row_2', 'row_3', 'row_5'], description: 'single_select isAnyOf single' },
    { query: 'Status:Todo,Done', expectIds: ['row_1', 'row_2', 'row_3', 'row_4', 'row_5'], description: 'single_select isAnyOf multi → all with status' },
    { query: 'Tags:urgent', expectIds: ['row_1', 'row_3'], description: 'multi contains single' },
    { query: 'Tags:urgent,backlog', expectIds: ['row_1', 'row_2', 'row_3'], description: 'multi containsAny' },
    { query: 'Status:!Todo', expectIds: ['row_1', 'row_4'], description: 'not single_select' },
    { query: 'Score:>5', expectIds: ['row_2', 'row_4', 'row_5'], description: 'number gt' },
    { query: 'Score:<5', expectIds: ['row_3'], description: 'number lt' },
    { query: 'Score:10', expectIds: ['row_2'], description: 'number eq' },
    { query: 'Score:5,8', expectIds: ['row_1', 'row_4'], description: 'number eq OR' },
    { query: 'Due:<2026-02-01', expectIds: ['row_1', 'row_3', 'row_5'], description: 'date lt' },
    { query: 'Due:>2026-01-15', expectIds: ['row_2', 'row_3', 'row_4'], description: 'date gt' },
    { query: 'Due:2026-01-10', expectIds: ['row_1'], description: 'date eq' },
    { query: 'Due:2026-01-10,2026-02-10', expectIds: ['row_1', 'row_2'], description: 'date OR' },
    { query: 'Notes:empty', expectIds: ['row_2', 'row_5'], description: 'empty keyword (notes empty)' },
    { query: 'Notes:', expectIds: ['row_2', 'row_5'], description: 'empty value field:' },
    { query: 'Status:Done Name:~ship', expectIds: ['row_1', 'row_4'], description: 'AND across terms' },
    { query: 'Status:Done Name:~BOB', expectIds: [], description: 'AND fails' },
    { query: 'Name:"Alice ship"', expectIds: ['row_1'], description: 'quoted value with space' },
    { query: 'Name:"Charlie boat"', expectIds: ['row_3'], description: 'quoted exact with space' },
    { query: 'Tags:""', expectIds: ['row_4', 'row_5'], description: 'multi empty via quoted empty? actually Tags empty is [] for row_4/5' },
    { query: 'Active:true', expectIds: ['row_1', 'row_3', 'row_4'], description: 'checkbox true' },
    { query: 'Active:false', expectIds: ['row_2'], description: 'checkbox false (null not false)' },
    { query: 'Score:>5 Due:<2026-03-01 Tags:backlog', expectIds: ['row_2'], description: 'three terms AND' },
    { query: 'Name:~boat Tags:backlog', expectIds: ['row_3'], description: 'text contains + multi contains' },
  ];

  for (const c of cases) {
    it(`${c.description} — "${c.query}" → [${c.expectIds.join(',')}]`, () => {
      const res = evalQuery(c.query);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.matchedIds.sort()).toEqual(c.expectIds.sort());
    });
  }
});

describe('P2-02 — type mismatch → error (not empty)', () => {
  const errorCases: Array<{ query: string; match: RegExp }> = [
    { query: 'Name:>5', match: /not valid for text/ },
    { query: 'Score:~ship', match: /not valid for number/ },
    { query: 'Score:!5', match: /not valid for number/ },
    { query: 'Tags:!urgent', match: /not valid for multi_select/ },
    { query: 'Active:~yes', match: /not valid for checkbox/ },
    { query: 'Due:~2026', match: /not valid for date/ },
    { query: 'Score:>notANumber', match: /Invalid number/ },
    { query: 'Due:>notADate', match: /Invalid date/ },
    { query: 'Ghost:value', match: /Unknown field/ },
    { query: 'Active:>true', match: /not valid for checkbox/ },
    { query: 'Name:!foo', match: /not valid for text/ },
    { query: 'Due:!2026-01-01', match: /not valid for date/ },
    { query: 'Tags:>urgent', match: /not valid for multi_select/ },
  ];

  for (const c of errorCases) {
    it(`error for "${c.query}"`, () => {
      const parsed = parseQuery(c.query);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const res = evaluateQuery(parsed.ast, HAND_ROWS, HAND_FIELDS);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.message).toMatch(c.match);
    });
  }

  it('type mismatch returns error not empty result', () => {
    const parsed = parseQuery('Name:>5')!;
    if (!parsed.ok) throw new Error('parse failed');
    const res = evaluateQuery(parsed.ast, HAND_ROWS, HAND_FIELDS);
    expect(res.ok).toBe(false);
    // Not empty rows
    if (res.ok) expect(res.rows.length).not.toBe(0);
  });
});

describe('P2-02 — unknown option → no match (not error)', () => {
  it('single_select unknown option matches none', () => {
    const res = evalQuery('Status:BogusOption');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.matchedIds).toEqual([]);
  });

  it('multi_select unknown option matches none', () => {
    const res = evalQuery('Tags:bogus');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.matchedIds).toEqual([]);
  });

  it('single_select not with unknown option matches all (since no row has it)', () => {
    const res = evalQuery('Status:!BogusOption');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.matchedIds.length).toBe(HAND_ROWS.length);
  });
});
