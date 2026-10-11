/**
 * Header-capsule type badge (SAD-79): the prototype's `FT[type].icon` glyph plus the raw type
 * name, with the display label as the tooltip (Prototype/script.js `headCellHtml`).
 */

import type { FieldTypeName } from '../../model/types.js';
import type { FaGlyph } from '../../ui/faIcons.js';
import { TYPE_LABELS } from '../../menus/tableMenuModel.js';

/** Prototype `FT[type].icon`, solid set. */
const TYPE_ICONS: Record<FieldTypeName, FaGlyph> = {
  text: 'font',
  long_text: 'align-left',
  number: 'hashtag',
  currency: 'dollar-sign',
  percent: 'percent',
  duration: 'stopwatch',
  rating: 'star',
  checkbox: 'square-check',
  date: 'calendar',
  date_time: 'clock',
  url: 'link',
  email: 'envelope',
  phone: 'phone',
  single_select: 'circle-dot',
  multi_select: 'list-check',
  attachment: 'paperclip',
  formula: 'square-root-variable',
  link: 'diagram-project',
  auto_number: 'arrow-down-1-9',
  created_time: 'calendar-plus',
  modified_time: 'calendar-check',
};

/** Labels for the system types that Change field type does not offer (prototype `FT[type].label`). */
const SYSTEM_LABELS: Partial<Record<FieldTypeName, string>> = {
  auto_number: 'Auto number',
  created_time: 'Created time',
  modified_time: 'Last modified',
};

export function typeIcon(type: string): FaGlyph {
  return TYPE_ICONS[type as FieldTypeName] ?? 'font';
}

export function typeLabel(type: string): string {
  const t = type as FieldTypeName;
  return TYPE_LABELS[t] ?? SYSTEM_LABELS[t] ?? type;
}
