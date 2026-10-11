/**
 * SAD-86 — Add Field extras (select options, validation rules) and the formula preview.
 *
 * The prototype's Add Field dialog sets options and rules while the field is created. The rules
 * are stored on the new field only (FORMAT_SPEC keys `required`, `unique`, `min`, `max`, `regex`);
 * nothing checks the grid against them yet. A field added without extras must come out exactly
 * as before.
 */

import { describe, it, expect } from 'vitest';
import { applyNewFieldExtras, createSession } from '../../src/model/tableSession.js';
import { previewFormula, EMPTY_PREVIEW, NO_ROWS_PREVIEW } from '../../src/model/formulaPreview.js';
import { makeFile } from '../io/export.fixtures.js';
import { parse } from '../../src/format/parse.js';
import { serialize } from '../../src/format/serialize.js';
import type { FieldDefinition, Row } from '../../src/model/types.js';

const field = (type: FieldDefinition['type']): FieldDefinition => ({ id: 'fld_new', name: 'New', type });

describe('applyNewFieldExtras', () => {
  it('creates select options in order, with generated ids and colours, skipping blanks and duplicates', () => {
    const f = field('single_select');
    applyNewFieldExtras(f, { options: ['Backlog', '  ', 'Doing', 'backlog', 'Done'] });
    expect(f.options?.map((o) => o.name)).toEqual(['Backlog', 'Doing', 'Done']);
    const ids = f.options?.map((o) => o.id) ?? [];
    expect(new Set(ids).size).toBe(3);
    for (const o of f.options ?? []) expect(typeof o.color).toBe('string');
    expect(f.options?.[0].color).not.toBe(f.options?.[1].color);
  });

  it('gives a multi select options too, and ignores options for other types', () => {
    const m = field('multi_select');
    applyNewFieldExtras(m, { options: ['A', 'B'] });
    expect(m.options?.map((o) => o.name)).toEqual(['A', 'B']);
    const t = field('text');
    applyNewFieldExtras(t, { options: ['A'] });
    expect(t.options).toBeUndefined();
  });

  it('writes only the rules that are set (0 is a real bound)', () => {
    const f = field('number');
    applyNewFieldExtras(f, { required: true, unique: false, min: 0, max: null, regex: '' });
    expect(f).toEqual({ id: 'fld_new', name: 'New', type: 'number', required: true, min: 0 });
  });

  it('keeps date bounds and a regex as given', () => {
    const f = field('date');
    applyNewFieldExtras(f, { min: '2026-01-01', max: '2026-12-31' });
    expect([f.min, f.max]).toEqual(['2026-01-01', '2026-12-31']);
    const t = field('text');
    applyNewFieldExtras(t, { regex: '^[A-Z].*', unique: true });
    expect([t.regex, t.unique]).toEqual(['^[A-Z].*', true]);
  });
});

describe('session.addField with extras', () => {
  it('adds a field without extras exactly as before (no new keys)', () => {
    const s = createSession(makeFile(3));
    const f = s.addField('Plain', 'text');
    expect(Object.keys(f).sort()).toEqual(['id', 'name', 'type']);
    const n = s.addField('Num', 'number', undefined, undefined, undefined);
    expect(Object.keys(n).sort()).toEqual(['id', 'name', 'type']);
  });

  it('stores options and rules on the new field, through undo / redo and a save round trip', () => {
    const s = createSession(makeFile(3));
    const f = s.addField('Stage', 'single_select', undefined, undefined, {
      options: ['Todo', 'Done'],
      required: true,
    });
    const stored = () => s.store.getFields().find((x) => x.id === f.id);
    expect(stored()?.options?.map((o) => o.name)).toEqual(['Todo', 'Done']);
    expect(stored()?.required).toBe(true);

    s.undo();
    expect(stored()).toBeUndefined();
    s.redo();
    expect(stored()?.options?.map((o) => o.name)).toEqual(['Todo', 'Done']);

    const r = s.addField('Score', 'number', undefined, undefined, { min: 1, max: 10, unique: true });
    const parsed = parse(serialize(s.toFile()));
    expect(parsed.ok).toBe(true);
    const back = parsed.ok ? parsed.data.fields.find((x) => x.id === r.id) : undefined;
    expect(back).toMatchObject({ name: 'Score', type: 'number', min: 1, max: 10, unique: true });
    const stage = parsed.ok ? parsed.data.fields.find((x) => x.id === f.id) : undefined;
    expect(stage?.options?.map((o) => o.name)).toEqual(['Todo', 'Done']);
  });
});

describe('previewFormula', () => {
  const fields: FieldDefinition[] = [
    { id: 'fld_a', name: 'Budget', type: 'number' },
    { id: 'fld_b', name: 'Bonus', type: 'number' },
  ];
  const row: Row = {
    id: 'row_1',
    rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    values: { fld_a: 5, fld_b: 8 },
    sync: null,
  };

  it('evaluates against row 1, by field name', () => {
    expect(previewFormula(fields, row, '{Budget} + 3')).toBe('8');
    expect(previewFormula(fields, row, '{Budget} + {Bonus}')).toBe('13');
    expect(previewFormula(fields, row, 'IF({Budget} > 1, "big", "small")')).toBe('big');
  });

  it('shows the engine error codes', () => {
    expect(previewFormula(fields, row, '{Nope} + 1')).toBe('#NAME?');
    expect(previewFormula(fields, row, '1 +')).toBe('#PARSE!');
  });

  it('shows a dash for an empty expression and "(no rows)" without rows', () => {
    expect(previewFormula(fields, row, '   ')).toBe(EMPTY_PREVIEW);
    expect(previewFormula(fields, undefined, '1 + 1')).toBe(NO_ROWS_PREVIEW);
  });

  it('never touches the fields or the row it is given', () => {
    const f = structuredClone(fields);
    const r = structuredClone(row);
    previewFormula(f, r, '{Budget} * 2');
    expect(f).toEqual(fields);
    expect(r).toEqual(row);
  });
});
