/**
 * Add Field — SAD-70, Step 4 of the SAD-69 plan.
 *
 * Tablify had no way to add a field at all, so this is new model functionality rather than
 * bug wiring. The prototype's Add Field button needs it.
 *
 * The subtle part is undo. Serialize copies `row.values` through unchanged, so removing a
 * field definition without also stripping its values would leave orphan keys in the saved
 * .tablify file. And the row revisions must not move, because undo has to restore the
 * prior state exactly rather than look like a fresh edit.
 */

import { describe, it, expect } from 'vitest';
import { createTableStore } from '../../src/model/tableStore.js';
import { createCommandStack, createAddFieldCommand } from '../../src/model/commands.js';
import { createSession } from '../../src/model/tableSession.js';
import { makeFile } from '../io/export.fixtures.js';
import { parse } from '../../src/format/parse.js';
import { serialize } from '../../src/format/serialize.js';
import type { FieldDefinition, Row, ViewDefinition } from '../../src/model/types.js';

const BASE_FIELDS: FieldDefinition[] = [{ id: 'fld_a', name: 'A', type: 'text', primary: true }];

function mkRow(): Row {
  return {
    id: 'row_1',
    rev: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    values: { fld_a: 'x' },
    sync: null,
  };
}

function mkStore() {
  return createTableStore({ fields: [...BASE_FIELDS], initialRows: [mkRow()] });
}

function mkView(): ViewDefinition {
  return {
    id: 'view_1',
    name: 'Default',
    sort: [],
    groupBy: null,
    hidden: [],
    frozenColumns: 1,
    rowHeight: 'medium',
    columnWidths: {},
    columnOrder: ['fld_a'],
    warnings: [],
  };
}

const NEW_FIELD: FieldDefinition = { id: 'fld_b', name: 'B', type: 'number' };

describe('tableStore — addField', () => {
  it('appends the definition', () => {
    const store = mkStore();
    store.addField(NEW_FIELD);
    expect(store.getFields()).toHaveLength(2);
    expect(store.getFields()[1].id).toBe('fld_b');
    expect(store.getFields()[1].type).toBe('number');
  });

  it('defensively copies the definition, so later edits do not leak in', () => {
    const store = mkStore();
    const field: FieldDefinition = { id: 'fld_c', name: 'C', type: 'text' };
    store.addField(field);
    field.name = 'mutated';
    expect(store.getFields()[1].name).toBe('C');
  });

  it('rejects a duplicate field id', () => {
    const store = mkStore();
    store.addField(NEW_FIELD);
    expect(() => store.addField(NEW_FIELD)).toThrow();
  });
});

describe('tableStore — removeField', () => {
  it('drops the definition and every value stored for it', () => {
    const store = mkStore();
    store.addField(NEW_FIELD);
    store.updateRow('row_1', { fld_b: 42 });
    expect(store.getRow('row_1')?.values.fld_b).toBe(42);

    store.removeField('fld_b');
    expect(store.getFields()).toHaveLength(1);
    // Orphan values would otherwise be written straight into the file.
    expect('fld_b' in (store.getRow('row_1')?.values ?? {})).toBe(false);
  });

  it('does not bump row revisions — undo must not look like a fresh edit', () => {
    const store = mkStore();
    store.addField(NEW_FIELD);
    store.updateRow('row_1', { fld_b: 42 });
    const revAfterEdit = store.getRow('row_1')?.rev;
    store.removeField('fld_b');
    expect(store.getRow('row_1')?.rev).toBe(revAfterEdit);
  });

  it('throws for an unknown field id', () => {
    const store = mkStore();
    expect(() => store.removeField('fld_nope')).toThrow();
  });
});

describe('createAddFieldCommand', () => {
  it('adds the field and updates the view, and reverses both on undo', () => {
    const store = mkStore();
    let current = mkView();
    const applyView = (v: ViewDefinition) => {
      current = v;
    };
    const stack = createCommandStack({ store });

    stack.execute(
      createAddFieldCommand({
        field: NEW_FIELD,
        applyView,
        viewBefore: current,
        viewAfter: { ...current, columnOrder: [...current.columnOrder, 'fld_b'] },
      }),
    );

    expect(store.getFields()).toHaveLength(2);
    expect(current.columnOrder).toEqual(['fld_a', 'fld_b']);

    expect(stack.undo()).toBe(true);
    expect(store.getFields()).toHaveLength(1);
    // Field and layout move together — a stale columnOrder would persist into the file.
    expect(current.columnOrder).toEqual(['fld_a']);

    expect(stack.redo()).toBe(true);
    expect(store.getFields()).toHaveLength(2);
    expect(current.columnOrder).toEqual(['fld_a', 'fld_b']);
  });
});

describe('tableSession — addField', () => {
  it('generates a field id and adds the definition', () => {
    const s = createSession(makeFile(3));
    const before = s.getFields().length;
    const field = s.addField('Score', 'number');
    expect(field.id).toMatch(/^fld_/);
    expect(field.name).toBe('Score');
    expect(field.type).toBe('number');
    expect(s.getFields()).toHaveLength(before + 1);
    expect(s.getField(field.id)?.name).toBe('Score');
  });

  it('never marks the new field primary', () => {
    const s = createSession(makeFile(3));
    const field = s.addField('Extra', 'text');
    expect(field.primary).toBeFalsy();
  });

  it('appends the new field to columnOrder so it is visible immediately', () => {
    const s = createSession(makeFile(3));
    const field = s.addField('Score', 'number');
    expect(s.getView().columnOrder[s.getView().columnOrder.length - 1]).toBe(field.id);
    expect(s.getVisibleFields().map((f) => f.id)).toContain(field.id);
  });

  it('is a single undo step covering both the field and the column order', () => {
    const s = createSession(makeFile(3));
    const orderBefore = [...s.getView().columnOrder];
    const countBefore = s.getFields().length;
    s.addField('Score', 'number');

    expect(s.undo()).toBe(true);
    expect(s.getFields()).toHaveLength(countBefore);
    expect(s.getView().columnOrder).toEqual(orderBefore);
  });

  it('redo re-adds the field', () => {
    const s = createSession(makeFile(3));
    const field = s.addField('Score', 'number');
    s.undo();
    expect(s.getField(field.id)).toBeUndefined();
    expect(s.redo()).toBe(true);
    expect(s.getField(field.id)?.name).toBe('Score');
    expect(s.getView().columnOrder).toContain(field.id);
  });

  it('leaves existing rows untouched', () => {
    const s = createSession(makeFile(5));
    const before = s.store.getAllRows().map((r) => ({ id: r.id, rev: r.rev }));
    s.addField('Score', 'number');
    expect(s.store.getAllRows().map((r) => ({ id: r.id, rev: r.rev }))).toEqual(before);
  });

  it('survives a toFile → serialize → parse round-trip', () => {
    const s = createSession(makeFile(3));
    const field = s.addField('Score', 'number');
    const parsed = parse(serialize(s.toFile()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.fields.some((f) => f.id === field.id && f.name === 'Score')).toBe(true);
    expect(parsed.data.views[0].columnOrder).toContain(field.id);
  });
});
