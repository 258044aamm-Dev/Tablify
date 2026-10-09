// Table session: the in-memory state of one open .tablify file (P5-00, extended in P5-02).
// Wraps the store and the command stack so every change is undoable (R-D14).
// Pure model code, no Obsidian or DOM imports.

import type { CellValue, FieldDefinition, FieldTypeName, Row, TablifyFile, ViewDefinition } from './types.js';
import { createTableStore, type TableStore } from './tableStore.js';
import {
  createCommandStack,
  createAddRowCommand,
  createChangeFieldTypeCommand,
  createDeleteRowCommand,
  createEditCellCommand,
  createInsertRowCommand,
  createSetViewCommand,
  type CommandStack,
} from './commands.js';
import { sortRows, visibleFields } from './viewOrder.js';
import { planTypeChange, type TypeChangePlan } from './fieldChange.js';

export interface TableSession {
  readonly store: TableStore;
  readonly stack: CommandStack;
  /** Visible fields in view order. */
  getVisibleFields(): FieldDefinition[];
  /** Field definitions (current, after any type change). */
  getFields(): FieldDefinition[];
  getField(fieldId: string): FieldDefinition | undefined;
  /** Current (first) view definition. */
  getView(): ViewDefinition;
  /** Rows in display order: view sort applied. */
  getDisplayRows(): Row[];
  /** Set one cell through an undoable command. No-op if the value is unchanged. */
  setValue(rowId: string, fieldId: string, value: CellValue): void;
  /** Add an empty row at the end through an undoable command. */
  addRow(): void;
  /** Insert an empty row directly above or below a row (stored order). Undoable. */
  insertRowNear(rowId: string, where: 'above' | 'below'): void;
  /** Duplicate a row (values copied, new row id) directly below it. Undoable. */
  duplicateRow(rowId: string): void;
  /** Delete a row through an undoable command. */
  deleteRow(rowId: string): void;
  /** Replace the view definition through an undoable command. */
  setView(view: ViewDefinition): void;
  /** Change a field's type with value conversion. Blocked (no change) unless every value converts. */
  changeFieldType(fieldId: string, target: FieldTypeName): TypeChangePlan;
  undo(): boolean;
  redo(): boolean;
  /** Serializable file with current fields, rows, and views. Unknown top-level keys are kept. */
  toFile(): TablifyFile;
}

export function createSession(file: TablifyFile): TableSession {
  const store = createTableStore({
    fields: file.fields,
    initialRows: file.rows,
  });
  const stack = createCommandStack({ store });
  let view: ViewDefinition = file.views[0];

  const setViewState = (next: ViewDefinition) => {
    view = next;
  };

  return {
    store,
    stack,
    getVisibleFields() {
      return visibleFields(store.getFields() as FieldDefinition[], view);
    },
    getFields() {
      return [...store.getFields()];
    },
    getField(fieldId) {
      return store.getFields().find((f) => f.id === fieldId);
    },
    getView() {
      return view;
    },
    getDisplayRows() {
      return sortRows(store.getAllRows(), view.sort, store.getFields() as FieldDefinition[]);
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
    insertRowNear(rowId, where) {
      const order = store.getAllRows().map((r) => r.id);
      const idx = order.indexOf(rowId);
      if (idx === -1) return;
      stack.execute(createInsertRowCommand({ index: where === 'above' ? idx : idx + 1, values: {} }));
    },
    duplicateRow(rowId) {
      const source = store.getRow(rowId);
      if (!source) return;
      const idx = store.getAllRows().findIndex((r) => r.id === rowId);
      stack.execute(createInsertRowCommand({ index: idx + 1, values: { ...source.values } }));
    },
    deleteRow(rowId) {
      if (!store.getRow(rowId)) return;
      stack.execute(createDeleteRowCommand({ rowId }));
    },
    setView(next) {
      const before = view;
      if (JSON.stringify(before) === JSON.stringify(next)) return;
      stack.execute(createSetViewCommand<ViewDefinition>({ apply: setViewState, before, after: next }));
    },
    changeFieldType(fieldId, target) {
      const field = store.getFields().find((f) => f.id === fieldId);
      if (!field) return { ok: false, reason: 'Field not found', blockedRows: 0 };
      const rows = store.getAllRows();
      const plan = planTypeChange(rows, field, target);
      if (!plan.ok) return plan;
      const before = {
        field: { ...field },
        valuesByRow: Object.fromEntries(rows.map((r) => [r.id, (r.values[fieldId] ?? null) as CellValue])),
      };
      stack.execute(
        createChangeFieldTypeCommand({
          before,
          after: { field: plan.field, valuesByRow: plan.valuesByRow },
        }),
      );
      return plan;
    },
    undo() {
      return stack.undo();
    },
    redo() {
      return stack.redo();
    },
    toFile() {
      const views = file.views.slice();
      views[0] = view;
      return { ...file, fields: store.getFields().map((f) => ({ ...f })), rows: store.getAllRows(), views };
    },
  };
}
