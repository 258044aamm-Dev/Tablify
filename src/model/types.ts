// Shared type definitions for the Tablify data model.
// These types correspond to the .tablify v1 format (FORMAT_SPEC.md).
// No Obsidian imports — pure data model.

// ---- Field types ----

export type FieldTypeName =
  | 'text' | 'long_text' | 'number' | 'currency' | 'percent'
  | 'duration' | 'rating' | 'checkbox' | 'date' | 'date_time'
  | 'url' | 'email' | 'phone'
  | 'single_select' | 'multi_select' | 'attachment'
  | 'auto_number' | 'created_time' | 'modified_time';

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
}

// ---- Row types ----

export type CellValue = string | number | boolean | string[] | null;

export interface Row {
  id: string;          // pattern: row_[A-Za-z0-9]+
  rev: number;
  createdAt?: string;  // ISO 8601
  updatedAt: string;   // ISO 8601
  values: Record<string, CellValue>;
  sync: null;          // reserved for v1.1
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
}

// ---- Table (top-level) ----

export interface TablifyFile {
  formatVersion: 1;
  tableId: string;
  name: string;
  fields: FieldDefinition[];
  rows: Row[];
  views: ViewDefinition[];
  syncLink: null;
  [unknownKey: string]: unknown;
}
