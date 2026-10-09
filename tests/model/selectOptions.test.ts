import { describe, it, expect } from 'vitest';
import { createSelectOptionManager } from '../../src/model/selectOptions.js';
import { createTableStore } from '../../src/model/tableStore.js';
import { createCommandStack } from '../../src/model/commands.js';
import type { FieldDefinition } from '../../src/model/types.js';

function makeSelectField(overrides?: Partial<FieldDefinition>): FieldDefinition {
  return {
    id: 'fld_status',
    name: 'Status',
    type: 'single_select',
    options: [
      { id: 'opt_todo', name: 'To do', color: 'gray' },
      { id: 'opt_done', name: 'Done', color: 'green' },
    ],
    ...overrides,
  };
}

describe('SelectOptionManager — findOrCreate', () => {
  it('returns existing option on case-insensitive match', () => {
    const mgr = createSelectOptionManager();
    const field = makeSelectField();

    const opt = mgr.findOrCreate('TO DO', field);
    expect(opt.id).toBe('opt_todo');
    expect(opt.name).toBe('To do');
  });

  it('returns existing option with trimmed match', () => {
    const mgr = createSelectOptionManager();
    const field = makeSelectField();

    const opt = mgr.findOrCreate('  done  ', field);
    expect(opt.id).toBe('opt_done');
  });

  it('creates new option for unknown name', () => {
    const mgr = createSelectOptionManager();
    const field = makeSelectField();

    const opt = mgr.findOrCreate('In progress', field);
    expect(opt.name).toBe('In progress');
    expect(opt.id).toMatch(/^opt_/);
    expect(opt.color).toBeDefined();
    expect(field.options).toHaveLength(3);
  });

  it('throws on empty name', () => {
    const mgr = createSelectOptionManager();
    const field = makeSelectField();

    expect(() => mgr.findOrCreate('  ', field)).toThrow('empty');
  });
});

describe('SelectOptionManager — rename', () => {
  it('changes name but keeps ID', () => {
    const mgr = createSelectOptionManager();
    const field = makeSelectField();

    const updated = mgr.rename('opt_todo', 'Todo', field);
    expect(updated.id).toBe('opt_todo');
    expect(updated.name).toBe('Todo');
  });

  it('keeps cell references valid after rename', () => {
    const mgr = createSelectOptionManager();
    const field = makeSelectField();
    const store = createTableStore({ fields: [field] });
    const row = store.createRow({ fld_status: 'opt_todo' });

    mgr.rename('opt_todo', 'TODO', field);

    const fetched = store.getRow(row.id)!;
    // Cell still references opt_todo, which still exists
    expect(fetched.values.fld_status).toBe('opt_todo');
    expect(field.options!.find(o => o.id === 'opt_todo')).toBeDefined();
  });

  it('throws on unknown option ID', () => {
    const mgr = createSelectOptionManager();
    const field = makeSelectField();

    expect(() => mgr.rename('opt_unknown', 'New Name', field)).toThrow('not found');
  });
});

describe('SelectOptionManager — reorder', () => {
  it('reorders options', () => {
    const mgr = createSelectOptionManager();
    const field = makeSelectField();

    mgr.findOrCreate('In progress', field); // adds opt_xxx
    const ids = field.options!.map(o => o.id);
    const reversed = [...ids].reverse();

    mgr.reorder(reversed, field);

    const newIds = field.options!.map(o => o.id);
    expect(newIds).toEqual(reversed);
  });
});

describe('SelectOptionManager — delete (R-D12)', () => {
  it('clears cells that reference the deleted option', () => {
    const mgr = createSelectOptionManager();
    const field = makeSelectField();
    const store = createTableStore({ fields: [field] });

    const row1 = store.createRow({ fld_status: 'opt_todo' });
    const row2 = store.createRow({ fld_status: 'opt_done' });
    const row3 = store.createRow({ fld_status: 'opt_todo' });

    const result = mgr.delete('opt_todo', field, store);

    // Row 1 and 3 had opt_todo → now null
    expect(store.getRow(row1.id)!.values.fld_status).toBe(null);
    expect(store.getRow(row2.id)!.values.fld_status).toBe('opt_done');
    expect(store.getRow(row3.id)!.values.fld_status).toBe(null);

    // Option removed from field
    expect(field.options).toHaveLength(1);
    expect(field.options![0].id).toBe('opt_done');

    // Affected cells recorded
    expect(result.affectedCells).toHaveLength(2);
  });

  it('handles multi_select delete', () => {
    const mgr = createSelectOptionManager();
    const field = makeSelectField({
      type: 'multi_select',
      options: [
        { id: 'opt_a', name: 'A', color: 'blue' },
        { id: 'opt_b', name: 'B', color: 'green' },
        { id: 'opt_c', name: 'C', color: 'red' },
      ],
    });
    const store = createTableStore({ fields: [field] });

    const row = store.createRow({ fld_status: ['opt_a', 'opt_b', 'opt_c'] });

    mgr.delete('opt_b', field, store);

    const values = store.getRow(row.id)!.values.fld_status;
    expect(values).toEqual(['opt_a', 'opt_c']);
  });

  it('sets multi_select to null when last option removed', () => {
    const mgr = createSelectOptionManager();
    const field = makeSelectField({
      type: 'multi_select',
      options: [
        { id: 'opt_a', name: 'A', color: 'blue' },
      ],
    });
    const store = createTableStore({ fields: [field] });
    const row = store.createRow({ fld_status: ['opt_a'] });

    mgr.delete('opt_a', field, store);

    expect(store.getRow(row.id)!.values.fld_status).toBe(null);
  });
});

describe('SelectOptionManager — delete with undo (R-D12)', () => {
  it('delete then undo restores every affected cell', () => {
    const mgr = createSelectOptionManager();
    const field = makeSelectField();
    const store = createTableStore({ fields: [field] });

    const row1 = store.createRow({ fld_status: 'opt_todo' });
    const row2 = store.createRow({ fld_status: 'opt_done' });
    const row3 = store.createRow({ fld_status: 'opt_todo' });

    const stack = createCommandStack({ store });
    const cmd = mgr.createDeleteCommand('opt_todo', field, store);
    stack.execute(cmd);

    // After delete: rows 1 and 3 are null
    expect(store.getRow(row1.id)!.values.fld_status).toBe(null);
    expect(store.getRow(row3.id)!.values.fld_status).toBe(null);

    // Undo: restore
    stack.undo();
    expect(store.getRow(row1.id)!.values.fld_status).toBe('opt_todo');
    expect(store.getRow(row2.id)!.values.fld_status).toBe('opt_done');
    expect(store.getRow(row3.id)!.values.fld_status).toBe('opt_todo');

    // Option restored
    expect(field.options!.find(o => o.id === 'opt_todo')).toBeDefined();
  });
});

describe('SelectOptionManager — color assignment', () => {
  it('rotates colors for new options', () => {
    const mgr = createSelectOptionManager();
    const field: FieldDefinition = {
      id: 'fld_tags',
      name: 'Tags',
      type: 'single_select',
      options: [],
    };

    const opt1 = mgr.findOrCreate('First', field);
    const opt2 = mgr.findOrCreate('Second', field);
    const opt3 = mgr.findOrCreate('Third', field);

    expect(opt1.color).toBe('gray');   // First color
    expect(opt2.color).toBe('brown');  // Second color
    expect(opt3.color).toBe('orange'); // Third color
  });
});
