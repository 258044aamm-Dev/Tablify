import type { FieldTypeName } from '../types.js';
import type { FieldType } from './interface.js';
import { textType, longTextType } from './text.js';
import { numberType, currencyType, percentType, durationType, ratingType } from './number.js';
import { checkboxType } from './boolean.js';
import { dateType, dateTimeType } from './date.js';
import { urlType, emailType, phoneType } from './string.js';
import { singleSelectType, multiSelectType } from './select.js';
import { attachmentType } from './attachment.js';
import { autoNumberType, createdTimeType, modifiedTimeType } from './system.js';

const registry = new Map<FieldTypeName, FieldType>([
  ['text', textType],
  ['long_text', longTextType],
  ['number', numberType],
  ['currency', currencyType],
  ['percent', percentType],
  ['duration', durationType],
  ['rating', ratingType],
  ['checkbox', checkboxType],
  ['date', dateType],
  ['date_time', dateTimeType],
  ['url', urlType],
  ['email', emailType],
  ['phone', phoneType],
  ['single_select', singleSelectType],
  ['multi_select', multiSelectType],
  ['attachment', attachmentType],
  ['auto_number', autoNumberType],
  ['created_time', createdTimeType],
  ['modified_time', modifiedTimeType],
]);

/**
 * Get the FieldType implementation for a given type name.
 * Throws if the type is unknown — never returns a silent default.
 */
export function getFieldType(name: FieldTypeName): FieldType {
  const ft = registry.get(name);
  if (!ft) {
    throw new Error(`Unknown field type: "${name}". Registered types: ${ALL_TYPE_NAMES.join(', ')}`);
  }
  return ft;
}

/** Type guard: returns true if the name is a known field type */
export function isKnownType(name: string): name is FieldTypeName {
  return registry.has(name as FieldTypeName);
}

/** All registered type names */
export const ALL_TYPE_NAMES: readonly FieldTypeName[] = [
  'text', 'long_text', 'number', 'currency', 'percent',
  'duration', 'rating', 'checkbox', 'date', 'date_time',
  'url', 'email', 'phone',
  'single_select', 'multi_select', 'attachment',
  'auto_number', 'created_time', 'modified_time',
];

/** Number of registered types */
export const TYPE_COUNT = registry.size;
