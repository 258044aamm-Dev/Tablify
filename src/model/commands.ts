import type { CellValue, FieldDefinition, Row, ViewDefinition } from './types.js';
import type { TableStore } from './tableStore.js';
import { moveRowBefore } from './doneOrder.js';

/**
 * A reversible operation on the table store.
 * Each command stores its do and undo data (not full snapshots).
 */
export interface Command {
  type: string;
  /** Optional key for coalescing (e.g., "editCell:rowX:fldY") */
  targetKey?: string;
  do(store: TableStore): void;
  undo(store: TableStore): void;
}

/** Coalescing window in milliseconds. */
const COALESCE_WINDOW_MS = 1000;

/** Default stack limit. */
const DEFAULT_LIMIT = 100;

interface StackEntry {
  command: Command;
  timestamp: number;
}

export interface CommandStack {
  execute(command: Command): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
  undoStackSize(): number;
  redoStackSize(): number;
}

export interface CommandStackOptions {
  store: TableStore;
  limit?: number;
}

export function createCommandStack(options: CommandStackOptions): CommandStack {
  const { store } = options;
  const limit = options.limit ?? DEFAULT_LIMIT;

  const undoStack: StackEntry[] = [];
  const redoStack: StackEntry[] = [];

  let lastTimestamp = 0;
  let lastTargetKey = '';

  function execute(command: Command): void {
    const now = Date.now();
    const targetKey = command.targetKey ?? '';

    // Coalesce: same targetKey within the window → merge into single undo step
    const canCoalesce =
      targetKey !== '' &&
      targetKey === lastTargetKey &&
      (now - lastTimestamp) < COALESCE_WINDOW_MS &&
      undoStack.length > 0;

    if (canCoalesce) {
      // Replace the entry: keep the original undo, update the do
      const originalEntry = undoStack[undoStack.length - 1];
      const merged = createMergedCommand(originalEntry.command, command);
      originalEntry.command = merged;
      originalEntry.timestamp = now;
      // Execute just the new part (the merged do will handle full state)
      // Actually we need to execute the new command's do
      command.do(store);
    } else {
      command.do(store);
      undoStack.push({ command, timestamp: now });

      // Enforce limit
      while (undoStack.length > limit) {
        undoStack.shift();
      }
    }

    // New command clears redo stack
    redoStack.length = 0;

    lastTimestamp = now;
    lastTargetKey = targetKey;
  }

  function undo(): boolean {
    const entry = undoStack.pop();
    if (!entry) return false;
    entry.command.undo(store);
    redoStack.push(entry);
    lastTimestamp = 0;
    lastTargetKey = '';
    return true;
  }

  function redo(): boolean {
    const entry = redoStack.pop();
    if (!entry) return false;
    entry.command.do(store);
    undoStack.push(entry);
    lastTimestamp = 0;
    lastTargetKey = '';
    return true;
  }

  function canUndo(): boolean {
    return undoStack.length > 0;
  }

  function canRedo(): boolean {
    return redoStack.length > 0;
  }

  function clear(): void {
    undoStack.length = 0;
    redoStack.length = 0;
    lastTimestamp = 0;
    lastTargetKey = '';
  }

  return {
    execute,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
    undoStackSize: () => undoStack.length,
    redoStackSize: () => redoStack.length,
  };
}

/**
 * Create a merged command: undo from the original, do from the new.
 * This ensures undo restores to the state before the first edit in the coalesced sequence.
 */
function createMergedCommand(original: Command, newCmd: Command): Command {
  return {
    type: newCmd.type,
    targetKey: newCmd.targetKey,
    do(store: TableStore): void {
      // The new command's do has already been called during execute,
      // so redo just needs to re-apply it
      newCmd.do(store);
    },
    undo(store: TableStore): void {
      // Undo from the original command restores to the pre-first-edit state
      original.undo(store);
    },
  };
}

// ---- Concrete command implementations ----

export interface EditCellData {
  rowId: string;
  fieldId: string;
  oldValue: CellValue;
  newValue: CellValue;
}

export function createEditCellCommand(data: EditCellData): Command {
  const { rowId, fieldId, oldValue, newValue } = data;
  return {
    type: 'editCell',
    targetKey: `editCell:${rowId}:${fieldId}`,
    do(store: TableStore): void {
      store.updateRow(rowId, { [fieldId]: newValue });
    },
    undo(store: TableStore): void {
      store.updateRow(rowId, { [fieldId]: oldValue });
    },
  };
}

/**
 * SAD-115: a cell edit plus an optional row move, as one undo step. `plan` sees the rows in
 * stored order after the value is set, and returns where the row goes (or null for no move).
 * Undo restores the position and the old value together. With no move this behaves exactly
 * like createEditCellCommand.
 */
export function createEditCellAndMoveCommand(
  data: EditCellData,
  plan: (rows: Row[]) => { beforeRowId: string | null } | null,
): Command {
  const { rowId, fieldId, oldValue, newValue } = data;
  let fromIndex = -1;
  return {
    type: 'editCell',
    targetKey: `editCell:${rowId}:${fieldId}`,
    do(store: TableStore): void {
      store.updateRow(rowId, { [fieldId]: newValue });
      const move = plan(store.getAllRows());
      fromIndex = move ? moveRowBefore(store, rowId, move.beforeRowId) : -1;
    },
    undo(store: TableStore): void {
      if (fromIndex >= 0) store.moveRow(rowId, fromIndex);
      store.updateRow(rowId, { [fieldId]: oldValue });
    },
  };
}

export interface AddRowData {
  values: Record<string, CellValue>;
}

export function createAddRowCommand(data: AddRowData): Command {
  let createdRowId = '';
  return {
    type: 'addRow',
    targetKey: 'addRow',
    do(store: TableStore): void {
      const row = store.createRow(data.values);
      createdRowId = row.id;
    },
    undo(store: TableStore): void {
      if (createdRowId) {
        store.deleteRow(createdRowId);
      }
    },
  };
}

export interface DeleteRowData {
  rowId: string;
}

export function createDeleteRowCommand(data: DeleteRowData): Command {
  let deletedRow: Row | undefined;
  let deletedIndex: number | undefined;
  return {
    type: 'deleteRow',
    targetKey: `deleteRow:${data.rowId}`,
    do(store: TableStore): void {
      const row = store.getRow(data.rowId);
      if (row) {
        deletedRow = row;
        deletedIndex = store.getAllRows().findIndex((r) => r.id === data.rowId);
        store.deleteRow(data.rowId);
      }
    },
    undo(store: TableStore): void {
      // Restore the same row id, revision, and position (a new id would break row identity).
      if (deletedRow) {
        store.restoreRow(deletedRow, deletedIndex);
      }
    },
  };
}

// Unique keys so these commands never coalesce with each other (see execute() above).
let uniqueSeq = 0;
const uniqueKey = (prefix: string) => `${prefix}:${++uniqueSeq}`;

export interface DeleteRowsData {
  rowIds: string[];
}

/**
 * Delete several rows as ONE undo step (SAD-80, prototype `deleteSelectedRows`). Undo puts
 * every row back with its original id, revision and stored position, like the single-row
 * command; rows are restored in ascending position so each index is valid when it is used.
 */
export function createDeleteRowsCommand(data: DeleteRowsData): Command {
  let deleted: { row: Row; index: number }[] = [];
  return {
    type: 'deleteRows',
    targetKey: uniqueKey('deleteRows'),
    do(store: TableStore): void {
      const order = store.getAllRows();
      const ids = new Set(data.rowIds);
      deleted = [];
      order.forEach((row, index) => {
        if (ids.has(row.id)) deleted.push({ row, index });
      });
      for (const d of deleted) store.deleteRow(d.row.id);
    },
    undo(store: TableStore): void {
      for (const d of deleted) store.restoreRow(d.row, d.index);
    },
  };
}

export interface MoveRowData {
  rowId: string;
  /** Row the moved row ends up directly above, in stored order; null = the end. */
  beforeRowId: string | null;
}

/**
 * Move one row in the stored (manual) order (SAD-80, prototype `moveRowBefore`). A pure order
 * change: row ids, values and revisions are untouched. Undo returns the row to its old index;
 * redo repeats the same move.
 */
export function createMoveRowCommand(data: MoveRowData): Command {
  let fromIndex = -1;
  return {
    type: 'moveRow',
    targetKey: uniqueKey('moveRow'),
    do(store: TableStore): void {
      const order = store.getDisplayOrder();
      fromIndex = order.indexOf(data.rowId);
      if (fromIndex < 0) return;
      const rest = order.filter((id) => id !== data.rowId);
      const at = data.beforeRowId === null ? rest.length : rest.indexOf(data.beforeRowId);
      store.moveRow(data.rowId, at < 0 ? rest.length : at);
    },
    undo(store: TableStore): void {
      if (fromIndex >= 0) store.moveRow(data.rowId, fromIndex);
    },
  };
}

// ---- P5-02 commands: row insert at a position, view change, field type change ----

export interface InsertRowData {
  /** Display index (in stored order) where the row is placed. */
  index: number;
  values: Record<string, CellValue>;
}

/**
 * Insert a row at a position. The first do() creates the row; redo restores the same row id,
 * so later commands that refer to it still work. Undo deletes it.
 */

export function createInsertRowCommand(data: InsertRowData): Command {
  let created: Row | undefined;
  return {
    type: 'insertRow',
    targetKey: uniqueKey('insertRow'),
    do(store: TableStore): void {
      if (created) {
        store.restoreRow(created, data.index);
      } else {
        created = store.createRow(data.values);
        store.moveRow(created.id, data.index);
      }
    },
    undo(store: TableStore): void {
      if (created && store.getRow(created.id)) store.deleteRow(created.id);
    },
  };
}

export interface SetViewData<T> {
  /** Apply a view state. The owner of the view (the session) keeps the reference. */
  apply: (view: T) => void;
  before: T;
  after: T;
}

/** Change view state (sort, hidden, frozen). View state is not table data, but the change is undoable. */
export function createSetViewCommand<T>(data: SetViewData<T>): Command {
  return {
    type: 'setView',
    targetKey: uniqueKey('setView'),
    do(): void {
      data.apply(data.after);
    },
    undo(): void {
      data.apply(data.before);
    },
  };
}

export interface AddFieldData {
  /** Field definition to add. */
  field: FieldDefinition;
  /** Applies a view definition to the session — the same seam createSetViewCommand uses. */
  applyView: (view: ViewDefinition) => void;
  viewBefore: ViewDefinition;
  viewAfter: ViewDefinition;
}

/**
 * Add a field and update the view together (SAD-70).
 *
 * Bundling them is the whole point. Applied as two commands, undo would take two steps and
 * could leave the session in a state where columnOrder references a field that no longer
 * exists. No targetKey: every added field is distinct, so nothing should coalesce.
 */
export function createAddFieldCommand(data: AddFieldData): Command {
  return {
    type: 'addField',
    do(store: TableStore): void {
      store.addField(data.field);
      data.applyView(data.viewAfter);
    },
    undo(store: TableStore): void {
      store.removeField(data.field.id);
      data.applyView(data.viewBefore);
    },
  };
}

export interface FieldSnapshot {
  field: FieldDefinition;
  valuesByRow: Record<string, CellValue>;
}

/** Change a field's type and its cell values together. Undo restores the old definition and values. */
export function createChangeFieldTypeCommand(data: { before: FieldSnapshot; after: FieldSnapshot }): Command {
  return {
    type: 'changeFieldType',
    targetKey: uniqueKey('changeFieldType'),
    do(store: TableStore): void {
      store.replaceField(data.after.field, data.after.valuesByRow);
    },
    undo(store: TableStore): void {
      store.replaceField(data.before.field, data.before.valuesByRow);
    },
  };
}

/** One field definition plus the cell values that belong to it, for an undo step. */
export interface FieldChangeEntry {
  field: FieldDefinition;
  valuesByRow: Record<string, CellValue>;
}

/**
 * COD-67: edit one field's name and/or type, carrying every reference to its old name along with
 * it — as ONE undo step.
 *
 * Formulas (`{Price}`) and saved queries (`Price:>10`) address fields by name, never by id, so a
 * rename that left them behind would silently break the table. `before`/`after` hold the edited
 * field plus any formula definitions whose expression was rewritten; the view carries the
 * rewritten query. A name-only edit passes empty value maps, so cell values and row revisions
 * stay exactly as they were.
 */
export interface FieldEditData {
  /** Fields as they were: the edited field, then each formula that was rewritten. */
  before: FieldChangeEntry[];
  /** The same fields, renamed / retyped / rewritten. Same order as `before`. */
  after: FieldChangeEntry[];
  /** Applies a view definition to the session — the same seam createAddFieldCommand uses. */
  applyView: (view: ViewDefinition) => void;
  viewBefore: ViewDefinition;
  viewAfter: ViewDefinition;
}

export function createFieldEditCommand(data: FieldEditData): Command {
  const write = (store: TableStore, entries: FieldChangeEntry[]): void => {
    for (const entry of entries) store.replaceField(entry.field, entry.valuesByRow);
  };
  return {
    type: 'editField',
    do(store: TableStore): void {
      write(store, data.after);
      data.applyView(data.viewAfter);
    },
    undo(store: TableStore): void {
      write(store, data.before);
      data.applyView(data.viewBefore);
    },
  };
}

/**
 * Replace a select field's option list (Step 11) — rename, recolor, reorder and add, plus the
 * delete path, whose `valuesByRow` carries the cells that referenced the option (R-D12).
 *
 * Same shape as a type change — definition and cells move together — so one option edit is one
 * undo step, and undo puts the old list and the old cell values back in a single action.
 */
export function createSetFieldOptionsCommand(data: { before: FieldSnapshot; after: FieldSnapshot }): Command {
  return {
    type: 'setFieldOptions',
    targetKey: uniqueKey('setFieldOptions'),
    do(store: TableStore): void {
      store.replaceField(data.after.field, data.after.valuesByRow);
    },
    undo(store: TableStore): void {
      store.replaceField(data.before.field, data.before.valuesByRow);
    },
  };
}

export interface SetFormulaData {
  fieldId: string;
  oldFormula: string | undefined;
  newFormula: string;
}

/** Change a formula field's expression (P8-03). Undoable like any other edit. */
export function createSetFormulaCommand(data: SetFormulaData): Command {
  const { fieldId, oldFormula, newFormula } = data;
  const apply = (store: TableStore, formula: string | undefined): void => {
    const field = store.getFields().find((f) => f.id === fieldId);
    if (!field) return;
    const next: FieldDefinition = { ...field };
    if (formula === undefined) delete next.formula;
    else next.formula = formula;
    store.replaceField(next, {});
  };
  return {
    type: 'setFormula',
    targetKey: `setFormula:${fieldId}`,
    do(store: TableStore): void {
      apply(store, newFormula);
    },
    undo(store: TableStore): void {
      apply(store, oldFormula);
    },
  };
}
