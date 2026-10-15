import { describe, it, expect } from 'vitest';
import { parseCsv } from '../../src/io/csv.js';
import { resolveExportTable, cellText } from '../../src/io/export/view.js';
import { prepareExportFile } from '../../src/io/export/prepare.js';
import { serialize } from '../../src/format/serialize.js';
import { makeFile } from './export.fixtures.js';

function formulaFile() {
  const file = makeFile(3);
  file.formatVersion = 2;
  file.fields = file.fields.map((field) => ({
    ...field,
    ...(field.options ? { options: field.options.map((option) => ({ ...option })) } : {}),
  }));
  file.views = file.views.map((view) => ({
    ...view,
    sort: view.sort.map((entry) => ({ ...entry })),
    hidden: [...view.hidden],
    columnOrder: [...view.columnOrder],
  }));
  file.fields.push({ id: 'fld_double', name: 'Double amount', type: 'formula', formula: '{Amount} * 2' });
  file.views[0].columnOrder = [...file.views[0].columnOrder, 'fld_double'];
  const amounts = [2, 3, 4];
  file.rows.forEach((row, index) => {
    row.values.fld_amount = amounts[index];
    delete row.values.fld_double;
  });
  return file;
}

describe('formula values in exports', () => {
  for (const fullTable of [false, true]) {
    it(`exports computed formula values in CSV, XLSX, and Markdown (fullTable=${fullTable})`, async () => {
      const source = formulaFile();
      const resolved = resolveExportTable(source, { fullTable });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      const table = resolved.table;
      const formulaField = table.fields.find((field) => field.id === 'fld_double');
      expect(formulaField).toBeDefined();
      if (!formulaField) return;
      const expected = table.rows.map((row) => String(Number(row.values.fld_amount) * 2));
      expect(table.rows.map((row) => cellText(row.values.fld_double ?? null, formulaField))).toEqual(expected);

      for (const format of ['csv', 'xlsx', 'md'] as const) {
        const prepared = await prepareExportFile(
          async () => serialize(source),
          'Budget',
          format,
          { fullTable },
        );
        expect(prepared.ok).toBe(true);
        if (!prepared.ok) return;
        const data = prepared.artifact.data;

        if (format === 'csv') {
          expect(typeof data).toBe('string');
          if (typeof data !== 'string') return;
          const csv = parseCsv(data);
          expect(csv.ok).toBe(true);
          if (!csv.ok) return;
          const csvFormulaIndex = table.fields.findIndex((field) => field.id === 'fld_double');
          expect(csv.rows.slice(1).map((row) => row[csvFormulaIndex])).toEqual(expected);
        } else if (format === 'md') {
          expect(typeof data).toBe('string');
          if (typeof data !== 'string') return;
          for (const value of expected) expect(data).toContain(`| ${value} |`);
        } else {
          expect(data instanceof ArrayBuffer).toBe(true);
          if (!(data instanceof ArrayBuffer)) return;
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(Buffer.from(data), { type: 'buffer' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as unknown[][];
          const xlsxFormulaIndex = table.fields.findIndex((field) => field.id === 'fld_double');
          expect(rows[0]?.[xlsxFormulaIndex]).toBe('Double amount');
          expect(rows.slice(1).map((row) => row[xlsxFormulaIndex])).toEqual(expected.map(Number));
        }
      }
    });
  }
});
