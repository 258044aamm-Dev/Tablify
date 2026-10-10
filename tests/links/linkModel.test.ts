/**
 * P8-04 (SAD-63) T-I tests: linked records. Pure model; the vault adapter is tested separately.
 *   - rename the target file: the link still resolves (IDs, not names)
 *   - delete a target row: the broken-link marker shows, and the source value is kept
 *   - integrity check output matches a known set of broken links
 *   - integrity check on 1,000 links runs under 1,000 ms (proposed FX-M bound)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSession } from '../../src/model/tableSession.js';
import { parse } from '../../src/format/parse.js';
import type { FieldDefinition, LinkRef, Row, TablifyFile } from '../../src/model/types.js';
import {
  buildSelection,
  checkIntegrity,
  createLinkIndex,
  filterRows,
  snapshotTable,
  summarizeLinks,
  type TableSnapshot,
} from '../../src/links/linkModel.js';

function loadSample(name: string): TablifyFile {
  const result = parse(readFileSync(join(process.cwd(), 'samples', 'v2', name), 'utf-8'));
  if (!result.ok) throw new Error(`${name} did not parse: ${result.error}`);
  return result.data;
}

/** A minimal table: a text primary field and one link field. Row labels are the names. */
function makeTable(
  tableId: string,
  rows: Array<{ id: string; name: string; links?: LinkRef[] | null }>,
  linkTableId = 'tbl_target',
): TablifyFile {
  const fields: FieldDefinition[] = [
    { id: 'fld_name', name: 'Name', type: 'text', primary: true },
    { id: 'fld_link', name: 'Link', type: 'link', linkTableId },
  ];
  return {
    formatVersion: 2,
    tableId,
    name: tableId,
    fields,
    rows: rows.map((r) => ({
      id: r.id,
      rev: 1,
      createdAt: '2026-10-09T00:00:00Z',
      updatedAt: '2026-10-09T00:00:00Z',
      values: { fld_name: r.name, fld_link: r.links ?? null },
      sync: null,
    })) as Row[],
    views: [
      {
        id: 'view_default', name: 'Default', sort: [], groupBy: null, hidden: [], frozenColumns: 1,
        rowHeight: 'medium', columnWidths: {}, columnOrder: ['fld_name', 'fld_link'], warnings: [],
      },
    ],
    syncLink: null,
  };
}

function indexOf(...entries: Array<[string, TablifyFile]>) {
  const index = createLinkIndex();
  for (const [path, file] of entries) index.put(snapshotTable(file, path));
  return index;
}

describe('P8-04 linked records (T-I)', () => {
  it('a link from the sample resolves to the target row name', () => {
    const orders = loadSample('formula-link.tablify');
    const customers = loadSample('customers.tablify');
    const index = indexOf(['samples/v2/formula-link.tablify', orders], ['samples/v2/customers.tablify', customers]);
    const cell = orders.rows[0].values['fld_customer'] as LinkRef[];
    expect(summarizeLinks(cell, index)).toEqual({ text: 'Ada Lovelace', broken: 0 });
  });

  it('T-I rename the target file: the link still resolves (IDs, not names)', () => {
    const orders = loadSample('formula-link.tablify');
    const customers = loadSample('customers.tablify');
    const index = indexOf(['samples/v2/formula-link.tablify', orders], ['samples/v2/customers.tablify', customers]);
    const cell = orders.rows[0].values['fld_customer'] as LinkRef[];

    // Rename: the same table ID now lives at a new path, under a new name.
    index.remove('samples/v2/customers.tablify');
    index.put(snapshotTable(customers, 'people/Clients 2026.tablify'));

    expect(summarizeLinks(cell, index)).toEqual({ text: 'Ada Lovelace', broken: 0 });
    expect(index.byTableId('tbl_01J9B7CUST')?.name).toBe('Clients 2026');
    expect(index.tables().map((t) => t.path)).toEqual(['people/Clients 2026.tablify', 'samples/v2/formula-link.tablify']);
  });

  it('T-I delete a target row: the broken-link marker shows, and the source value is kept', () => {
    const customers = loadSample('customers.tablify');
    const orders = loadSample('formula-link.tablify');
    const target = createSession(customers);
    const source = createSession(orders);

    const before = JSON.stringify(source.toFile().rows[0].values['fld_customer']);
    target.deleteRow('row_01J9B9C001');

    const index = indexOf(['samples/v2/customers.tablify', target.toFile()], ['samples/v2/formula-link.tablify', source.toFile()]);
    const cell = source.toFile().rows[0].values['fld_customer'] as LinkRef[];
    expect(summarizeLinks(cell, index)).toEqual({ text: 'Missing row', broken: 1 });
    // Nothing was removed from the source: the same reference is still in the file.
    expect(JSON.stringify(source.toFile().rows[0].values['fld_customer'])).toBe(before);
    expect(cell).toEqual([{ tableId: 'tbl_01J9B7CUST', rowId: 'row_01J9B9C001' }]);
  });

  it('a link to a table that is not in the vault is broken with a table reason', () => {
    const index = indexOf(['a.tablify', makeTable('tbl_a', [{ id: 'r1', name: 'One', links: [{ tableId: 'tbl_gone', rowId: 'x' }] }])]);
    expect(summarizeLinks([{ tableId: 'tbl_gone', rowId: 'x' }], index)).toEqual({ text: 'Missing table', broken: 1 });
  });

  it('T-I integrity check: output matches a known set of broken links', () => {
    const index = indexOf(
      ['orders.tablify', makeTable('tbl_orders', [
        { id: 'o1', name: 'Order 1', links: [{ tableId: 'tbl_cust', rowId: 'c1' }] }, // ok
        { id: 'o2', name: 'Order 2', links: [{ tableId: 'tbl_cust', rowId: 'c9' }, { tableId: 'tbl_gone', rowId: 'g1' }] }, // missing row, missing table
        { id: 'o3', name: '', links: null }, // no links: not checked
      ])],
      ['customers.tablify', makeTable('tbl_cust', [{ id: 'c1', name: 'Ada' }, { id: 'c2', name: 'Grace' }])],
    );
    const report = checkIntegrity(index);
    expect(report.checked).toBe(3);
    expect(report.broken).toEqual([
      {
        sourcePath: 'orders.tablify', sourceTable: 'orders', rowId: 'o2', rowLabel: 'Order 2', fieldName: 'Link',
        targetTableId: 'tbl_cust', targetRowId: 'c9', reason: 'missing-row', message: 'The linked row was deleted.',
      },
      {
        sourcePath: 'orders.tablify', sourceTable: 'orders', rowId: 'o2', rowLabel: 'Order 2', fieldName: 'Link',
        targetTableId: 'tbl_gone', targetRowId: 'g1', reason: 'missing-table', message: 'The linked table is not in this vault.',
      },
    ]);
    expect(report.duplicates).toEqual([]);
  });

  it('integrity check on 1,000 links runs under 1,000 ms (proposed FX-M bound)', () => {
    // 10 source tables x 100 rows, each row with 1 link. 10 target tables x 100 rows.
    // Every 5th link points at a deleted row, so 200 are broken: 180 missing row, 20 missing table.
    const entries: Array<[string, TablifyFile]> = [];
    for (let t = 0; t < 10; t++) {
      const rows: Array<{ id: string; name: string; links?: LinkRef[] }> = [];
      for (let r = 0; r < 100; r++) {
        const n = t * 100 + r;
        let link: LinkRef;
        if (n % 5 === 0 && n % 10 === 0) link = { tableId: 'tbl_missing', rowId: `m${n}` };
        else if (n % 5 === 0) link = { tableId: `tbl_tgt${t % 10}`, rowId: `gone${n}` };
        else link = { tableId: `tbl_tgt${t % 10}`, rowId: `t${t % 10}r${r}` };
        rows.push({ id: `s${t}r${r}`, name: `Row ${n}`, links: [link] });
      }
      entries.push([`src${t}.tablify`, makeTable(`tbl_src${t}`, rows)]);
    }
    for (let t = 0; t < 10; t++) {
      const rows = Array.from({ length: 100 }, (_, r) => ({ id: `t${t}r${r}`, name: `Target ${t}-${r}` }));
      entries.push([`tgt${t}.tablify`, makeTable(`tbl_tgt${t}`, rows)]);
    }
    const index = indexOf(...entries);

    const start = performance.now();
    const report = checkIntegrity(index);
    const elapsed = performance.now() - start;

    expect(report.checked).toBe(1000);
    expect(report.broken).toHaveLength(200);
    expect(report.broken.filter((b) => b.reason === 'missing-table')).toHaveLength(100);
    expect(report.broken.filter((b) => b.reason === 'missing-row')).toHaveLength(100);
    expect(elapsed).toBeLessThan(1000);
  });

  it('two files with the same table ID: the first is used and the duplicate is reported', () => {
    const index = indexOf(
      ['b-copy.tablify', makeTable('tbl_same', [{ id: 'r1', name: 'Copy' }])],
      ['a-original.tablify', makeTable('tbl_same', [{ id: 'r1', name: 'Original' }])],
    );
    expect(index.byTableId('tbl_same')?.path).toBe('a-original.tablify');
    expect(checkIntegrity(index).duplicates).toEqual([
      { tableId: 'tbl_same', paths: ['a-original.tablify', 'b-copy.tablify'] },
    ]);
  });

  it('buildSelection keeps other-table links and the order of existing picks, then appends new picks', () => {
    const current: LinkRef[] = [
      { tableId: 'tbl_t', rowId: 'b' },
      { tableId: 'tbl_other', rowId: 'x' },
      { tableId: 'tbl_t', rowId: 'a' },
      { tableId: 'tbl_t', rowId: 'gone' },
    ];
    // 'gone' is still checked (kept). 'b' is unchecked (removed). 'c' is new.
    expect(buildSelection(current, 'tbl_t', ['a', 'c', 'gone'])).toEqual([
      { tableId: 'tbl_other', rowId: 'x' },
      { tableId: 'tbl_t', rowId: 'a' },
      { tableId: 'tbl_t', rowId: 'gone' },
      { tableId: 'tbl_t', rowId: 'c' },
    ]);
  });

  it('buildSelection returns null for an empty cell, and never duplicates a row', () => {
    expect(buildSelection([{ tableId: 'tbl_t', rowId: 'a' }], 'tbl_t', [])).toBeNull();
    expect(buildSelection([], 'tbl_t', ['a', 'a'])).toEqual([{ tableId: 'tbl_t', rowId: 'a' }]);
  });

  it('filterRows is case-insensitive and an empty query keeps every row', () => {
    const rows = [
      { id: '1', label: 'Ada Lovelace' },
      { id: '2', label: 'Grace Hopper' },
      { id: '3', label: 'ada byron' },
    ];
    expect(filterRows(rows, 'ADA').map((r) => r.id)).toEqual(['1', '3']);
    expect(filterRows(rows, '  ').map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  it('a snapshot indexes only non-empty link cells', () => {
    const snap: TableSnapshot = snapshotTable(
      makeTable('tbl_s', [{ id: 'r1', name: 'A', links: [{ tableId: 't', rowId: 'x' }] }, { id: 'r2', name: 'B' }]),
      'dir/Source.tablify',
    );
    expect(snap.name).toBe('Source');
    expect(snap.rows).toEqual([{ id: 'r1', label: 'A' }, { id: 'r2', label: 'B' }]);
    expect(snap.linkCells.map((c) => c.rowId)).toEqual(['r1']);
  });
});
