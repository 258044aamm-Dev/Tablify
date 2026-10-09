/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { SelectDropdown } from '../../../src/views/grid/select/Dropdown.js';
import { OptionManagerDialog } from '../../../src/views/grid/select/OptionManager.js';
import { createTableStore } from '../../../src/model/tableStore.js';
import type { FieldDefinition } from '../../../src/model/types.js';

function makeField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    id: 'fld_sel',
    name: 'Status',
    type: 'single_select',
    options: [
      { id: 'opt_todo', name: 'Todo', color: 'red' },
      { id: 'opt_done', name: 'Done', color: 'green' },
    ],
    ...overrides,
  } as FieldDefinition;
}

describe('P3-03 — Select dropdown and option manager', () => {
  it('create-on-type creates exactly one option when typed twice with different case', () => {
    const field = makeField();
    const initialCount = field.options!.length;
    const created: string[] = [];
    const dropdown = new SelectDropdown({
      field,
      onSelect: () => {},
      onCreate: (opt) => created.push(opt.id),
    });
    document.body.appendChild(dropdown.element);
    const input = dropdown.element.querySelector('input') as HTMLInputElement;

    // type "NewOpt" first time
    input.value = 'NewOpt';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(dropdown.hasCreateOption()).toBe(true);
    // click create
    (dropdown.element.querySelector('.tablify__dropdown-create') as HTMLElement).click();
    expect(field.options!.length).toBe(initialCount + 1);
    const firstId = created[0];

    // type "newopt" different case — should match existing, not create second
    input.value = 'newopt';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(dropdown.hasCreateOption()).toBe(false); // filtered shows existing
    expect(dropdown.getVisibleOptionNames()).toContain('NewOpt');
    // try to create again via Enter — should select existing, not create
    input.value = 'newopt';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(field.options!.length).toBe(initialCount + 1); // still one
    expect(created.length).toBe(1);
    expect(created[0]).toBe(firstId);
    dropdown.close();
    document.body.innerHTML = '';
  });

  it('rename and recolor persist after reopen', () => {
    const field = makeField();
    const store = createTableStore({ fields: [field], initialRows: [] });
    const dlg = new OptionManagerDialog(field, store);
    dlg.rename('opt_todo', 'In Progress');
    dlg.recolor('opt_todo', 'blue');
    // simulate reopen: create new dialog with same field reference (field is mutated, so persists)
    const dlg2 = new OptionManagerDialog(field, store);
    const opts = dlg2.getOptions();
    const renamed = opts.find((o) => o.id === 'opt_todo')!;
    expect(renamed.name).toBe('In Progress');
    expect(renamed.color).toBe('blue');
  });

  it('delete confirmation shows number of affected cells', () => {
    const field = makeField();
    const store = createTableStore({
      fields: [field],
      initialRows: [
        { id: 'row_1', rev: 1, values: { fld_sel: 'opt_todo' } },
        { id: 'row_2', rev: 1, values: { fld_sel: 'opt_done' } },
        { id: 'row_3', rev: 1, values: { fld_sel: 'opt_todo' } },
      ],
    });
    const dlg = new OptionManagerDialog(field, store);
    const count = dlg.getDeleteAffectedCount('opt_todo');
    expect(count).toBe(2);
    const res = dlg.confirmDelete('opt_todo');
    expect(res.affected).toBe(2);
    // cells cleared (R-D12)
    expect(store.getRow('row_1')!.values['fld_sel']).toBeNull();
    expect(store.getRow('row_3')!.values['fld_sel']).toBeNull();
  });

  it('IME composition does not commit prematurely', () => {
    const field = makeField();
    const dlg = new SelectDropdown({ field, onSelect: () => {}, onCreate: () => {} });
    document.body.appendChild(dlg.element);
    const input = dlg.element.querySelector('input') as HTMLInputElement;
    // start composition (e.g., Japanese)
    input.value = 'か';
    input.dispatchEvent(new Event('compositionstart', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // during composition, list should not update to create? our code guards with isComposing
    // we just check that Enter during composition does not commit
    let created = false;
    const dlg2 = new SelectDropdown({
      field,
      onSelect: () => {},
      onCreate: () => (created = true),
    });
    document.body.appendChild(dlg2.element);
    const inp2 = dlg2.element.querySelector('input') as HTMLInputElement;
    inp2.value = 'NewIme';
    inp2.dispatchEvent(new Event('compositionstart', { bubbles: true }));
    inp2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(created).toBe(false);
    // compositionend then Enter should work
    inp2.dispatchEvent(new Event('compositionend', { bubbles: true }));
    inp2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(created).toBe(true);
    dlg.close();
    dlg2.close();
    document.body.innerHTML = '';
  });

  it('dropdown opens <100ms with 200 options (proposed)', () => {
    const field = makeField({
      options: Array.from({ length: 200 }, (_, i) => ({ id: `opt_${i}`, name: `Option ${i}`, color: 'red' as const })),
    });
    const t0 = performance.now();
    const d = new SelectDropdown({ field, onSelect: () => {}, onCreate: () => {} });
    const t1 = performance.now();
    expect(t1 - t0).toBeLessThan(100);
    d.close();
  });
});
