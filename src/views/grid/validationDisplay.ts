/**
 * Validation display — visual + aria + tooltip.
 */

import { validateCell } from '../../model/validation.js';
import type { FieldDefinition, Row } from '../../model/types.js';

export function applyValidationState(cellEl: HTMLElement, field: FieldDefinition, row: Row, allRows: Row[]): boolean {
  const violations = validateCell(field, row.values[field.id], allRows, row.id);
  if (violations.length > 0) {
    cellEl.classList.add('tablify__cell--invalid');
    cellEl.setAttribute('aria-invalid', 'true');
    cellEl.title = violations[0].message;
    cellEl.setAttribute('data-validation-message', violations[0].message);
    return false;
  } else {
    cellEl.classList.remove('tablify__cell--invalid');
    cellEl.removeAttribute('aria-invalid');
    cellEl.removeAttribute('title');
    cellEl.removeAttribute('data-validation-message');
    return true;
  }
}

export function getValidationMessage(field: FieldDefinition, row: Row, allRows: Row[]): string | null {
  const v = validateCell(field, row.values[field.id], allRows, row.id);
  return v.length ? v[0].message : null;
}
