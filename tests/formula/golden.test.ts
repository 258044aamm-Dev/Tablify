// Golden runner for docs/formula-spec.md (P8-02, SAD-61).
// Expected values were hand-worked in P8-01 with Asia/Dhaka local time. Inputs and
// outputs are both local-time, so the suite must pass in any zone. It is run in
// both UTC and TZ=Asia/Dhaka (see docs/evidence/P8-02.md). Setting process.env.TZ
// inside a vitest worker does not change the zone, so it is not done here.

import { describe, expect, it } from 'vitest';
import { GOLDEN_CASES, DEFAULT_CONTEXT, countByGroup, type GoldenCase } from './golden.cases';
import { parseDateTimeEncoded, showValue, singleFormulaEngine, sameValue } from './helpers';
import { FUNCTIONS } from '../../src/formula/functions';
import { parseDateTimeText, partsToMs, type Value } from '../../src/formula/value';

function expected(s: string): Value {
  if (s === 'blank') return { t: 'blank' };
  const i = s.indexOf(':');
  const kind = s.slice(0, i);
  const rest = s.slice(i + 1);
  switch (kind) {
    case 'num':
      return { t: 'num', v: Number(rest) };
    case 'text':
      return { t: 'text', v: rest };
    case 'bool':
      return { t: 'bool', v: rest === 'true' };
    case 'date': {
      const [y, m, d] = rest.split('-').map(Number) as [number, number, number];
      return { t: 'date', y, m, d };
    }
    case 'datetime': {
      const p = parseDateTimeText(rest);
      if (!p) throw new Error(`bad expected datetime ${s}`);
      return { t: 'dt', ms: partsToMs(p) };
    }
    case 'err':
      return { t: 'err', code: rest as never };
    default:
      throw new Error(`bad expect ${s}`);
  }
}

function runCase(c: GoldenCase): Value {
  const now = parseDateTimeEncoded(c.now ?? DEFAULT_CONTEXT.now);
  const row = { ...DEFAULT_CONTEXT.row, ...(c.row ?? {}) };
  const { engine, rowId, fieldId } = singleFormulaEngine(
    c.formula,
    c.fields,
    now,
    {
      id: row.id,
      createdMs: parseDateTimeEncoded(row.createdTime),
      modifiedMs: parseDateTimeEncoded(row.modifiedTime),
    },
  );
  expect(engine.stats.internalErrors).toBe(0);
  return engine.value(rowId, fieldId);
}

describe('golden cases (docs/formula-spec.md)', () => {
  it('has 204 cases with at least 3 per function', () => {
    expect(GOLDEN_CASES.length).toBe(204);
    const counts = countByGroup();
    for (const name of Object.keys(FUNCTIONS)) {
      const n = GOLDEN_CASES.filter((c) => c.formula.toUpperCase().includes(name + '(')).length;
      expect(n, `function ${name}`).toBeGreaterThanOrEqual(3);
    }
    expect(Object.keys(FUNCTIONS).length).toBe(54);
    expect(Object.keys(counts).length).toBeGreaterThan(0);
  });

  for (const c of GOLDEN_CASES) {
    it(`${c.id}: ${c.formula}`, () => {
      const actual = runCase(c);
      const want = expected(c.expect);
      if (!sameValue(actual, want)) {
        throw new Error(`${c.id} ${c.formula}: expected ${c.expect}, got ${showValue(actual)}`);
      }
    });
  }
});
