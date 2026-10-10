# Sync rules (P7-06 to P7-08)

This document is the decision table for Airtable sync. The code is `src/sync/rules.ts`, and
`tests/sync/rules.test.ts` checks each case. Keep the three in step.

## Terms

- **Local changed**: `row.rev !== sync.syncedRev`. Any cell edit bumps `rev`.
- **Remote changed**: the hash of the normalized remote values differs from `sync.remoteHash`. The hash is SHA-256 over canonical JSON of the synced fields (`src/sync/hash.ts`).
- **Same values**: the normalized local values equal the normalized remote values.
- **Decided**: a stored conflict decision still matches this row's `localRev` and the current remote hash. A decision is not asked again until either side changes.

## Decision table

| # | Case | Pull | Push |
|---|------|------|------|
| 1 | No change on either side | Nothing | Nothing |
| 2 | Local only | Keep the local value (not overwritten) | Send the row (one batched request) |
| 3 | Remote only | Write the remote value into the row | Report "pull first"; nothing is sent |
| 4 | Both changed, different values | **Conflict.** Nothing is written. The user chooses keep local, keep remote, or keep both | **Conflict.** Nothing is sent |
| 5 | Both changed, same value | Adopt: record the new hashes, write no values | Adopt: same |
| 6 | Remote deleted, local unchanged | Flag the row `remoteDeleted`. The row is kept | Same flag. Nothing is sent |
| 6b | Remote deleted, local changed | **Conflict.** Keep local (row becomes local-only and is created on the next push), or keep remote (the row is removed; the only path where sync removes a row) | Same conflict |
| 7 | Local deleted (the row is gone but its record exists in Airtable) | Reported. The Airtable record is never deleted by sync | Reported. Not deleted remotely |
| — | New remote record | Added as a new row with a sync block | n/a |
| — | New local row (no sync block) | Kept | Created in Airtable; the row is linked from the response |

## Conflict choices (P7-08)

- **Keep local.** The row keeps its values and stays changed. The remote hash is acknowledged, so the next push sends the local values.
- **Keep remote.** The remote values are written into the row. The row is marked synced.
- **Keep both.** The original row keeps local values and stays linked. A new local row gets the remote values. It has no sync block, so the next push creates it in Airtable as a new record. This means the Airtable base can gain a duplicate with the remote values.

Each choice is stored in `sync.conflict` with `localRev` and `remoteHash`. A resolution is refused if there is no open conflict, which protects a stale dialog from overwriting newer data. The remote is re-read before a resolution is applied.

## Other rules

- **Atomic pull.** Every record is fetched before any write. An unknown Airtable select option aborts the pull with a clear message, before any write.
- **Batching.** Writes go out in batches of 10 (`AIRTABLE_WRITE_BATCH`). If a batch fails, each of its rows is retried alone. A row that still fails stays changed and is listed in the report with a token-free reason.
- **Undo.** Pull, push, and conflict resolution all clear the undo stack, because they change sync blocks that undo would not restore.
- **Auto-create (P7-09).** Fields are created only after the user confirms the exact list. Creation is refused if remote records changed since the last sync, because the hash would otherwise hide that change. A missing scope stops the first request, so nothing is created.
- **Read-only fields** (formula, lookup, rollup, created or modified time, auto number, attachment names, unsupported types) are pulled as display values. They are never pushed.
