#!/usr/bin/env node
// Benchmark for P3-01 PERF-4 (frame time) and PERF-8 (heap)
// Runs in Node with jsdom — not a real Obsidian vault, so results are informational.

import { JSDOM } from 'jsdom';
const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
// use Node's performance, not jsdom's (jsdom performance recurses if global.performance is overwritten)
if (!global.performance || typeof global.performance.now !== 'function') {
  const { performance } = await import('perf_hooks');
  global.performance = performance;
}

// dynamic import after jsdom globals are set
const { generateFXM } = await import('../tests/query/fixtures.ts');
const { createDefaultView } = await import('../src/model/view.ts');
const { GridView } = await import('../src/views/grid/GridView.ts');

function benchFrameTime() {
  const { fields, rows } = generateFXM(42);
  const view = createDefaultView(fields);
  view.rowHeight = 'medium';
  const grid = new GridView({ rows, fields, view, theme: 'light', viewportHeight: 600, viewportWidth: 800 });
  document.body.appendChild(grid.root);

  // warmup 3
  for (let i = 0; i < 3; i++) grid.setScrollTop(i * 600);

  const times = [];
  // Use 5 measured runs (10 was too heavy for jsdom in CI)
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    grid.setScrollTop((i * 600) % (rows.length * 36));
    void grid.content.children.length;
    const t1 = performance.now();
    times.push(t1 - t0);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  console.log(`PERF-4 frame time on FX-M (1k×12) jsdom median=${median.toFixed(3)}ms p95=${p95.toFixed(3)}ms raw=${times.map(t => t.toFixed(3)).join(',')} (jsdom ~10× slower than browser; real target ≤33ms proposed)`);
  console.log(`DOM row count after scroll: ${grid.getRenderedRowCount()} pool=${grid.getPoolSize()} (expected ~visible+overscan 22-27)`);
  grid.destroy();
  return { median, p95, times };
}

function benchHeap() {
  const before = process.memoryUsage().heapUsed;
  // Light synthetic: create/destroy a few grids instead of 1k scrolls (jsdom heap is not representative; real 10min test is T-M-DEV NOT RUN)
  for (let i = 0; i < 5; i++) {
    const { fields, rows } = generateFXM(100 + i);
    const view = createDefaultView(fields);
    const grid = new GridView({ rows: rows.slice(0, 100), fields: fields.slice(0, 6), view, theme: 'light', viewportHeight: 300 });
    document.body.appendChild(grid.root);
    grid.setScrollTop(0);
    grid.destroy();
  }
  const after = process.memoryUsage().heapUsed;
  const growth = ((after - before) / before) * 100;
  console.log(`PERF-8 heap before=${(before / 1024 / 1024).toFixed(2)}MB after=${(after / 1024 / 1024).toFixed(2)}MB growth=${growth.toFixed(2)}% (5 small grids, jsdom placeholder; real 10min NOT RUN)`);
  if (global.gc) global.gc();
}

function benchColumnLimit() {
  // Column limit: no virtualization — all cells per row rendered. Check 12 (MVP) vs 30 (degraded).
  for (const colCount of [12, 30]) {
    const { fields: baseFields, rows } = generateFXM(1);
    const fields = baseFields.slice(0, Math.min(colCount, baseFields.length));
    while (fields.length < colCount) {
      const f = { ...baseFields[fields.length % baseFields.length], id: `fld_extra_${fields.length}`, name: `Extra${fields.length}` };
      fields.push(f);
    }
    const view = createDefaultView(fields);
    view.rowHeight = 'medium';
    const grid = new GridView({ rows: rows.slice(0, 20), fields, view, theme: 'light', viewportHeight: 300 });
    document.body.appendChild(grid.root);
    const t0 = performance.now();
    grid.setScrollTop(0);
    void grid.content.children.length;
    const t1 = performance.now();
    console.log(`Columns ${colCount}: ${(t1 - t0).toFixed(3)}ms cells/row=${fields.length} totalCells=${grid.getRenderedRowCount() * fields.length}`);
    grid.destroy();
  }
  console.log('Note: column virtualization NOT implemented. 12 cols is MVP target; 30 cols is functional but heavier — see evidence for measured table.');
}

benchFrameTime();
benchHeap();
benchColumnLimit();
