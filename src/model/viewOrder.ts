// View ordering helpers shared by the grid and by export: visible fields, column order, and sort.
// Pure model code, no Obsidian or DOM imports. Moved here from src/io/export/view.ts in P5-00.

import type { CellValue, FieldDefinition, Row, SortEntry, ViewDefinition } from './types.js';
import { getFieldType } from './fieldTypes/index.js';

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'variant' });

/** Readable text used for text comparison of a cell (same display rules as export). */
function sortText(value: CellValue, field: FieldDefinition): string {
  if (typeof value === 'string') return value;
  return getFieldType(field.type).format(value, field);
}

/** Sort compare for one field. Empty values sort last in both directions. */
export function compareCells(a: CellValue, b: CellValue, field: FieldDefinition, dir: 1 | -1): number {
  const aEmpty = a === null || a === undefined || (Array.isArray(a) && a.length === 0);
  const bEmpty = b === null || b === undefined || (Array.isArray(b) && b.length === 0);
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
  let c: number;
  if (typeof a === 'number' && typeof b === 'number') c = a - b;
  else if (typeof a === 'boolean' && typeof b === 'boolean') c = Number(a) - Number(b);
  else c = collator.compare(sortText(a, field), sortText(b, field));
  return c * dir;
}

/** Stable multi-key sort using the view's sort entries. Returns a new array. */
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
