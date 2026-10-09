/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { applyValidationState, getValidationMessage } from '../../../src/views/grid/validationDisplay.js';
import type { FieldDefinition, Row } from '../../../src/model/types.js';

describe('P3-05 — Validation display', () => {
  it('invalid cell shows visual state + aria-invalid + tooltip equals rule message', () => {
    const field: FieldDefinition = { id: 'fld_name', name: 'Name', type: 'text', required: true } as FieldDefinition;
    const row: Row = { id: 'row_1', rev: 1, values: { fld_name: '' } };
    const allRows: Row[] = [row];
    const cell = document.createElement('div');
    cell.className = 'tablify__cell';
    const ok = applyValidationState(cell, field, row, allRows);
    expect(ok).toBe(false);
    expect(cell.classList.contains('tablify__cell--invalid')).toBe(true);
    expect(cell.getAttribute('aria-invalid')).toBe('true');
    expect(cell.title).toBe('Name is required');
    expect(getValidationMessage(field, row, allRows)).toBe('Name is required');
  });

  it('valid cell has no invalid state', () => {
    const field: FieldDefinition = { id: 'fld_name', name: 'Name', type: 'text' } as FieldDefinition;
    const row: Row = { id: 'row_1', rev: 1, values: { fld_name: 'hello' } };
    const cell = document.createElement('div');
    cell.className = 'tablify__cell tablify__cell--invalid';
    cell.setAttribute('aria-invalid', 'true');
    cell.title = 'old';
    const ok = applyValidationState(cell, field, row, [row]);
    expect(ok).toBe(true);
    expect(cell.classList.contains('tablify__cell--invalid')).toBe(false);
    expect(cell.hasAttribute('aria-invalid')).toBe(false);
    expect(cell.title).toBe('');
  });

  it('creates invalid via file edit and shows on reopen (simulate)', () => {
    const field: FieldDefinition = { id: 'fld_age', name: 'Age', type: 'number', required: true } as FieldDefinition;
    // Simulate file edit that wrote '' (empty) for required number
    const row: Row = { id: 'row_1', rev: 1, values: { fld_age: '' as unknown as string } };
    const cell = document.createElement('div');
    applyValidationState(cell, field, row, [row]);
    expect(cell.getAttribute('aria-invalid')).toBe('true');
    expect(cell.classList.contains('tablify__cell--invalid')).toBe(true);
  });

  it('tooltip text equals rule message for each rule type', () => {
    // unique rule
    const field: FieldDefinition = { id: 'fld_code', name: 'Code', type: 'text', unique: true } as FieldDefinition;
    const row1: Row = { id: 'r1', rev: 1, values: { fld_code: 'A' } };
    const row2: Row = { id: 'r2', rev: 1, values: { fld_code: 'A' } };
    const cell = document.createElement('div');
    applyValidationState(cell, field, row2, [row1, row2]);
    expect(cell.title).toMatch(/unique|Code/i);
  });
});
