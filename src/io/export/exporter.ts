// Export orchestration (P4-05): resolve view → build content in memory → write once, never overwrite.
import { resolveExportTable, type ExportScope } from './view.js';
import { toCsv } from './csv.js';
import { toMarkdown } from './markdown.js';
import { toXlsx } from './xlsx.js';
import { pickFreePath } from '../import/importer.js';
import type { TablifyFile } from '../../model/types.js';

export type ExportFormat = 'csv' | 'xlsx' | 'md';

export interface ExportAdapter {
  exists(path: string): boolean;
  /** Text file (CSV, Markdown). Must fail if the path exists. */
  create(path: string, data: string): Promise<void>;
  /** Binary file (XLSX). Must fail if the path exists. */
  createBinary(path: string, data: ArrayBuffer): Promise<void>;
}

export interface ExportInput {
  file: TablifyFile;
  format: ExportFormat;
  scope: ExportScope;
  /** Folder for the export file, vault-relative. "" = root. */
  folder: string;
  /** Base name without extension. */
  baseName: string;
  adapter: ExportAdapter;
}

export type ExportOutcome = { ok: true; path: string; rowCount: number; columnCount: number } | { ok: false; error: string };

export const EXTENSION: Record<ExportFormat, string> = { csv: 'csv', xlsx: 'xlsx', md: 'md' };

export async function exportTable(input: ExportInput): Promise<ExportOutcome> {
  const resolved = resolveExportTable(input.file, input.scope);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const table = resolved.table;
  const ext = EXTENSION[input.format];

  // Build the full content before anything is written.
  let text: string | null = null;
  let binary: ArrayBuffer | null = null;
  try {
    if (input.format === 'csv') text = toCsv(table);
    else if (input.format === 'md') text = toMarkdown(table);
    else binary = await toXlsx(table);
  } catch (e) {
    return { ok: false, error: `Export failed, no file was written: ${e instanceof Error ? e.message : String(e)}` };
  }

  const path = pickFreePath(input.folder, input.baseName || 'Export', input.adapter.exists, ext);
  if (path === null) return { ok: false, error: 'No free file name found.' };
  try {
    if (text !== null) await input.adapter.create(path, text);
    else if (binary !== null) await input.adapter.createBinary(path, binary);
  } catch (e) {
    return { ok: false, error: `Could not write the file: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { ok: true, path, rowCount: table.rows.length, columnCount: table.fields.length };
}
