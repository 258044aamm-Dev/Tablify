// Build a complete .tablify table in memory from raw rows (P4-04, SAD-39).
// Pure: no Obsidian, no file system. Output is either a fully validated, round-trip-checked
// serialized string, or an error. Nothing partial is ever returned.

import { inferTable, cellKey, dateOnlyIso, parseDateText, isEmptyCell, type InputCell, type InferredType } from '../infer.js';
import { parse as parseFile } from '../../format/parse.js';
import { serialize as serializeFile } from '../../format/serialize.js';
import { validateTable } from '../../model/validation.js';
import { getFieldType } from '../../model/fieldTypes/index.js';
import { createDefaultView } from '../../model/view.js';
import { generateFieldId, generateOptionId, generateRowId, generateTableId } from '../../utils/idGen.js';
import { OPTION_COLORS, type CellValue, type FieldDefinition, type FieldTypeName, type Row, type SelectOption, type TablifyFile } from '../../model/types.js';

export interface ImportSource {
  /** Table name, shown in the file. */
  tableName: string;
  /** Row-major cells. When hasHeader is true, rows[0] is the header. */
  rows: readonly (readonly InputCell[])[];
}

export interface BuildOptions {
  /** First row is the header. Default true. */
  hasHeader?: boolean;
  /** ISO timestamp for createdAt/updatedAt. Default: now. */
  now?: () => string;
  /** Serializer. Default: format/serialize. Test hook for the failure path. */
  serialize?: (file: TablifyFile) => string;
}

export interface ColumnReport {
  name: string;
  type: FieldTypeName;
  reason: string;
}

export interface ImportReport {
  rowCount: number;
  columns: ColumnReport[];
}

export type BuildResult =
  | { ok: true; content: string; file: TablifyFile; report: ImportReport }
  | { ok: false; error: string };

const TYPE_MAP: Record<InferredType, FieldTypeName> = {
  text: 'text',
  number: 'number',
  date: 'date',
  checkbox: 'checkbox',
  single_select: 'single_select',
};

/** Field names: trimmed header; empty → "Column N"; duplicates → "Name 2", "Name 3", ... */
export function uniqueFieldNames(headers: readonly string[]): string[] {
  const used = new Set<string>();
  const out: string[] = [];
  headers.forEach((raw, i) => {
    const base = raw.trim() === '' ? `Column ${i + 1}` : raw.trim();
    let name = base;
    let n = 2;
    while (used.has(name)) name = `${base} ${n++}`;
    used.add(name);
    out.push(name);
  });
  return out;
}

function convertCell(v: InputCell, field: FieldDefinition, selectIds: Map<string, string> | undefined): CellValue {
  if (isEmptyCell(v)) return null;
  switch (field.type) {
    case 'checkbox': {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v === 1;
      const t = String(v).trim().toLowerCase();
      if (t === 'true' || t === 'yes' || t === '1') return true;
      if (t === 'false' || t === 'no' || t === '0') return false;
      break;
    }
    case 'number': {
      if (typeof v === 'number') return v;
      const n = Number(String(v).trim());
      if (Number.isFinite(n)) return n;
      break;
    }
    case 'date': {
      if (v instanceof Date) {
        const day = dateOnlyIso(v);
        if (day !== null) return day;
        break;
      }
      const d = parseDateText(String(v));
      if (d !== null) return d;
      break;
    }
    case 'single_select': {
      const id = selectIds?.get(cellKey(v));
      if (id !== undefined) return id;
      break;
    }
    case 'text':
      if (v instanceof Date) return v.toISOString();
      return String(v);
  }
  throw new Error(`value "${cellKey(v)}" does not convert to ${field.type}`);
}

/**
 * Build a validated, serializable table. Returns an error (and no content) on any failure.
 * Strict inference means every non-empty value of a typed column converts; any mismatch is an error.
 */
export function buildTable(source: ImportSource, options: BuildOptions = {}): BuildResult {
  try {
    return buildUnchecked(source, options);
  } catch (e) {
    return { ok: false, error: `Import failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function buildUnchecked(source: ImportSource, options: BuildOptions): BuildResult {
  const hasHeader = options.hasHeader ?? true;
  const now = options.now ?? (() => new Date().toISOString());
  const serialize = options.serialize ?? serializeFile;

  if (source.rows.length === 0 || (hasHeader && source.rows.length === 1 && source.rows[0].length === 0)) {
    return { ok: false, error: 'The file has no rows to import.' };
  }

  const headerRow: readonly InputCell[] = hasHeader ? source.rows[0] : [];
  const data = hasHeader ? source.rows.slice(1) : source.rows;
  let columnCount = headerRow.length;
  for (const r of data) columnCount = Math.max(columnCount, r.length);
  if (columnCount === 0) return { ok: false, error: 'The file has no columns.' };

  const headers = Array.from({ length: columnCount }, (_, i) => {
    const h = headerRow[i];
    return h === undefined || h === null ? '' : String(h);
  });
  const names = uniqueFieldNames(headers);
  const inferences = inferTable(data, columnCount);

  const fields: FieldDefinition[] = [];
  const selectMaps: (Map<string, string> | undefined)[] = [];
  const columns: ColumnReport[] = [];

  for (let i = 0; i < columnCount; i++) {
    const inf = inferences[i];
    const type = TYPE_MAP[inf.type];
    const field: FieldDefinition = { id: generateFieldId(), name: names[i], type };
    if (i === 0) field.primary = true;
    if (type === 'single_select') {
      const opts: SelectOption[] = (inf.selectOptions ?? []).map((name, k) => ({
        id: generateOptionId(),
        name,
        color: OPTION_COLORS[k % OPTION_COLORS.length],
      }));
      field.options = opts;
      selectMaps.push(new Map(opts.map((o) => [o.name, o.id])));
    } else {
      selectMaps.push(undefined);
    }
    fields.push(field);
    columns.push({ name: field.name, type, reason: inf.reason });
  }

  const stamp = now();
  const rows: Row[] = new Array<Row>(data.length);
  for (let r = 0; r < data.length; r++) {
    const src = data[r];
    const values: Record<string, CellValue> = {};
    for (let c = 0; c < fields.length; c++) {
      values[fields[c].id] = convertCell(src[c], fields[c], selectMaps[c]);
    }
    rows[r] = { id: generateRowId(), rev: 1, createdAt: stamp, updatedAt: stamp, values, sync: null };
  }

  const file: TablifyFile = {
    formatVersion: 1,
    tableId: generateTableId(),
    name: source.tableName,
    fields,
    rows,
    views: [createDefaultView(fields)],
    syncLink: null,
  };

  // Validate before serializing. Rules (required/unique/min/max/regex) and per-type checks.
  const violations = validateTable(fields, rows);
  if (violations.length > 0) {
    return { ok: false, error: `Validation failed: ${violations.length} violation(s), first: ${violations[0].message}` };
  }
  for (const field of fields) {
    const ft = getFieldType(field.type);
    for (const row of rows) {
      if (!ft.validate(row.values[field.id] ?? null, field)) {
        return { ok: false, error: `Validation failed: value in column "${field.name}" is not a valid ${field.type}` };
      }
    }
  }

  const content = serialize(file);

  // Round-trip check: what we write must parse back to the same data.
  const parsed = parseFile(content);
  if (!parsed.ok) return { ok: false, error: `Round-trip parse failed: ${parsed.error}` };
  if (parsed.data.rows.length !== rows.length) return { ok: false, error: 'Round-trip row count mismatch' };
  for (let r = 0; r < rows.length; r++) {
    if (JSON.stringify(parsed.data.rows[r].values) !== JSON.stringify(rows[r].values)) {
      return { ok: false, error: `Round-trip value mismatch at row ${r + 1}` };
    }
  }

  return { ok: true, content, file, report: { rowCount: rows.length, columns } };
}
