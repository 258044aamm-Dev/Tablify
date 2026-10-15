import { parse } from '../../format/parse.js';
import type { ExportScope } from './view.js';
import { resolveExportTable } from './view.js';
import { buildExportArtifact, type ExportArtifact, type ExportFormat } from './exporter.js';

export type PreparedExportResult =
  | { ok: true; artifact: ExportArtifact; rowCount: number; columnCount: number }
  | { ok: false; error: string };

/** Read, validate, resolve, and generate an export without writing it anywhere. */
export async function prepareExportFile(
  read: () => Promise<string>,
  baseName: string,
  format: ExportFormat,
  scope: ExportScope,
): Promise<PreparedExportResult> {
  let text: string;
  try {
    text = await read();
  } catch (error) {
    return { ok: false, error: `Could not read the table file: ${errorMessage(error)}` };
  }

  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(text);
  } catch (error) {
    return { ok: false, error: `The table file could not be read: ${errorMessage(error)}` };
  }
  if (!parsed.ok) {
    return { ok: false, error: `The table file could not be read: ${parsed.error ?? 'Invalid .tablify data.'}` };
  }

  let resolved: ReturnType<typeof resolveExportTable>;
  try {
    resolved = resolveExportTable(parsed.data, scope);
  } catch (error) {
    return { ok: false, error: `Could not prepare the table for export: ${errorMessage(error)}` };
  }
  if (!resolved.ok) return { ok: false, error: resolved.error };

  try {
    const artifact = await buildExportArtifact(resolved.table, format, baseName);
    return {
      ok: true,
      artifact,
      rowCount: resolved.table.rows.length,
      columnCount: resolved.table.fields.length,
    };
  } catch (error) {
    return { ok: false, error: `Export failed before saving: ${errorMessage(error)}` };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
