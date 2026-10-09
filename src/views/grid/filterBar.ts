/**
 * Filter bar — search, query input, builder, sort menu, debounce.
 * Pure logic, no Obsidian imports; Vault not needed.
 */

import { parseQuery, printQuery } from '../../query/parse.js';
import type { QueryAST, QueryError } from '../../query/parse.js';

export type SortEntry = { fieldId: string; direction: 'asc' | 'desc' };

export interface FilterBarState {
  searchQuery: string;
  queryAST: QueryAST | null;
  queryError: QueryError | null;
  sort: SortEntry[];
}

/** Global search: matches if any cell's string or visible select label contains query (case-insensitive). */
export function searchRows<T>(
  rows: T[],
  getCells: (row: T) => Array<{ value: unknown; visibleText?: string }>,
  searchQuery: string
): T[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const cells = getCells(row);
    return cells.some((c) => {
      const text = (c.visibleText ?? String(c.value ?? '')).toLowerCase();
      return text.includes(q);
    });
  });
}

/** Non-empty query filter: uses QueryAST terms (field:value) via simple substring match on raw values. */
export function filterByQueryAST<T>(
  rows: T[],
  fields: Array<{ id: string; name: string }>,
  ast: QueryAST,
  getValue: (row: T, fieldId: string) => unknown
): T[] {
  if (!ast.terms.length) return rows;
  const fieldNameToId = new Map(fields.map((f) => [f.name.toLowerCase(), f.id]));
  return rows.filter((row) => {
    for (const term of ast.terms) {
      const fieldId = fieldNameToId.get(term.fieldName.toLowerCase());
      if (!fieldId) return false;
      const val = String(getValue(row, fieldId) ?? '').toLowerCase();
      const need = (term.values[0] ?? '').toLowerCase();
      if (term.op === 'empty') {
        if (val !== '') return false;
      } else if (term.op === 'contains') {
        if (!val.includes(need)) return false;
      } else if (term.op === 'not') {
        if (val === need) return false;
      } else if (term.op === 'gt') {
        if (!(parseFloat(val) > parseFloat(need))) return false;
      } else if (term.op === 'lt') {
        if (!(parseFloat(val) < parseFloat(need))) return false;
      } else {
        // eq — comma list = OR
        const opts = term.values.map((v) => v.toLowerCase());
        if (!opts.includes(val)) return false;
      }
    }
    return true;
  });
}

export function parseQueryInput(input: string): { ast: QueryAST | null; error: QueryError | null } {
  const trimmed = input.trim();
  if (!trimmed) return { ast: null, error: null };
  const res = parseQuery(trimmed);
  if (res.ok) return { ast: res.ast, error: null };
  return { ast: null, error: res.error };
}

/** Query builder: adds a term to the current AST and returns new input string. */
export function addTermToQuery(currentInput: string, fieldName: string, op: string, value: string): string {
  const snippet = `${fieldName}:${value}`;
  const next = currentInput ? `${currentInput} ${snippet}` : snippet;
  const parsed = parseQuery(next);
  if (parsed.ok) return printQuery(parsed.ast);
  return next;
}

export function sortAdd(sort: SortEntry[], fieldId: string, direction: 'asc' | 'desc' = 'asc'): SortEntry[] {
  if (sort.some((s) => s.fieldId === fieldId)) return sort;
  return [...sort, { fieldId, direction }];
}
export function sortRemove(sort: SortEntry[], fieldId: string): SortEntry[] {
  return sort.filter((s) => s.fieldId !== fieldId);
}
export function sortMove(sort: SortEntry[], fromIdx: number, toIdx: number): SortEntry[] {
  if (fromIdx < 0 || fromIdx >= sort.length || toIdx < 0 || toIdx >= sort.length) return sort;
  const next = [...sort];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

/** Debounced query setter — returns cancel handle. */
export function debounceApply(input: string, onApply: (ast: QueryAST | null, err: QueryError | null) => void, delayMs = 250): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  timer = setTimeout(() => {
    const { ast, error } = parseQueryInput(input);
    onApply(ast, error);
  }, delayMs);
  return () => {
    if (timer) clearTimeout(timer);
  };
}
