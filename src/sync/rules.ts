// The sync decision table (P7-08). Pure: it takes facts about one row and returns the outcome.
// docs/sync-rules.md lists the same cases. Keep the two in step.
import type { CellValue, FieldDefinition, Row, RowSync, SyncConflictKind } from '../model/types.js';
import { canonicalJson } from './hash.js';
import { hashValues, localValues, remoteValues } from './values.js';
import type { AirtableRecord } from './airtableClient.js';

export type SyncOp = 'pull' | 'push';

/** The seven documented cases, plus the two that cover rows which are not linked yet. */
export type CaseId =
  | 'no_change'
  | 'local_only'
  | 'remote_only'
  | 'both_same'
  | 'both_different'
  | 'remote_deleted'
  | 'remote_deleted_local_changed'
  | 'local_deleted'
  | 'new_remote'
  | 'new_local';

export type RowAction =
  | 'none'              // nothing to do
  | 'push'              // send the local row to Airtable
  | 'pull'              // write the remote values into the row
  | 'adopt'             // both sides already agree: record the new hashes, write no values
  | 'conflict'          // needs the user's choice; nothing is written
  | 'decided'           // a stored decision still applies; not asked again
  | 'mark_remote_deleted'
  | 'remote_changed'    // a push found remote changes; the user should pull first
  | 'keep_local_only'   // a local-only row, kept on pull
  | 'create_remote'     // a local-only row, created in Airtable on push
  | 'create_local';     // a remote-only record, added as a row on pull

export interface Classification {
  caseId: CaseId;
  action: RowAction;
  conflictKind?: SyncConflictKind;
}

export interface LinkedFacts {
  localChanged: boolean;     // row.rev !== sync.syncedRev
  remoteExists: boolean;
  remoteChanged: boolean;    // hash of current remote values !== sync.remoteHash
  sameValues: boolean;       // normalized local values equal normalized remote values
  decided: boolean;          // stored conflict decision still matches this row and remote
}

/** Facts for a linked row. `remote` is the record found in the fresh list, or null if it was not found. */
export function linkedFacts(
  row: Row,
  remote: AirtableRecord | null,
  fields: readonly FieldDefinition[],
  remoteHash: string | null,
): LinkedFacts {
  const sync = row.sync as RowSync;
  const localChanged = row.rev !== sync.syncedRev;
  const remoteExists = remote !== null;
  const remoteChanged = remoteExists && remoteHash !== sync.remoteHash;
  const sameValues = remoteExists
    && canonicalJson(localValues(fields, row)) === canonicalJson(remoteValues(fields, remote!.fields));
  const c = sync.conflict;
  const decided = !!c && c.localRev === row.rev && c.remoteHash === (remoteExists ? remoteHash : null);
  return { localChanged, remoteExists, remoteChanged, sameValues, decided };
}

/** Classifies one linked row. `op` only changes what a one-sided change does. */
export function classifyLinked(f: LinkedFacts, sync: RowSync | null, op: SyncOp): Classification {
  if (!f.remoteExists) {
    if (f.localChanged) {
      // Remote deleted and the row was edited locally: the user decides, nothing is removed.
      if (f.decided) return { caseId: 'remote_deleted_local_changed', action: 'decided', conflictKind: 'remote_deleted' };
      return { caseId: 'remote_deleted_local_changed', action: 'conflict', conflictKind: 'remote_deleted' };
    }
    if (sync?.remoteDeleted) return { caseId: 'remote_deleted', action: 'none' };
    return { caseId: 'remote_deleted', action: 'mark_remote_deleted' };
  }

  if (!f.localChanged && !f.remoteChanged) return { caseId: 'no_change', action: 'none' };

  if (f.localChanged && !f.remoteChanged) {
    return { caseId: 'local_only', action: op === 'push' ? 'push' : 'keep_local_only' };
  }

  if (!f.localChanged && f.remoteChanged) {
    return { caseId: 'remote_only', action: op === 'pull' ? 'pull' : 'remote_changed' };
  }

  // Both changed.
  if (f.sameValues) return { caseId: 'both_same', action: 'adopt' };
  if (f.decided) return { caseId: 'both_different', action: 'decided', conflictKind: 'both_changed' };
  return { caseId: 'both_different', action: 'conflict', conflictKind: 'both_changed' };
}

/** Facts and classification for a row that has no sync block yet. */
export function classifyLocalOnly(op: SyncOp): Classification {
  return op === 'push'
    ? { caseId: 'new_local', action: 'create_remote' }
    : { caseId: 'new_local', action: 'keep_local_only' };
}

/** Hash used both for the stored remoteHash and for remote change checks. */
export function remoteHashFor(fields: readonly FieldDefinition[], record: AirtableRecord): string {
  return hashValues(remoteValues(fields, record.fields));
}

export type { CellValue };
