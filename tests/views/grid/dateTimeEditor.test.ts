/**
 * @vitest-environment jsdom
 *
 * COD-68 — the date_time cell must show the stored timestamp, and merely opening a cell must
 * never change its value.
 *
 * COD-68 fixed this for the inline `<input type="datetime-local">`. COD-75 replaced that editor
 * with the date panel, so the same guarantees are re-asserted here against the thing that now
 * owns them: an untouched draft returns the stored value verbatim, and a commit through the
 * panel stores ISO 8601 UTC. Nothing about the bug is allowed to come back through a new door.
 *
 * The checkbox half of COD-68 (an unset `null` must not become `false`) still runs through the
 * inline editor, which is where checkboxes are edited.
 */

import { describe, it, expect, vi } from 'vitest';
import { createTableStore } from '../../../src/model/tableStore.js';
import { createCommandStack } from '../../../src/model/commands.js';
import { createEditor } from '../../../src/views/grid/editors/index.js';
import { DatePicker } from '../../../src/views/grid/date/DatePicker.js';
import type { CellValue, FieldDefinition } from '../../../src/model/types.js';

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

const blur = (el: HTMLElement) => el.dispatchEvent(new FocusEvent('blur'));

/** Open the date panel over a cell holding `value`; returns the commits it made. */
function openPanel(f: FieldDefinition, value: CellValue | undefined) {
  const commits: CellValue[] = [];
  const picker = new DatePicker({
    field: f,
    value,
    weekStart: 1,
    now: () => new Date(2026, 9, 17, 14, 30),
    onCommit: (v) => commits.push(v),
  });
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  picker.open(anchor);
  return { picker, commits, card: picker.element };
}

describe('COD-68 — the date_time cell keeps its value', () => {
  it('has no inline editor any more — the panel owns date_time', () => {
    const f = field({ type: 'date_time', name: 'Review At' });
    f.id = 'fld_dt';
    const { store, stack, row } = setup(f, '2026-10-16T09:30:00.000Z');
    expect(createEditor(f, row, store, stack, vi.fn())).toBeNull();
  });

  it('the panel shows the stored timestamp instead of an empty field', () => {
    const f = field({ type: 'date_time', name: 'Review At' });
    f.id = 'fld_dt';
    const iso = '2026-10-16T09:30:00.000Z';
    const { card } = openPanel(f, iso);
    const input = need(card.querySelector('input.tablify__date-input'), 'value field') as HTMLInputElement;
    expect(input.value).not.toBe('');
    expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const local = new Date(iso);
    expect(input.value).toContain(`${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`);
  });

  it('opening and dismissing without an edit returns the stored value untouched', () => {
    const f = field({ type: 'date_time', name: 'Review At' });
    f.id = 'fld_dt';
    const iso = '2026-10-16T09:30:00.000Z';
    const { commits } = openPanel(f, iso);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(commits).toEqual([iso]);
  });

  it('a value carrying milliseconds keeps them when the cell is only opened', () => {
    const f = field({ type: 'date_time', name: 'Review At' });
    f.id = 'fld_dt';
    const iso = '2026-10-16T09:30:00.123Z';
    const { commits } = openPanel(f, iso);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(commits, 'no lossy rewrite on open + dismiss').toEqual([iso]);
  });

  it('an edited timestamp is stored as ISO 8601 UTC', () => {
    const f = field({ type: 'date_time', name: 'Review At' });
    f.id = 'fld_dt';
    const { commits, card } = openPanel(f, '2026-10-16T09:30:00.000Z');
    const input = need(card.querySelector('input.tablify__date-input'), 'value field') as HTMLInputElement;
    input.value = '2026-12-24T18:45';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    (need(card.querySelector('.tablify__date-done'), 'Done') as HTMLElement).click();
    const stored = String(commits[0]);
    expect(stored, 'file format stays ISO UTC').toBe(new Date('2026-12-24T18:45').toISOString());
    expect(stored.endsWith('Z')).toBe(true);
  });
});

describe('COD-68 — date cells are unchanged in kind', () => {
  it('has no inline editor any more — the panel owns date too', () => {
    const f = field({ type: 'date', name: 'Due' });
    f.id = 'fld_date';
    const { store, stack, row } = setup(f, '2026-10-16');
    expect(createEditor(f, row, store, stack, vi.fn())).toBeNull();
  });

  it('shows the stored day and keeps it on open + dismiss', () => {
    const f = field({ type: 'date', name: 'Due' });
    f.id = 'fld_date';
    const { commits, card } = openPanel(f, '2026-10-16');
    const input = need(card.querySelector('input.tablify__date-input'), 'value field') as HTMLInputElement;
    expect(input.value).toBe('2026-10-16');
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(commits).toEqual(['2026-10-16']);
  });

  it('commits a changed date as YYYY-MM-DD', () => {
    const f = field({ type: 'date', name: 'Due' });
    f.id = 'fld_date';
    const { commits, card } = openPanel(f, '2026-10-16');
    const input = need(card.querySelector('input.tablify__date-input'), 'value field') as HTMLInputElement;
    input.value = '2026-11-01';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(commits).toEqual(['2026-11-01']);
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
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(need(store.getRow('row_1'), 'row').values['fld_check']).toBe(true);
  });
});
