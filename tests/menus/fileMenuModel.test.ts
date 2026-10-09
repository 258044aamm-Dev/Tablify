import { describe, it, expect } from 'vitest';
import { menuItemsFor, uniqueName, duplicateTableText, newTableText, joinPath, COPY_SUFFIX } from '../../src/menus/fileMenuModel.js';
import { parse } from '../../src/format/parse.js';
import { serialize } from '../../src/format/serialize.js';
import { makeFile } from '../io/export.fixtures.js';

const labels = (t: Parameters<typeof menuItemsFor>[0]) => menuItemsFor(t).map((i) => i.label);

describe('file explorer menu items (P5-01, FEATURES §2.16)', () => {
  it('.tablify file: Open, Duplicate, Export', () => {
    expect(labels({ kind: 'file', extension: 'tablify' })).toEqual(['Open', 'Duplicate', 'Export']);
  });

  it('folder: New table, Import CSV / Excel as table', () => {
    expect(labels({ kind: 'folder', path: 'Projects' })).toEqual(['New table', 'Import CSV / Excel as table']);
  });

  it('other files and the vault root get no Tablify items', () => {
    expect(labels({ kind: 'file', extension: 'md' })).toEqual([]);
    expect(labels({ kind: 'file', extension: 'csv' })).toEqual([]);
    expect(labels({ kind: 'folder', path: '' })).toEqual([]);
    expect(labels({ kind: 'folder', path: '/' })).toEqual([]);
    expect(labels({ kind: 'other' })).toEqual([]);
  });

  it('item list is computed well under the 100 ms proposed budget', () => {
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) menuItemsFor({ kind: 'file', extension: 'tablify' });
    expect(performance.now() - t0).toBeLessThan(100);
  });
});

describe('naming (collision rule, decision: " copy" suffix)', () => {
  it('uses the base name when free, then numbers on collision', () => {
    expect(uniqueName('Tasks copy', () => false)).toBe('Tasks copy');
    expect(uniqueName('Tasks copy', (n) => n === 'Tasks copy')).toBe('Tasks copy 2');
    const taken = new Set(['Tasks copy', 'Tasks copy 2']);
    expect(uniqueName('Tasks copy', (n) => taken.has(n))).toBe('Tasks copy 3');
  });

  it('suffix is " copy"', () => {
    expect(COPY_SUFFIX).toBe(' copy');
  });

  it('joins folder and name, with the vault root as empty string', () => {
    expect(joinPath('', 'A')).toBe('A');
    expect(joinPath('/', 'A')).toBe('A');
    expect(joinPath('Projects', 'A')).toBe('Projects/A');
  });
});

describe('duplicate (T-I diff check: only tableId and name differ)', () => {
  it('keeps every row, field, view, and revision; changes only tableId and name', () => {
    const original = serialize(makeFile(40));
    const result = duplicateTableText(original, 'Tasks copy');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const a = parse(original);
    const b = parse(result.text);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    expect(b.data.tableId).not.toBe(a.data.tableId);
    expect(b.data.name).toBe('Tasks copy');
    const strip = (d: typeof a.data) => ({ ...d, tableId: '', name: '' });
    expect(strip(b.data)).toEqual(strip(a.data));
    // row IDs and revisions are unchanged (R-D11)
    expect(b.data.rows.map((r) => r.id)).toEqual(a.data.rows.map((r) => r.id));
    expect(b.data.rows.map((r) => r.rev)).toEqual(a.data.rows.map((r) => r.rev));
  });

  it('two duplicates get different tableIds', () => {
    const original = serialize(makeFile(3));
    const x = duplicateTableText(original, 'A');
    const y = duplicateTableText(original, 'B');
    if (!x.ok || !y.ok) throw new Error('duplicate failed');
    expect(parse(x.text).ok && parse(y.text).ok).toBe(true);
    const px = parse(x.text);
    const py = parse(y.text);
    if (!px.ok || !py.ok) return;
    expect(px.data.tableId).not.toBe(py.data.tableId);
  });

  it('returns an error and does not produce text for an unreadable file', () => {
    const result = duplicateTableText('{ not json', 'X');
    expect(result.ok).toBe(false);
  });
});

describe('new table (default, proposed in P5-01)', () => {
  it('is an empty table with one primary text field named Name', () => {
    const parsed = parse(newTableText('Untitled table'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.name).toBe('Untitled table');
    expect(parsed.data.rows).toHaveLength(0);
    expect(parsed.data.fields).toHaveLength(1);
    expect(parsed.data.fields[0]).toMatchObject({ name: 'Name', type: 'text', primary: true });
    expect(parsed.data.views).toHaveLength(1);
  });
});
