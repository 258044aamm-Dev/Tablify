/**
 * Row selection (SAD-80, owner decision S-2; prototype `state.selected`, `toggleSelectRow`,
 * `deleteSelectedRows`). SAD-114: chosen from the row menu and with Shift/Ctrl-click, not checkboxes.
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
 * SAD-114: Shift-click range. Adds every row from the anchor to the target (inclusive) to the
 * selection, in the order the rows are shown. Returns the same set when either id is not in view.
 */
export function addRowRange(
  selection: RowSelection,
  visibleRowIds: readonly string[],
  anchorId: string,
  targetId: string,
): Set<string> {
  const a = visibleRowIds.indexOf(anchorId);
  const b = visibleRowIds.indexOf(targetId);
  if (a < 0 || b < 0) return new Set(selection);
  const next = new Set(selection);
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  for (const id of visibleRowIds.slice(lo, hi + 1)) next.add(id);
  return next;
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
