import type { TablifyFile, FieldDefinition, Row, ViewDefinition, SelectOption } from '../model/types.js';

/**
 * Serialize a TablifyFile to a formatted JSON string.
 * Keys are in the order defined by FORMAT_SPEC.md.
 * Uses 2-space indent, LF line endings, trailing newline.
 * Unknown keys are preserved.
 */
export function serialize(file: TablifyFile): string {
  const ordered = orderTopLevel(file);
  return JSON.stringify(ordered, null, 2) + '\n';
}

/** Top-level key order per FORMAT_SPEC.md §2. */
const TOP_LEVEL_KEYS = ['formatVersion', 'tableId', 'name', 'fields', 'rows', 'views', 'syncLink'] as const;

/** Field key order per FORMAT_SPEC.md §3. */
const FIELD_KEYS = ['id', 'name', 'type', 'primary', 'options', 'required', 'unique', 'min', 'max', 'regex'] as const;

/** Row key order per FORMAT_SPEC.md §4. */
const ROW_KEYS = ['id', 'rev', 'createdAt', 'updatedAt', 'values', 'sync'] as const;

/** View key order per FORMAT_SPEC.md §5. */
const VIEW_KEYS = ['id', 'name', 'sort', 'groupBy', 'hidden', 'frozenColumns', 'rowHeight', 'columnWidths'] as const;

/** Option key order per FORMAT_SPEC.md §3.2. */
const OPTION_KEYS = ['id', 'name', 'color'] as const;

function orderTopLevel(file: TablifyFile): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of TOP_LEVEL_KEYS) {
    if (key in file) {
      if (key === 'fields') {
        result[key] = (file.fields as FieldDefinition[]).map(orderField);
      } else if (key === 'rows') {
        result[key] = (file.rows as Row[]).map(orderRow);
      } else if (key === 'views') {
        result[key] = (file.views as ViewDefinition[]).map(orderView);
      } else {
        result[key] = file[key];
      }
    }
  }
  // Preserve unknown keys
  for (const key of Object.keys(file)) {
    if (!(TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
      result[key] = file[key];
    }
  }
  return result;
}

function orderField(field: FieldDefinition): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of FIELD_KEYS) {
    if (key in field) {
      if (key === 'options' && field.options) {
        result[key] = field.options.map(orderOption);
      } else {
        result[key] = field[key as keyof FieldDefinition];
      }
    }
  }
  // Preserve unknown keys in field
  for (const key of Object.keys(field)) {
    if (!(FIELD_KEYS as readonly string[]).includes(key)) {
      result[key] = (field as Record<string, unknown>)[key];
    }
  }
  return result;
}

function orderRow(row: Row): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of ROW_KEYS) {
    if (key in row) {
      result[key] = (row as Record<string, unknown>)[key];
    }
  }
  // Preserve unknown keys in row
  for (const key of Object.keys(row)) {
    if (!(ROW_KEYS as readonly string[]).includes(key)) {
      result[key] = (row as Record<string, unknown>)[key];
    }
  }
  return result;
}

function orderView(view: ViewDefinition): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of VIEW_KEYS) {
    if (key in view) {
      result[key] = (view as Record<string, unknown>)[key];
    }
  }
  // Preserve unknown keys in view
  for (const key of Object.keys(view)) {
    if (!(VIEW_KEYS as readonly string[]).includes(key)) {
      result[key] = (view as Record<string, unknown>)[key];
    }
  }
  return result;
}

function orderOption(option: SelectOption): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of OPTION_KEYS) {
    if (key in option) {
      result[key] = (option as Record<string, unknown>)[key];
    }
  }
  // Preserve unknown keys
  for (const key of Object.keys(option)) {
    if (!(OPTION_KEYS as readonly string[]).includes(key)) {
      result[key] = (option as Record<string, unknown>)[key];
    }
  }
  return result;
}
