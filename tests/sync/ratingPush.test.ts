/**
 * @vitest-environment jsdom
 *
 * SAD-304 — Airtable ratings are whole stars.
 *
 * The rule the owner chose: round at the boundary, tell the user, and keep the fraction in the
 * file. These tests pin all three, plus the detail that makes the rounding safe: the push records
 * the *server's* echo as the remote hash, so the next sync does not read 5 back as a remote change
 * and loop.
 */
import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/model/tableSession.js';
import type { CellValue, FieldDefinition, TablifyFile } from '../../src/model/types.js';
import { AirtableClient } from '../../src/sync/airtableClient.js';
import { emptyReport, summarize, type SyncContext } from '../../src/sync/engineTypes.js';
import { pushToAirtable } from '../../src/sync/push.js';
import { fractionalRatingCount, localToRemote } from '../../src/sync/values.js';
import { createFakeAirtable, makeTable, type FakeTable } from '../__mocks__/airtableServer.js';

const TOKEN = 'pat-test-0123456789abcdef';
const BASE = 'appTEST0000000001';
const TABLE = 'tblTEST0000000001';

const rating: FieldDefinition = {
  id: 'fld_Rate',
  name: 'Rating',
  type: 'rating',
  max: 5,
  airtable: { id: 'fldRate', type: 'rating', readOnly: false },
};

describe('SAD-304 — the remote value', () => {
  const local = (v: CellValue | undefined): unknown => localToRemote(rating, v);

  it('rounds a fraction to the nearest whole star', () => {
    expect(local(4.5)).toBe(5);
    expect(local(4.4)).toBe(4);
    expect(local(3.7)).toBe(4);
    expect(local(0.5)).toBe(1);
  });

  it('leaves whole numbers, null and a corrupt value exactly as they were', () => {
    expect(local(4)).toBe(4);
    expect(local(0)).toBe(0);
    expect(local(null)).toBeNull();
    expect(local('4.5')).toBe('4.5');
  });

  it('counts only writable rating cells that hold a fraction', () => {
    const readonly: FieldDefinition = {
      ...rating,
      id: 'fld_Locked',
      airtable: { id: 'fldLocked', type: 'rating', readOnly: true },
    };
    const number: FieldDefinition = {
      id: 'fld_N',
      name: 'N',
      type: 'number',
      airtable: { id: 'fldN', type: 'number', readOnly: false },
    };
    const fields = [rating, readonly, number];
    expect(fractionalRatingCount(fields, { values: { fld_Rate: 4.5 } })).toBe(1);
    expect(fractionalRatingCount(fields, { values: { fld_Rate: 4 } })).toBe(0);
    expect(fractionalRatingCount(fields, { values: { fld_Rate: null } })).toBe(0);
    expect(fractionalRatingCount(fields, { values: { fld_Locked: 4.5 } })).toBe(0);
    expect(fractionalRatingCount(fields, { values: { fld_N: 4.5 } })).toBe(0);
  });

  it('the summary names the roundings', () => {
    const report = emptyReport('push');
    report.roundedRatings = 2;
    expect(summarize(report)).toContain('2 rating(s) rounded for Airtable');
    expect(summarize(emptyReport('push'))).not.toContain('rounded');
  });
});

describe('SAD-304 — a push sends whole stars and says so', () => {
  function fixture(): {
    ctx: SyncContext;
    sent: () => Array<{ method: string }>;
    table: FakeTable;
    files: () => TablifyFile;
  } {
    const table = makeTable(TABLE, 'Tasks', 0);
    table.fields.push({ id: 'fldRate', name: 'Rating', type: 'rating' });
    const fake = createFakeAirtable({
      token: TOKEN,
      bases: [{ id: BASE, name: 'Test base', tables: [table] }],
      now: () => Date.parse('2026-10-19T10:00:00.000Z'),
    });
    const client = new AirtableClient({
      token: TOKEN,
      transport: fake.handler,
      clock: () => Date.parse('2026-10-19T10:00:00.000Z'),
      sleep: async () => {},
    });
    const file: TablifyFile = {
      formatVersion: 1,
      tableId: 'tbl_local',
      name: 'Tasks',
      fields: [
        {
          id: 'fld_Name',
          name: 'Name',
          type: 'text',
          primary: true,
          airtable: { id: 'fldName', type: 'singleLineText', readOnly: false },
        },
        {
          id: 'fld_Rate',
          name: 'Rating',
          type: 'rating',
          max: 5,
          airtable: { id: 'fldRate', type: 'rating', readOnly: false },
        },
      ],
      rows: [
        {
          id: 'row_1',
          rev: 1,
          createdAt: '2026-10-19T09:00:00.000Z',
          updatedAt: '2026-10-19T09:00:00.000Z',
          values: { fld_Name: 'Half rated', fld_Rate: 4.5 },
          sync: null,
        },
      ],
      views: [
        {
          id: 'view_1',
          name: 'Default',
          sort: [],
          groupBy: null,
          hidden: [],
          frozenColumns: 0,
          rowHeight: 'medium',
          columnWidths: {},
          columnOrder: ['fld_Name', 'fld_Rate'],
        },
      ],
      syncLink: {
        baseId: BASE,
        tableId: TABLE,
        tableName: 'Tasks',
        linkedAt: '2026-10-19T09:00:00.000Z',
        lastSync: null,
        records: [],
      },
    };
    const session = createSession(file);
    const ctx: SyncContext = { client, session, now: () => '2026-10-19T10:00:00.000Z' };
    return { ctx, sent: () => fake.requests, table, files: () => session.toFile() };
  }

  it('creates the record with 5, keeps 4.5 locally, and reports one rounding', async () => {
    const f = fixture();
    const report = await pushToAirtable(f.ctx);
    expect(report.roundedRatings).toBe(1);
    expect(report.summary).toContain('1 rating(s) rounded for Airtable');
    expect(f.table.records).toHaveLength(1);
    expect(f.table.records[0].fields.fldRate).toBe(5);
    // The local file keeps its fraction.
    expect(f.files().rows[0].values.fld_Rate).toBe(4.5);
  });

  it('a second push sends nothing — the echo hash is what the file remembers', async () => {
    const f = fixture();
    await pushToAirtable(f.ctx);
    const before = f.sent().length;
    const again = await pushToAirtable(f.ctx);
    expect(again.pushed).toBe(0);
    expect(again.roundedRatings).toBe(0);
    const writes = f.sent().slice(before).filter((r) => r.method === 'POST' || r.method === 'PATCH');
    expect(writes).toHaveLength(0);
    expect(f.files().rows[0].sync?.remoteHash).toBeTruthy();
  });
});
