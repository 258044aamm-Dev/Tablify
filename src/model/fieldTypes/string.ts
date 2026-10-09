import type { CellValue } from '../types.js';
import type { FieldType } from './interface.js';

// Simple URL validation: must have protocol and host
const URL_RE = /^https?:\/\/.+/i;

/** url — string that looks like a URL */
export const urlType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    if (typeof value !== 'string') return false;
    if (value === '') return true;
    return URL_RE.test(value);
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

// Simple email validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** email — string matching email pattern */
export const emailType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    if (typeof value !== 'string') return false;
    if (value === '') return true;
    return EMAIL_RE.test(value);
  },

  parse(input: string): CellValue {
    const trimmed = input.trim().toLowerCase();
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

// Phone: allows digits, spaces, dashes, parentheses, leading +
const PHONE_RE = /^\+?[\d\s\-().]{5,20}$/;

/** phone — string matching phone pattern */
export const phoneType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    if (typeof value !== 'string') return false;
    if (value === '') return true;
    return PHONE_RE.test(value);
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
