// Table context menu model (P5-02). Pure logic, no Obsidian or DOM imports, unit-tested in Node.
// Spec: spec/steps/P5-02.md, FEATURES §2.17.
// Cell: Copy, Paste, Clear. Row: Insert above, Insert below, Duplicate, Copy, Delete.
// Header: Change field type (submenu), Hide field, Sort ascending, Sort descending, Freeze column.
// Items that do not apply are disabled with a reason (never silently missing).

import type { FieldTypeName, ViewDefinition } from '../model/types.js';

export interface MenuEntry {
  id: string;
  label: string;
  enabled: boolean;
  /** Shown when disabled. */
  reason?: string;
  separator?: boolean;
}

export const SEPARATOR: MenuEntry = { id: 'sep', label: '', enabled: false, separator: true };

/** Display names for field types (submenu of Change field type). */
export const TYPE_LABELS: Partial<Record<FieldTypeName, string>> = {
  text: 'Text',
  long_text: 'Long text',
  number: 'Number',
  currency: 'Currency',
  percent: 'Percent',
  duration: 'Duration',
  rating: 'Rating',
  checkbox: 'Checkbox',
  date: 'Date',
  date_time: 'Date and time',
  url: 'URL',
  email: 'Email',
  phone: 'Phone',
  single_select: 'Single select',
  multi_select: 'Multi select',
  attachment: 'Attachment',
  formula: 'Formula',
  link: 'Link',
};

/** Types offered by Change field type. System types (auto number, created/modified time) are not targets. */
export const CHANGE_TARGET_TYPES: FieldTypeName[] = [
  'text',
  'long_text',
  'number',
  'currency',
  'percent',
  'duration',
  'rating',
  'checkbox',
  'date',
  'date_time',
  'url',
  'email',
  'phone',
  'single_select',
  'multi_select',
  'attachment',
  'formula',
  'link',
];

export interface CellContext {
  readOnly: boolean;
  cellEmpty: boolean;
  hasClipboard: boolean;
  /** P8-04: a link cell is changed through the row picker, and paste is refused. */
  isLink?: boolean;
  /** P8-04 follow-up (R-5): links in this cell that point at a table other than the field's target. */
  foreignLinks?: number;
}

export function cellEntries(ctx: CellContext): MenuEntry[] {
  const entries: MenuEntry[] = [{ id: 'cell.copy', label: 'Copy', enabled: true }];
  if (ctx.isLink) {
    entries.push({ id: 'cell.links', label: 'Choose linked rows…', enabled: !ctx.readOnly });
    if ((ctx.foreignLinks ?? 0) > 0) {
      entries.push({ id: 'cell.removeForeign', label: 'Remove links to other tables', enabled: !ctx.readOnly });
    }
  }
  return [
    ...entries,
    {
      id: 'cell.paste',
      label: 'Paste',
      enabled: !ctx.readOnly && ctx.hasClipboard && !ctx.isLink,
      reason: ctx.readOnly
        ? 'Read-only field'
        : ctx.isLink
          ? 'Use Choose linked rows instead'
          : 'Nothing copied yet',
    },
    {
      id: 'cell.clear',
      label: 'Clear',
      enabled: !ctx.readOnly && !ctx.cellEmpty,
      reason: ctx.readOnly ? 'Read-only field' : 'Cell is already empty',
    },
  ];
}

/** Row items. All apply to any row; Insert uses stored order, so it works in sorted views too. */
export function rowEntries(): MenuEntry[] {
  return [
    { id: 'row.insertAbove', label: 'Insert row above', enabled: true },
    { id: 'row.insertBelow', label: 'Insert row below', enabled: true },
    { id: 'row.duplicate', label: 'Duplicate row', enabled: true },
    { id: 'row.copy', label: 'Copy row', enabled: true },
    { id: 'row.delete', label: 'Delete row', enabled: true },
  ];
}

/** One row of the type picker: whether the change is allowed, and why not. */
export interface TypeTarget {
  type: FieldTypeName;
  ok: boolean;
  /** Why the change is blocked (when ok is false). */
  reason?: string;
}

export interface HeaderContext {
  fieldId: string;
  isPrimary: boolean;
  /** 0-based index among visible columns. */
  colIndex: number;
  view: ViewDefinition;
  /** P8-03: the field's type, so a formula field gets "Edit formula…". */
  fieldType?: FieldTypeName;
}

export function headerEntries(ctx: HeaderContext): MenuEntry[] {
  const sort = ctx.view.sort;
  const sortedThis = sort.length === 1 && sort[0].fieldId === ctx.fieldId ? sort[0].direction : null;
  const frozenThrough = ctx.colIndex + 1;
  return [
    // Opens a type picker (no submenus in this Obsidian API version). See tableMenu.ts.
    { id: 'header.type', label: 'Change field type…', enabled: true },
    // P8-03: only formula fields have an expression to edit.
    ...(ctx.fieldType === 'formula' ? [{ id: 'header.formula', label: 'Edit formula…', enabled: true }] : []),
    {
      id: 'header.hide',
      label: 'Hide field',
      enabled: !ctx.isPrimary,
      reason: 'Primary field cannot be hidden',
    },
    {
      id: 'header.sortAsc',
      label: 'Sort ascending',
      enabled: sortedThis !== 'asc',
      reason: 'Already sorted ascending',
    },
    {
      id: 'header.sortDesc',
      label: 'Sort descending',
      enabled: sortedThis !== 'desc',
      reason: 'Already sorted descending',
    },
    {
      id: 'header.freeze',
      label: 'Freeze column',
      enabled: ctx.view.frozenColumns !== frozenThrough,
      reason: 'Already frozen through this column',
    },
  ];
}

/** Cell right-click: cell items, a separator, then row items. */
export function cellMenu(cell: CellContext): MenuEntry[] {
  return [...cellEntries(cell), SEPARATOR, ...rowEntries()];
}

/** Text for a disabled item: the label with its reason, so the user sees why. */
export function displayTitle(entry: MenuEntry): string {
  return entry.enabled || !entry.reason ? entry.label : `${entry.label} (${entry.reason})`;
}
