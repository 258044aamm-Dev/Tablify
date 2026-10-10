// P7-04 — validation of the sync structures (FORMAT_SPEC §2.1, §3.3, §4.1).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  validateRowSync,
  validateSyncLink,
  validateFieldAirtableMeta,
} from '../../src/format/syncSchema.js';
import { parse } from '../../src/format/parse.js';
import { serialize } from '../../src/format/serialize.js';
import { createSession } from '../../src/model/tableSession.js';

const HASH = 'a'.repeat(64);
const SAMPLES = join(process.cwd(), 'samples');

function validRowSync(): Record<string, unknown> {
  return {
    airtableId: 'recABC123',
    syncedRev: 2,
    syncedAt: '2026-10-09T11:00:00.000Z',
    remoteHash: HASH,
  };
}

function validLink(): Record<string, unknown> {
  return {
    baseId: 'appXYZ123',
    tableId: 'tblXYZ123',
    tableName: 'Tasks',
    linkedAt: '2026-10-09T10:00:00.000Z',
    lastSync: null,
    records: [],
  };
}

describe('validateRowSync', () => {
  it('accepts null (local-only row)', () => {
    expect(validateRowSync(null)).toBeNull();
  });

  it('accepts a minimal valid block', () => {
    expect(validateRowSync(validRowSync())).toBeNull();
  });

  it('accepts a block with remoteDeleted and a conflict', () => {
    const block = {
      ...validRowSync(),
      remoteDeleted: true,
      conflict: {
        kind: 'remote_deleted',
        decision: 'keep_local',
        localRev: 3,
        remoteHash: null,
        decidedAt: '2026-10-09T12:00:00.000Z',
      },
    };
    expect(validateRowSync(block)).toBeNull();
  });

  it.each([
    ['non-object', 'x'],
    ['array', []],
    ['bad airtableId', { ...validRowSync(), airtableId: 'abc' }],
    ['negative syncedRev', { ...validRowSync(), syncedRev: -1 }],
    ['fractional syncedRev', { ...validRowSync(), syncedRev: 1.5 }],
    ['bad syncedAt', { ...validRowSync(), syncedAt: 'yesterday' }],
    ['short remoteHash', { ...validRowSync(), remoteHash: 'abc' }],
    ['uppercase remoteHash', { ...validRowSync(), remoteHash: 'A'.repeat(64) }],
    ['non-boolean remoteDeleted', { ...validRowSync(), remoteDeleted: 'yes' }],
    ['unknown conflict kind', { ...validRowSync(), conflict: { kind: 'maybe', decision: 'keep_local', localRev: 1, remoteHash: null, decidedAt: '2026-10-09T12:00:00.000Z' } }],
    ['unknown conflict decision', { ...validRowSync(), conflict: { kind: 'both_changed', decision: 'merge', localRev: 1, remoteHash: null, decidedAt: '2026-10-09T12:00:00.000Z' } }],
  ])('rejects %s', (_label, value) => {
    expect(validateRowSync(value)).not.toBeNull();
  });
});

describe('validateSyncLink', () => {
  it('accepts null (local-only table)', () => {
    expect(validateSyncLink(null)).toBeNull();
  });

  it('accepts a valid link with a lastSync and records', () => {
    const link = {
      ...validLink(),
      lastSync: { at: '2026-10-09T11:00:00.000Z', direction: 'push', ok: false, summary: 'partial failure' },
      records: [{ airtableId: 'recABC123', remoteHash: HASH }],
    };
    expect(validateSyncLink(link)).toBeNull();
  });

  it.each([
    ['bad baseId', { ...validLink(), baseId: 'base1' }],
    ['bad tableId', { ...validLink(), tableId: 'tbl' }],
    ['missing tableName', { ...validLink(), tableName: undefined }],
    ['bad linkedAt', { ...validLink(), linkedAt: 'nope' }],
    ['unknown lastSync direction', { ...validLink(), lastSync: { at: '2026-10-09T11:00:00.000Z', direction: 'sync', ok: true, summary: '' } }],
    ['records not an array', { ...validLink(), records: {} }],
    ['duplicate record', { ...validLink(), records: [{ airtableId: 'recA1', remoteHash: HASH }, { airtableId: 'recA1', remoteHash: HASH }] }],
    ['record bad hash', { ...validLink(), records: [{ airtableId: 'recA1', remoteHash: 'x' }] }],
  ])('rejects %s', (_label, value) => {
    expect(validateSyncLink(value)).not.toBeNull();
  });
});

describe('validateFieldAirtableMeta', () => {
  it('accepts null/absent and a valid meta object', () => {
    expect(validateFieldAirtableMeta(null)).toBeNull();
    expect(validateFieldAirtableMeta(undefined)).toBeNull();
    expect(validateFieldAirtableMeta({ id: 'fldABC', type: 'formula', readOnly: true })).toBeNull();
  });

  it.each([
    ['bad field id', { id: 'abc', type: 'text', readOnly: false }],
    ['empty type', { id: 'fldABC', type: '', readOnly: false }],
    ['non-boolean readOnly', { id: 'fldABC', type: 'text', readOnly: 'no' }],
  ])('rejects %s', (_label, value) => {
    expect(validateFieldAirtableMeta(value)).not.toBeNull();
  });
});

describe('sync structures survive load, session, and save (P7-04)', () => {
  it('keeps row sync blocks through a session round-trip (store must not drop them)', () => {
    const text = readFileSync(join(SAMPLES, 'v1', 'synced.tablify'), 'utf-8');
    const parsed = parse(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const session = createSession(parsed.data);
    const out = serialize(session.toFile());
    expect(out).toBe(text);
  });

  it('keeps a row sync block after an unrelated edit to another row', () => {
    const text = readFileSync(join(SAMPLES, 'v1', 'synced.tablify'), 'utf-8');
    const parsed = parse(text);
    if (!parsed.ok) throw new Error('fixture must parse');
    const session = createSession(parsed.data);
    session.setValue('row_CCC333', 'fld_name', 'Edited');
    const rows = session.toFile().rows;
    expect(rows.find((r) => r.id === 'row_AAA111')?.sync?.airtableId).toBe('recAAA111aaa');
    expect(rows.find((r) => r.id === 'row_BBB222')?.sync?.conflict?.decision).toBe('keep_local');
  });

  it('keeps a row sync block through undo/redo of an unrelated edit', () => {
    const text = readFileSync(join(SAMPLES, 'v1', 'synced.tablify'), 'utf-8');
    const parsed = parse(text);
    if (!parsed.ok) throw new Error('fixture must parse');
    const session = createSession(parsed.data);
    session.setValue('row_CCC333', 'fld_name', 'Edited');
    session.undo();
    session.redo();
    expect(session.toFile().rows.find((r) => r.id === 'row_AAA111')?.sync?.syncedRev).toBe(2);
  });

  it('writes sync keys in the documented order', () => {
    const text = readFileSync(join(SAMPLES, 'v1', 'synced.tablify'), 'utf-8');
    const parsed = parse(text);
    if (!parsed.ok) throw new Error('fixture must parse');
    const out = serialize(parsed.data);
    const sync = out.indexOf('"airtableId": "recAAA111aaa"');
    const syncedRev = out.indexOf('"syncedRev"', sync);
    const remoteHash = out.indexOf('"remoteHash"', sync);
    expect(sync).toBeGreaterThan(0);
    expect(syncedRev).toBeGreaterThan(sync);
    expect(remoteHash).toBeGreaterThan(syncedRev);
  });
});
