import type { CellValue } from '../types.js';
import type { FieldType } from './interface.js';

/**
 * formula: read-only computed field (v2, P8-03). The engine (src/formula) computes the value
 * from the row's other fields. Results are never stored in the file, so parse() never produces
 * a value and the cell editor is never shown.
 */
export const formulaType: FieldType = {
  readOnly: true,

  validate(value: CellValue): boolean {
    return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  },

  parse(_input: string): CellValue {
    // Computed, cannot be parsed from user input
    return null;
  },

  format(value: CellValue): string {
    if (value === null) return '';
    return Array.isArray(value) ? value.join(', ') : String(value);
  },

  defaultValue(): CellValue {
    return null;
  },
};
