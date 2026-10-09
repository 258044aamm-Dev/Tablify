import type { CellValue, FieldDefinition } from '../types.js';

/**
 * Interface for all field type implementations.
 * Each type must implement validate, parse, format, defaultValue, and readOnly.
 */
export interface FieldType {
  /** Returns true if value is valid for this type */
  validate(value: CellValue, field?: FieldDefinition): boolean;

  /** Parse a string input into the typed value */
  parse(input: string, field?: FieldDefinition): CellValue;

  /** Format a typed value for display */
  format(value: CellValue, field?: FieldDefinition): string;

  /** Return the default (empty) value for this type */
  defaultValue(): CellValue;

  /** Whether users can edit this type (system types are read-only) */
  readOnly: boolean;
}
