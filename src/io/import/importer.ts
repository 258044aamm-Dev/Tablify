// Import orchestration (P4-04, SAD-39): read source → build in memory → validate → serialize → write once.
// The write happens only after a full successful build. The target name never overwrites an existing file.

import { parseCsv } from '../csv.js';
import { readXlsxSheets } from './xlsx.js';
import { buildTable, type BuildOptions, type ImportReport } from './build.js';
import type { InputCell } from '../infer.js';

export type ImportKind = 'csv' | 'xlsx';

/** The only vault operations the importer needs. create() must fail if the path exists. */
export interface ImportAdapter {
  exists(path: string): boolean;
  create(path: string, data: string): Promise<void>;
}

export interface ImportInput {
  kind: ImportKind;
  /** Original file name, e.g. "Tasks.csv". Extension is stripped. */
  fileName: string;
  /** CSV: text. XLSX: raw bytes. */
  data: string | ArrayBuffer;
  /** Target folder, vault-relative. "" for the vault root. */
  folder: string;
  adapter: ImportAdapter;
  build?: BuildOptions;
}

export type ImportOutcome =
  | { ok: true; path: string; report: ImportReport; ignoredSheets: number; sheetName?: string }
  | { ok: false; error: string };

const MAX_NAME_ATTEMPTS = 10_000;

/** Make a name safe for an Obsidian file name. */
export function baseNameFrom(fileName: string): string {
  const stripped = fileName.replace(/\.(csv|xlsx)$/i, '');
  const safe = stripped.replace(/[\\/:*?"<>|#^[\]]/g, '-').trim();
  return safe === '' ? 'Imported table' : safe;
}

/** Name for the Nth attempt: "Tasks.tablify", "Tasks 2.tablify", "Tasks 3.tablify", ... */
export function candidatePath(folder: string, base: string, n: number, ext = 'tablify'): string {
  const name = n === 1 ? `${base}.${ext}` : `${base} ${n}.${ext}`;
  return folder === '' ? name : `${folder}/${name}`;
}

/** First candidate path that does not exist. Shared by import and export (never overwrite). */
export function pickFreePath(folder: string, base: string, exists: (p: string) => boolean, ext = 'tablify'): string | null {
  for (let n = 1; n <= MAX_NAME_ATTEMPTS; n++) {
    const p = candidatePath(folder, base, n, ext);
    if (!exists(p)) return p;
  }
  return null;
}

export async function importTable(input: ImportInput): Promise<ImportOutcome> {
  const tableName = baseNameFrom(input.fileName);

  let rows: InputCell[][];
  let ignoredSheets = 0;
  let sheetName: string | undefined;

  if (input.kind === 'csv') {
    if (typeof input.data !== 'string') return { ok: false, error: 'CSV import needs text.' };
    const parsed = parseCsv(input.data);
    if (!parsed.ok) return { ok: false, error: `CSV error at line ${parsed.line}, column ${parsed.column}: ${parsed.error}` };
    rows = parsed.rows;
  } else {
    if (typeof input.data === 'string') return { ok: false, error: 'XLSX import needs bytes.' };
    let sheets;
    try {
      sheets = await readXlsxSheets(input.data);
    } catch (e) {
      return { ok: false, error: `Could not read the Excel file: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (sheets.length === 0) return { ok: false, error: 'The Excel file has no sheets.' };
    rows = sheets[0].rows;
    sheetName = sheets[0].name;
    ignoredSheets = sheets.length - 1;
  }

  const built = buildTable({ tableName, rows }, input.build);
  if (!built.ok) return { ok: false, error: built.error };

  // Write once, after the full build succeeded. create() must fail on existing paths, so no overwrite.
  const base = tableName;
  for (let attempt = 0; attempt < 20; attempt++) {
    const path = pickFreePath(input.folder, base, input.adapter.exists);
    if (path === null) return { ok: false, error: 'No free file name found.' };
    try {
      await input.adapter.create(path, built.content);
      return { ok: true, path, report: built.report, ignoredSheets, sheetName };
    } catch (e) {
      if (!input.adapter.exists(path)) {
        return { ok: false, error: `Could not write the file: ${e instanceof Error ? e.message : String(e)}` };
      }
      // Someone created the path between our check and the write. Try the next name.
    }
  }
  return { ok: false, error: 'Could not find a free file name.' };
}
