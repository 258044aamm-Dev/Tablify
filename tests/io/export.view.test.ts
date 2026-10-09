// T-U for P4-05: export scope — current view vs full table, hidden fields, order, sort, filter.
import { describe, it, expect } from 'vitest';
import { resolveExportTable, cellText, sortRows } from '../../src/io/export/view.js';
import { makeFile, VIEW, FIELDS } from './export.fixtures.js';
import type { Row } from '../../src/model/types.js';

describe('current view (default)', () => {
  it('hides hidden fields and orders columns by columnOrder', () => {
    const r = resolveExportTable(makeFile(5), { fullTable: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const names = r.table.fields.map((f) => f.name);
    expect(names).not.toContain('Secret');
    expect(names[0]).toBe('Name');
    expect(names[1]).toBe('Amount');
  });

  it('sorts by the view sort (Amount desc), nulls last', () => {
    const file = makeFile(60);
    const r = resolveExportTable(file, { fullTable: false });
    if (!r.ok) throw new Error(r.error);
    const amountId = 'fld_amount';
    const values = r.table.rows.map((row) => row.values[amountId]);
    const nums = values.filter((v): v is number => typeof v === 'number');
    expect(nums).toEqual([...nums].sort((a, b) => b - a));
    const firstNull = values.indexOf(null);
    expect(firstNull).toBeGreaterThan(-1);
    expect(values.slice(firstNull).every((v) => v === null)).toBe(true);
  });

  it('applies a query filter', () => {
    const r = resolveExportTable(makeFile(30), { fullTable: false, query: 'Done:true' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.rows.length).toBeGreaterThan(0);
    expect(r.table.rows.every((row) => row.values['fld_done'] === true)).toBe(true);
  });

  it('a bad query is an error, not a silent full export', () => {
    const r = resolveExportTable(makeFile(3), { fullTable: false, query: 'NoSuchField = 1' });
    expect(r.ok).toBe(false);
  });

  it('no views → error that points to full table', () => {
    const file = makeFile(3);
    file.views = [];
    const r = resolveExportTable(file, { fullTable: false });
    expect(r.ok).toBe(false);
  });
});

describe('full table', () => {
  it('includes every field (hidden too) and every row, in file order', () => {
    const file = makeFile(20);
    const r = resolveExportTable(file, { fullTable: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.fields.map((f) => f.id)).toEqual(FIELDS.map((f) => f.id));
    expect(r.table.rows.map((row) => row.id)).toEqual(file.rows.map((row) => row.id));
  });
});

describe('sortRows', () => {
  it('multi-key and stable', () => {
    const rows: Row[] = [
      { id: '1', rev: 1, updatedAt: '', sync: null, values: { a: 'x', b: 2 } },
      { id: '2', rev: 1, updatedAt: '', sync: null, values: { a: 'x', b: 1 } },
      { id: '3', rev: 1, updatedAt: '', sync: null, values: { a: 'a', b: 9 } },
    ];
    const fields = [
      { id: 'a', name: 'a', type: 'text' as const },
      { id: 'b', name: 'b', type: 'number' as const },
    ];
    const sorted = sortRows(rows, [{ fieldId: 'a', direction: 'asc' }, { fieldId: 'b', direction: 'asc' }], fields);
    expect(sorted.map((r) => r.id)).toEqual(['3', '2', '1']);
  });
  it('natural order for text with numbers', () => {
    const rows: Row[] = ['Item 10', 'Item 2', 'Item 1'].map((t, i) => ({ id: String(i), rev: 1, updatedAt: '', sync: null, values: { a: t } }));
    const sorted = sortRows(rows, [{ fieldId: 'a', direction: 'asc' }], [{ id: 'a', name: 'a', type: 'text' }]);
    expect(sorted.map((r) => r.values.a)).toEqual(['Item 1', 'Item 2', 'Item 10']);
  });
});

describe('cellText', () => {
  it('checkbox exports true/false, not the on-screen check mark', () => {
    const f = FIELDS.find((x) => x.id === 'fld_done')!;
    expect(cellText(true, f)).toBe('true');
    expect(cellText(false, f)).toBe('false');
    expect(cellText(null, f)).toBe('');
  });
  it('select and multi-select export option names (display join ", ")', () => {
    expect(cellText('opt_doing', FIELDS.find((x) => x.id === 'fld_status')!)).toBe('Doing');
    expect(cellText(['opt_a', 'opt_b'], FIELDS.find((x) => x.id === 'fld_tags')!)).toBe('Alpha, Beta; x');
  });
  it('uses the view constant without mutation', () => {
    expect(VIEW.hidden).toEqual(['fld_hidden']);
  });
});
