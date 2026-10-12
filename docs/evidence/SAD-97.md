# SAD-97 — Context menu: right-click appears reliably

**Date:** 2026-10-12 · **Repo:** `258044aamm-Dev/Tablify` · **Issue:** [SAD-97](https://linear.app/sad-mod/issue/SAD-97/context-menu) (Bug, Urgent)
**Symptom:** the right-click context menu does not appear as expected; in practice it appeared only after ~1.5 s of pointer quiet.

## Root causes

1. **Touch-dedupe window armed by mouse input.** `wirePressEvents` stamped `lastTouchAt` on every
   `pointerup`/`pointercancel` — mouse and pen included. `onContextMenu` swallows any context menu
   within 1.5 s of that stamp (P5-03: the native menu after a touch long-press must not double up
   with the one `LongPressDetector` already opened). Desktop event order is
   `pointerdown (btn 2)` → `contextmenu` → `pointerup (btn 2)`, so the guard was compared against
   the *previous* pointer interaction: click a cell, right-click it → swallowed. Each right-click’s
   own `pointerup` re-armed the window, so repeated right-clicks kept failing.

2. **Row-drag menu blocker could escape its drag.** `startRowDrag` added a **document-level
   capture** `contextmenu` blocker at pointerdown on the `#` handle — before the drag threshold was
   crossed — and removed it only on `pointerup`/`pointercancel`. An inert press (or a press whose
   release is never delivered: window blur mid-press) swallowed context menus; a leaked listener
   blocked them **everywhere in Obsidian** for the session.

3. **Row-lead fall-through.** Right-click on the row lead (`#` / checkbox) resolved to no menu and
   showed the browser’s native menu; the prototype opens the row menu for any `tr[data-row]`.

## Fix (`tableView.ts`, `GridView.ts`)

| Change | Where |
|---|---|
| `lastTouchAt` stamped on **touch contact only** (`pointerdown` keeps its existing touch guard; `pointerup`/`pointercancel` now match) | `tableView.ts` `wirePressEvents` |
| The dedupe suppresses only when the event is touch-originated: if the event reports `sourceCapabilities` (Chromium), `firesTouchEvents` is required; otherwise the (now touch-only) time window decides | `tableView.ts` `onContextMenu` |
| Row targets (the `#` / checkbox lead, the row itself) open the **row menu** (`rowEntries`), prototype `tr` behaviour | `tableView.ts` `openMenuFromTarget`, `openRowMenu` |
| Inside the grid’s table surface (header + viewport) the native menu is fully replaced, as in the prototype; grid chrome (Insert Row pill) keeps the platform menu | `tableView.ts` `onContextMenu` |
| The drag blocker is armed **only after the threshold** (drag is real), scoped to **the grid root** (never `document`), and torn down on `pointerup` / `pointercancel` / **window `blur`** | `GridView.ts` `startRowDrag` |

No model, command, file-format or editor behaviour is touched; menus still build from
`tableMenuModel` entries with their disabled reasons.

## Verification

`tests/views/contextMenu.test.ts` — 8 tests, written red first (5 failed exactly on the defects
above), all green after the fix:

- right-click opens the cell menu immediately after a mouse click ✔
- consecutive rapid right-clicks both open (the window is never armed by mouse) ✔
- the native menu after a **touch** press is still suppressed (P5-03 preserved) ✔
- an inert `#`-handle press no longer blocks later right-clicks ✔
- during an active row drag the menu is still suppressed, and returns afterwards ✔
- right-click on the row lead opens the row menu (Insert row above / … / Delete row) ✔
- `pointercancel` tears the blocker down even mid-drag ✔
- a leaked press cannot block context menus outside the grid ✔

Full gate: `npm run check` — lint, **96 files / 1553 tests**, `.tabula` guard, docs links,
FA icons, build — all green (was 95 / 1545; no existing test modified).
