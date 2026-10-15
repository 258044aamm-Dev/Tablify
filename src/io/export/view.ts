// Resolve what an export contains (P4-05, SAD-40). Pure model code; no Obsidian or DOM imports.
// Current-view exports mirror the persisted view state and use the same session/filter/formula
// logic as the grid. Full-table exports preserve file order and include computed formula values.

import { compilePredicate } from '../../query/evaluate.js';
import { parseQuery } from '../../query/parse.js';
import { createDefaultView } from '../../model/view.js';
import { createSession } from '../../model/tableSession.js';
import { getFieldType } from '../../model/fieldTypes/index.js';
import type { CellValue, FieldDefinition, Row, TablifyFile, ViewDefinition } from '../../model/types.js';

export interface ExportScope {
  /** true = every field and row. false = current view (default). */
  fullTable: boolean;
  /** Optional query override (P2-02 query language), applied in current-view scope only. */
  query?: string;
  /** Index into file.views for the current view. Default 0. */
  viewIndex?: number;
}

export interface ExportTable {
  name: string;
  /** Visible fields, in export column order. */
  fields: FieldDefinition[];
  /** Rows, filtered and sorted. Formula fields contain their computed values. */
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
    // Formula results are not persisted. Build them through the same runtime used by an open
    // TableSession, with filters cleared, then restore the file's original row order.
    const view = file.views[0] ?? createDefaultView(file.fields);
    const session = createExportSession(file, view);
    session.patchView({ search: '', query: '' });
    const rowsById = new Map(session.getDisplayRows().map((row) => [row.id, row]));
    return {
      ok: true,
      table: {
        name: file.name,
        fields: file.fields.slice(),
        rows: file.rows.map((row) => rowsById.get(row.id) ?? row),
      },
    };
  }

  const index = scope.viewIndex ?? 0;
  const view = file.views[index];
  if (!view) return { ok: false, error: 'The table has no view to export. Use "Full table".' };

  // An explicitly supplied query keeps the export API's existing validation contract. The
  // persisted view query, when used by the modal, follows TableSession's fail-open display rule.
  if (scope.query !== undefined) {
    const query = scope.query.trim();
    if (query) {
      const parsed = parseQuery(query);
      if (!parsed.ok) return { ok: false, error: `Filter error: ${parsed.error.message}` };
      const compiled = compilePredicate(parsed.ast, file.fields);
      if (!compiled.ok) return { ok: false, error: `Filter error: ${compiled.error.message}` };
    }
  }

  const session = createExportSession(file, view);
  if (scope.query !== undefined) session.patchView({ query: scope.query });
  return {
    ok: true,
    table: {
      name: file.name,
      fields: session.getVisibleFields(),
      rows: session.getDisplayRows(),
    },
  };
}

function createExportSession(file: TablifyFile, view: ViewDefinition) {
  // Isolate the chosen view from the input and keep support for callers that select a non-default
  // view without changing the TableSession API, which intentionally operates on the first view.
  return createSession({ ...file, views: [view] });
}
