import type { CellValue } from '../types.js';
import type { FieldType } from './interface.js';

/** number — finite number, nullable */
export const numberType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    return typeof value === 'number' && Number.isFinite(value);
  },

  parse(input: string): CellValue {
    const trimmed = input.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  },

  format(value: CellValue): string {
    if (value === null) return '';
    return String(value);
  },

  defaultValue(): CellValue {
    return null;
  },
};

/**
 * currency — stored as integer minor units (e.g., cents).
 * No currency code in v1. Assumption: 2 decimal places.
 */
export const currencyType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  },

  parse(input: string): CellValue {
    const trimmed = input.trim();
    if (trimmed === '') return null;
    // Remove currency symbols and commas
    const cleaned = trimmed.replace(/[^0-9.-]/g, '');
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n)) return null;
    // Convert to minor units (cents)
    return Math.round(n * 100);
  },

  format(value: CellValue): string {
    if (value === null) return '';
    if (typeof value !== 'number') return '';
    // Convert from minor units back to display
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    const whole = Math.floor(abs / 100);
    const frac = abs % 100;
    return `${sign}${whole}.${String(frac).padStart(2, '0')}`;
  },

  defaultValue(): CellValue {
    return null;
  },
};

/** percent — stored as decimal (0.75 = 75%), range 0–1 */
export const percentType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
  },

  parse(input: string): CellValue {
    const trimmed = input.trim();
    if (trimmed === '') return null;
    // Support "75%" format
    if (trimmed.endsWith('%')) {
      const n = parseFloat(trimmed.slice(0, -1));
      if (!Number.isFinite(n)) return null;
      return n / 100;
    }
    const n = parseFloat(trimmed);
    if (!Number.isFinite(n)) return null;
    return n;
  },

  format(value: CellValue): string {
    if (value === null) return '';
    if (typeof value !== 'number') return '';
    return `${Math.round(value * 100)}%`;
  },

  defaultValue(): CellValue {
    return null;
  },
};

/** duration — stored as integer milliseconds */
export const durationType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  },

  parse(input: string): CellValue {
    const trimmed = input.trim();
    if (trimmed === '') return null;

    // Try HH:MM:SS format
    const hmsMatch = trimmed.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
    if (hmsMatch) {
      const h = parseInt(hmsMatch[1], 10);
      const m = parseInt(hmsMatch[2], 10);
      const s = parseInt(hmsMatch[3], 10);
      return (h * 3600 + m * 60 + s) * 1000;
    }

    // Try H:MM:SS format
    const hmsMatch2 = trimmed.match(/^(\d+):(\d{1,2})$/);
    if (hmsMatch2) {
      const m = parseInt(hmsMatch2[1], 10);
      const s = parseInt(hmsMatch2[2], 10);
      return (m * 60 + s) * 1000;
    }

    // Try "Xh Ym" or "Xh Ym Zs" format
    const humanMatch = trimmed.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i);
    if (humanMatch && (humanMatch[1] || humanMatch[2] || humanMatch[3])) {
      const h = humanMatch[1] ? parseInt(humanMatch[1], 10) : 0;
      const m = humanMatch[2] ? parseInt(humanMatch[2], 10) : 0;
      const s = humanMatch[3] ? parseInt(humanMatch[3], 10) : 0;
      return (h * 3600 + m * 60 + s) * 1000;
    }

    // Try raw milliseconds
    const n = parseInt(trimmed, 10);
    if (Number.isFinite(n) && n >= 0) return n;

    return null;
  },

  format(value: CellValue): string {
    if (value === null) return '';
    if (typeof value !== 'number') return '';
    const totalSeconds = Math.floor(value / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  },

  defaultValue(): CellValue {
    return null;
  },
};

/**
 * rating — a number in 0–10, with up to two decimals (SAD-304).
 *
 * The ceiling is the *type's*. A field's own `max` is its scale (5 when unset) and the largest
 * value the cell and the panel will choose; but validation stays lenient on purpose, because a
 * file that already holds 7 in a five-star field must keep reading, and turning yesterday's
 * integers red would be a regression rather than a fix.
 */
export const ratingType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10;
  },

  parse(input: string): CellValue {
    // A comma is what a person types on a locale that writes `4,5`; the file still gets a dot.
    const trimmed = input.trim().replace(',', '.');
    if (trimmed === '') return null;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    // Two decimals is the storage contract (SAD-304); anything finer is a typo, not a rating.
    return Math.round(Math.max(0, Math.min(10, n)) * 100) / 100;
  },

  format(value: CellValue): string {
    if (value === null) return '';
    return String(value);
  },

  defaultValue(): CellValue {
    return null;
  },
};
