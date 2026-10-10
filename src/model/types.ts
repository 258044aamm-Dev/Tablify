// Shared type definitions for the Tablify data model.
// These types correspond to the .tablify v1 format (FORMAT_SPEC.md).
// No Obsidian imports — pure data model.

// ---- Field types ----

export type FieldTypeName =
  | 'text' | 'long_text' | 'number' | 'currency' | 'percent'
  | 'duration' | 'rating' | 'checkbox' | 'date' | 'date_time'
  | 'url' | 'email' | 'phone'
  | 'single_select' | 'multi_select' | 'attachment'
  | 'auto_number' | 'created_time' | 'modified_time'
  // v2 only (formatVersion 2, P8). Writing these makes a table a v2 table.
  | 'formula' | 'link';

export type OptionColor =
  | 'gray' | 'brown' | 'orange' | 'yellow' | 'green'
  | 'blue' | 'purple' | 'pink' | 'red';

export const OPTION_COLORS: readonly OptionColor[] = [
  'gray', 'brown', 'orange', 'yellow', 'green',
  'blue', 'purple', 'pink', 'red',
];

export interface SelectOption {
  id: string;        // pattern: opt_[A-Za-z0-9_]+
  name: string;
  color: OptionColor;
}

/**
 * Airtable link for one field (P7-05, FORMAT_SPEC §3.3). `id` is the Airtable field ID
 * (`fld…`), which survives renames. `readOnly` fields are shown but never pushed.
 */
export interface AirtableFieldMeta {
  id: string;
  type: string;        // Airtable field type name, as returned by the metadata API
  readOnly: boolean;
}

export interface FieldDefinition {
  id: string;          // pattern: fld_[A-Za-z0-9_]+
  name: string;
  type: FieldTypeName;
  primary?: boolean;
  options?: SelectOption[];    // only for single_select, multi_select
  required?: boolean;
  unique?: boolean;
  min?: number | string | null;
  max?: number | string | null;
  regex?: string | null;
  /** formula only (v2, P8-03): the expression. Results are not stored in the file. */
  formula?: string;
  /** link only (v2, P8-04): default target table ID. */
  linkTableId?: string;
  /** Reserved for v1.1 sync (P7-05). Absent or null on a local-only field. */
  airtable?: AirtableFieldMeta | null;
}

// ---- Row types ----

/** One link in a `link` cell (v2, P8). The target table and row IDs, not display text. */
export interface LinkRef {
  tableId: string;
  rowId: string;
}

export type CellValue = string | number | boolean | string[] | LinkRef[] | null;

/** Why a row and its remote record both changed (P7-08). */
export type SyncConflictKind = 'both_changed' | 'remote_deleted';

/** The user's choice for a conflict. Stored so the same conflict is not asked again. */
export type SyncConflictDecision = 'keep_local' | 'keep_remote' | 'keep_both';

export interface RowSyncConflict {
  kind: SyncConflictKind;
  decision: SyncConflictDecision;
  /** Row revision at the moment the decision was made. A new local edit makes it stale. */
  localRev: number;
  /** Remote hash at the moment the decision was made. A new remote change makes it stale. */
  remoteHash: string | null;
  decidedAt: string;   // ISO 8601
}

/** Per-row sync state (FORMAT_SPEC §4.1). Present on a row that is linked to an Airtable record. */
export interface RowSync {
  airtableId: string;  // pattern: rec[A-Za-z0-9]+
  /** Row `rev` at the last successful sync. `rev !== syncedRev` means the row changed locally. */
  syncedRev: number;
  syncedAt: string;    // ISO 8601
  /** SHA-256 (hex) of the normalized remote values at the last successful sync. */
  remoteHash: string;
  /** True when the Airtable record was deleted remotely and the row was kept (never silently removed). */
  remoteDeleted?: boolean;
  conflict?: RowSyncConflict | null;
}

export interface Row {
  id: string;          // pattern: row_[A-Za-z0-9]+
  rev: number;
  createdAt?: string;  // ISO 8601
  updatedAt: string;   // ISO 8601
  values: Record<string, CellValue>;
  sync: RowSync | null;
}

// ---- View types ----

export type SortDirection = 'asc' | 'desc';
export type RowHeight = 'small' | 'medium' | 'large' | 'compact' | 'tall';

export interface SortEntry {
  fieldId: string;
  direction: SortDirection;
}

export interface ViewDefinition {
  id: string;
  name: string;
  sort: SortEntry[];
  groupBy: string | null;
  hidden: string[];
  frozenColumns: number;
  rowHeight: RowHeight;
  columnWidths: Record<string, number>;
  columnOrder: string[];
  warnings?: string[];
  /**
   * Global search text persisted with the view (SAD-69).
   * Optional and absent by default: a file written before these keys existed must still
   * round-trip byte-identical, so nothing may inject an empty default. Absent or '' = no search.
   */
  search?: string;
  /**
   * P2-02 query persisted with the view (SAD-69). Same optionality rule as `search`.
   * Absent or null = no query filter.
   */
  query?: string | null;
}

// ---- Sync link (table-level) ----

/** Result of the last sync run, shown in the sync status line (P7-10). */
export interface SyncRunStatus {
  at: string;          // ISO 8601
  direction: 'link' | 'pull' | 'push';
  ok: boolean;
  summary: string;     // short, never contains the token
}

/** Snapshot of one synced row as of the last successful sync (FORMAT_SPEC §2.1). */
export interface SyncRecordState {
  airtableId: string;
  remoteHash: string;
}

/**
 * Table-level Airtable link (FORMAT_SPEC §2.1). Null for a local-only table.
 * `records` lets a later pull detect rows that were deleted locally: a record listed here whose
 * row no longer exists was deleted by the user (P7-06, P7-08).
 */
export interface SyncLink {
  baseId: string;      // pattern: app[A-Za-z0-9]+
  tableId: string;     // pattern: tbl[A-Za-z0-9]+
  tableName: string;
  linkedAt: string;    // ISO 8601
  lastSync: SyncRunStatus | null;
  records: SyncRecordState[];
}

// ---- Table (top-level) ----

export interface TablifyFile {
  formatVersion: 1 | 2;
  tableId: string;
  name: string;
  fields: FieldDefinition[];
  rows: Row[];
  views: ViewDefinition[];
  syncLink: SyncLink | null;
  [unknownKey: string]: unknown;
}
