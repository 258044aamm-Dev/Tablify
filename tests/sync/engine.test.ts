/**
 * @vitest-environment jsdom
 */
// T-I scenarios for pull (P7-06), push (P7-07), conflicts (P7-08), and auto-create (P7-09),
// run against the fake Airtable server. Live tests stay NOT RUN until the owner supplies a base.
import { describe, it, expect } from 'vitest';
import { pullFromAirtable } from '../../src/sync/pull.js';
import { pushToAirtable } from '../../src/sync/push.js';
import { resolveConflict } from '../../src/sync/conflicts.js';
import { planAutoCreate, createMissingFields } from '../../src/sync/autoCreate.js';
import { UnknownChoiceError } from '../../src/sync/values.js';
import { makeFixture, snapshot } from './engineHarness.js';

const row = (f: ReturnType<typeof makeFixture>, airtableId: string) =>
  f.session.store.getAllRows().find((r) => r.sync?.airtableId === airtableId)!;

describe('pull (P7-06)', () => {
  it('a 200-record pull matches the Airtable export with zero mismatches', async () => {
    const f = makeFixture({ rows: 200 });
    const rep = await pullFromAirtable(f.ctx);
    expect(rep.created).toBe(200);
    const rows = f.session.store.getAllRows();
    expect(rows).toHaveLength(200);
    let mismatches = 0;
    for (const rec of f.table.records) {
      const r = rows.find((x) => x.sync?.airtableId === rec.id);
      if (!r) { mismatches++; continue; }
      if (r.values.fld_Name !== rec.fields.fldName) mismatches++;
      if (r.values.fld_Score !== rec.fields.fldNum) mismatches++;
      const tag = r.values.fld_Tag === 'opt_red' ? 'Red' : 'Blue';
      if (tag !== rec.fields.fldTag) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it('pulling twice in a row changes nothing', async () => {
    const f = makeFixture({ rows: 30 });
    await pullFromAirtable(f.ctx);
    const before = snapshot(f.session);
    const rep = await pullFromAirtable(f.ctx);
    expect(snapshot(f.session)).toBe(before);
    expect(rep.created + rep.updated + rep.remoteDeleted).toBe(0);
    expect(rep.unchanged).toBe(30);
  });

  it('a network failure mid-pull leaves the file unchanged', async () => {
    const f = makeFixture({ rows: 30 });
    await pullFromAirtable(f.ctx);
    const before = snapshot(f.session);
    // Enough failures to exhaust the client's retries (4 attempts).
    for (let i = 0; i < 5; i++) f.fake.failures.push({ networkError: true });
    f.table.records[0].fields.fldName = 'Changed remotely';
    await expect(pullFromAirtable(f.ctx)).rejects.toThrow();
    expect(snapshot(f.session)).toBe(before);
  });

  it('keeps local-only rows and adds remote-new records', async () => {
    const f = makeFixture({ rows: 3 });
    f.session.store.createRow({ fld_Name: 'Local only' });
    f.table.records.push({ id: 'rec999999', createdTime: '2026-10-10T00:00:00.000Z', fields: { fldName: 'New remote', fldNum: 7 } });
    const rep = await pullFromAirtable(f.ctx);
    expect(rep.localOnly).toBe(1);
    expect(rep.created).toBe(4); // three fixture records plus the new one
    expect(f.session.store.getAllRows().map((r) => r.values.fld_Name)).toEqual(
      expect.arrayContaining(['Local only', 'New remote']),
    );
  });

  it('flags a remotely deleted record and keeps the row', async () => {
    const f = makeFixture({ rows: 3 });
    await pullFromAirtable(f.ctx);
    const removed = f.table.records.shift()!;
    const rep = await pullFromAirtable(f.ctx);
    expect(rep.remoteDeleted).toBe(1);
    const r = row(f, removed.id);
    expect(r).toBeDefined();
    expect(r.sync?.remoteDeleted).toBe(true);
  });

  it('an unknown Airtable option aborts the pull with no change', async () => {
    const f = makeFixture({ rows: 4 });
    await pullFromAirtable(f.ctx);
    const before = snapshot(f.session);
    f.table.records[1].fields.fldTag = 'Green';
    await expect(pullFromAirtable(f.ctx)).rejects.toBeInstanceOf(UnknownChoiceError);
    expect(snapshot(f.session)).toBe(before);
  });

  it('clears the undo stack after a pull', async () => {
    const f = makeFixture({ rows: 3 });
    await pullFromAirtable(f.ctx);
    f.session.store.updateRow(f.session.store.getAllRows()[0].id, { fld_Notes: 'x' });
    f.session.stack.execute({
      type: 'noop',
      do: () => {},
      undo: () => {},
    });
    expect(f.session.stack.undoStackSize()).toBe(1);
    await pullFromAirtable(f.ctx);
    expect(f.session.stack.undoStackSize()).toBe(0);
  });
});

describe('push (P7-07)', () => {
  it('pushing 10 changed rows sends exactly one 10-record request', async () => {
    const f = makeFixture({ rows: 200 });
    await pullFromAirtable(f.ctx);
    const rows = f.session.store.getAllRows().slice(0, 10);
    for (const r of rows) f.session.store.updateRow(r.id, { fld_Score: 999 });
    const before = f.fake.requests.length;
    const rep = await pushToAirtable(f.ctx);
    const patches = f.fake.requests.slice(before).filter((r) => r.method === 'PATCH');
    expect(patches).toHaveLength(1);
    expect((patches[0].body as { records: unknown[] }).records).toHaveLength(10);
    expect(rep.pushed).toBe(10);
    expect(rep.ok).toBe(true);
  });

  it('after a push, a pull compares equal to the local rows', async () => {
    const f = makeFixture({ rows: 50 });
    await pullFromAirtable(f.ctx);
    for (const r of f.session.store.getAllRows().slice(0, 10)) f.session.store.updateRow(r.id, { fld_Name: 'Edited ' + r.id });
    await pushToAirtable(f.ctx);
    const before = snapshot(f.session);
    const rep = await pullFromAirtable(f.ctx);
    expect(rep.updated).toBe(0);
    expect(snapshot(f.session)).toBe(before);
  });

  it('a rejected row in a batch: the others succeed, that row stays changed and is reported', async () => {
    const f = makeFixture({ rows: 10, rejectRecordIds: ['rec000005'] });
    await pullFromAirtable(f.ctx);
    for (const r of f.session.store.getAllRows()) f.session.store.updateRow(r.id, { fld_Score: 555 });
    const rep = await pushToAirtable(f.ctx);
    expect(rep.failures).toHaveLength(1);
    expect(rep.pushed).toBe(9);
    expect(rep.ok).toBe(false);
    const bad = row(f, 'rec000005');
    expect(bad.rev).not.toBe(bad.sync!.syncedRev);
    expect(f.table.records.find((r) => r.id === 'rec000005')!.fields.fldNum).not.toBe(555);
    expect(f.table.records.find((r) => r.id === 'rec000001')!.fields.fldNum).toBe(555);
    expect(rep.failures[0].reason.length).toBeGreaterThan(0);
  });

  it('a new local row is created in Airtable and linked', async () => {
    const f = makeFixture({ rows: 2 });
    await pullFromAirtable(f.ctx);
    const local = f.session.store.createRow({ fld_Name: 'Brand new', fld_Score: 4 });
    const rep = await pushToAirtable(f.ctx);
    expect(rep.created).toBe(1);
    const linked = f.session.store.getRow(local.id)!;
    expect(linked.sync?.airtableId).toMatch(/^rec/);
    expect(f.table.records.find((r) => r.id === linked.sync!.airtableId)!.fields.fldName).toBe('Brand new');
  });

  it('reports a remote change and does not overwrite it', async () => {
    const f = makeFixture({ rows: 3 });
    await pullFromAirtable(f.ctx);
    const r1 = row(f, 'rec000001');
    f.session.store.updateRow(r1.id, { fld_Name: 'Local side' });
    f.table.records[0].fields.fldName = 'Remote side';
    const rep = await pushToAirtable(f.ctx);
    expect(rep.conflicts).toHaveLength(1);
    expect(f.table.records[0].fields.fldName).toBe('Remote side');
  });

  it('a failed remote read sends nothing', async () => {
    const f = makeFixture({ rows: 3 });
    await pullFromAirtable(f.ctx);
    f.session.store.updateRow(row(f, 'rec000001').id, { fld_Score: 1 });
    for (let i = 0; i < 5; i++) f.fake.failures.push({ networkError: true });
    const before = snapshot(f.session);
    await expect(pushToAirtable(f.ctx)).rejects.toThrow();
    expect(snapshot(f.session)).toBe(before);
    expect(f.fake.requests.some((r) => r.method === 'PATCH')).toBe(false);
  });
});

describe('conflicts (P7-08)', () => {
  async function conflictFixture() {
    const f = makeFixture({ rows: 3 });
    await pullFromAirtable(f.ctx);
    const r1 = row(f, 'rec000001');
    f.session.store.updateRow(r1.id, { fld_Name: 'Local edit' });
    f.table.records[0].fields.fldName = 'Remote edit';
    const rep = await pullFromAirtable(f.ctx);
    expect(rep.conflicts).toHaveLength(1);
    expect(f.session.store.getRow(r1.id)!.values.fld_Name).toBe('Local edit');
    return { f, rowId: r1.id };
  }

  it('a both-changed pull is reported and nothing is overwritten', async () => {
    await conflictFixture();
  });

  it('keep both creates exactly one new row with the remote values', async () => {
    const { f, rowId } = await conflictFixture();
    const before = f.session.store.getAllRows().length;
    const res = await resolveConflict(f.ctx, rowId, 'keep_both');
    expect(f.session.store.getAllRows()).toHaveLength(before + 1);
    expect(res.createdRowId).not.toBeNull();
    expect(f.session.store.getRow(res.createdRowId!)!.values.fld_Name).toBe('Remote edit');
    expect(f.session.store.getRow(rowId)!.values.fld_Name).toBe('Local edit');
  });

  it('keep remote writes the remote values into the row', async () => {
    const { f, rowId } = await conflictFixture();
    const res = await resolveConflict(f.ctx, rowId, 'keep_remote');
    expect(res.createdRowId).toBeNull();
    expect(f.session.store.getRow(rowId)!.values.fld_Name).toBe('Remote edit');
  });

  it('keep local is pushed on the next push and not asked again', async () => {
    const { f, rowId } = await conflictFixture();
    await resolveConflict(f.ctx, rowId, 'keep_local');
    const rep1 = await pullFromAirtable(f.ctx);
    expect(rep1.conflicts).toHaveLength(0);
    const rep2 = await pushToAirtable(f.ctx);
    expect(rep2.pushed).toBe(1);
    expect(f.table.records[0].fields.fldName).toBe('Local edit');
  });

  it('a resolution is refused when there is no open conflict', async () => {
    const f = makeFixture({ rows: 2 });
    await pullFromAirtable(f.ctx);
    const id = f.session.store.getAllRows()[0].id;
    await expect(resolveConflict(f.ctx, id, 'keep_remote')).rejects.toThrow(/no open conflict/);
  });

  it('remote deleted with a local edit: keep local unlinks the row, keep remote removes it', async () => {
    const f = makeFixture({ rows: 3 });
    await pullFromAirtable(f.ctx);
    const r1 = row(f, 'rec000001');
    f.session.store.updateRow(r1.id, { fld_Name: 'Edited locally' });
    f.table.records.shift();
    const rep = await pullFromAirtable(f.ctx);
    expect(rep.conflicts[0].kind).toBe('remote_deleted');
    await expect(resolveConflict(f.ctx, r1.id, 'keep_both')).rejects.toThrow();
    await resolveConflict(f.ctx, r1.id, 'keep_local');
    expect(f.session.store.getRow(r1.id)!.sync).toBeNull();
  });
});

describe('create missing fields (P7-09)', () => {
  function addLocalFields(f: ReturnType<typeof makeFixture>) {
    f.session.addField('Done', 'checkbox');
    f.session.addField('Due', 'date');
  }
  // Notes is a local-only text field from the fixture, so it is also proposed. Expected list: Notes, Done, Due.

  it('cancel path: nothing is created in Airtable', async () => {
    const f = makeFixture({ rows: 2 });
    await pullFromAirtable(f.ctx);
    addLocalFields(f);
    const plan = planAutoCreate(f.session.getFields() as never, f.table.fields);
    expect(plan.items.map((i) => i.name)).toEqual(['Notes', 'Done', 'Due']);
    await expect(createMissingFields(f.ctx, plan, false)).rejects.toThrow(/confirmation/);
    expect(f.fake.requests.some((r) => r.method === 'POST' && r.path.endsWith('/fields'))).toBe(false);
    expect(f.table.fields.map((x) => x.name)).not.toContain('Done');
  });

  it('confirm path: creates exactly the listed fields with matching types', async () => {
    const f = makeFixture({ rows: 2 });
    await pullFromAirtable(f.ctx);
    addLocalFields(f);
    const plan = planAutoCreate(f.session.getFields() as never, f.table.fields);
    const res = await createMissingFields(f.ctx, plan, true);
    expect(res.failed).toBeNull();
    expect(res.created.map((c) => [c.name, c.airtableType])).toEqual([['Notes', 'singleLineText'], ['Done', 'checkbox'], ['Due', 'date']]);
    expect(f.table.fields.find((x) => x.name === 'Done')?.type).toBe('checkbox');
    expect(f.table.fields.find((x) => x.name === 'Due')?.type).toBe('date');
    const done = f.session.getFields().find((x) => x.name === 'Done')!;
    expect(done.airtable?.id).toMatch(/^fld/);
    expect(done.airtable?.readOnly).toBe(false);
  });

  it('a token without the scope gets a clear error and creates nothing', async () => {
    const f = makeFixture({ rows: 2, schemaWriteAllowed: false });
    await pullFromAirtable(f.ctx);
    addLocalFields(f);
    const before = f.table.fields.length;
    const plan = planAutoCreate(f.session.getFields() as never, f.table.fields);
    const res = await createMissingFields(f.ctx, plan, true);
    expect(res.created).toHaveLength(0);
    expect(res.failed).not.toBeNull();
    expect(f.table.fields.length).toBe(before);
  });

  it('refuses to create fields while remote records differ from the last sync', async () => {
    const f = makeFixture({ rows: 2 });
    await pullFromAirtable(f.ctx);
    addLocalFields(f);
    f.table.records[0].fields.fldName = 'changed remotely';
    const plan = planAutoCreate(f.session.getFields() as never, f.table.fields);
    await expect(createMissingFields(f.ctx, plan, true)).rejects.toThrow(/Pull first/);
    expect(f.table.fields.map((x) => x.name)).not.toContain('Done');
  });
});
