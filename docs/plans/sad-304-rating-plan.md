# SAD-304 — An interactive, star-based rating

**Issue:** [SAD-304](https://linear.app/sad-mod/issue/SAD-304/rating) (Feature + Improvement, P2)
**Project:** Tablify · **Branch:** `main` at `8820c97` · **Plan written:** 2026-10-19
**Mode:** plan only. Nothing below is implemented yet; the only change in the tree is this file.

---

## 0. TL;DR — what ships

| Concern | Decision |
|---|---|
| Value | A rating is still a number in the cell. The type accepts **0…10 with up to two decimals**; a field's **Max** (default 5) is the stars drawn and the largest value the UI will choose. |
| Storage | Unchanged type (`number`), so **no `formatVersion` bump** and old files read exactly as before. `null` = no rating, `0` = zero stars. |
| Cell | One star per point of the scale, **partially filled** for fractions (`starFills()`), then the number (`4.5`). No more `4/5`. |
| Cell: click | Clicking star *k* writes *k* — one undo step, like the checkbox. Hover fills up to the star under the pointer. |
| Cell: keyboard | Unchanged: **Enter** (or double-click) opens the editor, which is now a panel. |
| Panel | New anchored card: big stars (click or drag, half-star steps), a numeric field for any value (`3.7`), **Clear**, **Done**. Arrow keys, Page keys, Home/End, Delete, digits; `role="slider"` with `aria-valuetext`. |
| Editing rule | Draft inside the panel; **one** `setValue` on Done. Opening and dismissing a cell still writes nothing. |
| Airtable | **Push rounds to whole stars** (Airtable ratings are integers) and the sync message says how many ratings were rounded. The file keeps the fraction. |
| Dependencies | **None added.** |

Four questions were answered by the owner: keep the field's Max as the scale; cell clicks plus a panel; half-star zones plus a numeric field; round on push with a user-visible message.

---

## 1. The issue and the decisions

### 1.1 What the ticket asks

1. **Visual** — stars instead of a bare number, the value beside them, filled up to the value, fractions shown with a partially filled star, 0–5 with `1.5`, `2.5`, `3.7`, `4.5` supported.
2. **Interactive** — click a star to rate; map a star's position to its value; fractions if the model allows, whole stars otherwise; hover, focus, selected and disabled states; keyboard and screen-reader support; desktop and touch.
3. **Data** — keep the numeric value in the existing model, validate 0–5, persist through the existing storage path.
4. **Implementation** — inspect the existing component first, reuse the architecture, add no unnecessary dependencies, keep every existing feature, add tests for whole ratings, decimals, selection, persistence and boundaries.

### 1.2 Owner decisions (2026-10-19)

| # | Question | Answer |
|---|---|---|
| 1 | Range | **Keep the field's Max** as the scale (default 5; the type accepts 0–10 so 10-star fields and their data keep working). |
| 2 | Where stars live | **Cell clicks + panel** — a click in the cell sets a whole star immediately; double-click / Enter opens a panel for halves, exact values and keyboard use. |
| 3 | Fractions | **Half-star zones + a numeric field** — the left half of a star is `x.5`, the right half is `x`; the numeric field takes any decimal (rounded to 2 dp). |
| 4 | Airtable | **Round to the nearest star on push, with a user message** (not a refusal, not a raw 422). |

### 1.3 Explicitly out of scope

- No new field type, no schema/format change, no Airtable rating-style options (icon, colour).
- No averaging/rollup column, no rating inside formulas beyond the existing numeric behaviour.
- `convertCell()` (import into an existing rating column) keeps its current behaviour — a separate gap.
- No new dependency (the stars are the Font Awesome glyph already in `faIcons.ts`).

---

## 2. What the code does today (verified)

| Fact | Where |
|---|---|
| `rating` validates **integers 1–10** only; `null` allowed | `src/model/fieldTypes/number.ts:166-173` |
| `parse()` uses `parseInt`, so `4.5` silently becomes `4`; clamps to 1…10 | `src/model/fieldTypes/number.ts:175-181` |
| `format()` returns `String(value)` — used by copy, export, grouping, sort fallback | `src/model/fieldTypes/number.ts:183-186` |
| The cell draws `scale` stars, all-or-nothing (`--on`), then `value/scale` (`4/5`) | `src/views/grid/cellRender.ts:188-224` |
| `ratingScale()` = `max` (default 5), rounded, clamped 1…10 | `src/views/grid/cellRender.ts:192-195` |
| The grid calls the renderer with no interaction | `src/views/grid/GridView.ts:1375-1377` |
| Rating edits today go through a **plain text editor** | `src/views/grid/editors/index.ts:86-103` |
| Panels open from `startEdit` via `openCellPanel`; phone is the newest member | `src/views/tableView.ts:1222-1230, 1270, 1311` |
| A cell click selects and then calls `onCellClick`; touch may open the editor | `src/views/grid/GridView.ts:358-385` |
| Group headings print `key/max` | `src/views/grid/grouping.ts:72-75` |
| Query parsing for rating uses `parseInt` (the differential reference uses `Number`) | `src/query/evaluate.ts:96-100`, `tests/query/reference.ts:68-71` |
| Airtable writes pass numbers through unchanged | `src/sync/values.ts:91-106` |
| A push records the hash of the **server's echo**, not of the local row | `src/sync/push.ts:99-118` |
| Sync messages are `report.summary` plus failures/conflicts | `src/views/sync/SyncModal.ts:191-202` |

### 2.1 Tests that pin today's behaviour (and will be updated, deliberately)

| Test | What it pins |
|---|---|
| `tests/model/fieldTypes.test.ts:217-234` | `validate(0) === false`, `validate(11) === false`, `parse('15') === 10`, `parse('-1') === 1` |
| `tests/views/grid/cellFormatting.test.ts:336-376` | five stars, four `--on`, label `4/5`; empty draws the scale with no label; Max 10 → ten stars and `7/10`; value 9 fills five; label is not the bare number |
| `tests/e2e/fieldTypes.browser.ts:220` | rating opens an **editor** and typing `7` stores 7 |
| `tests/e2e/fieldTypes.browser.ts:529-541` | five filled stars and the label `7/5` |

### 2.2 Baseline (measured on this clone)

- `npx vitest run` — **128 files / 2,067 tests**, all passing.
- `npm run lint` — **0 errors, 119 warnings**.
- `npm run build` — `main.js` **1,141,928 B**, `styles.css` **326,115 B**; `gzip -c main.js` **259,148 B**.
- `npm run check:docs` / `check:icons` — pass.

---

## 3. Design

### 3.1 The value model

| Rule | Before | After |
|---|---|---|
| `validate` | integer 1…10, or `null` | finite number **0…10**, or `null` |
| `parse('4.5')` | `4` | `4.5` |
| `parse(' 3,7 ')` | `3` | `3.7` (comma accepted as a decimal mark) |
| `parse('15')` / `parse('-1')` | `10` / `1` | `10` / `0` |
| `parse('abc')` | `null` | `null` |
| Rounding | none | **2 decimal places** (`Math.round(v * 100) / 100`) |
| `format(4.5)` | `"4.5"` | unchanged |

Why 0…10 in the type rather than 0…5: `Max` can legitimately be 10 today, and `validate` must not turn existing 6–10 values red. The **per-field** range [0, Max] is enforced where values are chosen (panel, cell click); `validateCell()`'s existing `min`/`max` rules still run on top, unchanged.

`null` and `0` stay distinct: `null` renders no filled stars and no number, `0` renders the scale and the number `0`. `Clear` writes `null`.

### 3.2 The cell

```
4       → ★★★★☆ 4
4.5     → ★★★★◐ 4.5        (the fifth star is half filled)
3.7     → ★★★▊☆ 3.7        (70 % of the fourth star)
7 of 5  → ★★★★★ 7          (out-of-scale data is preserved, as today)
null    → ☆☆☆☆☆            (no number, em dash rules unchanged)
```

- Each star is a **box** with two stacked copies of the same glyph: the base in `--tablify-text-placeholder`, and a fill in `--tablify-accent-primary` clipped to `width: <fraction>%`. One glyph, no half-star asset, and every fraction works.
- `starFills(value, scale)` returns `scale` fractions in `[0, 1]`: `clamp(value - i, 0, 1)`.
- Classes: `--on` stays for a full star (so existing selectors and tests keep their meaning), `--partial` marks `0 < fill < 1`.
- The label is the number from `format(value)`; the scale moves to `title="4.5 out of 5"` on the cell and to the panel's caption. **Say if you would rather keep `4.5/5`.**
- Stars stay `aria-hidden`; the number remains the accessible text, as today.

### 3.3 Clicking a star (cell)

- Stars are rendered with `data-rating-star="k"` **only when the field is writable**.
- `GridView`'s existing delegated click handler gets one branch **before** the generic cell path:

  ```
  star = target.closest('[data-rating-star]')
  if (star && onRate) { setSelection(row, col); onRate(row, col, Number(star.dataset.ratingStar)); return; }
  ```

  This is deliberately *not* a listener on the star: the event must still reach the grid so long-press suppression and focus behave exactly as they do for every other click, and returning early means a star click never opens the editor on touch.
- The write itself is `tableView.rateAt(row, col, value)`:
  `isReadOnly(field)` → return; value unchanged → **return (no undo step)**; else `session.setValue(rowId, fieldId, value)` + `afterChange()` — the same path the checkbox uses (`src/views/tableView.ts:835-842`).
- Hover: the interactive star row is laid out `row-reverse`, so a pure-CSS `:hover` + `~` rule tints the hovered star and every star before it — a preview of the value a click will write. No JavaScript hover state.
- Hit area: `padding: 4px 1.5px; margin: -4px -1.5px` on each star (≈14 × 19 px) without moving the glyphs. The panel is the touch-first path; the cell remains a fast mouse affordance.
- Read-only (`airtable.readOnly`, i.e. a rating above 10) renders plain stars, no `data-rating-star`, no hover rule, `cursor: default`.

### 3.4 The panel

```
┌─ Rating: Quality ──────────────────┐
│  ★ ★ ★ ★ ◐                          │  ← scale stars, 20 px, click/drag, half steps
│  4.5 out of 5                       │  ← caption, aria-live="polite"
│  [ 4.5 ] / 5                        │  ← numeric field, inputmode="decimal"
│  Enter a number from 0 to 5.        │  ← hint, only when invalid
│  Clear                      Done    │
└─────────────────────────────────────┘
```

- Same card, anchoring and dismissal as the phone panel: `createPanelCard('tablify-rating-panel', theme, 'tablify__dropdown-body')`, `anchorPanel`, document `mousedown`/`touchstart` outside → cancel, `Escape` → cancel, focus the slider on open (`src/views/grid/phone/PhonePanel.ts:189-235` is the template).
- **Draft**: the panel never writes. `Done` calls `onCommit(draft)`; the host compares with the stored value and calls `setValue` only when it differs, then `afterChange()`. `Clear` sets the draft to `null` (and still needs Done). Opening and pressing Escape writes nothing — the COD-68 rule.
- **Stars**: one `div` with `role="slider"`, `tabindex="0"`, `aria-label="Rating for <field>"`, `aria-valuemin="0"`, `aria-valuemax="<scale>"`, `aria-valuenow`, `aria-valuetext="4.5 out of 5 stars"`. Pointer position maps to `ceil(x / width * scale * 2) / 2`, clamped to `0.5…scale`; dragging updates live.
- **Keyboard** (on the slider): `←`/`↓` −0.5, `→`/`↑` +0.5, `PageDown` −1, `PageUp` +1, `Home` 0, `End` scale, `Delete`/`Backspace` clear, a digit sets that value, `Enter` commits.
- **Numeric field**: `inputmode="decimal"`, accepts `.` or `,`; empty means no rating; values clamp to `0…scale`; invalid text (`abc`, `6` in a 5-scale field) shows the hint, sets `aria-invalid="true"` and disables Done. The field and the stars share one draft, so they never drift.
- **States**: hover on a star previews the fill up to the pointer; the focus ring is on the slider (`:focus-visible`); a disabled Done is visibly disabled; `Clear` is disabled when the draft is already `null`.
- **Scale**: from the field's `Max` (5 when unset, 1…10). A field with Max 10 gets ten stars and half-star zones at 0.5 steps.

### 3.5 Accessibility summary

| Requirement | Where |
|---|---|
| Keyboard navigation | Panel slider (arrows, page keys, Home/End, digits, Delete) and the numeric field |
| Screen readers | Slider role + `aria-valuemin/max/now/valuetext`; live caption; the cell's accessible text stays the number |
| Focus states | `:focus-visible` outline on the slider; native focus on the input and both buttons |
| Touch | Panel stars are 28 px targets; cell stars are padded; a cell tap never opens the editor by accident |
| Disabled | Read-only fields have no interactive stars and no panel; Done is disabled while the draft is invalid |

The one deliberate limit: the stars **inside the cell** are pointer-only (`aria-hidden`, not in the tab order). Keyboard and screen-reader users get the same capability through the panel — one Enter away, and documented in the guide.

### 3.6 Airtable — whole stars, and a message

- `localToRemote()` rounds rating numbers: `Math.round(v)`; anything that is not a finite number is passed through exactly as today (corrupt data is not "repaired" silently).
- `pushToAirtable()` counts the fractional cells it is about to send (a pure `fractionalRatingCount(fields, row)` in `values.ts`, called where creates/updates are queued) and adds them to a new `report.roundedRatings`.
- `summarize()` appends `N rating(s) rounded for Airtable`; `SyncModal.afterReport` already shows `report.summary`, and `finishRun` stores it in `lastSync.summary`, so the message is visible **and** survives in the file.
- The file keeps `4.5`. Airtable stores `5`. The remote hash is computed from the server's echo (`push.ts:102`), so the next sync does not see a phantom change and does not loop.
- No refusal path and no local rewrite — exactly the option the owner chose.

### 3.7 What stays exactly as it is

- Storage type and `formatVersion`; `format()`; copy, export, search, sort and grouping (they read numbers).
- Group headings keep `4.5/5`.
- The field picker, Add/Modify Field (Max still 1…10), validation rules, formulas, CSV/XLSX round-trips.
- Every panel, editor and menu not named here.

---

## 4. File-by-file plan (four commits)

### Commit 1 — the value and the stars

`SAD-304: a rating holds any value in its range, and its stars fill by fractions`

| File | Change |
|---|---|
| `src/model/fieldTypes/number.ts` | rating `validate` (0…10, finite), `parse` (Number, comma, clamp, 2 dp) |
| `src/views/grid/rating/scale.ts` *(new)* | `starFills(value, scale)`, `ratingFromPosition(x, width, scale, step)`, `parseRatingInput(text, scale)`, `ratingValueText(value, scale)` — pure, no DOM |
| `src/views/grid/cellRender.ts` | `renderRatingStars(host, field, value, options?)` draws the two-layer stars and the number; keeps `ratingScale`; read-only-safe; renders `data-rating-star` only when asked to |
| `src/query/evaluate.ts:96` | rating filter terms read decimals (`Number`, matching `tests/query/reference.ts`) |
| `styles.css` | star box, fill clip, `--partial` (hover and hit padding arrive with commit 2) |
| `FORMAT_SPEC.md:141` | `rating` row: "number 0–10, up to two decimals" (no formatVersion change) |
| `docs/plans/sad-304-rating-plan.md` | this file |

### Commit 2 — clicking and the panel

`SAD-304: click a star to rate, and a panel for halves and exact values`

| File | Change |
|---|---|
| `src/views/grid/rating/RatingPanel.ts` *(new)* | the card described in §3.4 |
| `src/views/grid/GridView.ts` | `onRate?: (row, col, value) => void` and `canRate?: (field) => boolean` options; the `[data-rating-star]` branch in the click handler |
| `src/views/tableView.ts` | `rating` joins the panel list at `:1222`; a rating branch in `openCellPanel`; `rateAt()`; `canRate: (f) => !isReadOnly(f)`; `onRate` |
| `src/views/grid/editors/index.ts` | `if (field.type === 'rating') return null;` (no second editing surface) |
| `styles.css` | panel layout, slider, caption, input, hint, actions |
| `tests/e2e/fieldTypes.browser.ts` | rating becomes `expect: 'panel'`; the display checks read the new label |

### Commit 3 — Airtable

`SAD-304: Airtable gets whole stars, and the sync message says so`

| File | Change |
|---|---|
| `src/sync/values.ts` | round ratings in `localToRemote`; add `fractionalRatingCount()` |
| `src/sync/engineTypes.ts` | `SyncReport.roundedRatings` (default 0); `summarize()` mentions it |
| `src/sync/push.ts` | count while planning creates and updates |

### Commit 4 — the written record

`SAD-304: the guide, the changelog and the evidence`

| File | Change |
|---|---|
| `docs/user-guide.md` | cell-display bullet, new **§4c Rating a row**, contents entry, §13 note that export keeps the number |
| `CHANGELOG.md` | Added: interactive stars, a panel, decimals. Changed: the cell reads `4.5` not `4/5`; Airtable rounds with a message |
| `docs/evidence/SAD-304.md` *(new)* | commits, gates, bundle delta, the manual checks below |
| `docs/plans/sad-304-rating-plan.md` | status → implemented |

Every commit: gates → `git push` → a Linear comment. SAD-303's `main` is the base; no other branch.

---

## 5. Test plan

### 5.1 New files

| File | What it proves |
|---|---|
| `tests/views/grid/ratingScale.test.ts` | `starFills`: 0, 0.5, 1, 3.7, 4.5, 5, 7-of-5, null; `ratingFromPosition` at 0 %, 49 %, 51 %, 100 %; `parseRatingInput`: `''`, `'4'`, `'4.5'`, `'3,7'`, `'abc'`, `'6'` on a 5-scale, `' 2.25 '`; `ratingValueText` |
| `tests/views/grid/ratingPanel.test.ts` | opens and dismisses without writing; stars → draft; half-star pointer zones; typed 3.7 → 3.7; typed 3.666 → 3.67; invalid text disables Done; Clear → `null`; Done → one commit; Escape → cancel; keyboard table; ARIA values; scale 10; clamping |
| `tests/views/grid/ratingPanelHost.test.ts` | Enter on a rating cell opens the panel; Done writes through `setValue` (one undo step, undone by `undo()`); Escape writes nothing; a read-only rating opens no panel; a star click in the grid writes the whole value and does not open an editor |

### 5.2 Updated files

| File | Change |
|---|---|
| `tests/model/fieldTypes.test.ts` | `validate(0)`, `validate(4.5)`, `validate(10.5)` false; `parse('4.5')`, `parse('3,7')`, `parse('15')` → 10, `parse('-1')` → 0, 2-dp rounding |
| `tests/views/grid/cellFormatting.test.ts` | label `4` instead of `4/5`; `4.5` → 4 full + 1 partial + `4.5`; `7` of 5 → five full + `7`; empty unchanged; Max 10 → ten stars + `7`; the "not the bare number" assertion goes (the number *is* the label now) |
| `tests/e2e/fieldTypes.browser.ts` | `EDIT_CASES` rating → `panel`; display checks: five stars, all filled, label `7`; add "click the 4th star stores 4" |
| `tests/query/*` | one rating filter case with `4.5` once `evaluate.ts` reads decimals |
| `tests/sync/engine.test.ts` | a linked row with `4.5` → payload `5`, `report.roundedRatings === 1`, summary mentions "rounded", local value still `4.5`, a second push sends nothing |

### 5.3 Regression matrix

| Feature | Proof it did not move |
|---|---|
| Copy / export | copy and CSV/XLSX still carry the raw number (`4.5`) — existing export tests plus one decimal case |
| Sort / group / filter | numeric order; headings `4.5/5`; filters compare numbers |
| Undo | one star click = one undo step; one panel Done = one step; dismiss = none |
| Airtable pull | integers land as before; a pulled 5 into a 4.5 row does not rewrite the file (hash from the echo) |
| Other field types | untouched files; the full suite |

---

## 6. Gates and acceptance criteria

Run after every commit: `npx vitest run`, `npm run lint`, `npm run build` (compare `main.js`, `styles.css`, `gzip -c main.js` with §2.2), `npm run check:docs`, `npm run check:icons`, `node scripts/gen-fixtures.mjs --check`. Before In Review also the three sample files round-trip byte-identically.

| Issue requirement | Where it is met |
|---|---|
| Stars + the number, filled to the value | §3.2, `cellFormatting` tests |
| 0–5 including 1.5 / 2.5 / 3.7 / 4.5, partial stars | §3.1–3.2, `ratingScale` tests |
| Click a star to submit; position → value | §3.3, `ratingPanelHost` test |
| Fractions if the model allows | §3.1 (the model allows them), panel halves + input |
| Hover / focus / selected / disabled | §3.3–3.4, CSS + panel tests |
| Keyboard + screen readers | §3.5 |
| Desktop + touch | cell stars (mouse), panel stars 28 px (touch) |
| Numeric value preserved, 0–5 validated, existing storage | §3.1, §3.4; `setValue` + command stack |
| Tests for whole, decimal, selection, persistence, boundaries | §5 |
| No regressions, no new dependency | §5.3, §6 |

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The label change (`4/5` → `4.5`) is the most visible change | Documented as intentional; the scale moves to the tooltip, the panel and the group headings. One line to restore `x/y` if the owner prefers it. |
| Read-only fields must not look editable | `canRate` from `isReadOnly`; no `data-rating-star`; test. |
| A star click fighting cell selection / touch editing | Handled inside the grid's click handler, which returns before `onCellClick` (§3.3). |
| 11 px stars are small on touch | Padded hit areas; the panel is the primary touch path and is documented as such. |
| Airtable rounding hides a difference | The file keeps the fraction, the sync message counts the roundings, and the echo-hash means no re-push loop. |
| `validate(0)` and decimal parsing loosen an invariant | Both are additive for existing data (1…10 integers stay valid); tests pin the new edges. |
| `evaluate.ts` switching to `Number` changes filter errors for junk text | One query test with a decimal and one with junk; the differential harness compares against `reference.ts`, which already uses `Number`. |
| Playwright is not available here | The E2E matrix is updated and the device checklist in the evidence doc covers it, exactly as SAD-303 did. |

---

## 8. Decisions taken (say the word to change any)

1. The cell label is the **number** (`4.5`), not `4.5/5` — the issue's own examples.
2. Clicking the star that is already the value is a **no-op** (no undo step); clearing is an explicit **Clear**.
3. `0` is a real value; **empty is `null`** and shows no number.
4. The panel clamps choices to `0…Max`; a larger value already in the file is preserved unless the user edits it.
5. Rounding happens on **push only**; the file keeps `4.5`.

---

## Appendix A — public API sketch

```ts
// src/views/grid/rating/scale.ts
export function starFills(value: CellValue | undefined, scale: number): number[];
export function ratingFromPosition(x: number, width: number, scale: number, step: 0.5 | 1): number;
export function parseRatingInput(text: string, scale: number): { ok: true; value: number | null } | { ok: false; error: string };
export function ratingValueText(value: number | null, scale: number): string; // "4.5 out of 5 stars"

// src/views/grid/rating/RatingPanel.ts
export interface RatingPanelOptions {
  field: FieldDefinition;
  value: CellValue | undefined;
  theme?: 'light' | 'dark';
  onCommit: (value: CellValue) => void;
  onCancel?: () => void;
}
export class RatingPanel {
  constructor(options: RatingPanelOptions);
  get element(): HTMLElement;
  open(anchor: HTMLElement): void;
  close(): void;
}

// src/views/grid/cellRender.ts
export interface RatingStarsOptions { interactive?: boolean }
export function renderRatingStars(host: HTMLElement, field: FieldDefinition, value: CellValue | undefined, options?: RatingStarsOptions): void;

// src/sync/values.ts
export function fractionalRatingCount(fields: readonly FieldDefinition[], row: Pick<Row, 'values'>): number;
```

## Appendix B — class names and selectors

`tablify__rating-panel`, `[data-testid="tablify-rating-panel"]`, `tablify__rating-stars`, `tablify__rating-caption`, `tablify__rating-row`, `tablify__rating-input`, `tablify__rating-hint`, `tablify__rating-actions`, `tablify__rating-clear`, `tablify__rating-done`, `tablify__star` / `--on` / `--partial`, `tablify__star-box`, `tablify__star-fill`, `tablify__stars--interactive`, `[data-rating-star]` (cell), `[data-draft-value]` (panel, for tests).

## Appendix C — manual checks (recorded in `docs/evidence/SAD-304.md`)

1. A 5-star field in a light theme and in a dark theme: partial star is visible and the number matches.
2. A 10-star field: ten stars, half steps still work.
3. Mouse: click star 4 → 4; click again → no undo step; Ctrl+Z once returns the previous value.
4. Touch (phone width): tap a star; long-press still opens the context menu; the panel's stars are comfortably tappable.
5. Keyboard only: Enter on a cell, arrows through halves, type `3.7`, Enter; Escape from a fresh panel writes nothing.
6. Screen reader announces "4.5 out of 5 stars" on the slider.
7. A linked Airtable table: push a row holding 4.5 → Airtable shows 5, the modal says one rating was rounded, a second push sends nothing.
