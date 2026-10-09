// T-P (P4-03 performance, proposed target): inference on FX-XLSX-sized data < 500 ms.
// Protocol §0.4: 3 warm-ups, 10 measured runs, median and p95 reported.
import { describe, it, expect } from 'vitest';
import { inferTable, type InputCell } from '../../src/io/infer.js';
import { mulberry32 } from './rng.js';

function buildFxLike(): InputCell[][] {
  const rand = mulberry32(20261009);
  const rows: InputCell[][] = [];
  for (let i = 1; i <= 5000; i++) {
    rows.push([
      i,
      `Item ${i}`,
      Math.round((rand() * 2000 - 500) * 100) / 100,
      new Date(Date.UTC(2020 + Math.floor(rand() * 7), Math.floor(rand() * 12), 1 + Math.floor(rand() * 28))),
      rand() < 0.5,
      ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'][Math.floor(rand() * 5)],
      'plain note',
      Math.round(rand() * 1000) / 1000,
      Math.round(rand() * 4000) / 100,
      `A-${String(i).padStart(4, '0')}`,
    ]);
  }
  return rows;
}

describe('inference performance (P4-03)', () => {
  it('infers 5,000 x 10 in under 500 ms (p95 over 10 runs)', () => {
    const rows = buildFxLike();
    for (let i = 0; i < 3; i++) inferTable(rows, 10);
    const times: number[] = [];
    let types: string[] = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      types = inferTable(rows, 10).map((c) => c.type);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    console.log(`P4-03 perf: median=${times[4].toFixed(1)}ms p95=${times[9].toFixed(1)}ms types=${types.join(',')}`);
    expect(types).toEqual(['number', 'text', 'number', 'date', 'checkbox', 'single_select', 'single_select', 'number', 'number', 'text']);
    expect(times[9]).toBeLessThan(500);
  });
});
