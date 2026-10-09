import type { CellValue } from '../types.js';
import type { FieldType } from './interface.js';

/** checkbox — boolean, nullable */
export const checkboxType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    return typeof value === 'boolean';
  },

  parse(input: string): CellValue {
    const trimmed = input.trim().toLowerCase();
    if (trimmed === '') return null;
    if (['true', '1', 'yes', 'y', '✓', 'checked'].includes(trimmed)) return true;
    if (['false', '0', 'no', 'n', '', 'unchecked'].includes(trimmed)) return false;
    return null;
  },

  format(value: CellValue): string {
    if (value === null) return '';
    return value ? '✓' : '';
  },

  defaultValue(): CellValue {
    return null;
  },
};
