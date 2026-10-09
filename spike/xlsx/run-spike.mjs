// P4-02 spike runner (NOT shipped). Builds each candidate for the browser platform,
// measures bundle size, scans for Node-only imports, checks read fidelity against the
// generator's known values, measures read timing, and round-trips a writer through the other reader.
import { build } from '../../node_modules/esbuild/lib/main.js';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { buildFxXlsx } from '../../scripts/gen-fixtures.mjs';
import { JSDOM } from '../../node_modules/jsdom/lib/api.js';

// Obsidian runs in a browser-like WebView, so browser builds expect DOMParser.
// Node has none; jsdom supplies one for this spike only (documented in evidence).
const dom = new JSDOM('');
globalThis.DOMParser = dom.window.DOMParser;

const here = new URL('.', import.meta.url).pathname;
const results = { environment: { node: process.version, platform: `${process.platform} ${process.arch}`, cpu: 'Intel Xeon @ 2.60GHz, 2 vCPU' } };

// ---- 1. Bundle size + Node-only import scan ------------------------------------------------
const NODE_ONLY = [/require\(["']fs["']\)/, /from ["']fs["']/, /from ["']node:/, /require\(["']node:/, /require\(["']path["']\)/, /require\(["']stream["']\)/, /require\(["']zlib["']\)/, /require\(["']crypto["']\)/, /require\(["']child_process["']\)/];

async function bundle(name) {
  const outfile = `${here}build/${name}.mjs`;
  await build({
    entryPoints: [`${here}src/${name}.mjs`],
    bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2020', outfile, logLevel: 'silent',
  });
  const code = readFileSync(outfile, 'utf8');
  const hits = NODE_ONLY.filter((re) => re.test(code)).map((re) => re.source);
  return { outfile, bytes: statSync(outfile).size, gzip: gzipSync(code).length, nodeImportHits: hits };
}

results.bundle = {};
for (const name of ['stub', 'candA', 'candB']) results.bundle[name] = await bundle(name);
for (const name of ['candA', 'candB']) {
  results.bundle[name].deltaMinBytes = results.bundle[name].bytes - results.bundle.stub.bytes;
  results.bundle[name].deltaGzipBytes = results.bundle[name].gzip - results.bundle.stub.gzip;
}

const A = await import(`${here}build/candA.mjs`);
const B = await import(`${here}build/candB.mjs`);

// ---- 2. Read fidelity vs generator's known values ----------------------------------------
const { bytes: fxBytes, expected } = buildFxXlsx();
const fxFile = readFileSync(`${here}../../samples/fixtures/fx-xlsx.xlsx`);
const expectedBuf = Uint8Array.from(fxBytes).buffer;
const fileBytes = Uint8Array.from(fxFile).buffer;

function normDate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v;
}

function compareData(sheetRows) {
  // sheetRows: array of arrays from the candidate reader for the Data sheet.
  const exp = expected.data;
  let mismatches = 0;
  const problems = [];
  const expRows = exp.length; // header + 5000
  const gotRows = sheetRows.filter((r) => r && r.length > 0).length;
  if (gotRows !== expRows) problems.push(`row count ${gotRows} != ${expRows}`);
  for (let r = 1; r < Math.min(expRows, sheetRows.length); r++) {
    for (let c = 0; c < exp[0].length; c++) {
      let got = sheetRows[r]?.[c] ?? null;
      got = normDate(got);
      const want = exp[r][c];
      const numericEq = typeof want === 'number' && typeof got === 'number' && Math.abs(want - got) < 1e-9;
      const eq = numericEq || got === want || (want === '' && got === null);
      if (!eq) {
        mismatches++;
        if (problems.length < 5) problems.push(`r${r} c${c}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
      }
    }
  }
  return { rowCountGot: gotRows, rowCountWant: expRows, cellMismatches: mismatches, examples: problems };
}

async function timeRuns(fn, runs = 10, warm = 3) {
  for (let i = 0; i < warm; i++) await fn();
  const t = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    t.push(performance.now() - t0);
  }
  const s = [...t].sort((a, b) => a - b);
  return { medianMs: +s[Math.floor(runs / 2)].toFixed(1), p95Ms: +s[runs - 1].toFixed(1), rawMs: t.map((x) => +x.toFixed(1)) };
}

// Candidate A reads a Blob (browser API); Node 20 provides Blob globally.
const blobA = new Blob([fileBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
const resA = await A.readSheets(blobA);
results.readA = { sheets: resA.sheetNames, data: compareData(resA.sheets.Data) };
const resB = B.readAll(fileBytes);
results.readB = { sheets: resB.sheetNames, data: compareData(resB.sheets.Data) };

results.readTiming = {
  A: await timeRuns(() => A.readSheets(blobA)),
  B: await timeRuns(() => Promise.resolve(B.readAll(fileBytes))),
};

// ---- 3. Write round-trip, read back with the OTHER library -------------------------------
const table = [['id', 'name', 'amount', 'active', 'date']];
for (let i = 1; i <= 500; i++) table.push([i, `row ${i}`, i * 1.25, i % 2 === 0, '2026-01-02']);
const wA = await A.writeRows(table);
const wAbuf = new Uint8Array(await wA.arrayBuffer());
const backB = B.readAll(wAbuf.buffer);
const wBbuf = new Uint8Array(B.writeRows(table));
const backA = await A.readSheets(new Blob([wBbuf]));
const sameA = JSON.stringify(backB.sheets.Data.slice(1, 3)) === JSON.stringify([[1, 'row 1', 1.25, false, '2026-01-02'], [2, 'row 2', 2.5, true, '2026-01-02']]);
results.writeRoundTrip = {
  A_write_B_read_rows: backB.sheets.Data.length,
  A_write_B_read_head_ok: sameA,
  B_write_A_read_rows: backA.sheets.Data.length,
  sizeA_bytes: wAbuf.length,
  sizeB_bytes: wBbuf.length,
};

writeFileSync(`${here}results.json`, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
