// Converts Airtable cell values to Tablify cell values and back (P7-06, P7-07).
// One normalization is used for both directions, so a value compares equal whichever side it came from.
import type { CellValue, FieldDefinition, Row, SelectOption } from '../model/types.js';
import { canonicalJson, sha256Hex } from './hash.js';

export class UnknownChoiceError extends Error {
  constructor(public readonly fieldName: string, public readonly choice: string) {
    super(`Airtable has an option "${choice}" in "${fieldName}" that Tablify does not know. Re-link the table to refresh its options, then sync again.`);
    this.name = 'UnknownChoiceError';
  }
}

/** Fields that take part in sync: those with an Airtable link. */
export function syncedFields(fields: readonly FieldDefinition[]): FieldDefinition[] {
  return fields.filter((f) => f.airtable && typeof f.airtable.id === 'string');
}

function isWritable(field: FieldDefinition): boolean {
  // P8: formula results and link references are never written to Airtable, even if a link exists.
  if (field.type === 'formula' || field.type === 'link') return false;
  return !!field.airtable && !field.airtable.readOnly;
}

function stringify(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  return JSON.stringify(raw);
}

function attachmentNames(raw: unknown): string | null {
  if (!Array.isArray(raw)) return stringify(raw);
  const names = raw
    .map((a) => (a && typeof a === 'object' && typeof (a as { filename?: unknown }).filename === 'string' ? (a as { filename: string }).filename : null))
    .filter((n): n is string => n !== null);
  return names.length > 0 ? names.join(', ') : null;
}

function optionIdFor(field: FieldDefinition, name: string): string {
  const opt = (field.options ?? []).find((o: SelectOption) => o.name === name);
  if (!opt) throw new UnknownChoiceError(field.name, name);
  return opt.id;
}

/** A local option ID with no option behind it is a corrupt file. Throwing keeps it from being sent as a blank. */
function requireOptionName(field: FieldDefinition, id: string): string {
  const opt = (field.options ?? []).find((o: SelectOption) => o.id === id);
  if (!opt) throw new Error(`Field "${field.name}" has an option ID with no matching option. Fix the file before syncing.`);
  return opt.name;
}

/** Airtable value -> Tablify value for one field. Throws UnknownChoiceError for an unmapped option. */
export function remoteToLocal(field: FieldDefinition, raw: unknown): CellValue {
  const airtableType = field.airtable?.type ?? '';
  switch (field.type) {
    case 'checkbox':
      return raw === true;
    case 'number':
    case 'currency':
    case 'percent':
    case 'duration':
    case 'rating':
    case 'auto_number':
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
    case 'single_select':
      return typeof raw === 'string' && raw !== '' ? optionIdFor(field, raw) : null;
    case 'multi_select': {
      if (!Array.isArray(raw)) return [];
      return raw.filter((n): n is string => typeof n === 'string').map((n) => optionIdFor(field, n));
    }
    case 'text':
    case 'long_text':
    case 'url':
    case 'email':
    case 'phone':
    case 'date':
    case 'date_time':
    case 'created_time':
    case 'modified_time':
      return airtableType === 'multipleAttachments' ? attachmentNames(raw) : stringify(raw);
    case 'attachment':
      return attachmentNames(raw);
    // P8: formula results are never synced, and link fields are not part of the P7 mapping.
    case 'formula':
    case 'link':
      return null;
  }
}

/** Tablify value -> Airtable write value for one writable field. Read-only fields are never sent. */
export function localToRemote(field: FieldDefinition, value: CellValue | undefined): unknown {
  const v = value ?? null;
  if (field.type === 'single_select') {
    if (typeof v !== 'string') return null;
    return requireOptionName(field, v);
  }
  if (field.type === 'multi_select') {
    if (!Array.isArray(v)) return [];
    // multi_select cells hold option IDs (strings); the field type guarantees it.
    return (v as string[]).map((id) => requireOptionName(field, id));
  }
  if (field.type === 'checkbox') return v === true;
  if (v === '') return null;
  return v;
}

/** Normalized value used for hashing and comparison. Empty and absent values have one form. */
export function normalize(field: FieldDefinition, value: CellValue | undefined): CellValue {
  const v = value ?? null;
  if (field.type === 'checkbox') return v === true;
  if (field.type === 'multi_select') return Array.isArray(v) ? [...(v as string[])] : [];
  if (v === '') return null;
  return v;
}

/** Remote record -> normalized Tablify values for every synced field, keyed by Tablify field ID. */
export function remoteValues(fields: readonly FieldDefinition[], rawFields: Record<string, unknown>): Record<string, CellValue> {
  const out: Record<string, CellValue> = {};
  for (const f of syncedFields(fields)) {
    out[f.id] = normalize(f, remoteToLocal(f, rawFields[f.airtable!.id]));
  }
  return out;
}

/** Local row -> normalized values for every synced field, keyed by Tablify field ID. */
export function localValues(fields: readonly FieldDefinition[], row: Pick<Row, 'values'>): Record<string, CellValue> {
  const out: Record<string, CellValue> = {};
  for (const f of syncedFields(fields)) out[f.id] = normalize(f, row.values[f.id]);
  return out;
}

/** SHA-256 of the normalized remote values. Stored in the row's sync block as `remoteHash`. */
export function hashValues(values: Record<string, CellValue>): string {
  return sha256Hex(canonicalJson(values));
}

/** Writable fields only, keyed by Airtable field ID, for a create or update request. */
export function writePayload(fields: readonly FieldDefinition[], row: Pick<Row, 'values'>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (!isWritable(f)) continue;
    out[f.airtable!.id] = localToRemote(f, row.values[f.id]);
  }
  return out;
}

export { isWritable };
