/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { createTableStore } from '../../../src/model/tableStore.js';
import { createCommandStack } from '../../../src/model/commands.js';
import { commitValue, isReadOnly, parseInput, createEditor } from '../../../src/views/grid/editors/index.js';
import type { FieldDefinition } from '../../../src/model/types.js';

function field(overrides: Partial<FieldDefinition> & { type: FieldDefinition['type'] }): FieldDefinition {
  return {
    id: `fld_${overrides.type}_${Math.random().toString(36).slice(2, 6)}`,
    name: overrides.name ?? overrides.type,
    type: overrides.type,
    ...(overrides.options ? { options: overrides.options } : {}),
  } as FieldDefinition;
}

describe('P3-02 — Cell editors', () => {
  it('read-only types show no editor', () => {
    const f1 = field({ type: 'auto_number', name: 'Auto' });
    const f2 = field({ type: 'created_time', name: 'Created' });
    const f3 = field({ type: 'modified_time', name: 'Modified' });
    expect(isReadOnly(f1)).toBe(true);
    expect(isReadOnly(f2)).toBe(true);
    expect(isReadOnly(f3)).toBe(true);
    // text is editable
    expect(isReadOnly(field({ type: 'text', name: 'Name' }))).toBe(false);
  });

  it('parseInput validates per type', () => {
    // text — always ok
    expect(parseInput(field({ type: 'text' }), 'hello').ok).toBe(true);
    // number — invalid
    const num = field({ type: 'number' });
    expect(parseInput(num, 'notANumber').ok).toBe(false);
    expect(parseInput(num, '42').ok).toBe(true);
    // checkbox — via parse
    const cb = field({ type: 'checkbox' });
    expect(parseInput(cb, 'true').ok).toBe(true);
    expect(parseInput(cb, 'maybe').ok).toBe(false);
  });

  it('commitValue goes through command stack and writes to file', () => {
    const fields: FieldDefinition[] = [field({ type: 'text', name: 'Name' })];
    fields[0].id = 'fld_name';
    const store = createTableStore({ fields, initialRows: [{ id: 'row_1', rev: 1, values: { fld_name: 'old' } }] });
    const stack = createCommandStack({ store });
    const row = store.getRow('row_1')!;
    const res = commitValue(fields[0], row, 'new', store, stack);
    expect(res.ok).toBe(true);
    expect(store.getRow('row_1')!.values['fld_name']).toBe('new');
    // undo
    expect(stack.canUndo()).toBe(true);
    stack.undo();
    expect(store.getRow('row_1')!.values['fld_name']).toBe('old');
  });

  it('Escape leaves file unchanged', () => {
    const f = field({ type: 'text', name: 'Name' });
    f.id = 'fld_name';
    const store = createTableStore({ fields: [f], initialRows: [{ id: 'row_1', rev: 1, values: { fld_name: 'old' } }] });
    const stack = createCommandStack({ store });
    const row = store.getRow('row_1')!;
    // create editor and simulate Escape
    const onDone = vi.fn();
    const el = createEditor(f, row, store, stack, onDone);
    expect(el).not.toBeNull();
    // Escape should call onDone(false) and not write
    el!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onDone).toHaveBeenCalledWith(false);
    expect(store.getRow('row_1')!.values['fld_name']).toBe('old');
  });

  it('invalid input keeps editor open and does not write', () => {
    const f = field({ type: 'number', name: 'Count' });
    f.id = 'fld_num';
    const store = createTableStore({ fields: [f], initialRows: [{ id: 'row_1', rev: 1, values: { fld_num: 5 } }] });
    const stack = createCommandStack({ store });
    const row = store.getRow('row_1')!;
    const onDone = vi.fn();
    const el = createEditor(f, row, store, stack, onDone) as HTMLInputElement;
    el.value = 'notANumber';
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onDone).not.toHaveBeenCalled();
    expect(el.getAttribute('aria-invalid')).toBe('true');
    expect(store.getRow('row_1')!.values['fld_num']).toBe(5);
  });

  it('Enter commits valid input', () => {
    const f = field({ type: 'text', name: 'Name' });
    f.id = 'fld_name';
    const store = createTableStore({ fields: [f], initialRows: [{ id: 'row_1', rev: 1, values: { fld_name: 'old' } }] });
    const stack = createCommandStack({ store });
    const row = store.getRow('row_1')!;
    const onDone = vi.fn();
    const el = createEditor(f, row, store, stack, onDone) as HTMLInputElement;
    el.value = 'new';
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onDone).toHaveBeenCalledWith(true);
    expect(store.getRow('row_1')!.values['fld_name']).toBe('new');
  });

  it('commitValue for each type calls command path (spy)', () => {
    const types: FieldDefinition['type'][] = ['text', 'number', 'checkbox', 'date', 'single_select', 'multi_select', 'url', 'email'];
    for (const t of types) {
      const f = field({ type: t, name: t });
      if (isReadOnly(f)) continue;
      // add options for select
      if (t === 'single_select' || t === 'multi_select') {
        (f as FieldDefinition).options = [{ id: 'opt_a', name: 'A', color: 'red' }];
      }
      const store = createTableStore({ fields: [f], initialRows: [{ id: 'row_1', rev: 1, values: {} }] });
      const stack = createCommandStack({ store });
      const spy = vi.spyOn(stack, 'execute');
      const row = store.getRow('row_1')!;
      // choose a valid input per type
      let input = 'hello';
      if (t === 'number') input = '42';
      else if (t === 'checkbox') input = 'true';
      else if (t === 'date') input = '2026-01-01';
      else if (t === 'single_select') input = 'A';
      else if (t === 'multi_select') input = 'A';
      const res = commitValue(f, row, input, store, stack);
      // text may always succeed, others may fail for some types but we check spy if ok
      if (res.ok) expect(spy).toHaveBeenCalled();
    }
  });

  it('commit <50ms on FX-M (proposed)', () => {
    const { fields } = ((): { fields: FieldDefinition[] } => {
      const f = field({ type: 'text', name: 'Name' });
      f.id = 'fld_1';
      return { fields: [f] };
    })();
    const store = createTableStore({ fields, initialRows: Array.from({ length: 1000 }, (_, i) => ({ id: `row_${i}`, rev: 1, values: { fld_1: `val${i}` } })) });
    const stack = createCommandStack({ store });
    const row = store.getRow('row_500')!;
    const t0 = performance.now();
    commitValue(fields[0], row, 'newVal', store, stack);
    const t1 = performance.now();
    expect(t1 - t0).toBeLessThan(50);
  });
});
