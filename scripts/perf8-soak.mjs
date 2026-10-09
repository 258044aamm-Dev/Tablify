#!/usr/bin/env node
// P6-02 — PERF-8 soak: 10 minutes of scroll + edit on FX-M, heap growth < 10 % target.
// jsdom/Node environment — labelled "sandbox approximation"; the official number comes
// from the owner's desktop run (scripts/bench-device.mjs runbook). Run with --expose-gc.
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
if (!global.performance || typeof global.performance.now !== 'function') {
  const { performance } = await import('perf_hooks');
  global.performance = performance;
}

const { generateFXM } = await import('../tests/query/fixtures.ts');
const { createDefaultView } = await import('../src/model/view.ts');
const { GridView } = await import('../src/views/grid/GridView.ts');

const DURATION_MS = 10 * 60 * 1000;
const { fields, rows } = generateFXM(42);
const view = createDefaultView(fields);
view.rowHeight = 'medium';
const grid = new GridView({ rows, fields, view, theme: 'light', viewportHeight: 600, viewportWidth: 800 });
document.body.appendChild(grid.root);

function gc() {
  if (global.gc) global.gc();
}

const samples = [];
const start = performance.now();
let lastSample = 0;
let i = 0;
let editCursor = 0;
// baseline sample (after warm-up + GC)
gc();
samples.push({ t: 0, heapMB: +(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) });
while (performance.now() - start < DURATION_MS) {
  // scripted scroll
  grid.setScrollTop((i * 607) % (rows.length * 36)); // prime step → covers the table
  // scripted edit: rotate a cell value and push a mutated copy of one row through setModel
  if (i % 50 === 0) {
    editCursor = (editCursor + 1) % rows.length;
    const mutated = rows.map((r, idx) =>
      idx === editCursor ? { ...r, rev: r.rev + 1, values: { ...r.values, [fields[1].id]: idx } } : r,
    );
    grid.setModel(mutated, fields, view);
  }
  i++;
  if (performance.now() - lastSample >= 60000) {
    lastSample = performance.now();
    gc();
    samples.push({ t: Math.round((performance.now() - start) / 1000), heapMB: +(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) });
  }
}
gc();
const finalHeap = process.memoryUsage().heapUsed;
const first = samples[0]?.heapMB ?? 0;
const last = +(finalHeap / 1024 / 1024).toFixed(2);
const growth = first > 0 ? +(((last - first) / first) * 100).toFixed(2) : null;
const result = {
  perf: 'PERF-8',
  environment: 'jsdom/Node (sandbox approximation — not an Obsidian vault)',
  durationMinutes: 10,
  cycles: i,
  heapSamples: samples,
  heapFirstMB: first,
  heapLastMB: last,
  growthPercent: growth,
  target: '< 10% growth after 10 minutes of scroll and edit on FX-M',
};
console.log(JSON.stringify(result, null, 2));
grid.destroy();
