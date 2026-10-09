// T-I (P4-04 acceptance): import a 500-row CSV and a 500-row XLSX, then compare row count and
// every cell value against the source model. Zero mismatches required. Also PERF-6 (FX-M, 1,000 rows).
import { describe, it, expect, beforeAll } from 'vitest';
import { importTable, type ImportAdapter } from '../../src/io/import/importer.js';
import { parse } from '../../src/format/parse.js';
import { makeModel, makeXlsx, type Expected } from './import.fixtures.js';
import type { TablifyFile } from '../../src/model/types.js';

function memoryAdapter(): { adapter: ImportAdapter; written: Map<string, string> } {
  const written = new Map<string, string>();
  return {
    written,
    adapter: {
      exists: (p) => written.has(p),
      create: async (p, d) => {
        if (written.has(p)) throw new Error('exists');
        written.set(p, d);
      },
    },
  };
}

/** Compare every cell of an imported file with the expected model. Returns the mismatch list. */
function compare(file: TablifyFile, expected: Expected[]): string[] {
  const problems: string[] = [];
  if (file.rows.length !== expected.length) problems.push(`row count ${file.rows.length} != ${expected.length}`);
  const byName = new Map(file.fields.map((f) => [f.name, f]));
  const keys: (keyof Expected)[] = ['Task', 'Estimate', 'Due', 'Done', 'Status', 'Notes'];
  for (const k of keys) if (!byName.has(k)) problems.push(`missing field ${k}`);
  expected.forEach((exp, i) => {
    const row = file.rows[i];
    if (!row) return;
    for (const k of keys) {
      const field = byName.get(k);
      if (!field) continue;
      let actual = row.values[field.id];
      if (field.type === 'single_select') {
        actual = field.options?.find((o) => o.id === actual)?.name ?? null;
      }
      const want = exp[k];
      if (actual !== want) problems.push(`row ${i + 1} ${k}: got ${JSON.stringify(actual)} want ${JSON.stringify(want)}`);
    }
  });
  return problems;
}

beforeAll(async () => {
  if (!(globalThis as { DOMParser?: unknown }).DOMParser) {
    const { JSDOM } = await import('jsdom');
    (globalThis as { DOMParser?: unknown }).DOMParser = new JSDOM('').window.DOMParser;
  }
});

describe('T-I: 500-row import, cell-by-cell comparison', () => {
  const model = makeModel(500);

  it('CSV: row count and every cell match the source (0 mismatches)', async () => {
    const { adapter, written } = memoryAdapter();
    const out = await importTable({ kind: 'csv', fileName: 'Tasks500.csv', data: model.csv, folder: '', adapter });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const parsed = parse(written.get(out.path)!);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const problems = compare(parsed.data, model.expected);
    console.log(`T-I CSV 500 rows: mismatches=${problems.length}`);
    expect(problems).toEqual([]);
  });

  it('XLSX: row count and every cell match the source (0 mismatches)', async () => {
    const bytes = await makeXlsx(model.xlsxRows);
    const { adapter, written } = memoryAdapter();
    const out = await importTable({ kind: 'xlsx', fileName: 'Tasks500.xlsx', data: bytes, folder: '', adapter });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const parsed = parse(written.get(out.path)!);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const problems = compare(parsed.data, model.expected);
    console.log(`T-I XLSX 500 rows: mismatches=${problems.length}`);
    expect(problems).toEqual([]);
  });
});

describe('PERF-6: import FX-M (1,000 rows) < 2,000 ms desktop (proposed)', () => {
  it('CSV import median and p95 over 10 runs after 3 warm-ups', async () => {
    const model = makeModel(1000, 777);
    const times: number[] = [];
    for (let i = 0; i < 13; i++) {
      const { adapter } = memoryAdapter();
      const t0 = performance.now();
      const out = await importTable({ kind: 'csv', fileName: `FXM${i}.csv`, data: model.csv, folder: '', adapter });
      const dt = performance.now() - t0;
      expect(out.ok).toBe(true);
      if (i >= 3) times.push(dt);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    const p95 = times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)];
    console.log(`PERF-6 CSV FX-M 1,000 rows: median=${median.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
    expect(p95).toBeLessThan(2000);
  });
});
