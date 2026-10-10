// Shared types for the sync engine (P7-06..P7-09). The engine works on an in-memory session and
// never writes the file itself. The view saves once a run finishes.
import { AirtableError, type AirtableClient, type AirtableFieldSchema, type AirtableRecord } from './airtableClient.js';
import type { TableSession } from '../model/tableSession.js';
import type { SyncConflictKind, SyncLink, SyncRecordState, SyncRunStatus } from '../model/types.js';

/** The part of the Airtable client the engine uses. Tests pass a client over the fake server. */
export type RemoteApi = Pick<AirtableClient, 'listRecords' | 'createRecords' | 'updateRecords' | 'createField'>;

export interface SyncContext {
  client: RemoteApi;
  session: TableSession;
  now: () => string;
}

export interface ConflictItem {
  rowId: string;
  airtableId: string | null;
  kind: SyncConflictKind;
  /** Remote hash seen by this run. A resolution is refused if the remote changed since. */
  remoteHash: string | null;
}

export interface RowFailure {
  rowId: string;
  reason: string;
}

export interface SyncReport {
  direction: 'pull' | 'push';
  created: number;
  updated: number;
  pushed: number;
  adopted: number;
  unchanged: number;
  localOnly: number;
  remoteDeleted: number;
  localDeletedKept: number;
  remoteChangedNotPushed: number;
  conflicts: ConflictItem[];
  failures: RowFailure[];
  ok: boolean;
  summary: string;
}

export function emptyReport(direction: 'pull' | 'push'): SyncReport {
  return {
    direction,
    created: 0,
    updated: 0,
    pushed: 0,
    adopted: 0,
    unchanged: 0,
    localOnly: 0,
    remoteDeleted: 0,
    localDeletedKept: 0,
    remoteChangedNotPushed: 0,
    conflicts: [],
    failures: [],
    ok: true,
    summary: '',
  };
}

/** A short, token-free line for the status display and for SyncRunStatus.summary. */
export function summarize(report: SyncReport): string {
  const parts: string[] = [];
  if (report.direction === 'pull') {
    parts.push(`${report.created} new`, `${report.updated} updated`);
  } else {
    parts.push(`${report.pushed} pushed`, `${report.created} created`);
  }
  if (report.conflicts.length) parts.push(`${report.conflicts.length} conflict(s)`);
  if (report.failures.length) parts.push(`${report.failures.length} failed`);
  if (report.remoteDeleted) parts.push(`${report.remoteDeleted} deleted in Airtable`);
  if (report.localDeletedKept) parts.push(`${report.localDeletedKept} deleted locally, kept in Airtable`);
  return parts.join(', ').slice(0, 300);
}

export function requireLink(session: TableSession): SyncLink {
  const link = session.getSyncLink();
  if (!link) throw new Error('This table is not linked to Airtable.');
  return link;
}

/** Rebuilds the list of linked records (used to detect local deletions, P7-06). */
export function refreshRecordSnapshot(session: TableSession): void {
  const link = requireLink(session);
  const records: SyncRecordState[] = [];
  for (const row of session.store.getAllRows()) {
    if (row.sync) records.push({ airtableId: row.sync.airtableId, remoteHash: row.sync.remoteHash });
  }
  session.setSyncLink({ ...link, records });
}

/** Writes the run result into the link. Called after every pull and push. */
export function finishRun(
  ctx: SyncContext,
  report: SyncReport,
  direction: SyncRunStatus['direction'],
): void {
  // Sync blocks changed, so the undo history no longer matches the file. Clear it (see docs/sync-rules.md).
  ctx.session.stack.clear();
  refreshRecordSnapshot(ctx.session);
  const link = requireLink(ctx.session);
  ctx.session.setSyncLink({
    ...link,
    lastSync: { at: ctx.now(), direction, ok: report.ok, summary: report.summary },
  });
}

/** A reason string that is safe to show. Airtable errors carry fixed, token-free messages. */
export function safeReason(err: unknown): string {
  if (err instanceof AirtableError) return err.message;
  return 'Airtable did not accept this change.';
}

export type { AirtableRecord, AirtableFieldSchema };
