/**
 * @vitest-environment jsdom
 *
 * COD-68 — the date_time editor must show the stored timestamp, and merely opening a cell must
 * never change its value.
 *
 * Before this fix `createEditor` handed `date_time` an `<input type="date">` while
 * `dateTimeType.format()` returns a full ISO string. A `type=date` input rejects that string, so
 * the editor rendered empty and the blur-commit then wrote `null` over the stored value.
 *
 * The same "open and dismiss must be a no-op" rule is asserted for the checkbox, which used to
 * turn an unset (`null`) cell into an explicit `false` on blur (F5 in the verification report).
 */

import { describe, it, expect, vi } from 'vitest';
import { createTableStore } from '../../../src/model/tableStore.js';
import { createCommandStack } from '../../../src/model/commands.js';
import { createEditor } from '../../../src/views/grid/editors/index.js';
import type { FieldDefinition } from '../../../src/model/types.js';

function field(overrides: Partial<FieldDefinition> & { type: FieldDefinition['type'] }): FieldDefinition {
  return {
    id: `fld_${overrides.type}_${Math.random().toString(36).slice(2, 6)}`,
    name: overrides.name ?? overrides.type,
    type: overrides.type,
    ...(overrides.options ? { options: overrides.options } : {}),
  } as FieldDefinition;
}

/** Non-null helper (same contract as tests/views/editTriggers.test.ts). */
function need<T>(v: T | null | undefined, label: string): T {
  expect(v, label).not.toBeNull();
  if (v === null || v === undefined) throw new Error(`missing: ${label}`);
  return v;
}

/** A store with one row holding `value` for `f`. */
function setup(f: FieldDefinition, value: unknown) {
  const store = createTableStore({
    fields: [f],
    initialRows: [{ id: 'row_1', rev: 1, values: value === undefined ? {} : { [f.id]: value as never } }],
  });
  const stack = createCommandStack({ store });
  return { store, stack, row: need(store.getRow('row_1'), 'row') };
}

const enter = (el: HTMLElement) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
const blur = (el: HTMLElement) => el.dispatchEvent(new FocusEvent('blur'));

describe('COD-68 — date_time editor', () => {
  it('shows the stored timestamp instead of an empty field', () => {
    const f = field({ type: 'date_time', name: 'Review At' });
    f.id = 'fld_dt';
    const iso = '2026-10-16T09:30:00.000Z';
    const { store, stack, row } = setup(f, iso);

    const el = createEditor(f, row, store, stack, vi.fn()) as HTMLInputElement;

    expect(el).not.toBeNull();
    expect(el.getAttribute('type'), 'a date-only input cannot hold a time').toBe('datetime-local');
    expect(el.value, 'the editor must not render empty').not.toBe('');
    expect(el.value, 'datetime-local value shape').toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/);
    expect(new Date(el.value).getTime(), 'same instant as the stored value').toBe(Date.parse(iso));
  });

  it('opening and dismissing without an edit leaves the stored value untouched', () => {
    const f = field({ type: 'date_time', name: 'Review At' });
    f.id = 'fld_dt';
    const iso = '2026-10-16T09:30:00.000Z';
    const { store, stack, row } = setup(f, iso);
    const execute = vi.spyOn(stack, 'execute');
    const onDone = vi.fn();

    const el = need(createEditor(f, row, store, stack, onDone), 'editor');
    blur(el);

    expect(execute, 'no write when nothing changed').not.toHaveBeenCalled();
    expect(onDone, 'reported as not committed').toHaveBeenCalledWith(false);
    expect(need(store.getRow('row_1'), 'row').values['fld_dt'], 'value survives open + dismiss').toBe(iso);
  });

  it('opening and pressing Enter without an edit leaves the stored value untouched', () => {
    const f = field({ type: 'date_time', name: 'Review At' });
    f.id = 'fld_dt';
    const iso = '2026-10-16T09:30:00.000Z';
    const { store, stack, row } = setup(f, iso);
    const execute = vi.spyOn(stack, 'execute');

    enter(need(createEditor(f, row, store, stack, vi.fn()), 'editor'));

    expect(execute).not.toHaveBeenCalled();
    expect(need(store.getRow('row_1'), 'row').values['fld_dt']).toBe(iso);
  });

  it('an edited timestamp is stored as ISO 8601 UTC', () => {
    const f = field({ type: 'date_time', name: 'Review At' });
    f.id = 'fld_dt';
    const { store, stack, row } = setup(f, '2026-10-16T09:30:00.000Z');

    const el = createEditor(f, row, store, stack, vi.fn()) as HTMLInputElement;
    el.value = '2026-12-24T18:45:00';
    enter(el);

    const stored = need(store.getRow('row_1'), 'row').values['fld_dt'] as string;
    expect(stored, 'file format stays ISO UTC').toBe(new Date('2026-12-24T18:45:00').toISOString());
    expect(stored.endsWith('Z')).toBe(true);
  });

  it('a value carrying milliseconds keeps them when the cell is only opened', () => {
    const f = field({ type: 'date_time', name: 'Review At' });
    f.id = 'fld_dt';
    const iso = '2026-10-16T09:30:00.123Z';
    const { store, stack, row } = setup(f, iso);
    const execute = vi.spyOn(stack, 'execute');

    const el = need(createEditor(f, row, store, stack, vi.fn()), 'editor');
    blur(el);

    expect(execute).not.toHaveBeenCalled();
    expect(need(store.getRow('row_1'), 'row').values['fld_dt']).toBe(iso);
  });
});

describe('COD-68 — date editor is unchanged', () => {
  it('still uses a date-only input and keeps its value', () => {
    const f = field({ type: 'date', name: 'Due' });
    f.id = 'fld_date';
    const { store, stack, row } = setup(f, '2026-10-16');

    const el = createEditor(f, row, store, stack, vi.fn()) as HTMLInputElement;
    expect(el.getAttribute('type')).toBe('date');
    expect(el.value).toBe('2026-10-16');

    const execute = vi.spyOn(stack, 'execute');
    blur(el);
    expect(execute).not.toHaveBeenCalled();
    expect(need(store.getRow('row_1'), 'row').values['fld_date']).toBe('2026-10-16');
  });

  it('commits a changed date', () => {
    const f = field({ type: 'date', name: 'Due' });
    f.id = 'fld_date';
    const { store, stack, row } = setup(f, '2026-10-16');

    const el = createEditor(f, row, store, stack, vi.fn()) as HTMLInputElement;
    el.value = '2026-11-01';
    enter(el);
    expect(need(store.getRow('row_1'), 'row').values['fld_date']).toBe('2026-11-01');
  });
});

describe('COD-68 — checkbox keeps "never set" distinct from "unchecked"', () => {
  it('opening an unset checkbox and dismissing it leaves null', () => {
    const f = field({ type: 'checkbox', name: 'Done' });
    f.id = 'fld_check';
    const { store, stack, row } = setup(f, undefined);
    const execute = vi.spyOn(stack, 'execute');

    const el = need(createEditor(f, row, store, stack, vi.fn()), 'editor');
    blur(el);

    expect(execute, 'no write for an untouched checkbox').not.toHaveBeenCalled();
    expect(need(store.getRow('row_1'), 'row').values['fld_check'], 'still unset').toBeUndefined();
  });

  it('opening a set checkbox and dismissing it keeps true', () => {
    const f = field({ type: 'checkbox', name: 'Done' });
    f.id = 'fld_check';
    const { store, stack, row } = setup(f, true);
    const execute = vi.spyOn(stack, 'execute');

    blur(need(createEditor(f, row, store, stack, vi.fn()), 'editor'));

    expect(execute).not.toHaveBeenCalled();
    expect(need(store.getRow('row_1'), 'row').values['fld_check']).toBe(true);
  });

  it('toggling still commits', () => {
    const f = field({ type: 'checkbox', name: 'Done' });
    f.id = 'fld_check';
    const { store, stack, row } = setup(f, false);

    const el = createEditor(f, row, store, stack, vi.fn()) as unknown as HTMLInputElement;
    el.checked = true;
    enter(el);

    expect(need(store.getRow('row_1'), 'row').values['fld_check']).toBe(true);
  });
});
