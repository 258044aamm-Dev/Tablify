# COD-71 — cells render what their value means

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` · **Issue:** [COD-71](https://linear.app/code-bro/issue/COD-71/issue-single-select-fields-use-hard-coded-options-instead-of-imported) (priority 1, Bug)
Commits: `28b6f51` (renderer + tests), this one (docs)
Plan: [`docs/plans/cod-71-cell-formatting-plan.md`](../plans/cod-71-cell-formatting-plan.md) ·
Investigation: [`docs/plans/cod-71-cell-rendering-audit.md`](../plans/cod-71-cell-rendering-audit.md) ·
Follow-up for the remaining types: [COD-73](https://linear.app/code-bro/issue/COD-73/cell-display-parity-rating-stars-local-timestamps-links-number)

## What was reported, and what was true

> I imported data from a CSV file, but some fields were assigned the Single Select field type.
> Instead of using the actual values from the imported CSV data, these fields are currently
> displaying predefined, hard-coded options.

The import was correct all along. `src/io/import/build.ts` builds each select field's options **from
the distinct values in the file** (first-seen order, palette colours) and maps every cell through the
name→id map it just built; the serializer/parser round-trip is asserted inside `buildTable`. The
dropdown, copy, search, group headers and export all read those option names.

The defect was one branch in `src/views/grid/GridView.ts`:

```ts
text.textContent = val == null ? '' : String(Array.isArray(val) ? val.join(', ') : val);
```

A select cell stores an **option id**, so the grid printed `opt_xbYYVvk…` — indistinguishable, to a
reader, from a "predefined hard-coded option". The same line was wrong for five more types whose
stored form is not their display form.

## The audit: six types, not two

One row carrying a value for every registered type was rendered through the production bundle and
compared with `format()` and with the prototype (`Prototype/script.js` `FT.*.fmt`).

| Type | Stored | Before | After |
|---|---|---|---|
| `single_select` | `opt_a` | `opt_a` | chip **Alpha** + colour dot |
| `multi_select` | `[opt_a, opt_b]` | `opt_a, opt_b` | chips **Alpha** **Beta** (smaller, no dot) |
| `currency` | `123456` (minor units) | `123456` | `1234.56` |
| `percent` | `0.25` | `0.25` | `25%` |
| `duration` | `90000` (ms) | `90000` | `1m 30s` |
| `checkbox` | `true` | `true` | a clickable, ticked box |
| text, number, date, rating, url/email/phone, attachment, auto/created/modified, formula, link | — | — | **unchanged** |

Why the ticket reads as a select bug: CSV/XLSX inference can only produce text, number, date,
checkbox and single select (`TYPE_MAP` in `build.ts`), so an imported table can only hit select,
checkbox and plain numbers — and select is the loudest, because every imported row has a value.

Every other surface was checked and was already correct: copy cell/row (`formatValue`), search
(`searchableText`), group headers, link chips, link picker, dropdown, query builder, CSV / Markdown /
XLSX export. `TableView` and embeds share the one `GridView`, so the fix reaches both.

## What changed

**`src/views/grid/cellRender.ts` (new)** — pure DOM builders, no store, no commands:

- `selectOptionIds()` — the ids a select cell holds, in stored order; a wrong-shaped value (corrupt
  file) yields nothing rather than a guess.
- `renderSelectChips()` — one `.tablify__chip` per resolvable id; single select carries the colour
  dot, multi select uses the prototype's smaller chip and a space between chips (so `textContent`
  reads `Alpha Beta`, not `AlphaBeta`). Colours: `optionChipColors(option.color, theme)`, the exact
  call the group header already makes — no new palette, no per-hue CSS.
- `createCheckboxControl()` — a `<button role="checkbox" aria-checked>` when a handler is wired,
  a `<span role="img">` when not (so a caller that never wired it still renders a working cell).
- `formattedCellText()` / `isFormattedCellType()` — `getFieldType(type).format(value, field)` for the
  three unit types.

**`GridView.fillRow()`** — the chain is now: formula error → link chips → select chips → checkbox →
`format()` for currency/percent/duration → `String(value)` for everything else. The last line is
untouched, which is what keeps text/number/date/rating/url/attachment/system identical (an array value
there still joins with `, `, as before).

**`TableView` / `EmbedView`** — `onToggleCheckbox(row, col)` writes through the session's `setValue`
(one command → one undo entry → saved). The embed goes through `doc.mutate`, so both embeds and the
full view see the change and it is written once. The click is `stopPropagation` + `preventDefault`, so
the cell is not selected and no inline editor can open; a double click on the box is two toggles, never
an edit.

**`scripts/gen-fa-icons.mjs`** — learned regular-set entries (`{ set: 'regular', name: 'square' }`);
the unchecked box needs the outline glyph the prototype uses (`fa-regular fa-square`), not the filled
solid one. `src/ui/faIcons.ts` regenerated; `check:icons` passes.

**`styles.css`** — `.tablify__chip--cell` / `.tablify__chip--multi` (cell sizing, prototype's 10px
multi chip), `.tablify__cell--select > .tablify__capsule` (the chip needs 18px inside a capsule whose
padding leaves 16; each row height keeps its own padding), and `.tablify__check` (button reset, 14px —
the tallest glyph a large row's capsule can hold, terracotta when ticked, muted when not,
`:focus-visible` ring). Tokens only — no colour literals.

## Verification

### Gate

- `npm run check`: **116 test files / 1740 tests** (was 115 / 1721), lint **0 errors** (119
  pre-existing warnings), `.tabula` guard, docs links (**138** md files), FA icons, build.
- `npm run test:fields` (Chromium, production `TableView`): **86/86** (was 77/77).

### New jsdom tests — `tests/views/grid/cellFormatting.test.ts` (19)

| Group | Assertions |
|---|---|
| Selects (8) | one chip with the option name; chip + dot painted; light and dark inks differ (the theme is really read); no `opt_` in the cell; multi keeps stored order, uses the smaller chip, no dot, `textContent === 'Alpha Beta'`; empty single/multi render nothing; an unknown id renders nothing and never prints the id while its resolvable neighbours survive; a wrong-shaped value renders nothing |
| Units (4) | `1234.56` / `25%` / `1m 30s` **and** the stored `123456` / `0.25` / `90000` unchanged; empty unit cells render empty, not `0` |
| Checkbox (4) | ticked vs empty box for `true` / `false` / `null` with `aria-checked`; a click reports `(row, col)`, is `defaultPrevented`, and leaves `getSelection()` null; a double click never reaches `onCellActivate`; without a handler it is a read-only `role="img"`, not a dead button |
| Unchanged (2) | text / number / date / rating / url render byte-identical; `role`, `aria-colindex` and the `.tablify__cell-text` host are untouched |
| Import → render (1) | `buildTable()` on a CSV whose values (Alpha/Beta/Gamma) exist in no preset → parse the produced file → every chip reads the CSV value, none starts with `opt_` |

### `test:fields` additions (the old pin, updated on purpose)

- `fld_single → 'Alpha'`, `fld_multi → 'Alpha Beta'`, `fld_cur → '1234.56'`, `fld_pct → '25%'`,
  `fld_dur → '1m 30s'` (the previous pin asserted the raw values — changing it was the decision the
  pin existed to force).
- one chip in the single cell, two in the multi cell, and **no cell anywhere contains `opt_`**;
- a checkbox click: value flips, the cell selection does not move, no editor opens, `aria-checked`
  follows, and **one toolbar Undo restores the old value**.
- still pinned as raw (unchanged): text, formula and everything in the read-only matrix.

### Screenshots

- `repro/cod71-import-after.png` — a CSV import (Task / Status / Priority / Archived) rendering
  chips and boxes, dark.
- `repro/cod71-alltypes-dark.png`, `repro/cod71-alltypes-light.png` — 16 types, both themes.
- `repro/cod71-panel.png` — before the fix: the same imported table with `opt_…` cells while the
  dropdown showed the right names (kept as the reproduction).

## Blast radius

| Area | Effect |
|---|---|
| Stored data / file format | none — display only; the tests assert currency/percent/duration keep their units and selects keep ids |
| Sort | none — sorts on raw values (`viewOrder.sortText`) |
| Copy / search / export | none — they already used `format()`; `export/view.ts` keeps `true`/`false` and raw numbers, so CSV → export → import is still lossless |
| Group headers, link chips, dropdown, query builder | none |
| Undo | one new command source (checkbox), same `setValue` path → exactly one entry per click |
| Selection / keyboard | the box consumes its own clicks and double clicks; the grid's shortcuts are untouched |
| Embeds | same `GridView`; the checkbox writes through `doc.mutate` |
| Row heights | select cells trade capsule padding for the chip (34 / 28 / 40 px capsule heights unchanged); checkbox glyph sized to fit the tightest (large) row |
| Emptiness | the em dash is still CSS on an empty `.tablify__cell-text`, so "no chip" and "no value" look the same, as before |
| Performance | 1–2 extra nodes per affected cell in the ~30 rendered rows; no measurable change in the suite |
| Visual parity | improves — the grid now draws the prototype's chip and box |

## Deliberate choices

- **`format()` for the units, a bespoke chip for the selects.** `format()` already had the right text
  for currency/percent/duration (it is what copy and export print); selects needed markup, not text,
  because the prototype draws a chip. One answer per job.
- **Clickable checkbox, not a tick glyph.** The user's call: the prototype's box is interactive, and
  routing it through `setValue` keeps undo, save and sync identical to any other edit.
- **Unknown option ids render nothing.** Guessing (a placeholder chip, the raw id) would invent data;
  rendering nothing matches `format()`, copy, search and export, and the id stays in the file.
- **The `test:fields` pin is updated, not deleted.** It now pins the rows that *did not* change
  (formula, text, read-only types) and proves the changed ones with explicit expectations and the
  undo proof — the same "a change must be a visible decision" rule that created it.
- **Regular-set support in the icon generator** rather than hand-editing the generated file, so
  `check:icons` keeps its meaning.
