# COD-72 — column freezing is the primary column, and only it

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` · **Issue:** [COD-72](https://linear.app/code-bro/issue/COD-72/task-investigate-and-improve-column-freezing-behavior) (priority 1, Improvement + Feature)
Investigation: [`docs/reports/cod-72-freeze-investigation.md`](../reports/cod-72-freeze-investigation.md) · Plan: [`docs/plans/cod-72-freeze-plan.md`](../plans/cod-72-freeze-plan.md)

## What was wrong

`frozenColumns` was a **count from the left**, not a column. Every freeze action therefore pinned a
*prefix*, and the three surfaces disagreed about what that meant:

| Symptom (measured before the change) | Cause |
|---|---|
| Header ⋮ → *Freeze column* on Col 5 pinned **six** columns | the item wrote `col + 1` |
| On an already-frozen column the same item **unfroze** the columns to its right | it wrote the smaller value; only the last frozen column was disabled |
| No way to unfreeze from the header menu | the item only ever wrote a larger value |
| Freeze with the primary unfrozen still pinned the primary | prefix, again |
| 6 frozen on a 792 px pane left **no** non-frozen column visible at any scroll | the count was never checked against the pane |
| Reorder or hide silently changed *which* columns were frozen | the stored value is a position, not an identity |
| A column scrolled under the frozen block was cut mid-capsule | no boundary styling |
| Options said “Freeze primary column” but 4 columns were pinned | one switch, a count behind it |

## What changed

Owner decision: the field-by-field freeze is **removed**. Only the primary column freezes, and the
primary column is always the first column.

| File | Change |
|---|---|
| `src/model/view.ts` | `effectiveFrozenColumns` returns 0/1 (0 at ≤639 px); `validateView` clamps the flag to 0..1 and normalises `columnOrder` so the primary field leads; `freezeModeOf` and the `freezeMode` copy are gone |
| `src/model/types.ts` | `frozenColumns` documented as the 0/1 flag; `freezeMode?: 'viewport' \| 'fixed'` **removed** |
| `src/views/grid/columns.ts` | `setFrozenColumns` collapses any positive count to 1 and writes no mode |
| `src/views/grid/GridView.ts` | painted count clamped to 0..1; `tablify__cell--frozen-edge` on the last frozen slot; **no drag grip on the primary header** |
| `src/views/grid/toolbar.ts` | `ToolbarState.freezeUnavailable` — the switch is disabled, `aria-checked="false"`, reason in the label, `tablify__switch--narrow` |
| `src/views/tableView.ts` | `toolbarState()` reports `freezeUnavailable` (pane ≤639 px); the `header.freeze` handler is deleted |
| `src/menus/tableMenuModel.ts` | the `header.freeze` entry is deleted |
| `src/format/parse.ts` | a legacy `freezeMode` key is deleted after the unknown-key copy, so it does not survive the next save |
| `src/format/serialize.ts` | `freezeMode` dropped from `VIEW_KEYS` |
| `tablify.schema.json` | `freezeMode` removed; `frozenColumns` gains `maximum: 1` |
| `FORMAT_SPEC.md` | §5 table and rule rewritten; the `freezeMode` note says it was removed |
| `styles.css` | `--tablify-frozen-edge-shadow` (light/dark), `.tablify__cell--frozen-edge::after` divider (top/bottom −8px bridges the row spacing), `.tablify__lead--frozen::before` paints the 12 px padding strip, `.tablify__switch--narrow` |

Unchanged: widths and resizing, sorting, grouping, hiding (except that the primary can never be
hidden, as before), selection, editing, export, import, sync, the `#` gutter, the sticky header, row
virtualisation, and the single scroll container.

## Behaviour now

| Situation | Result |
|---|---|
| Default view, desktop pane | primary column pinned; `#` + primary pin together; z-index 2 in the header, 1 in the body |
| Header ⋮ on any column | Modify field…, Hide field, Sort ascending, Sort descending — **no freeze item** |
| Options | “Freeze primary column” on/off; the only control |
| Pane ≤ 639 px | nothing pinned; switch off and disabled with the reason in its label; the stored flag is untouched |
| Legacy file with `frozenColumns: 4` | loads as 1, one warning; exactly one pinned column |
| Legacy file with `freezeMode` | loads (extra view keys are allowed), the key is dropped from the model and not written again |
| Drag the primary | no grip, so no drag; dropping another column on it lands after it; `validateView` re-normalises any other path |
| Scrolled horizontally | the block stays pinned, background continuous, divider + edge shadow mark the end, nothing shows through the padding strip (light and dark) |

## Tests

| File | Pins |
|---|---|
| `tests/model/freeze.test.ts` (renamed from `freezeMode.test.ts`, 11 tests) | 0/1 evaluation at 400/639/640/1568, a flag of 0 never freezes, a legacy 4 evaluates to 1, `createDefaultView` has no `freezeMode`, clamping 4→1 with the warning, −1 and non-numeric → 0, a legacy key is dropped by `validateView` / `normalizeView`, serialize→parse round-trip, an old file loses the key on the next save |
| `tests/model/view.test.ts` | the round-trip test uses flag 1 and a primary-first order; 99 clamps to 1; a primary at index 3 is moved to the front with the warning |
| `tests/views/grid/columns.test.ts` | `setFrozenColumns` maps any positive count to 1 and 0/−1/NaN to 0 |
| `tests/views/grid/frozenColumns.test.ts` | only the primary is sticky in header and body; the boundary class is on exactly that slot and is cleared on unfreeze; a legacy 99 renders one pin; a narrow pane pins nothing and carries no boundary class; `setModel` toggles the flag |
| `tests/menus/tableMenuModel.test.ts` | four header items in order; **no** `header.freeze*` / `header.unfreeze*` id for counts 0, 1, 4 at any column |
| `tests/views/grid/headerCapsule.test.ts` | the primary header has no grip, the others do; a drag now starts from a non-primary column; `moveColumnOnto` cannot move the primary off the front |
| `tests/views/toolbar.test.ts` | the switch reads the flag; `freezeUnavailable` disables it, forces `aria-checked="false"`, sets the reason and suppresses the callback |
| `tests/views/tableView.test.ts` | the Options switch toggles 0↔1 and writes **no** `freezeMode` |
| `tests/ui/formControlSpecificity.test.ts` | the frozen boundary rule uses `background-color`, not `background` (the existing guard) |

## Browser verification

Real `TableView` in the harness (9 text fields × 150 px, 5 rows, 900 px window → 794 px pane):

| Scenario | Result |
|---|---|
| default | 1 pinned header “Name” at `left` 65 with the edge marker, 1 pinned cell per row, switch on, **no grip on the primary** |
| scrolled 420 px | pinned column stays, divider continuous (`–8px`…`–8px`), padding strip painted, light **and** dark |
| legacy `frozenColumns: 4` | stored 1, exactly one pinned column |
| `0` | nothing pinned, no edge marker, switch off |
| 600 px pane | pane 542 px, nothing pinned, switch off + disabled + “Freeze primary column. Not available in a narrow window” |

After — [scrolled, light](cod-72/cod72-after-s1-scrolled.png) ·
[scrolled, dark](cod-72/cod72-after-dark.png) · [600 px pane](cod-72/cod72-after-narrow.png) ·
[legacy count 4](cod-72/cod72-after-legacy-4.png) · [unfrozen](cod-72/cod72-after-unfrozen.png) ·
[divider close-up](cod-72/cod72-sliver-crop.png).
Before — [clipped capsule, no boundary](cod-72/cod72-s1-scrolled.png) ·
[6 frozen hiding every other column](cod-72/cod72-occlusion-900.png).

## Full regression run

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (119 pre-existing warnings) |
| `npm run test` | **117 files / 1772 tests** pass (1770 before; the freeze-mode suite was rewritten and two new cases added) |
| `npm run check:guard` / `check:docs` / `check:icons` / `build` | all PASS (docs: 143 files) |
| `npm run test:fields` | **100/100** |

## Deliberate edges

- The freeze stays **positional** for reordering: the primary cannot move, so there is no second
  case to define. Hiding a column cannot touch the primary, so the frozen boundary cannot drift.
- `freezeMode` is removed rather than deprecated: with a single flag there is no “viewport default
  vs deliberate choice” distinction left, and a name on a flag that does nothing would mislead.
  Files that still carry it load and lose the key on the next save; `formatVersion` is unchanged.
- The ≤639 px rule applies to the deliberate choice too — **requested behaviour**, not a fallback:
  a second way to freeze (per-device) is gone.
