import type { TablifyFile, FieldDefinition, ViewDefinition } from '../model/types.js';
import { validateView } from '../model/view.js';

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

  // Step 8: Validate views (basic shape + view-specific normalization)
  const fieldsForView = obj.fields as unknown as FieldDefinition[];
  for (let i = 0; i < obj.views.length; i++) {
    const view = obj.views[i] as Record<string, unknown>;
    if (typeof view !== 'object' || view === null) {
      return { ok: false, error: `views[${i}] must be an object` };
    }
    if (typeof view.id !== 'string') {
      return { ok: false, error: `views[${i}].id must be a string` };
    }
  }

  // Normalize views: unknown field IDs ignored with warning, not error.
  // We use validateView to derive warnings and columnOrder defaults.
  // Parsing never fails because of unknown field IDs in a view — they are stripped.
  try {
    const normalizedViews = (obj.views as unknown as ViewDefinition[]).map((v, idx) => {
      // Ensure minimal defaults before validation to avoid crashes on missing keys
      const viewWithDefaults = {
        id: v.id,
        name: v.name ?? 'Default',
        sort: Array.isArray(v.sort) ? v.sort : [],
        groupBy: v.groupBy ?? null,
        hidden: Array.isArray(v.hidden) ? v.hidden : [],
        frozenColumns: typeof v.frozenColumns === 'number' ? v.frozenColumns : 0,
        rowHeight: v.rowHeight ?? 'medium',
        columnWidths: v.columnWidths && typeof v.columnWidths === 'object' ? v.columnWidths : {},
        columnOrder: Array.isArray((v as unknown as Record<string, unknown>).columnOrder)
          ? ((v as unknown as Record<string, unknown>).columnOrder as string[])
          : fieldsForView.map((f) => f.id),
        warnings: Array.isArray((v as unknown as Record<string, unknown>).warnings)
          ? ((v as unknown as Record<string, unknown>).warnings as string[])
          : [],
      } as unknown as ViewDefinition;
      const result = validateView(viewWithDefaults, fieldsForView);
      // For file load, even if primary hidden error, auto-fix by removing primary from hidden (warnings)
      // This keeps the file usable — the error is surfaced via validation result but not as parse failure.
      if (!result.ok && result.errors.length > 0) {
        // Check if error is primary hidden → auto-correct with warning
        const primary = fieldsForView.find((f) => f.primary);
        if (primary && result.view.hidden.includes(primary.id)) {
          result.view.hidden = result.view.hidden.filter((id) => id !== primary.id);
          result.view.warnings = [...(result.view.warnings ?? []), `Primary field "${primary.name}" cannot be hidden — removed on load`];
          result.warnings.push(`Primary field "${primary.name}" cannot be hidden — removed on load`);
          result.errors = result.errors.filter((e) => !e.includes('Primary field'));
          result.ok = result.errors.length === 0;
        }
      }
      // Preserve unknown keys from original view
      const original = obj.views[idx] as Record<string, unknown>;
      for (const k of Object.keys(original)) {
        if (!(k in result.view)) {
          (result.view as Record<string, unknown>)[k] = original[k];
        }
      }
      return result.view;
    });
    obj.views = normalizedViews as unknown as typeof obj.views;
  } catch {
    // If view normalization throws, never fail parse with exception — return error
    return { ok: false, error: 'Failed to normalize views' };
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
