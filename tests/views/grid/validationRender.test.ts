/**
 * @vitest-environment jsdom
 *
 * SAD-109 (part 2) — invalid cells are marked and explained in the grid.
 *
 * `applyValidationState` existed (P3-05) but nothing in the grid called it, so the red marker and
 * the rule-message tooltip documented in docs/user-guide.md never appeared. These tests render the
 * grid and assert the marker. They also pin the guard that matters for existing behaviour: a
 * formula-error or broken-link cell keeps its own tooltip, and cells without rules are untouched.
 *
 * Fails on 695ce1d (before the fix): no cell is marked, whatever the rules.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GridView, type GridOptions } from '../../../src/views/grid/GridView.js';
import { createDefaultView } from '../../../src/model/view.js';
import type { FieldDefinition, Row } from '../../../src/model/types.js';

const FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true, required: true },
  { id: 'fld_code', name: 'Code', type: 'text', unique: true },
  { id: 'fld_note', name: 'Note', type: 'text' },
  { id: 'fld_calc', name: 'Calc', type: 'formula', formula: '1+1' } as unknown as FieldDefinition,
];

function row(id: string, values: Record<string, unknown>): Row {
  return {
    id,
    rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    values: values as Row['values'],
    sync: null,
  };
}

function mount(rows: Row[], extra: Partial<GridOptions> = {}): GridView {
  const grid = new GridView({
    rows,
    fields: FIELDS,
    view: createDefaultView(FIELDS),
    theme: 'light',
    viewportHeight: 600,
    viewportWidth: 1200,
    ...extra,
  });
  document.body.appendChild(grid.root);
  return grid;
}

/** The rendered cell for a row id and field id. */
function cell(grid: GridView, rowId: string, fieldId: string): HTMLElement {
  const el = grid.root.querySelector<HTMLElement>(
    `.tablify__row[data-row-id="${rowId}"] .tablify__cell[data-field-id="${fieldId}"]`,
  );
  if (!el) throw new Error(`no cell ${rowId}/${fieldId}`);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('SAD-109 — invalid cells show the marker and the rule message', () => {
  it('a required field left empty is marked, with its rule message as the tooltip', () => {
    const grid = mount([row('r1', { fld_name: '', fld_code: 'A' }), row('r2', { fld_name: 'Ok', fld_code: 'B' })]);
    const bad = cell(grid, 'r1', 'fld_name');
    expect(bad.classList.contains('tablify__cell--invalid')).toBe(true);
    expect(bad.getAttribute('aria-invalid')).toBe('true');
    expect(bad.title).toBe('Name is required');

    const good = cell(grid, 'r2', 'fld_name');
    expect(good.classList.contains('tablify__cell--invalid')).toBe(false);
    expect(good.hasAttribute('aria-invalid')).toBe(false);
    expect(good.hasAttribute('title')).toBe(false);
  });

  it('duplicates in a unique field are marked on every copy', () => {
    const grid = mount([
      row('r1', { fld_name: 'a', fld_code: 'X' }),
      row('r2', { fld_name: 'b', fld_code: 'X' }),
      row('r3', { fld_name: 'c', fld_code: 'Y' }),
    ]);
    expect(cell(grid, 'r1', 'fld_code').classList.contains('tablify__cell--invalid')).toBe(true);
    expect(cell(grid, 'r2', 'fld_code').classList.contains('tablify__cell--invalid')).toBe(true);
    expect(cell(grid, 'r3', 'fld_code').classList.contains('tablify__cell--invalid')).toBe(false);
  });

  it('a formula error keeps its own tooltip, even on a field with a rule', () => {
    const formulaError = (rowId: string, fieldId: string) =>
      rowId === 'r1' && fieldId === 'fld_calc' ? { code: '#DIV/0!', message: 'Division by zero' } : null;
    const grid = mount([row('r1', { fld_name: 'a', fld_calc: '' })], { formulaError });
    const calc = cell(grid, 'r1', 'fld_calc');
    expect(calc.title).toBe('Division by zero');
    expect(calc.classList.contains('tablify__cell--invalid')).toBe(false);
  });

  it('a broken link keeps its own tooltip', () => {
    const linkFields: FieldDefinition[] = [
      { id: 'fld_name', name: 'Name', type: 'text', primary: true },
      { id: 'fld_ref', name: 'Ref', type: 'link' } as unknown as FieldDefinition,
    ];
    const grid = new GridView({
      rows: [row('r1', { fld_name: 'a', fld_ref: [] })],
      fields: linkFields,
      view: createDefaultView(linkFields),
      theme: 'light',
      viewportHeight: 600,
      viewportWidth: 1200,
      linkSummary: () => ({ text: 'missing', broken: 1 }),
    } as GridOptions);
    document.body.appendChild(grid.root);
    const ref = grid.root.querySelector<HTMLElement>('.tablify__row[data-row-id="r1"] .tablify__cell[data-field-id="fld_ref"]');
    expect(ref?.title).toMatch(/broken link/);
  });

  it('a field with no rules is never marked (no attribute, no class)', () => {
    const grid = mount([row('r1', { fld_name: 'a', fld_code: 'Z', fld_note: '' })]);
    const note = cell(grid, 'r1', 'fld_note');
    expect(note.classList.contains('tablify__cell--invalid')).toBe(false);
    expect(note.hasAttribute('aria-invalid')).toBe(false);
  });
});
