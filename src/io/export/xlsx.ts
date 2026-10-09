// XLSX writer (P4-05). Uses write-excel-file (browser build, candidate A from P4-02).
// Each cell is { value } (P4-02 finding F4: plain values write an empty sheet).
// number → numeric cell, checkbox → boolean, date → real date cell (yyyy-mm-dd), everything else → text.
import writeXlsxFile from 'write-excel-file';
import type { CellValue, FieldDefinition } from '../../model/types.js';
import { cellText, type ExportTable } from './view.js';

type XlsxCell = { value: string | number | boolean | Date | null; format?: string; fontWeight?: 'bold' };

/** Excel sheet names: max 31 chars, no []:*?/\ */
export function sheetNameFor(name: string): string {
  const safe = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31);
  return safe === '' ? 'Sheet1' : safe;
}

function xlsxCell(value: CellValue, field: FieldDefinition): XlsxCell {
  if (value === null || value === undefined) return { value: null };
  if (field.type === 'checkbox' && typeof value === 'boolean') return { value };
  if (field.type === 'number' && typeof value === 'number') return { value };
  if (field.type === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return { value: d, format: 'yyyy-mm-dd' };
  }
  const text = cellText(value, field);
  return { value: text === '' ? null : text };
}

/** Build the workbook as a Blob (browser build resolves to a Blob directly). */
export async function toXlsx(table: ExportTable): Promise<ArrayBuffer> {
  const header: XlsxCell[] = table.fields.map((f) => ({ value: f.name, fontWeight: 'bold' }));
  const body: XlsxCell[][] = table.rows.map((row) => table.fields.map((f) => xlsxCell(row.values[f.id] ?? null, f)));
  const blob = (await writeXlsxFile([header, ...body] as never, { sheet: sheetNameFor(table.name) })) as Blob;
  return await blob.arrayBuffer();
}
