import type { CellValue, LinkRef } from '../types.js';
import type { FieldType } from './interface.js';

/** True for a `{ tableId, rowId }` pair, the v2 link cell shape (FORMAT_SPEC §12). */
export function isLinkRef(v: unknown): v is LinkRef {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.tableId === 'string' && typeof r.rowId === 'string';
}

/**
 * Resolves one link to the linked row's label, or null when the link is broken. Set once by the
 * plugin from the vault index (P8-04 follow-up, R-2). Null means "not set": format() then counts.
 */
export type LinkLabelResolver = (ref: LinkRef) => string | null;

let labelResolver: LinkLabelResolver | null = null;

export function setLinkLabelResolver(resolver: LinkLabelResolver | null): void {
  labelResolver = resolver;
}

/**
 * link: links to rows in another table (v2, P8). Values are set through the row picker
 * (P8-04), never from typed or pasted text. Resolution, broken-link markers, and the integrity
 * check live in src/links/ (they need the vault, so the field type stays pure).
 */
export const linkType: FieldType = {
  readOnly: false,

  validate(value: CellValue): boolean {
    if (value === null) return true;
    return Array.isArray(value) && (value as unknown[]).every(isLinkRef);
  },

  parse(_input: string): CellValue {
    // Typed or pasted text cannot name a row ID, so it never sets a link. Paste is refused in the view.
    return null;
  },

  /**
   * Text for sort, filter and export. With a resolver: the linked row names, joined with ", ", and
   * "Missing row" for a broken link. Without one: the count (the fallback used before the index exists).
   */
  format(value: CellValue): string {
    if (!Array.isArray(value) || value.length === 0) return '';
    const resolve = labelResolver;
    if (resolve) {
      return (value as LinkRef[]).map((ref) => resolve(ref) ?? 'Missing row').join(', ');
    }
    return `${value.length} linked`;
  },

  defaultValue(): CellValue {
    return null;
  },
};
