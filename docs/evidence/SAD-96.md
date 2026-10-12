# SAD-96 — Cell editing: every documented gesture now opens the editor

**Date:** 2026-10-12 · **Repo:** `258044aamm-Dev/Tablify` · **Issue:** [SAD-96](https://linear.app/sad-mod/issue/SAD-96/cell-editing-is-not-working) (Bug, Urgent)
**Symptom:** “I cannot edit the content of any cell.”

## Root causes

1. **The documented mouse gesture never existed.** README and `docs/user-guide.md` §4/§18 say
   “double-click to edit”; `git log -S "dblclick" -- src/` shows the only `dblclick` handler ever
   written was in `embedView.ts` (P7-01). `TableView` had none — `onCellClick` only focused the
   grid. The sole trigger was keyboard **Enter** (`keyboard.ts` → `startEdit`), which needs grid
   focus and is invisible to anyone following the docs.

2. **Touch had no edit path at all.** Tap selected; the long-press cell menu had no Edit item
   (`tableMenuModel.ts`); there is no Enter key in the flow. On mobile the editor was
   unreachable — every cell was uneditable.

3. **Commit could not close the editor.** The editor’s Enter handler committed but did not stop
   propagation; the keystroke then reached the grid, where Enter means “edit this cell”, and a
   fresh editor opened immediately. Enter to commit felt broken; Escape was unaffected.

Why CI stayed green: `tests/views/tableView.test.ts` exercises the Enter path only (and never
asserted the editor closes), `editors.test.ts` calls `createEditor()` directly — no test ever
simulated click / double-click / tap → editor.

## Fix (`GridView.ts`, `tableView.ts`, `editors/index.ts`, `tableMenuModel.ts`)

| Change | Where |
|---|---|
| Double-click a body cell → `startEdit` — opens the right surface per type (inline editor, select/attachment panel, link picker; read-only types refuse) | `GridView` delegated `dblclick` → `onCellActivate` → `tableView.startEdit` |
| **Edit cell** as the first item of the cell menu (right-click / long-press), disabled with “Read-only field” on system/formula/airtable-readonly fields | `tableMenuModel.cellEntries`, `tableView.runMenuAction` |
| Second **tap** on the already-selected cell edits (touch equivalent of double-click); a tap on a different cell still just selects | `GridView.onCellReselect` (fired from the click handler when the cell was already selected), `tableView` gated on `lastPointerType === 'touch'` |
| Enter / Escape in the editor are consumed there (`stopPropagation`) — commit and cancel close the editor for real | `editors/index.ts` keydown handler |
| `startEdit` ignores re-entry while an editor is open | `tableView.startEdit` |

**Deliberately unchanged:** click still only selects (range select, row drag, `#`-handle drag,
long-press, every keyboard shortcut, the P5-02 menu item set beyond the one addition). No model,
command or file-format change; the menu’s disabled-reason pattern is reused for Edit cell.

## Verification

`tests/views/editTriggers.test.ts` — 8 tests, red first (6 failed exactly on the gaps above),
green after:

- double-click opens the inline editor; Enter commits and saves; the editor closes ✔
- double-click on a select cell opens the select panel, not a text editor ✔
- a single click still only selects ✔
- the cell menu’s **Edit cell** opens the editor ✔
- **Edit cell** is disabled with “Read-only field” on the formula column ✔
- double-click on a read-only cell opens nothing and does not crash ✔
- first tap selects, second tap on the same cell opens the editor ✔
- a tap on a different cell only moves the selection ✔

Plus one extended model test (`tableMenuModel.test.ts`: Edit cell ordering + disabled reason).
Full gate: `npm run check` — lint (0 errors), **97 files / 1562 tests** (was 95 / 1545 at
baseline; no existing test weakened — `gridSelect.test.ts`’s `onCellClick(2, 1)` contract kept
by adding `onCellReselect` instead of overloading the click callback), `.tabula` guard, docs
links, FA icons, build — all green.

Docs updated: `docs/shortcuts.md` gains a Mouse and touch table; `docs/user-guide.md` §4 notes
the tap-again and **Edit cell** gestures.
