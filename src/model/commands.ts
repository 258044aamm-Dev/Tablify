import type { CellValue, Row } from './types.js';
import type { TableStore } from './tableStore.js';

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
