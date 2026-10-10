// Push (P7-07): file -> Airtable. Sends only rows that changed since the last sync. Writes go out in
// batches of AIRTABLE_WRITE_BATCH. If a batch fails, its rows are retried one at a time, so one bad
// row does not hide the others and the report names exactly the rows that failed.
import type { FieldDefinition, Row } from '../model/types.js';
import { AIRTABLE_WRITE_BATCH, AirtableError, type AirtableRecord } from './airtableClient.js';
import { classifyLinked, linkedFacts, remoteHashFor } from './rules.js';
import { emptyReport, finishRun, requireLink, safeReason, summarize, type RowFailure, type SyncContext, type SyncReport } from './engineTypes.js';
import { nextSync, conflictItem } from './pull.js';
import { remoteValues, hashValues, writePayload } from './values.js';

interface WriteItem {
  row: Row;
  sentRev: number;
  airtableId: string | null;   // null for a create
  payload: Record<string, unknown>;
}

export async function pushToAirtable(ctx: SyncContext): Promise<SyncReport> {
  const link = requireLink(ctx.session);
  const fields = ctx.session.getFields() as FieldDefinition[];
  const report = emptyReport('push');

  // 1. Fetch the remote state. Used for remote-change detection. Throws before any write.
  const remote = await ctx.client.listRecords(link.baseId, link.tableId);
  const byId = new Map<string, AirtableRecord>(remote.map((r) => [r.id, r]));

  // 2. Plan. writePayload may throw on a corrupt option; that is still before any write.
  const creates: WriteItem[] = [];
  const updates: WriteItem[] = [];
  // Sync-block-only changes: no network call. 'flag' marks a deleted record; 'adopt' records equal hashes.
  const localOnly: Array<{ row: Row; kind: 'flag' } | { row: Row; kind: 'adopt'; remoteHash: string }> = [];
  const linkedIds = new Set<string>();
  for (const row of ctx.session.store.getAllRows()) {
    if (!row.sync) {
      creates.push({ row, sentRev: row.rev, airtableId: null, payload: writePayload(fields, row) });
      continue;
    }
    linkedIds.add(row.sync.airtableId);
    const rec = byId.get(row.sync.airtableId) ?? null;
    const remoteHash = rec ? remoteHashFor(fields, rec) : null;
    const cls = classifyLinked(linkedFacts(row, rec, fields, remoteHash), row.sync, 'push');
    switch (cls.action) {
      case 'push':
        updates.push({ row, sentRev: row.rev, airtableId: row.sync.airtableId, payload: writePayload(fields, row) });
        break;
      case 'adopt':
        localOnly.push({ row, kind: 'adopt', remoteHash: remoteHash! });
        break;
      case 'mark_remote_deleted':
        localOnly.push({ row, kind: 'flag' });
        break;
      case 'conflict':
        report.conflicts.push(conflictItem(row, cls.conflictKind!, remoteHash));
        break;
      case 'remote_changed':
        report.remoteChangedNotPushed++;
        break;
      case 'none':
      case 'decided':
        if (row.sync.remoteDeleted) report.remoteDeleted++;
        else report.unchanged++;
        break;
      default:
        throw new Error(`Unexpected action on push: ${cls.action}`);
    }
  }
  for (const rec of link.records) {
    if (!linkedIds.has(rec.airtableId) && byId.has(rec.airtableId)) report.localDeletedKept++;
  }

  // 3. Network writes. Records that succeed are returned in request order.
  const results: Array<{ row: Row; sentRev: number; record: AirtableRecord }> = [];
  const failures: RowFailure[] = [];
  const sendChunk = async (items: WriteItem[], isCreate: boolean): Promise<void> => {
    try {
      const recs = isCreate
        ? await ctx.client.createRecords(link.baseId, link.tableId, items.map((i) => ({ fields: i.payload })))
        : await ctx.client.updateRecords(link.baseId, link.tableId, items.map((i) => ({ id: i.airtableId!, fields: i.payload })));
      if (recs.length !== items.length) throw new AirtableError('bad_response', null, 1, 'Airtable returned an unexpected number of records.');
      items.forEach((item, idx) => results.push({ row: item.row, sentRev: item.sentRev, record: recs[idx] }));
    } catch {
      // Retry each row alone so one bad row does not hide the others.
      for (const item of items) {
        try {
          const [rec] = isCreate
            ? await ctx.client.createRecords(link.baseId, link.tableId, [{ fields: item.payload }])
            : await ctx.client.updateRecords(link.baseId, link.tableId, [{ id: item.airtableId!, fields: item.payload }]);
          if (!rec) throw new AirtableError('bad_response', null, 1, 'Airtable returned no record.');
          results.push({ row: item.row, sentRev: item.sentRev, record: rec });
        } catch (rowErr) {
          failures.push({ rowId: item.row.id, reason: safeReason(rowErr) });
        }
      }
    }
  };
  for (let i = 0; i < creates.length; i += AIRTABLE_WRITE_BATCH) await sendChunk(creates.slice(i, i + AIRTABLE_WRITE_BATCH), true);
  for (let i = 0; i < updates.length; i += AIRTABLE_WRITE_BATCH) await sendChunk(updates.slice(i, i + AIRTABLE_WRITE_BATCH), false);

  // 4. Apply. Sync blocks only; cell values are not changed by a push.
  const syncedAt = ctx.now();
  for (const r of results) {
    const remoteHash = hashValues(remoteValues(fields, r.record.fields));
    const current = ctx.session.store.getRow(r.row.id);
    if (!current) {
      failures.push({ rowId: r.row.id, reason: 'The row was removed during the push.' });
      continue;
    }
    const base = current.sync ?? { airtableId: r.record.id, syncedRev: 0, syncedAt, remoteHash };
    ctx.session.store.setRowSync(
      r.row.id,
      nextSync(
        { ...base, airtableId: r.record.id },
        { airtableId: r.record.id, syncedRev: r.sentRev, syncedAt, remoteHash, remoteDeleted: false },
      ),
    );
    if (current.sync) report.updated++; else report.created++;
    report.pushed++;
  }
  for (const item of localOnly) {
    const current = ctx.session.store.getRow(item.row.id);
    if (!current?.sync) continue;
    if (item.kind === 'flag') {
      ctx.session.store.setRowSync(item.row.id, nextSync(current.sync, { remoteDeleted: true }));
      report.remoteDeleted++;
    } else {
      // Same values on both sides: record the new hash. Nothing is sent.
      ctx.session.store.setRowSync(item.row.id, nextSync(current.sync, { remoteHash: item.remoteHash, syncedRev: current.rev, syncedAt }));
      report.adopted++;
    }
  }

  report.failures = failures;
  report.ok = failures.length === 0 && report.conflicts.length === 0;
  report.summary = summarize(report);
  finishRun(ctx, report, 'push');
  return report;
}

