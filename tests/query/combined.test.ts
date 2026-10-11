/**
 * splitSearchQuery / joinSearchQuery (SAD-78): the single "Search or query" box maps onto the
 * persisted view.search + view.query halves exactly, and the strict parser still decides.
 */

import { describe, it, expect } from 'vitest';
import { splitSearchQuery, joinSearchQuery, toInputPosition } from '../../src/query/combined.js';
import { parseQuery, printQuery, type QueryAST, type QueryTerm } from '../../src/query/parse.js';
import { mulberry32, randomChoice, randomInt } from './fixtures.js';

const split = (s: string) => {
  const r = splitSearchQuery(s);
  return { search: r.search, query: r.query };
};

describe('splitSearchQuery', () => {
  it.each([
    ['', '', ''],
    ['   ', '', ''],
    ['alpha', 'alpha', ''],
    ['big deal', 'big deal', ''],
    ['Status:Done', '', 'Status:Done'],
    ['foo Status:Done bar Amount:>10', 'foo bar', 'Status:Done Amount:>10'],
    ['"Estimate (h)":>5 hello', 'hello', '"Estimate (h)":>5'],
    ['Name:"hello world" x', 'x', 'Name:"hello world"'],
    ['Tags:UI, Perf', '', 'Tags:UI, Perf'],
    ['Tags:UI,Perf Due:empty', '', 'Tags:UI,Perf Due:empty'],
    ['Status : Done', '', 'Status : Done'],
    ['Due:', '', 'Due:'],
    ['Task:~grid', '', 'Task:~grid'],
    ['Status:!Done', '', 'Status:!Done'],
    ['"big deal" x', 'big deal x', ''],
    ['"say ""hi"""', 'say "hi"', ''],
    ['"abc', 'abc', ''],
    ['  lead  Status:Done   trail ', 'lead trail', 'Status:Done'],
  ])('%j → search %j, query %j', (input, search, query) => {
    expect(split(input)).toEqual({ search, query });
  });

  it('the prototype placeholder example is all query, and parses', () => {
    const r = splitSearchQuery('Status:Done  Task:~grid  "Estimate (h)":>5  Tags:UI,Perf  Due:empty');
    expect(r.search).toBe('');
    const parsed = parseQuery(r.query);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.ast.terms.map((t) => t.op)).toEqual(['eq', 'contains', 'gt', 'eq', 'empty']);
  });

  it('a term with an invalid body still goes to the query, so the strict parser reports it', () => {
    const r = splitSearchQuery('hello Amount:>');
    expect(r.search).toBe('hello');
    expect(r.query).toBe('Amount:>');
    expect(parseQuery(r.query).ok).toBe(false);
  });

  it('maps every query index back onto the input text', () => {
    const input = 'foo  Status:Done bar Amount:>10';
    const r = splitSearchQuery(input);
    for (let k = 0; k < r.query.length; k++) {
      if (r.query[k] !== ' ') expect(input[r.map[k]]).toBe(r.query[k]);
    }
    expect(r.map).toHaveLength(r.query.length + 1);
  });

  it('error positions point at the offending spot in the box', () => {
    const input = 'foo Status:Done Amount:>';
    const r = splitSearchQuery(input);
    const parsed = parseQuery(r.query);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      const at = toInputPosition(r, parsed.error.position);
      // "Expected value after '>'" points at the end of the box.
      expect(at).toBe(input.length);
    }
  });
});

describe('joinSearchQuery', () => {
  it('joins search first, trims, and skips empty halves', () => {
    expect(joinSearchQuery('alpha', 'Status:Done')).toBe('alpha Status:Done');
    expect(joinSearchQuery('', 'Status:Done')).toBe('Status:Done');
    expect(joinSearchQuery(' alpha ', '')).toBe('alpha');
    expect(joinSearchQuery(null, undefined)).toBe('');
  });
});

describe('round trip (property, seeded)', () => {
  const FIELDS = ['Name', 'Status', 'Estimate (h)', 'Due date', 'Tags', 'Notes: long', 'Say "hi"'];
  const WORDS = ['alpha', 'beta', 'ship', 'x', 'Done', '42', 'über', 'a-b', '(h)'];

  function randomTerm(rand: () => number): QueryTerm {
    const rawFieldName = randomChoice(rand, FIELDS);
    const op = randomChoice(rand, ['eq', 'contains', 'not', 'gt', 'lt', 'empty'] as const);
    const pool = ['Done', 'In progress', 'a,b', 'x:y', '', '10', 'say "hi"'];
    let values: string[] = [];
    if (op === 'eq') {
      values = Array.from({ length: randomInt(rand, 1, 3) }, () => randomChoice(rand, pool.filter(Boolean)));
    } else if (op !== 'empty') {
      values = [randomChoice(rand, pool.filter(Boolean))];
    }
    return { fieldName: rawFieldName.toLowerCase(), rawFieldName, op, values, raw: '', position: 0 };
  }

  it('split(join(words, terms)) recovers both halves; the query parses to the same terms', () => {
    const rand = mulberry32(7801);
    for (let iter = 0; iter < 500; iter++) {
      const terms = Array.from({ length: randomInt(rand, 0, 3) }, () => randomTerm(rand));
      const ast: QueryAST = { terms, rawInput: '' };
      const printed = terms.map((t) => printQuery({ terms: [t], rawInput: '' }));
      const words = Array.from({ length: randomInt(rand, 0, 3) }, () => randomChoice(rand, WORDS));

      // Interleave words and terms in random order, with random whitespace.
      const tokens = [...printed.map((p) => ({ kind: 'term', p })), ...words.map((p) => ({ kind: 'word', p }))];
      for (let k = tokens.length - 1; k > 0; k--) {
        const m = randomInt(rand, 0, k);
        [tokens[k], tokens[m]] = [tokens[m], tokens[k]];
      }
      const input = tokens.map((t) => t.p).join(randomChoice(rand, [' ', '  ', '\t']));
      const r = splitSearchQuery(input);

      expect(r.search, input).toBe(tokens.filter((t) => t.kind === 'word').map((t) => t.p).join(' '));
      const want = parseQuery(printQuery(ast));
      const got = parseQuery(r.query);
      expect(got.ok, input).toBe(want.ok);
      if (got.ok && want.ok) {
        const shape = (a: QueryAST) => a.terms.map((t) => [t.fieldName, t.op, t.values]);
        const order = tokens.filter((t) => t.kind === 'term').map((t) => t.p);
        const byOrder = parseQuery(order.join(' '));
        expect(byOrder.ok).toBe(true);
        if (byOrder.ok) expect(shape(got.ast), input).toEqual(shape(byOrder.ast));
      }
    }
  });
});
