import { describe, it, expect } from 'vitest';
import { getFieldType, isKnownType, ALL_TYPE_NAMES, TYPE_COUNT } from '../../src/model/fieldTypes/registry.js';
import type { FieldDefinition, SelectOption } from '../../src/model/types.js';

// Helper: create a select field with options
function selectField(options: SelectOption[]): FieldDefinition {
  return {
    id: 'fld_status',
    name: 'Status',
    type: 'single_select',
    options,
  };
}

const TEST_OPTIONS: SelectOption[] = [
  { id: 'opt_todo', name: 'To do', color: 'gray' },
  { id: 'opt_done', name: 'Done', color: 'green' },
];

describe('Field type registry', () => {
  it('has exactly 19 registered types', () => {
    expect(TYPE_COUNT).toBe(19);
    expect(ALL_TYPE_NAMES).toHaveLength(19);
  });

  it('every type name resolves to a FieldType', () => {
    for (const name of ALL_TYPE_NAMES) {
      const ft = getFieldType(name);
      expect(ft).toBeDefined();
      expect(typeof ft.validate).toBe('function');
      expect(typeof ft.parse).toBe('function');
      expect(typeof ft.format).toBe('function');
      expect(typeof ft.defaultValue).toBe('function');
      expect(typeof ft.readOnly).toBe('boolean');
    }
  });

  it('isKnownType returns true for all registered types', () => {
    for (const name of ALL_TYPE_NAMES) {
      expect(isKnownType(name)).toBe(true);
    }
  });

  it('throws on unknown type', () => {
    expect(() => getFieldType('nonexistent' as never)).toThrow('Unknown field type');
  });

  it('isKnownType returns false for unknown', () => {
    expect(isKnownType('nonexistent')).toBe(false);
  });
});

// ---- Per-type table-driven tests (≥5 cases each) ----

describe('text type', () => {
  const ft = getFieldType('text');

  it.each([
    ['hello', true],
    ['', true],
    [null, true],
    [123, false],
    ['a'.repeat(10000), true],
    ['a'.repeat(10001), false],
  ])('validate(%p) → %p', (value, expected) => {
    expect(ft.validate(value)).toBe(expected);
  });

  it('parse returns string', () => {
    expect(ft.parse('hello')).toBe('hello');
  });

  it('format returns string', () => {
    expect(ft.format('hello')).toBe('hello');
    expect(ft.format(null)).toBe('');
  });

  it('default is null', () => {
    expect(ft.defaultValue()).toBe(null);
  });

  it('not read-only', () => {
    expect(ft.readOnly).toBe(false);
  });
});

describe('long_text type', () => {
  const ft = getFieldType('long_text');

  it.each([
    ['multiline\ntext', true],
    [null, true],
    [42, false],
    ['a'.repeat(100000), true],
    ['a'.repeat(100001), false],
  ])('validate(%p) → %p', (value, expected) => {
    expect(ft.validate(value)).toBe(expected);
  });
});

describe('number type', () => {
  const ft = getFieldType('number');

  it.each([
    [42, true],
    [-3.14, true],
    [0, true],
    [null, true],
    [NaN, false],
    [Infinity, false],
    ['42', false],
  ])('validate(%p) → %p', (value, expected) => {
    expect(ft.validate(value)).toBe(expected);
  });

  it('parse valid number', () => {
    expect(ft.parse('42')).toBe(42);
    expect(ft.parse('-3.14')).toBe(-3.14);
  });

  it('parse empty → null', () => {
    expect(ft.parse('')).toBe(null);
  });

  it('parse NaN → null', () => {
    expect(ft.parse('abc')).toBe(null);
  });

  it('format', () => {
    expect(ft.format(42)).toBe('42');
    expect(ft.format(null)).toBe('');
  });
});

describe('currency type', () => {
  const ft = getFieldType('currency');

  it('validate integer minor units', () => {
    expect(ft.validate(1050)).toBe(true);  // $10.50
    expect(ft.validate(0)).toBe(true);
    expect(ft.validate(null)).toBe(true);
    expect(ft.validate(-1)).toBe(false);
    expect(ft.validate(10.5)).toBe(false);  // not integer
  });

  it('parse decimal string to cents', () => {
    expect(ft.parse('10.50')).toBe(1050);
    expect(ft.parse('$10.50')).toBe(1050);
    expect(ft.parse('0')).toBe(0);
    expect(ft.parse('')).toBe(null);
  });

  it('format cents to display', () => {
    expect(ft.format(1050)).toBe('10.50');
    expect(ft.format(0)).toBe('0.00');
    expect(ft.format(null)).toBe('');
  });
});

describe('percent type', () => {
  const ft = getFieldType('percent');

  it('validate 0-1 range', () => {
    expect(ft.validate(0)).toBe(true);
    expect(ft.validate(0.75)).toBe(true);
    expect(ft.validate(1)).toBe(true);
    expect(ft.validate(null)).toBe(true);
    expect(ft.validate(1.1)).toBe(false);
    expect(ft.validate(-0.1)).toBe(false);
  });

  it('parse percentage string', () => {
    expect(ft.parse('75%')).toBe(0.75);
    expect(ft.parse('0.5')).toBe(0.5);
    expect(ft.parse('')).toBe(null);
  });

  it('format as percentage', () => {
    expect(ft.format(0.75)).toBe('75%');
    expect(ft.format(null)).toBe('');
  });
});

describe('duration type', () => {
  const ft = getFieldType('duration');

  it('validate non-negative integer ms', () => {
    expect(ft.validate(0)).toBe(true);
    expect(ft.validate(3600000)).toBe(true);
    expect(ft.validate(null)).toBe(true);
    expect(ft.validate(-1)).toBe(false);
    expect(ft.validate(1.5)).toBe(false);
  });

  it('parse HH:MM:SS', () => {
    expect(ft.parse('1:30:00')).toBe(5400000);
    expect(ft.parse('0:01:30')).toBe(90000);
  });

  it('parse Xh Ym', () => {
    expect(ft.parse('2h 30m')).toBe(9000000);
    expect(ft.parse('45m')).toBe(2700000);
  });

  it('parse raw ms', () => {
    expect(ft.parse('5000')).toBe(5000);
  });

  it('format human-readable', () => {
    expect(ft.format(5400000)).toBe('1h 30m 00s');
    expect(ft.format(90000)).toBe('1m 30s');
    expect(ft.format(5000)).toBe('5s');
    expect(ft.format(null)).toBe('');
  });
});

describe('rating type', () => {
  const ft = getFieldType('rating');

  it('validate 1-10', () => {
    expect(ft.validate(1)).toBe(true);
    expect(ft.validate(10)).toBe(true);
    expect(ft.validate(5)).toBe(true);
    expect(ft.validate(null)).toBe(true);
    expect(ft.validate(0)).toBe(false);
    expect(ft.validate(11)).toBe(false);
  });

  it('parse with clamping', () => {
    expect(ft.parse('5')).toBe(5);
    expect(ft.parse('15')).toBe(10);
    expect(ft.parse('-1')).toBe(1);
  });
});

describe('checkbox type', () => {
  const ft = getFieldType('checkbox');

  it.each([
    [true, true],
    [false, true],
    [null, true],
    ['yes', false],
    [1, false],
  ])('validate(%p) → %p', (value, expected) => {
    expect(ft.validate(value)).toBe(expected);
  });

  it('parse various truthy/falsy', () => {
    expect(ft.parse('true')).toBe(true);
    expect(ft.parse('yes')).toBe(true);
    expect(ft.parse('1')).toBe(true);
    expect(ft.parse('✓')).toBe(true);
    expect(ft.parse('false')).toBe(false);
    expect(ft.parse('no')).toBe(false);
    expect(ft.parse('0')).toBe(false);
    expect(ft.parse('')).toBe(null);
  });

  it('format', () => {
    expect(ft.format(true)).toBe('✓');
    expect(ft.format(false)).toBe('');
    expect(ft.format(null)).toBe('');
  });
});

describe('date type', () => {
  const ft = getFieldType('date');

  it('validate YYYY-MM-DD', () => {
    expect(ft.validate('2026-10-09')).toBe(true);
    expect(ft.validate(null)).toBe(true);
    expect(ft.validate('not-a-date')).toBe(false);
    expect(ft.validate('2026-13-01')).toBe(false);
    expect(ft.validate('2026-02-30')).toBe(false);
  });

  it('parse date strings', () => {
    expect(ft.parse('2026-10-09')).toBe('2026-10-09');
    expect(ft.parse('')).toBe(null);
  });

  it('handles leap day', () => {
    expect(ft.validate('2024-02-29')).toBe(true);
    expect(ft.validate('2023-02-29')).toBe(false);
  });
});

describe('date_time type', () => {
  const ft = getFieldType('date_time');

  it('validate ISO 8601', () => {
    expect(ft.validate('2026-10-09T10:00:00Z')).toBe(true);
    expect(ft.validate('2026-10-09T10:00:00.000Z')).toBe(true);
    expect(ft.validate(null)).toBe(true);
    expect(ft.validate('not-a-date')).toBe(false);
  });

  it('parse ISO strings', () => {
    const result = ft.parse('2026-10-09T10:00:00Z');
    expect(result).toBe('2026-10-09T10:00:00.000Z');
    expect(ft.parse('')).toBe(null);
  });
});

describe('url type', () => {
  const ft = getFieldType('url');

  it('validate URLs', () => {
    expect(ft.validate('https://example.com')).toBe(true);
    expect(ft.validate('http://example.com/path')).toBe(true);
    expect(ft.validate(null)).toBe(true);
    expect(ft.validate('')).toBe(true);  // empty is valid (nullable)
    expect(ft.validate('not-a-url')).toBe(false);
  });

  it('parse preserves input', () => {
    expect(ft.parse('https://example.com')).toBe('https://example.com');
    expect(ft.parse('')).toBe(null);
  });
});

describe('email type', () => {
  const ft = getFieldType('email');

  it('validate emails', () => {
    expect(ft.validate('user@example.com')).toBe(true);
    expect(ft.validate(null)).toBe(true);
    expect(ft.validate('')).toBe(true);
    expect(ft.validate('not-an-email')).toBe(false);
    expect(ft.validate('@missing.com')).toBe(false);
  });

  it('parse lowercases and trims', () => {
    expect(ft.parse('  User@Example.COM  ')).toBe('user@example.com');
    expect(ft.parse('')).toBe(null);
  });
});

describe('phone type', () => {
  const ft = getFieldType('phone');

  it('validate phone numbers', () => {
    expect(ft.validate('+1 (555) 123-4567')).toBe(true);
    expect(ft.validate('+44 20 7946 0958')).toBe(true);
    expect(ft.validate(null)).toBe(true);
    expect(ft.validate('')).toBe(true);
    expect(ft.validate('abc')).toBe(false);
  });

  it('parse preserves format', () => {
    expect(ft.parse('+1 555-1234')).toBe('+1 555-1234');
    expect(ft.parse('')).toBe(null);
  });
});

describe('single_select type', () => {
  const ft = getFieldType('single_select');
  const field = selectField(TEST_OPTIONS);

  it('validate option IDs', () => {
    expect(ft.validate('opt_todo', field)).toBe(true);
    expect(ft.validate('opt_done', field)).toBe(true);
    expect(ft.validate(null, field)).toBe(true);
    expect(ft.validate('opt_unknown', field)).toBe(false);
  });

  it('parse by case-insensitive name match', () => {
    expect(ft.parse('To do', field)).toBe('opt_todo');
    expect(ft.parse('TO DO', field)).toBe('opt_todo');
    expect(ft.parse('  done  ', field)).toBe('opt_done');
    expect(ft.parse('unknown', field)).toBe(null);
    expect(ft.parse('', field)).toBe(null);
  });

  it('format option ID to name', () => {
    expect(ft.format('opt_todo', field)).toBe('To do');
    expect(ft.format(null, field)).toBe('');
  });
});

describe('multi_select type', () => {
  const ft = getFieldType('multi_select');
  const field: FieldDefinition = { ...selectField(TEST_OPTIONS), type: 'multi_select' };

  it('validate arrays of option IDs', () => {
    expect(ft.validate(['opt_todo'], field)).toBe(true);
    expect(ft.validate(['opt_todo', 'opt_done'], field)).toBe(true);
    expect(ft.validate(null, field)).toBe(true);
    expect(ft.validate(['opt_unknown'], field)).toBe(false);
  });

  it('parse comma-separated names', () => {
    expect(ft.parse('To do, Done', field)).toEqual(['opt_todo', 'opt_done']);
    expect(ft.parse('', field)).toBe(null);
  });

  it('format array to names', () => {
    expect(ft.format(['opt_todo', 'opt_done'], field)).toBe('To do, Done');
    expect(ft.format(null, field)).toBe('');
  });
});

describe('attachment type', () => {
  const ft = getFieldType('attachment');

  it('validate path strings', () => {
    expect(ft.validate('Assets/photo.png')).toBe(true);
    expect(ft.validate(null)).toBe(true);
    expect(ft.validate(123)).toBe(false);
  });

  it('parse trims whitespace', () => {
    expect(ft.parse('  Assets/photo.png  ')).toBe('Assets/photo.png');
    expect(ft.parse('')).toBe(null);
  });
});

describe('system types (read-only)', () => {
  it('auto_number is read-only', () => {
    const ft = getFieldType('auto_number');
    expect(ft.readOnly).toBe(true);
    expect(ft.validate(42)).toBe(true);
    expect(ft.validate(0)).toBe(true);
    expect(ft.validate(null)).toBe(false);
    expect(ft.defaultValue()).toBe(0);
  });

  it('created_time is read-only', () => {
    const ft = getFieldType('created_time');
    expect(ft.readOnly).toBe(true);
    const val = ft.defaultValue();
    expect(typeof val).toBe('string');
    expect(ft.validate(val as string)).toBe(true);
  });

  it('modified_time is read-only', () => {
    const ft = getFieldType('modified_time');
    expect(ft.readOnly).toBe(true);
    const val = ft.defaultValue();
    expect(typeof val).toBe('string');
    expect(ft.validate(val as string)).toBe(true);
  });
});
