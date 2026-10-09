import type { CellValue, FieldDefinition, Row } from './types.js';

export type RuleName = 'required' | 'unique' | 'min' | 'max' | 'regex';

export interface ValidationViolation {
  rowId: string;
  fieldId: string;
  rule: RuleName;
  message: string;
}

/** Regex input length cap to prevent ReDoS. */
const REGEX_INPUT_LIMIT = 10_000;

/**
 * Validate all rows against all field rules.
 * Returns a list of violations. Does not modify data.
 */
export function validateTable(
  fields: FieldDefinition[],
  rows: Row[]
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  for (const field of fields) {
    for (const row of rows) {
      const cellViolations = validateCell(field, row.values[field.id], rows, row.id);
      violations.push(...cellViolations);
    }
  }

  return violations;
}

/**
 * Validate a single cell value against its field rules.
 * For the 'unique' rule, pass all rows.
 */
export function validateCell(
  field: FieldDefinition,
  value: CellValue,
  allRows?: Row[],
  currentRowId?: string
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const rowId = currentRowId ?? '';

  // Required check
  if (field.required) {
    if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      violations.push({
        rowId,
        fieldId: field.id,
        rule: 'required',
        message: `${field.name} is required`,
      });
    }
  }

  // Skip further checks if value is null/empty (unless required check already failed)
  if (value === null || value === '') return violations;

  // Min check
  if (field.min !== null && field.min !== undefined) {
    if (typeof value === 'number' && typeof field.min === 'number') {
      if (value < field.min) {
        violations.push({
          rowId,
          fieldId: field.id,
          rule: 'min',
          message: `${field.name} must be at least ${field.min}`,
        });
      }
    } else if (typeof value === 'string' && typeof field.min === 'string') {
      if (value < field.min) {
        violations.push({
          rowId,
          fieldId: field.id,
          rule: 'min',
          message: `${field.name} must be at least ${field.min}`,
        });
      }
    }
  }

  // Max check
  if (field.max !== null && field.max !== undefined) {
    if (typeof value === 'number' && typeof field.max === 'number') {
      if (value > field.max) {
        violations.push({
          rowId,
          fieldId: field.id,
          rule: 'max',
          message: `${field.name} must be at most ${field.max}`,
        });
      }
    } else if (typeof value === 'string' && typeof field.max === 'string') {
      if (value > field.max) {
        violations.push({
          rowId,
          fieldId: field.id,
          rule: 'max',
          message: `${field.name} must be at most ${field.max}`,
        });
      }
    }
  }

  // Regex check
  if (field.regex) {
    const strValue = typeof value === 'string' ? value : String(value);
    if (strValue.length > REGEX_INPUT_LIMIT) {
      violations.push({
        rowId,
        fieldId: field.id,
        rule: 'regex',
        message: `${field.name} exceeds maximum input length (${REGEX_INPUT_LIMIT})`,
      });
    } else {
      try {
        const re = new RegExp(field.regex);
        if (!re.test(strValue)) {
          violations.push({
            rowId,
            fieldId: field.id,
            rule: 'regex',
            message: `${field.name} does not match pattern ${field.regex}`,
          });
        }
      } catch {
        // Invalid regex — shouldn't happen if validated at config time
        violations.push({
          rowId,
          fieldId: field.id,
          rule: 'regex',
          message: `${field.name} has invalid regex pattern`,
        });
      }
    }
  }

  // Unique check (case-sensitive by default)
  if (field.unique && allRows && allRows.length > 0) {
    const trimmedValue = typeof value === 'string' ? value.trim() : value;
    const duplicates = allRows.filter(row => {
      if (row.id === currentRowId) return false;
      const otherValue = row.values[field.id];
      const trimmedOther = typeof otherValue === 'string' ? otherValue.trim() : otherValue;
      return trimmedOther === trimmedValue && otherValue !== null;
    });
    if (duplicates.length > 0) {
      violations.push({
        rowId,
        fieldId: field.id,
        rule: 'unique',
        message: `${field.name} must be unique`,
      });
    }
  }

  return violations;
}

/**
 * Validate a regex pattern at config time.
 * Throws if the pattern is invalid.
 */
export function validateRegexPattern(pattern: string): void {
  try {
    new RegExp(pattern);
  } catch (e) {
    throw new Error(`Invalid regex pattern: "${pattern}"`, { cause: e });
  }
}

/**
 * Test if a regex pattern is safe (doesn't cause ReDoS).
 * Uses a bounded test: if the pattern takes more than the limit on a known-dangerous input, it's unsafe.
 * Note: In Node.js, we cannot easily timeout a regex. Instead we use a short, known-dangerous input
 * and check if it completes quickly. For production, consider a regex safety analysis library.
 */
export function isRegexSafe(pattern: string): boolean {
  try {
    const re = new RegExp(pattern);
    // Test with a short but potentially dangerous input
    const start = performance.now();
    re.test('a'.repeat(20) + 'b');
    const elapsed = performance.now() - start;
    return elapsed < 100;
  } catch {
    return false;
  }
}
