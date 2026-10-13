// SAD-115 — a single-select status changed to "Done" moves its row to the bottom of its group.
//
// Pure rules (`isDoneOption`, `doneMoveBefore`) plus one stored-order helper (`moveRowBefore`)
// shared by the undoable cell edit (commands.ts) and the Airtable pull (sync/pull.ts).
// Rules, as answered by the owner on 2026-10-13:
//  - the trigger is any single-select field with an option named "Done" (ignoring case and
//    surrounding spaces); a checkbox field named Done never triggers;
//  - ungrouped table: the row goes to the end of the stored order;
//  - grouped by another field: the row goes to the bottom of its own group only;
//  - grouped by the same field: no move, because grouping already separates the rows.

import type { CellValue, FieldDefinition, Row } from './types.js';
import type { TableStore } from './tableStore.js';
import { groupKeyOf } from '../views/grid/grouping.js';

const DONE_NAME = 'done';

/** True when `value` is the id of a single-select option named Done (case and spaces ignored). */
export function isDoneOption(field: FieldDefinition, value: CellValue | undefined): boolean {
  if (field.type !== 'single_select' || typeof value !== 'string') return false;
  return (field.options ?? []).some(
    (o) => o.id === value && o.name.trim().toLowerCase() === DONE_NAME,
  );
}

export interface DoneMove {
  /** Row the moved row ends up directly above, in stored order; null = the end. */
  beforeRowId: string | null;
}

export interface DoneMoveInput {
  /** Rows in stored order. */
  rows: readonly Row[];
  rowId: string;
  /** The field whose value changed. */
  field: FieldDefinition;
  oldValue: CellValue | undefined;
  newValue: CellValue | undefined;
  /** The grouping field, or null when the table is not grouped. */
  groupField: FieldDefinition | null;
}

/** Where a row goes when its status becomes Done, or null when it should not move. */
export function doneMoveBefore(input: DoneMoveInput): DoneMove | null {
  const { rows, rowId, field, oldValue, newValue, groupField } = input;
  if (field.type !== 'single_select') return null;
  if (!isDoneOption(field, newValue) || isDoneOption(field, oldValue)) return null;
  if (groupField === null) return { beforeRowId: null };
  if (groupField.id === field.id) return null;

  const me = rows.find((r) => r.id === rowId);
  if (!me) return null;
  const key = groupKeyOf(me.values[groupField.id], groupField);

  // The last other row in the same group, in stored order.
  let last = -1;
  rows.forEach((r, i) => {
    if (r.id !== rowId && groupKeyOf(r.values[groupField.id], groupField) === key) last = i;
  });
  if (last < 0) return null; // the only row in its group: already at the bottom of it

  // Directly after that row: the next row that is not the moved row itself.
  for (let i = last + 1; i < rows.length; i++) {
    if (rows[i].id !== rowId) return { beforeRowId: rows[i].id };
  }
  return { beforeRowId: null };
}

/**
 * Move one row in stored order so it sits directly above `beforeRowId` (null = the end).
 * Returns the row's old index, or -1 when the row is unknown (nothing moved).
 */
export function moveRowBefore(
  store: Pick<TableStore, 'getDisplayOrder' | 'moveRow'>,
  rowId: string,
  beforeRowId: string | null,
): number {
  const order = store.getDisplayOrder();
  const from = order.indexOf(rowId);
  if (from < 0) return -1;
  const rest = order.filter((id) => id !== rowId);
  const at = beforeRowId === null ? rest.length : rest.indexOf(beforeRowId);
  store.moveRow(rowId, at < 0 ? rest.length : at);
  return from;
}

/**
 * Apply the Done move for a row whose stored values were just changed from `oldValues` to
 * `newValues` (the Airtable pull path). Returns how many fields triggered a move.
 */
export function applyDoneMovesForChange(
  store: TableStore,
  groupBy: string | null,
  rowId: string,
  oldValues: Readonly<Record<string, CellValue>>,
  newValues: Readonly<Record<string, CellValue>>,
): number {
  const fields = store.getFields();
  const groupField = groupBy ? (fields.find((f) => f.id === groupBy) ?? null) : null;
  let moved = 0;
  for (const field of fields) {
    if (!(field.id in newValues)) continue;
    const move = doneMoveBefore({
      rows: store.getAllRows(),
      rowId,
      field,
      oldValue: oldValues[field.id],
      newValue: newValues[field.id],
      groupField,
    });
    if (move && moveRowBefore(store, rowId, move.beforeRowId) >= 0) moved++;
  }
  return moved;
}
