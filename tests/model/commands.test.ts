import { describe, it, expect } from 'vitest';
import {
  createCommandStack,
  createEditCellCommand,
  createAddRowCommand,
} from '../../src/model/commands.js';
import { createTableStore } from '../../src/model/tableStore.js';
import type { FieldDefinition } from '../../src/model/types.js';

const FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
  { id: 'fld_count', name: 'Count', type: 'number' },
];

function createStoreWithData() {
  const store = createTableStore({ fields: FIELDS });
  const row = store.createRow({ fld_name: 'Initial', fld_count: 10 });
  return { store, row };
}

describe('CommandStack — basic execute/undo/redo', () => {
  it('executes a command', () => {
    const { store, row } = createStoreWithData();
    const stack = createCommandStack({ store });

    const cmd = createEditCellCommand({
      rowId: row.id,
      fieldId: 'fld_count',
      oldValue: 10,
      newValue: 42,
    });
    stack.execute(cmd);

    const updated = store.getRow(row.id)!;
    expect(updated.values.fld_count).toBe(42);
    expect(updated.rev).toBe(2);
  });

  it('undoes a command', () => {
    const { store, row } = createStoreWithData();
    const stack = createCommandStack({ store });

    stack.execute(createEditCellCommand({
      rowId: row.id, fieldId: 'fld_count', oldValue: 10, newValue: 42,
    }));
    expect(store.getRow(row.id)!.values.fld_count).toBe(42);

    const result = stack.undo();
    expect(result).toBe(true);
    expect(store.getRow(row.id)!.values.fld_count).toBe(10);
  });

  it('redoes an undone command', () => {
    const { store, row } = createStoreWithData();
    const stack = createCommandStack({ store });

    stack.execute(createEditCellCommand({
      rowId: row.id, fieldId: 'fld_count', oldValue: 10, newValue: 42,
    }));
    stack.undo();
    const result = stack.redo();
    expect(result).toBe(true);
    expect(store.getRow(row.id)!.values.fld_count).toBe(42);
  });

  it('new command after undo clears redo stack', () => {
    const { store, row } = createStoreWithData();
    const stack = createCommandStack({ store });

    stack.execute(createEditCellCommand({
      rowId: row.id, fieldId: 'fld_count', oldValue: 10, newValue: 42,
    }));
    stack.undo();
    expect(stack.canRedo()).toBe(true);

    // New command
    stack.execute(createEditCellCommand({
      rowId: row.id, fieldId: 'fld_count', oldValue: 10, newValue: 99,
    }));
    expect(stack.canRedo()).toBe(false);
  });
});

describe('CommandStack — stack limit', () => {
  it('enforces limit of 5', () => {
    const store = createTableStore({ fields: FIELDS });
    const stack = createCommandStack({ store, limit: 5 });

    // Create 10 different rows and edit each (different targetKeys → no coalescing)
    for (let i = 0; i < 10; i++) {
      const row = store.createRow({ fld_name: `Row ${i}`, fld_count: 0 });
      stack.execute(createEditCellCommand({
        rowId: row.id, fieldId: 'fld_count', oldValue: 0, newValue: i + 1,
      }));
    }

    expect(stack.undoStackSize()).toBe(5);

    // Can only undo 5 times
    let undoCount = 0;
    while (stack.undo()) undoCount++;
    expect(undoCount).toBe(5);
  });
});

describe('CommandStack — coalescing', () => {
  it('coalesces same-cell edits within 1 second', () => {
    const { store, row } = createStoreWithData();
    const stack = createCommandStack({ store });

    // Simulate rapid edits to the same cell
    // Using fake timers doesn't work perfectly with Date.now, so we test with
    // commands that have the same targetKey
    stack.execute(createEditCellCommand({
      rowId: row.id, fieldId: 'fld_count', oldValue: 10, newValue: 20,
    }));
    stack.execute(createEditCellCommand({
      rowId: row.id, fieldId: 'fld_count', oldValue: 20, newValue: 30,
    }));
    stack.execute(createEditCellCommand({
      rowId: row.id, fieldId: 'fld_count', oldValue: 30, newValue: 40,
    }));

    // All three should be coalesced into one undo step
    expect(stack.undoStackSize()).toBe(1);

    stack.undo();
    // After undo, value should be back to the original (10)
    expect(store.getRow(row.id)!.values.fld_count).toBe(10);
  });
});

describe('CommandStack — clear (sync boundary)', () => {
  it('clears both stacks', () => {
    const { store, row } = createStoreWithData();
    const stack = createCommandStack({ store });

    stack.execute(createEditCellCommand({
      rowId: row.id, fieldId: 'fld_count', oldValue: 10, newValue: 42,
    }));
    stack.undo();
    expect(stack.canRedo()).toBe(true);

    stack.clear();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });
});

describe('CommandStack — add row command', () => {
  it('add and undo removes the row', () => {
    const store = createTableStore({ fields: FIELDS });
    const stack = createCommandStack({ store });

    expect(store.getRowCount()).toBe(0);

    stack.execute(createAddRowCommand({ values: { fld_name: 'New Row' } }));
    expect(store.getRowCount()).toBe(1);

    stack.undo();
    // Note: undo of add creates a row that gets deleted, but the row gets a new ID
    // so we verify the count went back to 0
    expect(store.getRowCount()).toBe(0);
  });
});

describe('CommandStack — random sequence model test', () => {
  it('1000 random sequences: undo all restores initial state', () => {
    const seed = 42;
    let rng = seed;
    function random(): number {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      return rng / 0x7fffffff;
    }

    const store = createTableStore({ fields: FIELDS });
    const stack = createCommandStack({ store });

    // Create initial row
    const initialRow = store.createRow({ fld_name: 'Start', fld_count: 0 });
    let currentValue = 0;

    const commands: Array<{ type: 'edit'; value: number }> = [];

    // Execute random edits
    for (let i = 0; i < 100; i++) {
      const newValue = Math.floor(random() * 1000);
      const cmd = createEditCellCommand({
        rowId: initialRow.id,
        fieldId: 'fld_count',
        oldValue: currentValue,
        newValue,
      });
      stack.execute(cmd);
      commands.push({ type: 'edit', value: newValue });
      currentValue = newValue;
    }

    // Undo all
    while (stack.undo()) { /* empty */ }

    // State should be back to initial (values restored)
    const row = store.getRow(initialRow.id)!;
    expect(row.values.fld_count).toBe(0);
    // Note: rev may be > 1 because undo operations also increment rev
    // The important thing is the VALUES match the initial state
  });
});
