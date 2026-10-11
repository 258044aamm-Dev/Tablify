# SAD-86: Step 7b, Add Field dialog in the prototype layout

- **Linear:** SAD-86, sub-issue 2 of 5 of SAD-82 (Step 7). It builds on the SAD-85 modal card.
- **Date:** 2026-10-11
- **Base commit:** `6a00bac`
- **Prototype source:** `Prototype/index.html` 236–288 (`#addFieldModal`); `Prototype/script.js` `FT_GROUPS`, `showAddFieldModal`, `onFieldTypeChange`, `confirmAddField`, `formulaPreview`.

## Change

### Dialog (`src/views/grid/AddFieldModal.ts`)

The dialog was rebuilt in the prototype layout on the SAD-85 card (`dressProtoModal`, `sm` = 384px, `fa-table-columns` glyph).

- **Title:** "Add New Field".
- **Field name** is a pill input with the prototype placeholder. It is focused on open.
- **Field type** uses the prototype's `FT_GROUPS` as `<optgroup>`s: Basic, Date, Links & contact, Select & attachment, Computed.
  - The list is exported as `TYPE_GROUPS`.
  - The flattened order is still exactly `CHANGE_TARGET_TYPES`, which is the header menu's order (tested).
  - The prototype's System group (created/modified time, auto number) is left out, as before. Those types are not offered by the header menu.
- **Options (one per line)** appears for single and multi select only.
- **Validation rules** sit under a top rule:
  - Required and Unique are shown for every type.
  - Min / Max are shown for number, currency, percent, duration, rating, date and date-and-time.
  - Regex (mono) is shown for text, long text, URL, email and phone.
- **Formula** is a two-row mono box with the prototype's live "Preview (row 1)" line.
- **Linked table** appears for links, defaulting to this table, as in P8-04.
- **Footer:** Cancel, then **Save Field** (primary).
- **Enter** submits from a one-line box or the formula box, as before. In the options box, Enter starts a new line.

**Removed prototype annotations:** "(19 types — spec §2.2–§2.4)", "(Feature 10)", "(D-O1: …)" and "(rows stored by stable row ID)". The old Obsidian setting descriptions are gone too.

### What is saved (`src/model/tableSession.ts`)

`session.addField(name, type, formula?, linkTableId?, extras?)` takes an optional `NewFieldExtras`. `applyNewFieldExtras` copies it onto the field *before* the undoable add command is created, so undo, redo and save see the whole field.

- **Options** are created with `createSelectOptionManager().findOrCreate`, the same factory cell entry uses.
  - Each option gets a generated id and the next colour in turn (the prototype's `i % n`).
  - Blank names and case-insensitive duplicates are skipped.
- **Rules** are written only when set: `required: true`, `unique: true`, `min`, `max`, `regex`. All are FORMAT_SPEC keys that `serialize` already writes (`FIELD_KEYS`); the round trip is tested.
- **Min / Max** are parsed by the field type's own `parse` (`parseInput`), so they are stored in the form the cells use. The prototype uses `Number()` instead.
  - Examples: `5` → 5; `2026-01-05` → `'2026-01-05'`; a duration like `1:30` is stored in milliseconds.
  - A bound that does not parse shows "Min/Max is not a valid … value." and keeps the dialog open. The prototype dropped it silently.
- **Regex** is checked with `new RegExp`. If it is invalid, the dialog shows "The regex is not valid." and stays open.
- **Rules for hidden sections are ignored.** A regex typed and then left behind by switching to Number is not saved.

**Scope decision (option 1, as planned).** The rules are stored only. Nothing in the grid checks cells against them yet: `validationDisplay.ts` is still not wired up (follow-up). The one existing reader is `grouping.ts:73`, where a rating's `max` is the scale in group headings (`3/10`). The user guide (§3) says this plainly.

### Formula preview (`src/model/formulaPreview.ts`)

`previewFormula(fields, firstRow, expression)` builds a throwaway `FormulaEngine` with one extra field. The live table, its runtime and its cache are never touched (tested).

- **Outputs:**
  - The value, as text.
  - An engine error code (`#NAME?`, `#PARSE!`, …).
  - `—` for an empty expression.
  - `(no rows)` without rows.
  - `#ERROR!` if anything throws.
- **Row 1** is the first row in stored order (`getDisplayOrder()[0]`), matching the prototype's `doc.rows[0]`.
- **All fields are used**, including hidden ones (`store.getFields()`), so `{Hidden}` resolves as it does in the grid.

### Wiring (`src/views/tableView.ts` `promptAddField`)

- The extras are forwarded only when the dialog set any. Otherwise `addField` gets exactly the old arguments.
- The preview callback is passed in.

### Styles (`styles.css`, "Add Field (SAD-86)")

**Additive only:** the diff against `6a00bac` removes no line. Every new selector is either a `tablify__af-*` class, used only by this dialog, or `.tablify__pmodal-label` / `textarea|select.tablify__pmodal-input`, which only this dialog uses.

- The body is block flow with sibling margins (`space-y-3`) rather than a flex gap. The trailing `mb-2` / `mb-1` of the rule rows must collapse into the 12px gap, as in the prototype; flex items never collapse margins (this was measured).
- The textareas are `inline-block` on the baseline, like an unreset textarea in the prototype. The line box leaves the same 4px under them.
- The preview line is 10px text on the inherited 16px line. Tailwind's `text-[10px]` sets no line height.
- **Focus:** the prototype's `focus:outline-none` (accent border plus 2px ring, 15% light / 20% dark), scoped to **this dialog only**. The other dressed dialogs keep the SAD-85 outline: their captures are byte-identical to the SAD-85 evidence (12 of 12).

## Verification

### Visual parity

`npx tsx tests/visual/capture-add-field.ts` opens the real `AddFieldModal` (Obsidian modal markup, hostile host CSS) and the prototype's `#addFieldModal` on the same new table. It puts both in the same state, then pixel-compares the cards.

- The prototype's annotation spans are stripped before capture, because the plugin removes them by design.
- **Result:** all 20 combinations (2 themes × 2 viewports × 5 states: text, select, number, formula with `IF(1 > 0, "big", "small")` → `big`, link) have **identical card sizes**, with **0.10–0.83 %** pixels different. Full table: `visual-parity/sad-86/report.md`.
- What remains is two differences accepted in SAD-85, plus anti-aliasing:
  - the **Save Field** ink (on-accent dark ink for AA instead of white);
  - Obsidian's own close ✕.
- **Kept images:** owner, both themes, all states (plugin, prototype, diff), plus mobile text. Any other combination can be regenerated with the script.

Fixes found by the comparison and the measurements:

| Before | Cause | Fix |
|---|---|---|
| Focused name field had an extra outline | Plugin outline vs `focus:outline-none` | Scoped `outline: none` (this dialog) |
| Number/link states 4–6px taller | Flex gap doesn't collapse the rows' trailing margins | Block flow + sibling margins |
| Select/formula states 4px shorter | Textarea was `display: block` | `inline-block` on the baseline |
| Formula state 1–2px shorter | Preview line height 15px vs inherited 16px | 16px |

### Tests

| Area | New tests |
|---|---|
| `tests/model/addFieldExtras.test.ts` | Options (order, ids, colours, blanks, duplicates, select-only); rules written only when set (0 is a bound); date bounds and regex; `addField` without extras adds no keys; extras survive undo / redo and `serialize` → `parse`; `previewFormula` values, error codes, dash, "(no rows)", inputs not mutated |
| `tests/views/addFieldModal.test.ts` | Optgroups in header-menu order; Cancel → Save Field order, Cancel adds nothing; no extras → old arguments exactly; options box per type; Min/Max and Regex per type; required/unique/min/max passed in stored form; date bound; invalid bound and invalid regex warn and stay open; hidden rules not passed; live preview; dash without an evaluator |
| `tests/views/tableView.test.ts` | Through the real view: live preview `1 + 1` → `2`; options stored on the new field; header rendered |

The existing tests were updated only where the layout moved:
- the title is now "Add New Field";
- the save button is the primary footer button, because Cancel now comes first;
- the formula box is a textarea.

All their behaviour assertions are unchanged.

### Gate

| Check | Result |
|---|---|
| `npm run check` | exit 0 |
| Lint | 0 errors, 119 warnings (unchanged) |
| vitest | 1524 tests, 92 files (was 1501 / 91) |
| Guard / docs / icons | PASS |
| Build | OK |
| `npx tsc --noEmit` | 793 (baseline 793, identical per file) |
| Other dressed dialogs (`capture-modals.ts`) | 0 unaccepted; screenshots byte-identical to SAD-85 |

## Follow-ups (not in this step)

- Check cells against the stored rules: wire `validationDisplay.ts` / `applyValidationState` into the grid and add the prototype's invalid badge.
- Optionally give the other dressed dialogs the same outline-free prototype focus.
