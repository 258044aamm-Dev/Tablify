// Pull (P7-06): Airtable -> file. Fetches every record first. Nothing is written until the whole
// fetch and the whole plan have succeeded, so a network failure leaves the session unchanged.
import type { CellValue, FieldDefinition, Row, RowSync } from '../model/types.js';
import type { AirtableRecord } from './airtableClient.js';
import { classifyLinked, linkedFacts, remoteHashFor } from './rules.js';
import { emptyReport, finishRun, requireLink, summarize, type SyncContext, type SyncReport, type ConflictItem } from './engineTypes.js';
import { remoteValues } from './values.js';

type PlannedWrite =
  | { kind: 'update'; row: Row; values: Record<string, CellValue>; remoteHash: string }
  | { kind: 'sync'; row: Row; remoteHash: string; remoteDeleted: boolean }
  | { kind: 'create'; values: Record<string, CellValue>; airtableId: string; remoteHash: string };

export async function pullFromAirtable(ctx: SyncContext): Promise<SyncReport> {
  const link = requireLink(ctx.session);
  const fields = ctx.session.getFields() as FieldDefinition[];

  // 1. Fetch. Throws on network or API failure, before any write.
  const remote = await ctx.client.listRecords(link.baseId, link.tableId);
  const byId = new Map<string, AirtableRecord>(remote.map((r) => [r.id, r]));
  const report = emptyReport('pull');

  // 2. Plan. May throw on an unknown Airtable option, still before any write.
  const plan: PlannedWrite[] = [];
  const rows = ctx.session.store.getAllRows();
  const linkedIds = new Set<string>();
  for (const row of rows) {
    if (!row.sync) {
      report.localOnly++;
      continue;
    }
    linkedIds.add(row.sync.airtableId);
    const rec = byId.get(row.sync.airtableId) ?? null;
    const remoteHash = rec ? remoteHashFor(fields, rec) : null;
    const facts = linkedFacts(row, rec, fields, remoteHash);
    const cls = classifyLinked(facts, row.sync, 'pull');

    switch (cls.action) {
      case 'pull': {
        const values = remoteValues(fields, rec!.fields);
        plan.push({ kind: 'update', row, values, remoteHash: remoteHash! });
        report.updated++;
        break;
      }
      case 'adopt':
        plan.push({ kind: 'sync', row, remoteHash: remoteHash!, remoteDeleted: false });
        report.adopted++;
        break;
      case 'mark_remote_deleted':
        plan.push({ kind: 'sync', row, remoteHash: row.sync.remoteHash, remoteDeleted: true });
        report.remoteDeleted++;
        break;
      case 'none':
        if (row.sync.remoteDeleted) report.remoteDeleted++;
        else report.unchanged++;
        break;
      case 'keep_local_only':
        report.localOnly++;
        break;
      case 'conflict':
        report.conflicts.push(conflictItem(row, cls.conflictKind!, remoteHash));
        break;
      case 'decided':
        report.unchanged++;
        break;
      default:
        // push-only actions cannot come from a pull classification
        throw new Error(`Unexpected action on pull: ${cls.action}`);
    }
  }

  // Remote-new records: rows that do not exist yet.
  for (const rec of remote) {
    if (linkedIds.has(rec.id)) continue;
    plan.push({
      kind: 'create',
      values: remoteValues(fields, rec.fields),
      airtableId: rec.id,
      remoteHash: remoteHashFor(fields, rec),
    });
    report.created++;
  }

  // Locally deleted rows whose record still exists remotely. Reported only. Never deleted remotely.
  const localSnapshot = requireLink(ctx.session).records;
  for (const rec of localSnapshot) {
    if (!linkedIds.has(rec.airtableId) && byId.has(rec.airtableId)) report.localDeletedKept++;
  }

  // 3. Apply. Nothing below can fail for remote reasons.
  const syncedAt = ctx.now();
  for (const w of plan) {
    if (w.kind === 'create') {
      const created = ctx.session.store.createRow(w.values);
      ctx.session.store.setRowSync(created.id, {
        airtableId: w.airtableId,
        syncedRev: created.rev,
        syncedAt,
        remoteHash: w.remoteHash,
      });
    } else if (w.kind === 'update') {
      const updated = ctx.session.store.updateRow(w.row.id, w.values);
      ctx.session.store.setRowSync(w.row.id, nextSync(w.row.sync!, {
        syncedRev: updated.rev,
        syncedAt,
        remoteHash: w.remoteHash,
        remoteDeleted: false,
      }));
    } else {
      const current = ctx.session.store.getRow(w.row.id)!;
      ctx.session.store.setRowSync(w.row.id, nextSync(current.sync!, {
        syncedRev: current.rev,
        syncedAt,
        remoteHash: w.remoteHash,
        remoteDeleted: w.remoteDeleted,
      }));
    }
  }

  report.ok = report.conflicts.length === 0;
  report.summary = summarize(report);
  finishRun(ctx, report, 'pull');
  return report;
}

/** Keeps `conflict` (a stored decision) and any other unchanged fields when the sync block is rewritten. */
export function nextSync(current: RowSync, patch: Partial<RowSync>): RowSync {
  const next: RowSync = { ...current, ...patch };
  if (patch.remoteDeleted === false) delete next.remoteDeleted;
  return next;
}

export function conflictItem(row: Row, kind: ConflictItem['kind'], remoteHash: string | null): ConflictItem {
  return { rowId: row.id, airtableId: row.sync?.airtableId ?? null, kind, remoteHash };
}
