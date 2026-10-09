import type { CellValue, FieldDefinition } from '../types.js';
import type { FieldType } from './interface.js';

/** single_select — stores option ID (string) or null */
export const singleSelectType: FieldType = {
  readOnly: false,

  validate(value: CellValue, field?: FieldDefinition): boolean {
    if (value === null) return true;
    if (typeof value !== 'string') return false;
    if (!field?.options) return false;
    return field.options.some(opt => opt.id === value);
  },

  parse(input: string, field?: FieldDefinition): CellValue {
    const trimmed = input.trim();
    if (trimmed === '') return null;
    if (!field?.options) return null;

    // Match by trimmed, case-insensitive name
    const lower = trimmed.toLowerCase();
    const match = field.options.find(opt => opt.name.trim().toLowerCase() === lower);
    return match ? match.id : null;
  },

  format(value: CellValue, field?: FieldDefinition): string {
    if (value === null) return '';
    if (typeof value !== 'string' || !field?.options) return '';
    const opt = field.options.find(o => o.id === value);
    return opt ? opt.name : '';
  },

  defaultValue(): CellValue {
    return null;
  },
};

/** multi_select — stores array of option IDs or null */
export const multiSelectType: FieldType = {
  readOnly: false,

  validate(value: CellValue, field?: FieldDefinition): boolean {
    if (value === null) return true;
    if (!Array.isArray(value)) return false;
    if (!field?.options) return value.length === 0;
    const optionIds = new Set(field.options.map(o => o.id));
    return value.every(v => typeof v === 'string' && optionIds.has(v));
  },

  parse(input: string, field?: FieldDefinition): CellValue {
    const trimmed = input.trim();
    if (trimmed === '') return null;
    if (!field?.options) return null;

    const parts = trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (parts.length === 0) return null;

    const result: string[] = [];
    for (const part of parts) {
      const lower = part.toLowerCase();
      const match = field.options.find(opt => opt.name.trim().toLowerCase() === lower);
      if (match) {
        result.push(match.id);
      }
    }
    return result.length > 0 ? result : null;
  },

  format(value: CellValue, field?: FieldDefinition): string {
    if (value === null || !Array.isArray(value)) return '';
    if (!field?.options) return '';
    return value
      .map(id => {
        const opt = field.options!.find(o => o.id === id);
        return opt ? opt.name : '';
      })
      .filter(s => s.length > 0)
      .join(', ');
  },

  defaultValue(): CellValue {
    return null;
  },
};
