// P8-04 follow-up. R-2: sort, search and export read linked row names. R-5: links to other tables
// can be removed from the cell menu. Pure-model tests only; the Obsidian wiring is checked in Obsidian.
import { afterEach, describe, expect, it } from 'vitest';
import { linkType, setLinkLabelResolver } from '../../src/model/fieldTypes/link.js';
import { compareCells } from '../../src/model/viewOrder.js';
import { searchRows } from '../../src/model/rowFilter.js';
import { countForeignRefs, removeForeignRefs } from '../../src/model/link.js';
import { cellEntries } from '../../src/menus/tableMenuModel.js';
import type { FieldDefinition, LinkRef, Row } from '../../src/model/types.js';

const TARGET = 'tbl_target';
const OTHER = 'tbl_other';
const names: Record<string, string> = { 'tbl_target:r1': 'Alice', 'tbl_target:r2': 'Bob', 'tbl_other:x1': 'Zed' };
const resolve = (ref: LinkRef): string | null => names[`${ref.tableId}:${ref.rowId}`] ?? null;

afterEach(() => setLinkLabelResolver(null));

const linkField: FieldDefinition = { id: 'fld_link', name: 'Owner', type: 'link', linkTableId: TARGET };

describe('link format (R-2)', () => {
  it('falls back to the count when no resolver is set', () => {
    const v = [{ tableId: TARGET, rowId: 'r1' }, { tableId: TARGET, rowId: 'r2' }];
    expect(linkType.format(v, linkField)).toBe('2 linked');
  });

  it('shows the linked row names, joined, when a resolver is set', () => {
    setLinkLabelResolver(resolve);
    const v = [{ tableId: TARGET, rowId: 'r2' }, { tableId: TARGET, rowId: 'r1' }];
    expect(linkType.format(v, linkField)).toBe('Bob, Alice');
  });

  it('shows "Missing row" for a broken link', () => {
    setLinkLabelResolver(resolve);
    const v = [{ tableId: TARGET, rowId: 'r1' }, { tableId: TARGET, rowId: 'gone' }];
    expect(linkType.format(v, linkField)).toBe('Alice, Missing row');
  });

  it('an empty cell is empty text', () => {
    setLinkLabelResolver(resolve);
    expect(linkType.format(null, linkField)).toBe('');
    expect(linkType.format([], linkField)).toBe('');
  });
});

describe('sort by link names (R-2)', () => {
  it('sorts A to Z by the linked name, not by the count', () => {
    setLinkLabelResolver(resolve);
    const bob = [{ tableId: TARGET, rowId: 'r2' }];
    const alice = [{ tableId: TARGET, rowId: 'r1' }, { tableId: TARGET, rowId: 'r2' }];
    // By count alice (2) > bob (1). By name "Alice, Bob" < "Bob", so alice sorts first.
    expect(compareCells(alice, bob, linkField, 1)).toBeLessThan(0);
  });
});

describe('search by link names (R-2)', () => {
  it('finds a row by a linked name', () => {
    setLinkLabelResolver(resolve);
    const rows: Row[] = [
      { id: 'a', rev: 1, values: { fld_link: [{ tableId: TARGET, rowId: 'r1' }] } } as unknown as Row,
      { id: 'b', rev: 1, values: { fld_link: [{ tableId: TARGET, rowId: 'r2' }] } } as unknown as Row,
    ];
    const hits = searchRows(rows, [linkField], 'alice');
    expect(hits.map((r) => r.id)).toEqual(['a']);
  });
});

describe('links to other tables (R-5)', () => {
  const mixed: LinkRef[] = [
    { tableId: TARGET, rowId: 'r1' },
    { tableId: OTHER, rowId: 'x1' },
    { tableId: TARGET, rowId: 'r2' },
  ];

  it('counts only links that point elsewhere', () => {
    expect(countForeignRefs(mixed, TARGET)).toBe(1);
    expect(countForeignRefs(mixed, OTHER)).toBe(2);
    expect(countForeignRefs(null, TARGET)).toBe(0);
  });

  it('removes only the foreign links and keeps the order of the rest', () => {
    expect(removeForeignRefs(mixed, TARGET)).toEqual([
      { tableId: TARGET, rowId: 'r1' },
      { tableId: TARGET, rowId: 'r2' },
    ]);
  });

  it('returns null when nothing is left, so the cell becomes empty', () => {
    expect(removeForeignRefs([{ tableId: OTHER, rowId: 'x1' }], TARGET)).toBeNull();
  });

  it('the cell menu shows "Remove links to other tables" only when there are foreign links', () => {
    const base = { readOnly: false, cellEmpty: false, hasClipboard: false, isLink: true };
    const labels = (ctx: Parameters<typeof cellEntries>[0]) => cellEntries(ctx).map((e) => e.id);
    expect(labels({ ...base, foreignLinks: 1 })).toContain('cell.removeForeign');
    expect(labels({ ...base, foreignLinks: 0 })).not.toContain('cell.removeForeign');
    expect(labels(base)).not.toContain('cell.removeForeign');
    const ro = cellEntries({ ...base, readOnly: true, foreignLinks: 1 }).find((e) => e.id === 'cell.removeForeign');
    expect(ro?.enabled).toBe(false);
  });

  it('non-link cells never get the item', () => {
    const ids = cellEntries({ readOnly: false, cellEmpty: false, hasClipboard: false, foreignLinks: 3 }).map((e) => e.id);
    expect(ids).not.toContain('cell.removeForeign');
  });
});
