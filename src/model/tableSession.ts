// Table session: the in-memory state of one open .tablify file (P5-00).
// Wraps the store and the command stack so every change is undoable (R-D14).
// Pure model code, no Obsidian or DOM imports.

import type { CellValue, FieldDefinition, Row, TablifyFile, ViewDefinition } from './types.js';
import { createTableStore, type TableStore } from './tableStore.js';
import { createCommandStack, createAddRowCommand, createDeleteRowCommand, createEditCellCommand, type CommandStack } from './commands.js';
import { sortRows, visibleFields } from './viewOrder.js';

export interface TableSession {
  readonly store: TableStore;
  readonly stack: CommandStack;
  /** Visible fields in view order. */
  getVisibleFields(): FieldDefinition[];
  /** Current (first) view definition. */
  getView(): ViewDefinition;
  /** Rows in display order: view sort applied. */
  getDisplayRows(): Row[];
  /** Set one cell through an undoable command. No-op if the value is unchanged. */
  setValue(rowId: string, fieldId: string, value: CellValue): void;
  /** Add an empty row through an undoable command. */
  addRow(): void;
  /** Delete a row through an undoable command. */
  deleteRow(rowId: string): void;
  /** Replace the view definition (not undoable; view state is not table data). */
  setView(view: ViewDefinition): void;
  undo(): boolean;
  redo(): boolean;
  /** Serializable file with current rows and views. Unknown top-level keys are kept. */
  toFile(): TablifyFile;
}

export function createSession(file: TablifyFile): TableSession {
  const store = createTableStore({
    fields: file.fields,
    initialRows: file.rows,
  });
  const stack = createCommandStack({ store });
  let view: ViewDefinition = file.views[0];

  return {
    store,
    stack,
    getVisibleFields() {
      return visibleFields(file.fields, view);
    },
    getView() {
      return view;
    },
    getDisplayRows() {
      return sortRows(store.getAllRows(), view.sort, file.fields);
    },
    setValue(rowId, fieldId, value) {
      const row = store.getRow(rowId);
      if (!row) return;
      const oldValue = row.values[fieldId] ?? null;
      if (JSON.stringify(oldValue) === JSON.stringify(value)) return;
      stack.execute(createEditCellCommand({ rowId, fieldId, oldValue, newValue: value }));
    },
    addRow() {
      stack.execute(createAddRowCommand({ values: {} }));
    },
    deleteRow(rowId) {
      if (!store.getRow(rowId)) return;
      stack.execute(createDeleteRowCommand({ rowId }));
    },
    setView(next) {
      view = next;
    },
    undo() {
      const ok = stack.undo();
      return ok;
    },
    redo() {
      const ok = stack.redo();
      return ok;
    },
    toFile() {
      const views = file.views.slice();
      views[0] = view;
      return { ...file, rows: store.getAllRows(), views };
    },
  };
}
