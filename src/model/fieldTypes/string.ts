import type { CellValue, FieldDefinition } from '../types.js';
import type { FieldType } from './interface.js';
import { toE164 } from '../phone/phoneValue.js';

// Simple URL validation: must have protocol and host.
// Exported (SAD-303) so import inference uses the field type's own rule, never a copy.
export const URL_RE = /^https?:\/\/.+/i;

/** url — string that looks like a URL */
export const urlType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    if (typeof value !== 'string') return false;
    if (value === '') return true;
    return URL_RE.test(value);
  },

  /**
   * SAD-303: a valid number is stored as E.164. Anything that is not valid is kept exactly
   * as typed (trimmed) — the same contract as before, so no existing value is ever rewritten
   * by opening it. The country comes from the field's own default; with no default, only an
   * international value (starting with +) can be normalised, because a national number has
   * no country to assume.
   */
  parse(input: string, field?: FieldDefinition): CellValue {
    const trimmed = input.trim();
    if (trimmed === '') return null;
    return toE164(trimmed, field?.phoneCountry) ?? trimmed;
  },

  format(value: CellValue): string {
    if (value === null) return '';
    return String(value);
  },

  defaultValue(): CellValue {
    return null;
  },
};

// Simple email validation. Exported for import inference (SAD-303).
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

// Phone: allows digits, spaces, dashes, parentheses, leading +.
// E.164 fits (a + and at most 15 digits); legacy formatted values still fit too.
export const PHONE_RE = /^\+?[\d\s\-().]{5,20}$/;

/** phone — string matching phone pattern */
export const phoneType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    if (typeof value !== 'string') return false;
    if (value === '') return true;
    return PHONE_RE.test(value);
  },

  /**
   * SAD-303: a valid number is stored as E.164. Anything that is not valid is kept exactly
   * as typed (trimmed) — the same contract as before, so no existing value is ever rewritten
   * by opening it. The country comes from the field's own default; with no default, only an
   * international value (starting with +) can be normalised, because a national number has
   * no country to assume.
   */
  parse(input: string, field?: FieldDefinition): CellValue {
    const trimmed = input.trim();
    if (trimmed === '') return null;
    return toE164(trimmed, field?.phoneCountry) ?? trimmed;
  },

  format(value: CellValue): string {
    if (value === null) return '';
    return String(value);
  },

  defaultValue(): CellValue {
    return null;
  },
};
