// Seeded fuzz (P8-02, SAD-61): 10,000 random formula strings. No input may throw an
// exception out of the engine, and every result must be a valid Value.
import { describe, expect, it } from 'vitest';
import { compileFormula, evaluate, type EvalContext } from '../../src/formula';
import { BLANK, at, type Value } from '../../src/formula/value';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FRAGMENTS = [
  '1', '0', '2.5', '-3', '"a"', '""', '"b\\"c"', '"x\\\\y"', '{Price}', '{Name}', '{Missing}', '{Date}',
  'SUM(', 'IF(', 'AND(', 'OR(', 'SWITCH(', 'DATE(', 'NOW()', 'TODAY()', 'DATEADD(', 'ABS(', 'ROUND(',
  'MID(', 'FIND(', 'REPT(', 'DATETIME_DIFF(', 'DATETIME_FORMAT(', 'TRUE', 'FALSE', 'foo', 'BLANK()',
  '(', ')', ',', '+', '-', '*', '/', '^', '&', '=', '!=', '<', '<=', '>', '>=', ' ', '\\', '"', '{', '}',
  '\t', '\n', '1e5', '.5', '1.', '#', '@', 'é', '😀',
];

const CHARS = 'abcXYZ0123456789 +-*/^&=<>(),{}"\\\'.!';

function randomFormula(rand: () => number): string {
  const len = Math.floor(rand() * 40);
  let s = '';
  for (let i = 0; i < len; i++) {
    if (rand() < 0.7) s += FRAGMENTS[Math.floor(rand() * FRAGMENTS.length)];
    else s += CHARS.charAt(Math.floor(rand() * CHARS.length));
  }
  return s;
}

const FN_NAMES = [
  'SUM', 'MIN', 'MAX', 'AVERAGE', 'COUNT', 'ABS', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'CEILING', 'FLOOR', 'INT', 'MOD',
  'POWER', 'SQRT', 'CONCATENATE', 'LEN', 'LOWER', 'UPPER', 'TRIM', 'LEFT', 'RIGHT', 'MID', 'FIND', 'SEARCH',
  'SUBSTITUTE', 'REPLACE', 'REPT', 'VALUE', 'IF', 'AND', 'OR', 'NOT', 'XOR', 'SWITCH', 'BLANK', 'DATE', 'TODAY',
  'NOW', 'DATEADD', 'DATETIME_DIFF', 'IS_BEFORE', 'IS_AFTER', 'YEAR', 'MONTH', 'DAY', 'WEEKDAY', 'HOUR', 'MINUTE',
  'SECOND', 'DATETIME_FORMAT', 'RECORD_ID', 'CREATED_TIME', 'LAST_MODIFIED_TIME', 'NOPE',
];
const LEAVES = ['1', '0', '-2.5', '"t"', '""', 'TRUE', 'FALSE', '{Price}', '{Name}', '{Date}', '{Missing}', 'NOW()'];
const BINOPS = ['+', '-', '*', '/', '^', '&', '=', '!=', '<', '<=', '>', '>='];

/** Grammar-aware generator: mostly valid syntax with random types, arities, and operators. */
function structuredFormula(rand: () => number, depth: number): string {
  const pick = <T,>(xs: readonly T[]): T => at(xs, Math.floor(rand() * xs.length));
  if (depth <= 0 || rand() < 0.3) return pick(LEAVES);
  const r = rand();
  if (r < 0.35) {
    return `${structuredFormula(rand, depth - 1)} ${pick(BINOPS)} ${structuredFormula(rand, depth - 1)}`;
  }
  if (r < 0.4) return `-${structuredFormula(rand, depth - 1)}`;
  if (r < 0.45) return `(${structuredFormula(rand, depth - 1)})`;
  const n = Math.floor(rand() * 4);
  const args: string[] = [];
  for (let i = 0; i < n; i++) args.push(structuredFormula(rand, depth - 1));
  return `${pick(FN_NAMES)}(${args.join(', ')})`;
}

function ctx(): EvalContext {
  const fields: Record<string, Value> = {
    Price: { t: 'num', v: 12 },
    Name: { t: 'text', v: 'Widget' },
    Date: { t: 'date', y: 2026, m: 10, d: 10 },
  };
  return {
    rowId: 'row_fuzz',
    createdMs: 0,
    modifiedMs: 0,
    now: 1_800_000_000_000,
    field: (name: string) => (name in fields ? fields[name] : BLANK),
  };
}

const VALID_TYPES = new Set(['blank', 'num', 'text', 'bool', 'date', 'dt', 'err']);

describe('fuzz: formula compiler and evaluator', () => {
  it('10,000 seeded random formulas never throw and always yield a Value', () => {
    const rand = mulberry32(0x5eed_8e8);
    const c = ctx();
    let compiledOk = 0;
    let errorResults = 0;
    for (let i = 0; i < 10_000; i++) {
      const src = i % 2 === 0 ? structuredFormula(rand, 4) : randomFormula(rand);
      const compiled = compileFormula(src);
      if (compiled.ok) {
        compiledOk++;
        const v = evaluate(compiled.root, c);
        expect(VALID_TYPES.has(v.t), `case ${i} ${JSON.stringify(src)}`).toBe(true);
        if (v.t === 'err') errorResults++;
      } else {
        expect(compiled.code).toBe('#PARSE!');
      }
    }
    // Sanity: the generator reaches both parse and evaluation paths.
    expect(compiledOk).toBeGreaterThan(3000);
    expect(errorResults).toBeGreaterThan(1000);
  });

  it('oversized input is rejected as #PARSE! without exceptions', () => {
    const r = compileFormula('1+'.repeat(1500) + '1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('#PARSE!');
  });

  it('deeply nested input is rejected as #PARSE!, not a stack overflow', () => {
    const r = compileFormula('('.repeat(120) + '1' + ')'.repeat(120));
    expect(r.ok).toBe(false);
  });
});
