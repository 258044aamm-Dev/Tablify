// Conflict resolution (P7-08). The user picks one of the three choices. Nothing is overwritten
// unless the user chose it, and the choice is stored so the same conflict is not asked again.
import type { FieldDefinition, SyncConflictDecision, SyncConflictKind } from '../model/types.js';
import { classifyLinked, linkedFacts, remoteHashFor } from './rules.js';
import { refreshRecordSnapshot, requireLink, type SyncContext } from './engineTypes.js';
import { remoteValues } from './values.js';
import type { AirtableRecord } from './airtableClient.js';

export interface ResolutionResult {
  /** Set for keep_both: the ID of the new row that holds the remote values. */
  createdRowId: string | null;
}

/**
 * Applies the user's decision for one open conflict. It fetches the remote state again and refuses
 * if there is no open conflict, so a stale dialog cannot overwrite newer data.
 */
export async function resolveConflict(
  ctx: SyncContext,
  rowId: string,
  decision: SyncConflictDecision,
): Promise<ResolutionResult> {
  const link = requireLink(ctx.session);
  const fields = ctx.session.getFields() as FieldDefinition[];
  const remote = await ctx.client.listRecords(link.baseId, link.tableId);
  const byId = new Map<string, AirtableRecord>(remote.map((r) => [r.id, r]));

  const row = ctx.session.store.getRow(rowId);
  if (!row || !row.sync) throw new Error('This row is not linked to Airtable.');
  const rec = byId.get(row.sync.airtableId) ?? null;
  const remoteHash = rec ? remoteHashFor(fields, rec) : null;
  const cls = classifyLinked(linkedFacts(row, rec, fields, remoteHash), row.sync, 'pull');
  if (cls.action !== 'conflict' || !cls.conflictKind) {
    throw new Error('There is no open conflict on this row. Sync again to see the current state.');
  }
  const kind: SyncConflictKind = cls.conflictKind;
  if (kind === 'remote_deleted' && decision === 'keep_both') {
    throw new Error('Keep both is not offered when the record was deleted in Airtable.');
  }

  const decidedAt = ctx.now();
  const sync = row.sync;
  let createdRowId: string | null = null;

  if (decision === 'keep_local') {
    if (kind === 'remote_deleted') {
      // The row becomes local-only and is created in Airtable on the next push.
      ctx.session.store.setRowSync(row.id, null);
    } else {
      ctx.session.store.setRowSync(row.id, {
        ...sync,
        remoteHash: remoteHash!,
        conflict: { kind, decision, localRev: row.rev, remoteHash, decidedAt },
      });
    }
  } else if (decision === 'keep_remote') {
    if (kind === 'remote_deleted') {
      // The user chose to remove the row. This is the only path where a row is removed by sync.
      ctx.session.store.deleteRow(row.id);
    } else {
      const updated = ctx.session.store.updateRow(row.id, remoteValues(fields, rec!.fields));
      ctx.session.store.setRowSync(row.id, {
        ...sync,
        syncedRev: updated.rev,
        syncedAt: decidedAt,
        remoteHash: remoteHash!,
        conflict: { kind, decision, localRev: updated.rev, remoteHash, decidedAt },
      });
    }
  } else {
    // keep_both: the copy is a new local row with the remote values. It has no sync block, so the next
    // push creates it in Airtable as a new record. The original keeps the local values and stays linked.
    const copy = ctx.session.store.createRow(remoteValues(fields, rec!.fields));
    createdRowId = copy.id;
    ctx.session.store.setRowSync(row.id, {
      ...sync,
      remoteHash: remoteHash!,
      conflict: { kind, decision, localRev: row.rev, remoteHash, decidedAt },
    });
  }

  ctx.session.stack.clear();
  refreshRecordSnapshot(ctx.session);
  return { createdRowId };
}
