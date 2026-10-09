// T-U for P4-05: CSV writer — RFC 4180 quoting, round trip through the P4-01 parser.
import { describe, it, expect } from 'vitest';
import { csvField, toCsv } from '../../src/io/export/csv.js';
import { parseCsv } from '../../src/io/csv.js';

describe('csvField (RFC 4180)', () => {
  it.each([
    ['plain', 'plain'],
    ['a,b', '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['line\nbreak', '"line\nbreak"'],
    ['cr\rhere', '"cr\rhere"'],
    ['', ''],
    ['semi;colon', 'semi;colon'],
  ])('%j → %j', (input, want) => {
    expect(csvField(input)).toBe(want);
  });
});

describe('toCsv', () => {
  it('writes BOM, CRLF line ends, and a header', () => {
    const csv = toCsv({
      name: 'T',
      fields: [{ id: 'a', name: 'A', type: 'text' }, { id: 'b', name: 'B,x', type: 'text' }],
      rows: [{ id: 'r', rev: 1, updatedAt: '', sync: null, values: { a: 'v"1', b: null } }],
    });
    expect(csv).toBe('\uFEFFA,"B,x"\r\n"v""1",\r\n');
  });

  it('round-trips through the P4-01 parser (BOM stripped, same cells)', () => {
    const table = {
      name: 'T',
      fields: [{ id: 'a', name: 'Name', type: 'text' as const }, { id: 'b', name: 'Note', type: 'text' as const }],
      rows: [
        { id: '1', rev: 1, updatedAt: '', sync: null, values: { a: 'x, y', b: 'multi\nline "q"' } },
        { id: '2', rev: 1, updatedAt: '', sync: null, values: { a: '', b: 'trailing ' } },
      ],
    };
    const parsed = parseCsv(toCsv(table));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.hadBom).toBe(true);
    expect(parsed.rows).toEqual([
      ['Name', 'Note'],
      ['x, y', 'multi\nline "q"'],
      ['', 'trailing '],
    ]);
  });
});
