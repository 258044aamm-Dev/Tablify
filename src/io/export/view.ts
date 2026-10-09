// Resolve what an export contains (P4-05, SAD-40). Pure: no Obsidian imports.
// Scope (D-O5, decided default): "current view" = the table's saved view definition (visible fields,
// column order, sort) plus an optional query; "full table" = every field and row in file order.
// Note: the grid's live search/filter is UI state and is not stored in the file; the grid passes it
// in as `query` once the grid view is wired (see docs/evidence/P4-05.md, gaps).

import { compilePredicate } from '../../query/evaluate.js';
import { parseQuery } from '../../query/parse.js';
import { getFieldType } from '../../model/fieldTypes/index.js';
import type { CellValue, FieldDefinition, Row, SortEntry, TablifyFile, ViewDefinition } from '../../model/types.js';

export interface ExportScope {
  /** true = every field and row. false = current view (default). */
  fullTable: boolean;
  /** Optional query (P2-02 query language), applied in current-view scope only. */
  query?: string;
  /** Index into file.views for the current view. Default 0. */
  viewIndex?: number;
}

export interface ExportTable {
  name: string;
  /** Visible fields, in export column order. */
  fields: FieldDefinition[];
  /** Rows, filtered and sorted. */
  rows: Row[];
}

export type ResolveResult = { ok: true; table: ExportTable } | { ok: false; error: string };

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'variant' });

/** Readable cell text used by CSV and Markdown. Re-importable for the types P4-01/P4-04 read back. */
export function cellText(value: CellValue, field: FieldDefinition): string {
  if (value === null || value === undefined) return '';
  switch (field.type) {
    case 'checkbox':
      return value === true ? 'true' : value === false ? 'false' : '';
    case 'number':
      return typeof value === 'number' ? String(value) : '';
    case 'date':
    case 'date_time':
    case 'text':
    case 'long_text':
    case 'url':
    case 'email':
    case 'phone':
      return typeof value === 'string' ? value : String(value);
    case 'single_select':
    case 'multi_select':
      return getFieldType(field.type).format(value, field);
    default:
      return getFieldType(field.type).format(value, field);
  }
}

/** Sort key compare for one field. Empty values sort last in both directions. */
function compareCells(a: CellValue, b: CellValue, field: FieldDefinition, dir: 1 | -1): number {
  const aEmpty = a === null || a === undefined || (Array.isArray(a) && a.length === 0);
  const bEmpty = b === null || b === undefined || (Array.isArray(b) && b.length === 0);
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
  let c: number;
  if (typeof a === 'number' && typeof b === 'number') c = a - b;
  else if (typeof a === 'boolean' && typeof b === 'boolean') c = Number(a) - Number(b);
  else c = collator.compare(cellText(a, field), cellText(b, field));
  return c * dir;
}

/** Stable multi-key sort using the view's sort entries. */
export function sortRows(rows: Row[], sort: SortEntry[], fields: FieldDefinition[]): Row[] {
  if (sort.length === 0) return rows.slice();
  const byId = new Map(fields.map((f) => [f.id, f]));
  const keys = sort
    .map((s) => ({ field: byId.get(s.fieldId), dir: (s.direction === 'desc' ? -1 : 1) as 1 | -1 }))
    .filter((k): k is { field: FieldDefinition; dir: 1 | -1 } => k.field !== undefined);
  return rows.slice().sort((r1, r2) => {
    for (const k of keys) {
      const c = compareCells(r1.values[k.field.id] ?? null, r2.values[k.field.id] ?? null, k.field, k.dir);
      if (c !== 0) return c;
    }
    return 0;
  });
}

/** Visible fields in view order: columnOrder first (known ids only), then the rest in file order. */
export function visibleFields(fields: FieldDefinition[], view: ViewDefinition): FieldDefinition[] {
  const hidden = new Set(view.hidden);
  const byId = new Map(fields.map((f) => [f.id, f]));
  const ordered: FieldDefinition[] = [];
  const seen = new Set<string>();
  for (const id of view.columnOrder) {
    const f = byId.get(id);
    if (f && !seen.has(id)) {
      ordered.push(f);
      seen.add(id);
    }
  }
  for (const f of fields) if (!seen.has(f.id)) ordered.push(f);
  return ordered.filter((f) => !hidden.has(f.id));
}

export function resolveExportTable(file: TablifyFile, scope: ExportScope): ResolveResult {
  if (scope.fullTable) {
    return { ok: true, table: { name: file.name, fields: file.fields.slice(), rows: file.rows.slice() } };
  }
  const index = scope.viewIndex ?? 0;
  const view = file.views[index];
  if (!view) return { ok: false, error: 'The table has no view to export. Use "Full table".' };

  let rows = file.rows;
  const query = scope.query?.trim();
  if (query) {
    const parsed = parseQuery(query);
    if (!parsed.ok) return { ok: false, error: `Filter error: ${parsed.error.message}` };
    const compiled = compilePredicate(parsed.ast, file.fields);
    if (!compiled.ok) return { ok: false, error: `Filter error: ${compiled.error.message}` };
    rows = rows.filter((r) => compiled.predicate(r));
  }

  const fields = visibleFields(file.fields, view);
  rows = sortRows(rows, view.sort, file.fields);
  return { ok: true, table: { name: file.name, fields, rows } };
}
