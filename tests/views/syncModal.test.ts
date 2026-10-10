/**
 * @vitest-environment jsdom
 */
// P7-10 modal and controller tests. The modal runs the real engine against the fake Airtable server.
import { describe, it, expect, vi } from 'vitest';
import { App } from 'obsidian';
import { SyncModal } from '../../src/views/sync/SyncModal.js';
import { linkTable, unlinkTable } from '../../src/views/sync/syncController.js';
import { makeFixture, TABLE, BASE } from '../sync/engineHarness.js';
import { pullFromAirtable } from '../../src/sync/pull.js';

const tick = async (n = 6) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

function buttonByText(root: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === text);
  if (!found) throw new Error(`no button "${text}"`);
  return found as HTMLButtonElement;
}

function openModal(f: ReturnType<typeof makeFixture>, token: string | null = 'pat-test-0123456789abcdef') {
  const changed = vi.fn();
  const modal = new SyncModal(new App(), {
    session: f.session,
    token,
    makeClient: () => f.ctx.client as never,
    now: () => '2026-10-10T00:00:00.000Z',
    changed,
  });
  modal.onOpen();
  return { modal, changed, root: modal.contentEl as HTMLElement };
}

describe('sync modal (P7-10)', () => {
  it('shows token status without the value, and disables actions when unlinked', async () => {
    const f = makeFixture({ linked: false });
    const { root } = openModal(f);
    await tick();
    const text = root.textContent ?? '';
    expect(text).toContain('stored in Tablify settings');
    expect(text).not.toContain('pat-test-0123456789abcdef');
    expect(buttonByText(root, 'Pull from Airtable').disabled).toBe(true);
    expect(buttonByText(root, 'Push to Airtable').disabled).toBe(true);
  });

  it('with no token: says so and never calls Airtable', async () => {
    const f = makeFixture({ linked: false });
    const before = f.fake.requests.length;
    const { root } = openModal(f, null);
    await tick();
    expect(root.textContent).toContain('No token');
    expect(f.fake.requests.length).toBe(before);
  });

  it('link, pull, and show the status line with the summary', async () => {
    const f = makeFixture({ rows: 3, linked: false });
    const { root, changed } = openModal(f);
    await tick();
    buttonByText(root, 'Link table').click();
    await tick();
    expect(f.session.getSyncLink()?.tableId).toBe(TABLE);
    expect(changed).toHaveBeenCalled();
    buttonByText(root, 'Pull from Airtable').click();
    await tick();
    expect(f.session.store.getAllRows()).toHaveLength(3);
    expect(root.textContent).toContain('Pulled');
    expect(root.textContent).toContain('3 new');
  });

  it('a conflict appears with its three choices, and Keep both adds one row', async () => {
    const f = makeFixture({ rows: 2 });
    await pullFromAirtable(f.ctx);
    const first = f.session.store.getAllRows()[0];
    f.session.store.updateRow(first.id, { fld_Name: 'Local edit' });
    f.table.records[0].fields.fldName = 'Remote edit';
    const { root } = openModal(f);
    await tick();
    buttonByText(root, 'Pull from Airtable').click();
    await tick();
    expect(root.textContent).toContain('Conflicts (1)');
    const before = f.session.store.getAllRows().length;
    buttonByText(root, 'Keep both').click();
    await tick();
    expect(f.session.store.getAllRows()).toHaveLength(before + 1);
    expect(root.textContent).toContain('Kept both');
  });

  it('field creation: the plan lists fields, and nothing is created until the button is clicked', async () => {
    const f = makeFixture({ rows: 2 });
    await pullFromAirtable(f.ctx);
    f.session.addField('Done', 'checkbox');
    const { root } = openModal(f);
    await tick();
    buttonByText(root, 'Check fields to create').click();
    await tick();
    expect(root.textContent).toContain('Done (checkbox → checkbox)');
    expect(f.fake.requests.some((r) => r.method === 'POST' && r.path.endsWith('/fields'))).toBe(false);
    buttonByText(root, 'Cancel').click();
    await tick();
    expect(f.fake.requests.some((r) => r.method === 'POST' && r.path.endsWith('/fields'))).toBe(false);
    expect(f.table.fields.map((x) => x.name)).not.toContain('Done');
  });

  it('a network failure shows a message and says nothing changed', async () => {
    const f = makeFixture({ rows: 2 });
    await pullFromAirtable(f.ctx);
    const before = JSON.stringify(f.session.toFile().rows);
    const { root } = openModal(f);
    await tick();
    // Queued after open, so the base list does not use them up.
    for (let i = 0; i < 5; i++) f.fake.failures.push({ networkError: true });
    buttonByText(root, 'Pull from Airtable').click();
    await tick(10);
    expect(root.textContent).toContain('Nothing in the table changed');
    expect(JSON.stringify(f.session.toFile().rows)).toBe(before);
  });
});

describe('sync controller (P7-10)', () => {
  it('links by name and type, and leaves unmatched columns local', () => {
    const f = makeFixture({ linked: false });
    unlinkTable(f.session); // the fixture starts with links; start from unlinked columns
    const res = linkTable(f.session, { baseId: BASE, table: { id: TABLE, name: 'Tasks', primaryFieldId: 'fldName', fields: [
      { id: 'fldName', name: 'Name', type: 'singleLineText' },
      { id: 'fldNum', name: 'score', type: 'number' },
    ] }, replaceColumns: false }, '2026-10-10T00:00:00.000Z');
    expect(res.matched).toBe(2);
    expect(f.session.getField('fld_Name')?.airtable?.id).toBe('fldName');
    expect(f.session.getField('fld_Score')?.airtable?.id).toBe('fldNum');
    expect(f.session.getField('fld_Notes')?.airtable).toBeUndefined();
  });

  it('replace columns: local columns become the Airtable schema', () => {
    const f = makeFixture({ linked: false });
    linkTable(f.session, { baseId: BASE, table: { id: TABLE, name: 'Tasks', primaryFieldId: 'fldName', fields: [
      { id: 'fldName', name: 'Name', type: 'singleLineText' },
      { id: 'fldX', name: 'Other', type: 'number' },
    ] }, replaceColumns: true }, '2026-10-10T00:00:00.000Z');
    expect(f.session.getFields().map((x) => x.name)).toEqual(['Name', 'Other']);
    expect(f.session.getSyncLink()?.tableId).toBe(TABLE);
  });

  it('unlink removes sync state and keeps local values', async () => {
    const f = makeFixture({ rows: 2 });
    await pullFromAirtable(f.ctx);
    const values = f.session.store.getAllRows().map((r) => r.values.fld_Name);
    unlinkTable(f.session);
    expect(f.session.getSyncLink()).toBeNull();
    expect(f.session.store.getAllRows().every((r) => r.sync === null)).toBe(true);
    expect(f.session.store.getAllRows().map((r) => r.values.fld_Name)).toEqual(values);
    expect(f.session.getFields().every((x) => !x.airtable)).toBe(true);
  });
});
