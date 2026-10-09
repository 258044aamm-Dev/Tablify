import { describe, it, expect } from 'vitest';
import { validateTable, validateCell, validateRegexPattern, isRegexSafe } from '../../src/model/validation.js';
import type { FieldDefinition, Row } from '../../src/model/types.js';

describe('Validation — required rule', () => {
  const field: FieldDefinition = { id: 'fld_name', name: 'Name', type: 'text', required: true };

  it('passes when value present', () => {
    const v = validateCell(field, 'hello');
    expect(v).toHaveLength(0);
  });

  it('fails when value null', () => {
    const v = validateCell(field, null);
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe('required');
  });

  it('fails when value empty string', () => {
    const v = validateCell(field, '');
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe('required');
  });

  it('fails when value empty array', () => {
    const msField: FieldDefinition = { id: 'fld_tags', name: 'Tags', type: 'multi_select', required: true };
    const v = validateCell(msField, []);
    expect(v).toHaveLength(1);
  });
});

describe('Validation — unique rule', () => {
  const field: FieldDefinition = { id: 'fld_email', name: 'Email', type: 'email', unique: true };

  const rows: Row[] = [
    { id: 'row_1', rev: 1, updatedAt: '2026-01-01T00:00:00Z', values: { fld_email: 'a@test.com' }, sync: null },
    { id: 'row_2', rev: 1, updatedAt: '2026-01-01T00:00:00Z', values: { fld_email: 'b@test.com' }, sync: null },
    { id: 'row_3', rev: 1, updatedAt: '2026-01-01T00:00:00Z', values: { fld_email: 'a@test.com' }, sync: null },
  ];

  it('passes when unique', () => {
    const v = validateCell(field, 'unique@test.com', rows, 'row_new');
    expect(v).toHaveLength(0);
  });

  it('fails when duplicate exists', () => {
    const v = validateCell(field, 'a@test.com', rows, 'row_1');
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe('unique');
  });

  it('compares trimmed values (case-sensitive)', () => {
    const v = validateCell(field, '  a@test.com  ', rows, 'row_new');
    // 'a@test.com' trimmed matches row_1 and row_3's 'a@test.com' trimmed
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe('unique');
  });
});

describe('Validation — min rule', () => {
  it('number min', () => {
    const field: FieldDefinition = { id: 'fld_age', name: 'Age', type: 'number', min: 18 };
    expect(validateCell(field, 20)).toHaveLength(0);
    expect(validateCell(field, 18)).toHaveLength(0);
    expect(validateCell(field, 17)).toHaveLength(1);
  });

  it('string min (date)', () => {
    const field: FieldDefinition = { id: 'fld_date', name: 'Date', type: 'date', min: '2026-01-01' };
    expect(validateCell(field, '2026-06-01')).toHaveLength(0);
    expect(validateCell(field, '2025-12-31')).toHaveLength(1);
  });

  it('null passes (not required)', () => {
    const field: FieldDefinition = { id: 'fld_age', name: 'Age', type: 'number', min: 18 };
    expect(validateCell(field, null)).toHaveLength(0);
  });
});

describe('Validation — max rule', () => {
  it('number max', () => {
    const field: FieldDefinition = { id: 'fld_score', name: 'Score', type: 'number', max: 100 };
    expect(validateCell(field, 100)).toHaveLength(0);
    expect(validateCell(field, 50)).toHaveLength(0);
    expect(validateCell(field, 101)).toHaveLength(1);
  });
});

describe('Validation — regex rule', () => {
  it('passes matching pattern', () => {
    const field: FieldDefinition = { id: 'fld_code', name: 'Code', type: 'text', regex: '^[A-Z]{3}$' };
    expect(validateCell(field, 'ABC')).toHaveLength(0);
  });

  it('fails non-matching pattern', () => {
    const field: FieldDefinition = { id: 'fld_code', name: 'Code', type: 'text', regex: '^[A-Z]{3}$' };
    expect(validateCell(field, 'abc')).toHaveLength(1);
    expect(validateCell(field, 'ABCD')).toHaveLength(1);
  });

  it('input length limit prevents ReDoS', () => {
    const field: FieldDefinition = { id: 'fld_text', name: 'Text', type: 'text', regex: '^(a+)+$' };
    const longInput = 'a'.repeat(10_001);
    const v = validateCell(field, longInput);
    expect(v).toHaveLength(1);
    expect(v[0].rule).toBe('regex');
    expect(v[0].message).toContain('maximum input length');
  });
});

describe('Validation — regex config', () => {
  it('validateRegexPattern accepts valid patterns', () => {
    expect(() => validateRegexPattern('^[a-z]+$')).not.toThrow();
    expect(() => validateRegexPattern('\\d{3}')).not.toThrow();
  });

  it('validateRegexPattern rejects invalid patterns', () => {
    expect(() => validateRegexPattern('[invalid')).toThrow('Invalid regex');
    expect(() => validateRegexPattern('(unclosed')).toThrow('Invalid regex');
  });
});

describe('Validation — regex safety (ReDoS)', () => {
  it('safe pattern returns true', () => {
    expect(isRegexSafe('^[a-z]+$')).toBe(true);
  });

  it('rejects invalid regex', () => {
    expect(isRegexSafe('[invalid')).toBe(false);
  });
});

describe('Validation — validateTable', () => {
  it('returns violations for all rows and fields', () => {
    const fields: FieldDefinition[] = [
      { id: 'fld_name', name: 'Name', type: 'text', required: true },
      { id: 'fld_age', name: 'Age', type: 'number', min: 0, max: 150 },
    ];
    const rows: Row[] = [
      { id: 'row_1', rev: 1, updatedAt: '2026-01-01T00:00:00Z', values: { fld_name: 'Alice', fld_age: 30 }, sync: null },
      { id: 'row_2', rev: 1, updatedAt: '2026-01-01T00:00:00Z', values: { fld_name: null, fld_age: 200 }, sync: null },
    ];

    const violations = validateTable(fields, rows);
    // row_2: name required (null), age max (200 > 150)
    expect(violations.length).toBe(2);
    expect(violations.some(v => v.rule === 'required' && v.fieldId === 'fld_name')).toBe(true);
    expect(violations.some(v => v.rule === 'max' && v.fieldId === 'fld_age')).toBe(true);
  });
});

describe('Validation — incremental vs full match', () => {
  it('cell validation matches table validation for each row', () => {
    const fields: FieldDefinition[] = [
      { id: 'fld_a', name: 'A', type: 'text', required: true },
      { id: 'fld_b', name: 'B', type: 'number', min: 0, max: 100 },
    ];
    const rows: Row[] = [
      { id: 'row_1', rev: 1, updatedAt: '2026-01-01T00:00:00Z', values: { fld_a: 'x', fld_b: 50 }, sync: null },
      { id: 'row_2', rev: 1, updatedAt: '2026-01-01T00:00:00Z', values: { fld_a: null, fld_b: -1 }, sync: null },
      { id: 'row_3', rev: 1, updatedAt: '2026-01-01T00:00:00Z', values: { fld_a: 'y', fld_b: 200 }, sync: null },
    ];

    const tableViolations = validateTable(fields, rows);

    // Incremental: validate each cell individually
    const incrementalViolations: typeof tableViolations = [];
    for (const field of fields) {
      for (const row of rows) {
        const cellV = validateCell(field, row.values[field.id], rows, row.id);
        incrementalViolations.push(...cellV);
      }
    }

    // Sort for comparison
    const sortKey = (v: { rowId: string; fieldId: string; rule: string }) => `${v.rowId}:${v.fieldId}:${v.rule}`;
    const tableSorted = [...tableViolations].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const incrementalSorted = [...incrementalViolations].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

    expect(incrementalSorted).toEqual(tableSorted);
  });
});
