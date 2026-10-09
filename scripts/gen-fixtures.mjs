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

// Only run when executed directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(OUT, { recursive: true });
  const { bytes, expected } = buildFxXlsx();
  const hashFile = join(OUT, 'HASHES.json');
  const hashes = { 'fx-xlsx.xlsx': sha256(bytes) };
  if (process.argv.includes('--check')) {
    const recorded = existsSync(hashFile) ? JSON.parse(readFileSync(hashFile, 'utf8')) : {};
    const ok = recorded['fx-xlsx.xlsx'] === hashes['fx-xlsx.xlsx'];
    console.log(ok ? 'CHECK PASS' : `CHECK FAIL: ${hashes['fx-xlsx.xlsx']} != ${recorded['fx-xlsx.xlsx']}`);
    process.exit(ok ? 0 : 1);
  }
  writeFileSync(join(OUT, 'fx-xlsx.xlsx'), bytes);
  writeFileSync(hashFile, JSON.stringify(hashes, null, 2) + '\n');
  console.log(`wrote fx-xlsx.xlsx (${bytes.length} bytes) sha256=${hashes['fx-xlsx.xlsx']} rows=${expected.data.length - 1}`);
}
