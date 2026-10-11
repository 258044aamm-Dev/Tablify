/**
 * Row selection (SAD-80, owner decision S-2; prototype `state.selected`, `toggleSelectRow`,
 * `toggleSelectAll`, `deleteSelectedRows`).
 *
 * Selection is UI state only: it is never written to the file and never enters the undo stack.
 * It is a set of row ids, so it survives sorting, filtering and re-rendering, exactly like the
 * prototype's `state.selected` map. Pure functions, no DOM: TableView owns the set, the grid
 * renders it, the toolbar shows its size.
 */

export type RowSelection = ReadonlySet<string>;

/** Toggle one row (prototype `toggleSelectRow`). Returns a new set. */
export function toggleRow(selection: RowSelection, rowId: string, checked?: boolean): Set<string> {
  const next = new Set(selection);
  const on = checked ?? !next.has(rowId);
  if (on) next.add(rowId);
  else next.delete(rowId);
  return next;
}

/**
 * Select or clear every row currently in view (prototype `toggleSelectAll`: it walks
 * `pipelineRows`, i.e. the filtered, sorted rows). Rows outside the filter keep their state.
 */
export function setVisibleRows(selection: RowSelection, visibleRowIds: readonly string[], checked: boolean): Set<string> {
  const next = new Set(selection);
  for (const id of visibleRowIds) {
    if (checked) next.add(id);
    else next.delete(id);
  }
  return next;
}

/**
 * The header checkbox's state: checked when there is at least one row in view and every one is
 * selected. (The prototype rebuilt it unchecked on every render, so it could select all but
 * never clear; reflecting the state lets the same control do both.)
 */
export function allVisibleSelected(selection: RowSelection, visibleRowIds: readonly string[]): boolean {
  return visibleRowIds.length > 0 && visibleRowIds.every((id) => selection.has(id));
}

/**
 * Drop ids of rows that no longer exist (deleted, undone, file reloaded). Returns the same set
 * when nothing changed, so callers can skip work. The prototype counts only selected ids that
 * are still in the table; pruning keeps the count and a later bulk delete honest.
 */
export function pruneSelection(selection: RowSelection, existingRowIds: Iterable<string>): RowSelection {
  if (selection.size === 0) return selection;
  const existing = new Set(existingRowIds);
  let stale = false;
  for (const id of selection) {
    if (!existing.has(id)) {
      stale = true;
      break;
    }
  }
  if (!stale) return selection;
  return new Set([...selection].filter((id) => existing.has(id)));
}

/** "N selected" — the prototype's `#selectedCount` text. */
export function selectionLabel(count: number): string {
  return `${count} selected`;
}
