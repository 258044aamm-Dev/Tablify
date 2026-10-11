import { describe, it, expect } from 'vitest';
import { menuItemsFor, uniqueName, duplicateTableText, newTableText, joinPath, COPY_SUFFIX } from '../../src/menus/fileMenuModel.js';
import { parse } from '../../src/format/parse.js';
import { serialize } from '../../src/format/serialize.js';
import { makeFile } from '../io/export.fixtures.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

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

// SAD-84 (owner decision S-8, 2026-10-10): a new table starts with five typed fields and three
// empty, immediately editable rows. Replaces the P5-01 default (one `Name` field, no rows).
// Only newTableText() changes: Import, Duplicate, reissue and existing files are untouched.
describe('new table defaults (SAD-84, owner decision S-8)', () => {
  const load = () => {
    const parsed = parse(newTableText('Untitled table'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('newTableText() did not parse');
    return parsed.data;
  };

  it('keeps the name, format version 1 and a single default view', () => {
    const t = load();
    expect(t.name).toBe('Untitled table');
    expect(t.formatVersion).toBe(1);
    expect(t.syncLink).toBeNull();
    expect(t.views).toHaveLength(1);
  });

  it('has five fields in order: Name, Notes, Status, Due date, Attachments', () => {
    const t = load();
    expect(t.fields.map((f) => [f.name, f.type])).toEqual([
      ['Name', 'text'],
      ['Notes', 'long_text'],
      ['Status', 'single_select'],
      ['Due date', 'date'],
      ['Attachments', 'attachment'],
    ]);
    expect(t.fields.filter((f) => f.primary)).toHaveLength(1);
    expect(t.fields[0].primary).toBe(true);
    for (const f of t.fields) expect(f.id).toMatch(/^fld_[A-Za-z0-9_]+$/);
    expect(new Set(t.fields.map((f) => f.id)).size).toBe(5);
  });

  it('pre-fills Status with Todo (gray), In progress (blue), Done (green)', () => {
    const status = load().fields[2];
    expect(status.options?.map((o) => [o.name, o.color])).toEqual([
      ['Todo', 'gray'],
      ['In progress', 'blue'],
      ['Done', 'green'],
    ]);
    for (const o of status.options ?? []) expect(o.id).toMatch(/^opt_[A-Za-z0-9_]+$/);
    // Only the select field carries options.
    expect(load().fields.filter((f) => f.options !== undefined)).toHaveLength(1);
  });

  it('has three empty rows shaped like tableStore.createRow()', () => {
    const t = load();
    expect(t.rows).toHaveLength(3);
    for (const r of t.rows) {
      expect(r.id).toMatch(/^row_[A-Za-z0-9]+$/);
      expect(r.rev).toBe(1);
      expect(r.values).toEqual({});
      expect(r.sync).toBeNull();
      expect(r.createdAt).toBe(r.updatedAt);
      expect(Number.isNaN(Date.parse(r.updatedAt))).toBe(false);
    }
    expect(new Set(t.rows.map((r) => r.id)).size).toBe(3);
  });

  it('shows all five columns with the primary frozen', () => {
    const t = load();
    const v = t.views[0];
    expect(v.columnOrder).toEqual(t.fields.map((f) => f.id));
    expect(v.hidden).toEqual([]);
    expect(v.frozenColumns).toBe(1);
    expect(v.warnings ?? []).toEqual([]);
  });

  it('generates fresh field, option and row ids on every call', () => {
    const ids = (text: string) => {
      const p = parse(text);
      if (!p.ok) throw new Error('parse failed');
      return [
        p.data.tableId,
        ...p.data.fields.map((f) => f.id),
        ...p.data.fields.flatMap((f) => (f.options ?? []).map((o) => o.id)),
        ...p.data.rows.map((r) => r.id),
      ];
    };
    const a = ids(newTableText('A'));
    const b = ids(newTableText('B'));
    expect(a.filter((id) => b.includes(id))).toEqual([]);
  });

  it('is valid against tablify.schema.json', () => {
    const schema = JSON.parse(readFileSync(join(process.cwd(), 'tablify.schema.json'), 'utf-8'));
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const ok = validate(JSON.parse(newTableText('Untitled table')));
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('round-trips through serialize unchanged', () => {
    const text = newTableText('Untitled table');
    const p = parse(text);
    if (!p.ok) throw new Error('parse failed');
    expect(serialize(p.data)).toBe(text);
  });
});
