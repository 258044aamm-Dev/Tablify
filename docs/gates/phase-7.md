# Phase 7 Gate Check (Embeds and Airtable sync, v1.1)

**Date:** 2026-10-10
**Result:** ⚠️ **CONDITIONAL.** All sandbox-runnable checks pass. Live Airtable tests, Obsidian runtime checks, and owner visual checks are NOT RUN. The owner has not supplied a test base or token.
**Commits:** P7-01 `5872950` · P7-05 `347d8fe` · P7-06..09 `0db3df5` · P7-01 bundle cap `c744390` · build `5ee7016` · P7-10 = this commit
**Tester:** Tablify Agent (Arena.ai)

---

## Gate conditions

| # | Condition | Status | Notes |
|---|-----------|--------|-------|
| 1 | P7-01 … P7-10 have evidence files | ⚠️ PARTIAL | `docs/evidence/P7-01.md`, `P7-02`, `P7-03`, `P7-04`, `P7-05`, `P7-06-P7-09`, `P7-10`. The P7-06 to P7-09 file covers four steps. |
| 2 | `npm run check` passes | ✅ PASS | Lint 0 errors (warnings rose from 81 to 119 with the new sync files). 951 tests in 70 files pass. Bundle budget passes (0.53 MB dev). Guard PASS. Link check PASS (74 files). Build OK. |
| 3 | Regression: P0–P6 tests still pass | ✅ PASS | Included in the 951. The one existing test that failed (bundle cap) was resolved by an owner decision (`c744390`). |
| 4 | Security review of token handling | ✅ PASS (see below) | Token is read only from plugin settings. It goes only to the client's auth header. Errors are redacted. Nothing is logged or written to `.tablify` files. |
| 5 | No open S1 or S2 issues | ✅ PASS | No S1 or S2 issues recorded. Open items are in the register below. |
| 6 | Live Airtable tests (T-I, T-E) | ❌ NOT RUN | Needs a test base and token from the owner. Each evidence file lists its live items. |
| 7 | Obsidian runtime and visual checks | ❌ NOT RUN | Embed, sync modal, mobile, and visual parity against `Prototype/`. |
| 8 | Gate note recorded | ✅ PASS | This file. |

## Step status

| Step | Linear | Status |
|---|---|---|
| P7-01 embed code block | SAD-50 | Built and tested. Obsidian checks NOT RUN. |
| P7-02 Airtable client | SAD-51 | Built and tested against the fake server. Live timing and 429 NOT RUN. |
| P7-03 token storage | SAD-52 | Built and tested. Masked-input visual check NOT RUN. |
| P7-04 sync metadata in file | SAD-53 | Built and tested. Obsidian T-I NOT RUN. |
| P7-05 field mapping | SAD-54 | Built and tested. Live schema mapping NOT RUN. |
| P7-06 pull | SAD-55 | Engine built and tested. Live T-I NOT RUN. |
| P7-07 push | SAD-56 | Engine built and tested. Live T-I NOT RUN. Retry-on-create risk open. |
| P7-08 conflicts | SAD-57 | Engine and dialog built and tested. Live T-I per case NOT RUN. |
| P7-09 create fields | SAD-58 | Engine and confirmation built and tested. Live T-I NOT RUN. README scope list added. |
| P7-10 sync UI | SAD-59 | Built and tested in jsdom. Obsidian and visual checks NOT RUN. |

## Security review (token handling)

Scope: token from entry to network, to display, and to disk.

- **Storage.** Plugin settings only (`src/settings.ts`). `serialize` writes only the `.tablify` file and its keys, so the token is never in a `.tablify` file, an export, or an embed. P7-03 tests cover this.
- **Transport.** `AirtableClient` sends the token only in the `Authorization` header, to the Airtable origin only. Invalid tokens are rejected before any call (`src/sync/airtableClient.ts`).
- **Display.** Settings uses a masked input. The sync modal shows only "stored" or "not stored" (`SyncModal.ts`).
- **Errors.** Airtable errors use fixed messages. Other messages pass through `redactSecrets` with the token before display (`SyncModal.fail`).
- **Logs.** No `console` calls in sync code. The only `Notice` in `main.ts` has no token.
- **Git.** The P7 push used the token through a command-line credential helper (`git -c credential.helper=…`) with `GH_TOKEN_P7` set for the command only. `git config -l` and `git remote -v` were checked for the token before and after the push, and the count was 0 both times.
- **Open risk.** The GitHub token is still in plain text in the Linear project description, as the owner chose. The recommendation to rotate it after P7 stands. The token also appeared in this session's transcript, so rotation is advised.

## Assumption and limitation register

| ID | Item | Impact | Next step |
|---|---|---|---|
| R-1 | Retry on 5xx for POST can duplicate a created record if Airtable applied the create and the response was lost | Possible duplicate rows in Airtable | Live check. Consider a no-retry rule for creates. |
| R-2 | Keep both creates a duplicate in Airtable on the next push | Intended by design, documented | Owner review of the choice |
| R-3 | Local deletions are reported, never sent to Airtable | Remote records stay | Owner decision on deletion support (v1.2) |
| R-4 | Two embeds or an embed and the full view keep separate sessions; last write wins | Possible lost edits | Owner decision (P7-01 note) |
| R-5 | Auto-create field options (`precision`, `max`, `dateFormat`) are assumptions | A live create might be refused | Live T-I |
| R-6 | Lint warnings from new files | None functional | Clean up non-null assertions in a later pass |
| R-7 | Live timing (2,500-record pull), real 429 behavior, network-off during push | Unknown until run | Owner runbook |

## Decisions recorded this phase

- Bundle cap raised from 1,850,000 to 1,900,000 bytes after the P7-01 embed commit (owner, 2026-10-10).
- Dev sourcemap moved from inline to an external `main.js.map` (git-ignored). The committed `main.js` is 0.53 MB, down from 2.02 MB. The inline map was about 1.5 MB of the bundle. The minified production build is 0.30 MB (owner, 2026-10-10).
- P7-01 and P7-10 follow the prototype's sync modal layout, with the token input replaced by a stored-or-not status (owner decision §11.2).
- Hash-based remote change detection in each row's `sync` block (owner decision §11.2).
- Live tests stay NOT RUN until the owner supplies a base and token (owner decision).

## Verdict

Phase 7 is **conditionally complete**. The sandbox can run no more of the spec. The owner should run the live and Obsidian checklists listed in each evidence file. Each run is recorded in that step's evidence file and in its Linear issue. Then the phase gate can move from CONDITIONAL to PASS.
