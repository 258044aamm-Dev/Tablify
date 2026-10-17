# Tablify — COD-66 double-click cell editing fix plan

> **Execution status (2026-10-17):** executed in full, same day, on `main`:
> **COD-66** `d428179` (in-place selection → `dblclick` fires again) · **harness** `65f2c0a`
> (`Platform` exported from the `obsidian` mock) · **docs** (this file, `docs/evidence/COD-66.md`,
> CHANGELOG). Red→green first: 2 new tests in `tests/views/editTriggers.test.ts` failed on the
> previous `main`. `npm run check` green — **111 files / 1660 tests** (baseline 111 / 1658; no
> existing test weakened). Browser matrix re-run against the committed fix: 13/13 (see
> `docs/evidence/COD-66.md`). Deviations from this plan: none — the fix is §5.1 + §5.2 exactly;
> the optional browser spec stayed a follow-up per decision Q2, and its checks were run manually.

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` @ `2f679bf` (v2.0.0-beta.3) · **Mode:** plan only
**Linear:** [COD-66 “double-clicking cell editing”](https://linear.app/code-bro/issue/COD-66/double-clicking-cell-editing) — Bug, Urgent, Todo, assigned to Md Limon Islam
**Baseline:** `npx vitest run` = **111 files / 1658 tests green**, *with the bug present* — the suite does not exercise the real gesture (§4).
**Sources:** `src/views/grid/GridView.ts`, `src/views/tableView.ts`, `src/embed/embedView.ts`, `tests/views/editTriggers.test.ts`, `docs/plans/sad-96-sad-97-fix-plan.md`, `docs/evidence/SAD-96.md`, `docs/user-guide.md` §4/§18.

---

## 1. Verdict

The `dblclick` handler exists and is wired correctly. COD-66 is **not a missing feature** — it is a
**DOM-identity defect in the click path**. The first click of a double-click rebuilds the grid, so the
browser never emits a `dblclick` at all.

| | |
|---|---|
| **Symptom** | Double-click a cell → nothing. Press Enter on the focused grid → the editor opens. Exactly as COD-66 reports. |
| **Root cause** | `GridView.setSelection()` calls `render()`, which does `this.content.innerHTML = ''` and rebuilds every visible cell. The element that received click #1 no longer exists when click #2 lands, so Chromium does not synthesise `dblclick` (and if it did, the event target would be a common ancestor, never a `.tablify__cell`). |
| **Fix** | Paint the selection **in place** (class, `aria-selected`, capsule outline) instead of re-rendering. The clicked node survives both clicks, the UA fires `dblclick`, and the existing SAD-96 handler runs unchanged. |
| **Size** | ~20 lines in one file (`src/views/grid/GridView.ts`) + tests. No API, file-format or behaviour change. |
| **Risk** | Low. This is the same pattern `setRowSelection()` already uses (SAD-80/SAD-114: *“Marks the rows in place — no re-render — so a selection change never moves the scroll position or rebuilds rows under the pointer.”*). |

SAD-96 (`8c4031b`) added the `dblclick` listener and `onCellActivate` → `startEdit` wiring; that code is
correct. COD-66 is the follow-up defect that SAD-96's code path could never reach in a real browser.

---

## 2. The mechanism, in one picture

```
mousedown  → click #1  → GridView click handler
                              setSelection({row, col})
                                 → render()
                                    → content.innerHTML = ''        ← the clicked node dies here
                                    → fillRow() rebuilds every cell
mousedown  → click #2  → lands on a *different* DOM node
dblclick               → never dispatched (targets differ / node was replaced)
```

The handler at `GridView.ts:359` is starved: it is registered correctly but the event never arrives.

---

## 3. Evidence (measured, not inferred)

Reproduced with the repo's own Playwright harness (`tests/visual/lib/harness.ts`), which mounts the
**production `TableView`** in Chromium — real `page.mouse.dblclick()`, real hit-testing.

### 3.1 Before the fix — no `dblclick` is ever dispatched

```
mousedown target=<div .tablify__capsule id=1>  closestCell=<div .tablify__cell id=2>  detail=1
mouseup   target=<div .tablify__capsule id=1>  closestCell=<div .tablify__cell id=2>  detail=1
click     target=<div .tablify__capsule id=1>  closestCell=<div .tablify__cell id=2>  detail=1
mousedown target=<div .tablify__capsule id=3>  closestCell=<div .tablify__cell id=4>  detail=2   ← new node
mouseup   target=<div .tablify__capsule id=3>  closestCell=<div .tablify__cell id=4>  detail=2
click     target=<div .tablify__capsule id=3>  closestCell=<div .tablify__cell id=4>  detail=2
                                                                  ← no dblclick line at all

final state: editors=0, selected=true, activeElement=<div .tablify--grid>
```

The node ids change (`1 → 3`, `2 → 4`) **between the two clicks**: that is the `render()` inside
`setSelection`. A bare synthetic `dblclick` (what the unit test sends) *does* open the editor — which is
exactly why 8/8 tests are green while the product is broken.

### 3.2 After the fix — one stable node, `dblclick` fires, editor opens

```
mousedown target=<div .tablify__capsule id=1>  closestCell=<div .tablify__cell id=2>  detail=1
mouseup   target=<div .tablify__capsule id=1>  closestCell=<div .tablify__cell id=2>  detail=1
click     target=<div .tablify__capsule id=1>  closestCell=<div .tablify__cell id=2>  detail=1
mousedown target=<div .tablify__capsule id=1>  closestCell=<div .tablify__cell id=2>  detail=2   ← same node
mouseup   target=<div .tablify__capsule id=1>  closestCell=<div .tablify__cell id=2>  detail=2
click     target=<div .tablify__capsule id=1>  closestCell=<div .tablify__cell id=2>  detail=2
dblclick  target=<div .tablify__capsule id=1>  closestCell=<div .tablify__cell id=2>  detail=2   ← fires

final state: editors=1, selected=true, activeElement=INPUT.tablify__editor
```

### 3.3 Measured acceptance matrix (Chromium, patched build)

| Check | Result |
|---|---|
| Single click selects, opens no editor | PASS |
| **Double-click opens the inline editor** (COD-66) | PASS |
| Enter commits the value and closes the editor | PASS |
| Double-click a select cell opens the select panel, not a text editor | PASS |
| Double-click a read-only formula cell opens nothing (no crash) | PASS |
| `ArrowRight` moves the selection, old cell loses the outline (exactly one highlighted) | PASS |
| Enter still opens the editor on the selected cell | PASS |
| Double-click on a different row opens *that* row's editor | PASS |
| Cell DOM node survives a single click | PASS |
| Right-click selects the cell and opens no editor | PASS |
| Touch: tap selects, second tap opens the editor (mobile viewport) | PASS |
| Grouped view: double-click opens the editor | PASS |
| Double-click another cell while an editor is open | PASS (value lands on the new cell) |
| Whole unit suite with the patch | **111 files / 1658 tests green** |
| `npx eslint src/views/grid/GridView.ts` | clean |

---

## 4. Why the suite missed it

`tests/views/editTriggers.test.ts:45` fires a **bare** `dblclick`:

```ts
const dbl = (target: HTMLElement) =>
  target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
```

jsdom has no hit-testing and never synthesises `dblclick` from two clicks, so this test asks
“does a `dblclick` event open the editor?” — which was never in doubt. The missing link is
“**does the browser ever produce that event after a real click?**” Any regression test must assert
the **DOM identity** across a click (see §6), not just replay a synthetic event.

---

## 5. Proposed change

Single file: `src/views/grid/GridView.ts`.

### 5.1 `setSelection()` — line 427

```ts
/** Select one body cell (no-op if out of range). Pass null to clear. */
setSelection(sel: GridSelection | null): void {
  if (sel && (sel.row < 0 || sel.row >= this.totalRows || sel.col < 0 || sel.col >= this.fields.length)) return;
  const prev = this.selected;
  const next = sel ? { ...sel } : null;
  // Same cell: nothing to paint. Critically, no re-render — the second click of a
  // double-click must land on the same DOM node or the UA will not fire `dblclick` (COD-66).
  if (prev && next && prev.row === next.row && prev.col === next.col) return;
  this.selected = next;
  if (prev) this.paintSelection(this.cellAt(prev.row, prev.col), false);
  if (!next) return;
  const cell = this.cellAt(next.row, next.col);
  if (cell) this.paintSelection(cell, true);
  // The target row is outside the rendered window (virtual scroll): fall back to a render,
  // which paints the selection from `this.selected` in fillRow().
  else this.render();
}

/** The rendered cell for a grid coordinate, or null when that row is outside the pool. */
private cellAt(row: number, col: number): HTMLElement | null {
  return this.root.querySelector(
    `.tablify__row[data-row-index="${row}"] .tablify__cell[data-col-index="${col}"]`,
  ) as HTMLElement | null;
}

/** The one place that owns the selected-cell look (class, ARIA, capsule outline). */
private paintSelection(cell: HTMLElement | null, on: boolean): void {
  if (!cell) return;
  cell.classList.toggle('tablify__cell--selected', on);
  if (on) cell.setAttribute('aria-selected', 'true');
  else cell.removeAttribute('aria-selected');
  const capsule = cell.querySelector<HTMLElement>('.tablify__capsule');
  if (!capsule) return;
  capsule.style.outline = on ? '2px solid var(--tablify-selection)' : '';
  capsule.style.outlineOffset = on ? '-1px' : '';
}
```

### 5.2 `fillRow()` — line 1290 (single source of truth)

Replace the inline block with the helper, so the styles can never drift apart:

```ts
// before
cell.classList.add('tablify__cell--selected');
cell.setAttribute('aria-selected', 'true');
capsule.style.outline = '2px solid var(--tablify-selection)';
capsule.style.outlineOffset = '-1px';

// after
if (this.selected && this.selected.row === rowIdx && this.selected.col === colIndex) {
  this.paintSelection(cell, true);
}
```

That is the entire fix. `render()` stays exactly as it is.

### 5.3 Deliberately **not** included

- **A `pointerdown`/`detail === 2` fallback.** It would mask the real defect and, in the normal
  case, fire *in addition to* `dblclick` — `startEdit()` guards inline editors with `this.editing`,
  but the select/attachment panel path (`openCellPanel`) has no such guard and would open twice.
  Only worth adding if a second, independent re-render source is ever found.
- **Changing the keyboard order** (`setSelection` then `scrollToRow`, `tableView.ts:686–687`).
  Measured to behave correctly: when the target row is off-window, `cellAt` returns null, the
  fallback render paints nothing, and `scrollToRow` renders the row with the selection already
  applied. No change needed.

---

## 6. Tests

### 6.1 The regression test that actually catches this (jsdom, fast)

Add to `tests/views/editTriggers.test.ts` — this **fails on today's `main`** and passes after the fix:

```ts
it('a single click keeps the cell element alive (the browser needs it for dblclick)', async () => {
  const view = await openView();
  const before = need(cellAt(view, 0, 0), 'cell before click');

  before.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

  const after = need(cellAt(view, 0, 0), 'cell after click');
  expect(after, 'the clicked node must survive — otherwise no dblclick can fire').toBe(before);
  expect(after.classList.contains('tablify__cell--selected')).toBe(true);
});
```

Plus two cheap companions:

- moving the selection (click A, then click B) leaves **exactly one** `--selected` cell and moves
  the capsule outline with it;
- `setSelection(null)` clears the marking.

Keep all eight existing tests untouched — they still describe the intended post-fix behaviour.

### 6.2 Browser-level test — **not in this change** (decision Q2)

Unit coverage only, as decided on 2026-10-17. A browser spec is still the only test class that can
catch “the browser never fires the event” (it would have caught COD-66 before release), so it is
recorded here as a follow-up, not as part of this fix. If it is picked up later, the shape is:
`tests/e2e/editTriggers.browser.spec.ts` driven by the existing `playwright` dependency and
`tests/visual/lib/harness.ts`, run by a new `npm run test:browser` outside `npm test`:

- `page.mouse.dblclick()` on a text cell → `input.tablify__editor` exists;
- on a select cell → `.tablify__panel`, no text editor;
- on a read-only cell → nothing;
- one click → selected, no editor;
- mobile (hasTouch): tap, tap → editor.

The equivalent checks were run manually against a patched build during planning (§3.3) and all passed.

---

## 7. Blast radius / edge cases

| Path | Behaviour after the fix |
|---|---|
| Click | Selects in place; **the node survives** (the fix). Also drops a full row-pool rebuild per click — see perf below. |
| Double-click | `dblclick` fires → `onCellActivate` → `startEdit` (text, select, attachment, link, read-only all unchanged). |
| Keyboard arrows | `setSelection` repaints old→new in place; `scrollToRow` still renders when the target is off-window. Verified in Chromium. |
| Enter | Unchanged. |
| Touch tap-again | Unchanged — it keys off `this.selected` state (`onCellReselect` + `pointerType`), not DOM identity. Verified on a mobile viewport. |
| Grouped view | Same indexing (`data-row-index` is the grouped row index). Verified with `groupBy: Status`. |
| Embed view (`embedView.ts:198`) | Fixed for free — it shares `GridView` and had the same latent defect. |
| `setSelection(null)` | Clears class/ARIA/outline in place. Callers (`toggleGroup`, `tableView.ts:651`) already re-render through `afterChange()`. |
| Virtual scroll / pooled rows | `fillRow()` rebuilds cells from scratch on every render (`rowEl.innerHTML = ''`), so no stale highlight can survive a recycle; `setSelection` re-applies from state. |
| Context menu | `openMenuFromTarget` calls `setSelection` then opens the menu — the menu anchors to the event position, not to a DOM node. Verified. |
| Row selection (SAD-114) | Untouched (`setRowSelection` already in-place). |
| **Perf** | A click currently rebuilds *visible rows × fields* DOM nodes (e.g. 40 × 8 = 320). After: 0. |

---

## 8. Verification / definition of done

1. `npm run check` green — lint, full vitest suite (≥1658 tests, no existing test weakened),
   `check:guard`, `check:docs`, `check:icons`, `build`.
2. **`main.js` rebuilt and committed** — it is a tracked artifact in this repo.
3. `docs/evidence/COD-66.md` with the §3 event-stream evidence (matches the repo's evidence pattern).
4. `CHANGELOG.md` under `[Unreleased] → Fixed`:
   *“Double-clicking a cell opens its editor again (COD-66) — the first click used to rebuild the
   grid, so the browser never fired `dblclick`.”*
5. Manual QA in Obsidian (desktop + mobile): the 10-row matrix in §3.3.
6. The §3.1 reproduction script re-run against the built plugin → editor opens.

---

## 9. Rollout

- Branch: `fix/cod-66-double-click-editing` off `main` (`2f679bf`).
- Commits, mirroring the repo's message style:
  1. `COD-66: paint cell selection in place so double-click can fire` (code + unit tests)
  2. `test: export Platform from the obsidian mock so the visual harness builds` (decision Q3 —
     one line; unblocks `npm run visual:compare`, no production code touched)
  3. `docs: record COD-66 fix and evidence` (CHANGELOG, `docs/evidence/COD-66.md`, rebuilt `main.js`)
- No schema, migration or settings change. No compatibility impact on `.tablify` files.

### Execution checklist (when implementation is approved)

1. Add the regression test from §6.1 **first**, confirm it fails on `main`.
2. Apply §5.1 + §5.2; confirm the test passes and the suite is still green.
3. Fix the `Platform` export in `tests/__mocks__/obsidian.ts` (separate commit).
4. `npm run check`; rebuild and commit `main.js`.
5. Re-run the Chromium matrix (§3.3) against the built plugin.
6. CHANGELOG `[Unreleased] → Fixed`, `docs/evidence/COD-66.md`.
7. Update COD-66 with the PR link and move it to Done once merged.

---

## 10. Secondary findings (out of scope unless approved)

1. **The visual harness is broken on `main`, independently of COD-66.** `npm run visual:compare`
   (and anything using `buildHarness()`) fails to bundle: `src/commands/export.ts` and
   `src/views/tableView.ts` import `Platform` from `obsidian`, but `tests/__mocks__/obsidian.ts`
   does not export it. Introduced by `8acab4a` (SAD-129). One-line fix; it blocks the optional
   browser test in §6.2.
2. **SAD-96 shipped with a test gap**, not a code gap: its tests replay a synthetic `dblclick` that
   the browser never produces. Worth recording in `docs/evidence/COD-66.md` so the pattern is not
   repeated (assert *how* an event is produced, not only what the handler does with it).
3. **D-1 from the SAD-96 plan is still open:** the prototype edits on a **single click**
   (`Prototype/script.js` `cellClick`), while the README/user-guide promise **double-click** with
   click = select. COD-66 does not require resolving this; switching to click-to-edit would be a
   separate, larger UX change.

---

## 11. Decisions (locked 2026-10-17)

| # | Question | Decision |
|---|---|---|
| Q1 | Fix scope | **Minimal in-place selection** (§5). No defensive pointer fallback, no switch to single-click editing. |
| Q2 | Regression depth | **Unit only** (§6.1). Browser spec recorded as a follow-up in §6.2, not in this change. |
| Q3 | Stale `obsidian` mock (`Platform`) | **Yes**, fixed in a separate one-line commit — it repairs `npm run visual:compare`. |
| Q4 | Linear | **Comment the root cause and move COD-66 to In Progress.** |

---

## 12. Status

**Done (2026-10-17).** Fix `d428179`, harness repair `65f2c0a`, docs in the follow-up commit.
Evidence: `docs/evidence/COD-66.md`. The Chromium figures in §3 were first produced with a
throwaway patch and then re-confirmed against the committed build, so they describe the real
production `TableView`, not a mock.
