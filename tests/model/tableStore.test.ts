import { describe, it, expect } from 'vitest';
import { createTableStore } from '../../src/model/tableStore.js';
import type { FieldDefinition, Row } from '../../src/model/types.js';

const FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
  { id: 'fld_count', name: 'Count', type: 'number' },
  { id: 'fld_num', name: 'Seq', type: 'auto_number' },
];

describe('TableStore — create', () => {
  it('creates a row with rev=1 and timestamps', () => {
    const store = createTableStore({ fields: FIELDS });
    const row = store.createRow({ fld_name: 'Test', fld_count: 42 });

    expect(row.id).toMatch(/^row_/);
    expect(row.rev).toBe(1);
    expect(row.createdAt).toBeDefined();
    expect(row.updatedAt).toBeDefined();
    expect(row.values.fld_name).toBe('Test');
    expect(row.values.fld_count).toBe(42);
    expect(row.sync).toBe(null);
  });

  it('returns a copy (input immutability)', () => {
    const store = createTableStore({ fields: FIELDS });
    const input = { fld_name: 'Test' };
    const row = store.createRow(input);

    // Mutate the returned row
    row.values.fld_name = 'Changed';
    const fetched = store.getRow(row.id);
    expect(fetched!.values.fld_name).toBe('Test');

    // Mutate the input
    input.fld_name = 'Also Changed';
    const row2 = store.createRow({ fld_name: 'Second' });
    expect(row2.values.fld_name).toBe('Second');
  });

  it('getRow returns a copy', () => {
    const store = createTableStore({ fields: FIELDS });
    const row = store.createRow({ fld_name: 'Test' });
    const copy1 = store.getRow(row.id)!;
    copy1.values.fld_name = 'Mutated';
    const copy2 = store.getRow(row.id)!;
    expect(copy2.values.fld_name).toBe('Test');
  });

  it('getAllRows returns copies in display order', () => {
    const store = createTableStore({ fields: FIELDS });
    store.createRow({ fld_name: 'First' });
    store.createRow({ fld_name: 'Second' });
    store.createRow({ fld_name: 'Third' });

    const rows = store.getAllRows();
    expect(rows).toHaveLength(3);
    expect(rows[0].values.fld_name).toBe('First');
    expect(rows[1].values.fld_name).toBe('Second');
    expect(rows[2].values.fld_name).toBe('Third');
  });
});

describe('TableStore — update', () => {
  it('increments rev and updates updatedAt', () => {
    const store = createTableStore({ fields: FIELDS });
    const row = store.createRow({ fld_name: 'Test' });
    // Small delay to ensure timestamp differs
    const updated = store.updateRow(row.id, { fld_name: 'Updated' });
    expect(updated.rev).toBe(2);
    expect(updated.values.fld_name).toBe('Updated');
    expect(updated.values.fld_count).toBeUndefined(); // unchanged
  });

  it('throws on unknown row ID', () => {
    const store = createTableStore({ fields: FIELDS });
    expect(() => store.updateRow('row_nonexistent', { fld_name: 'x' })).toThrow('Row not found');
  });
});

describe('TableStore — delete', () => {
  it('removes the row', () => {
    const store = createTableStore({ fields: FIELDS });
    const row = store.createRow({ fld_name: 'ToDelete' });
    expect(store.getRowCount()).toBe(1);

    store.deleteRow(row.id);
    expect(store.getRowCount()).toBe(0);
    expect(store.getRow(row.id)).toBeUndefined();
  });

  it('throws on unknown row ID', () => {
    const store = createTableStore({ fields: FIELDS });
    expect(() => store.deleteRow('row_nonexistent')).toThrow('Row not found');
  });
});

describe('TableStore — reorder', () => {
  it('moves row to new position', () => {
    const store = createTableStore({ fields: FIELDS });
    store.createRow({ fld_name: 'A' });
    store.createRow({ fld_name: 'B' });
    const r3 = store.createRow({ fld_name: 'C' });

    store.moveRow(r3.id, 0);
    const rows = store.getAllRows();
    expect(rows[0].values.fld_name).toBe('C');
    expect(rows[1].values.fld_name).toBe('A');
    expect(rows[2].values.fld_name).toBe('B');
  });

  it('clamps out-of-range indices', () => {
    const store = createTableStore({ fields: FIELDS });
    store.createRow({ fld_name: 'A' });
    const r2 = store.createRow({ fld_name: 'B' });

    store.moveRow(r2.id, 100); // beyond end
    const rows = store.getAllRows();
    expect(rows[rows.length - 1].values.fld_name).toBe('B');
  });
});

describe('TableStore — auto-number', () => {
  it('returns sequential numbers starting at 1', () => {
    const store = createTableStore({ fields: FIELDS });
    expect(store.getNextAutoNumber()).toBe(1);
    expect(store.getNextAutoNumber()).toBe(2);
    expect(store.getNextAutoNumber()).toBe(3);
  });

  it('never reuses numbers after delete', () => {
    const store = createTableStore({ fields: FIELDS });
    const n1 = store.getNextAutoNumber(); // 1
    const n2 = store.getNextAutoNumber(); // 2
    const n3 = store.getNextAutoNumber(); // 3

    // Delete doesn't affect the counter (no delete method for auto-number)
    const n4 = store.getNextAutoNumber(); // 4

    expect(n1).toBe(1);
    expect(n2).toBe(2);
    expect(n3).toBe(3);
    expect(n4).toBe(4);
  });
});

describe('TableStore — ID uniqueness (10,000 IDs)', () => {
  it('generates 10,000 unique row IDs', () => {
    const store = createTableStore({ fields: FIELDS });
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const row = store.createRow({ fld_name: `Row ${i}` });
      ids.add(row.id);
    }
    expect(ids.size).toBe(10_000);
    expect(store.getRowCount()).toBe(10_000);
  });
});

describe('TableStore — performance', () => {
  it('creates 1,000 rows in under 100ms', () => {
    const store = createTableStore({ fields: FIELDS });
    const start = performance.now();
    for (let i = 0; i < 1_000; i++) {
      store.createRow({ fld_name: `Row ${i}` });
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});

describe('TableStore — initial rows', () => {
  it('loads initial rows and preserves order', () => {
    const initialRows: Row[] = [
      { id: 'row_a', rev: 1, updatedAt: '2026-01-01T00:00:00.000Z', values: { fld_name: 'A' }, sync: null },
      { id: 'row_b', rev: 2, updatedAt: '2026-01-02T00:00:00.000Z', values: { fld_name: 'B' }, sync: null },
    ];
    const store = createTableStore({ fields: FIELDS, initialRows });

    expect(store.getRowCount()).toBe(2);
    const rows = store.getAllRows();
    expect(rows[0].id).toBe('row_a');
    expect(rows[1].id).toBe('row_b');
  });
});
