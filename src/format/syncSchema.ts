// Validation of the v1.1 sync structures (P7-04, FORMAT_SPEC §2.1, §3.3, §4.1).
// Pure model code: no Obsidian or DOM imports. Every function returns an error message
// string, or null when the value is valid. Nothing here throws.
//
// Unknown keys inside these objects are allowed (FORMAT_SPEC unknown-key rule), so a newer
// build can add fields without breaking older builds.

const AIRTABLE_BASE_ID = /^app[A-Za-z0-9]+$/;
const AIRTABLE_TABLE_ID = /^tbl[A-Za-z0-9]+$/;
const AIRTABLE_RECORD_ID = /^rec[A-Za-z0-9]+$/;
const AIRTABLE_FIELD_ID = /^fld[A-Za-z0-9]+$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

const CONFLICT_KINDS = ['both_changed', 'remote_deleted'] as const;
const CONFLICT_DECISIONS = ['keep_local', 'keep_remote', 'keep_both'] as const;
const SYNC_DIRECTIONS = ['link', 'pull', 'push'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Validate a per-row `sync` value. `null` is valid (the row is local-only). */
export function validateRowSync(value: unknown): string | null {
  if (value === null) return null;
  if (!isPlainObject(value)) return 'must be null or an object';
  if (typeof value.airtableId !== 'string' || !AIRTABLE_RECORD_ID.test(value.airtableId)) {
    return 'airtableId must be an Airtable record ID (rec…)';
  }
  if (!isNonNegativeInteger(value.syncedRev)) return 'syncedRev must be a non-negative integer';
  if (!isIsoDate(value.syncedAt)) return 'syncedAt must be an ISO 8601 date string';
  if (typeof value.remoteHash !== 'string' || !SHA256_HEX.test(value.remoteHash)) {
    return 'remoteHash must be a 64-character lowercase hex SHA-256';
  }
  if ('remoteDeleted' in value && typeof value.remoteDeleted !== 'boolean') {
    return 'remoteDeleted must be a boolean when present';
  }
  if ('conflict' in value && value.conflict !== null && value.conflict !== undefined) {
    const c = value.conflict;
    if (!isPlainObject(c)) return 'conflict must be null or an object';
    if (!(CONFLICT_KINDS as readonly unknown[]).includes(c.kind)) {
      return `conflict.kind must be one of ${CONFLICT_KINDS.join(', ')}`;
    }
    if (!(CONFLICT_DECISIONS as readonly unknown[]).includes(c.decision)) {
      return `conflict.decision must be one of ${CONFLICT_DECISIONS.join(', ')}`;
    }
    if (!isNonNegativeInteger(c.localRev)) return 'conflict.localRev must be a non-negative integer';
    if (c.remoteHash !== null && (typeof c.remoteHash !== 'string' || !SHA256_HEX.test(c.remoteHash))) {
      return 'conflict.remoteHash must be null or a 64-character lowercase hex SHA-256';
    }
    if (!isIsoDate(c.decidedAt)) return 'conflict.decidedAt must be an ISO 8601 date string';
  }
  return null;
}

/** Validate the table-level `syncLink` value. `null` is valid (local-only table). */
export function validateSyncLink(value: unknown): string | null {
  if (value === null) return null;
  if (!isPlainObject(value)) return 'must be null or an object';
  if (typeof value.baseId !== 'string' || !AIRTABLE_BASE_ID.test(value.baseId)) {
    return 'baseId must be an Airtable base ID (app…)';
  }
  if (typeof value.tableId !== 'string' || !AIRTABLE_TABLE_ID.test(value.tableId)) {
    return 'tableId must be an Airtable table ID (tbl…)';
  }
  if (typeof value.tableName !== 'string') return 'tableName must be a string';
  if (!isIsoDate(value.linkedAt)) return 'linkedAt must be an ISO 8601 date string';
  if (value.lastSync !== null && value.lastSync !== undefined) {
    const s = value.lastSync;
    if (!isPlainObject(s)) return 'lastSync must be null or an object';
    if (!isIsoDate(s.at)) return 'lastSync.at must be an ISO 8601 date string';
    if (!(SYNC_DIRECTIONS as readonly unknown[]).includes(s.direction)) {
      return `lastSync.direction must be one of ${SYNC_DIRECTIONS.join(', ')}`;
    }
    if (typeof s.ok !== 'boolean') return 'lastSync.ok must be a boolean';
    if (typeof s.summary !== 'string') return 'lastSync.summary must be a string';
  }
  if (!Array.isArray(value.records)) return 'records must be an array';
  const seen = new Set<string>();
  for (let i = 0; i < value.records.length; i++) {
    const r = value.records[i];
    if (!isPlainObject(r)) return `records[${i}] must be an object`;
    if (typeof r.airtableId !== 'string' || !AIRTABLE_RECORD_ID.test(r.airtableId)) {
      return `records[${i}].airtableId must be an Airtable record ID (rec…)`;
    }
    if (seen.has(r.airtableId)) return `records[${i}].airtableId is duplicated`;
    seen.add(r.airtableId);
    if (typeof r.remoteHash !== 'string' || !SHA256_HEX.test(r.remoteHash)) {
      return `records[${i}].remoteHash must be a 64-character lowercase hex SHA-256`;
    }
  }
  return null;
}

/** Validate a field-level `airtable` value (FORMAT_SPEC §3.3). `null`/absent is valid. */
export function validateFieldAirtableMeta(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (!isPlainObject(value)) return 'must be null or an object';
  if (typeof value.id !== 'string' || !AIRTABLE_FIELD_ID.test(value.id)) {
    return 'id must be an Airtable field ID (fld…)';
  }
  if (typeof value.type !== 'string' || value.type.length === 0) return 'type must be a non-empty string';
  if (typeof value.readOnly !== 'boolean') return 'readOnly must be a boolean';
  return null;
}
