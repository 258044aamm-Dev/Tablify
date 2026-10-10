import type { CellValue, FieldDefinition, Row } from './types.js';
import { generateRowId } from '../utils/idGen.js';

/**
 * In-memory table store with stable IDs, timestamps, revisions, and auto-number.
 * Pure logic — no Obsidian imports.
 */
export interface TableStore {
  /** Create a new row with the given values. Returns the new row (copy). */
  createRow(values: Record<string, CellValue>): Row;
  /** Sets a row's sync block (P7-06..08). Does not bump rev, so it is not an edit. */
  setRowSync(id: string, sync: Row['sync']): void;
  /** Sets a field's Airtable link (P7-09). Does not touch cell values or rev. */
  setFieldAirtable(fieldId: string, airtable: FieldDefinition['airtable']): void;

  /** Get a row by ID. Returns a copy or undefined. */
  getRow(id: string): Row | undefined;

  /** Get all rows in display order. Returns copies. */
  getAllRows(): Row[];

  /** Update a row's values. Increments rev and updatedAt. Returns the updated row (copy). */
  updateRow(id: string, values: Record<string, CellValue>): Row;

  /** Delete a row by ID. */
  deleteRow(id: string): void;
  /** Re-insert a previously deleted row with its original id, revision, and position (used by undo). */
  restoreRow(row: Row, index?: number): void;

  /** Move a row to a new position in display order. */
  moveRow(id: string, newIndex: number): void;

  /** Get the next auto-number value and increment the counter. */
  getNextAutoNumber(): number;

  /** Get the number of fields. */
  getFieldCount(): number;

  /** Get the number of rows. */
  getRowCount(): number;

  /** Get the field definitions. */
  getFields(): readonly FieldDefinition[];

  /** Get the display order (array of row IDs). */
  getDisplayOrder(): readonly string[];

  /** Get the current auto-number counter (without incrementing). */
  getAutoNumberCounter(): number;
  /**
   * Replace one field definition and set the given cell values (rowId → value for that field).
   * Used by the change-field-type command (P5-02). Each changed row gets rev + 1.
   */
  replaceField(field: FieldDefinition, valuesByRow: Record<string, CellValue>): void;

  /**
   * Append a field definition (SAD-70). Stores a defensive copy so the caller's object
   * cannot be mutated into the model afterwards. Throws on a duplicate id.
   */
  addField(field: FieldDefinition): void;

  /**
   * Remove a field definition and drop its value from every row (SAD-70).
   *
   * Stripping the values matters: serialize copies `row.values` through unchanged, so a
   * definition removed without them would leave orphan keys in the saved .tablify file.
   * Revisions are deliberately NOT incremented — this backs out an add, and undo must
   * restore the prior state exactly rather than look like a fresh edit.
   */
  removeField(fieldId: string): void;
}

export interface CreateStoreOptions {
  fields: FieldDefinition[];
  initialRows?: Row[];
  initialAutoNumber?: number;
}

export function createTableStore(options: CreateStoreOptions): TableStore {
  const fields = [...options.fields];
  const rowMap = new Map<string, Row>();
  const displayOrder: string[] = [];
  let autoNumberCounter = options.initialAutoNumber ?? 1;

  // Load initial rows
  if (options.initialRows) {
    for (const row of options.initialRows) {
      const copy = cloneRow(row);
      rowMap.set(copy.id, copy);
      displayOrder.push(copy.id);
      // Update auto-number counter to be above any existing values
      const autoNumField = fields.find(f => f.type === 'auto_number');
      if (autoNumField) {
        const val = row.values[autoNumField.id];
        if (typeof val === 'number' && val >= autoNumberCounter) {
          autoNumberCounter = val + 1;
        }
      }
    }
  }

  function cloneRow(row: Row): Row {
    return {
      id: row.id,
      rev: row.rev,
      ...(row.createdAt !== undefined ? { createdAt: row.createdAt } : {}),
      updatedAt: row.updatedAt,
      values: { ...row.values },
      // P7-04: keep the sync block. Dropping it here would silently unlink every synced row
      // on the next save. A deep copy keeps callers from mutating store state.
      sync: cloneSync(row.sync),
    };
  }

  function cloneSync(sync: Row['sync']): Row['sync'] {
    if (!sync) return null;
    return {
      ...sync,
      ...(sync.conflict ? { conflict: { ...sync.conflict } } : {}),
    };
  }

  function now(): string {
    return new Date().toISOString();
  }

  function createRow(values: Record<string, CellValue>): Row {
    const id = generateRowId();
    const timestamp = now();
    const row: Row = {
      id,
      rev: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      values: { ...values },
      sync: null,
    };
    rowMap.set(id, row);
    displayOrder.push(id);
    return cloneRow(row);
  }

  function setRowSync(id: string, sync: Row['sync']): void {
    const row = rowMap.get(id);
    if (!row) throw new Error(`Row not found: ${id}`);
    row.sync = cloneSync(sync);
  }

  function setFieldAirtable(fieldId: string, airtable: FieldDefinition['airtable']): void {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) throw new Error(`Field not found: ${fieldId}`);
    field.airtable = airtable ? { ...airtable } : airtable;
  }

  function getRow(id: string): Row | undefined {
    const row = rowMap.get(id);
    return row ? cloneRow(row) : undefined;
  }

  function getAllRows(): Row[] {
    return displayOrder.map(id => cloneRow(rowMap.get(id)!));
  }

  function updateRow(id: string, values: Record<string, CellValue>): Row {
    const row = rowMap.get(id);
    if (!row) {
      throw new Error(`Row not found: ${id}`);
    }
    row.rev += 1;
    row.updatedAt = now();
    // Merge values (don't replace entirely)
    for (const [key, val] of Object.entries(values)) {
      row.values[key] = val;
    }
    return cloneRow(row);
  }

  function deleteRow(id: string): void {
    if (!rowMap.has(id)) {
      throw new Error(`Row not found: ${id}`);
    }
    rowMap.delete(id);
    const idx = displayOrder.indexOf(id);
    if (idx !== -1) {
      displayOrder.splice(idx, 1);
    }
  }

  function replaceField(field: FieldDefinition, valuesByRow: Record<string, CellValue>): void {
    const idx = fields.findIndex((f) => f.id === field.id);
    if (idx === -1) throw new Error(`Field not found: ${field.id}`);
    fields[idx] = { ...field };
    for (const [rowId, value] of Object.entries(valuesByRow)) {
      if (rowMap.has(rowId)) updateRow(rowId, { [field.id]: value });
    }
  }

  function addField(field: FieldDefinition): void {
    if (fields.some((f) => f.id === field.id)) {
      throw new Error(`Field already exists: ${field.id}`);
    }
    fields.push({ ...field });
  }

  function removeField(fieldId: string): void {
    const idx = fields.findIndex((f) => f.id === fieldId);
    if (idx === -1) throw new Error(`Field not found: ${fieldId}`);
    fields.splice(idx, 1);
    // Direct mutation, not updateRow(): updateRow would bump rev and updatedAt, which
    // would make an undo look like a brand-new edit. See the interface note.
    for (const row of rowMap.values()) {
      if (fieldId in row.values) delete row.values[fieldId];
    }
  }

  function restoreRow(row: Row, index?: number): void {
    if (rowMap.has(row.id)) {
      throw new Error(`Row already exists: ${row.id}`);
    }
    rowMap.set(row.id, cloneRow(row));
    const at = index === undefined ? displayOrder.length : Math.max(0, Math.min(index, displayOrder.length));
    displayOrder.splice(at, 0, row.id);
  }

  function moveRow(id: string, newIndex: number): void {
    const oldIdx = displayOrder.indexOf(id);
    if (oldIdx === -1) {
      throw new Error(`Row not found: ${id}`);
    }
    displayOrder.splice(oldIdx, 1);
    const clampedIndex = Math.max(0, Math.min(displayOrder.length, newIndex));
    displayOrder.splice(clampedIndex, 0, id);
  }

  function getNextAutoNumber(): number {
    const num = autoNumberCounter;
    autoNumberCounter += 1;
    return num;
  }

  return {
    createRow,
    setRowSync,
    setFieldAirtable,
    getRow,
    getAllRows,
    updateRow,
    deleteRow,
    restoreRow,
    replaceField,
    addField,
    removeField,
    moveRow,
    getNextAutoNumber,
    getFieldCount: () => fields.length,
    getRowCount: () => rowMap.size,
    getFields: () => fields,
    getDisplayOrder: () => [...displayOrder],
    getAutoNumberCounter: () => autoNumberCounter,
  };
}
