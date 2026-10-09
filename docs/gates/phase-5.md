# Phase 5 Gate Check (Right-click: file explorer, table menu, long-press)

**Date:** 2026-10-09
**Result:** ⚠️ **CONDITIONAL — P5-01 and P5-02 automated checks PASS; P5-03 automated checks PASS but device checks NOT RUN (P5-03 stays In Review); Obsidian right-click checks NOT RUN**
**Commit tested:** `82ba5f7` (P5-03), with P5-00 `36586d7`, P5-01 `838042a`, P5-02 `8bb6374`
**Tester:** Agent (Arena.ai)
**Reason for this note:** Same conditional handling as P2/P3 (`docs/gates/phase-2-3.md`) and P4 (`docs/gates/phase-4.md`). The owner answered the P5 questions: wire the table view first (P5-00), conditional gate, device checks as an automated test now with the device checklist run later, and the " copy" suffix.

---

## Gate conditions

| # | Condition | Status | Notes |
|---|-----------|--------|-------|
| 1 | P5-01, P5-02, P5-03 accepted | ⚠️ PARTIAL | P5-01 and P5-02: automated checks pass, Obsidian checks NOT RUN. P5-03: automated checks pass, device checks NOT RUN (In Review) |
| 2 | Evidence files | ✅ PASS | `docs/evidence/P5-01.md`, `P5-02.md`, `P5-03.md`. P5-00 is recorded in its commit message and in `P5-01.md` |
| 3 | `npm run lint`, `npm test`, `npm run build` pass | ✅ PASS | 558 tests (45 files), lint 0 errors (82 warnings, pre-existing style), build ok |
| 4 | Regression: P0 to P4 tests still pass | ✅ PASS | Included in the 558 tests |
| 5 | No open S1 or S2 issues | ✅ PASS | No `docs/issues/` entries exist |
| 6 | Menu items match the spec | ✅ PASS (unit) | File: Open, Duplicate, Export. Folder: New table, Import. Cell, row, and header items per `FEATURES.md` §2.16 and §2.17 |
| 7 | Duplicate diff check | ✅ PASS | Only `tableId` and `name` differ. Row IDs and revisions unchanged |
| 8 | Undo for undoable items | ✅ PASS (unit) | Every undoable item undone; file content matches original (undo-all test). Ctrl/Cmd+Z in Obsidian NOT RUN |
| 9 | Performance (proposed) | ⚠️ PARTIAL | Menu item lists < 100 ms in Node. Long-press timer exact under fake timers. Menu opening in Obsidian NOT RUN |

## Changes that need owner acceptance

1. **Change field type rule.** A type is offered only when every value converts without error. Otherwise nothing changes (`docs/evidence/P5-02.md`, note 1).
2. **Change field type picker.** The installed Obsidian typings have no submenu API, so the item opens a picker. Blocked types show their reason.
3. **New table default** (proposed in P5-01, not answered by the owner): name `Untitled table`, one primary text field `Name`.
4. **Bundle guard** raised to 1,750,000 B (dev build with inline sourcemap). Production build is 229,203 B.
5. **Row-ID fix in P1-05.** Undoing a row delete previously created a new row ID. It now restores the same ID and position (`restoreRow`). This changes existing command behaviour.

## Open manual checks (NOT RUN in sandbox)

- **P5-01** T-I: right-click each target in a real vault and compare with `FEATURES.md` §2.16. Duplicate a real file and open it.
- **P5-02** T-E: each menu item once, the file checked after, and Ctrl/Cmd+Z in a real vault. Keyboard-only open (Menu key, Shift+F10).
- **P5-02** Menu opens < 100 ms (proposed) in Obsidian.
- **P5-03** T-M-DEV on iOS and Android: long press opens menu; scroll does not; short tap does not; movement during hold cancels; native selection blocked.

## Decision

Phase 5 is accepted **conditionally**. No S1 or S2 issue is open. The owner must:

1. Accept or change the conditions above (the change-type rule, the picker, the new-table default, the bundle guard).
2. Run the NOT RUN checks and record results in the evidence files.

P5-03 stays **In Review** until the device checklist is recorded.
