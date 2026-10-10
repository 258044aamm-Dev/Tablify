// Change field type (P5-02). Pure logic.
// Rule: a type is offered only when EVERY non-empty value converts to it without error
// (format in the old type, parse in the new type, then validate). Nothing is lost silently.
// Select types need an option list and attachments have their own path, so they are not targets here.

import { getFieldType, isKnownType } from './fieldTypes/registry.js';
import type { CellValue, FieldDefinition, FieldTypeName, Row } from './types.js';

/** Types that cannot be a target of a change in this version, with the reason shown in the menu. */
export const NOT_A_TARGET: Partial<Record<FieldTypeName, string>> = {
  single_select: 'Choose options in field settings (not in this version)',
  multi_select: 'Choose options in field settings (not in this version)',
  attachment: 'Attachments keep their own path',
  formula: 'Formula fields are created with Add field',
  link: 'Link fields are created with Add field',
};

export type TypeChangePlan =
  | { ok: true; field: FieldDefinition; valuesByRow: Record<string, CellValue> }
  | { ok: false; reason: string; blockedRows: number };

function isEmpty(v: CellValue | undefined): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Plan a type change. Returns the new definition and converted values, or why it is blocked. */
export function planTypeChange(rows: readonly Row[], field: FieldDefinition, target: FieldTypeName): TypeChangePlan {
  if (!isKnownType(target)) return { ok: false, reason: `Unknown type ${target}`, blockedRows: 0 };
  if (target === field.type) return { ok: false, reason: `Already ${field.type}`, blockedRows: 0 };
  // P8-03: link values cannot be converted to another type without losing their targets.
  if (field.type === 'link') return { ok: false, reason: 'Link fields keep their type', blockedRows: 0 };
  const note = NOT_A_TARGET[target];
  if (note) return { ok: false, reason: note, blockedRows: 0 };
  const targetType = getFieldType(target);
  if (targetType.readOnly) return { ok: false, reason: 'Read-only type', blockedRows: 0 };

  const next: FieldDefinition = { ...field, type: target };
  if (target !== 'single_select' && target !== 'multi_select') delete next.options;
  // P8: the formula and link keys belong only to their own types.
  if (target !== 'formula') delete next.formula;
  if (target !== 'link') delete next.linkTableId;

  const oldType = getFieldType(field.type);
  const valuesByRow: Record<string, CellValue> = {};
  let blocked = 0;
  for (const row of rows) {
    const old = row.values[field.id];
    if (isEmpty(old)) {
      valuesByRow[row.id] = null;
      continue;
    }
    const text = oldType.format(old as CellValue, field);
    const parsed = targetType.parse(text, next);
    if (parsed === null || !targetType.validate(parsed, next)) {
      blocked++;
      continue;
    }
    valuesByRow[row.id] = parsed;
  }
  if (blocked > 0) {
    return { ok: false, reason: `${blocked} value${blocked === 1 ? '' : 's'} cannot convert to ${target}`, blockedRows: blocked };
  }
  return { ok: true, field: next, valuesByRow };
}
