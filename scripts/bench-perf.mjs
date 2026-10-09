#!/usr/bin/env node
// P6-02 — Performance verification, sandbox side (guidelines §0.4 protocol).
// Measures PERF-1, PERF-2, PERF-3, PERF-5, PERF-6, PERF-7 in Node (+jsdom for the
// grid-paint part of PERF-1). Every number here is a SANDBOX APPROXIMATION — the
// official claims come from the owner's runs on recorded hardware (G-A4); see
// scripts/bench-device.mjs. Protocol: fresh state per run, 3 warm-ups (not counted),
// 10 measured runs, median + p95 reported, all raw numbers written to
// docs/performance/raw/. Run via: npx tsx scripts/bench-perf.mjs <run-label>
import { JSDOM } from 'jsdom';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = join(ROOT, 'docs', 'performance', 'raw');
mkdirSync(RAW_DIR, { recursive: true });

const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
// Expose the jsdom window surface on globalThis (same approach as vitest's
// jsdom environment) so browser-only dependencies load.
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (!(key in globalThis)) {
    try {
      globalThis[key] = dom.window[key];
    } catch {
      /* some window props are getter-only; skip */
    }
  }
}
global.document = dom.window.document;
global.window = dom.window;
if (!global.performance || typeof global.performance.now !== 'function') {
  const { performance } = await import('perf_hooks');
  global.performance = performance;
}
if (!globalThis.DOMParser) {
  globalThis.DOMParser = dom.window.DOMParser;
}

const { generateFXM } = await import('../tests/query/fixtures.ts');
const { parse } = await import('../src/format/parse.ts');
const { serialize } = await import('../src/format/serialize.ts');
const { validateTable } = await import('../src/model/validation.ts');
const { createDefaultView } = await import('../src/model/view.ts');
const { parseCsv } = await import('../src/io/csv.ts');
const { importTable } = await import('../src/io/import/importer.ts');
const { exportTable } = await import('../src/io/export/exporter.ts');
const { parseQuery } = await import('../src/query/parse.ts');
const { evaluateQuery } = await import('../src/query/evaluate.ts');
const { GridView } = await import('../src/views/grid/GridView.ts');

const runLabel = process.argv[2] || 'run1';
const now = new Date().toISOString();

function stats(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return { median: +median.toFixed(3), p95: +p95.toFixed(3) };
}

/** Protocol: 3 warm-ups, then N measured runs; each run gets a fresh state via reset(). */
async function measure(name, fn, reset, runs = 10) {
  for (let i = 0; i < 3; i++) {
    reset();
    await fn();
  }
  const times = [];
  for (let i = 0; i < runs; i++) {
    reset();
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  const s = stats(times);
  console.log(`${name}: median=${s.median}ms p95=${s.p95}ms raw=${times.map((t) => t.toFixed(1)).join(',')}`);
  return { name, ...s, raw: times.map((t) => +t.toFixed(3)) };
}

// ---------------------------------------------------------------------------
// Fixtures (deterministic)
// ---------------------------------------------------------------------------
const fxm = generateFXM(42); // FX-M: 1,000 rows × 12 columns (D7 target scale)
const defaultView = createDefaultView(fxm.fields);
const fxmFile = {
  formatVersion: 1,
  tableId: 'tbl_bench',
  name: 'Bench FX-M',
  fields: fxm.fields,
  rows: fxm.rows,
  views: [{ id: 'view_default', name: 'Default', warnings: [], ...defaultView }],
  syncLink: null,
};
const fxmText = serialize(fxmFile);

// 1,000-row CSV (PERF-6: import FX-M) and 10,000-row CSV (PERF-5: parse stress).
function makeCsv(n) {
  let s = 'id,name,amount,due,active,category\n';
  for (let i = 1; i <= n; i++) {
    s += `${i},Item ${i},${(i * 1.5).toFixed(2)},2026-01-${String((i % 28) + 1).padStart(2, '0')},${i % 2 === 0},Cat${i % 17}\n`;
  }
  return s;
}
const csv1k = makeCsv(1000);
const csv10k = makeCsv(10000);

function memoryAdapter() {
  const written = new Map();
  return {
    adapter: {
      exists: (p) => written.has(p),
      create: async (p, d) => void written.set(p, d),
      createBinary: async (p, d) => void written.set(p, d),
    },
    written,
  };
}

const tmp = mkdtempSync(join(tmpdir(), 'tablify-perf-'));
const fxmPath = join(tmp, 'fxm.tablify');
writeFileSync(fxmPath, fxmText);
const csv1kPath = join(tmp, 'csv1k.csv');
writeFileSync(csv1kPath, csv1k);
const csv10kPath = join(tmp, 'csv10k.csv');
writeFileSync(csv10kPath, csv10k);

const results = {
  run: runLabel,
  recordedAt: now,
  environment: `Node ${process.version} + jsdom, sandbox container (NOT recorded user hardware; G-A4)`,
  fixtures: { 'FX-M': '1,000 rows × 12 fields (generateFXM seed 42)', 'CSV-1k': '1,000 rows × 6 columns', 'CSV-10k': '10,000 rows × 6 columns (deterministic, in-script)' },
  benchmarks: [],
};

// ---------------------------------------------------------------------------
// PERF-1 — Open a FX-M table: disk read → JSON parse → view normalization →
// table validation → first grid paint (jsdom). Official target: p95 < 1,000 ms
// desktop / < 2,000 ms mobile. Sandbox number is an approximation.
// ---------------------------------------------------------------------------
results.benchmarks.push(
  await measure(
    'PERF-1 open FX-M (read+parse+validate+store+first paint, jsdom)',
    () => {
      const text = readFileSync(fxmPath, 'utf8');
      const parsed = parse(text);
      if (!parsed.ok) throw new Error('parse failed: ' + parsed.error);
      const violations = validateTable(parsed.data.fields, parsed.data.rows);
      const view = createDefaultView(parsed.data.fields);
      view.rowHeight = 'medium';
      const grid = new GridView({ rows: parsed.data.rows, fields: parsed.data.fields, view, theme: 'light', viewportHeight: 600, viewportWidth: 800 });
      document.body.appendChild(grid.root);
      grid.setScrollTop(0);
      void grid.content.children.length; // force first paint
      grid.destroy();
      if (violations.length > 0) throw new Error('unexpected validation violations in fixture');
    },
    () => {
      document.body.innerHTML = '';
    },
  ),
);

// ---------------------------------------------------------------------------
// PERF-2 — Filter/search update on FX-M (parse + compile + evaluate each run,
// like a keystroke re-filtering the table). Official target: p95 < 200 ms.
// ---------------------------------------------------------------------------
let filterMatches = -1;
results.benchmarks.push(
  await measure(
    'PERF-2 filter update on FX-M (parseQuery+evaluateQuery)',
    () => {
      const parsedAst = parseQuery('status:Done count:>10');
      if (!parsedAst.ok) throw new Error('query parse failed: ' + parsedAst.error.message);
      const out = evaluateQuery(parsedAst.ast, fxm.rows, fxm.fields);
      if (!out.ok) throw new Error('evaluate failed');
      filterMatches = out.rows.length;
      if (out.rows.length === 0) throw new Error('filter matched 0 rows — fixture/query mismatch');
    },
    () => {},
  ),
);

// ---------------------------------------------------------------------------
// PERF-3 — Save FX-M: serialize + atomic-style write (tmp + rename). Official
// target: p95 < 300 ms.
// ---------------------------------------------------------------------------
const savePath = join(tmp, 'save.tablify');
const tmpSave = join(tmp, 'save.tablify.tmp');
results.benchmarks.push(
  await measure(
    'PERF-3 save FX-M (serialize + atomic-style write)',
    () => {
      const text = serialize(fxmFile);
      writeFileSync(tmpSave, text);
      renameSync(tmpSave, savePath);
    },
    () => {
      rmSync(savePath, { force: true });
    },
  ),
);

// ---------------------------------------------------------------------------
// PERF-5 — Parse 10,000-row CSV. Official target: < 1,000 ms desktop.
// ---------------------------------------------------------------------------
results.benchmarks.push(
  await measure(
    'PERF-5 parse 10,000-row CSV',
    () => {
      const out = parseCsv(csv10k);
      if (!out.ok) throw new Error('parse failed: ' + out.error);
      if (out.rows.length !== 10001) throw new Error(`unexpected row count ${out.rows.length}`);
    },
    () => {},
  ),
);

// ---------------------------------------------------------------------------
// PERF-6 — Import FX-M (1,000 rows) from CSV through the full import path
// (parse → infer → build → write). Official target: < 2,000 ms desktop.
// ---------------------------------------------------------------------------
results.benchmarks.push(
  await measure(
    'PERF-6 import FX-M CSV (parse+infer+build+write, memory adapter)',
    async () => {
      const { adapter } = memoryAdapter();
      const out = await importTable({ kind: 'csv', fileName: 'fxm.csv', data: csv1k, folder: '', adapter });
      if (!out.ok) throw new Error('import failed: ' + out.error);
    },
    () => {},
  ),
);

// ---------------------------------------------------------------------------
// PERF-7 — Export FX-M to CSV / XLSX / Markdown. Official target: < 2,000 ms
// desktop (each format).
// ---------------------------------------------------------------------------
for (const format of ['csv', 'xlsx', 'md']) {
  results.benchmarks.push(
    await measure(
      `PERF-7 export FX-M → ${format.toUpperCase()} (full table, memory adapter)`,
      () => exportTable({ file: fxmFile, format, scope: { fullTable: true }, folder: '', baseName: 'bench', adapter: memoryAdapter().adapter }),
      () => {},
    ),
  );
}

// ---------------------------------------------------------------------------
rmSync(tmp, { recursive: true, force: true });
results.filterMatches = filterMatches;
const rawFile = join(RAW_DIR, `perf-sandbox-${runLabel}.json`);
writeFileSync(rawFile, JSON.stringify(results, null, 2) + '\n');
console.log(`\nRaw run written to ${rawFile}`);
console.log('NOTE: all numbers are sandbox approximations (Node/jsdom). Official claims require the owner hardware runbook: npx tsx scripts/bench-device.mjs');
