// One assertion per documented case of the decision table (P7-08). docs/sync-rules.md lists the same cases.
import { describe, it, expect } from 'vitest';
import { classifyLinked, classifyLocalOnly, type LinkedFacts } from '../../src/sync/rules.js';
import type { RowSync } from '../../src/model/types.js';

const sync: RowSync = { airtableId: 'rec000001', syncedRev: 1, syncedAt: '2026-10-10T00:00:00.000Z', remoteHash: 'h0' };
const facts = (over: Partial<LinkedFacts>): LinkedFacts => ({
  localChanged: false,
  remoteExists: true,
  remoteChanged: false,
  sameValues: false,
  decided: false,
  ...over,
});

describe('decision table (P7-08)', () => {
  it('case 1, no change: nothing happens on pull or push', () => {
    expect(classifyLinked(facts({}), sync, 'pull').action).toBe('none');
    expect(classifyLinked(facts({}), sync, 'push').action).toBe('none');
  });

  it('case 2, local only: push sends it; pull keeps the local value', () => {
    const f = facts({ localChanged: true });
    expect(classifyLinked(f, sync, 'push')).toMatchObject({ caseId: 'local_only', action: 'push' });
    expect(classifyLinked(f, sync, 'pull')).toMatchObject({ caseId: 'local_only', action: 'keep_local_only' });
  });

  it('case 3, remote only: pull writes the remote value; push reports it and does not overwrite', () => {
    const f = facts({ remoteChanged: true });
    expect(classifyLinked(f, sync, 'pull')).toMatchObject({ caseId: 'remote_only', action: 'pull' });
    expect(classifyLinked(f, sync, 'push')).toMatchObject({ caseId: 'remote_only', action: 'remote_changed' });
  });

  it('case 4, both changed to different values: a conflict, nothing is written', () => {
    expect(classifyLinked(facts({ localChanged: true, remoteChanged: true }), sync, 'pull'))
      .toMatchObject({ caseId: 'both_different', action: 'conflict', conflictKind: 'both_changed' });
  });

  it('case 5, both changed to the same value: adopted with no conflict', () => {
    expect(classifyLinked(facts({ localChanged: true, remoteChanged: true, sameValues: true }), sync, 'push'))
      .toMatchObject({ caseId: 'both_same', action: 'adopt' });
  });

  it('case 6, remote deleted and local unchanged: flagged, row kept', () => {
    expect(classifyLinked(facts({ remoteExists: false }), sync, 'pull')).toMatchObject({ caseId: 'remote_deleted', action: 'mark_remote_deleted' });
    expect(classifyLinked(facts({ remoteExists: false }), { ...sync, remoteDeleted: true }, 'pull')).toMatchObject({ action: 'none' });
  });

  it('case 6b, remote deleted and local changed: a conflict, the user chooses', () => {
    expect(classifyLinked(facts({ remoteExists: false, localChanged: true }), sync, 'push'))
      .toMatchObject({ caseId: 'remote_deleted_local_changed', action: 'conflict', conflictKind: 'remote_deleted' });
  });

  it('case 7, local deleted: handled by the run as a report (the record is kept in Airtable)', () => {
    // A local deletion has no row, so it is found by comparing the link's record list with the rows.
    // Pull and push count it in localDeletedKept (tested in engine.test.ts via the link snapshot).
    expect(classifyLocalOnly('push').action).toBe('create_remote');
  });

  it('a decision that still applies is not asked again', () => {
    expect(classifyLinked(facts({ localChanged: true, remoteChanged: true, decided: true }), sync, 'pull'))
      .toMatchObject({ action: 'decided' });
  });
});
