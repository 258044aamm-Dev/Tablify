# COD-70 — one click on another cell while editing

**Issue:** [COD-70](https://linear.app/code-bro/issue/COD-70) · priority 1 · Improvement + UI-UX · project Tablify
**Baseline:** `main` @ `0af1e84` (COD-71 delivered)
**Outcome:** fixed in `src/views/tableView.ts`; no other file changed.

---

## 1. What the ticket asks

> When I am editing a cell and click another cell, the selection does not move to the new cell on
> the first click — I have to click twice. Handle the current edit appropriately and activate the
> newly selected cell on the first click. Investigate the root cause, fix it, and do not interfere
> with cell editing, selection or navigation.

The value *was* committed by the first click. Only the selection lagged one click behind, which is
why the bug reads as "the first click did nothing".

## 2. Reproduction

`/tmp/cod70repro.ts` drives the real build in Chromium through the repo's visual harness
(three columns, four rows):

| Step | Result before the fix |
|---|---|
| Double-click `(0,0)`, type `REPLACED` | editor open, selection `0/0` |
| **One** click on `(1,1)` | value committed (`REPLACED`), editor closed, selection **still `0/0`** |
| A second click on `(1,1)` | selection moves to `1/1` |

## 3. Root cause

The click that selects a cell is handled by `GridView`'s delegated `click` listener
(`GridView.ts:356`). On the way to it:

1. `pointerdown` starts the gesture. Nothing selects yet.
2. `mousedown` moves focus out of the editor. The editor's `blur` listener calls `doCommit()`
   (`editors/index.ts:166`), which executes the edit command and calls `onDone(true)`.
3. `startEdit`'s `onDone` callback (`tableView.ts:1164`) calls `this.renderGrid()`.
4. `renderGrid()` → `GridView.setModel()` → `render()` → `fillRow()`, and `fillRow` starts with
   `rowEl.innerHTML = ''` (`GridView.ts:1285`). **Every cell element in the row is replaced**, so
   the element under the pointer is no longer in the document.
5. Chromium dispatches no `click` when the element the press began on has been detached;
   `mouseup` still arrives, but the `click` that would select the cell never does.

Confirmed with a capture-phase event log on the same gesture:

```
cap:pointerdown target=SPAN.tablify__cell-text connected=true
cap:mousedown    target=SPAN.tablify__cell-text connected=true
cap:mouseup      target=SPAN.tablify__cell-text connected=true
                 ← no click event at all
```

So the fix cannot be "wait for the click": it has to finish the edit from the press and do the
selection itself.

## 4. What was ruled out

| Option | Why not |
|---|---|
| Defer the post-commit `renderGrid()` (macrotask) so the click survives | Reorders `Enter`/`Escape` commits too — every test and every reader of the DOM would see an async grid. Too wide for a click bug. |
| Let `GridView` select on `pointerdown` unconditionally | Changes selection timing for every press (row drag, `wasSelected`/re-select, touch taps, long-press) — exactly the "do not interfere" the ticket warns about. |
| Re-dispatch a synthetic `click` at the press point after the re-render | Re-enters the whole handler chain (row modifiers, re-select, checkbox, link picker) with a fabricated event; the visible result is the same as selecting directly. |

## 5. The fix

`TableView.wireEditSwitchPress()` — a `pointerdown` listener on the grid root, added next to the
existing press wiring, that runs **only while an editor is open** and **only for mouse/pen**
presses with the primary button on a body cell that is not the edited one:

1. Finish the edit through the editor's own commit path (`finishEditOnPress` dispatches the same
   `blur` event the browser would have delivered).
2. `preventDefault()` the press, so the rest of the half-finished gesture cannot land on the
   freshly rendered rows.
3. Activate the pressed cell:
   - a **checkbox box** toggles and leaves the selection alone (the box owns its click — COD-71);
   - every other cell becomes the selection, exactly as the click handler would have set it.
4. Focus the grid, so arrow keys keep working without a second click.

Two edge cases decided on purpose:

- **An invalid value keeps the editor open** (the editor's existing rule). The press is still
  consumed and the caret is returned to the field (after the press's own focus handling), so the
  value can be corrected or cancelled with Escape instead of being stranded unfocused.
- **Touch is untouched.** Touch taps never reach the editor path through this listener, and a
  tap's own `click` follows a still-attached cell — the long-press and tap-to-edit tests pass
  unchanged.

## 6. Acceptance mapping

| Requirement | Where it is proven |
|---|---|
| The selection moves on the first click | `tests/views/editSwitch.test.ts` "one press on another cell…"; browser check 1d |
| The current edit is handled appropriately (committed, one undo step) | browser checks 1b/1c; `afterChange()` path unchanged |
| The newly selected cell is activated | selection painted on the new cell; arrow keys work immediately (browser check 2a) |
| No interference with editing / selection / navigation | Enter, Escape, click-inside-editor, invalid value, right-click, header press, touch tap: browser checks 4–9 and the five new jsdom tests |

## 7. Out of scope

- Row drag started from the `#` lead while an editor is open (unchanged behaviour).
- Any change to what a commit writes, to the file format, or to undo granularity.
