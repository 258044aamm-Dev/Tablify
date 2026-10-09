import type { CellValue, FieldDefinition, Row } from './types.js';
import { generateRowId } from '../utils/idGen.js';

/**
 * In-memory table store with stable IDs, timestamps, revisions, and auto-number.
 * Pure logic — no Obsidian imports.
 */
export interface TableStore {
  /** Create a new row with the given values. Returns the new row (copy). */
  createRow(values: Record<string, CellValue>): Row;

  /** Get a row by ID. Returns a copy or undefined. */
  getRow(id: string): Row | undefined;

  /** Get all rows in display order. Returns copies. */
  getAllRows(): Row[];

  /** Update a row's values. Increments rev and updatedAt. Returns the updated row (copy). */
  updateRow(id: string, values: Record<string, CellValue>): Row;

  /** Delete a row by ID. */
  deleteRow(id: string): void;

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
      sync: null,
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
    getRow,
    getAllRows,
    updateRow,
    deleteRow,
    moveRow,
    getNextAutoNumber,
    getFieldCount: () => fields.length,
    getRowCount: () => rowMap.size,
    getFields: () => fields,
    getDisplayOrder: () => [...displayOrder],
    getAutoNumberCounter: () => autoNumberCounter,
  };
}
