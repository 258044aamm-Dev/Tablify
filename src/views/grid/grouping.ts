/**
 * Group-by for the grid (SAD-81, prototype `renderGrid` group rows + `toggleGroup`).
 *
 * Pure: no DOM, no Obsidian. TableView feeds it the session's display rows (already sorted,
 * searched and filtered) and hands the result to GridView. With no `groupBy` nothing here runs
 * and the grid keeps its flat, uniform-pitch path.
 *
 * Prototype rules kept:
 * - groups appear in order of first occurrence in the sorted rows (not sorted by key);
 * - an empty value forms the "(empty)" group;
 * - a collapsed group keeps its header and count but its rows leave the pipeline, so they are
 *   neither rendered nor selectable;
 * - row numbers (`#`) run on across groups and skip the numbers of collapsed rows.
 *
 * One deliberate difference: groups are keyed by raw value (option id, 'true' / 'false', the
 * stored string), not by label, so renaming a select option does not reopen its group. The key
 * is what `view.collapsedGroups` stores (FORMAT_SPEC §5).
 */

import { getFieldType } from '../../model/fieldTypes/registry.js';
import type { CellValue, FieldDefinition, FieldTypeName, Row } from '../../model/types.js';

/** Field types offered in the Options panel's Group by list (prototype `groupable`). */
export const GROUPABLE_TYPES: readonly FieldTypeName[] = ['single_select', 'checkbox', 'rating', 'text', 'date'];

/** Label of the group holding rows with no value (prototype `'(empty)'`). */
export const EMPTY_GROUP_LABEL = '(empty)';

export function isGroupable(field: FieldDefinition): boolean {
  return GROUPABLE_TYPES.includes(field.type);
}

/** One group header as the grid draws it. */
export interface GridGroup {
  /** Raw-value key (see the module note); '' for the empty group. */
  key: string;
  /** Header text: the formatted value, or "(empty)". */
  label: string;
  /** Option colour when the label is a select option (drawn as the option chip), else null. */
  color: string | null;
  /** Rows in the group, collapsed or not. */
  count: number;
  collapsed: boolean;
  /** Row number (1-based) of the group's first row; numbers run on across groups. */
  firstNumber: number;
  /** Index into the grouped display rows of the group's first row (its rows are contiguous). */
  rowStart: number;
}

export interface GroupedRows {
  /** Rows in group order with collapsed groups left out — the grid's row indices. */
  rows: Row[];
  groups: GridGroup[];
}

/** Raw-value group key of a cell. Checkbox never has an empty group (prototype 'true'/'false'). */
export function groupKeyOf(value: CellValue | undefined, field: FieldDefinition): string {
  if (field.type === 'checkbox') return value === true ? 'true' : 'false';
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  return String(value);
}

function labelOf(key: string, value: CellValue | undefined, field: FieldDefinition): { label: string; color: string | null } {
  if (field.type === 'checkbox') return { label: key, color: null };
  if (key === '') return { label: EMPTY_GROUP_LABEL, color: null };
  if (field.type === 'single_select') {
    const option = (field.options ?? []).find((o) => o.id === key);
    // An id with no option left (deleted option) still groups; it shows its raw value.
    return option ? { label: option.name, color: option.color } : { label: key, color: null };
  }
  if (field.type === 'rating') {
    const max = typeof field.max === 'number' ? field.max : 5;
    return { label: `${key}/${max}`, color: null };
  }
  const text = getFieldType(field.type).format(value ?? null, field);
  return { label: text || EMPTY_GROUP_LABEL, color: null };
}

/**
 * Group `rows` (already in display order) by `field`. `collapsed` lists the keys whose rows are
 * left out of the returned `rows`.
 */
export function groupRows(rows: readonly Row[], field: FieldDefinition, collapsed: readonly string[] = []): GroupedRows {
  const order: string[] = [];
  const buckets = new Map<string, { value: CellValue | undefined; rows: Row[] }>();
  for (const row of rows) {
    const value = row.values[field.id];
    const key = groupKeyOf(value, field);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { value, rows: [] };
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.rows.push(row);
  }
  const closed = new Set(collapsed);
  const visible: Row[] = [];
  const groups: GridGroup[] = [];
  let number = 1;
  for (const key of order) {
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const isCollapsed = closed.has(key);
    const { label, color } = labelOf(key, bucket.value, field);
    groups.push({
      key,
      label,
      color,
      count: bucket.rows.length,
      collapsed: isCollapsed,
      firstNumber: number,
      rowStart: visible.length,
    });
    if (!isCollapsed) visible.push(...bucket.rows);
    number += bucket.rows.length;
  }
  return { rows: visible, groups };
}

/** Collapse or expand one group; returns the next `collapsedGroups` list. */
export function toggleCollapsed(collapsed: readonly string[] | undefined, key: string): string[] {
  const list = [...(collapsed ?? [])];
  const i = list.indexOf(key);
  if (i >= 0) list.splice(i, 1);
  else list.push(key);
  return list;
}
