# Phase 8 Gate Check (Formulas and linked records, v2)

**Date:** 2026-10-10
**Result:** ⚠️ **CONDITIONAL.** Every check the sandbox can run passes. Obsidian runtime checks, the visual check of the new UI, and the owner's acceptance of P8-02 to P8-04 are NOT RUN or not recorded. The prerequisite (1.1 released, P7 gate passed) was waived by the owner, and the P7 gate is itself CONDITIONAL.
**Commits:** P8-01 `857a7d0` · P8-02 `5725256` · P8-03 `18388f3` (build `6533ce4`) · P8-04 `b3ef895` (build `1d2dba6`) · close-out `e8d05bc` (build `78933b8`) · user guide and gate note: see git log
**Tester:** Tablify Agent (Arena.ai)

---

## Gate conditions

| # | Condition | Status | Notes |
|---|-----------|--------|-------|
| 1 | P8-01 … P8-04 have evidence files | ✅ PASS | `docs/evidence/P8-01.md` (added in this close-out), `P8-02`, `P8-03`, `P8-04` |
| 2 | P8-01 … P8-04 accepted | ⚠️ PARTIAL | P8-01: **spec approved by the owner** on 2026-10-10 ("Proceed and execute"). P8-02, P8-03 and P8-04: built and verified in the sandbox. Owner acceptance of these three is not recorded. Linear SAD-61, SAD-62 and SAD-63 are marked Done, so the owner should confirm them |
| 3 | `npm run check` passes at HEAD | ✅ PASS | Exit 0. 79 test files, 1,227 tests pass. Lint 0 errors, 119 warnings (the post-P7 baseline). Guard PASS. Docs links PASS (82 files). Build OK |
| 4 | `npm run check` passes at each P8 feature commit | ✅ PASS | Run in separate worktrees on `857a7d0`, `5725256`, `18388f3` and `b3ef895`. All exit 0. Build and close-out commits were checked at HEAD only |
| 5 | Regression: P0–P6 tests still pass | ✅ PASS | Included in the 1,227. Test changes are limited to the approved set (see Decisions) |
| 6 | Format v2 | ✅ PASS | v1 files stay v1. Writers use v2 only with a formula or link field. Readers accept 1 and 2 and refuse 3. Unknown keys preserved. `formula-link.tablify` and `customers.tablify` are valid |
| 7 | Step verification (spec) | ✅ PASS | T-E: formula updates on edit, cycle shows `#CYCLE!`, formula cell read-only. T-M: incremental equals full on 500 random edits. T-U: 204 golden cases. T-F: 10,000 fuzz formulas, no exception. T-I: rename target keeps link; delete target row shows marker and keeps the source value; integrity output equals the exact expected set |
| 8 | No open S1 or S2 issues | ✅ PASS (owner to confirm) | None recorded. Open items are in the register below. None is a data-loss or crash defect |
| 9 | Performance (proposed targets) | ✅ PASS (targets still proposed) | Integrity check, 1,000 links: median 0.26 ms, bound 1,000 ms. Formula edit on FX-M (1,000 rows, 5 formula columns): p95 0.034 ms, bound 200 ms. Owner has not yet confirmed G-P1 |
| 10 | Security: token and sync | ✅ PASS | No token handling changed. Formula and link fields are never written to Airtable, even if a link exists (`isWritable` guard, tested). Git config checked for token strings before each push: 0 hits |
| 11 | Obsidian runtime and visual checks | ❌ NOT RUN | Link picker, chips, broken-link marker, integrity modal, formula column and error tooltip, mobile layout. Jsdom tests only |
| 12 | Live Airtable checks | ➖ N/A | Formula and link fields are not synced, so there is nothing live to test for them |
| 13 | Documentation | ✅ PASS | `FORMAT_SPEC.md` §12 (v2). `docs/formula-spec.md` (approved). README section on formula and link fields and the update warning. User guide §18. This gate note |

## Step status

| Step | Linear | Status |
|---|---|---|
| P8-01 formula specification | SAD-60 | Done. Spec approved 2026-10-10. Per-case review covered by that approval, not a separate sign-off |
| P8-02 formula engine | SAD-61 | Done. 54 functions, 204 golden cases pass in UTC and `Asia/Dhaka` |
| P8-03 formula field UI | SAD-62 | Done. Read-only formula cells, error tooltip, Edit formula, undo through the command path |
| P8-04 linked records | SAD-63 | Done. Row picker, chips, broken-link marker, integrity command. Pure model at `src/model/link.ts` |
| Phase parent | SAD-13 | Kept in Backlog until the gate reaches PASS. Description updated: D-O1 is decided, and the 1.1 prerequisite was waived by the owner |

## Plan verification (`/home/user/plans/P8-implementation-plan.md` §0, §7)

| Plan item | Result |
|---|---|
| D-O1: Airtable-like function set | ✅ 54 functions in `src/formula/functions.ts`, matching `docs/formula-spec.md` §10. Asserted by `tests/formula/golden.test.ts` |
| Prerequisite waived (1.1, P7 gate) | ✅ Recorded here. P7 gate is still CONDITIONAL and v1.1 is not tagged |
| Link UI: picker, chips, broken marker, integrity command | ✅ All four built. Chips were missing before this close-out and are now added |
| Format v2 only when a formula or link field exists | ✅ Tested |
| Approved test changes (two v2-rejection tests, 19-type count) | ✅ Applied. Two further edits to existing tests, both non-weakening (see Decisions) |
| Dates use local time | ✅ `docs/formula-spec.md` §10.4. Golden cases run in `Asia/Dhaka` |
| P8-01 "started, pending owner review" (§0) | ✅ Superseded: owner approved the spec |
| §7 status "P8-04 and gate not started" | ✅ Superseded: P8-04 done, gate written here |
| §5 risk 2: users must update before opening v2 files | ✅ Stated in README and user guide. Release notes do not exist yet (see R-9) |
| §5 risk 6: warnings must not rise above the baseline | ✅ 119 = baseline. During P8-02 they rose to 212. Fixed in this close-out |
| §5 risk 7: sync must skip the new types | ✅ Tested in `tests/sync/p8Fields.test.ts` |

## Decisions recorded this phase

- **D-O1:** Airtable-like function set (54 functions), not the smaller default. Owner, 2026-10-10.
- **Prerequisite:** 1.1 release and P7 gate waived. Owner chose "start anyway".
- **Link UI:** row picker, link chips, broken-link marker, integrity command. Owner decision, §0.
- **Format:** `formatVersion` 2, written only when a formula or link field exists. Owner decision, §0.
- **Approved test changes:** `tests/format/format.test.ts` and `tests/schema.test.ts` now expect v2 accepted and v3 rejected. `tests/model/fieldTypes.test.ts` counts 21 types.
- **Other edits to existing tests (not in the approved list, reviewed):** (a) `tests/__mocks__/obsidian.ts` now splits class strings on spaces, as Obsidian does. This only widens what the mock accepts. (b) `tests/views/addFieldModal.test.ts`: the add-field callback in one test takes the new formula argument. No assertion changed. `tests/ui/fonts.test.ts` and the bundle cap were not touched.
- **Dates:** viewer's local time zone. Owner decision, recorded in `docs/formula-spec.md`.
- **Spec approval:** owner, 2026-10-10 ("Proceed and execute"), with the §12 review decisions accepted as proposed.
- **Format section number:** the v2 section was numbered §8, which duplicated the v1 enforcement section. It is now §12. Code, schema and evidence references were updated. This changes numbering only.
- **Model path:** the spec names `src/model/link.ts`. The pure model was moved there from `src/links/`. The Obsidian adapter stays in `src/links/`.

## Assumption and limitation register

| ID | Item | Impact | Next step |
|---|---|---|---|
| R-1 | **Field rename rule (spec §12 item 1) is accepted but not built.** The app has no field-rename feature, so there is nothing to hook the `{reference}` rewrite into | A field renamed by editing the file leaves its formulas showing `#NAME?` | Owner: build field rename with the rewrite (one undoable command), or defer and say so in release notes |
| R-2 | Sort, filter, copy and export of a link column use the count ("2 linked"), not the names | A sort on a link column orders by count, which may surprise users | Owner decision. A name-based sort needs the index in the query layer |
| R-3 | Obsidian's own file Duplicate copies the table ID. The integrity check reports the duplicate, and links resolve to the first file by path | Links can point at either copy | Documented in the README and user guide. Owner decision on whether to re-issue an ID on duplicate |
| R-4 | Link editing in embedded tables is not supported; the embed shows a notice to open the full table | Some users may expect to link from a note | Owner decision |
| R-5 | The picker edits links into one default target table per field. Links into other tables are kept but cannot be edited yet | Mixed-target link fields cannot be fixed in the UI | Build a second picker, or keep one target per field |
| R-6 | Performance targets are still proposed (G-P1) | Gates are not binding until confirmed | Owner to confirm or change |
| R-7 | Cycle detection runs when a formula is set or a dependency changes, rather than only at a save event | Same user result: the cell shows `#CYCLE!` at once | Note only |
| R-8 | No browser or visual check was done. Mobile was not tested on a device | Layout of the picker, chips and error styles is unverified | Owner check before release (Obsidian checklist below) |
| R-9 | No release notes file exists yet | The "update before opening v2 files" warning is in the README and user guide only | Write release notes when the version is cut |
| R-10 | Lookups and rollups are out of scope | Not a defect. Stated in the phase | None |
| R-11 | The lint baseline of 119 warnings (non-null assertions and similar) is older code, not from P8 | None functional | Clean-up pass in a later step |

## Owner checklist (to move the gate to PASS)

1. In Obsidian, open a table with a formula column and a link column. Check: formula values, error tooltip, the link picker (search, check, uncheck, Clear), chips, the dashed chip for a missing row, and the integrity command. Check the look on desktop and on mobile.
2. Accept or reject P8-02, P8-03 and P8-04, and record the decision on SAD-61, SAD-62 and SAD-63.
3. Decide R-1 (field rename), R-2 (sort by link), R-3 (duplicate IDs) and R-5 (second picker).
4. Confirm or change the performance targets (R-6).
5. Then change this verdict to PASS and move SAD-13 to Done.

## Verdict

Phase 8 is **conditionally complete**. Everything the sandbox can check passes at HEAD and at each feature commit. The remaining items need an Obsidian session and an owner decision (checklist above). When they are done, this note moves from CONDITIONAL to PASS.
