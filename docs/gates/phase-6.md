# Phase 6 Gate Check (Hardening and release)

**Date:** 2026-10-09
**Result:** ⚠️ **CONDITIONAL — all sandbox-runnable checks PASS; device, screen-reader, official-performance, and fresh-user doc checks are NOT RUN with owner checklists (P2–P5 pattern, owner-confirmed split for P6)**
**Commits (this phase):** P6-01 `25c524f` · P6-03 `fdd35af` · P6-04 `1b90b6d` · P6-05 `5499f51` · P6-02 `d81fcc5` · P6-06 = this commit
**Tester:** Tablify Agent (Arena.ai)
**Reason for this note:** Same conditional handling as P2–P5 gates. The owner confirmed the sandbox/owner split for P6 on 2026-10-09 (T-DEV decision in the phase-6 plan).

---

## Gate conditions

| # | Condition | Status | Notes |
|---|-----------|--------|-------|
| 1 | P6-01…P6-06 have accepted evidence | ⚠️ PARTIAL | Evidence files exist for all six steps (`docs/evidence/P6-0*.md`); all six Linear issues are **In Review** pending owner checklist items — consistent with the P4/P5 conditional pattern |
| 2 | `npm run lint`, `npm test`, `npm run build` pass | ✅ PASS | At the P6-06 commit: lint 0 errors (82 pre-existing style warnings), **567/567 tests** (48 files), tabula guard PASS, **docs link check PASS** (60 files), build OK |
| 3 | Regression: P0–P5 tests still pass | ✅ PASS | Included in the 567 (558 pre-existing + 9 new in P6-03) |
| 4 | No open S1 or S2 issues | ✅ PASS | No `docs/issues/` entries; P6-03 findings are ≤ S3 (F-1 S3 + three S4) awaiting owner sign-off per acceptance rule |
| 5 | Assumption and limitation register reviewed | ⚠️ SEE REGISTER | Below; each NOT RUN item has a scripted checklist |
| 6 | Gate note recorded | ✅ PASS | This file |

## Step summary

| Step | Deliverable | Status |
|---|---|---|
| P6-01 test matrix | `docs/testing/matrix.md` (55 cells, no empty cells) + T-M-DEV-P6-A1…A11 scripts + deterministic fixtures (CSV-500/XLSX-500/decoy/broken/view) | Sandbox complete; device cells NOT RUN (owner) |
| P6-02 performance | `docs/performance/report-2026-10-09.md` — PERF-1/2/3/5/6/7/8 pass in sandbox with ≥ 6× headroom; PERF-4 informational (jsdom) | Sandbox complete; official numbers NOT RUN (owner runbook `scripts/bench-device.mjs`) |
| P6-03 accessibility | `docs/accessibility/audit.md` — 30-action keyboard run-through, ARIA grid semantics (owner-approved Option A, attribute-only), axe 0 violations, focus measured (light 2.96:1 finding F-2) | Sandbox complete; NVDA/VoiceOver NOT RUN (owner) |
| P6-04 review checklist | `docs/review-checklist.md` — live guidelines (dated 2026-10-09) audited item-by-item; sample command removed | Complete; second-person review = owner |
| P6-05 documentation | `README.md`, `docs/user-guide.md`, `CHANGELOG.md`, link-check wired into `npm run check`; grep: README states `.tabula` NOT supported | Complete; fresh-user A1+A2 test NOT RUN (owner) |
| P6-06 release | MIT `LICENSE` + decision doc; version 1.0.0 in manifest/package/versions; rollback plan; clean build + SHA-256 + GitHub release `v1.0.0` | This commit; release created from the tag |

## Assumption and limitation register (per `spec/phases/P6.md`)

| Item | Status | Consequence |
|---|---|---|
| Performance results apply only to recorded hardware (G-A4) | ACCEPTED | Sandbox numbers labelled approximations; official claims only after owner runs |
| Screen readers: NVDA (Windows) + VoiceOver (macOS) only, when owner completes the checklist | NOT YET TESTED | No screen-reader support is claimed until then; mobile screen readers not claimed |
| Target platforms = Windows, macOS, Linux, iOS, Android (P6-01 matrix); others not claimed | ACCEPTED | Matrix cells NOT RUN until owner runs the scripted cases |
| Earlier gates (P2-3, P4, P5) remain CONDITIONAL | ACCEPTED | Owner acceptance of NOT RUN items in those gates still owed; no S1/S2 open anywhere |

## Owner actions to close the gate

1. Run T-M-DEV-P6-A1…A11 on the five platforms; fill `docs/testing/matrix.md`.
2. Run the NVDA/VoiceOver checklist (`docs/accessibility/audit.md` §2); sign off findings F-1…F-4.
3. Run `scripts/bench-device.mjs` runbook; append official rows to the performance report.
4. Fresh-user doc test (README → A1 + A2, time + questions).
5. Second-person review of `docs/review-checklist.md`.
6. Clean-vault install of the release assets on desktop + mobile; run A1 + A9; record in `docs/evidence/P6-06.md`.
7. Revoke the temporary GitHub credential used for this release.

## Decision

Phase 6 is accepted **conditionally**. The release is published per the owner's explicit instruction (REL decision: full public release at P6-06) with all sandbox checks green and every remaining check converted into a scripted owner checklist. The gate closes to PASS when the owner accepts/runs the items above; the six P6 issues stay **In Review** until then.
