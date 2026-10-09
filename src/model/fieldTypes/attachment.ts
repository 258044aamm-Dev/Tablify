import type { CellValue } from '../types.js';
import type { FieldType } from './interface.js';

/** attachment — vault-relative path string */
export const attachmentType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    return typeof value === 'string';
  },

  parse(input: string): CellValue {
    const trimmed = input.trim();
    if (trimmed === '') return null;
    return trimmed;
  },

  format(value: CellValue): string {
    if (value === null) return '';
    return String(value);
  },

  defaultValue(): CellValue {
    return null;
  },
};
