import type { CellValue } from '../types.js';
import type { FieldType } from './interface.js';

/** text — short text, max 10,000 characters */
export const textType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    return typeof value === 'string' && value.length <= 10_000;
  },

  parse(input: string): CellValue {
    return input.length > 10_000 ? input.slice(0, 10_000) : input;
  },

  format(value: CellValue): string {
    if (value === null) return '';
    return String(value);
  },

  defaultValue(): CellValue {
    return null;
  },
};

/** long_text — multiline text, max 100,000 characters */
export const longTextType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    return typeof value === 'string' && value.length <= 100_000;
  },

  parse(input: string): CellValue {
    return input.length > 100_000 ? input.slice(0, 100_000) : input;
  },

  format(value: CellValue): string {
    if (value === null) return '';
    return String(value);
  },

  defaultValue(): CellValue {
    return null;
  },
};
