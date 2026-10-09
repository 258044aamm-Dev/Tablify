// Resolve what an export contains (P4-05, SAD-40). Pure: no Obsidian imports.
// Scope (D-O5, decided default): "current view" = the table's saved view definition (visible fields,
// column order, sort) plus an optional query; "full table" = every field and row in file order.
// Note: the grid's live search/filter is UI state and is not stored in the file; the grid passes it
// in as `query` once the grid view is wired (see docs/evidence/P4-05.md, gaps).

import { compilePredicate } from '../../query/evaluate.js';
import { parseQuery } from '../../query/parse.js';
import { getFieldType } from '../../model/fieldTypes/index.js';
import { sortRows, visibleFields } from '../../model/viewOrder.js';
import type { CellValue, FieldDefinition, Row, TablifyFile } from '../../model/types.js';

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

export { sortRows, visibleFields } from '../../model/viewOrder.js';

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
