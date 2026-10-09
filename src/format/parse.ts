import type { TablifyFile } from '../model/types.js';

export interface ParseSuccess {
  ok: true;
  data: TablifyFile;
}

export interface ParseError {
  ok: false;
  error: string;
  line?: number;
  column?: number;
}

export type ParseResult = ParseSuccess | ParseError;

/**
 * Parse a .tablify file string into a TablifyFile.
 * Reports the first error with approximate line and column.
 * Never throws — always returns a ParseResult.
 * Unknown keys are preserved.
 */
export function parse(input: string): ParseResult {
  // Step 1: Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Try to extract line/column from the error message
    const match = msg.match(/position (\d+)/);
    if (match) {
      const pos = parseInt(match[1], 10);
      const { line, column } = offsetToLineCol(input, pos);
      return { ok: false, error: `Invalid JSON: ${msg}`, line, column };
    }
    return { ok: false, error: `Invalid JSON: ${msg}` };
  }

  // Step 2: Must be an object
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: 'File must be a JSON object', line: 1, column: 1 };
  }

  const obj = data as Record<string, unknown>;

  // Step 3: Check formatVersion FIRST
  if (!('formatVersion' in obj)) {
    return { ok: false, error: 'Missing required key: formatVersion' };
  }
  if (obj.formatVersion !== 1) {
    return {
      ok: false,
      error: `Unsupported formatVersion: ${JSON.stringify(obj.formatVersion)}. Expected 1.`,
    };
  }

  // Step 4: Check required top-level keys
  const requiredKeys = ['tableId', 'name', 'fields', 'rows', 'views', 'syncLink'];
  for (const key of requiredKeys) {
    if (!(key in obj)) {
      return { ok: false, error: `Missing required key: ${key}` };
    }
  }

  // Step 5: Type checks
  if (typeof obj.tableId !== 'string') {
    return { ok: false, error: 'tableId must be a string' };
  }
  if (typeof obj.name !== 'string') {
    return { ok: false, error: 'name must be a string' };
  }
  if (!Array.isArray(obj.fields)) {
    return { ok: false, error: 'fields must be an array' };
  }
  if (!Array.isArray(obj.rows)) {
    return { ok: false, error: 'rows must be an array' };
  }
  if (!Array.isArray(obj.views)) {
    return { ok: false, error: 'views must be an array' };
  }
  if (obj.fields.length < 1) {
    return { ok: false, error: 'fields must have at least one entry' };
  }
  if (obj.views.length < 1) {
    return { ok: false, error: 'views must have at least one entry' };
  }

  // Step 6: Validate fields
  for (let i = 0; i < obj.fields.length; i++) {
    const field = obj.fields[i] as Record<string, unknown>;
    if (typeof field !== 'object' || field === null) {
      return { ok: false, error: `fields[${i}] must be an object` };
    }
    if (typeof field.id !== 'string') {
      return { ok: false, error: `fields[${i}].id must be a string` };
    }
    if (typeof field.name !== 'string') {
      return { ok: false, error: `fields[${i}].name must be a string` };
    }
    if (typeof field.type !== 'string') {
      return { ok: false, error: `fields[${i}].type must be a string` };
    }
  }

  // Step 7: Validate rows
  for (let i = 0; i < obj.rows.length; i++) {
    const row = obj.rows[i] as Record<string, unknown>;
    if (typeof row !== 'object' || row === null) {
      return { ok: false, error: `rows[${i}] must be an object` };
    }
    if (typeof row.id !== 'string') {
      return { ok: false, error: `rows[${i}].id must be a string` };
    }
    if (typeof row.rev !== 'number' || !Number.isInteger(row.rev)) {
      return { ok: false, error: `rows[${i}].rev must be an integer` };
    }
    if (typeof row.updatedAt !== 'string') {
      return { ok: false, error: `rows[${i}].updatedAt must be a string` };
    }
    if (typeof row.values !== 'object' || row.values === null) {
      return { ok: false, error: `rows[${i}].values must be an object` };
    }
    if (row.sync !== null) {
      return { ok: false, error: `rows[${i}].sync must be null in v1` };
    }
  }

  // Step 8: Validate views
  for (let i = 0; i < obj.views.length; i++) {
    const view = obj.views[i] as Record<string, unknown>;
    if (typeof view !== 'object' || view === null) {
      return { ok: false, error: `views[${i}] must be an object` };
    }
    if (typeof view.id !== 'string') {
      return { ok: false, error: `views[${i}].id must be a string` };
    }
  }

  // Step 9: syncLink must be null
  if (obj.syncLink !== null) {
    return { ok: false, error: 'syncLink must be null in v1' };
  }

  // All checks passed — return the data as TablifyFile
  return { ok: true, data: obj as unknown as TablifyFile };
}

/**
 * Convert a character offset to line and column (1-based).
 */
function offsetToLineCol(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}
