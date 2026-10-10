/**
 * Row filtering for the persisted view search and query (SAD-69 Step 3).
 *
 * Pure model code — no Obsidian imports, no DOM. Sits in src/model so the session can apply
 * the saved filter in getDisplayRows(), which means the grid, the row count and any export
 * that resolves the current view all agree on what is visible.
 *
 * Matching rules come from P3-08:
 *   - Search is a case-insensitive substring test over each cell's *display* text, so a
 *     select matches its label and never its raw option id.
 *   - Query uses the P2-02 grammar and the real evaluator (compilePredicate), not a
 *     simplified matcher, so parser and evaluator stay consistent.
 *
 * An unparsable or unknown-field query fails open: rows are returned unfiltered and the
 * error is handed back so the UI can show it inline. Hiding every row because of a typo
 * would be worse than showing them all.
 */

import { parseQuery } from '../query/parse.js';
import { compilePredicate } from '../query/evaluate.js';
import type { QueryError } from '../query/parse.js';
import type { Predicate } from '../query/evaluate.js';
import { getFieldType } from './fieldTypes/index.js';
import type { CellValue, FieldDefinition, Row } from './types.js';

export interface FilterResult {
  rows: Row[];
  /**
   * Set when a non-empty query failed to compile. `rows` is then the search-filtered set
   * with no query applied, so nothing silently disappears.
   */
  error: QueryError | null;
}

export type CompileResult =
  | { ok: true; predicate: Predicate | null }
  | { ok: false; error: QueryError };

/**
 * Display text for one cell — the same formatting sort and export use.
 * Using it here is what keeps a select searchable by label rather than by raw option id.
 */
export function searchableText(value: CellValue | undefined, field: FieldDefinition): string {
  if (value === null || value === undefined) return '';
  // Selects store a raw option id in a string cell, so they always go through format() to
  // resolve the label — otherwise "Done" would be unsearchable and "opt_done" would match.
  // Every other string cell already *is* its own display text, so it short-circuits.
  // (Deliberately unlike viewOrder's sortText, which compares raw values. Sorting is
  // unchanged by SAD-69; only search follows display text.)
  const isSelect = field.type === 'single_select' || field.type === 'multi_select';
  if (!isSelect && typeof value === 'string') return value;
  return getFieldType(field.type).format(value, field);
}

/**
 * Global search: keep rows where any cell's display text contains the term.
 * Matches every field, including hidden ones — "any cell" per P3-08.
 * An empty or whitespace-only term returns a copy of all rows.
 */
export function searchRows(
  rows: Row[],
  fields: FieldDefinition[],
  search: string | null | undefined,
): Row[] {
  const term = (search ?? '').trim().toLowerCase();
  if (!term) return rows.slice();
  return rows.filter((row) =>
    fields.some((field) => searchableText(row.values[field.id], field).toLowerCase().includes(term)),
  );
}

/**
 * Compile a persisted query string into a row predicate.
 * Returns a null predicate (not an error) when the query is empty or whitespace — that is
 * "no filter", which the grammar treats as valid and matching everything.
 */
export function compileQuery(
  query: string | null | undefined,
  fields: FieldDefinition[],
): CompileResult {
  const trimmed = (query ?? '').trim();
  if (!trimmed) return { ok: true, predicate: null };
  const parsed = parseQuery(trimmed);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const compiled = compilePredicate(parsed.ast, fields);
  if (!compiled.ok) return { ok: false, error: compiled.error };
  return { ok: true, predicate: compiled.predicate };
}

/**
 * Apply the saved search and query together (implicit AND).
 * Never throws: a bad query yields an error plus unfiltered rows.
 */
export function filterRows(
  rows: Row[],
  fields: FieldDefinition[],
  search: string | null | undefined,
  query: string | null | undefined,
): FilterResult {
  const searched = searchRows(rows, fields, search);
  const compiled = compileQuery(query, fields);
  if (!compiled.ok) return { rows: searched, error: compiled.error };
  if (!compiled.predicate) return { rows: searched, error: null };
  return { rows: searched.filter(compiled.predicate), error: null };
}
