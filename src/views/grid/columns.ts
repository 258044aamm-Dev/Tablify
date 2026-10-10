/**
 * Column and row layout — resize, reorder, freeze, rowHeight.
 * Uses src/model/view.ts for validation; writes via ViewDefinition only.
 */

import { validateView } from '../../model/view.js';
import type { ViewDefinition, FieldDefinition } from '../../model/types.js';

export const MIN_WIDTH = 60;

export function resizeColumn(view: ViewDefinition, fieldId: string, newWidth: number, fields: FieldDefinition[]): ViewDefinition {
  const w = Math.max(MIN_WIDTH, Math.round(newWidth));
  const next: ViewDefinition = {
    ...view,
    columnWidths: { ...(view.columnWidths ?? {}), [fieldId]: w },
  };
  const res = validateView(next, fields);
  if (!res.ok) return view;
  return res.view;
}

export function reorderColumn(view: ViewDefinition, fieldId: string, direction: 'left' | 'right', fields: FieldDefinition[]): ViewDefinition {
  const order = [...(view.columnOrder ?? fields.map((f) => f.id))];
  const idx = order.indexOf(fieldId);
  if (idx === -1) return view;
  const newIdx = direction === 'left' ? Math.max(0, idx - 1) : Math.min(order.length - 1, idx + 1);
  if (newIdx === idx) return view;
  order.splice(idx, 1);
  order.splice(newIdx, 0, fieldId);
  const next: ViewDefinition = { ...view, columnOrder: order };
  const res = validateView(next, fields);
  return res.ok ? res.view : view;
}

export function reorderByDrag(view: ViewDefinition, fromIdx: number, toIdx: number, fields: FieldDefinition[]): ViewDefinition {
  const order = [...(view.columnOrder ?? fields.map((f) => f.id))];
  if (fromIdx < 0 || fromIdx >= order.length || toIdx < 0 || toIdx >= order.length) return view;
  const [moved] = order.splice(fromIdx, 1);
  order.splice(toIdx, 0, moved);
  const next: ViewDefinition = { ...view, columnOrder: order };
  const res = validateView(next, fields);
  return res.ok ? res.view : view;
}

export function setFrozenColumns(view: ViewDefinition, n: number, fields: FieldDefinition[]): ViewDefinition {
  const clamped = Math.max(0, Math.min(fields.length, Math.round(n)));
  const next: ViewDefinition = { ...view, frozenColumns: clamped };
  const res = validateView(next, fields);
  return res.ok ? res.view : view;
}

/**
 * Set the row height.
 *
 * SAD-69: narrowed to the three values tablify.schema.json allows (small/medium/large).
 * The model's RowHeight type also permits 'compact' and 'tall', and rowHeightPx() renders
 * them, but writing either produces a file the schema rejects. The Options menu therefore
 * offers only these three.
 */
export function setRowHeight(view: ViewDefinition, h: 'small' | 'medium' | 'large', fields: FieldDefinition[]): ViewDefinition {
  const next: ViewDefinition = { ...view, rowHeight: h };
  const res = validateView(next, fields);
  return res.ok ? res.view : view;
}
