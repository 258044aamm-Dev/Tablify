/**
 * P8-04 vault index tests (adapter). A fake vault stands in for Obsidian: files with paths and
 * mtimes, cachedRead, and getFiles. Covers the rules the pure model cannot: rename keeps links,
 * an open table's live state wins over the disk, and a deleted file leaves the index.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { App } from 'obsidian';
import { VaultLinkIndex } from '../../src/links/vaultLinkIndex.js';
import { createSession } from '../../src/model/tableSession.js';
import { parse } from '../../src/format/parse.js';
import { serialize } from '../../src/format/serialize.js';
import { snapshotTable, summarizeLinks } from '../../src/model/link.js';
import type { LinkRef, TablifyFile } from '../../src/model/types.js';

function sample(name: string): string {
  return readFileSync(join(process.cwd(), 'samples', 'v2', name), 'utf-8');
}

function loadSample(name: string): TablifyFile {
  const result = parse(sample(name));
  if (!result.ok) throw new Error(`${name} did not parse: ${result.error}`);
  return result.data;
}

interface FakeFile {
  text: string;
  mtime: number;
}

function fakeVault(initial: Record<string, FakeFile>) {
  const files: Record<string, FakeFile> = { ...initial };
  const app = {
    vault: {
      getFiles: () =>
        Object.keys(files).map((path) => ({ path, extension: 'tablify', stat: { mtime: files[path].mtime } })),
      cachedRead: async (f: { path: string }) => files[f.path].text,
      on: () => ({}),
    },
    workspace: { onLayoutReady: (cb: () => void) => cb() },
  } as unknown as App;
  return { app, files };
}

const ORDERS = 'orders.tablify';
const CUSTOMERS = 'customers.tablify';
const CUSTOMER_LINK: LinkRef = { tableId: 'tbl_01J9B7CUST', rowId: 'row_01J9B9C001' };

describe('VaultLinkIndex (P8-04 adapter)', () => {
  it('indexes every .tablify file and resolves a link across files', async () => {
    const { app } = fakeVault({
      [ORDERS]: { text: sample('formula-link.tablify'), mtime: 1 },
      [CUSTOMERS]: { text: sample('customers.tablify'), mtime: 1 },
    });
    const idx = new VaultLinkIndex(app);
    await idx.refresh();
    expect(idx.index.paths().sort()).toEqual([CUSTOMERS, ORDERS]);
    const orders = loadSample('formula-link.tablify');
    expect(summarizeLinks(orders.rows[0].values['fld_customer'] as LinkRef[], idx.index)).toEqual({
      text: 'Ada Lovelace',
      broken: 0,
      chips: [{ label: 'Ada Lovelace', broken: false }],
    });
  });

  it('T-I rename the target file: the link still resolves, and no stale copy is left behind', async () => {
    const { app, files } = fakeVault({
      [ORDERS]: { text: sample('formula-link.tablify'), mtime: 1 },
      [CUSTOMERS]: { text: sample('customers.tablify'), mtime: 1 },
    });
    const idx = new VaultLinkIndex(app);
    await idx.refresh();
    // Obsidian renames the file: same content, new path.
    files['people/Clients.tablify'] = files[CUSTOMERS];
    delete files[CUSTOMERS];
    await idx.refresh();
    expect(idx.index.paths().sort()).toEqual([ORDERS, 'people/Clients.tablify']);
    expect(idx.index.duplicates()).toEqual([]);
    expect(summarizeLinks([CUSTOMER_LINK], idx.index)).toEqual({ text: 'Ada Lovelace', broken: 0, chips: [{ label: 'Ada Lovelace', broken: false }] });
  });

  it('an open table publishes live state: unsaved edits resolve, and the disk copy does not win meanwhile', async () => {
    const { app } = fakeVault({ [CUSTOMERS]: { text: sample('customers.tablify'), mtime: 1 } });
    const idx = new VaultLinkIndex(app);
    await idx.refresh();
    const session = createSession(loadSample('customers.tablify'));
    session.setValue('row_01J9B9C001', 'fld_cname', 'Augusta Ada');
    idx.noteLive(CUSTOMERS, snapshotTable(session.toFile(), CUSTOMERS));
    await idx.refresh(); // the disk still says "Ada Lovelace"; the open view wins
    expect(summarizeLinks([CUSTOMER_LINK], idx.index)).toEqual({ text: 'Augusta Ada', broken: 0, chips: [{ label: 'Augusta Ada', broken: false }] });
  });

  it('T-I deleting a target row in an open table shows the broken marker at once', async () => {
    const { app } = fakeVault({ [CUSTOMERS]: { text: sample('customers.tablify'), mtime: 1 } });
    const idx = new VaultLinkIndex(app);
    await idx.refresh();
    const session = createSession(loadSample('customers.tablify'));
    session.deleteRow('row_01J9B9C001');
    idx.noteLive(CUSTOMERS, snapshotTable(session.toFile(), CUSTOMERS));
    expect(summarizeLinks([CUSTOMER_LINK], idx.index)).toEqual({ text: 'Missing row', broken: 1, chips: [{ label: 'Missing row', broken: true }] });
  });

  it('closing the view returns the table to the disk copy on the next refresh', async () => {
    const { app } = fakeVault({ [CUSTOMERS]: { text: sample('customers.tablify'), mtime: 1 } });
    const idx = new VaultLinkIndex(app);
    await idx.refresh();
    const session = createSession(loadSample('customers.tablify'));
    session.deleteRow('row_01J9B9C001');
    idx.noteLive(CUSTOMERS, snapshotTable(session.toFile(), CUSTOMERS));
    idx.dropLive(CUSTOMERS);
    await idx.refresh();
    expect(summarizeLinks([CUSTOMER_LINK], idx.index)).toEqual({ text: 'Ada Lovelace', broken: 0, chips: [{ label: 'Ada Lovelace', broken: false }] });
  });

  it('a deleted target file leaves the index, so its links are broken with a table reason', async () => {
    const { app, files } = fakeVault({
      [ORDERS]: { text: sample('formula-link.tablify'), mtime: 1 },
      [CUSTOMERS]: { text: sample('customers.tablify'), mtime: 1 },
    });
    const idx = new VaultLinkIndex(app);
    await idx.refresh();
    delete files[CUSTOMERS];
    await idx.refresh();
    expect(idx.index.has(CUSTOMERS)).toBe(false);
    expect(summarizeLinks([CUSTOMER_LINK], idx.index)).toEqual({ text: 'Missing table', broken: 1, chips: [{ label: 'Missing table', broken: true }] });
  });

  it('listeners are told when the index changes, and not when nothing changed', async () => {
    const { app, files } = fakeVault({ [CUSTOMERS]: { text: sample('customers.tablify'), mtime: 1 } });
    const idx = new VaultLinkIndex(app);
    let calls = 0;
    idx.onChange(() => {
      calls++;
    });
    await idx.refresh();
    expect(calls).toBe(1);
    await idx.refresh(); // same mtime: nothing to read
    expect(calls).toBe(1);
    files[CUSTOMERS] = { text: files[CUSTOMERS].text, mtime: 2 }; // touched on disk
    await idx.refresh();
    expect(calls).toBe(2);
  });

  it('a saved file reads back into the same snapshot (what the index reads is what the view saves)', () => {
    const original = loadSample('customers.tablify');
    const again = parse(serialize(original));
    if (!again.ok) throw new Error('round trip');
    expect(snapshotTable(again.data, CUSTOMERS)).toEqual(snapshotTable(original, CUSTOMERS));
  });
});
