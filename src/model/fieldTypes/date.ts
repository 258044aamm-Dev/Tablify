import type { CellValue } from '../types.js';
import type { FieldType } from './interface.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s: string): boolean {
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && s === d.toISOString().slice(0, 10);
}

function isValidDateTime(s: string): boolean {
  const d = new Date(s);
  return !isNaN(d.getTime());
}

/** date — YYYY-MM-DD format */
export const dateType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    if (typeof value !== 'string') return false;
    return DATE_RE.test(value) && isValidDate(value);
  },

  parse(input: string): CellValue {
    const trimmed = input.trim();
    if (trimmed === '') return null;
    // Try YYYY-MM-DD
    if (DATE_RE.test(trimmed) && isValidDate(trimmed)) return trimmed;
    // Try parsing as date and extracting YYYY-MM-DD
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return null;
  },

  format(value: CellValue): string {
    if (value === null) return '';
    return String(value);
  },

  defaultValue(): CellValue {
    return null;
  },
};

/** date_time — ISO 8601 UTC */
export const dateTimeType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    if (typeof value !== 'string') return false;
    return isValidDateTime(value);
  },

  parse(input: string): CellValue {
    const trimmed = input.trim();
    if (trimmed === '') return null;
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  },

  format(value: CellValue): string {
    if (value === null) return '';
    return String(value);
  },

  defaultValue(): CellValue {
    return null;
  },
};
