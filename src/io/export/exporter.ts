// Export orchestration (P4-05): resolve view → build content in memory → write once, never overwrite.
import { resolveExportTable, type ExportScope, type ExportTable } from './view.js';
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

const MIME_TYPE: Record<ExportFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  md: 'text/markdown',
};

export interface ExportArtifact {
  fileName: string;
  mimeType: string;
  data: string | ArrayBuffer;
}

export function exportFileName(baseName: string, format: ExportFormat): string {
  const safeBase = baseName.trim() || 'Export';
  return `${safeBase}.${EXTENSION[format]}`;
}

export function exportMimeType(format: ExportFormat): string {
  return MIME_TYPE[format];
}

/** Build an export in memory so a caller can send it to a vault adapter or device save picker. */
export async function buildExportArtifact(
  table: ExportTable,
  format: ExportFormat,
  baseName: string,
): Promise<ExportArtifact> {
  let data: string | ArrayBuffer;
  if (format === 'csv') data = toCsv(table);
  else if (format === 'md') data = toMarkdown(table);
  else data = await toXlsx(table);
  return { fileName: exportFileName(baseName, format), mimeType: MIME_TYPE[format], data };
}

export async function exportTable(input: ExportInput): Promise<ExportOutcome> {
  const resolved = resolveExportTable(input.file, input.scope);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  return writeExport(resolved.table, input.format, input.folder, input.baseName, input.adapter);
}

/**
 * Build one export file from an already-resolved table and write it once, never overwriting.
 * Split out of exportTable() (SAD-77) so the table view's "Export CSV" can export exactly the rows
 * it shows (live search and query applied) through the same write path as the Export modal.
 */
export async function writeExport(
  table: ExportTable,
  format: ExportFormat,
  folder: string,
  baseName: string,
  adapter: ExportAdapter,
): Promise<ExportOutcome> {
  let artifact: ExportArtifact;
  try {
    // Build the full content before anything is written.
    artifact = await buildExportArtifact(table, format, baseName);
  } catch (e) {
    return { ok: false, error: `Export failed, no file was written: ${e instanceof Error ? e.message : String(e)}` };
  }

  const path = pickFreePath(folder, baseName || 'Export', adapter.exists, EXTENSION[format]);
  if (path === null) return { ok: false, error: 'No free file name found.' };
  try {
    if (typeof artifact.data === 'string') await adapter.create(path, artifact.data);
    else await adapter.createBinary(path, artifact.data);
  } catch (e) {
    return { ok: false, error: `Could not write the file: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { ok: true, path, rowCount: table.rows.length, columnCount: table.fields.length };
}
