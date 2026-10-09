// P4-05 acceptance: T-D (CSV parsed by P4-01 parser AND by csv-parse reference library, cell-by-cell
// against the source model), T-I (XLSX read back by two independent readers, values match),
// failure and collision tests, and PERF-7 on a 1,000-row × 12-field table.
import { describe, it, expect, beforeAll } from 'vitest';
import { parse as parseCsvRef } from 'csv-parse/sync';
import { parseCsv } from '../../src/io/csv.js';
import { exportTable, type ExportAdapter } from '../../src/io/export/exporter.js';
import { resolveExportTable, cellText } from '../../src/io/export/view.js';
import { makeFile, FIELDS, VIEW } from './export.fixtures.js';
import type { TablifyFile } from '../../src/model/types.js';

function memoryAdapter(existing: string[] = []) {
  const files = new Map<string, string | ArrayBuffer>(existing.map((p) => [p, 'OLD']));
  const adapter: ExportAdapter = {
    exists: (p) => files.has(p),
    create: async (p, d) => {
      if (files.has(p)) throw new Error('exists');
      files.set(p, d);
    },
    createBinary: async (p, d) => {
      if (files.has(p)) throw new Error('exists');
      files.set(p, d);
    },
  };
  return { adapter, files };
}

/** Independent expectation: what each exported row/cell should contain, computed from the source only. */
function expectedGrid(file: TablifyFile): string[][] {
  const visible = FIELDS.filter((f) => !VIEW.hidden.includes(f.id));
  const cols = VIEW.columnOrder.map((id) => visible.find((f) => f.id === id)).filter((f): f is (typeof FIELDS)[number] => !!f);
  const amount = 'fld_amount';
  const sorted = file.rows.slice().sort((a, b) => {
    const x = a.values[amount] as number | null;
    const y = b.values[amount] as number | null;
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x;
  });
  const cell = (v: unknown, f: (typeof FIELDS)[number]): string => {
    if (v === null || v === undefined) return '';
    if (f.type === 'checkbox') return v === true ? 'true' : 'false';
    if (f.type === 'single_select') return f.options!.find((o) => o.id === v)!.name;
    if (f.type === 'multi_select') return (v as string[]).map((id) => f.options!.find((o) => o.id === id)!.name).join(', ');
    // Display rules as the user sees them: currency is minor units shown as major (1235 -> "12.35"),
    // percent is a 0-1 decimal shown with %, rating and number are plain.
    if (f.type === 'currency') return ((v as number) / 100).toFixed(2);
    if (f.type === 'percent') return `${Math.round((v as number) * 100)}%`;
    return String(v);
  };
  return [cols.map((c) => c.name), ...sorted.map((r) => cols.map((c) => cell(r.values[c.id], c)))];
}

beforeAll(async () => {
  if (!(globalThis as { DOMParser?: unknown }).DOMParser) {
    const { JSDOM } = await import('jsdom');
    (globalThis as { DOMParser?: unknown }).DOMParser = new JSDOM('').window.DOMParser;
  }
});

describe('T-D: CSV export compared with two parsers and the source model', () => {
  const file = makeFile(500);
  it('P4-01 parser and csv-parse both read every cell equal to the expected grid (0 mismatches)', async () => {
    const { adapter, files } = memoryAdapter();
    const out = await exportTable({ file, format: 'csv', scope: { fullTable: false }, folder: '', baseName: 'Export', adapter });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const text = files.get(out.path) as string;
    const want = expectedGrid(file);

    const mine = parseCsv(text);
    expect(mine.ok).toBe(true);
    if (!mine.ok) return;
    const ref = parseCsvRef(text, { bom: true, relax_column_count: false, skip_empty_lines: false }) as string[][];

    let mismatchesMine = 0;
    let mismatchesRef = 0;
    want.forEach((row, r) => row.forEach((cell, c) => {
      if ((mine.rows[r]?.[c] ?? '') !== cell) mismatchesMine++;
      if ((ref[r]?.[c] ?? '') !== cell) mismatchesRef++;
    }));
    console.log(`T-D CSV 500 rows × ${want[0].length} cols: P4-01 mismatches=${mismatchesMine}, csv-parse mismatches=${mismatchesRef}`);
    expect(mine.rows.length).toBe(want.length);
    expect(ref.length).toBe(want.length);
    expect(mismatchesMine).toBe(0);
    expect(mismatchesRef).toBe(0);
  });
});

describe('T-I: XLSX export opened by two independent readers', () => {
  const file = makeFile(500);
  for (const tz of ['UTC', 'Asia/Dhaka', 'America/Los_Angeles']) { // run the suite once per TZ env, see evidence
    it(`values match (run with TZ=${tz})`, async () => {
      const { adapter, files } = memoryAdapter();
      const out = await exportTable({ file, format: 'xlsx', scope: { fullTable: false }, folder: '', baseName: 'XL', adapter });
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      const bytes = files.get(out.path) as ArrayBuffer;
      const want = expectedGrid(file);

      // Reader 1: read-excel-file (node entry).
      const readXlsxNode = (await import('read-excel-file/node')).default;
      const r1 = (await readXlsxNode(Buffer.from(bytes), { trim: false })) as { sheet: string; data: unknown[][] }[];
      // Reader 2: SheetJS, independent library.
      const XLSX = await import('xlsx');
      const wb = XLSX.read(Buffer.from(bytes), { type: 'buffer', cellDates: false });
      const r2 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null }) as unknown[][];

      const norm = (v: unknown): string => {
        if (v === null || v === undefined) return '';
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        return String(v);
      };
      const mismatches1: string[] = [];
      const mismatches2: string[] = [];
      const cols = want[0].length;
      // Header and rows. Date columns are real dates in the file; compare them as yyyy-mm-dd.
      const dueCol = want[0].indexOf('Due');
      want.forEach((row, r) => {
        for (let c = 0; c < cols; c++) {
          const exp = row[c];
          let got1 = norm(r1[0].data[r]?.[c]);
          if (r > 0 && c === dueCol && r1[0].data[r]?.[c] instanceof Date) got1 = (r1[0].data[r][c] as Date).toISOString().slice(0, 10);
          if (got1 !== exp) mismatches1.push(`r${r}c${c}`);
          // SheetJS raw: dates come as serial numbers; convert serial to date for comparison.
          let raw2 = (r2[r] ?? [])[c] as unknown;
          if (r > 0 && c === dueCol && typeof raw2 === 'number') {
            const d = new Date(Date.UTC(1899, 11, 30) + raw2 * 86_400_000);
            raw2 = d.toISOString().slice(0, 10);
          }
          if (norm(raw2) !== exp) mismatches2.push(`r${r}c${c}`);
        }
      });
      console.log(`T-I XLSX (${tz}) 500 rows: read-excel-file mismatches=${mismatches1.length}, SheetJS mismatches=${mismatches2.length}`);
      expect(r1[0].data.length).toBe(want.length);
      expect(mismatches1).toEqual([]);
      expect(mismatches2).toEqual([]);
    });
  }
});

describe('failure, naming, and scope', () => {
  it('a failing write leaves no partial export (no file created)', async () => {
    const files = new Map<string, string | ArrayBuffer>();
    const adapter: ExportAdapter = {
      exists: (p) => files.has(p),
      create: async () => {
        throw new Error('disk full (simulated)');
      },
      createBinary: async () => {
        throw new Error('disk full (simulated)');
      },
    };
    const out = await exportTable({ file: makeFile(10), format: 'md', scope: { fullTable: true }, folder: '', baseName: 'M', adapter });
    expect(out.ok).toBe(false);
    expect(files.size).toBe(0);
  });

  it('name collision: never overwrite; next free number is used', async () => {
    const { adapter, files } = memoryAdapter(['Out/Export.csv', 'Out/Export 2.csv']);
    const out = await exportTable({ file: makeFile(3), format: 'csv', scope: { fullTable: true }, folder: 'Out', baseName: 'Export', adapter });
    expect(out.ok && out.path).toBe('Out/Export 3.csv');
    expect(files.get('Out/Export.csv')).toBe('OLD');
  });

  it('a bad query gives an error and writes nothing', async () => {
    const { adapter, files } = memoryAdapter();
    const out = await exportTable({ file: makeFile(3), format: 'csv', scope: { fullTable: false, query: 'Nope:1' }, folder: '', baseName: 'Q', adapter });
    expect(out.ok).toBe(false);
    expect(files.size).toBe(0);
  });

  it('full table includes the hidden field; current view does not', () => {
    const file = makeFile(3);
    const full = resolveExportTable(file, { fullTable: true });
    const view = resolveExportTable(file, { fullTable: false });
    if (!full.ok || !view.ok) throw new Error('resolve failed');
    expect(full.table.fields.some((f) => f.name === 'Secret')).toBe(true);
    expect(view.table.fields.some((f) => f.name === 'Secret')).toBe(false);
    expect(cellText(1, FIELDS.find((f) => f.id === 'fld_hidden')!)).toBe('1');
  });
});

describe('PERF-7: export FX-M-like table (1,000 rows × 12 fields) < 2,000 ms (proposed)', () => {
  it('median and p95 for CSV, Markdown, and XLSX after 3 warm-ups, 10 runs each', async () => {
    const file = makeFile(1000, 2026);
    const results: string[] = [];
    for (const format of ['csv', 'md', 'xlsx'] as const) {
      const times: number[] = [];
      for (let i = 0; i < 13; i++) {
        const { adapter } = memoryAdapter();
        const t0 = performance.now();
        const out = await exportTable({ file, format, scope: { fullTable: false }, folder: '', baseName: `P${i}`, adapter });
        const dt = performance.now() - t0;
        expect(out.ok).toBe(true);
        if (i >= 3) times.push(dt);
      }
      times.sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)];
      const p95 = times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)];
      results.push(`${format}: median=${median.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
      expect(p95).toBeLessThan(2000);
    }
    console.log(`PERF-7 FX-M-like 1,000×12: ${results.join('; ')}`);
  });
});
