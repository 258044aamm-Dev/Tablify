// T-U for P4-04: buildTable — typed values, options, validation, round trip, error paths.
import { describe, it, expect } from 'vitest';
import { buildTable, uniqueFieldNames } from '../../src/io/import/build.js';
import { parse } from '../../src/format/parse.js';

const NOW = () => '2026-10-09T00:00:00.000Z';

describe('uniqueFieldNames', () => {
  it('trims, names empty headers, and de-duplicates', () => {
    expect(uniqueFieldNames([' Name ', '', 'Name', 'Name'])).toEqual(['Name', 'Column 2', 'Name 2', 'Name 3']);
  });
});

describe('buildTable', () => {
  const rows = [
    ['Name', 'Qty', 'When', 'Ok', 'Team'],
    ['a', '1.5', '2026-01-02', 'yes', 'Red'],
    ['b', '', '2026-02-03', 'no', 'Blue'],
    ['c', '-2', '2026-03-04', '1', 'Red'],
    ['d', '3', '2026-04-05', 'true', 'Blue'],
    ['e', '4', '2026-05-06', 'false', 'Red'],
    ['f', '5', '2026-06-07', '0', 'Blue'],
  ];

  it('builds a valid, round-trip-checked table with typed values', () => {
    const r = buildTable({ tableName: 'T', rows }, { now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const f = r.file;
    expect(f.fields.map((x) => x.type)).toEqual(['text', 'number', 'date', 'checkbox', 'single_select']);
    expect(f.fields[0].primary).toBe(true);
    expect(f.fields.slice(1).some((x) => x.primary)).toBe(false);
    const [qty, , ok, team] = [f.fields[1], f.fields[2], f.fields[3], f.fields[4]];
    expect(f.rows.map((row) => row.values[qty.id])).toEqual([1.5, null, -2, 3, 4, 5]);
    expect(f.rows.map((row) => row.values[ok.id])).toEqual([true, false, true, true, false, false]);
    const redId = team.options!.find((o) => o.name === 'Red')!.id;
    const blueId = team.options!.find((o) => o.name === 'Blue')!.id;
    expect(f.rows.map((row) => row.values[team.id])).toEqual([redId, blueId, redId, blueId, redId, blueId]);
    expect(r.report.rowCount).toBe(6);
    expect(r.report.columns.map((c) => c.type)).toEqual(['text', 'number', 'date', 'checkbox', 'single_select']);
    // Content parses back.
    const parsed = parse(r.content);
    expect(parsed.ok).toBe(true);
  });

  it('a text column keeps raw values (no trimming)', () => {
    const r = buildTable({ tableName: 'T', rows: [['Note'], [' spaced '], ['plain']] }, { now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.rows[0].values[r.file.fields[0].id]).toBe(' spaced ');
  });

  it('header-only file gives a valid table with zero rows', () => {
    const r = buildTable({ tableName: 'T', rows: [['A', 'B']] }, { now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.rows).toEqual([]);
    expect(r.file.views).toHaveLength(1);
  });

  it('no header option: every row is data and columns are named Column N', () => {
    const r = buildTable({ tableName: 'T', rows: [['1', 'x'], ['2', 'y']] }, { now: NOW, hasHeader: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.fields.map((f) => f.name)).toEqual(['Column 1', 'Column 2']);
    expect(r.file.rows).toHaveLength(2);
  });

  it('no rows at all is an error', () => {
    const r = buildTable({ tableName: 'T', rows: [] }, { now: NOW });
    expect(r.ok).toBe(false);
  });

  it('a serialization error produces an error and no content', () => {
    const r = buildTable({ tableName: 'T', rows }, { now: NOW, serialize: () => { throw new Error('disk full (simulated)'); } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('disk full (simulated)');
  });

  it('a round-trip mismatch is an error (serializer that corrupts data)', () => {
    const r = buildTable({ tableName: 'T', rows }, { now: NOW, serialize: (f) => JSON.stringify({ ...f, rows: [] }) });
    expect(r.ok).toBe(false);
  });
});

// SAD-303 — the import keeps email, URL and phone columns as their own field types.
describe('buildTable — address columns (SAD-303)', () => {
  const rows = [
    ['Name', 'Email', 'Website', 'Phone', 'Mobile'],
    ['Rahim', 'Rahim@Example.com ', 'https://example.com/r', '+880 1712-345678', '01712345678'],
    ['Ada', 'ada@example.org', 'http://example.org/a', '+14155552671', '01812345678'],
  ];

  it('maps the three inferred types onto the matching field types', () => {
    const r = buildTable({ tableName: 'T', rows }, { now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.fields.map((f) => f.type)).toEqual(['text', 'email', 'url', 'phone', 'phone']);
    expect(r.report.columns.map((c) => c.type)).toEqual(['text', 'email', 'url', 'phone', 'phone']);
  });

  it('normalises each value the way its field type does', () => {
    const r = buildTable({ tableName: 'T', rows }, { now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [email, url, phone, mobile] = r.file.fields.slice(1);
    // Email is lower-cased and trimmed, exactly like the field type's parse.
    expect(r.file.rows.map((row) => row.values[email.id])).toEqual(['rahim@example.com', 'ada@example.org']);
    expect(r.file.rows.map((row) => row.values[url.id])).toEqual([
      'https://example.com/r',
      'http://example.org/a',
    ]);
    // International values become E.164; a national number has no country to assume here.
    expect(r.file.rows.map((row) => row.values[phone.id])).toEqual(['+8801712345678', '+14155552671']);
    expect(r.file.rows.map((row) => row.values[mobile.id])).toEqual(['01712345678', '01812345678']);
  });

  it('records the shared country of a "+" column, and leaves it absent when countries mix', () => {
    const r = buildTable({ tableName: 'T', rows }, { now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [email, url, phone, mobile] = r.file.fields.slice(1);
    // The Phone column names BD and US, so there is no honest default.
    expect(phone).not.toHaveProperty('phoneCountry');
    // The Mobile column is national digits: nothing can be said about its country.
    expect(mobile).not.toHaveProperty('phoneCountry');
    expect(email).not.toHaveProperty('phoneCountry');
    expect(url).not.toHaveProperty('phoneCountry');

    const bd = buildTable(
      {
        tableName: 'T',
        rows: [
          ['Phone'],
          ['+880 1712-345678'],
          ['+880 1812-345678'],
        ],
      },
      { now: NOW },
    );
    expect(bd.ok).toBe(true);
    if (!bd.ok) return;
    expect(bd.file.fields[0].phoneCountry).toBe('BD');
  });

  it('a phone column survives the serializer and comes back as a phone column', () => {
    const r = buildTable({ tableName: 'T', rows }, { now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const parsed = parse(r.content);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.fields.find((f) => f.name === 'Phone')?.type).toBe('phone');
  });
});
