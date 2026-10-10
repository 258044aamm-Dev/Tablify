import type { CellValue, LinkRef } from '../types.js';
import type { FieldType } from './interface.js';

/** True for a `{ tableId, rowId }` pair, the v2 link cell shape (FORMAT_SPEC §8). */
export function isLinkRef(v: unknown): v is LinkRef {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.tableId === 'string' && typeof r.rowId === 'string';
}

/**
 * link: links to rows in another table (v2, P8). P8-03 registers the type read-only, so the
 * shape and file format are fixed first. P8-04 adds the row picker, chips, and broken-link marker.
 */
export const linkType: FieldType = {
  readOnly: true,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    return Array.isArray(value) && (value as unknown[]).every(isLinkRef);
  },

  parse(_input: string): CellValue {
    // Set through the link picker (P8-04), never from typed text
    return null;
  },

  format(value: CellValue): string {
    if (!Array.isArray(value) || value.length === 0) return '';
    return `${value.length} linked`;
  },

  defaultValue(): CellValue {
    return null;
  },
};
