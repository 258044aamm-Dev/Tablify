import { describe, it, expect } from 'vitest';
import { parseCsv, detectDelimiter, CsvStreamParser } from '../../src/io/csv.js';

describe('CSV parser — RFC 4180 (P4-01)', () => {
  it('parses a simple file with LF', () => {
    const r = parseCsv('a,b,c\n1,2,3\n');
    expect(r).toMatchObject({ ok: true, delimiter: ',', hadBom: false });
    if (r.ok) expect(r.rows).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('accepts CRLF line endings', () => {
    const r = parseCsv('a,b\r\n1,2\r\n');
    if (!r.ok) throw new Error(r.error);
    expect(r.rows).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('handles quoted fields with commas, doubled quotes, and embedded newlines', () => {
    const r = parseCsv('"a,b","say ""hi""","line1\nline2"\r\nx,y,z');
    if (!r.ok) throw new Error(r.error);
    expect(r.rows).toEqual([['a,b', 'say "hi"', 'line1\nline2'], ['x', 'y', 'z']]);
  });

  it('keeps CRLF inside quoted fields', () => {
    const r = parseCsv('"a\r\nb",c\r\n');
    if (!r.ok) throw new Error(r.error);
    expect(r.rows).toEqual([['a\r\nb', 'c']]);
  });

  it('keeps empty fields and empty quoted fields', () => {
    const r = parseCsv(',"",\n');
    if (!r.ok) throw new Error(r.error);
    expect(r.rows).toEqual([['', '', '']]);
  });

  it('does not create an extra row for a trailing newline, but keeps a trailing empty field', () => {
    const a = parseCsv('a,b\n');
    const b = parseCsv('a,b,\n');
    if (!a.ok || !b.ok) throw new Error('unexpected error');
    expect(a.rows).toEqual([['a', 'b']]);
    expect(b.rows).toEqual([['a', 'b', '']]);
  });

  it('returns zero rows for empty input', () => {
    const r = parseCsv('');
    if (!r.ok) throw new Error(r.error);
    expect(r.rows).toEqual([]);
  });

  it('keeps a file with no trailing newline', () => {
    const r = parseCsv('a\nb');
    if (!r.ok) throw new Error(r.error);
    expect(r.rows).toEqual([['a'], ['b']]);
  });

  it('keeps a lone CR as a record separator', () => {
    const r = parseCsv('a\rb\r');
    if (!r.ok) throw new Error(r.error);
    expect(r.rows).toEqual([['a'], ['b']]);
  });

  it('returns blank lines in the middle as one-empty-field records', () => {
    const r = parseCsv('a\n\nb\n');
    if (!r.ok) throw new Error(r.error);
    expect(r.rows).toEqual([['a'], [''], ['b']]);
  });

  it('keeps ragged rows as-is', () => {
    const r = parseCsv('a,b,c\n1,2\n1,2,3,4\n');
    if (!r.ok) throw new Error(r.error);
    expect(r.rows.map((x) => x.length)).toEqual([3, 2, 4]);
  });

  it('keeps a quote inside an unquoted field literally (lenient)', () => {
    const r = parseCsv('5" screen,x\n');
    if (!r.ok) throw new Error(r.error);
    expect(r.rows).toEqual([['5" screen', 'x']]);
  });
});

describe('CSV parser — BOM and delimiter detection', () => {
  it('strips a UTF-8 BOM and reports it', () => {
    const r = parseCsv('\uFEFFname,age\nAda,36\n');
    if (!r.ok) throw new Error(r.error);
    expect(r.hadBom).toBe(true);
    expect(r.rows[0][0]).toBe('name');
  });

  it('detects ";" when it is the delimiter of the first line', () => {
    const r = parseCsv('a;b;c\n1,5;2;3\n');
    if (!r.ok) throw new Error(r.error);
    expect(r.delimiter).toBe(';');
    expect(r.rows).toEqual([['a', 'b', 'c'], ['1,5', '2', '3']]);
  });

  it('detects "," for a normal comma file', () => {
    expect(detectDelimiter('a,b;c,d\n')).toBe(',');
  });

  it('ignores delimiters inside quotes when detecting', () => {
    expect(detectDelimiter('"a;b;c",x\n')).toBe(',');
    expect(detectDelimiter('"a,b,c";x;y\n')).toBe(';');
  });

  it('uses "," on a tie and when neither appears', () => {
    expect(detectDelimiter('a,b;c\n')).toBe(',');
    expect(detectDelimiter('single\n')).toBe(',');
  });

  it('honours a forced delimiter', () => {
    const r = parseCsv('a,b;c\n', { delimiter: ';' });
    if (!r.ok) throw new Error(r.error);
    expect(r.rows).toEqual([['a,b', 'c']]);
  });
});

describe('CSV parser — errors (never throws)', () => {
  it('reports an unterminated quoted field at end of input', () => {
    const r = parseCsv('a,"b\nc');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Unterminated quoted field/);
      expect(r.line).toBeGreaterThan(0);
      expect(r.column).toBeGreaterThan(0);
    }
  });

  it('reports text after a closing quote', () => {
    const r = parseCsv('"a"b,c\n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/after closing quote/);
  });

  it('reports the line where a bad quote appears', () => {
    const r = parseCsv('a,b\n"x"y\n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.line).toBe(2);
  });
});

describe('CSV streaming parser', () => {
  it('gives the same rows for every chunk size (chunk-boundary safety)', () => {
    const input = '\uFEFF;a;b\r\n"x;1";"multi\r\nline"\r\n1;"q""q"\r\n';
    const whole = parseCsv(input);
    if (!whole.ok) throw new Error(whole.error);
    for (let size = 1; size <= 9; size++) {
      const rows: string[][] = [];
      const p = new CsvStreamParser({ onRow: (r) => rows.push(r) });
      for (let i = 0; i < input.length; i += size) p.push(input.slice(i, i + size));
      const res = p.end();
      expect(res.ok).toBe(true);
      expect(rows).toEqual(whole.rows);
    }
  });

  it('detects the delimiter when the first line is split across chunks', () => {
    const rows: string[][] = [];
    const p = new CsvStreamParser({ onRow: (r) => rows.push(r) });
    p.push('a;');
    p.push('b;c\n1;2;3');
    const res = p.end();
    expect(res.ok && res.delimiter).toBe(';');
    expect(rows).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('emits rows before the whole input has been pushed', () => {
    const seen: string[][] = [];
    const p = new CsvStreamParser({ onRow: (r) => seen.push(r) });
    p.push('a,b\n');
    expect(seen).toEqual([['a', 'b']]);
    p.end();
  });
});
