# COD-72 — Column freezing: implementation plan

**Approved and implemented** — see [`docs/evidence/COD-72.md`](../evidence/COD-72.md) for what shipped.

---

## 1. The design you approved

| # | Decision |
|---|---|
| 1 | **Only the primary column freezes.** The field-by-field freeze mechanism is removed. |
| 2 | **“Freeze column” leaves the column-header menu.** No freeze and no unfreeze there. Options → **“Freeze primary column”** is the only control. |
| 3 | Freezing stays a **toggle**, default **on** (today's `frozenColumns: 1`). |
| 4 | `frozenColumns` stays in the saved view as a **0/1 flag** — no new key, no migration. |
| 5 | The **primary column is locked as the first column** ("Airtable rule"), so “primary column frozen” always means the pinned leftmost column. |
| 6 | **No freezing on a narrow pane (≤ 639px)**, whatever the switch says; the switch shows that state. |
| 7 | A **subtle divider** marks the frozen edge. |
| 8 | No backward-compatibility work. |

Net effect: the whole “prefix count” machine disappears from the UI, and the one thing that remains — the primary column — is always the first column, so the sticky-position rendering is exactly right.

---

## 2. What changes, file by file

### 2.1 `src/model/view.ts` — the model

- `validateView`: clamp `frozenColumns` to **0..1**. A stored `4` becomes `1` with the warning
  `frozenColumns 4 exceeds 1 — only the primary column can be frozen`.
- `effectiveFrozenColumns(view, paneWidth)`:
  ```ts
  const stored = view.frozenColumns > 0 ? 1 : 0;
  return paneWidth <= MOBILE_PANE_MAX_WIDTH ? 0 : stored;   // 639
  ```
- **Remove `freezeModeOf`** and every `freezeMode` check. With a single primary-column flag there is
  no “deliberate choice vs viewport default” left to distinguish — and your rule (never freeze on a
  narrow pane) applies to the deliberate choice too, so the key has no meaning anymore.
- `columnOrder`: after normalising, move the **primary field to index 0**. One-time warning only when
  it actually had to move: `Primary field "Name" must stay in the first column — moved`.
- Default view keeps `frozenColumns: 1`; the `freezeMode` default is deleted.

### 2.2 `src/model/types.ts`

- `ViewDefinition.freezeMode` removed. `frozenColumns` stays `number` (0 or 1 by convention — the
  validator enforces it).

### 2.3 Format — `src/format/parse.ts`, `src/format/serialize.ts`, `tablify.schema.json`, `FORMAT_SPEC.md`

- `freezeMode` removed from `VIEW_KEYS`, the parse special-case, the schema and the spec table.
  Views allow additional properties, so a file that still carries the key **loads fine**; the key is
  simply dropped on the next save. No `formatVersion` bump.
- `frozenColumns` description updated: *“1 freezes the primary column, 0 does not.”*

### 2.4 `src/views/grid/columns.ts`

- `setFrozenColumns(view, n, fields)`: clamp to **0..1**; no `freezeMode` write.

### 2.5 `src/menus/tableMenuModel.ts` — header menu

- Delete the `header.freeze` entry (and its “Already frozen through this column” reason).
- `HeaderContext` loses nothing else; the menu becomes
  **Modify field… · (Edit formula…) · Hide field · Sort ascending · Sort descending**.

### 2.6 `src/views/tableView.ts`

- Delete the `case 'header.freeze'`.
- `onFreezeColumns(0 | 1)` unchanged; `toolbarState()` keeps showing the **effective** count so the
  switch matches the screen.

### 2.7 `src/views/grid/GridView.ts`

- `measure()`: clamp the painted count to **0..1** (instead of `fields.length`).
- `placeSlot()`: add `tablify__cell--frozen-edge` to the **last frozen slot**
  (slot `LEAD_SLOTS + frozenColumns - 1`, i.e. the primary capsule). Cleared by
  `restyleGeometry()` on unfreeze like the other frozen classes.
- **No drag grip on the primary column** (`if (this.opts.onColumnMove && !field.primary)`), so the
  lock is visible, not just enforced after the fact.

### 2.8 `src/views/grid/toolbar.ts` — Options

- Switch label stays **“Freeze primary column”**.
- On a pane ≤ 639px the switch is **disabled**, `aria-checked="false"`, with the reason folded into
  the aria-label: *“Freeze primary column. Not available in a narrow window.”* — otherwise a click
  would look like a no-op because the freeze is suppressed at that width.
- No layout change.

### 2.9 `styles.css` — the divider

- New rule for `.tablify__cell--frozen-edge` (tokens only): a 1px right border in
  `--tablify-border-subtle` plus a soft 8px horizontal shadow into the scroll area, drawn on the
  cell's `::after` so it does not fight the existing frozen mask.
- No change to `--tablify-bg-inner` masking, capsule radius or row spacing.

### 2.10 Primary lock — how it is enforced

| Surface | Behaviour |
|---|---|
| Header drag | Primary has no grip, so a drag cannot start from it. |
| Drop onto the primary | Other columns land **after** it (the normaliser keeps it at index 0). |
| Keyboard reorder / any API path | `validateView` re-normalises, so the primary can never end up at index > 0. |
| Hide | Unchanged — the primary still cannot be hidden (R-D13). |
| Existing views with the primary elsewhere | Open with it first again. |

---

## 3. Behaviour after the change

| Situation | Before | After |
|---|---|---|
| Default desktop view | primary frozen | **primary frozen, identical geometry** |
| Header ⋮ on any column | “Freeze column” (enabled/disabled by count) | **no freeze item at all** |
| Freeze primary *and* another column | possible (count 4) | **not possible** |
| Primary unfrozen, freeze Col 5 | freeze silently re-pins primary + Col 1-4 | **not possible** |
| Unfreeze | only Options (all-or-nothing) | **Options switch toggles the primary** |
| 4 columns frozen in a file | 4 pinned, possibly occluding | **primary pinned only** |
| Window ≤ 639px | `fixed` kept everything pinned | **nothing pinned, switch disabled** |
| Drag the primary away | allowed, freeze then pinned the wrong column | **locked first; no grip** |
| Frozen boundary while scrolling | clipped capsule, no cue | **1px divider + soft edge shadow** |

---

## 4. Tests and verification

### Unit / model
- `tests/model/view.test.ts` — clamp `≥2 → 1` with warning; `0`/`1` unchanged; primary forced first,
  warning only when it moved.
- `tests/model/freezeMode.test.ts` — **rewritten**: effective count at 639 / 640 / 390 / 1024 for
  both flag values; the mode distinction is gone.
- `tests/views/grid/columns.test.ts` — `setFrozenColumns` 0/1, clamp 5 → 1; reorder tests that moved
  the primary updated to use a normal column.
- `tests/views/grid/frozenColumns.test.ts` — one pinned column only; edge class present on exactly
  the primary slot and cleared on unfreeze; frozenColumns 99 → 1; ≤ 639px paints none.
- `tests/menus/tableMenuModel.test.ts` — **no** freeze entry for any column/state (counts 0, 1, 4).
- `tests/views/grid/headerCapsule.test.ts` — no grip on the primary; drop onto the primary lands
  after it.
- `tests/views/toolbar.test.ts` — switch reflects effective state and is disabled/reasoned at ≤639.
- `tests/views/tableView.test.ts` — Options toggle writes 0/1; header action removed.
- Format tests — `freezeMode` in an old file is dropped; `frozenColumns: 4` loads as 1 with a
  warning; round-trip stays clean.

### Browser (harness)
Both issue scenarios end-to-end plus: scrolled state, ≤639px, primary drag attempt, and a fresh
screenshot set in `/home/user/repro/cod72-after-*.png`.

### Regression gate
`npm run check` (lint + 1770 tests + docs + build), `npm run test:fields` (100 checks), the audit
script — all must be green before the commit.

---

## 5. Delivery

1. One implementation commit + one docs commit (CHANGELOG under Unreleased/Fixed, user guide section
   “Freezing the primary column”, FORMAT_SPEC update).
2. Push to GitHub.
3. Linear: comment with the before/after evidence + screenshots; state → **In review** (never Done).

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Removing `freezeMode` touches the format | It is optional and views allow extra keys; old files load, the key is dropped on next save; no `formatVersion` change. |
| Existing tests encode the old behaviour (dragging the primary, multi-column freeze) | They are rewritten deliberately, not deleted blindly; the diff will show each change. |
| A user who relied on multi-column freeze loses it | Explicitly requested; the accepted trade for a coherent primary-only model. |
| The divider might read as a table border in the default light theme | Kept to `--tablify-border-subtle` at 1px + a very soft shadow; checked in both themes with screenshots. |
| Primary lock changes column reordering for existing views | Approved (“Airtable rule”); the normaliser reports it once with a warning. |

---

## 7. Out of scope (unchanged)

Column widths / resize, sort, group, hide, selection, editing, export, import, sync, the `#` gutter,
the sticky header, row virtualisation. Freezing arbitrary columns or offering “unfreeze” in the
header menu is **not** part of this issue.
