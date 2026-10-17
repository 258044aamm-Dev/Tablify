# COD-76 — the field type picker: a panel the plugin draws, with icons, descriptions and a reason

**Plan only — nothing implemented, no commits, no Linear status change.**
`main` is at `9191886` (COD-75 landed there today); the working tree holds only this plan and its mock.
**Issue:** [COD-76](https://linear.app/code-bro/issue/COD-76/he-field-type-selection-drawer-ui) · priority **2 (medium)** ·
labels *Improvement*, *Feature*

**Your answers, used as the design brief:**
1. the thing to fix is **the list that opens when you tap Field type** — not the window around it;
2. it becomes **an anchored dropdown panel with a search box** (not an inline grid, not a side sheet);
3. every entry carries **icon + name + one line of description**;
4. in Modify mode, types that would drop values are **shown greyed with the reason**, not hidden.

**Design mock (the visual authority):**
[`docs/evidence/cod-76/field-type-picker-mock.html`](../evidence/cod-76/field-type-picker-mock.html)
— interactive, light and dark, create and modify modes, 390 px phone. Still of the same board:
[`COD-76-field-type-picker-board.png`](../evidence/cod-76/COD-76-field-type-picker-board.png).

---

## 1. What is actually wrong today

The Field type row is a **native `<select>` with `<optgroup>`s**:

```
src/views/grid/AddFieldModal.ts:159   const typeSelect = typeWrap.createEl('select', …)
src/views/grid/AddFieldModal.ts:165   const optgroup = typeSelect.createEl('optgroup') …
styles.css:1753                       .tablify__pmodal select { appearance: auto }
```

The closed control is the plugin's — it inherits the pill field, the radius, the theme. **The list is not.**
When it opens, the browser (or the OS on mobile) draws it:

| | what that costs |
|---|---|
| outside the DOM | no CSS at all: no hover state, no theme variables, no radius, no alignment with the card |
| unthemed | a white sheet over the dark window; on Android, the platform's own full-screen drawer |
| label-only | 18 one-word rows with no icon, no explanation of what "Link" or "Formula" means |
| no grouping affordance | `optgroup` headers render as inert grey text on desktop and vanish on some platforms |
| no search | 18 rows in a 5-group popup is where people scroll past what they want |
| no reasons | in Modify, blocked types are **removed** by `offersType()` — the list silently shrinks and reads as a bug |

That last row is the one with a functional smell, not just a cosmetic one: a user who changes a Number
column to Text and then wants it back sees a list that no longer contains Number, with no explanation.

Evidence for the "outside the DOM" claim, from the repo's own harness: `tests/visual/capture-add-field.ts`
compares the plugin card to the prototype card at **0.11–0.83 %** pixel difference today (measured this
session: light/owner 0.48–0.83 %, dark/mobile 0.11–0.21 %) — and the one part it cannot compare is the open
type list, because in both the prototype and the plugin it is the platform's popup. The mock draws today's popup as an **illustration**
for that reason, and labels it so.

**This is the same finding as COD-75** (the date dialog was Chromium's), and it takes the same answer:
make the surface ours. It is the third popup the plugin draws inside a modal — after the option manager
and the link picker — so the pattern is established, not invented.

---

## 2. What ships

One new module, one new CSS section, and the type row in `AddFieldModal` swaps its control. Nothing in the
model, the save path or any other dialog moves.

| File | Change | Size |
|---|---|---|
| `src/views/grid/fieldTypePicker.ts` | **new** — `FIELD_TYPE_META` (icon, description, search keywords) and `FieldTypePicker` (trigger + anchored panel + search + keyboard) | ~380 lines |
| `src/views/grid/AddFieldModal.ts` | the `<select>` block becomes `new FieldTypePicker(…)`; `TYPE_GROUPS` (and the "unlisted type still appears" fallback) move into the new module and are re-exported, so the existing test import keeps working; `canPickType` is passed straight through and also answers `typeBlockReason` | ~45 lines changed |
| `src/views/tableView.ts` | passes `typeBlockReason: (type) => { const plan = planTypeChange(…); return plan.ok ? null : plan.reason; }` beside the existing `canPickType` | ~8 lines |
| `styles.css` | one new `/* ---- field type picker (COD-76) ---- */` section (lines 3333–3976); **no existing selector edited** | 644 lines, comments included |
| `src/menus/tableMenuModel.ts` | `TYPE_LABELS` gains the three system types (`Auto number`, `Created time`, `Last modified`) — today Modify shows `auto_number` raw | +3 lines |
| `docs/plans/cod-76-field-type-picker-plan.md` + `docs/evidence/cod-76/` | **this plan and its mock** — the mock is 53 KB with the glyphs inlined, so it opens offline in Obsidian's viewer or a browser | — |

**Not touched:** `planTypeChange` and `fieldChange.ts`, the field-type modules, `TYPE_GROUPS`' contents,
`showTypeRows()`, `submit()` / `submitEdit()` / `collectExtras()`, the notes, the undo stack, the option
manager, the link picker, the filter builder, the grid, and every other `<select>` in the plugin.

**No new glyphs, no new dependency.** All 22 icons the picker draws already exist in `src/ui/faIcons.ts`:
the 18 type glyphs (added for the SAD-79 header badges, which COD-67 removed from the header —
`GridView.ts:807` — so the picker becomes their first real consumer) plus `magnifying-glass`,
`chevron-down`, `check` and `xmark`. The FA check (`node scripts/gen-fa-icons.mjs --check`) stays green
with no regeneration; that is a step-1 gate, not an assumption.

---

## 3. The design

### 3.1 Closed row — the trigger

A 39 px row that reads as a field, because it sits in a column of fields — 39 px is exactly the box
the native `<select>` had in the window, so the card's existing offsets survive the swap (measured
against `main`; the SAD-86 board still matches to the pixel):

```
┌──────────────────────────────────────────────┐
│  A   Text                                 ⌄  │   13 px glyph · 12/500 name · chevron
└──────────────────────────────────────────────┘
```

* `bgPill`, 1 px `borderSubtle`, radius 12 — the same paint as the name input above it.
* The glyph is the type's own icon in `textMuted`; when the panel is open it turns `textToday` and the
  chevron rotates 180°, so the control says which state it is in twice over.
* The accessible name is **"Field type: Text"** — the row label folded into the control, because a
  `<label for>` cannot point at a `<button>`.

### 3.2 Open panel

Anchored under the trigger, **the trigger's width** (336 px inside the 384 px card), 6 px below, radius 14,
`bgCard`, one shadow step stronger than the card behind it. Three bands:

| band | contents | height |
|---|---|---|
| search | 11 px magnifier + `Search field types…` + a clear button when text is present | 38 |
| list | 5 sticky group headings + 18 two-line rows | 348 max, then scrolls |
| hint | `↑ ↓ move · ↵ choose · esc close` and a live count (`18 types`, `3 types`, `no match`) | 26 |

Rows are a **14 px icon / name+description / 12 px check** grid, 42 px tall, 9 px radius, 1 px apart.
The current type carries a **tinted row** (9 % accent), a 600-weight name and the check. Hover and the
keyboard cursor share one `bgInner` surface with a 1 px inset border, so "where the pointer is" and
"where Enter will land" never look like two different things.

Geometry and type scale, in full, are the *The spec* table on the mock board (§05 there); the numbers are
the ones to implement, and `tests/visual/capture-add-field.ts` will regress them.

### 3.3 The copy — every description is a fact about this codebase, not a slogan

| type | description | the code it comes from |
|---|---|---|
| Text | One line of words | `string.ts` |
| Long text | Wraps in the cell, then clips | `cellRender.ts` clamp |
| Number | Digits, grouped `1,234,567` | `cellRender.ts` grouping |
| Currency | Money, shown to two decimals | `number.ts` minor units |
| Percent | A 0–1 fraction, shown `25%` | `number.ts` |
| Duration | Stored in milliseconds, shown `1m 30s` | `number.ts` |
| Rating | Stars to the field's Max, then `4/5` | `ratingScale()` |
| Checkbox | A box you click | `renderCheckbox()` |
| Date | A day, `yyyy-mm-dd` | `date.ts` |
| Date and time | Your clock on screen, UTC in the file | `localDateTimeText()` |
| URL | Opens in your browser | `cellRender.ts` |
| Email | Opens your mail app | `cellRender.ts` |
| Phone | Starts a call | `cellRender.ts` |
| Single select | One chip from a list of options | `select.ts` |
| Multi select | One chip per choice | `select.ts` |
| Attachment | A file already in your vault | `attachment.ts` |
| Formula | Computed from other fields, read-only | `formula.ts` |
| Link | Rows in another table | `link.ts` |

Each type also gets **hidden search keywords** so the search answers the word the user actually has in
mind: `money·price·cost·budget·salary → Currency`, `stars·score → Rating`, `clock·timestamp·when →
Date and time`, `day·due → Date`, `done·yes·no·boolean → Checkbox`, `tags·status → the select types`,
`vault·file·pdf → Attachment`, `relation·reference → Link`, `calculate → Formula`, `website·http → URL`,
`mail → Email`, `call·mobile → Phone`, `timer·hours → Duration`, `rate·share → Percent`, `notes →
Long text`, `title·name → Text`. The keyword list is data, in the same table, and tested.

### 3.4 Modify mode — the reason replaces the description

`planTypeChange` already returns `{ ok: false, reason, blockedRows }`. The picker renders a blocked row
**in place, greyed, with that reason where the description would be**:

```
#  Number
   3 values can't convert            ← blockedRows > 0, re-worded with the type's label
⊞  Formula
   Formula fields are created with Add field    ← the existing NOT_A_TARGET reason, unchanged
```

* `aria-disabled="true"`, `tabindex` skipped, click does nothing, `cursor: not-allowed`.
* The row is **not** dimmed as a whole — at 55 % opacity the reason falls to ≈2.5:1, and the reason is the
  one thing on the row that must be read. Only the decorative glyph fades; the name goes `textMuted`
  (5.71 / 6.25) and the reason keeps `textDanger` (4.83 / 5.74).
* The current field's own type is never blocked, and a system type (`auto_number`, …) shows with its own
  label and its own glyph even though it is not a change target — the same guarantee `offersType()`
  makes today, now visible instead of silent.

### 3.5 Colour, measured (not estimated)

Both themes, measured against the surface each word actually sits on. The panel reuses the tokens
COD-75 added — **no new token**.

| pair | light | dark | bar |
|---|---|---|---|
| type name on the panel (`text` on `bgPill`) | **17.14** | **12.92** | 4.5 |
| description on the panel (`textMuted`) | **5.71** | **6.25** | 4.5 |
| description on the tinted current row | **5.20** | **5.51** | 4.5 |
| current row's name on its tint | **15.63** | **11.38** | 4.5 |
| current row's glyph + check (`textToday`) | **4.78** / **4.36** on the tint | **5.09** / **4.48** on the tint | 3.0 (graphical) |
| blocked name (`textMuted`) | **5.71** | **6.25** | 4.5 |
| blocked reason (`textDanger`) | **4.83** | **5.74** | 4.5 |
| group heading | **5.71** | **6.25** | 4.5 |
| hint bar + count (`textMuted` on `bgInner`) | **4.98** | **6.85** | 4.5 |
| search placeholder (`textMuted`, **not** `fieldPlaceholder`) | **5.71** | **6.25** | 4.5 |

Surfaces: the panel paints **`--tablify-bg-pill`**, the same surface the select, attachment and date
panels use (`styles.css:2565`), not the card it floats over — the earlier draft used the card and measured
`6.40` for dark muted text, which is the wrong number for the surface that ships.

Two consequences worth naming:

* the current row's glyph and check use **`--tablify-text-today`** — the AA terracotta COD-75 introduced —
  because the raw accent is 3.28:1 on the white panel and 2.99:1 on its own 9 % tint. The name is
  wrong for a second consumer; the plan **reuses the value through a local alias**
  (`--tp-accent-ink: var(--tablify-text-today)`) rather than renaming a token that shipped this morning.
  A rename to `textAccentInk` is a clean follow-up and is deliberately **not** in this change.
* the search placeholder uses `textMuted`, like every dialog input in the plugin
  (`styles.css:1563`), not the lighter `fieldPlaceholder` the float panels use (2.5:1 — fine as decoration,
  wrong for the only line that tells you what the box does).

---

## 4. Behaviour, stated as rules (so the tests can be literal)

1. **Open** — click the trigger, or `Enter` / `Space` / `ArrowDown` / `ArrowUp` on it, or type a printable
   character while it has focus (which opens with that character in the search). Focus moves to the search
   box unless the pointer is coarse — on a phone the soft keyboard would cover the list, so focus stays on
   the trigger and the list scrolls the current type's group to the top instead.
2. **Search** — filters on label and keywords, case- and accent-insensitive, trimmed; groups with no match
   are dropped; the count in the hint bar follows; no match shows `No field type matches "xyz"` and a
   **Clear search** button that returns focus to the box.
3. **Pick** — click or `Enter` on the highlighted row. `this.type` is set, the trigger repaints (icon, name,
   check moves), the panel closes, focus returns to the trigger, and `showTypeRows()` runs **once** — the
   same function, unchanged, so Options / Min–Max / Regex / Formula / Linked table appear exactly as today.
4. **Dismiss** — `Escape`, a press outside, or `Tab`. Nothing changes; focus returns to where `Tab` says.
   `Escape` never closes the Add/Modify window (see risk R2).
5. **Blocked rows** — visible, `aria-disabled`, no pointer action, reason shown; `Enter` on one does nothing
   and leaves the panel open.
6. **Nothing else moves** — `submit()`, `collectExtras()`, `submitEdit()`, the notices, `onConfirm`'s
   four/five arguments and the edit patch are untouched; a type change is still committed only on **Save
   Field**, still one undo step, and still validated by `planTypeChange` at save time.
7. **Cleanup** — closing removes every listener it added (document press, resize, scroll, keydown); the
   panel element is detached, so opening and closing the window twenty times leaves twenty-nothing behind.

---

## 5. Accessibility

**Model:** the trigger is a `button` with `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls`
pointing at the panel; the panel is `role="dialog"` with `aria-label="Choose a field type"`. Inside it the
search box is a **combobox** (`role="combobox"`, `aria-expanded="true"`, `aria-controls` the listbox,
`aria-autocomplete="list"`, `aria-activedescendant` following the highlighted row) and the list is
`role="listbox"` with `role="group"` + `aria-labelledby` per heading and `role="option"` +
`aria-selected` per row. This is the APG's *combobox with dialog popup* shape: the button that opens a
dialog is honest about what happens, and the search box is a real combobox rather than a fake one.

| key | action |
|---|---|
| `↓` / `↑` | next / previous **selectable** row, wrapping; crosses group headings |
| `Home` / `End` | first / last selectable row |
| `PageUp` / `PageDown` | up / down five rows (a page of the list) |
| `Enter` | pick the highlighted row |
| `Escape` | close; focus back to the trigger; the window stays open |
| `Tab` / `Shift+Tab` | close and continue the window's normal tab order — never trapped |
| printable key | goes into the search box |

* Focus is **moved into the panel** and **returned to the trigger** on close — the whole dialog is one
  focus round-trip, which is what a screen reader needs to hear the list at all.
* The panel is `aria-modal="false"`: it is a popup inside a dialog, not a second dialog.
* `axe-core` over the open panel in both themes: **no critical or serious violations** (same check as the
  date panel, `tests/views/grid/date/datePicker.test.ts`).
* Reduced motion: the 130 ms open transition is dropped under `prefers-reduced-motion`.

---

## 6. Where it lives on screen (the layering problem, solved the way COD-69 solved it)

The Add Field window is an Obsidian `Modal` with `max-height: 90vh; overflow: auto`, so a panel positioned
inside it is clipped at the card's bottom edge and scrolls away from its trigger. The picker therefore lives
**on `document.body`**, exactly like the select, attachment and date panels, and is anchored to the
trigger's `getBoundingClientRect()`:

* `position: fixed`, `left/top` from the trigger, width capped at the trigger width and at `100vw - 32px`;
* `z-index: 1000` — the value the option manager already uses for the "raised over the host modal layer"
  case (`styles.css:3349`), so the panel cannot land behind Obsidian's modal;
* flips **above** the trigger when the list would run past the bottom edge, and caps its list height at
  `min(348, 45vh)` so the hint bar is always on screen;
* follows its trigger on `resize` and on any scroll (`{ capture: true }`, so the modal's own scroller is
  included) — it repositions rather than closing, the way Obsidian's own menus behave;
* the theme class and variables come from `applyTheme()`, because it is outside the `.tablify` subtree —
  the same call `createPanelCard()` makes.

---

## 7. Tests

### New — `tests/views/grid/fieldTypePicker.test.ts` (jsdom, ~38 tests)

| group | what it pins |
|---|---|
| catalogue (5) | 18 rows in 5 groups **in `CHANGE_TARGET_TYPES` order**; every label from `TYPE_LABELS`; every row has an icon; the keyword table covers every offered type |
| trigger (5) | icon + label of the current type; `aria-haspopup/expanded/controls`; accessible name "Field type: Text"; repaint after a pick; system type shows "Auto number" |
| open/close (7) | click, `Enter`, `Space`, `↓`, `↑`; expanded state; search focused on a fine pointer, **not** focused on a coarse one; current group scrolled to the top; `Escape`/outside/`Tab` close without changing; listeners removed |
| search (7) | by label, by keyword (`money`→Currency, `stars`→Rating, `clock`→Date and time, `vault`→Attachment), case-insensitive, groups pruned, count updates, empty state + Clear search restores the list |
| keyboard (7) | `↓/↑` skip disabled and wrap; `Home`/`End`; `PageUp/PageDown`; `Enter` picks; `Enter` on a disabled row does nothing; `aria-activedescendant` follows |
| modify mode (5) | the current type is never disabled; a blocked type is `aria-disabled` **and still present**; its reason is its second line; clicking it changes nothing; `typeBlockReason` returning null enables it |
| window integration (4) | `showTypeRows()` ran once per pick (Options appears for Single select, Formula box for Formula, Min–Max for Number); Save still sends the picked type; Escape in the search does **not** submit; `stopPropagation` keeps `Enter`/`Escape` away from a document-level listener (protects Obsidian's modal) |
| a11y (2) | roles/states are the model in §5; axe-core finds no critical/serious violation |

### Updated

| file | change |
|---|---|
| `tests/views/addFieldModal.test.ts` | helper `pickType(modal, type)` replaces `set('#tablify__af-type', …)`; the optgroup test becomes a row/group test; **+1** "no native `<select>` is left in the window" |
| `tests/views/grid/fieldEditorModal.test.ts` | `dropdown()` helper → `typeTrigger()` + `pickType()`; "offers only types the caller allows" becomes "greys the rest and shows the reason"; the `auto_number` test now expects the label |
| `tests/views/tableView.test.ts` | the integration test drives the picker; asserts the created field and the saved view are unchanged |
| `tests/ui/contrast.test.ts` | **+1** test pinning every pair in §3.5 in both themes |
| `tests/visual/capture-add-field.ts` | selects a type through the UI; new `type-open` state so the parity board also captures the panel; the type list is no longer an "uncomparable" surface |

### Visual

`npx tsx tests/visual/capture-add-field.ts --theme all --viewport all --out docs/evidence/cod-76/shipped`
→ the picker open in light and dark, owner and mobile viewports, plus the existing five states proving the
rest of the window did not move.

### Manual (Obsidian, ~5 min)

1. Add Field → the row shows **Text** with its glyph; click it → the panel opens under it.
2. Type `mo` → Number and Currency; `↑↓` + `↵` → the row updates and the panel closes.
3. `Esc` in the search → the panel closes, **the window stays open**.
4. Drag the window's scrollbar with the panel open → it follows its trigger.
5. Modify a Number column whose cells hold text → **Number** appears greyed with "3 values can't convert".
6. On a phone (or device emulation): tap the row → the list is thumb-sized, the soft keyboard does not open
   on top of it, and the hint bar is visible.
7. Keyboard only: `Tab` to the row, `Enter`, `↓↓→`, `Enter`; focus lands back on the row.

---

## 8. Risks and how each is closed

| # | risk | closure |
|---|---|---|
| R1 | **Clipped or buried by the host modal** | panel on `document.body`, `position: fixed`, `z-index: 1000` (the COD-69 precedent), flip-above + `45vh` list cap; checked in the visual harness at 390 px and 1568 px |
| R2 | **`Escape` closes the whole Add Field window** — Obsidian's modal owns `Escape` | the panel's keydown handler calls `stopPropagation()` for `Enter` and `Escape`, and a test asserts a document-level listener never sees them. The date panel never had to care because it opens from the grid, not from a modal |
| R3 | **`Enter` in the search submits the dialog** — the window binds Enter-in-an-input to `submit()` | the panel is outside `contentEl`, so that listener never sees it; the same test above proves it |
| R4 | **Focus escapes or is lost** — a body-appended panel inside a host modal | focus moves in on open and back to the trigger on close; `Tab` closes and continues the window's order; asserted in the keyboard group |
| R5 | **Touch: the soft keyboard covers the list** | `matchMedia('(pointer: coarse)')` → do not focus the search on open; the list scrolls to the current group instead; the search is one tap away |
| R6 | **Test drift** — three test files and a capture script set the native select directly | all four are updated in the same commit as the control, so CI cannot pass on a control that no longer exists |
| R7 | **Behaviour drift in the save path** | the picker only sets `this.type` and calls the existing `showTypeRows()`; §4.6 lists the functions that must not change, and the whole existing `addFieldModal` / `fieldEditorModal` / `tableView` suites stay green |
| R8 | **18 rows is a lot of scrolling on a phone** | 348 px list ≈ 8 rows; the search is the primary path on touch, the current type is always scrolled to, and the count tells you how many exist |

---

## 9. Steps, each ending in a push and a Linear comment

| step | contents | gate |
|---|---|---|
| **1 — the picker** | `fieldTypePicker.ts`, the CSS section, `AddFieldModal` wiring, `typeBlockReason` in `tableView`, `TYPE_LABELS` system names, all test updates + the new test file | `npx vitest run` (new file green), `npm run test:fields` (untouched, still 102/102), `npm run check` |
| **2 — the visuals** | `capture-add-field.ts` gains the `type-open` state; captures for both themes and both viewports into `docs/evidence/cod-76/shipped/`; eyeball against the mock, fix what drifted | capture script exits 0; panel inside the viewport in all four combinations |
| **3 — the docs** | `CHANGELOG.md` (*Changed*), `docs/user-guide.md` §3 (the type row, search, and the blocked reason), `docs/shortcuts.md` (a short "inside the type picker" table), `spec/features.md` §2.2 note, `docs/evidence/COD-76.md` | `node scripts/check-docs-links.mjs`; `npm run check` |

Linear: **Todo → In Progress** at step 1's commit, a comment per step, and **In review** at the end —
never `Done`.

---

## 9a. Decisions I made for you (all reversible before step 1)

| decision | why this, and what the alternative costs |
|---|---|
| **18 types, not 21** | the picker offers `CHANGE_TARGET_TYPES` — the same 18 Add Field offers today. The three system types (`Auto number`, `Created time`, `Last modified`) exist only to *display* a field that already has one. Adding them as rows means teaching `planTypeChange` to allow read-only targets; out of scope, and it would be the fifth place that list is defined |
| **descriptions are facts, not marketing** | each one is the sentence the code enforces (money → minor units, rating → Max stars, duration → milliseconds). A pretty line that the parser does not keep is a bug report waiting |
| **no "recently used" row** | unasked, and it would make the list order non-deterministic — the one thing the visual parity captures rely on |
| **`typeBlockReason` beside `canPickType`** | `canPickType` returns a boolean and three tests read it; `typeBlockReason` returns `string \| null` and is the one the picker uses. `canPickType` stays as-is so nothing that already compiles changes meaning |
| **`TYPE_LABELS` gains the three system names** | today Modify on a system field renders `auto_number` and `created_time` as raw keys (`AddFieldModal.ts:184`). This is a 3-line data fix, it is visible in the picker, and it cannot change any other screen (nothing else labels those types) |
| **search on name + keywords, not fuzzy** | `mo` should find Number and Currency but not "Format"; a substring match over a hand-written keyword list is predictable, testable, and needs no scoring function to explain itself |
| **panel on `document.body`, `z-index: 1000`** | the values `styles.css:3349` already uses for "raised over the host modal layer" (COD-69's option manager). Anything lower risks the panel landing under Obsidian's modal |
| **`textToday` reused through a local alias** | the value is right, the name is about dates. Renaming a token that shipped this morning would touch every COD-75 file for no user-visible gain; the alias is one line and the follow-up is written down |

## 10. Out of scope (and why)

* **The window around it** — you asked for the list; the card, its rows and its footer stay as they are
  (and as the prototype parity captures pin them at <1 %).
* **The other `<select>`s** — the filter builder's value box, group-by, the link target box. Same native
  problem, different tickets; touching them would break the "nothing else changes" rule.
* **Type conversion rules** — `planTypeChange` is read, never edited. The picker only *reports* its verdict.
* **Renaming `textToday`** to `textAccentInk` — a clean follow-up; doing it here would edit a token that
  shipped this morning for no user-visible gain.
* **A recents/favourites row** — tempting, unasked for, and it changes what the list means.
* **SAD-127** ([`docs/plans/sad-127-field-type-picker-plan.md`](sad-127-field-type-picker-plan.md), the
  other repo, plan-only) is superseded for this codebase: it explicitly deferred descriptions and search,
  which are exactly what you asked for here.

---

## 11. Acceptance criteria

- [ ] The row shows the current type's **glyph + name**, and opens a panel the plugin draws, in **both themes**.
- [ ] All **18** creatable types, in the **same five groups and the same order** as today; Text still the default.
- [ ] Each entry carries a **one-line description that is true of this codebase**, and a search that finds a
      type by the word the user has in mind, not only by its label.
- [ ] Keyboard alone can open, filter, move, pick and dismiss; focus returns to the row; `Tab` is never trapped.
- [ ] In Modify mode, a type that would drop values is **shown, greyed, with the reason** — never silently absent.
- [ ] Every colour pair measured and ≥ 4.5:1 for text (≥ 3:1 for the state glyph), in both themes.
- [ ] The panel is never clipped by the window, never behind it, and fits a 390 px screen.
- [ ] `submit()`, the notices, the edit patch, `onConfirm`'s arguments and the undo granularity are unchanged;
      a type change still commits only on **Save Field**.
- [ ] `npm run check` green: full suite (122 files / 1863 tests today), lint 0 errors and **no new warnings**,
      guards, 150-document link check, FA check, build.
- [ ] `npm run test:fields` still 102/102, and the Add Field visual parity stays under 1 % for the five states
      it already covers.
