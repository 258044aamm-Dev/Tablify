// P7-01 — embed source parsing and the shared document (T-E logic, Node, no DOM).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseEmbedSource } from '../../src/embed/embedSource.js';
import { EmbedRegistry, type EmbedIO } from '../../src/embed/embedDocument.js';
import { parse } from '../../src/format/parse.js';

const TYPICAL = readFileSync(join(process.cwd(), 'samples', 'v1', 'typical.tablify'), 'utf-8');

/** In-memory file system for one or more paths. */
function memIO(files: Record<string, string>) {
  const state = { files: { ...files }, reads: 0, writes: [] as string[], failWrites: false };
  const io: EmbedIO = {
    read: async (p) => {
      state.reads += 1;
      if (!(p in state.files)) throw new Error('ENOENT');
      return state.files[p];
    },
    write: async (p, text) => {
      if (state.failWrites) throw new Error('disk full');
      state.writes.push(text);
      state.files[p] = text;
    },
  };
  return { io, state };
}

/** Returns the first row id and first visible field id of a .tablify text. */
function firstCell(text: string) {
  const parsed = parse(text);
  if (!parsed.ok) throw new Error('fixture must parse');
  const row = parsed.data.rows[0];
  const field = parsed.data.fields[0];
  return { rowId: row.id, fieldId: field.id };
}

describe('parseEmbedSource', () => {
  it.each([
    ['notes/plan.tablify', 'notes/plan.tablify'],
    ['  plan.tablify  \n', 'plan.tablify'],
    ['plan.tablify\nview: grid', 'plan.tablify'],
    ['view: Grid\nplan.tablify', 'plan.tablify'],
  ])('accepts %j', (body, path) => {
    expect(parseEmbedSource(body)).toEqual({ ok: true, path });
  });

  it.each([
    ['', 'add the path'],
    ['   \n  ', 'add the path'],
    ['a.tabula', 'only .tablify'],
    ['a.md', 'only .tablify'],
    ['notes/a', 'only .tablify'],
    ['../secret.tablify', 'inside the vault'],
    ['a/../../b.tablify', 'inside the vault'],
    ['/etc/passwd.tablify', 'vault-relative'],
    ['C:\\x.tablify', 'vault-relative'],
    ['a\\b.tablify', 'vault-relative'],
    ['a.tablify\nb.tablify', 'one file path'],
    ['a.tablify\nview: kanban', 'not supported'],
    ['a\u0007.tablify', 'control characters'],
    ['x'.repeat(600) + '.tablify', 'too long'],
  ])('rejects %j with a clear message (%s)', (body, fragment) => {
    const r = parseEmbedSource(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(fragment);
  });
});

describe('EmbedRegistry: one document per file', () => {
  it('two acquires of one file share one document and count two references', async () => {
    const { io, state } = memIO({ 'a.tablify': TYPICAL });
    const reg = new EmbedRegistry();
    const d1 = await reg.acquire('a.tablify', io);
    const d2 = await reg.acquire('a.tablify', io);
    expect(d1).toBe(d2);
    expect(reg.refCount('a.tablify')).toBe(2);
    expect(state.reads).toBe(1); // loaded once
  });

  it('releasing the last reference drops the document; the next acquire reloads it', async () => {
    const { io, state } = memIO({ 'a.tablify': TYPICAL });
    const reg = new EmbedRegistry();
    await reg.acquire('a.tablify', io);
    await reg.acquire('a.tablify', io);
    reg.release('a.tablify');
    expect(reg.size()).toBe(1);
    reg.release('a.tablify');
    expect(reg.size()).toBe(0);
    await reg.acquire('a.tablify', io);
    expect(state.reads).toBe(2);
  });

  it('a missing file is an error state on the document, not a throw', async () => {
    const { io } = memIO({});
    const reg = new EmbedRegistry();
    const doc = await reg.acquire('gone.tablify', io);
    expect(doc.getSession()).toBeNull();
    expect(doc.getError()).toContain('was not found');
  });

  it('an invalid file gives the parser error, not a crash', async () => {
    const { io } = memIO({ 'bad.tablify': '{ not json' });
    const reg = new EmbedRegistry();
    const doc = await reg.acquire('bad.tablify', io);
    expect(doc.getSession()).toBeNull();
    expect(doc.getError()).toBeTruthy();
  });
});

describe('EmbedDocument: edits save through the same serialize path', () => {
  it('a change made through the shared document is written once, and both subscribers see it', async () => {
    const { io, state } = memIO({ 'a.tablify': TYPICAL });
    const reg = new EmbedRegistry();
    const doc = await reg.acquire('a.tablify', io);
    await reg.acquire('a.tablify', io); // second embed
    let seenByA = 0;
    let seenByB = 0;
    doc.subscribe(() => seenByA++);
    doc.subscribe(() => seenByB++);
    const { rowId, fieldId } = firstCell(TYPICAL);
    doc.mutate((s) => s.setValue(rowId, fieldId, 'EDITED FROM EMBED'));
    await doc.save();
    expect(seenByA).toBe(1);
    expect(seenByB).toBe(1);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toContain('EDITED FROM EMBED');
    expect(parse(state.writes[0]).ok).toBe(true);
  });

  it('after our own save, a file change event does not reload (no loop)', async () => {
    const { io, state } = memIO({ 'a.tablify': TYPICAL });
    const reg = new EmbedRegistry();
    const doc = await reg.acquire('a.tablify', io);
    const { rowId, fieldId } = firstCell(TYPICAL);
    doc.mutate((s) => s.setValue(rowId, fieldId, 'OWN SAVE'));
    await doc.save();
    const reloaded = await doc.fileChanged();
    expect(reloaded).toBe(false);
    expect(state.writes).toHaveLength(1);
  });

  it('an external edit reloads the document and notifies the embeds', async () => {
    const { io, state } = memIO({ 'a.tablify': TYPICAL });
    const reg = new EmbedRegistry();
    const doc = await reg.acquire('a.tablify', io);
    let notified = 0;
    doc.subscribe(() => notified++);
    const { rowId, fieldId } = firstCell(TYPICAL);
    const edited = TYPICAL.replace(
      JSON.stringify(doc.getSession()?.store.getRow(rowId)?.values[fieldId] ?? ''),
      '"CHANGED OUTSIDE"',
    );
    expect(edited).not.toBe(TYPICAL);
    state.files['a.tablify'] = edited;
    const reloaded = await reg.fileChanged('a.tablify').then(() => true);
    expect(reloaded).toBe(true);
    expect(notified).toBe(1);
    expect(doc.getSession()?.store.getRow(rowId)?.values[fieldId]).toBe('CHANGED OUTSIDE');
  });

  it('a file deleted outside becomes an error state and does not throw', async () => {
    const { io, state } = memIO({ 'a.tablify': TYPICAL });
    const reg = new EmbedRegistry();
    const doc = await reg.acquire('a.tablify', io);
    delete state.files['a.tablify'];
    await reg.fileChanged('a.tablify');
    expect(doc.getSession()).toBeNull();
    expect(doc.getError()).toContain('was not found');
  });

  it('a failed write keeps the in-memory edit and does not throw', async () => {
    const { io, state } = memIO({ 'a.tablify': TYPICAL });
    const reg = new EmbedRegistry();
    const doc = await reg.acquire('a.tablify', io);
    state.failWrites = true;
    const { rowId, fieldId } = firstCell(TYPICAL);
    doc.mutate((s) => s.setValue(rowId, fieldId, 'KEPT IN MEMORY'));
    await expect(doc.save()).resolves.toBeUndefined();
    expect(doc.getSession()?.store.getRow(rowId)?.values[fieldId]).toBe('KEPT IN MEMORY');
    state.failWrites = false;
    await doc.save();
    expect(state.files['a.tablify']).toContain('KEPT IN MEMORY');
  });

  it('two quick edits save in order and the file ends with the last state', async () => {
    const { io, state } = memIO({ 'a.tablify': TYPICAL });
    const reg = new EmbedRegistry();
    const doc = await reg.acquire('a.tablify', io);
    const { rowId, fieldId } = firstCell(TYPICAL);
    doc.mutate((s) => s.setValue(rowId, fieldId, 'FIRST'));
    doc.mutate((s) => s.setValue(rowId, fieldId, 'SECOND'));
    await doc.save();
    expect(state.files['a.tablify']).toContain('SECOND');
    expect(state.files['a.tablify']).not.toContain('FIRST');
  });
});
