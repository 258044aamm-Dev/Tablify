import type { CellValue } from '../types.js';
import type { FieldType } from './interface.js';

/** auto_number — read-only, integer, never null */
export const autoNumberType: FieldType = {
  readOnly: true,

  validate(value: CellValue): boolean {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  },

  parse(_input: string): CellValue {
    // System-generated, cannot be parsed from user input
    return null;
  },

  format(value: CellValue): string {
    if (typeof value !== 'number') return '';
    return String(value);
  },

  defaultValue(): CellValue {
    return 0;
  },
};

/** created_time — read-only, ISO 8601 UTC, never null */
export const createdTimeType: FieldType = {
  readOnly: true,

  validate(value: CellValue): boolean {
    if (typeof value !== 'string') return false;
    return !isNaN(new Date(value).getTime());
  },

  parse(_input: string): CellValue {
    return new Date().toISOString();
  },

  format(value: CellValue): string {
    if (typeof value !== 'string') return '';
    return value;
  },

  defaultValue(): CellValue {
    return new Date().toISOString();
  },
};

/** modified_time — read-only, ISO 8601 UTC, never null */
export const modifiedTimeType: FieldType = {
  readOnly: true,

  validate(value: CellValue): boolean {
    if (typeof value !== 'string') return false;
    return !isNaN(new Date(value).getTime());
  },

  parse(_input: string): CellValue {
    return new Date().toISOString();
  },

  format(value: CellValue): string {
    if (typeof value !== 'string') return '';
    return value;
  },

  defaultValue(): CellValue {
    return new Date().toISOString();
  },
};
