// Table session: the in-memory state of one open .tablify file (P5-00, extended in P5-02).
// Wraps the store and the command stack so every change is undoable (R-D14).
// Pure model code, no Obsidian or DOM imports.

import type { CellValue, FieldDefinition, FieldTypeName, Row, SyncLink, TablifyFile, ViewDefinition } from './types.js';
import { createTableStore, type TableStore } from './tableStore.js';
import {
  createCommandStack,
  createAddRowCommand,
  createChangeFieldTypeCommand,
  createDeleteRowCommand,
  createDeleteRowsCommand,
  createMoveRowCommand,
  createEditCellCommand,
  createEditCellAndMoveCommand,
  createInsertRowCommand,
  createSetViewCommand,
  createAddFieldCommand,
  createSetFormulaCommand,
  type CommandStack,
} from './commands.js';
import { createFormulaRuntime, ERROR_MESSAGES, type FormulaError } from './formulaRuntime.js';
import { compileFormula } from '../formula/index.js';

import { generateFieldId } from '../utils/idGen.js';
import { createSelectOptionManager } from './selectOptions.js';
import { sortRows, visibleFields } from './viewOrder.js';
import { filterRows, compileQuery } from './rowFilter.js';
import type { QueryError } from '../query/parse.js';
import { planTypeChange, type TypeChangePlan } from './fieldChange.js';
import { doneMoveBefore, isDoneOption } from './doneOrder.js';

/** Result of changing a formula (P8-03). */
export type FormulaSetResult = { ok: true } | { ok: false; reason: string };

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
  /**
   * Rows in display order: view sort applied, then the persisted search and query.
   * Both filters live here rather than in the view layer so the grid, the row count and any
   * export that resolves the current view all agree on what is visible.
   */
  getDisplayRows(): Row[];
  /**
   * Error from the persisted query, or null when the query is empty or valid.
   * Let the UI show why a saved filter is not narrowing anything.
   */
  getFilterError(): QueryError | null;
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
  /**
   * Delete several rows as one undoable command (SAD-80 bulk delete). Unknown ids are ignored;
   * returns how many rows were deleted (0 = nothing changed, no undo entry).
   */
  deleteRows(rowIds: string[]): number;
  /**
   * Move a row in the stored (manual) order so it sits directly above `beforeRowId`, or at the
   * end for null (SAD-80, prototype `moveRowBefore`). One undo step. Returns false, with no undo
   * entry, when the row is unknown or the move would not change the order.
   */
  moveRowBefore(rowId: string, beforeRowId: string | null): boolean;
  /** Replace the view definition through an undoable command. */
  setView(view: ViewDefinition): void;
  /**
   * Update persisted view state that must NOT be undoable — search and query (SAD-69).
   *
   * setView() wraps every change in a command, so routing 200 ms-debounced search
   * keystrokes through it would push an undo entry per tick, bury real edits several
   * hundred steps deep, and mark the file dirty on every pause in typing. Layout changes
   * (sort, hidden, freeze, row height) still go through setView() and stay undoable.
   */
  patchView(patch: Partial<ViewDefinition>): void;
  /**
   * Add a field, appending it to the view's column order so the column appears immediately
   * (SAD-70). The field and the column order move together in one undo step.
   * Returns the new definition, including its generated id.
   *
   * SAD-86: `extras` (from the prototype Add Field dialog) adds select options and validation
   * rules to the new field in the same undo step. Only the keys that are set are written, so a
   * call without extras creates exactly the field it always did.
   */
  addField(
    name: string,
    type: FieldTypeName,
    formula?: string,
    linkTableId?: string,
    extras?: NewFieldExtras,
  ): FieldDefinition;
  /**
   * Replace a formula field's expression (P8-03). Blocked (no change) if the expression does not
   * parse. Unknown names and cycles are not blocked: they show as error values on the cell.
   */
  setFormula(fieldId: string, formula: string): FormulaSetResult;
  /** Error state of a formula cell for the grid's tooltip, or null. */
  getFormulaError(rowId: string, fieldId: string): FormulaError | null;
  /** Change a field's type with value conversion. Blocked (no change) unless every value converts. */
  changeFieldType(fieldId: string, target: FieldTypeName): TypeChangePlan;
  undo(): boolean;
  redo(): boolean;
  /** Serializable file with current fields, rows, and views. Unknown top-level keys are kept. */
  toFile(): TablifyFile;
  /** The Airtable link, or null for a local-only table (P7-06). Not undoable. */
  getSyncLink(): SyncLink | null;
  setSyncLink(link: SyncLink | null): void;
}

export function createSession(file: TablifyFile): TableSession {
  const store = createTableStore({
    fields: file.fields,
    initialRows: file.rows,
  });
  const stack = createCommandStack({ store });
  // P8-03: formula results are display-only. Plain tables never build an engine.
  const formulas = createFormulaRuntime(store);
  const afterMutation = (): void => formulas.sync();
  let view: ViewDefinition = file.views[0];
  // P7-06: the Airtable link is session state, so toFile() never writes a stale copy.
  let syncLink: SyncLink | null = file.syncLink ?? null;

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
      formulas.sync();
      const fields = store.getFields() as FieldDefinition[];
      const sorted = sortRows(store.getAllRows(), view.sort, fields);
      // All fields, including hidden ones: P3-08 specifies "any cell". An unparsable query
      // fails open here so a typo cannot hide every row.
      const rows = filterRows(sorted, fields, view.search, view.query).rows;
      // P8-03: formula cells show their computed value. Sorting and filtering read the same
      // value. The stored rows are untouched.
      const formulaIds = fields.filter((f) => f.type === 'formula').map((f) => f.id);
      if (formulaIds.length === 0) return rows;
      return rows.map((r) => {
        const values = { ...r.values };
        for (const id of formulaIds) values[id] = formulas.displayValue(r.id, id);
        return { ...r, values };
      });
    },
    getFormulaError(rowId, fieldId) {
      return formulas.error(rowId, fieldId);
    },
    setFormula(fieldId, formula) {
      const field = store.getFields().find((f) => f.id === fieldId);
      if (!field || field.type !== 'formula') return { ok: false, reason: 'Not a formula field' };
      const compiled = compileFormula(formula);
      if (!compiled.ok) return { ok: false, reason: ERROR_MESSAGES['#PARSE!'] };
      if (field.formula === formula) return { ok: true };
      stack.execute(createSetFormulaCommand({ fieldId, oldFormula: field.formula, newFormula: formula }));
      afterMutation();
      return { ok: true };
    },
    getFilterError() {
      const compiled = compileQuery(view.query, store.getFields() as FieldDefinition[]);
      return compiled.ok ? null : compiled.error;
    },
    setValue(rowId, fieldId, value) {
      // P8-03: a formula cell is never edited. Its value comes from the formula.
      if (store.getFields().some((f) => f.id === fieldId && f.type === 'formula')) return;
      const row = store.getRow(rowId);
      if (!row) return;
      const oldValue = row.values[fieldId] ?? null;
      if (JSON.stringify(oldValue) === JSON.stringify(value)) return;
      // SAD-115: a status change to Done also moves the row (one undo step). Any other edit
      // keeps the original command.
      const field = store.getFields().find((f) => f.id === fieldId);
      if (field && isDoneOption(field, value) && !isDoneOption(field, oldValue)) {
        const groupField = view.groupBy ? (store.getFields().find((f) => f.id === view.groupBy) ?? null) : null;
        stack.execute(
          createEditCellAndMoveCommand({ rowId, fieldId, oldValue, newValue: value }, (rows) =>
            doneMoveBefore({ rows, rowId, field, oldValue, newValue: value, groupField }),
          ),
        );
      } else {
        stack.execute(createEditCellCommand({ rowId, fieldId, oldValue, newValue: value }));
      }
      afterMutation();
    },
    addRow() {
      stack.execute(createAddRowCommand({ values: {} }));
      afterMutation();
    },
    insertRowNear(rowId, where) {
      const order = store.getAllRows().map((r) => r.id);
      const idx = order.indexOf(rowId);
      if (idx === -1) return;
      stack.execute(createInsertRowCommand({ index: where === 'above' ? idx : idx + 1, values: {} }));
      afterMutation();
    },
    duplicateRow(rowId) {
      const source = store.getRow(rowId);
      if (!source) return;
      const idx = store.getAllRows().findIndex((r) => r.id === rowId);
      stack.execute(createInsertRowCommand({ index: idx + 1, values: { ...source.values } }));
      afterMutation();
    },
    deleteRow(rowId) {
      if (!store.getRow(rowId)) return;
      stack.execute(createDeleteRowCommand({ rowId }));
      afterMutation();
    },
    deleteRows(rowIds) {
      const ids = rowIds.filter((id, i) => rowIds.indexOf(id) === i && store.getRow(id) !== undefined);
      if (ids.length === 0) return 0;
      stack.execute(createDeleteRowsCommand({ rowIds: ids }));
      afterMutation();
      return ids.length;
    },
    moveRowBefore(rowId, beforeRowId) {
      const order = store.getDisplayOrder();
      const i = order.indexOf(rowId);
      if (i < 0) return false;
      if (beforeRowId !== null && !order.includes(beforeRowId)) return false;
      // The prototype's no-op test: dropping a row onto itself, onto the slot it already
      // occupies (directly above the next row), or at the end when it is already last.
      const noop =
        beforeRowId === rowId ||
        (beforeRowId === null && i === order.length - 1) ||
        (beforeRowId !== null && order[i + 1] === beforeRowId);
      if (noop) return false;
      stack.execute(createMoveRowCommand({ rowId, beforeRowId }));
      afterMutation();
      return true;
    },
    setView(next) {
      const before = view;
      if (JSON.stringify(before) === JSON.stringify(next)) return;
      stack.execute(createSetViewCommand<ViewDefinition>({ apply: setViewState, before, after: next }));
    },
    patchView(patch) {
      const next: ViewDefinition = { ...view, ...patch };
      if (JSON.stringify(view) === JSON.stringify(next)) return;
      // Deliberately no stack.execute — see the interface note. The caller is responsible
      // for re-rendering and requesting a save, exactly as it is after setView().
      setViewState(next);
    },
    addField(name, type, formula, linkTableId, extras) {
      const field: FieldDefinition = {
        id: generateFieldId(),
        name,
        type,
        ...(type === 'formula' ? { formula: formula ?? '' } : {}),
        // P8-04: a link field's default target table (FORMAT_SPEC §12).
        ...(type === 'link' ? { linkTableId: linkTableId ?? file.tableId } : {}),
      };
      if (extras) applyNewFieldExtras(field, extras);
      const viewBefore = view;
      const viewAfter: ViewDefinition = {
        ...view,
        columnOrder: [...view.columnOrder, field.id],
      };
      stack.execute(
        createAddFieldCommand({ field, applyView: setViewState, viewBefore, viewAfter }),
      );
      afterMutation();
      return field;
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
      afterMutation();
      return plan;
    },
    undo() {
      const changed = stack.undo();
      afterMutation();
      return changed;
    },
    redo() {
      const changed = stack.redo();
      afterMutation();
      return changed;
    },
    getSyncLink() {
      return syncLink;
    },
    setSyncLink(link: SyncLink | null) {
      syncLink = link;
    },
    toFile() {
      const views = file.views.slice();
      views[0] = view;
      // P8-03: formula results are never written. Drop any formula key from row values.
      const formulaIds = store.getFields().filter((f) => f.type === 'formula').map((f) => f.id);
      const rows = formulaIds.length === 0
        ? store.getAllRows()
        : store.getAllRows().map((r) => {
            const values = { ...r.values };
            for (const id of formulaIds) delete values[id];
            return { ...r, values };
          });
      return { ...file, fields: store.getFields().map((f) => ({ ...f })), rows, views, syncLink };
    },
  };
}

/**
 * SAD-86: what the prototype Add Field dialog can set on a new field besides its name and type.
 * Every key is optional; an unset key is not written to the field.
 */
export interface NewFieldExtras {
  /** Single / multi select: option names, in order (blank and duplicate names are skipped). */
  options?: readonly string[];
  required?: boolean;
  unique?: boolean;
  /** Already in the field type's stored form (number, `YYYY-MM-DD`, ISO date-time, ms). */
  min?: number | string | null;
  max?: number | string | null;
  regex?: string | null;
}

/** Copy the set extras onto a field that is being created (never on an existing field). */
export function applyNewFieldExtras(field: FieldDefinition, extras: NewFieldExtras): void {
  if ((field.type === 'single_select' || field.type === 'multi_select') && extras.options) {
    // The same option factory as cell entry: generated ids, the next colour in turn, and
    // case-insensitive de-duplication.
    const manager = createSelectOptionManager();
    for (const name of extras.options) {
      if (name.trim()) manager.findOrCreate(name, field);
    }
  }
  if (extras.required) field.required = true;
  if (extras.unique) field.unique = true;
  if (extras.min !== undefined && extras.min !== null && extras.min !== '') field.min = extras.min;
  if (extras.max !== undefined && extras.max !== null && extras.max !== '') field.max = extras.max;
  if (extras.regex) field.regex = extras.regex;
}
