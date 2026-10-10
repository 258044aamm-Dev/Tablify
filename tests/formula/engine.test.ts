// Engine behaviour (P8-02, SAD-61): incremental vs full equality, cycle detection,
// per-edit call counts, and the FX-M timing check (proposed target, see evidence).
import { describe, expect, it } from 'vitest';
import { FormulaEngine, type FieldSpec, type RowSpec } from '../../src/formula/engine';
import { BLANK, err, type Value } from '../../src/formula/value';
import { sameValue, showValue } from './helpers';

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

const NOW = Date.UTC(2026, 9, 10, 4, 0, 0);

const CHAIN_FIELDS: FieldSpec[] = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
  { id: 'f1', name: 'F1', formula: '{A}*2+{C}' },
  { id: 'f2', name: 'F2', formula: '{F1}+1' },
  { id: 'f3', name: 'F3', formula: 'CONCATENATE({B},"-",{F2})' },
  { id: 'f4', name: 'F4', formula: 'IF({A}>5,{F3},"small")' },
  { id: 'f5', name: 'F5', formula: 'DATETIME_DIFF(NOW(),CREATED_TIME(),"hours")' },
];

function randomInput(rand: () => number, kind: 'a' | 'b' | 'c'): Value {
  const r = rand();
  if (r < 0.1) return BLANK;
  if (kind === 'b') return r < 0.5 ? { t: 'text', v: 'w' + Math.floor(rand() * 9) } : { t: 'text', v: '' };
  return { t: 'num', v: Math.floor(rand() * 20) - 4 };
}

function buildRows(rand: () => number, n: number): RowSpec[] {
  const rows: RowSpec[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      id: `r${i}`,
      createdMs: NOW - 3_600_000 * (i + 1),
      modifiedMs: NOW - 60_000 * i,
      inputs: { a: randomInput(rand, 'a'), b: randomInput(rand, 'b'), c: randomInput(rand, 'c') },
    });
  }
  return rows;
}

function snapshot(e: FormulaEngine, rows: RowSpec[], fields: FieldSpec[]): Value[] {
  const out: Value[] = [];
  for (const r of rows) for (const f of fields) out.push(e.value(r.id, f.id));
  return out;
}

describe('incremental equals full recalculation', () => {
  it('after 500 random edits, every cell matches a fresh full recalculation', () => {
    const rand = mulberry32(42);
    const rows = buildRows(rand, 30);
    const now = () => NOW;
    const engine = new FormulaEngine({ fields: CHAIN_FIELDS, rows, now });
    for (let step = 0; step < 500; step++) {
      const row = rows[Math.floor(rand() * rows.length)]!;
      const kind = (['a', 'b', 'c'] as const)[Math.floor(rand() * 3)]!;
      const v = randomInput(rand, kind);
      expect(engine.setInput(row.id, kind, v)).toBe(true);
      (row.inputs as Record<string, Value>)[kind] = v;

      const fresh = new FormulaEngine({ fields: CHAIN_FIELDS, rows, now });
      const got = snapshot(engine, rows, CHAIN_FIELDS);
      const want = snapshot(fresh, rows, CHAIN_FIELDS);
      for (let i = 0; i < got.length; i++) {
        if (!sameValue(got[i]!, want[i]!)) {
          throw new Error(`step ${step}: cell ${i} incremental ${showValue(got[i]!)} vs full ${showValue(want[i]!)}`);
        }
      }
    }
    expect(engine.stats.internalErrors).toBe(0);
  });
});

describe('call counts', () => {
  const fields: FieldSpec[] = [
    { id: 'a', name: 'A' },
    { id: 'c', name: 'C' },
    { id: 'f1', name: 'F1', formula: '{A}*2' },
    { id: 'f2', name: 'F2', formula: '{F1}+1' },
    { id: 'f5', name: 'F5', formula: '{C}+1' },
  ];
  const rows: RowSpec[] = [
    { id: 'r0', createdMs: 0, modifiedMs: 0, inputs: { a: { t: 'num', v: 1 }, c: { t: 'num', v: 1 } } },
    { id: 'r1', createdMs: 0, modifiedMs: 0, inputs: { a: { t: 'num', v: 2 }, c: { t: 'num', v: 2 } } },
  ];

  it('full recalculation evaluates each formula once per row', () => {
    const e = new FormulaEngine({ fields, rows, now: () => NOW });
    expect(e.stats.evaluations).toBe(3 * 2);
  });

  it('an edit evaluates exactly the dependent formulas, once each, in one row', () => {
    const e = new FormulaEngine({ fields, rows, now: () => NOW });
    const before = e.stats.evaluations;
    e.setInput('r0', 'a', { t: 'num', v: 9 });
    expect(e.stats.evaluations - before).toBe(2); // F1 and F2 only
    expect(e.value('r0', 'f2')).toEqual({ t: 'num', v: 19 });
    expect(e.value('r1', 'f2')).toEqual({ t: 'num', v: 5 });
  });

  it('an edit to an unrelated input evaluates only its formula', () => {
    const e = new FormulaEngine({ fields, rows, now: () => NOW });
    const before = e.stats.evaluations;
    e.setInput('r1', 'c', { t: 'num', v: 7 });
    expect(e.stats.evaluations - before).toBe(1);
    expect(e.value('r1', 'f5')).toEqual({ t: 'num', v: 8 });
  });

  it('value reads do not evaluate anything', () => {
    const e = new FormulaEngine({ fields, rows, now: () => NOW });
    const before = e.stats.evaluations;
    for (let i = 0; i < 100; i++) e.value('r0', 'f2');
    expect(e.stats.evaluations).toBe(before);
  });

  it('formula fields cannot be set as inputs', () => {
    const e = new FormulaEngine({ fields, rows, now: () => NOW });
    expect(e.setInput('r0', 'f1', { t: 'num', v: 5 })).toBe(false);
    expect(e.value('r0', 'f1')).toEqual({ t: 'num', v: 2 });
  });
});

describe('cycles', () => {
  const fields: FieldSpec[] = [
    { id: 'a', name: 'A' },
    { id: 'x', name: 'X', formula: '{Y}+1' },
    { id: 'y', name: 'Y', formula: '{X}*2' },
    { id: 'z', name: 'Z', formula: '{X}+0' },
    { id: 'ok', name: 'OK', formula: '{A}+1' },
    { id: 'self', name: 'SELF', formula: '{SELF}' },
  ];
  const rows: RowSpec[] = [{ id: 'r0', createdMs: 0, modifiedMs: 0, inputs: { a: { t: 'num', v: 1 } } }];

  it('every formula on a loop returns #CYCLE!, including self-reference', () => {
    const e = new FormulaEngine({ fields, rows, now: () => NOW });
    expect(e.value('r0', 'x')).toEqual(err('#CYCLE!'));
    expect(e.value('r0', 'y')).toEqual(err('#CYCLE!'));
    expect(e.value('r0', 'self')).toEqual(err('#CYCLE!'));
    expect(e.cycleFieldIds().sort()).toEqual(['self', 'x', 'y']);
  });

  it('a formula that reads a cycle gets #CYCLE! and acyclic formulas still work', () => {
    const e = new FormulaEngine({ fields, rows, now: () => NOW });
    expect(e.value('r0', 'z')).toEqual(err('#CYCLE!'));
    expect(e.value('r0', 'ok')).toEqual({ t: 'num', v: 2 });
  });

  it('cycle fields are never evaluated', () => {
    const e = new FormulaEngine({ fields, rows, now: () => NOW });
    e.setInput('r0', 'a', { t: 'num', v: 4 });
    expect(e.value('r0', 'x')).toEqual(err('#CYCLE!'));
    expect(e.value('r0', 'ok')).toEqual({ t: 'num', v: 5 });
    expect(e.stats.internalErrors).toBe(0);
  });
});

describe('bad input is a value, not a crash', () => {
  it('unknown field name gives #NAME?', () => {
    const e = new FormulaEngine({
      fields: [{ id: 'f', name: 'F', formula: '{Nope}+1' }],
      rows: [{ id: 'r', createdMs: 0, modifiedMs: 0, inputs: {} }],
      now: () => NOW,
    });
    expect(e.value('r', 'f')).toEqual(err('#NAME?'));
  });

  it('a syntax error gives #PARSE!', () => {
    const e = new FormulaEngine({
      fields: [{ id: 'f', name: 'F', formula: '1+' }],
      rows: [{ id: 'r', createdMs: 0, modifiedMs: 0, inputs: {} }],
      now: () => NOW,
    });
    expect(e.value('r', 'f')).toEqual(err('#PARSE!'));
  });

  it('an ambiguous name (two fields share it) gives #NAME?', () => {
    const e = new FormulaEngine({
      fields: [
        { id: 'a1', name: 'Dup' },
        { id: 'a2', name: 'Dup' },
        { id: 'f', name: 'F', formula: '{Dup}' },
      ],
      rows: [{ id: 'r', createdMs: 0, modifiedMs: 0, inputs: {} }],
      now: () => NOW,
    });
    expect(e.value('r', 'f')).toEqual(err('#NAME?'));
  });
});

// FX-M (spec/guidelines.md L40): 1,000 rows, 12 columns, all types. Targets PERF-1/2 are
// proposed (guidelines.md L85-86) and are reported, not gated, until the owner confirms.
describe('FX-M performance (proposed targets, reported)', () => {
  const fx: FieldSpec[] = [];
  for (let i = 0; i < 7; i++) fx.push({ id: `in${i}`, name: `In${i}` });
  fx.push({ id: 'f0', name: 'Total', formula: 'SUM({In0},{In1},{In2})' });
  fx.push({ id: 'f1', name: 'Label', formula: 'CONCATENATE({In3},"-",{In4})' });
  fx.push({ id: 'f2', name: 'Flag', formula: 'IF({In5}>10,"big","small")' });
  fx.push({ id: 'f3', name: 'Day', formula: 'DATETIME_FORMAT(DATEADD({In6},1,"days"),"YYYY-MM-DD")' });
  fx.push({ id: 'f4', name: 'Avg', formula: 'ROUND(AVERAGE({In0},{In1}),2)' });

  it('one cell edit in a 1,000-row table recalculates its dependents under 200 ms', () => {
    const rand = mulberry32(7);
    const rows: RowSpec[] = [];
    for (let r = 0; r < 1000; r++) {
      const inputs: Record<string, Value> = {};
      for (let i = 0; i < 7; i++) {
        inputs[`in${i}`] = i === 6 ? { t: 'date', y: 2026, m: 1 + (r % 12), d: 1 + (r % 28) } : i === 3 || i === 4 ? { t: 'text', v: 'x' + r } : { t: 'num', v: Math.floor(rand() * 100) };
      }
      rows.push({ id: `r${r}`, createdMs: NOW, modifiedMs: NOW, inputs });
    }
    const t0 = performance.now();
    const engine = new FormulaEngine({ fields: fx, rows, now: () => NOW });
    const buildMs = performance.now() - t0;

    const fullStart = performance.now();
    engine.recalculateAll();
    const fullMs = performance.now() - fullStart;

    const samples: number[] = [];
    for (let k = 0; k < 20; k++) {
      const row = rows[(k * 37) % rows.length]!;
      const s = performance.now();
      engine.setInput(row.id, 'in0', { t: 'num', v: k });
      samples.push(performance.now() - s);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)] ?? samples[samples.length - 1]!;
    // Recorded for docs/evidence/P8-02.md.
    console.log(
      `FX-M build ${buildMs.toFixed(1)} ms; full recalc (1,000 rows x 5 formulas) ${fullMs.toFixed(1)} ms; single edit p95 ${p95.toFixed(3)} ms (target 200 ms, proposed)`,
    );
    expect(p95).toBeLessThan(200);
    expect(engine.stats.internalErrors).toBe(0);
  });
});
