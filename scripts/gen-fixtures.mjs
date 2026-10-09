#!/usr/bin/env node
// Deterministic fixture generator (guidelines §0.3). Same seed → same bytes.
// Usage: node scripts/gen-fixtures.mjs            (writes samples/fixtures/*)
//        node scripts/gen-fixtures.mjs --check    (fails if hashes differ from the recorded ones)
// The XLSX writer used here (SheetJS, test-only) is independent of the candidate readers under test.
import * as XLSX from 'xlsx';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'samples', 'fixtures');

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
const NOTE_PARTS = ['plain note', 'has, comma', 'says "hi"', 'two words', 'trailing space ', '  leading'];

/** Excel serial date for a UTC calendar date. */
function excelSerial(y, m, d) {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

/**
 * FX-XLSX: 5,000 data rows × 10 columns, three sheets.
 * Data columns: id, name, amount, date, active, category, note, ratio, doubled (formula), code.
 * Returns the row-major expected values for the Data sheet (header row first) and sheet metadata.
 */
export function buildFxXlsx() {
  const rand = mulberry32(20261009);
  const header = ['id', 'name', 'amount', 'date', 'active', 'category', 'note', 'ratio', 'doubled', 'code'];
  const data = [header];
  const expected = [header];
  for (let i = 1; i <= 5000; i++) {
    const amount = Math.round((rand() * 2000 - 500) * 100) / 100;
    const y = 2020 + Math.floor(rand() * 7);
    const m = 1 + Math.floor(rand() * 12);
    const d = 1 + Math.floor(rand() * 28);
    const active = rand() < 0.5;
    const category = CATEGORIES[Math.floor(rand() * CATEGORIES.length)];
    const note = NOTE_PARTS[Math.floor(rand() * NOTE_PARTS.length)];
    const ratio = Math.round(rand() * 1000) / 1000;
    const doubled = Math.round(amount * 2 * 100) / 100;
    const code = `A-${String(i).padStart(4, '0')}`;
    const name = `Item ${i}`;
    const serial = excelSerial(y, m, d);
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const r = i + 1; // 1-based Excel row number
    data.push([i, name, amount, { v: serial, t: 'n', z: 'yyyy-mm-dd' }, active, category, note, ratio,
      { v: doubled, t: 'n', f: `C${r}*2` }, code]);
    expected.push([i, name, amount, iso, active, category, note, ratio, doubled, code]);
  }
  // Build the Data sheet cell-by-cell so date and formula cells keep their metadata.
  const dataWs = {};
  data.forEach((row, rIdx) => {
    row.forEach((cell, cIdx) => {
      const addr = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
      if (cell !== null && typeof cell === 'object') dataWs[addr] = { t: cell.t ?? 'n', v: cell.v, f: cell.f, z: cell.z };
      else if (typeof cell === 'string') dataWs[addr] = { t: 's', v: cell };
      else if (typeof cell === 'boolean') dataWs[addr] = { t: 'b', v: cell };
      else dataWs[addr] = { t: 'n', v: cell };
    });
  });
  dataWs['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length - 1, c: header.length - 1 } });

  const summary = XLSX.utils.aoa_to_sheet([
    ['Summary', '', '', ''],
    ['Region', 'Q1', 'Q2', 'Total'],
    ['North', 10, 20, { t: 'n', v: 30, f: 'B3+C3' }],
  ]);
  summary['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];

  const notes = XLSX.utils.aoa_to_sheet([['note'], ['second sheet, read-only check']]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataWs, 'Data');
  XLSX.utils.book_append_sheet(wb, summary, 'Summary');
  XLSX.utils.book_append_sheet(wb, notes, 'Notes');
  const bytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: false });
  return {
    bytes: Buffer.from(bytes),
    expected: { sheets: ['Data', 'Summary', 'Notes'], data: expected, summaryMerge: 'A1:D1', summaryTotal: 30 },
  };
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// ---------------------------------------------------------------------------
// P6-01 fixtures (Phase 6 test matrix): deterministic scripted-case inputs for
// scenarios A2, A3, A9, A10, A11. Seed 60101. The 500 rows are shared by the
// CSV (A2) and XLSX (A3) so both imports can be cross-checked cell-by-cell.
// ---------------------------------------------------------------------------
export function buildP6Fixtures() {
  const rand = mulberry32(60101);
  const pad2 = (n) => String(n).padStart(2, '0');
  const header = ['id', 'name', 'amount', 'date', 'active', 'category', 'note'];
  const rows = [];
  for (let i = 1; i <= 500; i++) {
    rows.push({
      i,
      name: `Item ${i}`,
      amount: Math.round((rand() * 900 - 100) * 100) / 100,
      date: `${2020 + Math.floor(rand() * 7)}-${pad2(1 + Math.floor(rand() * 12))}-${pad2(1 + Math.floor(rand() * 28))}`,
      active: rand() < 0.5,
      category: CATEGORIES[Math.floor(rand() * CATEGORIES.length)],
      note: NOTE_PARTS[Math.floor(rand() * NOTE_PARTS.length)],
    });
  }

  // A2 — 500-row CSV (RFC 4180: quote fields containing comma/quote/newline; CRLF).
  const q = (v) => {
    const s = String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csvLines = [header].concat(
    rows.map((r) => [r.i, r.name, r.amount, r.date, r.active, r.category, r.note].map(q).join(',')),
  );
  const csv = Buffer.from(csvLines.join('\r\n') + '\r\n', 'utf8');

  // A3 — 500-row XLSX with the same rows; dates as Excel serials with a date format.
  const aoa = [header].concat(
    rows.map((r) => {
      const [y, m, d] = r.date.split('-').map(Number);
      return [r.i, r.name, r.amount, { v: excelSerial(y, m, d), t: 'n', z: 'yyyy-mm-dd' }, r.active, r.category, r.note];
    }),
  );
  const ws = XLSX.utils.aoa_to_sheet([header]); // header only; data cells added below to keep date metadata
  for (let rIdx = 1; rIdx < aoa.length; rIdx++) {
    aoa[rIdx].forEach((cell, cIdx) => {
      const addr = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
      if (cell !== null && typeof cell === 'object') ws[addr] = { t: cell.t, v: cell.v, z: cell.z };
      else if (typeof cell === 'boolean') ws[addr] = { t: 'b', v: cell };
      else if (typeof cell === 'number') ws[addr] = { t: 'n', v: cell };
      else ws[addr] = { t: 's', v: String(cell) };
    });
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: header.length - 1 } });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  const xlsx = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: false }));

  // A9 — decoy .tabula file: Tablify must never open, import, or migrate it.
  const tabula = Buffer.from(
    'Decoy .tabula file (P6-01 A9). Tablify must not open, import, detect, or migrate this file.\n',
    'utf8',
  );

  // A10 — broken .tablify: truncated JSON. Expected: error shown, file unchanged on disk.
  const broken = Buffer.from(
    '{\n  "formatVersion": 1,\n  "tableId": "tbl_01J8Z5BROKE",\n  "name": "Broken",\n  "fields": [',
    'utf8',
  );

  // A11 — valid v1 table carrying view settings: column width, freeze, sort.
  const viewA11 = Buffer.from(
    JSON.stringify(
      {
        formatVersion: 1,
        tableId: 'tbl_01J8Z5VIEW',
        name: 'View Settings A11',
        fields: [
          { id: 'fld_name', name: 'Name', type: 'text', primary: true },
          { id: 'fld_qty', name: 'Qty', type: 'number' },
        ],
        rows: [
          {
            id: 'row_01J8Z5V001',
            rev: 1,
            updatedAt: '2026-10-09T08:00:00Z',
            values: { fld_name: 'Alpha', fld_qty: 3 },
            sync: null,
          },
          {
            id: 'row_01J8Z5V002',
            rev: 1,
            updatedAt: '2026-10-09T08:01:00Z',
            values: { fld_name: 'Beta', fld_qty: 1 },
            sync: null,
          },
          {
            id: 'row_01J8Z5V003',
            rev: 1,
            updatedAt: '2026-10-09T08:02:00Z',
            values: { fld_name: 'Gamma', fld_qty: 2 },
            sync: null,
          },
        ],
        views: [
          {
            id: 'view_default',
            name: 'Default',
            sort: [{ fieldId: 'fld_qty', direction: 'desc' }],
            groupBy: null,
            hidden: [],
            frozenColumns: 1,
            rowHeight: 'medium',
            columnWidths: { fld_name: 240, fld_qty: 90 },
            columnOrder: ['fld_name', 'fld_qty'],
            warnings: [],
          },
        ],
        syncLink: null,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  return { csv, xlsx, tabula, broken, viewA11, rowCount: rows.length, columns: header };
}

// Only run when executed directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(join(OUT, 'labeled'), { recursive: true });
  const { bytes, expected } = buildFxXlsx();
  const labeled = buildLabeledSet();
  const labeledJson = JSON.stringify(labeled, null, 1) + '\n';
  const hashes = {
    'fx-xlsx.xlsx': sha256(bytes),
    'labeled/labeled-set.json': sha256(Buffer.from(labeledJson)),
  };
  const p6 = buildP6Fixtures();
  hashes['import-a2.csv'] = sha256(p6.csv);
  hashes['import-a3.xlsx'] = sha256(p6.xlsx);
  hashes['decoy.tabula'] = sha256(p6.tabula);
  hashes['broken.tablify'] = sha256(p6.broken);
  hashes['view-a11.tablify'] = sha256(p6.viewA11);
  const hashFile = join(OUT, 'HASHES.json');
  if (process.argv.includes('--check')) {
    const recorded = existsSync(hashFile) ? JSON.parse(readFileSync(hashFile, 'utf8')) : {};
    let ok = true;
    for (const [k, v] of Object.entries(hashes)) {
      if (recorded[k] !== v) {
        ok = false;
        console.log(`CHECK FAIL: ${k} ${v} != ${recorded[k]}`);
      }
    }
    if (ok) console.log('CHECK PASS');
    process.exit(ok ? 0 : 1);
  }
  writeFileSync(join(OUT, 'fx-xlsx.xlsx'), bytes);
  writeFileSync(join(OUT, 'labeled', 'labeled-set.json'), labeledJson);
  writeFileSync(join(OUT, 'import-a2.csv'), p6.csv);
  writeFileSync(join(OUT, 'import-a3.xlsx'), p6.xlsx);
  writeFileSync(join(OUT, 'decoy.tabula'), p6.tabula);
  writeFileSync(join(OUT, 'broken.tablify'), p6.broken);
  writeFileSync(join(OUT, 'view-a11.tablify'), p6.viewA11);
  writeFileSync(hashFile, JSON.stringify(hashes, null, 2) + '\n');
  console.log(`wrote fx-xlsx.xlsx (${bytes.length} bytes, rows=${expected.data.length - 1}), labeled-set.json (${labeled.columns.length} columns x ${labeled.rows} values), and P6 fixtures: import-a2.csv (${p6.csv.length} B), import-a3.xlsx (${p6.xlsx.length} B, rows=${p6.rowCount}), decoy.tabula, broken.tablify, view-a11.tablify`);
  console.log(JSON.stringify(hashes));
}

// ---------------------------------------------------------------------------
// FX-LABELED (P4-03): 30 columns × 100 values with known intended types.
// AUTHORED BY THE AGENT (see C5 in docs/plan/phase-4-plan.md). Includes noisy values
// and deliberate hard cases so the measured accuracy is not flattered.
// Intended-type labels: text | number | date | checkbox | single_select
// ---------------------------------------------------------------------------
export function buildLabeledSet() {
  const rand = mulberry32(31337);
  const N = 100;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const ri = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const cols = [];
  const add = (name, label, values) => cols.push({ name, label, values });
  const rows = (fn) => Array.from({ length: N }, (_, i) => fn(i));
  // Noise: replace k random positions with a noisy value.
  const withNoise = (vals, noise, k) => {
    const out = [...vals];
    for (let j = 0; j < k; j++) out[ri(0, N - 1)] = pick(noise);
    return out;
  };

  // ---- text (6) ----
  add('Customer', 'text', rows((i) => `Customer ${String.fromCharCode(65 + (i % 26))}${i}`));
  add('Description', 'text', rows((i) => `Line item ${i}: ${pick(['shipped late', 'damaged box', 're-ordered', 'bulk item'])} #${i}`));
  add('Code', 'text', rows((i) => `X${pad(i, 4)}${pick(['A', 'B', 'C'])}`));
  add('Email', 'text', rows((i) => `user${i}@example.com`));
  add('Comment', 'text', rows(() => pick(['ok', 'fine', 'see note'])));               // HARD: few distinct values, labeled text
  add('Address line', 'text', rows((i) => `${ri(1, 999)} Main Street, Unit ${i}`));

  // ---- number (6) ----
  add('Price', 'number', withNoise(rows(() => (ri(100, 99999) / 100).toFixed(2)), ['N/A'], 1));
  add('Quantity', 'number', rows(() => String(ri(2, 500))));
  add('Balance', 'number', withNoise(rows(() => (ri(-9999, 99999) / 100).toFixed(2)), ['1,234.50'], 1)); // thousands separator noise
  add('Ratio', 'number', rows(() => (ri(0, 1000) / 1000).toFixed(3)));
  add('Temperature', 'number', rows(() => (ri(-300, 400) / 10).toFixed(1)));
  add('Index', 'number', rows(() => String(ri(100, 10000))));

  // ---- date (6) ----
  add('Created', 'date', rows(() => `${ri(2020, 2026)}-${pad(ri(1, 12))}-${pad(ri(1, 28))}`));
  add('Due', 'date', withNoise(rows(() => `${ri(2025, 2027)}-${pad(ri(1, 12))}-${pad(ri(1, 28))}`), ['tbd'], 2));
  add('Event', 'date', rows(() => `${pad(ri(1, 28))} ${MON[ri(0, 11)]} ${ri(2020, 2026)}`));
  add('Shipped', 'date', rows(() => `${pad(ri(13, 28))}/${pad(ri(1, 12))}/${ri(2020, 2026)}`)); // dd/mm/yyyy, day always > 12 → unambiguous
  add('Logged', 'date', rows(() => `${ri(2020, 2026)}/${pad(ri(1, 12))}/${pad(ri(1, 28))}`));
  add('Birthday', 'date', rows(() => `${pad(ri(1, 12))}/${pad(ri(1, 12))}/${ri(1960, 2005)}`)); // HARD: ambiguous-only, labeled date

  // ---- checkbox (6) ----
  add('Done', 'checkbox', rows(() => pick(['TRUE', 'FALSE'])));
  add('Paid', 'checkbox', rows(() => pick(['yes', 'no'])));
  add('Active', 'checkbox', rows(() => pick([1, 0])));
  add('Flag', 'checkbox', withNoise(rows(() => pick(['true', 'false'])), ['maybe'], 1));
  add('Approved', 'checkbox', rows(() => pick(['Y', 'N']))); // HARD: Y/N is outside the spec's word list
  add('Visible', 'checkbox', rows(() => rand() < 0.5));       // native JS booleans

  // ---- single select (6) ----
  add('Status', 'single_select', rows(() => pick(['Todo', 'Doing', 'Review', 'Done'])));
  add('Priority', 'single_select', rows(() => pick(['Low', 'Medium', 'High'])));
  add('Country', 'single_select', rows(() => pick(['NL', 'BD', 'US', 'DE', 'FR', 'IN', 'GB', 'BR', 'CA', 'JP', 'AU', 'ES'])));
  add('Team', 'single_select', rows((i) => `Team ${i % 25}`)); // HARD: 25 distinct values, above the 20-option cap
  add('Tag', 'single_select', withNoise(rows(() => pick(['red', 'green', 'blue'])), ['???'], 1));
  add('Size', 'single_select', rows(() => (rand() < 0.2 ? '' : pick(['S', 'M', 'L', 'XL']))));

  return { rows: N, columns: cols };
}
