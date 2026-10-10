// P7-05 — Airtable field types ↔ Tablify field types (v1.1).
//
// Source of the type names: the Airtable Web API field-model page, fetched 2026-10-10 (see
// AIRTABLE_FIELD_DOCS). Rule of this module: no field is dropped. A supported type maps to a
// Tablify type. Anything else (formula, lookup, link, collaborator, button, unknown future types)
// is kept as a read-only text column that shows the original Airtable type name.
//
// Pure: no network, no Obsidian imports. Tests cover every rule.

import type { AirtableFieldSchema, AirtableTableSchema } from './airtableClient.js';
import type { FieldDefinition, FieldTypeName, OptionColor, SelectOption } from '../model/types.js';

export const AIRTABLE_FIELD_DOCS =
  'https://airtable.com/developers/web/api/field-model (fetched 2026-10-10; type names checked on chunks 0-1 of 8)';

/** Tablify field ID prefix. Airtable IDs (fldXXXX) become fld_XXXX, so the mapping is stable and collision-free. */
export function tablifyFieldIdFor(airtableFieldId: string): string {
  const body = airtableFieldId.startsWith('fld') ? airtableFieldId.slice(3) : airtableFieldId;
  return 'fld_' + body.replace(/[^A-Za-z0-9_]/g, '_');
}

export interface MappedField {
  airtableId: string;
  airtableName: string;
  airtableType: string;
  tablifyId: string;
  tablifyType: FieldTypeName;
  /** True when Tablify must not write this field back to Airtable. */
  readOnly: boolean;
  /** True when the Airtable type has a Tablify equivalent. False for unsupported (read-only) columns. */
  supported: boolean;
  /** Why the field is read-only or unsupported. Empty when fully supported. */
  reason: string;
}

export interface MappingResult {
  /** One entry per Airtable field, in Airtable order. Nothing is dropped. */
  fields: FieldDefinition[];
  /** Entries whose Airtable type is supported (writable or read-only). */
  mapped: MappedField[];
  /** Entries whose Airtable type is not supported. Shown as read-only columns. */
  unmapped: MappedField[];
  /** Airtable field ID of the primary field, if it was found. */
  primaryAirtableId: string | null;
}

interface Rule {
  tablify: FieldTypeName;
  readOnly: boolean;
  reason?: string;
}

const UNSUPPORTED = 'unsupported type';

/** Mapping table. Each row names the Airtable type and the Tablify type it maps to. */
export const FIELD_TYPE_MAP: Readonly<Record<string, Rule>> = Object.freeze({
  singleLineText: { tablify: 'text', readOnly: false },
  multilineText: { tablify: 'long_text', readOnly: false },
  email: { tablify: 'email', readOnly: false },
  url: { tablify: 'url', readOnly: false },
  phoneNumber: { tablify: 'phone', readOnly: false },
  number: { tablify: 'number', readOnly: false },
  currency: { tablify: 'currency', readOnly: false },
  percent: { tablify: 'percent', readOnly: false },
  rating: { tablify: 'rating', readOnly: false },
  checkbox: { tablify: 'checkbox', readOnly: false },
  date: { tablify: 'date', readOnly: false },
  // Time zone handling is not verified yet, so these are read-only until it is.
  dateTime: { tablify: 'date_time', readOnly: true, reason: 'time zone handling not verified' },
  // Airtable stores durations in its own unit. Conversion to Tablify milliseconds is not verified.
  duration: { tablify: 'duration', readOnly: true, reason: 'unit conversion not verified' },
  singleSelect: { tablify: 'single_select', readOnly: false },
  multipleSelects: { tablify: 'multi_select', readOnly: false },
  // Shown as the file names in a read-only text column. A Tablify attachment cell needs a vault path,
  // which Airtable does not supply, so it is not used here.
  multipleAttachments: { tablify: 'text', readOnly: true, reason: 'attachments are shown as file names' },
  autoNumber: { tablify: 'auto_number', readOnly: true, reason: 'system field' },
  createdTime: { tablify: 'created_time', readOnly: true, reason: 'system field' },
  lastModifiedTime: { tablify: 'modified_time', readOnly: true, reason: 'system field' },
});

/** Airtable types that have no Tablify equivalent. Shown as read-only columns. */
export const UNSUPPORTED_AIRTABLE_TYPES: ReadonlySet<string> = new Set([
  'richText',
  'formula',
  'rollup',
  'count',
  'lookup',
  'multipleLookupValues',
  'multipleRecordLinks',
  'singleCollaborator',
  'multipleCollaborators',
  'createdBy',
  'lastModifiedBy',
  'barcode',
  'button',
  'aiText',
  'externalSyncSource',
]);

/** Airtable choice colour families to Tablify option colours. Unknown colours become gray. */
const COLOR_FAMILIES: ReadonlyArray<[RegExp, OptionColor]> = [
  [/^blue|^cyan|^teal/i, 'blue'],
  [/^green/i, 'green'],
  [/^yellow/i, 'yellow'],
  [/^orange/i, 'orange'],
  [/^red/i, 'red'],
  [/^pink/i, 'pink'],
  [/^purple/i, 'purple'],
  [/^brown/i, 'brown'],
  [/^gray|^grey/i, 'gray'],
];

export function optionColorFor(airtableColor: unknown): OptionColor {
  if (typeof airtableColor !== 'string') return 'gray';
  for (const [re, color] of COLOR_FAMILIES) if (re.test(airtableColor)) return color;
  return 'gray';
}

interface ChoiceLike {
  id?: unknown;
  name?: unknown;
  color?: unknown;
}

/** Converts Airtable select choices to Tablify options. Choices without a usable ID or name are kept by name. */
export function selectOptionsFor(field: AirtableFieldSchema): SelectOption[] {
  const opts = (field.options as { choices?: unknown } | undefined)?.choices;
  if (!Array.isArray(opts)) return [];
  const out: SelectOption[] = [];
  const seen = new Set<string>();
  opts.forEach((raw, i) => {
    const c = (raw ?? {}) as ChoiceLike;
    const name = typeof c.name === 'string' && c.name.length > 0 ? c.name : `Option ${i + 1}`;
    const id = 'opt_' + (typeof c.id === 'string' ? c.id : String(i)).replace(/[^A-Za-z0-9_]/g, '_');
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, name, color: optionColorFor(c.color) });
  });
  return out;
}

/** Maps one Airtable field. Never throws, and never returns null. */
export function mapField(field: AirtableFieldSchema, primaryId: string | null): { def: FieldDefinition; info: MappedField } {
  // Own-property lookup only: names such as "constructor" must not match inherited members.
  const rule = Object.prototype.hasOwnProperty.call(FIELD_TYPE_MAP, field.type) ? FIELD_TYPE_MAP[field.type] : undefined;
  const supported = rule !== undefined;
  const tablifyType: FieldTypeName = rule ? rule.tablify : 'text';
  let readOnly = rule ? rule.readOnly : true;
  let reason = rule ? (rule.reason ?? '') : `${UNSUPPORTED} (${field.type})`;

  // Rating above 10 does not fit Tablify's 1–10 rating.
  if (field.type === 'rating') {
    const max = (field.options as { max?: unknown } | undefined)?.max;
    if (typeof max === 'number' && max > 10) {
      readOnly = true;
      reason = `rating above 10 (${max}) is read-only`;
    }
  }

  const def: FieldDefinition = {
    id: tablifyFieldIdFor(field.id),
    name: field.name,
    type: tablifyType,
    airtable: { id: field.id, type: field.type, readOnly },
  };
  if (primaryId !== null && field.id === primaryId) def.primary = true;
  if (tablifyType === 'single_select' || tablifyType === 'multi_select') {
    def.options = selectOptionsFor(field);
  }
  if (!supported) {
    // Unsupported types are kept as read-only text. Rich values are not converted, so the
    // original Airtable type name is kept in airtable.type.
    def.type = 'text';
  }

  const info: MappedField = {
    airtableId: field.id,
    airtableName: field.name,
    airtableType: field.type,
    tablifyId: def.id,
    tablifyType: def.type,
    readOnly,
    supported,
    reason,
  };
  return { def, info };
}

/**
 * Maps a whole table. Returns every field (nothing dropped), with mapped and unmapped lists.
 * Field IDs are unique per table, so duplicates are reported and given a numeric suffix.
 */
export function mapTable(table: AirtableTableSchema): MappingResult {
  const fields: FieldDefinition[] = [];
  const mapped: MappedField[] = [];
  const unmapped: MappedField[] = [];
  const used = new Set<string>();
  const primaryAirtableId = table.fields.some((f) => f.id === table.primaryFieldId) ? table.primaryFieldId : null;

  for (const field of table.fields) {
    const { def, info } = mapField(field, primaryAirtableId);
    let id = def.id;
    let n = 2;
    while (used.has(id)) id = `${def.id}_${n++}`;
    used.add(id);
    def.id = id;
    info.tablifyId = id;
    fields.push(def);
    (info.supported ? mapped : unmapped).push(info);
  }

  // Exactly one primary field, as Tablify requires. Use the first field if Airtable's primary is missing.
  if (fields.length > 0 && !fields.some((f) => f.primary)) fields[0].primary = true;

  return { fields, mapped, unmapped, primaryAirtableId };
}
