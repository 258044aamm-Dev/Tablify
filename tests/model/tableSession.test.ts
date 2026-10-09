import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/model/tableSession.js';
import { parse } from '../../src/format/parse.js';
import { serialize } from '../../src/format/serialize.js';
import { makeFile, VIEW } from '../io/export.fixtures.js';

describe('tableSession (P5-00)', () => {
  it('setValue is undoable and redo restores it', () => {
    const s = createSession(makeFile(5));
    const rowId = s.store.getAllRows()[0].id;
    const before = s.store.getRow(rowId)!.values.fld_name;
    s.setValue(rowId, 'fld_name', 'Changed');
    expect(s.store.getRow(rowId)!.values.fld_name).toBe('Changed');
    expect(s.undo()).toBe(true);
    expect(s.store.getRow(rowId)!.values.fld_name).toBe(before);
    expect(s.redo()).toBe(true);
    expect(s.store.getRow(rowId)!.values.fld_name).toBe('Changed');
  });

  it('setValue with the same value does not add a command', () => {
    const s = createSession(makeFile(3));
    const row = s.store.getAllRows()[0];
    s.setValue(row.id, 'fld_name', row.values.fld_name as string);
    expect(s.undo()).toBe(false);
  });

  it('addRow and deleteRow are undoable', () => {
    const s = createSession(makeFile(3));
    expect(s.store.getAllRows()).toHaveLength(3);
    s.addRow();
    expect(s.store.getAllRows()).toHaveLength(4);
    s.undo();
    expect(s.store.getAllRows()).toHaveLength(3);
    const id = s.store.getAllRows()[1].id;
    s.deleteRow(id);
    expect(s.store.getRow(id)).toBeUndefined();
    s.undo();
    expect(s.store.getRow(id)).toBeDefined();
  });

  it('display rows follow the view sort; stored order is unchanged', () => {
    const s = createSession(makeFile(20));
    const shown = s.getDisplayRows().map((r) => r.values.fld_amount as number | null);
    const nums = shown.filter((n): n is number => n !== null);
    expect(nums).toEqual([...nums].sort((a, b) => b - a));
    expect(s.store.getAllRows()[0].id).toBe('row_000001');
  });

  it('visible fields respect hidden columns and column order', () => {
    const s = createSession(makeFile(2));
    const ids = s.getVisibleFields().map((f) => f.id);
    expect(ids).not.toContain('fld_hidden');
    expect(ids[0]).toBe('fld_name');
    s.setView({ ...VIEW, hidden: [] });
    expect(s.getVisibleFields().map((f) => f.id)).toContain('fld_hidden');
  });

  it('toFile round-trips through serialize and parse and keeps unknown keys', () => {
    const file = { ...makeFile(8), extraKey: { keep: true } };
    const s = createSession(file);
    s.setValue(s.store.getAllRows()[0].id, 'fld_name', 'Edited');
    const text = serialize(s.toFile());
    const back = parse(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.data.rows[0].values.fld_name).toBe('Edited');
    expect(back.data.rows).toHaveLength(8);
    expect((back.data as Record<string, unknown>).extraKey).toEqual({ keep: true });
  });
});
