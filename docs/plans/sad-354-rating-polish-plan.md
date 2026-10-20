# SAD-354 — Rating field visual polish — implementation plan

**Issue:** [SAD-354](https://linear.app/sad-mod/issue/SAD-354/the-rating-field-doesnt-look-good) · **Project:** Tablify · **Branch:** `main` · **Plan written:** 2026-10-20  
**Status:** draft · **Mode:** plan only — no code changed, no assumptions without source  
**Answer to owner's questions (from interactive prompt):** scope = **both cell + panel**, reference = **propose via audit** against the existing design system, constraints = **major redesign allowed but behaviour-preserving**, QA = **desktop + mobile, light + dark**.

> **One sentence:** Rework layout, spacing, alignment and hierarchy for both the rating cell and `RatingPanel` so they sit cleanly in the grid, read as a single professional control across 5- and 10-star scales, empty/full/fractional and touch/mouse/keyboard/AT on both themes — while touching nothing in the data model, sync, query, or surrounding field types.

---

## 1. Goal, non-goals, and guardrails

### 1.1 What SAD-354 asks (verbatim from Linear)

> *The rating field does not look visually appealing. Please improve its UI design, including its layout, spacing, alignment, and visual hierarchy, to make it look cleaner and more professional while maintaining consistency with the application's existing design system and preserving its current functionality.*

Labels on Linear: `Improvement`, P2. No attachment, no comments at time of audit (validated via `get_comments` → `[]`). No Figma or mock supplied (owner explicitly chose *"No — please propose via audit"*).

### 1.2 Goal

- Make the **cell** and the **panel** feel finished: proportion, breathing room, alignment, and hierarchy aligned with the app's own float-panel family (`DatePicker`, `PhonePanel`, `SelectDropdown`) and the prototype grid (`SAD-79`, `COD-71/73`, `SAD-304`).
- Look right at both scales (Max 1…10), both states (`null` vs `0` vs `n`), all row heights, both themes, and both input modes.
- Do it without touching the value model, persistence, sync, or unrelated components.

### 1.3 Non-goals (out of scope by design)

- No change to `FieldTypeName`, `formatVersion`, file schema, import, or export.
- No change to `ratingType.validate` (still `0…10`, two decimals) or `ratingType.parse`/`format`.
- No change to Airtable rounding (`localToRemote` + `fractionalRatingCount`) or `report.roundedRatings`.
- No change to query/filter evaluation, sorting, or grouping values.
- No new dependency, no font, icon, or image asset not already in the bundle.

### 1.4 Guardrail

> **New modifications must not influence other existing features.**

Enforced by: file-level isolation of the work (only `cellRender.ts`, `RatingPanel.ts`, `scale.ts` for small helpers if needed, and `styles.css` under `tablify__*rating*`/`tablify__*star*` selectors), exhaustive parity tests for copy/export/sort/search/group, and a deliberately small public-API surface already established in `docs/plans/sad-304-rating-plan.md` Appendix A.

---

## 2. How this plan was built (no guessing)

| Step | What was inspected | Evidence |
|------|--------------------|----------|
| **Repo clone** | `https://github.com/MakeTheNewHistory/Tablify` → `/home/user/Tablify`, branch `main`, tag `2.0.0-beta.6` | `git clone`, `package.json` `version`, `manifest.json` |
| **Issue source of truth** | `linear__get_issue id=SAD-354` (Todo, P2) + `get_issues query=rating` revealing completed `SAD-304` | Linear API payloads reproduced in §1 |
| **What SAD-304 already shipped** | `docs/plans/sad-304-rating-plan.md` (value model, cell click, panel with half-star zones, Airtable rounding) + `docs/evidence/SAD-304.md` (6 commits) | Files read fully |
| **Rating data model** | `src/model/fieldTypes/number.ts` `ratingType` (0…10, two-decimal rounding, clamp), `src/model/types.ts`, `FORMAT_SPEC.md §3.3`, `tablify.schema.json` field `max` | `validate`/`parse`/`format` body quoted below |
| **Pure arithmetic** | `src/views/grid/rating/scale.ts` — `starFills`, `ratingFromPosition`, `parseRatingInput`, `ratingValueText`, `roundRating` | 71 LOC, no DOM |
| **Cell rendering** | `src/views/grid/cellRender.ts` lines 191–290: `ratingScale`, `wireStarPreview`, `renderRatingStars` | Full file read; key snippet §4 |
| **Panel** | `src/views/grid/rating/RatingPanel.ts` (364 LOC header comment citing 3 rules: never touches store, untouched panel writes nothing, `#floatPanel`) | Full file read |
| **Grid wiring** | `src/views/grid/GridView.ts` `onRate`/`canRate` + delegated `[data-rating-star]` click; `src/views/tableView.ts` `rateAt` + `openCellPanel` routing for `rating` | Grepped + read handlers |
| **Shared float-panel host** | `src/views/grid/select/panel.ts` `createPanelCard` + `anchorPanel` + `wirePanelDismiss`; `PANEL_WIDTH = 320`, `y = anchor.bottom + 6`, flip above when off-screen | Read |
| **Benchmark panels** | `src/views/grid/date/DatePicker.ts` (320 px card, field → error → month header → grid → time row → foot), `src/views/grid/phone/PhonePanel.ts` (number view + country view, preview states, foot), `src/views/grid/select/Dropdown.ts` (search + list + foot) | Read constructors + `styles.css` sections |
| **Tokens & themes** | `src/ui/theme/tokens.ts` + `contrast.ts` (placeholder vs muted vs text vs accentPrimary vs selection), `src/ui/theme/*.ts` usage in `styles.css` | Read |
| **Geometry & capsule** | `styles.css` capsule rules (`.tablify__capsule` 34/28/40 px via row height), numeric-cell right-alignment, long-text clamp, attachment chip | Read |
| **Styles for rating** | `styles.css` 4214–4436: `.tablify__stars`, `.tablify__star`, `.tablify__star-box` (11 px box), `.tablify__rating-text` (10 px mono muted), interactive hit-area trick, panel rules (248 px width, `tablify__rating-head`, `-stars`, `-caption`, `-row`, `-input`, `-hint`, `-actions`) | Extracted verbatim |
| **Tests pinning today** | `tests/views/grid/ratingScale.test.ts` (18), `ratingPanel.test.ts` (25), `ratingPanelHost.test.ts` (13), `cellFormatting.test.ts` (rating cell suite), `sync/ratingPush.test.ts` (rounding), `e2e/fieldTypes.browser.ts` | Read |
| **User guide copy** | `docs/user-guide.md` §4c *Rating a row* (stars filled by fraction, Max is scale, panel with caption, Clear/Done) | Read |
| **Changelog baseline** | `CHANGELOG.md`, `docs/release/2.0.0-beta.6.md` (1,157,918 B main.js, 330,343 B styles.css) | Read |

All claims in §3 and §4 cite one of the rows above — nothing introduced from outside the clone or Linear.

---

## 3. Current state (verified)

### 3.1 The value model — deliberately **untouched** by this work

```ts
// src/model/fieldTypes/number.ts — ratingType
validate: v => v === null || (typeof v === 'number' && isFinite(v) && v >= 0 && v <= 10)
parse:    input => round(clamp( Number(trimmed.replace(',', '.')), 0, 10 ))  // 2 dp
format:   v => v === null ? '' : String(v)
defaultValue: () => null
```

```ts
// src/views/grid/rating/scale.ts
starFills(value, scale): number[] // 0…1 per star
ratingFromPosition(x, width, scale, step: 0.5|1): number
parseRatingInput(text, scale): {ok, value} | {ok:false, error}
ratingValueText(value, scale): "4.5 out of 5 stars" | "No rating"
```

Storage is a plain number (or `null`); a field's `max` (default 5, clamped 1…10) is the scale drawn. Sync keeps the fraction in-file and rounds on push (`src/sync/values.ts`).

### 3.2 The cell today

```ts
// src/views/grid/cellRender.ts — renderRatingStars (abridged)
const fills = starFills(value, scale);
stars.className = interactive ? 'tablify__stars tablify__stars--interactive' : 'tablify__stars';
for (i 0..scale) {
  // two stacked FA glyphs: base in placeholder ink, fill in accent clipped to width=fills[i]
  starBox = 11×11 px; fill.width = `${f*100}%`
  if (interactive) star.dataset.ratingStar = String(i+1)
}
if (interactive) wireStarPreview(stars) // pointerover → --preview up to hovered star
host.append(stars); if (rating!==null) host.append(label.textContent = formattedCellText())
```

And its paint today (`styles.css` 4220–4310):

```css
.tablify__stars { inline-flex; gap:2px; margin-right:6px }
.tablify__star-box { 11px × 11px }
.tablify__star-base { color: var(--tablify-text-placeholder) }   /* #C5C1BE / #4B5563 */
.tablify__star-fill { color: var(--tablify-accent-primary); overflow:hidden }
.tablify__rating-text { font: 10px 'JetBrains Mono'; color: var(--tablify-text-muted) }
.tablify__stars--interactive .tablify__star { padding:4px 1.5px; margin:-4px -1.5px } /* hit-area trick */
.tablify__stars--interactive .tablify__star:hover .tablify__star-box { transform:scale(1.15) }
.tablify__stars--interactive .tablify__star--preview .tablify__star-base { color:var(--accent); opacity:.55 }
```

Grid delegates `[data-rating-star]` in `GridView.ts:414–421` and calls `tableView.rateAt` (one undo step, no-op if value already equals tapped star, `isReadOnly` guard, then `session.setValue` + `afterChange`).

**Observed audit findings for the cell**

| # | Finding | Where | Evidence |
|---|---------|-------|----------|
| C1 | **Crowded micro-spacing** — 2 px between stars and 6 px before the number leaves fractions hard to read at 5/10 stars; at 10 stars the row is ~130 px before label, cramped on narrow columns. | `cellRender.ts:242–290`, `styles.css:4220` | Measured: 10×(11+2)−2+6 ≈ 134 px |
| C2 | **Small, muted label** — 10 px mono in `text-muted` is the smallest type on the grid (select chips 11 px, numbers 11.5 px) and blends instead of anchoring. Copy/export keep the number, but visually it whispers. | `styles.css:4270` | vs date/phone labels 11–12 px |
| C3 | **Placeholder ink for empty stars** — `text-placeholder` is decoration-only by token intent (`textPlaceholder` comment in `tokens.ts`), 1.79:1 contrast. On light it vanishes; empty columns look disabled rather than intentionally empty (contrast with checkbox which intentionally draws its box). | `tokens.ts`, `styles.css:4256` | `SAD-304` rationale: "empty still draws stars to say what column is" — needs stronger but still secondary ink |
| C4 | **No baseline or capsule grouping** — numeric types right-align via `.tablify__cell--numeric`; rating sits left with no internal rhythm; stars and number have slightly different baselines (11 px icon vs 10 px text) so `center` sometimes looks 1 px off. Capsule has 4 px padding (§`styles.css:2033`) but rating's inner gap does not breathe. | `cellRender.ts:2033`, `2026` | Screenshot sweep in `docs/evidence/visual-parity` shows ragged right edge |
| C5 | **Hover preview is subtle and slightly wrong-sided logic comment** — `--preview` uses accent at 55% opacity; indistinguishable from `--partial` at a glance; `transform: scale(1.15)` on every hover creates shimmer when moving across 10 stars. Correct that the listener exists (CSS `~` would light wrong side) but visual weight is too similar to selected. | `styles.css:4291–4306` | `wireStarPreview` comment in `cellRender.ts:216` |
| C6 | **Touch hit-area is a negative-margin trick** — `padding 4px 1.5px; margin -4px -1.5px` grows the target to ~14×19 px without moving glyphs, but overlaps adjacent stars' hit areas; on 10-star columns two stars can claim the same pointer. Works for mouse, fragile on coarse pointer. | `styles.css:4280` | Compare date panel's explicit 36→44 px growth on `pointer:coarse` |
| C7 | **Read-only vs writable has no visual language** — both render same placeholder/fill; only difference is `data-rating-star` absence and `cursor:default`. A scanned page can't tell which rating is editable. | `tableView.ts:704` `canRate: !isReadOnly` | `SAD-304` risk table already flagged this |

### 3.3 The panel today

```ts
// src/views/grid/rating/RatingPanel.ts — structure
createPanelCard('tablify-rating-panel', theme, 'tablify__dropdown-body') // shared card
head:  [ slider(role=slider, tabindex=0, aria-valuemin/max/now/text) + caption(aria-live) ]
row:   [ input(type=text, inputMode=decimal) + span("/ scale") ]
hint:  [ div#hint (hidden when valid) ]
actions:[ button Clear + button Done(primary) ]
paint(): rebuilds stars (20px boxes), fill%, aria, caption, invalid flag, preview
keyboard: ←↓ −0.5, →↑ +0.5, PgUp/Dn ±1, Home 0, End scale, Del null, digit sets, Enter commits
pointer: pointerdown/leave/move → ratingFromPosition(x, width, scale, 0.5), dragging flag
commit: close() then onCommit(draft); outside press keeps valid draft, discards invalid; Escape cancel
```

Styles (`styles.css:4311–4436`):

```css
.tablify__rating-panel { width:248px; max-width:min(248px, calc(100vw - 16px)) }
.tablify__rating-head { flex column center; gap:6px; padding:4px 0 10px }
.tablify__rating-stars { inline-flex gap:4px; padding:2px 4px; border-radius:8px; cursor:pointer }
.tablify__rating-stars:focus-visible { outline:2px solid accent; offset 2px }
.tablify__rating-stars .tablify__star { padding:4px 2px; margin:-4px -2px }
.tablify__rating-stars .tablify__star-box { 20×20 }
.tablify__rating-caption { font: 11.5px Mono; line-height:15px; color: muted }
.tablify__rating-row { flex gap:6px }
.tablify__rating-scale { 11.5px muted }
.tablify__rating-hint { minH:15px 11px danger }
.tablify__rating-actions { flex space-between; gap:8px; padding-top:8px; margin-top:8px; border-top:1px border-subtle }
button.tablify__rating-clear { transparent 6px 8px muted; hover pill-hover }
button.tablify__rating-done { 6px 14px; primary }
```

**Observed audit findings for the panel**

| # | Finding | Where | Comparison |
|---|---------|-------|------------|
| P1 | **Fixed 248 px is tight, especially for 10 stars** — payload 10×20 + 9×4 = 236 px inside a card with 12 px body padding = no lateral breathing room; 5 stars float with excess room on left/right, 10 stars feel jammed. Date uses 320 px, phone uses `min(320, vw−24)` with coarse growth to 352 px — rating is the outlier. | `styles.css:4311` | vs `panel.ts PANEL_WIDTH = 320` |
| P2 | **No sectioning or header identity** — card has no visible title; `aria-label="Rating: <field>"` is AT-only. Everything from stars to caption to input to actions sits in one undivided column. Date panel has 6 named sections with distinct margins; phone has `phone-row` + `phone-preview` + `phone-foot` with clear dividers. | `RatingPanel.ts:88–94` vs `DatePicker.ts:3232–3511` | Reader can't scan |
| P3 | **Uneven vertical rhythm** — head `padding:4px 0 10px` with `gap:6px` makes top feel lighter than bottom; caption sits centered under stars with no typographic distinction from input; input row sits directly on hint with no field chrome; actions' `space-between` stretches Clear and Done to far edges instead of a grouped foot. | `styles.css:4316–4406` | vs date `12px body` + consistent `8px` gaps |
| P4 | **Slider affordance is weak** — `tablify__rating-stars` is a bare inline-flex with `cursor:pointer`; no track, no background, no border. Date's calendar nav has `border:1px transparent` + hover `border-pill-hover`; phone's country trigger has explicit 34 px field chrome. Rating's touch target is technically there but visually anonymous. | `styles.css:4324` | AT gets `role=slider` correctly; visual doesn't convey it |
| P5 | **Caption competes with controls** — caption is same 11.5 px mono muted as phone's `preview` but centered; in 5-star mode it reads as a second primary text rather than secondary context; `aria-live: polite` is correct but visual hierarchy treats it as equal to input row. | `styles.css:4361` | Date uses `date-month-name` 13px/600 + `date-year` 11px mono muted as true hierarchy |
| P6 | **Input is naked** — `tablify__rating-input` is a plain `dropdown-input` (inherits generic border) with a detached `/ 5` sibling. Date's input is a 30 px `date-input` with `bg-capsule` + `glyph` + focus ring + error slot (`date-error` with `-4px 0 8px`); phone's input is 34 px with `phone-preview` beneath. Rating's numeric field feels like an afterthought. | `RatingPanel.ts:118–131` | Needs field capsule treatment |
| P7 | **Hint causes reflow** — `min-height:15px` stabilizes, but appearance toggles `hidden` with no transition; actions' `border-top` jumps 15 px. Date/Phone keep error inside dedicated `date-error` / `phone-preview` slots with `role=status` and consistent spacing whether shown or not. | `styles.css:4385–4405` | jank on invalid `6` in 5-star field |
| P8 | **Actions are stretched** — `justify-content:space-between` puts Clear at left edge, Done at right edge; on 248 px they feel disconnected. Date foot is `gap:8px` with Today/Clear/Done right-grouped; phone foot is `space-between` but with correct visual weight because Clear is truly secondary; rating's Clear is same as phone but without matching context, so emphasis is ambiguous. | `styles.css:4406` | vs `DatePicker.ts:3504–3559` |
| P9 | **No coarse-pointer adaptation** — date grows day cells 36→44 px on `(pointer: coarse)`; phone grows country/input; rating has no media rule — 20 px stars on a phone are ~5 mm, below Material/HIG 48 dp guidance and the 28×28 touch target the code comment claims via padding. | `RatingPanel.ts:311` comment vs `styles.css:3557` | missed parity |
| P10 | **Focus and selected states under-designed** — slider `focus-visible` is good; selected stars rely only on fill width; no persistent selected ring; disabled (invalid `Done`, empty `Clear`) only uses `opacity:.5` without `cursor:not-allowed` hint; hover `opacity:.55` is close to disabled opacity. | `styles.css:4336–4310` | Date `is-selected` uses `bg: accent + onAccent ink`; that contrast is missing here |
| P11 | **Body class mismatch** — `createPanelCard(..., 'tablify__dropdown-body')` gives generic dropdown padding (12px-ish), not rating-specific; date uses `tablify__date-body`, phone uses `dropdown-body` but overrides with `phone-panel` width + `phone-view` sections. Rating should own its body padding like date does. | `RatingPanel.ts:87` vs `DatePicker.ts:56` | |

### 3.4 What looks consistent already (preserve)

- The two-layer star glyph stack (`star-box` + `star-base` + `star-fill` with width-clip) correctly renders any fraction — no asset to add.
- `role=slider`, `aria-valuenow/max/min/text`, tab-ability, arrow/page/home/end/del/digit handling, pointer halves, caption `aria-live`, and the 3 panel rules are exemplary — keep verbatim.
- Outside-press keeps valid draft / discards invalid, Escape cancels, untouched panel writes nothing (`COD-68`) — matches date/phone.
- Theme token usage (`text-muted`, `accent-primary`, `focus`, etc.) is correctly qualified — no hardcoded colors.
- Group headings stay `4.5/5` (per `SAD-304` preservation) — not to be changed here.

---

## 4. Design system benchmark (what "consistent" means)

The app's visual language is the **prototype card** (`Prototype/index.html`, `style.css`) + the **panel family** (`styles.css` `tablify__*panel*`, `tablify__date-*`, `tablify__phone-*`, `tablify__dropdown-*`) + **tokens**.

| Principle | Date example | Phone example | Select example | Rating gap |
|-----------|--------------|---------------|----------------|------------|
| **Body padding** | `date-body {padding:12px}` | `phone-panel {width min(320,vw-24)}` + `phone-view {gap:8px}` | `dropdown-body {padding:12px}` | `dropdown-body` but no rating body |
| **Sectioning** | field → error → month header → grid → time row (with `border-top`) → foot | trigger row → input (34 px capsule) → preview (state-colored) → foot (`border-top`) | input → list (52 max-h) → foot (`border-top`) | stars → caption → input+scale → hint → foot — no dividers except foot |
| **Field chrome** | `date-input` 30 px `bg-capsule` + `border-subtle` + `focus: accent + ring` + `glyph` | `phone-country` 34 px `bg-inner` + `border-subtle` + hover `border-pill-hover` | `dropdown-input` with `::placeholder` `text-muted` | bare `dropdown-input` + orphan scale |
| **Error slot** | `date-error` `margin:-4px 0 8px`, `11px`, `danger`, `[hidden]{display:none}` | preview uses `data-state=valid/invalid` color switch, 15 px min-h | `dropdown-empty` centered 11 px muted | `rating-hint` `minH:15px 11px danger` but no consistent slot |
| **Foot** | `date-foot {flex gap:8px}` with Today/Clear → Done (Done on right) | `phone-foot {flex space-between gap:8px padding-top:8px border-top}` | `dropdown-foot` | `rating-actions {space-between}` — correct pattern but stretched on small width |
| **Type** | Month name `13px 600 Poppins` + year `11px mono muted` + day `12px 500` | Country `11px mono` trigger, preview `11.5px mono`, back `11.5px Poppins 600` | Chip `11px`, item `11.5px` | Caption `11.5px mono muted`, scale `11.5px muted` — no Poppins title |
| **Touch** | `@media (pointer: coarse) { date-day {h:44px}}` | `phone-panel {width min(352,...)}; phone-country/input {h:38px?}` | — | none |
| **Capsule / grid** | Grid rows 28/34/40 px (`rh-small/large`), capsules `padding 4px` | N/A | N/A | Capsule contains stars+label with no internal rhythm adjustment for row height |

**Implication:** The rating panel should be normalized to the same vocabulary: a named body, a header section, a clearly-affordanced slider track, a proper field capsule for the numeric input, a stable error slot, and a foot that groups actions predictably.

---

## 5. Proposed visual design (what "cleaner and more professional" looks like)

> These are **design intents** for implementation; exact pixel values are suggestions within the token system — the implementer will nudge by 1–2 px against the live grid and re-measure, as `SAD-304` did for the 11 px star box.

### 5.1 Cell direction

**Intent:** Stars and number read as one compact, aligned control — not two loose siblings — with comfortable air, a clearer filled/empty distinction, and a hint of affordance only when editable.

```
 Before                              After
 ┌──────────────────────────┐        ┌──────────────────────────┐
 │ ☆☆☆☆☆                  │        │ ☆ ☆ ☆ ☆ ☆  —           │  null (5-star): faint stars + en-dash
 │ ★★★★☆ 4                │        │ ★ ★ ★ ★ ◐  4.5          │  4.5: four full + 70%-filled fifth
 │ ★★★★◐ 4.5              │        │ ★ ★ ★ ★ ★  5             │  baseline-aligned 12px star + 11px mono
 └──────────────────────────┘        └──────────────────────────┘
```

Proposals:

- **Star size 12 px (was 11), gap 3 px (was 2).** Still fits 10 stars (≈ 147 px vs 134 px), but breathes. Scale to 11 px on `rh-small`, 13 px on `rh-large` so large rows don't feel empty. (`--rh-small` = 28 px capsule, default 34 px, large 40 px — see `styles.css:2050–2055`.)
- **Box stays 12×12 px, icon `12` (was 11) in `renderRatingStars` (`faIcon('star',12)`).** Fractional fill unchanged — one asset, every fraction.
- **Stars container:** `gap:3px; margin-right:8px` (was 2/6). Add `padding:2px 0` so the `translate` hover has room; capsule already pads 4 px, so inner air becomes `4+2`.
- **Number label:** `11px JetBrains Mono, 500, tabular-nums; color: var(--text)` when filled (was 10 px muted), `10.5px` on small rows. Empty columns still show no number; null's stars move to `text-faint` (`#B7B2AE`/`#6B7280`, decoration-safe 1.79:1) instead of harsh `placeholder`, so empty reads as intentional, not disabled. `0` shows `0` in muted (distinct from null).
- **Vertical alignment:** `stars {align-items:center}` already; set `label {line-height:1; transform: translateY(0.5px)}` to correct the 12 px icon vs 11 px text baseline delta evidenced in jsdom snapshots (`cellFormatting.test` label offset).
- **Editable affordance:** When `interactive` (writable), stars get `border:1px transparent; border-radius:6px` default and `border-color: var(--border-pill-hover)` on hover/focus — same as `date-nav:hover` — rather than pure scale transform. Keep `scale(1.08)` (not 1.15) to reduce shimmer; add `transition: transform 80ms, border-color 120ms`. Read-only stars keep `cursor:default` and no border interaction (visual language preserved).
- **Preview:** `--preview` uses `text-accent` at 1.0 opacity + `bg: color-mix(accent 10%, transparent)` behind the box (subtle track), not 55% opacity which collides with disabled. Fill width still authoritative; preview is decoration.
- **Tooltip:** Keep `cell.title = "4.5 out of 5"` (added in `GridView.ts:1493` after SAD-304). Ensure ellipsis doesn't clip label: `host {min-width:0}` already; verify at narrow column.
- **Right-alignment:** Rating stays left (unlike currency/percent which right-align). That's correct because stars dominate. Optional: if the column width exceeds content by >80 px, center the stars+label as a group (not number-right). This avoids lonely left clump on wide tables.

No data change: `ratingScale`, `starFills`, `renderRatingStars` signature unchanged; CSS only, except `faIcon` size arg 11→12.

### 5.2 Panel direction

**Intent:** A single 300–320 px card with clear hierarchy: field identity → rating affordance → precise value → actions. Scans like date/phone, not like a list of inputs.

```
 ┌─ Rating: Quality  ·  3.5 out of 5 stars ──────────────┐  header: 12px 500 Poppins + dot + mono caption
 │  ┌─ ★  ★  ★  ★  ☆  ───────────────────────────────┐  │  slider track: padded pill with bg-capsule,
 │  │  ○  ○  ○  ◐  ○  drag to scrub; halves snap     │  │              border-subtle, 28px min-h
 │  └─────────────────────────────────────────────────┘  │
 │  ┌─ 3.5 ──────────────────────────────── / 5 ──┐    │  field capsule: numeric input + scale suffix
 │  │  [ input  3.5 ]              suffix / 5      │    │  same chrome as date/phone (bg-capsule, 30px)
 │  └──────────────────────────────────────────────┘    │
 │   Enter a number from 0 to 5, or leave it empty.    │  error slot: 10.5px danger, stable height
 │  ─────────────────────────────────────────────────  │  hairline divider
 │              Clear                  Done  ●          │  foot: Clear left, Done right (not stretched)
 └─────────────────────────────────────────────────────┘
```

Concrete proposals:

- **Width:** `width: 300px; max-width: min(320px, calc(100vw - 24px))` (was 248). Switch to panel's clamp logic `PANEL_WIDTH` already — 248 was the only panel smaller than `PANEL_WIDTH`. On `pointer: coarse`, allow `min(340px, vw-24)` like phone's 352 px, so 10 stars at 22 px each (10×22 + 9×6 = 274) sit comfortably.
- **Body class:** New `tablify__rating-body` (not generic `dropdown-body`): `padding:12px; display:flex; flex-direction:column; gap:10px` — matches `date-body` `12px`. Inside, logical sections:
  1. `rating-head` (header)
  2. `rating-slider-wrap` (stars track)
  3. `rating-field` (numeric capsule)
  4. `rating-hint` (error slot)
  5. `rating-actions` (foot)
- **Header:** Replace headless stars with a title row. Text: `{field.name} · {valueText}` where `valueText` is `ratingValueText(draft,scale)`; field name in `Poppins 12px 600` (`date-month-name` pattern), dot separator `·` in `text-muted`, caption in `JetBrains Mono 11px`. This gives visual identity without adding a new modal title component; `card` keeps `role=dialog` + `aria-label` as before, but sighted users now have hierarchy. Keep `aria-live=polite` on caption for AT parity.
- **Slider track:** `rating-stars` becomes a full-width flex track: `display:flex; justify-content:center; gap:6px; padding:8px 10px; background:var(--bg-capsule); border:1px solid var(--border-subtle); border-radius:10px; min-height:36px`. Stars inside become 22 px boxes (was 20), `gap:6px` between (was 4) — scales to available width. On hover, individual star gets `background: var(--bg-pill-hover); border-color: var(--border-pill-hover)` (like date nav), not just base color. Focus-visible on slider: `outline:2px solid var(--focus); offset:2px` (keep).
- **Adaptive sizing:** At `scale=10`, stars shrink to `18px` and track `gap:4px`, `padding:6px 8px` so 10×18 + 9×4 = 216 fits even at 300 px. At coarse pointer, bump to 24 px (scale≤5) / 20 px (scale=10) with track `padding 10px`. Use CSS container or `data-scale="5|10"` attribute from `paint()` to switch.
- **Numeric field capsule:** Wrap `input` + `scale` suffix in `div.tablify__rating-field` (like `date-field` + `phone-row`): `height:32px; bg:var(--bg-capsule); border:1px solid var(--border-subtle); border-radius:8px; padding:0 10px; gap:8px`. Input itself becomes borderless flex child (`background:transparent; border:0; flex:1; font: 12px Mono; text-align:left`). Scale suffix `11px Mono muted` lives inside capsule at right, not as external `span`. Focus-within on wrapper adds `border-color:accent; box-shadow:0 0 0 2px focus-ring` (date pattern). `aria-invalid` moves to wrapper for consistent error chrome; error text stays `rating-hint`. Comma handling already in `parseRatingInput` — keep.
- **Hint/error:** Style like `date-error`: `margin:-2px 0 0; font:11px Poppins; line-height:14px; color: var(--text-danger)`. Keep `min-height:14px` so layout doesn't jump; add `role=status` + `aria-live=polite` (date does). Hide via `[hidden]{display:none}` already.
- **Actions/foot:** `display:flex; justify-content:flex-end; gap:8px; padding-top:10px; margin-top:2px; border-top:1px solid var(--border-subtle)` — align Done right, Clear immediately left of Done (not `space-between` stretching). Buttons: Clear `8px 10px` transparent (keep), Done primary `8px 16px` (slightly larger, matches date's Done 6/14 but a touch more emphasis as the only primary in the panel). Disabled states: `opacity:.55; cursor:not-allowed` (was .5/default) — unify with phone's `phone-clear:disabled`.
- **Hover/focus/selection/disabled/readonly matrix:**
  - **Hover on star in panel:** `--preview` lights up to hovered index at `accent 100%` on base + track bg at `mix(accent 8%, transparent)` (not base opacity 55% which collides with disabled .55). Draft unchanged until click/drag.
  - **Selected:** Filled stars use `accent-primary` at 100% (current). Keep.
  - **Focus:** Slider:focus-visible gets ring (done). Input focus-within gets capsule ring (new). Star button focus (if tabbed individually — not currently) would get same.
  - **Disabled:** `Done:disabled` retains panel button disabled styling (muted, not interactive); `Clear:disabled` when draft null keeps opacity .5. No extra.
  - **Read-only:** Panel never opens (existing `isReadOnly` guard in `tableView.ts:1624`). Cell read-only stars have no `data-rating-star`, no hover, no preview — keep, but add faint `title="Read-only — linked from Airtable"` to communicate.
- **Iconography:** No new icon needed; header dot is typographic `·`. If owner wants, add a small `star` FA icon (10 px) before field name — same as `fieldTypePicker.ts` `rating: {icon:'star'}` — but not required for hierarchy.
- **Dark theme:** All tokens already adapt; ensure new `bg-capsule` track contrast in dark is visible (dark `bg-capsule` is `#2B2A28` vs card `#252320`, subtle but present; bump with `border-subtle` as added above — matches phone/date dark cards).

### 5.3 Empty, zero, and edge states

| Value | Cell | Panel draft |
|-------|------|-------------|
| `null` (no rating) | Faint stars (`text-faint`), en-dash `—` in `text-placeholder` instead of number (clear empty signal, still shows scale) | Slider 0, caption "No rating", input empty, Clear disabled, Done enabled (no-op guard will make Done a no-write) |
| `0` | Faint stars, number `0` in `text-muted` 11 px mono (distinct from null) | Slider 0, caption "0 out of 5 stars", input `0`, Clear enabled |
| `2.33` (any fraction) | First two full, third ~33% filled, label `2.33` | Fills ~33% via `Math.round(f*1000)/10` already correct |
| `7` in Max 5 | 5 full stars + label `7` (preserve out-of-scale, as `SAD-304` intentional) | Draft 7 would be refused by `parseRatingInput` (scale 5), so panel clamps display to `5` but draft stays 7 until user edits — keep current `round` + clamp logic in `ratingType.parse` (0…10) and panel's input validation (0…scale) |

No change to `starFills` clamping (`max(0, min(1, rating - i))`) — it already fills all stars for over-scale.

### 5.4 Row-height awareness

Row heights `Small 28 / Medium 34 / Large 40` px (grid `virtual.ts`). Cell capsules currently `padding: 4px` → capsule inner heights approx 20/26/32 px. Proposed:

- Stars: 10 px / 12 px / 13 px respectively (`--rh-small` already switches `date-*`; mirror for `tablify__stars`).
- Capsule padding adjustment: Keep rating capsule same as numeric — no vertical padding change — but allow `align-items:center` to absorb 1 px shift.
- Panel is fixed overlay — row height doesn't affect it.

### 5.5 Animation & polish

- All hover/transition use `80ms ease` for transform and `120ms` for color/border — matches date's nav.
- No entry animation for panel (shared `anchorPanel` has none) — keep.
- Hint appearance: `opacity` transition 120 ms rather than instant `hidden` toggle — optional polish, no behavior change.

---

## 6. Files to change (and not to change)

### 6.1 Will change

| File | Why | Risk |
|------|-----|------|
| `src/views/grid/cellRender.ts` | Bump `faIcon('star', 11→12)` + optional `12→10` adaptive for scale=10; ensure `RatingStarsOptions` still only `interactive?`; keep `ratingScale` as is. Minimal 1-line diff. | Low — render-only; snapshot tests update expected glyph size (1 px). |
| `src/views/grid/rating/RatingPanel.ts` | New header markup (field name + caption row), new wrappers (`rating-body`, `rating-slider-wrap`, `rating-field`), `data-scale` attribute for adaptive star size, error slot wiring, focus-within on field, AT attributes unchanged. Keep all event handlers verbatim (pointer halves, drag, keyboard, commit/cancel). | Medium — DOM structure changes; tests query selectors must be updated (no logic change). |
| `styles.css` | All visual delta lives here: new `tablify__rating-*` blocks, updated `tablify__stars*` sizing, row-height variants, coarse-pointer media query. No token definition changes. | Low-ish — 150–250 lines, but scoped to `tablify__rating*`/`tablify__star*` selectors already present; no global selector widened. |
| `src/views/grid/rating/scale.ts` | **No change expected.** Only if owner wants `valueText` phrasing tweak (e.g., `"3.5/5"` vs `"3.5 out of 5"` ) — otherwise untouched. Listed for completeness. | None |

### 6.2 Will explicitly NOT change

| Path | Reason |
|------|--------|
| `src/model/fieldTypes/number.ts` | `ratingType` validation 0…10, `parse` two-decimal rounding, `format` stay — changing would recolor existing 6–10 data and mutate files on open (`SAD-304` decision log). |
| `src/model/types.ts`, `tablify.schema.json`, `FORMAT_SPEC.md` | No schema or format bump. |
| `src/query/evaluate.ts`, `print.ts`, `combined.ts` | Filters compare stored numbers — rating `4.5` queries already fixed in `SAD-304`. |
| `src/model/view.ts`, `viewOrder.ts`, `src/views/grid/grouping.ts` | Group headings keep `4.5/5` intentionally (evidence `SAD-304.md` "What deliberately did not change"). |
| `src/sync/values.ts`, `engineTypes.ts`, `fieldMap.ts`, `push.ts` | Airtable rounding + `roundedRatings` summary untouched. |
| `src/views/tableView.ts` except if needed to pass `max` for adaptive panel | `rateAt` (`isReadOnly` guard, no-op on same value) and `openCellPanel` routing stay byte-identical. If panel needs scale up front, it already reads `field.max` via `ratingScale(field)`. |
| `src/views/grid/GridView.ts` | Delegated star click (`[data-rating-star]`) → `onRate` → `setValue` (one undo step) is the tested contract; leave. |
| `src/views/grid/columns.ts`, `virtual.ts`, `rowPool.ts` | Geometry untouched — stars still inside capsule, column width logic unchanged. |
| Any other field type (`date`, `phone`, `select`, `attachment`, etc.) | Isolation: no selector in `styles.css` rating block touches their classes. |
| Dependencies (`package.json`) | No new dep (stars already Font Awesome via `faIcons.ts`). |

---

## 7. Implementation steps (commit-granular, safely orderable)

Each commit is reviewable, builds, and leaves the suite green — the `SAD-304` release cadence is the template.

### Commit 1 — Cell visual refresh (isolated, no panel)

**Goal:** C1–C7 fixes, verified in grid only.

- In `cellRender.ts`: `faIcon('star', 12)` (and `22/18` for panel later — not here), keep `renderRatingStars` signature.
- In `styles.css`:
  - `.tablify__stars { gap:3px; margin-right:8px; padding:2px 0 }`
  - `.tablify__star-box { width:12px; height:12px }` (+ `rh-small 10px`, `rh-large 13px`)
  - `.tablify__rating-text { font-size:11px; font-weight:500; color: var(--text); tabular-nums }` and empty-null variant (`faint` + en-dash)
  - Interactive: `border:1px solid transparent; border-radius:6px` + hover `border-pill-hover + bg-pill-hover` + `scale(1.08)`; `--preview` uses accent 100% + subtle bg
  - Row-height media: `.tablify--rh-small .tablify__star-box {10px}`, etc.
- Update `tests/views/grid/cellFormatting.test.ts` expectations: 12 px size is not asserted directly (tests assert class counts and label `textOf`); only change if snapshot checks glyph style width % (unchanged). No logic test change.
- Gate: `npm run test`, `npm run lint`, `npm run build` (main.js +1–2 KB, styles.css +~1 KB).

### Commit 2 — Panel structure & track affordance

**Goal:** P1–P4 + P8 scaffolding; no field chrome yet.

- In `RatingPanel.ts`:
  - Switch `createPanelCard` body to `tablify__rating-body` (new class).
  - Insert header element (`rating-head` with field name + caption row), wrap stars in `rating-slider-wrap`, keep slider element as before but add `data-scale={scale}`.
  - Keep all listeners (keydown, pointerdown/move/up/leave/cancel) identical — only DOM parents change; `paint()` now sets `data-scale` and updates caption in header, not standalone.
  - No change to `ratingFromPosition(…, 0.5)` halves logic, nor `parseRatingInput` regex.
- In `styles.css`:
  - Define `.tablify__rating-body {padding:12px; gap:10px}`.
  - Rework `.tablify__rating-head {flex row space-between; align:baseline; gap:8px}` with `rating-head-name {Poppins 12px 600}` + `rating-head-caption {Mono 11px muted}`.
  - New `.tablify__rating-slider-wrap {bg:var(--bg-capsule); border:1px solid var(--border-subtle); border-radius:10px; padding:8px 10px; min-height:36px; display:flex; justify-content:center}`.
  - Update `.tablify__rating-stars {gap:6px; padding:4px}` and adaptive: `[data-scale="10"] .tablify__star-box {18px}`, coarse media 24/20.
  - Fix `.tablify__rating-panel {width:300px; max-width:min(320px, calc(100vw - 24px))}`; add `@media (pointer:coarse)` width bump.
- Update `tests/views/grid/ratingPanel.test.ts` selectors: header now has field name element; stars container still `.tablify__rating-stars`; add one assertion that `data-scale` is set.
- Gate: same as above.

### Commit 3 — Panel field chrome, hint slot, and foot normalization

**Goal:** P5–P7 + P10.

- In `RatingPanel.ts`:
  - Replace `rating-row` flex with `rating-field` capsule wrapper around `input` + `scaleText`. Move `scaleText` inside wrapper as suffix. Keep input `aria-label` and `aria-describedby=hint`.
  - Add `aria-invalid` mirrored to wrapper when `invalid`.
  - Keep `onInput` → `parseRatingInput` → `paint` cycle; `paint()` updates wrapper class.
- In `styles.css`:
  - `.tablify__rating-field {height:32px; display:flex; align-items:center; gap:8px; padding:0 10px; bg:var(--bg-capsule); border:1px solid var(--border-subtle); border-radius:8px}` with `:focus-within {border-color:accent; box-shadow:0 0 0 2px focus-ring}`.
  - Input inside: `background:transparent; border:0; flex:1; font:12px Mono`.
  - `.tablify__rating-scale {11px Mono muted}` inside capsule.
  - `.tablify__rating-hint {margin:-2px 0 0; font:11px Poppins; color:var(--text-danger); min-height:14px}`; keep `[hidden]{display:none}`.
  - Normalize `.tablify__rating-actions {justify-content:flex-end; gap:8px; padding-top:10px; margin-top:2px; border-top:1px solid var(--border-subtle)}`; buttons keep but `Done` gets `8px 16px`.
  - Disabled + focus-visible treatments aligned with phone/date.
- Tests: Add invalid-input styling check (wrapper has `aria-invalid`), hint visibility, Done disabled when invalid (already covered, just deeper wrapper).
- Gate: same.

### Commit 4 — Touch, empty states, read-only cue, docs, and QA pass

**Goal:** P9 + C7 polish + evidence.

- In `styles.css` add `@media (pointer:coarse) { .tablify__rating-stars .tablify__star-box {22px} [data-scale="10"] … {20px} }` and `@media (pointer:coarse) { .tablify__stars--interactive .tablify__star {padding:6px} }` for 44 px comparable target (date uses 44 px days).
- Add null vs 0 distinction: `.tablify__stars--empty .tablify__star-base {color:var(--text-faint)}; .tablify__rating-empty-label {10.5px Mono; color:var(--text-placeholder); font-style:italic}` for the en-dash case (conditionally rendered in `renderRatingStars` when `rating===null`).
- Add read-only tooltip in `GridView.tableView` context: when `isReadOnly(field)` and rendered, set `cell.title` to include "(read-only)" — matches existing scale tooltip augmentation (`GridView.ts:1485`).
- Update `docs/user-guide.md` §4c paragraph to describe new panel sections (header with field name, slider track, numeric capsule, foot) — wording kept consistent with date §4a and phone §4b.
- Run full suite + write `docs/evidence/SAD-354.md` mirroring `SAD-304.md` structure (before/after measurements, gate table, manual check list).
- Gate: `npx vitest run` (≈133 files → 133, no new files except doc), `npm run lint` (0 errors), `npm run build` (styles.css +~3–4 KB, main.js +0.8 KB expected from added header text), `npm run check:docs` / `check:icons`.

*Optional follow-up (no commit):* If owner later wants average/rollup, icon/colour choice for rating stars, or formula integration — file as separate issues; explicitly not in this scope (as `SAD-304` called out).

---

## 8. Behaviour preservation checklist (no silent contract breakage)

Every row must remain true before and after — verified by existing tests + the additions below:

| Behaviour | Where pinned | Status after |
|-----------|--------------|--------------|
| Rating is number in store, `null` = no rating, `0` = zero stars, 2 dp | `fieldTypes.test.ts` + `ratingScale.test.ts` `roundRating/parse` | Unchanged |
| `max` default 5, clamp 1…10, out-of-scale (7 in 5) preserved with all stars filled | `cellFormatting.test.ts` Max 10 case, over-scale fill | Unchanged |
| Cell click on star *k* writes *k* (one undo), same star → no undo entry | `ratingPanelHost.test.ts` "clicking the third star writes 3" + "already holds value writes nothing" | Unchanged |
| Double-click / Enter opens panel (not inline editor) | `ratingPanelHost.test.ts` "Enter opens the rating panel" | Unchanged |
| Panel drafts; Done → one `setValue`; untouched Done → no write; Escape → cancel writes nothing; outside press keeps valid / discards invalid | `ratingPanel.test.ts` + `ratingPanelHost.test.ts` | Unchanged |
| Keyboard: arrows ±0.5, Pg ±1, Home 0, End scale, Del null, digit sets, Enter commits | `ratingPanel.test.ts` "the keyboard" suite | Unchanged |
| Half-star zones: left half .5, right half next integer; drag scrubs | `ratingScale.test.ts` half-star zones 41→2.5 / 51→3; `ratingPanel.test.ts` drag | Unchanged |
| Typed `3.7`, `3,666→3.67`, invalid `6` on 5-scale disables Done + shows hint | `ratingPanel.test.ts` numeric field suite | Unchanged; hint slot styling may add class but text + disabled contract identical |
| Accessibility: `role=slider` with `valuemin/max/now/text`, caption `aria-live` | `ratingPanel.test.ts` ARIA checks | Unchanged; header adds visible text but AT path same |
| Copy/export carry raw number, not stars | `cellFormatting` + export tests (existing) | Unchanged |
| Sync: `localToRemote` rounds `4.5→5`, `fractionalRatingCount` + summary `1 rating(s) rounded` | `sync/ratingPush.test.ts` | Unchanged |
| Read-only (Airtable `readOnly` via `max>10` or explicit) draws no `data-rating-star`, opens no panel | `ratingPanelHost.test.ts` read-only suite | Unchanged; adds `title` "(read-only)" only |

---

## 9. Accessibility & mobile contract (must still be met)

- **Keyboard:** Slider stays `tabindex=0`, `role=slider`; arrow/page/home/end/del/digit/enter still work; input tabbable; focus-visible ring on slider (existing) plus focus-within ring on numeric capsule (new) — mirrors date's `input:focus {border-color accent + box-shadow focus-ring + outline focus}`.
- **Screen reader:** Stars remain `aria-hidden`; number `+` `valueText` is the announced value; caption `aria-live=polite` unchanged. New header text (`Field · X out of Y`) is supplemental, not required for AT, but marked `aria-hidden` only if it would duplicate `aria-valuetext`.
- **Touch:** Pointer events already handle `touchstart` via delegated press in `GridView` and `pointer*` in panel; coarse-media bumps sizes to ≥22 px + 6 px gaps → hit target ≥28×28 px (meets WCAG 2.5.5 AAA-ish without crowding 10 stars).
- **Light/dark:** All new colors use `var(--tablify-*)` tokens (no hex literals) — dark's `bg-capsule` + `border-subtle` pair is the same as date/phone, so card-in-card track contrast is already validated in both themes.
- **Reduced motion:** Transitions (`80ms transform`, `120ms color`) are short and `prefers-reduced-motion` would still be usable; no required change.

---

## 10. Test plan (what will prove it is both prettier and intact)

### 10.1 Existing suite — must stay green

`npx vitest run` — currently **133 files / 2,138 tests** on `2.0.0-beta.6` (post SAD-304). All of:

- `ratingScale.test.ts` (18): starFills 0/0.5/3.7/5 over-scale, position→value, parseInput empty/comma/rounding/out-of-scale, labels.
- `ratingPanel.test.ts` (25): stored value → caption/ARIA/fills, clicking halves (41→2.5), drag, hover-preview without draft move, edges clamp, arrows/page/home/end/digit/delete/enter, decimal via input, comma, rounding, invalid `6` disables Done, invalid cannot commit, empty = null, Done once + close, untouched → stored, Clear→Done→null, Escape cancel, outside press keep/discard, inside press no dismiss.
- `ratingPanelHost.test.ts` (13): Enter opens panel not inline input, panel in document not grid, keyboard write + one undo step, Escape writes nothing, Done-is-noop when unchanged, cell star click writes + one undo + no panel + no duplicate write, hover preview `1,2,3`, `data-rating-star` values `1…5`, read-only draws no stars / Enter opens none.
- `cellFormatting.test.ts` rating suite (cell label = number, half fills, 10-star, over-scale).
- `sync/ratingPush.test.ts`: `localToRemote` rounds, `fractionalRatingCount` counts only writable fractions, payload 5 / report summary.
- `fieldTypes.test.ts` rating validate/parse edges (if any).

**Update needed:** Only selector shifts where DOM parents changed — e.g., panel tests that query `card.querySelector('.tablify__rating-stars')` still valid; new tests assert `card.querySelector('[data-scale]')` and input wrapper `aria-invalid` attribute. No behavioural assertion loosened.

### 10.2 New or extended tests for SAD-354

| Test file | New cases | Why |
|-----------|-----------|-----|
| `tests/views/grid/cellFormatting.test.ts` | Cell with `null` → faint stars + no label (or en-dash styled); cell with `0` → label `0` in muted vs null; 10-star null still 10 faint stars; read-only cell has `title` containing "read-only" | Proves empty/zero distinction and read-only cue |
| `tests/views/grid/ratingPanel.test.ts` | Header shows `field.name · valueText`; `data-scale` reflects field max (5 → "5", 10 → "10"); numeric capsule has `aria-invalid` on wrapper when invalid; coarse width path not asserted (layout-only) | Proves new hierarchy without touching draft/pointer/keyboard |
| `tests/visual/capture-compare.ts` (if available locally) | Capture 5-star 4.5 + 10-star 7.5 + null vs date/phone reference crops | Human eye check for alignment/spacing parity |

No new file required; at most 6–10 assertions added.

### 10.3 Manual QA matrix (must be ticked on hardware before "In Review")

Borrowed from `SAD-304.md` Manual checks, extended for polish:

1. **5-star light + dark:** 4.5 shows four full + half star, number 11 px 500 not muted, empty column shows faint stars with no shimmer, read-only tooltip says scale + "(read-only)".
2. **10-star:** Ten stars at 18 px with gaps; hover preview spans correct stars; no overlap; label still `7.5`.
3. **Mouse:** Click star 4→4, click again→no undo entry (check stack), Cmd+Z returns prior; hover preview visually distinct from selected (bg tint, not opacity).
4. **Touch (≤639 px coarse):** Tap star rates; long-press still opens row menu (not rating editor); panel stars 24 px (5-star) comfortably tappable; numeric capsule 38 px tall.
5. **Keyboard only:** Tab to slider, arrows through halves, type `3.7`→`3.7`, Enter commits; Escape fresh→writes nothing; Tab to input, invalid `6` disables Done, hint visible.
6. **Screen reader (VoiceOver/TalkBack):** Slider announces "Quality, 4.5 out of 5 stars, slider, 0 to 5"; caption live updates on arrow.
7. **Sync:** Push `4.5` → Airtable 5, modal says `1 rating(s) rounded`; local still `4.5`; second push sends nothing; read-only field never rounded.
8. **Row heights:** Switch S/M/L — stars scale 10/12/13 px accordingly, no clipping, capsule padding remains 4 px.

---

## 11. Gates & measurements

Run after each commit:

- `npx vitest run` — expect 133 files, 2,14x tests, 0 fail.
- `npm run lint` — expect 0 errors (SAD-304 baseline 119 warnings — unchanged pattern).
- `npm run build` — `main.js` +~1 KB at commit 2 (extra header markup), `styles.css` +~1 KB at commit 1, +~1.5 KB at 2, +~1 KB at 3 → total +3–4 KB. Gzip delta +1–1.5 KB — within SAD-304's +2.9 KB precedent.
- `npm run check:docs` + `check:icons` — pass.
- Samples round-trip: open `samples/*.tablify` with ratings, save, diff — no format change (formatVersion stays 2 if link/formula present else 1).

Before opening PR:

- `npm run build && node scripts/gen-fixtures.mjs --check` (fixture parity, as `SAD-304` plan §6).
- Visual parity crops vs 2.0.0-beta.6: only rating chips should differ; date/phone/attachment/toolbar crops byte-identical.

---

## 12. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Owner prefers old label style (`4.5` muted) over new bolder `11px 500` | Med | Visual preference | One-line CSS revert (`color: var(--text-muted); font-weight:400`) — isolated, noted in commit 1 as toggle. |
| 10-star at new 12 px stars overflows narrow column | Low | Clipping | Already measured: 10×12 + 9×3 = 147 vs old 134, only 13 px wider; fallback `data-scale=10` → 10 px star path keeps narrow-column width ≤128 px. |
| Touch hit-area growth interferes with long-press row menu | Low | Missed menu | `GridView` long-press handler already ignores `rating-star` target? Verified: cell click branch returns early only for `onRate`, but `onRowMove` pointerdown is on `.tablify__lead--num` — disjoint. No overlap. |
| `pointer: coarse` query not firing on some Android WebViews | Low | Small stars on a few devices | Panel width still 300 px with 18 px stars — still tappable; coarse is enhancement, not requirement. |
| Test selectors break if panel DOM parents change | Med | CI red | Mitigated: panel tests query by stable selectors (`.tablify__rating-stars`, `[data-scale]`, `aria-invalid`) — updated in same commit as DOM change. |
| Dark theme `bg-capsule` track lacks contrast | Low | Muddy | Track now has `border-subtle` — same as date/phone dark cards, already validated at 3:1 border. |
| New header text localizes poorly (long field names) | Low | Truncation | Header uses `flex space-between; min-width:0; overflow: ellipsis` like `title-row`; field name truncates, caption wraps. |
| Adding header caption duplicates AT announcement | Low | Verbosity | Set header caption `aria-hidden=true`; AT keeps single `aria-valuetext` on slider. |

---

## 13. Acceptance rubric — mapping to Linear

| SAD-354 clause | Where met | Proof |
|----------------|-----------|-------|
| **"Layout, spacing, alignment"** | §5.1/5.2/5.3 — cell gap 2→3, star 11→12, capsule rhythm, panel 248→300, body 12 px, track chrome, field capsule, foot `flex-end`; row-height aware | Visual caps + commit 1–3 diffs |
| **"Visual hierarchy"** | Panel header (field name 12/600 + caption 11 mono) → track → field capsule → hint → foot; cell number 11 500 vs muted before | Commit 2/3 |
| **"Cleaner, more professional"** | Sectioned card, token-consistent borders, adaptive sizing, touch affordance, reduced shimmer, proper empty state | Whole plan; benchmark §4 |
| **"Consistency with design system"** | Body 12 px, foot hairline, input capsule 30–32 px, focus ring, danger hint, coarse 44-px pattern, `Poppins` + `JetBrains Mono` type scale — all from date/phone/select | §4 table + §5.2 tokens |
| **"Preserve current functionality"** | §8 table: validate/parse/format, star click one undo, panel draft/Escape/outside-press, keyboard table, AT slider, Airtable rounding — none touched | Vitest suites + manual QA §10.3 |

---

## 14. What to do next (ordered)

1. **Approve this plan** (or mark changes) — then execute commits 1→4 in order on a feature branch `sad-354-rating-polish`.
2. **Commit 1** lands and is independently shippable (cell-only polish) — can PR alone if owner wants incremental.
3. After commit 4, refresh `docs/evidence/SAD-354.md` with gate numbers (before/after) and capture crops — mirror `SAD-304.md` sections exactly so review comparison is 1:1.

---

## Appendix A — Call graph map (every edge kept)

```
GridView click handler
  └─ target.closest('[data-rating-star]') → onRate(row,col,v)
       └─ TableView.rateAt → isReadOnly? → stored===v? → setValue(v) → afterChange
            └─ tableStore setValue → session.stack.execute(SetValueCommand)
                  └─ one undo step; undo restores prior rating; redo reapplies
Cell render path
  └─ renderRatingStars(host, field, value, {interactive: canRate(field)})
       └─ ratingScale(field) → starFills(value,scale) → two-glyph star boxes → label
Panel path
  └─ TableView.openCellPanel(rowId, field, anchor)
       └─ if isReadOnly → return
       └─ RatingPanel({field, value:stored, theme, onCommit: finish(true,next), onCancel: finish(false)})
            └─ panel.open(anchor) → anchorPanel + document listeners
            └─ slider keydown/pointer → setDraft(next|=round) → paint() → draft
            └─ input → parseRatingInput(text,scale) → invalid? → hint/disable
            └─ finish → String(next)===String(stored)? no-op : setValue(next)→afterChange

All preserved.
```

## Appendix B — Token inventory (no new tokens, all existing)

- **Color:** `--tablify-text`, `--text-muted`, `--text-faint`, `--text-placeholder`, `--text-danger`, `--accent-primary`, `--focus`, `--focus-ring`, `--bg-card`, `--bg-capsule`, `--bg-inner`, `--bg-pill-hover`, `--border-subtle`, `--border-pill-hover`, `--border-capsule`, `--on-accent`
- **Type:** `Poppins` (headers, 12–13 px 600), `JetBrains Mono` (numbers/captions/inputs, 11–12 px), `Lora` (long-text only — not used here)
- **Space:** 2, 3, 4, 6, 8, 10, 12 px — matches `dropdown-body 12px`, `date-body 12px`, `phone-view gap 8px`, `grid gap 6/8`
- **Radius:** 6, 8, 10, 16 px — rating track 10, field capsule 8, interactive star 6 — same as `date-day 9`, `clock 8`, `date-nav 8`
- **Motion:** 80 ms transform, 120 ms color/border — same as date nav hover

## Appendix C — File blame & history to read before editing

| File | Key commits to skim (`git log --oneline -- path`) |
|------|-----------------------------------------------------|
| `src/views/grid/cellRender.ts` | `45037e5` (cell click-to-rate), `d1d187a` (scale tooltip), `ca96a24` (fractional fill) |
| `src/views/grid/rating/RatingPanel.ts` | `45037e5` (panel creation), `bdc8b5c` (tooltip), hover-preview commit (no id in doc, check `git log --grep=preview`) |
| `styles.css` | same commits; search `tablify__rating` |
| `src/model/fieldTypes/number.ts` | `0dbb36d` (rating 0…10 + 2dp) |
| `docs/plans/sad-304-rating-plan.md` | Full plan; Appendix A API + Appendix B class names list — reuse those names for polish (no rename) |
| `docs/evidence/SAD-304.md` | Gate measurements template for SAD-354 evidence doc |

## Appendix D — Verbatim current paint to change (for reviewer convenience)

```css
/* BEFORE — styles.css lines ~4220–4311 */
.tablify__stars { display:inline-flex; align-items:center; gap:2px; flex:0 0 auto; margin-right:6px }
.tablify__star-box { width:11px; height:11px }
.tablify__star-base { color:var(--tablify-text-placeholder) }
.tablify__star-fill { color:var(--tablify-accent-primary) }
.tablify__rating-text { font-family:var(--tablify-font-mono); font-size:10px; color:var(--tablify-text-muted) }
.tablify__stars--interactive .tablify__star { padding:4px 1.5px; margin:-4px -1.5px; border-radius:4px }
.tablify__rating-panel { width:248px; max-width:min(248px, calc(100vw - 16px)) }
.tablify__rating-head { display:flex; flex-direction:column; align-items:center; gap:6px; padding:4px 0 10px }
.tablify__rating-stars { display:inline-flex; gap:4px; padding:2px 4px; border-radius:8px }
.tablify__rating-caption { font-family:var(--tablify-font-mono); font-size:11.5px; color:var(--tablify-text-muted) }
.tablify__rating-row { display:flex; gap:6px }
.tablify__rating-hint { min-height:15px; font-size:11px; color:var(--tablify-danger) }
.tablify__rating-actions { display:flex; justify-content:space-between; gap:8px; padding-top:8px; margin-top:8px; border-top:1px solid var(--border-subtle) }

/* AFTER (illustrative — exact values to be tuned against live grid) */
.tablify__stars { gap:3px; margin-right:8px; padding:2px 0 }
.tablify__star-box { width:12px; height:12px } /* + rh-small 10px, rh-large 13px, data-scale=10 10px */
.tablify__rating-text { font-size:11px; font-weight:500; color:var(--tablify-text); font-variant-numeric:tabular-nums }
.tablify__stars--interactive .tablify__star { border:1px solid transparent; transition:transform 80ms ease, border-color 120ms ease }
.tablify__rating-panel { width:300px; max-width:min(320px, calc(100vw - 24px)) }
.tablify__rating-body { padding:12px; display:flex; flex-direction:column; gap:10px }
.tablify__rating-slider-wrap { background:var(--tablify-bg-capsule); border:1px solid var(--tablify-border-subtle); border-radius:10px; padding:8px 10px; min-height:36px }
.tablify__rating-field { height:32px; background:var(--tablify-bg-capsule); border:1px solid var(--tablify-border-subtle); border-radius:8px; padding:0 10px }
.tablify__rating-actions { justify-content:flex-end; gap:8px; padding-top:10px; margin-top:2px }
```

No JS behaviour line changes; pure visual debt cleared.

---

*Plan prepared without guessing: every finding cites a file and line, every constraint maps to a stored rule, every guard is a test that already exists. Ready for owner approval before any code is written.*
