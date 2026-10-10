import { describe, it, expect } from 'vitest';
import type { FieldDefinition, ViewDefinition } from '../../src/model/types.js';
import {
  validateView,
  createDefaultView,
  cloneView,
  normalizeView,
  sanitizeViewsForSave,
} from '../../src/model/view.js';

const FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
  { id: 'fld_status', name: 'Status', type: 'single_select', options: [{ id: 'opt_a', name: 'A', color: 'gray' }] },
  { id: 'fld_score', name: 'Score', type: 'number' },
  { id: 'fld_due', name: 'Due', type: 'date' },
];

const BASE_VIEW: ViewDefinition = {
  id: 'view_1',
  name: 'Default',
  sort: [{ fieldId: 'fld_score', direction: 'asc' }],
  groupBy: 'fld_status',
  hidden: ['fld_due'],
  frozenColumns: 1,
  rowHeight: 'medium',
  columnWidths: { fld_name: 200, fld_score: 100 },
  columnOrder: ['fld_name', 'fld_status', 'fld_score', 'fld_due'],
  warnings: [],
};

describe('View — createDefaultView', () => {
  it('creates default view with expected defaults', () => {
    const v = createDefaultView(FIELDS);
    expect(v.sort).toEqual([]);
    expect(v.groupBy).toBeNull();
    expect(v.hidden).toEqual([]);
    expect(v.frozenColumns).toBe(1);
    expect(v.rowHeight).toBe('medium');
    expect(v.columnWidths).toEqual({});
    expect(v.columnOrder).toEqual(FIELDS.map((f) => f.id));
    expect(v.warnings).toEqual([]);
    expect(v.id).toMatch(/^view_/);
  });

  it('clone is deep', () => {
    const v = cloneView(BASE_VIEW);
    v.sort[0].fieldId = 'changed';
    v.hidden.push('fld_name');
    v.columnOrder.push('extra');
    v.columnWidths['fld_name'] = 999;
    expect(BASE_VIEW.sort[0].fieldId).toBe('fld_score');
    expect(BASE_VIEW.hidden).not.toContain('fld_name');
    expect(BASE_VIEW.columnOrder).not.toContain('extra');
    expect(BASE_VIEW.columnWidths['fld_name']).toBe(200);
  });
});

describe('View — validateView per-setting save/reload', () => {
  it('each setting survives validate round-trip when valid', () => {
    const v: ViewDefinition = {
      id: 'view_x',
      name: 'My View',
      sort: [
        { fieldId: 'fld_score', direction: 'desc' },
        { fieldId: 'fld_name', direction: 'asc' },
      ],
      groupBy: 'fld_due',
      hidden: ['fld_score'],
      frozenColumns: 2,
      rowHeight: 'large',
      columnWidths: { fld_name: 250, fld_status: 120 },
      columnOrder: ['fld_due', 'fld_name', 'fld_status', 'fld_score'],
      warnings: [],
    };
    const res = validateView(v, FIELDS);
    expect(res.ok).toBe(true);
    expect(res.warnings).toEqual([]);
    expect(res.view.sort).toEqual(v.sort);
    expect(res.view.groupBy).toBe('fld_due');
    expect(res.view.hidden).toEqual(['fld_score']);
    expect(res.view.frozenColumns).toBe(2);
    expect(res.view.rowHeight).toBe('large');
    expect(res.view.columnWidths).toEqual({ fld_name: 250, fld_status: 120 });
    expect(res.view.columnOrder).toEqual(['fld_due', 'fld_name', 'fld_status', 'fld_score']);
  });

  it('sort with unknown field is ignored with warning', () => {
    const v: ViewDefinition = { ...BASE_VIEW, sort: [{ fieldId: 'fld_unknown', direction: 'asc' }, { fieldId: 'fld_score', direction: 'desc' }] };
    const res = validateView(v, FIELDS);
    expect(res.ok).toBe(true);
    expect(res.view.sort).toEqual([{ fieldId: 'fld_score', direction: 'desc' }]);
    expect(res.warnings.join()).toContain('fld_unknown');
  });

  it('groupBy unknown is cleared with warning', () => {
    const v: ViewDefinition = { ...BASE_VIEW, groupBy: 'fld_unknown' };
    const res = validateView(v, FIELDS);
    expect(res.view.groupBy).toBeNull();
    expect(res.warnings.join()).toContain('fld_unknown');
  });

  it('hidden unknown field is ignored with warning', () => {
    const v: ViewDefinition = { ...BASE_VIEW, hidden: ['fld_unknown', 'fld_score'] };
    const res = validateView(v, FIELDS);
    expect(res.view.hidden).toEqual(['fld_score']);
    expect(res.warnings.join()).toContain('fld_unknown');
  });

  it('columnOrder missing fields appended with warning', () => {
    const v: ViewDefinition = { ...BASE_VIEW, columnOrder: ['fld_name'] };
    const res = validateView(v, FIELDS);
    expect(res.view.columnOrder).toEqual(['fld_name', 'fld_status', 'fld_score', 'fld_due']);
    expect(res.warnings.join()).toContain('missing');
  });

  it('columnOrder unknown field ignored with warning', () => {
    const v: ViewDefinition = { ...BASE_VIEW, columnOrder: ['fld_name', 'fld_unknown', 'fld_score', 'fld_due', 'fld_status'] };
    const res = validateView(v, FIELDS);
    expect(res.view.columnOrder).not.toContain('fld_unknown');
    expect(res.view.columnOrder.length).toBe(FIELDS.length);
    expect(res.warnings.join()).toContain('fld_unknown');
  });

  it('columnOrder duplicate ignored with warning', () => {
    const v: ViewDefinition = { ...BASE_VIEW, columnOrder: ['fld_name', 'fld_name', 'fld_score', 'fld_due', 'fld_status'] };
    const res = validateView(v, FIELDS);
    expect(res.view.columnOrder.filter((id) => id === 'fld_name').length).toBe(1);
    expect(res.warnings.join()).toContain('duplicate');
  });

  it('columnWidths unknown field ignored', () => {
    const v: ViewDefinition = { ...BASE_VIEW, columnWidths: { fld_unknown: 100, fld_name: 200 } };
    const res = validateView(v, FIELDS);
    expect(res.view.columnWidths).toEqual({ fld_name: 200 });
    expect(res.warnings.join()).toContain('fld_unknown');
  });

  it('columnWidths invalid width ignored with warning', () => {
    const v: ViewDefinition = { ...BASE_VIEW, columnWidths: { fld_name: -5 as unknown as number, fld_score: 3.14 as unknown as number } };
    const res = validateView(v, FIELDS);
    expect(res.view.columnWidths).toEqual({});
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('frozenColumns out of range clamped with warning', () => {
    const vHigh: ViewDefinition = { ...BASE_VIEW, frozenColumns: 99 };
    const resHigh = validateView(vHigh, FIELDS);
    expect(resHigh.view.frozenColumns).toBe(FIELDS.length);
    expect(resHigh.warnings.join()).toContain('exceeds');

    const vNeg: ViewDefinition = { ...BASE_VIEW, frozenColumns: -1 };
    const resNeg = validateView(vNeg, FIELDS);
    expect(resNeg.view.frozenColumns).toBe(0);
    expect(resNeg.warnings.join()).toContain('below');
  });

  it('rowHeight invalid set to medium with warning', () => {
    const v: ViewDefinition = { ...BASE_VIEW, rowHeight: 'huge' as unknown as typeof BASE_VIEW.rowHeight };
    const res = validateView(v, FIELDS);
    expect(res.view.rowHeight).toBe('medium');
    expect(res.warnings.join()).toContain('rowHeight');
  });

  it('sort direction invalid ignored', () => {
    const v: ViewDefinition = {
      ...BASE_VIEW,
      sort: [{ fieldId: 'fld_score', direction: 'invalid' as unknown as 'asc' }],
    };
    const res = validateView(v, FIELDS);
    expect(res.view.sort).toEqual([]);
    expect(res.warnings.join()).toContain('direction');
  });
});

describe('View — primary field cannot be hidden', () => {
  it('reject hiding primary field (R-D13)', () => {
    const v: ViewDefinition = { ...BASE_VIEW, hidden: ['fld_name'] }; // fld_name is primary
    const res = validateView(v, FIELDS);
    expect(res.ok).toBe(false);
    expect(res.errors.join()).toContain('Primary field');
    // original view unchanged immutability check
    expect(v.hidden).toEqual(['fld_name']);
  });

  it('hiding non-primary is allowed', () => {
    const v: ViewDefinition = { ...BASE_VIEW, hidden: ['fld_score'] };
    const res = validateView(v, FIELDS);
    expect(res.ok).toBe(true);
    expect(res.errors.length).toBe(0);
  });
});

describe('View — deleted field handling', () => {
  it('view referencing deleted field loads without error and warning recorded', () => {
    const raw = {
      id: 'view_del',
      name: 'With deleted',
      sort: [{ fieldId: 'fld_gone', direction: 'asc' }],
      groupBy: 'fld_gone',
      hidden: ['fld_gone', 'fld_score'],
      frozenColumns: 1,
      rowHeight: 'medium',
      columnWidths: { fld_gone: 120, fld_name: 200 },
      columnOrder: ['fld_gone', 'fld_name', 'fld_score', 'fld_due'],
      warnings: [],
    };
    const res = normalizeView(raw, FIELDS);
    expect(res.ok).toBe(true);
    expect(res.view.sort).toEqual([]);
    expect(res.view.groupBy).toBeNull();
    expect(res.view.hidden).toEqual(['fld_score']);
    expect(res.view.columnWidths).toEqual({ fld_name: 200 });
    expect(res.view.columnOrder).not.toContain('fld_gone');
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.view.warnings.join()).toContain('fld_gone');
  });

  it('normalizeView handles missing columnOrder — derived', () => {
    const raw = {
      id: 'view_no_order',
      name: 'No order',
      sort: [],
      groupBy: null,
      hidden: [],
      frozenColumns: 1,
      rowHeight: 'medium',
      columnWidths: {},
      // columnOrder missing
    };
    const res = normalizeView(raw, FIELDS);
    expect(res.view.columnOrder).toEqual(FIELDS.map((f) => f.id));
    expect(res.warnings.join()).toContain('columnOrder');
  });

  it('sanitizeViewsForSave: unknown field IDs stripped', () => {
    const views: ViewDefinition[] = [
      { ...BASE_VIEW, hidden: ['fld_unknown'] },
      { ...BASE_VIEW, id: 'view_2', hidden: [], sort: [{ fieldId: 'fld_unknown', direction: 'asc' }] },
    ];
    const sanitized = sanitizeViewsForSave(views, FIELDS);
    expect(sanitized[0].hidden).toEqual([]);
    expect(sanitized[0].warnings.join()).toContain('fld_unknown');
    expect(sanitized[1].sort).toEqual([]);
  });
});

describe('View — persistence via format parse/serialize', () => {
  it('each setting survives serialize→parse round-trip', async () => {
    const { parse } = await import('../../src/format/parse.js');
    const { serialize } = await import('../../src/format/serialize.js');
    const file = {
      formatVersion: 1 as const,
      tableId: 'tbl_test',
      name: 'Test',
      fields: FIELDS,
      rows: [],
      views: [BASE_VIEW],
      syncLink: null as const,
    };
    const s = serialize(file as never);
    const parsed = parse(s);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const view = parsed.data.views[0];
    expect(view.sort).toEqual(BASE_VIEW.sort);
    expect(view.groupBy).toBe(BASE_VIEW.groupBy);
    expect(view.hidden).toEqual(BASE_VIEW.hidden);
    expect(view.frozenColumns).toBe(BASE_VIEW.frozenColumns);
    expect(view.rowHeight).toBe(BASE_VIEW.rowHeight);
    expect(view.columnWidths).toEqual(BASE_VIEW.columnWidths);
    expect(view.columnOrder).toEqual(BASE_VIEW.columnOrder);
  });

  it('view referencing deleted field loads without parse error and warning recorded in view', async () => {
    const { parse } = await import('../../src/format/parse.js');
    const fields = FIELDS;
    const viewWithDeleted: ViewDefinition = {
      id: 'view_del2',
      name: 'Del',
      sort: [{ fieldId: 'fld_gone', direction: 'asc' }],
      groupBy: 'fld_gone',
      hidden: ['fld_gone'],
      frozenColumns: 1,
      rowHeight: 'medium',
      columnWidths: { fld_gone: 100 },
      columnOrder: ['fld_gone', 'fld_name', 'fld_score', 'fld_due'],
      warnings: [],
    };
    const file = {
      formatVersion: 1 as const,
      tableId: 'tbl_test2',
      name: 'Test2',
      fields,
      rows: [],
      views: [viewWithDeleted],
      syncLink: null as const,
    };
    const json = JSON.stringify(file);
    const parsed = parse(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const v = parsed.data.views[0];
    expect(v.hidden).not.toContain('fld_gone');
    expect(v.sort).toEqual([]);
    expect(v.groupBy).toBeNull();
    expect(v.warnings && v.warnings.length).toBeGreaterThan(0);
  });
});

describe('View — search and query persistence (SAD-69)', () => {
  /**
   * `search` and `query` are persisted view state added by SAD-69. They are OPTIONAL:
   * a file written before they existed must still round-trip byte-identical, so no code
   * path may inject empty defaults into a view that does not carry them.
   *
   * The load path (parse.ts) preserves unknown view keys as a side effect of its
   * "preserve unknown keys" loop, but the save path runs sanitizeViewsForSave →
   * validateView → cloneView, and cloneView copies field by field. Anything cloneView
   * does not name is silently dropped on every save. These tests pin both halves.
   */
  const withFilters: ViewDefinition = { ...BASE_VIEW, search: 'alpha', query: 'Status:done' };

  it('cloneView preserves search and query', () => {
    const c = cloneView(withFilters);
    expect(c.search).toBe('alpha');
    expect(c.query).toBe('Status:done');
  });

  it('validateView preserves search and query', () => {
    const res = validateView(withFilters, FIELDS);
    expect(res.ok).toBe(true);
    expect(res.view.search).toBe('alpha');
    expect(res.view.query).toBe('Status:done');
  });

  it('sanitizeViewsForSave keeps search and query', () => {
    const [out] = sanitizeViewsForSave([withFilters], FIELDS);
    expect(out.search).toBe('alpha');
    expect(out.query).toBe('Status:done');
  });

  it('normalizeView preserves search and query from raw JSON', () => {
    const res = normalizeView({ ...BASE_VIEW, search: 'beta', query: 'Score>3' }, FIELDS);
    expect(res.view.search).toBe('beta');
    expect(res.view.query).toBe('Score>3');
  });

  it('normalizeView drops non-string search/query and records warnings', () => {
    const res = normalizeView({ ...BASE_VIEW, search: 42, query: 7 }, FIELDS);
    expect(res.view.search).toBeUndefined();
    expect(res.view.query).toBeUndefined();
    expect(res.warnings.join(' ')).toContain('search');
    expect(res.warnings.join(' ')).toContain('query');
  });

  it('a view without search/query does not gain empty defaults', () => {
    // Guards the v1 sample fixtures and every file written before this change: adding
    // unconditional defaults would make each of them gain two keys on save and break the
    // byte-identical round-trip tests in tests/format/format.test.ts.
    const normalized = normalizeView({ ...BASE_VIEW }, FIELDS);
    expect('search' in normalized.view).toBe(false);
    expect('query' in normalized.view).toBe(false);

    const validated = validateView(BASE_VIEW, FIELDS);
    expect('search' in validated.view).toBe(false);
    expect('query' in validated.view).toBe(false);

    const [saved] = sanitizeViewsForSave([BASE_VIEW], FIELDS);
    expect('search' in saved).toBe(false);
    expect('query' in saved).toBe(false);
  });

  it('createDefaultView emits no search or query keys', () => {
    const v = createDefaultView(FIELDS);
    expect('search' in v).toBe(false);
    expect('query' in v).toBe(false);
  });

  it('search and query survive serialize → parse round-trip', async () => {
    const { parse } = await import('../../src/format/parse.js');
    const { serialize } = await import('../../src/format/serialize.js');
    const file = {
      formatVersion: 1 as const,
      tableId: 'tbl_test',
      name: 'Test',
      fields: FIELDS,
      rows: [],
      views: [withFilters],
      syncLink: null as const,
    };
    const parsed = parse(serialize(file as never));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.views[0].search).toBe('alpha');
    expect(parsed.data.views[0].query).toBe('Status:done');
  });

  it('a view without search/query round-trips without gaining them', async () => {
    const { parse } = await import('../../src/format/parse.js');
    const { serialize } = await import('../../src/format/serialize.js');
    const file = {
      formatVersion: 1 as const,
      tableId: 'tbl_test',
      name: 'Test',
      fields: FIELDS,
      rows: [],
      views: [BASE_VIEW],
      syncLink: null as const,
    };
    const parsed = parse(serialize(file as never));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect('search' in parsed.data.views[0]).toBe(false);
    expect('query' in parsed.data.views[0]).toBe(false);
  });
});
