// SAD-303 — the import promise, proved end to end for both formats: a table exported from
// Tablify and imported again keeps its email, URL and phone fields as those types.
//
// The two halves are the real code, not a summary of it: `resolveExportTable` + `toCsv`/`toXlsx`
// write the file a user would write, and the import path (`parseCsv`/`readXlsxSheets` →
// `buildTable`) reads it back the way the plugin does.

import { describe, it, expect, beforeAll } from 'vitest';
import { buildTable } from '../../src/io/import/build.js';
import { readXlsxSheets } from '../../src/io/import/xlsx.js';
import { parseCsv } from '../../src/io/csv.js';
import { resolveExportTable } from '../../src/io/export/view.js';
import { buildExportArtifact } from '../../src/io/export/exporter.js';
import { createDefaultView } from '../../src/model/view.js';
import type { FieldDefinition, Row, TablifyFile } from '../../src/model/types.js';

const FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
  { id: 'fld_email', name: 'Email', type: 'email' },
  { id: 'fld_url', name: 'Website', type: 'url' },
  { id: 'fld_phone', name: 'Phone', type: 'phone', phoneCountry: 'BD' },
  { id: 'fld_office', name: 'Office', type: 'phone' },
  { id: 'fld_count', name: 'Visits', type: 'number' },
  { id: 'fld_due', name: 'Due', type: 'date' },
];

function row(id: string, values: Row['values']): Row {
  return { id, rev: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', values, sync: null };
}

function makeFile(): TablifyFile {
  const rows: Row[] = [
    row('row_1', {
      fld_name: 'Rahim',
      fld_email: 'rahim@example.com',
      fld_url: 'https://example.com/rahim',
      fld_phone: '+8801712345678',
      fld_office: '+88029876543',
      fld_count: 4,
      fld_due: '2026-11-01',
    }),
    row('row_2', {
      fld_name: 'Ada',
      fld_email: 'ada@example.org',
      fld_url: 'http://example.org/ada',
      fld_phone: '+8801812345678',
      // A legacy value that is not valid: the round-trip must not invent anything for it.
      fld_office: '+880 2 987 6543',
      fld_count: 11,
      fld_due: '2026-12-15',
    }),
  ];
  return {
    formatVersion: 1,
    tableId: 'tbl_ROUNDTRIP',
    name: 'Contacts',
    fields: FIELDS,
    rows,
    views: [createDefaultView(FIELDS)],
    syncLink: null,
  };
}

beforeAll(async () => {
  // write-excel-file's browser build needs a DOMParser when it builds the workbook.
  if (!(globalThis as { DOMParser?: unknown }).DOMParser) {
    const { JSDOM } = await import('jsdom');
    (globalThis as { DOMParser?: unknown }).DOMParser = new JSDOM('').window.DOMParser;
  }
});

function fieldType(report: { columns: Array<{ name: string; type: string }> }, name: string): string | undefined {
  return report.columns.find((c) => c.name === name)?.type;
}

describe('SAD-303 — CSV round-trip keeps email, URL and phone fields', () => {
  it('export → parse → build restores the same field types and values', async () => {
    const file = makeFile();
    const resolved = resolveExportTable(file, { kind: 'all' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const artifact = await buildExportArtifact(resolved.table, 'csv', 'Contacts');
    const csv = artifact.data as string;

    const parsed = parseCsv(csv);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const built = buildTable({ tableName: 'Contacts', rows: parsed.rows });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      console.error(built.error);
      return;
    }

    expect(fieldType(built.report, 'Email')).toBe('email');
    expect(fieldType(built.report, 'Website')).toBe('url');
    expect(fieldType(built.report, 'Phone')).toBe('phone');
    // "Office" is not a phone word, but both values are valid international numbers, so the
    // strict rule claims the column without needing the header.
    expect(fieldType(built.report, 'Office')).toBe('phone');
    expect(fieldType(built.report, 'Visits')).toBe('number');
    expect(fieldType(built.report, 'Due')).toBe('date');

    const fields = built.file.fields;
    const byName = (name: string) => fields.find((f) => f.name === name) as FieldDefinition;
    expect(byName('Phone').phoneCountry).toBe('BD');

    // Each value keeps its meaning: emails lowercased by the field type, then stable.
    const values = built.file.rows.map((r) => r.values);
    expect(values[0][byName('Email').id]).toBe('rahim@example.com');
    expect(values[1][byName('Email').id]).toBe('ada@example.org');
    expect(values[0][byName('Website').id]).toBe('https://example.com/rahim');
    expect(values[0][byName('Phone').id]).toBe('+8801712345678');
    expect(values[1][byName('Phone').id]).toBe('+8801812345678');
    // A "+" value is normalised on import, so a legacy formatted international number lands in
    // the canonical stored form — the same rule an edit applies.
    expect(values[1][byName('Office').id]).toBe('+88029876543');
    expect(values[0][byName('Visits').id]).toBe(4);
    expect(values[0][byName('Due').id]).toBe('2026-11-01');
  });

  it('a second round-trip is stable (types and values do not drift)', async () => {
    const first = makeFile();
    const a = await buildExportArtifact(
      (resolveExportTable(first, { kind: 'all' }) as { ok: true; table: never }).table,
      'csv',
      'Contacts',
    );
    const parsedA = parseCsv(a.data as string);
    expect(parsedA.ok).toBe(true);
    if (!parsedA.ok) return;
    const builtA = buildTable({ tableName: 'Contacts', rows: parsedA.rows });
    expect(builtA.ok).toBe(true);
    if (!builtA.ok) return;

    const b = await buildExportArtifact(
      (resolveExportTable(builtA.file, { kind: 'all' }) as { ok: true; table: never }).table,
      'csv',
      'Contacts',
    );
    const parsedB = parseCsv(b.data as string);
    expect(parsedB.ok).toBe(true);
    if (!parsedB.ok) return;
    const builtB = buildTable({ tableName: 'Contacts', rows: parsedB.rows });
    expect(builtB.ok).toBe(true);
    if (!builtB.ok) return;

    expect(builtB.report.columns.map((c) => [c.name, c.type])).toEqual(builtA.report.columns.map((c) => [c.name, c.type]));
    expect(builtB.file.rows.map((r) => Object.values(r.values))).toEqual(builtA.file.rows.map((r) => Object.values(r.values)));
  });
});

describe('SAD-303 — XLSX round-trip keeps email, URL and phone fields', () => {
  it('export → read → build restores the same field types and values', async () => {
    const file = makeFile();
    const resolved = resolveExportTable(file, { kind: 'all' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    const artifact = await buildExportArtifact(resolved.table, 'xlsx', 'Contacts');
    const sheets = await readXlsxSheets(artifact.data as ArrayBuffer);
    expect(sheets).toHaveLength(1);

    const built = buildTable({ tableName: 'Contacts', rows: sheets[0].rows });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      console.error(built.error);
      return;
    }

    expect(fieldType(built.report, 'Email')).toBe('email');
    expect(fieldType(built.report, 'Website')).toBe('url');
    expect(fieldType(built.report, 'Phone')).toBe('phone');
    expect(fieldType(built.report, 'Visits')).toBe('number');
    expect(fieldType(built.report, 'Due')).toBe('date');

    const byName = (name: string) => built.file.fields.find((f) => f.name === name) as FieldDefinition;
    expect(byName('Phone').phoneCountry).toBe('BD');
    expect(built.file.rows[0].values[byName('Phone').id]).toBe('+8801712345678');
    expect(built.file.rows[0].values[byName('Email').id]).toBe('rahim@example.com');
    expect(built.file.rows[0].values[byName('Website').id]).toBe('https://example.com/rahim');
  });
});
