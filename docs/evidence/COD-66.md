# COD-66 — Double-clicking a cell edits it again

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` · **Issue:** [COD-66](https://linear.app/code-bro/issue/COD-66/double-clicking-cell-editing) (Bug, Urgent)
**Symptom:** “Clicking or double-clicking a cell does not allow me to edit its content. However, pressing Enter enables editing.”

## Root cause

The `dblclick` listener was present and correctly wired — SAD-96 (`8c4031b`) added
`GridView` delegated `dblclick` → `onCellActivate` → `tableView.startEdit`, and every per-type
surface (inline editor, select/attachment panel, link picker, read-only refusal) worked when the
event arrived. **The event never arrived.**

`GridView.setSelection()` ended in `this.render()`, and `render()` clears `.tablify__content`
(`innerHTML = ''`) and rebuilds every visible cell through the row pool:

```
click #1 → setSelection() → render() → content.innerHTML = ''  ← the clicked node is gone
click #2 → lands on a different element
dblclick → Chromium does not dispatch it (the two clicks share no target)
```

Measured in Chromium against the production `TableView` (repo Playwright harness,
`tests/visual/lib/harness.ts`). Node ids are assigned by a `WeakMap` on first sight:

```
mousedown … capsule id=1 … closestCell=cell id=2 … detail=1
mouseup   … capsule id=1 … closestCell=cell id=2 … detail=1
click     … capsule id=1 … closestCell=cell id=2 … detail=1
mousedown … capsule id=3 … closestCell=cell id=4 … detail=2   ← rebuilt between the clicks
mouseup   … capsule id=3 … closestCell=cell id=4 … detail=2
click     … capsule id=3 … closestCell=cell id=4 … detail=2
(no dblclick line — the event is never produced)
final state: editors=0, selected=true
```

After the fix the same trace keeps one node pair (`id=1` / `id=2`) across both clicks, Chromium
dispatches `dblclick`, and the editor opens (`editors=1`, `activeElement=INPUT.tablify__editor`).

Why CI stayed green: `tests/views/editTriggers.test.ts` dispatched a **bare**
`new MouseEvent('dblclick')`. jsdom has no hit-testing and never derives `dblclick` from two
clicks, so the test asked “does a `dblclick` open the editor?” — never in doubt. Nothing asserted
the precondition: *does the element survive long enough for the browser to produce the event?*

## Fix (`src/views/grid/GridView.ts`)

| Change | Where |
|---|---|
| Selection is painted **in place** — `tablify__cell--selected`, `aria-selected` and the capsule outline are toggled on the previous and next cell; no re-render | `GridView.setSelection` |
| `render()` is used only as a fallback when the target row is outside the rendered window (virtual scroll), where there is no cell to paint and `fillRow()` re-applies the state from `this.selected` | `GridView.setSelection` |
| One helper owns the selected-cell look, shared by the click path and the render path so the two can never drift | `GridView.paintSelection`, `fillRow` |
| The cell for a coordinate is looked up in one place | `GridView.cellAt` |

This is the pattern the codebase already used for rows — `setRowSelection()` (SAD-80/SAD-114):
*“Marks the rows in place — no re-render — so a selection change never moves the scroll position
or rebuilds rows under the pointer.”*

**Deliberately unchanged:** click still only selects (range select, row drag, `#`-handle drag,
long-press, context menus, every keyboard shortcut). No model, command, view or file-format
change. No new callback, no new listener; the existing `dblclick` → `onCellActivate` path is
untouched.

A side effect worth noting: a click no longer rebuilds *visible rows × fields* DOM nodes
(e.g. 40 × 8 = 320 for a full screen), so selection is cheaper as well as correct.

## Verification

### Unit (`tests/views/editTriggers.test.ts`, 10 tests — 2 new, written red first)

- a click keeps the cell element alive, so the browser can fire `dblclick` — **failed before the
  fix**, passes after ✔
- moving the selection repaints in place: same node, exactly one selected cell, old `aria-selected`
  removed ✔
- the 8 SAD-96 tests (double-click inline editor, select panel, read-only refusal, click-only
  selects, tap-again, tap elsewhere) unchanged and green ✔

Full gate: `npm run check` — lint (0 errors), **111 files / 1660 tests** (was 111 / 1658; no
existing test weakened), `.tabula` guard, docs links, FA icons, build — all green. `main.js`
rebuilt in the same commit.

### Browser (Chromium, production `TableView` through the Playwright harness)

| Check | Result |
|---|---|
| Double-click a text cell → inline editor appears | PASS |
| Enter commits the value and closes the editor | PASS |
| Double-click a select cell → select panel, no text editor | PASS |
| Double-click a read-only formula cell → nothing, no crash | PASS |
| Single click → selected, no editor | PASS |
| `ArrowRight` → selection moves, exactly one cell outlined | PASS |
| Enter on the focused grid still opens the editor | PASS |
| Double-click a cell in another row → that row's editor | PASS |
| Right-click → selects the cell, opens no editor | PASS |
| Touch (mobile viewport): tap selects, second tap edits | PASS |
| Grouped view (`groupBy: Status`) → double-click edits | PASS |
| Double-click as the very first gesture on a freshly opened table | PASS |
| Double-click another cell while an editor is open → value lands on the new cell | PASS |

### Harness repair (separate commit, `65f2c0a`)

SAD-129 (`8acab4a`) began reading `Platform.isMobile` in `src/views/tableView.ts` and
`src/commands/export.ts` without exporting `Platform` from `tests/__mocks__/obsidian.ts`, so
`buildHarness()` — and with it `npm run visual:compare` — could not bundle. The mock now exports
it with desktop defaults; test-only, no production code touched. This is what made the
browser-level verification above possible.

## Lesson

SAD-96 added the feature and a test that could not fail. The missing assertion was not about the
handler but about the **event's precondition**. Where a feature depends on a browser-generated
event (double-click, drag, gesture), assert how the event is produced — here, DOM identity across
a click — not only what the handler does when handed one.
