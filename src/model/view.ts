// Pure view state logic — no Obsidian imports.
// Implements P2-03: view object define, validate, persist, handle deleted fields.
// See spec/features.md §2.7, spec/guidelines.md P2-03, spec/phases/P2.md.

import type { FieldDefinition, ViewDefinition, SortEntry, RowHeight } from './types.js';
import { generateViewId } from '../utils/idGen.js';

export interface ViewValidationResult {
  view: ViewDefinition;
  warnings: string[];
  errors: string[];
  ok: boolean;
}

const VALID_ROW_HEIGHTS: ReadonlySet<string> = new Set(['small', 'medium', 'large']);
const VALID_DIRECTIONS: ReadonlySet<string> = new Set(['asc', 'desc']);

function cloneView(view: ViewDefinition): ViewDefinition {
  return {
    id: view.id,
    name: view.name,
    sort: view.sort.map((s) => ({ fieldId: s.fieldId, direction: s.direction })),
    groupBy: view.groupBy,
    hidden: [...view.hidden],
    frozenColumns: view.frozenColumns,
    rowHeight: view.rowHeight,
    columnWidths: { ...view.columnWidths },
    columnOrder: [...view.columnOrder],
    ...(view.warnings ? { warnings: [...view.warnings] } : {}),
  };
}

function createDefaultView(fields: FieldDefinition[], name = 'Default'): ViewDefinition {
  const columnOrder = fields.map((f) => f.id);
  return {
    id: generateViewId(),
    name,
    sort: [],
    groupBy: null,
    hidden: [],
    frozenColumns: 1,
    rowHeight: 'medium',
    columnWidths: {},
    columnOrder,
    warnings: [],
  };
}

/**
 * Validate and normalize a view against the current field list.
 * - Unknown field IDs are removed with a warning (not an error).
 * - Hiding the primary field is an error (R-D13) — view not applied.
 * - columnOrder missing or not a permutation → derived from field order with warning.
 * - frozenColumns clamped to 0..fields.length with warning if out of range.
 * - columnWidths entries with unknown field or non-integer/negative dropped with warning.
 * - sort entries with unknown field dropped with warning; direction invalid → dropped.
 * - groupBy unknown → cleared with warning.
 * - rowHeight invalid → set to 'medium' with warning.
 * Never throws — always returns ViewValidationResult.
 */
export function validateView(view: ViewDefinition, fields: FieldDefinition[]): ViewValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const fieldIds = new Set(fields.map((f) => f.id));
  const primary = fields.find((f) => f.primary);
  const primaryId = primary?.id;

  // Deep copy to avoid mutating input
  const normalized: ViewDefinition = cloneView(view);

  // Ensure warnings array exists
  if (!Array.isArray(normalized.warnings)) normalized.warnings = [];

  // --- sort ---
  const origSort = Array.isArray(view.sort) ? view.sort : [];
  const cleanSort: SortEntry[] = [];
  for (const entry of origSort) {
    if (!entry || typeof entry.fieldId !== 'string') {
      warnings.push(`sort entry with invalid fieldId ignored`);
      continue;
    }
    if (!fieldIds.has(entry.fieldId)) {
      warnings.push(`sort field "${entry.fieldId}" is unknown — ignored`);
      continue;
    }
    if (!VALID_DIRECTIONS.has(entry.direction)) {
      warnings.push(`sort direction "${entry.direction}" for field "${entry.fieldId}" invalid — ignored`);
      continue;
    }
    cleanSort.push({ fieldId: entry.fieldId, direction: entry.direction });
  }
  normalized.sort = cleanSort;

  // --- groupBy ---
  if (normalized.groupBy !== null && normalized.groupBy !== undefined) {
    if (typeof normalized.groupBy !== 'string') {
      warnings.push(`groupBy invalid type — cleared`);
      normalized.groupBy = null;
    } else if (!fieldIds.has(normalized.groupBy)) {
      warnings.push(`groupBy field "${normalized.groupBy}" is unknown — cleared`);
      normalized.groupBy = null;
    }
  } else {
    normalized.groupBy = null;
  }

  // --- hidden ---
  const origHidden = Array.isArray(view.hidden) ? view.hidden : [];
  const cleanHidden: string[] = [];
  for (const hid of origHidden) {
    if (typeof hid !== 'string') {
      warnings.push(`hidden entry "${String(hid)}" invalid type — ignored`);
      continue;
    }
    if (!fieldIds.has(hid)) {
      warnings.push(`hidden field "${hid}" is unknown — ignored`);
      continue;
    }
    cleanHidden.push(hid);
  }
  // R-D13: primary cannot be hidden
  if (primaryId && cleanHidden.includes(primaryId)) {
    errors.push(`Primary field "${primary?.name ?? primaryId}" cannot be hidden (R-D13)`);
    // Do not apply hidden change — keep original hidden? But spec says "Reject hiding the primary field".
    // We return error and keep view as before validation for caller to decide.
    // For validation result we still show cleaned hidden but ok=false signals rejection.
  }
  normalized.hidden = cleanHidden;

  // --- columnOrder ---
  const origOrder = view.columnOrder;
  if (!Array.isArray(origOrder)) {
    warnings.push(`columnOrder missing — derived from field order`);
    normalized.columnOrder = fields.map((f) => f.id);
  } else {
    const seen = new Set<string>();
    const cleanOrder: string[] = [];
    for (const fid of origOrder) {
      if (typeof fid !== 'string') {
        warnings.push(`columnOrder entry "${String(fid)}" invalid type — ignored`);
        continue;
      }
      if (!fieldIds.has(fid)) {
        warnings.push(`columnOrder field "${fid}" is unknown — ignored`);
        continue;
      }
      if (seen.has(fid)) {
        warnings.push(`columnOrder duplicate field "${fid}" — ignored`);
        continue;
      }
      seen.add(fid);
      cleanOrder.push(fid);
    }
    // Add missing fields that were not in columnOrder
    const missing = fields.map((f) => f.id).filter((id) => !seen.has(id));
    if (missing.length > 0) {
      warnings.push(`columnOrder missing fields ${missing.join(',')} — appended`);
      cleanOrder.push(...missing);
    }
    // If original had unknown/dup, already warned; if length mismatched, warn
    if (cleanOrder.length !== fields.length) {
      warnings.push(`columnOrder length ${origOrder.length} corrected to ${cleanOrder.length}`);
    }
    normalized.columnOrder = cleanOrder;
  }

  // --- columnWidths ---
  const origWidths = view.columnWidths && typeof view.columnWidths === 'object' ? view.columnWidths : {};
  const cleanWidths: Record<string, number> = {};
  for (const [fid, w] of Object.entries(origWidths as Record<string, unknown>)) {
    if (!fieldIds.has(fid)) {
      warnings.push(`columnWidths field "${fid}" is unknown — ignored`);
      continue;
    }
    if (typeof w !== 'number' || !Number.isInteger(w) || w < 0) {
      warnings.push(`columnWidths for field "${fid}" has invalid width "${String(w)}" — ignored`);
      continue;
    }
    // Clamp width to reasonable range 60..800 but just warn if <60
    if (w < 60) {
      warnings.push(`columnWidths for field "${fid}" width ${w} below minimum 60 — kept but may be clamped by UI`);
    }
    cleanWidths[fid] = w;
  }
  normalized.columnWidths = cleanWidths;

  // --- frozenColumns ---
  let frozen = view.frozenColumns;
  if (typeof frozen !== 'number' || !Number.isInteger(frozen)) {
    warnings.push(`frozenColumns invalid type "${String(frozen)}" — set to 0`);
    frozen = 0;
  }
  if (frozen < 0) {
    warnings.push(`frozenColumns ${frozen} below 0 — clamped to 0`);
    frozen = 0;
  } else if (frozen > fields.length) {
    warnings.push(`frozenColumns ${frozen} exceeds field count ${fields.length} — clamped to ${fields.length}`);
    frozen = fields.length;
  }
  normalized.frozenColumns = frozen;

  // --- rowHeight ---
  const rh = view.rowHeight as unknown as string;
  if (!VALID_ROW_HEIGHTS.has(rh)) {
    warnings.push(`rowHeight "${String(rh)}" invalid — set to "medium"`);
    normalized.rowHeight = 'medium' as RowHeight;
  } else {
    normalized.rowHeight = rh as RowHeight;
  }

  // Persist warnings into view for reload inspection (spec: warning recorded in the view)
  // Append to view.warnings but dedupe against existing warnings from previous saves
  const allWarnings = [...warnings];
  // Keep existing warnings that are still relevant? For simplicity, replace with fresh warnings.
  normalized.warnings = allWarnings;

  const ok = errors.length === 0;
  return { view: normalized, warnings: allWarnings, errors, ok };
}

/**
 * Normalize a raw view object (from JSON) against fields.
 * Handles missing keys, wrong types, and calls validateView.
 * raw may be any unknown JSON value — never throws.
 */
export function normalizeView(raw: unknown, fields: FieldDefinition[]): ViewValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      view: createDefaultView(fields),
      warnings: ['view is not an object — replaced with default view'],
      errors: [],
      ok: true,
    };
  }

  const obj = raw as Record<string, unknown>;

  // Build a ViewDefinition with defaults for missing keys
  const view: ViewDefinition = {
    id: typeof obj.id === 'string' && obj.id.length > 0 ? obj.id : generateViewId(),
    name: typeof obj.name === 'string' && obj.name.length > 0 ? obj.name : 'Default',
    sort: Array.isArray(obj.sort) ? (obj.sort as SortEntry[]) : [],
    groupBy: (obj.groupBy as string | null) ?? null,
    hidden: Array.isArray(obj.hidden) ? (obj.hidden as string[]) : [],
    frozenColumns: typeof obj.frozenColumns === 'number' ? obj.frozenColumns : 0,
    rowHeight: (obj.rowHeight as RowHeight) ?? 'medium',
    columnWidths: typeof obj.columnWidths === 'object' && obj.columnWidths !== null ? (obj.columnWidths as Record<string, number>) : {},
    columnOrder: Array.isArray(obj.columnOrder) ? (obj.columnOrder as string[]) : fields.map((f) => f.id),
    warnings: Array.isArray(obj.warnings) ? (obj.warnings as string[]) : [],
  };

  if (!Array.isArray(obj.columnOrder)) {
    warnings.push('columnOrder missing — derived from field order');
  }
  if (typeof obj.id !== 'string') warnings.push('view id missing or invalid — generated');
  if (typeof obj.name !== 'string') warnings.push('view name missing or invalid — set to Default');
  if (!Array.isArray(obj.sort)) warnings.push('view sort missing — set to []');
  if (!Array.isArray(obj.hidden)) warnings.push('view hidden missing — set to []');
  if (typeof obj.frozenColumns !== 'number') warnings.push('view frozenColumns missing — set to 0');
  if (typeof obj.rowHeight !== 'string') warnings.push('view rowHeight missing — set to medium');

  const result = validateView(view, fields);
  // Merge initial warnings
  const mergedWarnings = [...warnings, ...result.warnings];
  result.view.warnings = mergedWarnings;
  result.warnings = mergedWarnings;
  result.errors = [...errors, ...result.errors];
  result.ok = result.errors.length === 0;
  return result;
}

export function sanitizeViewsForSave(views: ViewDefinition[], fields: FieldDefinition[]): ViewDefinition[] {
  return views.map((v) => validateView(v, fields).view);
}

export { cloneView, createDefaultView };
