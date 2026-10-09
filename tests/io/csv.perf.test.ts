// T-P (guidelines §0.2, PERF-5): parse a 10,000-row CSV in under 1,000 ms (p95).
// Protocol §0.4: 3 warm-up runs (not counted), then 10 measured runs; report median and p95.
import { describe, it, expect } from 'vitest';
import { parseCsv } from '../../src/io/csv.js';
import { mulberry32, pick, randInt } from './rng.js';

function buildCsv(rows: number, cols: number): string {
  const rand = mulberry32(42);
  const words = ['alpha', 'beta', 'gamma', 'multi line', '12.5', '2026-01-02', 'true', ''];
  const quoted = ['"quoted, field"', '"two\nlines"'];
  const lines: string[] = [];
  lines.push(Array.from({ length: cols }, (_, c) => `col${c}`).join(','));
  for (let r = 0; r < rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < cols; c++) {
      if (rand() < 0.1) cells.push(pick(rand, quoted));
      else cells.push(pick(rand, words) + (rand() < 0.1 ? String(randInt(rand, 0, 999)) : ''));
    }
    lines.push(cells.join(','));
  }
  return lines.join('\n') + '\n';
}

describe('CSV performance — PERF-5 (P4-01 T-P)', () => {
  it('parses 10,000 rows in under 1,000 ms (p95 over 10 runs)', () => {
    const text = buildCsv(10_000, 12);
    for (let i = 0; i < 3; i++) parseCsv(text);
    const times: number[] = [];
    let rowCount = 0;
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      const res = parseCsv(text);
      times.push(performance.now() - t0);
      if (!res.ok) throw new Error(res.error);
      rowCount = res.rows.length;
    }
    times.sort((a, b) => a - b);
    const median = times[4];
    const p95 = times[9]; // with 10 samples, p95 is the max (nearest-rank)
    console.log(
      `P4-01 PERF-5: rows=${rowCount} cols=12 bytes=${text.length} median=${median.toFixed(1)}ms p95=${p95.toFixed(1)}ms raw=${times.map((t) => t.toFixed(1)).join(',')}`,
    );
    expect(rowCount).toBe(10_001);
    expect(p95).toBeLessThan(1000);
  });
});
