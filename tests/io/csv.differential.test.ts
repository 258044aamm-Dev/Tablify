// T-D (guidelines §0.2): our parser must match an independent reference (csv-parse, test-only)
// on 10,000 seeded random RFC 4180 CSVs. Expected: 0 mismatches.
import { describe, it, expect } from 'vitest';
import { parse as refParse } from 'csv-parse/sync';
import { parseCsv } from '../../src/io/csv.js';
import { mulberry32, pick, randInt } from './rng.js';

const POOL = ['a', 'b', 'hello world', ',', ';', '"', '""', '\n', '\r\n', ' ', 'é', '漢字', '😀', '', '1,5', 'x;y', '  pad  '];

// csv-parse 5.x rejects some valid RFC 4180 files when a quoted field follows a CRLF
// (e.g. 'x\r\n"b";"x"\n'). Restricting its record delimiters to CRLF or LF fixes that.
// Generated data never contains a lone CR, so this does not hide any real case.
const REF_OPTS = { bom: true, relax_column_count: true, skip_empty_lines: false, record_delimiter: ['\r\n', '\n'] } as const;

function genField(rand: () => number): string {
  let s = '';
  const n = randInt(rand, 0, 3);
  for (let i = 0; i < n; i++) s += pick(rand, POOL);
  return s;
}

/** Build a valid RFC 4180 document plus the rows it encodes. */
function genCsv(seed: number): { text: string; delim: ',' | ';'; rows: string[][] } {
  const rand = mulberry32(seed);
  const delim = rand() < 0.5 ? ',' : ';';
  const nRows = randInt(rand, 1, 6);
  const nCols = randInt(rand, 1, 6);
  const rows: string[][] = [];
  let text = rand() < 0.1 ? '\uFEFF' : '';
  for (let r = 0; r < nRows; r++) {
    const row: string[] = [];
    for (let c = 0; c < nCols; c++) row.push(genField(rand));
    rows.push(row);
    const cells = row.map((f) => {
      // Single empty field must be quoted, or the line would be ambiguous.
      const needsQuote = /[",\r\n]/.test(f) || f.includes(delim) || (f === '' && nCols === 1) || rand() < 0.2;
      return needsQuote ? '"' + f.replace(/"/g, '""') + '"' : f;
    });
    text += cells.join(delim);
    if (r < nRows - 1 || rand() < 0.7) text += rand() < 0.5 ? '\r\n' : '\n';
  }
  return { text, delim, rows };
}

describe('CSV differential test vs csv-parse (P4-01 T-D)', () => {
  it('matches the reference on 10,000 seeded random CSVs (0 mismatches)', () => {
    let mismatches = 0;
    const examples: string[] = [];
    for (let seed = 1; seed <= 10_000; seed++) {
      const { text, delim, rows: expected } = genCsv(seed);
      const ours = parseCsv(text, { delimiter: delim });
      let ref: string[][];
      try {
        ref = refParse(text, { ...REF_OPTS, delimiter: delim }) as string[][];
      } catch (e) {
        throw new Error(`reference rejected seed ${seed}: ${JSON.stringify(text)} :: ${String(e)}`, { cause: e });
      }
      if (!ours.ok) {
        mismatches++;
        if (examples.length < 3) examples.push(`seed ${seed}: ${ours.error}`);
        continue;
      }
      const same = JSON.stringify(ours.rows) === JSON.stringify(ref) && JSON.stringify(ref) === JSON.stringify(expected);
      if (!same) {
        mismatches++;
        if (examples.length < 3) examples.push(`seed ${seed}: ours=${JSON.stringify(ours.rows)} ref=${JSON.stringify(ref)}`);
      }
    }
    expect(examples).toEqual([]);
    expect(mismatches).toBe(0);
  });

  it('auto-detects the same delimiter as the generator for ";" files', () => {
    let checked = 0;
    for (let seed = 1; seed <= 2_000; seed++) {
      const { text, delim, rows } = genCsv(seed);
      // Skip inputs where the first record holds the OTHER delimiter unquoted (e.g. "1,5" in a ';' file):
      // those are genuinely ambiguous for any count-based detector.
      const firstRecordUnquotedOther = rows[0].some((f) => f.includes(delim === ',' ? ';' : ',') && !/^".*"$/s.test(f) && !f.includes('"'));
      if (rows[0].length < 2 || firstRecordUnquotedOther) continue;
      const ours = parseCsv(text);
      if (!ours.ok) throw new Error(ours.error);
      expect(ours.delimiter).toBe(delim);
      checked++;
    }
    expect(checked).toBeGreaterThan(300);
  });
});
