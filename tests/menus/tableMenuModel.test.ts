import { describe, it, expect } from 'vitest';
import { cellEntries, cellMenu, headerEntries, rowEntries, displayTitle, CHANGE_TARGET_TYPES, type MenuEntry } from '../../src/menus/tableMenuModel.js';
import { createDefaultView } from '../../src/model/view.js';
import { makeFile, VIEW } from '../io/export.fixtures.js';

const byId = (entries: MenuEntry[], id: string) => {
  const e = entries.find((x) => x.id === id);
  if (!e) throw new Error(`missing ${id}`);
  return e;
};

describe('cell menu (P5-02)', () => {
  it('Copy, Paste, Clear: Paste needs a clipboard, Clear needs a non-empty cell', () => {
    const none = cellEntries({ readOnly: false, cellEmpty: true, hasClipboard: false });
    expect(byId(none, 'cell.copy').enabled).toBe(true);
    expect(byId(none, 'cell.paste')).toMatchObject({ enabled: false, reason: 'Nothing copied yet' });
    expect(byId(none, 'cell.clear')).toMatchObject({ enabled: false, reason: 'Cell is already empty' });

    const full = cellEntries({ readOnly: false, cellEmpty: false, hasClipboard: true });
    expect(byId(full, 'cell.paste').enabled).toBe(true);
    expect(byId(full, 'cell.clear').enabled).toBe(true);
  });

  it('read-only fields disable Paste and Clear with a reason', () => {
    const ro = cellEntries({ readOnly: true, cellEmpty: false, hasClipboard: true });
    expect(byId(ro, 'cell.paste')).toMatchObject({ enabled: false, reason: 'Read-only field' });
    expect(byId(ro, 'cell.clear')).toMatchObject({ enabled: false, reason: 'Read-only field' });
  });

  it('cell right-click shows cell items, a separator, then row items', () => {
    const entries = cellMenu({ readOnly: false, cellEmpty: false, hasClipboard: false });
    expect(entries.map((e) => e.label)).toEqual([
      'Copy', 'Paste', 'Clear', '', 'Insert row above', 'Insert row below', 'Duplicate row', 'Copy row', 'Delete row',
    ]);
    expect(entries[3].separator).toBe(true);
  });
});

describe('row menu (P5-02)', () => {
  it('has Insert above, Insert below, Duplicate, Copy, Delete, all enabled', () => {
    const r = rowEntries();
    expect(r.map((e) => e.label)).toEqual(['Insert row above', 'Insert row below', 'Duplicate row', 'Copy row', 'Delete row']);
    expect(r.every((e) => e.enabled)).toBe(true);
  });
});

describe('header menu (P5-02)', () => {
  const view = createDefaultView(makeFile(1).fields);
  const base = { fieldId: 'fld_amount', isPrimary: false, colIndex: 1, view: { ...view, frozenColumns: 1, sort: [] } };

  it('lists the five header items in spec order', () => {
    expect(headerEntries(base).map((e) => e.label)).toEqual([
      'Change field type…', 'Hide field', 'Sort ascending', 'Sort descending', 'Freeze column',
    ]);
  });

  it('primary field cannot be hidden: disabled with reason', () => {
    const e = byId(headerEntries({ ...base, fieldId: 'fld_name', isPrimary: true, colIndex: 0 }), 'header.hide');
    expect(e).toMatchObject({ enabled: false, reason: 'Primary field cannot be hidden' });
  });

  it('sort items are disabled when the view already sorts by this field in that direction', () => {
    const sorted = { ...base, view: { ...base.view, sort: [{ fieldId: 'fld_amount', direction: 'asc' as const }] } };
    const entries = headerEntries(sorted);
    expect(byId(entries, 'header.sortAsc')).toMatchObject({ enabled: false, reason: 'Already sorted ascending' });
    expect(byId(entries, 'header.sortDesc').enabled).toBe(true);
  });

  it('freeze is disabled when the column is already the last frozen one', () => {
    const frozen = { ...base, colIndex: 1, view: { ...base.view, frozenColumns: 2 } };
    expect(byId(headerEntries(frozen), 'header.freeze')).toMatchObject({ enabled: false, reason: 'Already frozen through this column' });
  });

  it('displayTitle shows the reason only for disabled items', () => {
    expect(displayTitle({ id: 'x', label: 'Paste', enabled: true })).toBe('Paste');
    expect(displayTitle({ id: 'x', label: 'Paste', enabled: false, reason: 'Nothing copied yet' })).toBe('Paste (Nothing copied yet)');
  });

  it('change-type targets exclude system types', () => {
    expect(CHANGE_TARGET_TYPES).not.toContain('auto_number');
    expect(CHANGE_TARGET_TYPES).not.toContain('created_time');
    expect(CHANGE_TARGET_TYPES).toContain('number');
    expect(VIEW.hidden).toContain('fld_hidden');
  });
});
