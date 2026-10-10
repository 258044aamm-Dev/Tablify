// Shared fixture for the sync engine tests (P7-06..P7-09). Uses the real AirtableClient over the fake
// Airtable server, with a fake clock, so no real network or real timers are used.
import { createSession, type TableSession } from '../../src/model/tableSession.js';
import type { FieldDefinition, TablifyFile } from '../../src/model/types.js';
import { AirtableClient } from '../../src/sync/airtableClient.js';
import { createFakeAirtable, makeTable, type FakeAirtable, type FakeTable } from '../__mocks__/airtableServer.js';
import type { SyncContext } from '../../src/sync/engineTypes.js';

export const TOKEN = 'pat-test-0123456789abcdef';
export const BASE = 'appTEST0000000001';
export const TABLE = 'tblTEST0000000001';

export interface Fixture {
  fake: FakeAirtable;
  table: FakeTable;
  session: TableSession;
  ctx: SyncContext;
  advance: (ms: number) => void;
}

export interface FixtureOptions {
  rows?: number;
  writeAllowed?: boolean;
  schemaWriteAllowed?: boolean;
  rejectRecordIds?: string[];
  linked?: boolean;
}

export function makeFixture(opts: FixtureOptions = {}): Fixture {
  let t = Date.parse('2026-10-10T00:00:00.000Z');
  const clock = () => t;
  const sleep = async (ms: number) => {
    t += ms;
  };
  const table = makeTable(TABLE, 'Tasks', opts.rows ?? 20);
  // Adds a single-select field, with 'Red' and 'Blue' values alternating.
  table.fields.push({ id: 'fldTag', name: 'Tag', type: 'singleSelect' });
  table.records.forEach((r, i) => {
    r.fields.fldTag = i % 2 === 0 ? 'Red' : 'Blue';
  });
  const fake = createFakeAirtable({
    token: TOKEN,
    bases: [{ id: BASE, name: 'Test base', tables: [table] }],
    now: clock,
    writeAllowed: opts.writeAllowed,
    schemaWriteAllowed: opts.schemaWriteAllowed,
    rejectRecordIds: opts.rejectRecordIds,
  });
  const client = new AirtableClient({ token: TOKEN, transport: fake.handler, clock, sleep });
  const fields: FieldDefinition[] = [
    { id: 'fld_Name', name: 'Name', type: 'text', primary: true, airtable: { id: 'fldName', type: 'singleLineText', readOnly: false } },
    { id: 'fld_Score', name: 'Score', type: 'number', airtable: { id: 'fldNum', type: 'number', readOnly: false } },
    {
      id: 'fld_Tag',
      name: 'Tag',
      type: 'single_select',
      options: [
        { id: 'opt_red', name: 'Red', color: 'red' },
        { id: 'opt_blue', name: 'Blue', color: 'blue' },
      ],
      airtable: { id: 'fldTag', type: 'singleSelect', readOnly: false },
    },
    { id: 'fld_Notes', name: 'Notes', type: 'text' },
  ];
  const file: TablifyFile = {
    formatVersion: 1,
    tableId: 'tbl_local',
    name: 'Tasks',
    fields,
    rows: [],
    views: [{ id: 'view_1', name: 'Default', sort: [], groupBy: null, hidden: [], frozenColumns: 0, rowHeight: 'medium', columnWidths: {}, columnOrder: [] }],
    syncLink: opts.linked === false
      ? null
      : { baseId: BASE, tableId: TABLE, tableName: 'Tasks', linkedAt: '2026-10-10T00:00:00.000Z', lastSync: null, records: [] },
  };
  const session = createSession(file);
  const ctx: SyncContext = { client, session, now: () => new Date(t).toISOString() };
  return { fake, table, session, ctx, advance: (ms) => void (t += ms) };
}

/** Canonical snapshot of the table content, without the sync link's timestamps. */
export function snapshot(session: TableSession): string {
  const f = session.toFile();
  return JSON.stringify({ fields: f.fields, rows: f.rows, syncLink: f.syncLink && { ...f.syncLink, lastSync: null } });
}
