import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/model/tableSession.js';
import { serialize } from '../../src/format/serialize.js';
import { parse } from '../../src/format/parse.js';
import { makeFile, VIEW } from '../io/export.fixtures.js';
import type { TablifyFile } from '../../src/model/types.js';

/** Compare table content, ignoring rev/updatedAt/createdAt (undo bumps rev in the existing store). */
function content(file: TablifyFile): unknown {
  return {
    fields: file.fields,
    views: file.views,
    rows: file.rows.map((r) => ({ id: r.id, values: r.values })),
  };
}

describe('P5-02 undoable operations', () => {
  it('insert row above and below: correct position, undo removes it, redo restores the same id', () => {
    const s = createSession(makeFile(3));
    const ids = () => s.store.getAllRows().map((r) => r.id);
    const before = ids();
    s.insertRowNear(before[1], 'above');
    expect(ids()).toHaveLength(4);
    const newId = ids()[1];
    expect(before).not.toContain(newId);
    s.undo();
    expect(ids()).toEqual(before);
    s.redo();
    expect(ids()[1]).toBe(newId);
    // after the insert-above and redo, the original row sits at index 2
    expect(ids()[2]).toBe(before[1]);
    s.insertRowNear(before[1], 'below');
    expect(ids()[3]).not.toBe(newId);
    expect(ids()[2]).toBe(before[1]);
  });

  it('duplicate row copies values under a new id, directly below', () => {
    const s = createSession(makeFile(3));
    const src = s.store.getAllRows()[0];
    s.duplicateRow(src.id);
    const rows = s.store.getAllRows();
    expect(rows).toHaveLength(4);
    expect(rows[1].id).not.toBe(src.id);
    expect(rows[1].values).toEqual(src.values);
    s.undo();
    expect(s.store.getAllRows()).toHaveLength(3);
  });

  it('set view (hide, sort, freeze) is undoable one step at a time', () => {
    const s = createSession(makeFile(4));
    const v0 = s.getView();
    s.setView({ ...v0, sort: [{ fieldId: 'fld_name', direction: 'asc' }] });
    s.setView({ ...s.getView(), sort: [{ fieldId: 'fld_name', direction: 'desc' }] });
    expect(s.getView().sort[0].direction).toBe('desc');
    s.undo();
    expect(s.getView().sort[0].direction).toBe('asc');
    s.undo();
    expect(s.getView().sort).toEqual(v0.sort);
  });

  it('change field type to number converts values; undo restores type and values', () => {
    const file: TablifyFile = {
      ...makeFile(0),
      fields: [
        { id: 'fld_name', name: 'Name', type: 'text', primary: true },
        { id: 'fld_qty', name: 'Qty', type: 'text' },
      ],
      rows: [
        { id: 'row_1', rev: 1, updatedAt: '2026-10-09T00:00:00.000Z', sync: null, values: { fld_name: 'a', fld_qty: '12' } },
        { id: 'row_2', rev: 1, updatedAt: '2026-10-09T00:00:00.000Z', sync: null, values: { fld_name: 'b', fld_qty: '' } },
      ],
      views: [{ ...VIEW, hidden: [], sort: [], columnOrder: ['fld_name', 'fld_qty'] }],
    };
    const s = createSession(file);
    const plan = s.changeFieldType('fld_qty', 'number');
    expect(plan.ok).toBe(true);
    expect(s.getField('fld_qty')?.type).toBe('number');
    expect(s.store.getRow('row_1')?.values.fld_qty).toBe(12);
    expect(s.store.getRow('row_2')?.values.fld_qty).toBeNull();
    s.undo();
    expect(s.getField('fld_qty')?.type).toBe('text');
    expect(s.store.getRow('row_1')?.values.fld_qty).toBe('12');
  });

  it('change field type is blocked when a value cannot convert: no change at all', () => {
    const file = makeFile(5);
    const s = createSession(file);
    const before = serialize(s.toFile());
    const plan = s.changeFieldType('fld_name', 'number'); // names are text, not numbers
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.blockedRows).toBeGreaterThan(0);
    expect(serialize(s.toFile())).toBe(before);
  });

  it('select types need options and are not offered as targets', () => {
    const s = createSession(makeFile(2));
    const plan = s.changeFieldType('fld_name', 'single_select');
    expect(plan.ok).toBe(false);
  });

  it('undo all operations restores the original table content', () => {
    const file = makeFile(12);
    const original = parse(serialize(file));
    if (!original.ok) throw new Error('fixture');
    const s = createSession(original.data);
    const rows = s.getDisplayRows();
    s.setValue(rows[0].id, 'fld_name', 'Edited');
    s.insertRowNear(rows[1].id, 'above');
    s.duplicateRow(rows[2].id);
    s.deleteRow(rows[3].id);
    s.setView({ ...s.getView(), hidden: [...s.getView().hidden, 'fld_done'] });
    s.setView({ ...s.getView(), sort: [{ fieldId: 'fld_name', direction: 'asc' }] });
    s.setView({ ...s.getView(), frozenColumns: 3 });
    s.setValue(rows[4].id, 'fld_name', null);
    s.changeFieldType('fld_link', 'text');
    while (s.undo()) {
      // keep undoing
    }
    expect(content(s.toFile())).toEqual(content(original.data));
  });
});
