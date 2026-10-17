# COD-73 — the grid reads like the prototype

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` · **Issue:** [COD-73](https://linear.app/code-bro/issue/COD-73/cell-display-parity-rating-stars-local-timestamps-links-number) (priority 3, Improvement)
Plan and decisions: [`docs/plans/cod-73-cell-display-parity-plan.md`](../plans/cod-73-cell-display-parity-plan.md)

## What was wrong

COD-71 taught the grid six types. Seven more still printed what the file stores: `4` for a rating,
`2026-10-17T14:30:00.000Z` for every timestamp, the bare address for a link field, `1234567` for a
number, `Files/a.pdf, Files/b.csv` for attachments, and one clipped line for long text.

## What changed

| File | Change |
|---|---|
| `src/views/grid/cellRender.ts` | seven builders: `isNumericCellType`, `isTimestampCellType`, `localDateTimeText`, `groupedNumberText`, `ratingScale` + `renderRatingStars`, `contactHref` + `renderContactLink`, `attachmentPaths` + `renderAttachmentChips` |
| `src/views/grid/GridView.ts` | five new branches in the one `fillRow` dispatch, plus the `tablify__cell--numeric` and `tablify__cell--long-text` classes |
| `styles.css` | numeric alignment, stars, the rating label, the cell link, paperclip chips, the two-line clamp |
| `tests/views/grid/cellFormatting.test.ts` | 25 new jsdom tests |
| `tests/e2e/fieldTypes.browser.ts` | a new `runCod73Rendering` pass — 14 checks — and one fixture path for the attachment cell |

The field types' `format()` is untouched. That is the function copy, export and search call, so a
number still leaves the table as `1234567`, a rating as `4`, and a timestamp as its ISO instant.

## How each type reads now

| Type | Cell |
|---|---|
| `rating` 4, default scale | ★★★★☆ `4/5` |
| `rating` 7, `max: 10` | seven of ten stars, `7/10` |
| `rating` empty | five grey stars, no label |
| `date_time` / `created_time` / `modified_time` | `2026-10-17T14:30` in the reader's zone |
| `url` | `<a href="https://…" target="_blank" rel="noopener">`, faint underline |
| `email` / `phone` | `mailto:` / `tel:` link |
| `number` 1234567 | `1,234,567`, right-aligned |
| `attachment` | one paperclip chip per path |
| `long_text` | two lines (one in a small row) |

Deliberate edges: a value the type cannot use (a corrupt `not-a-url`, `twelve` in a number cell,
an unparseable instant) is shown as stored and never becomes a link, `NaN`, or "Invalid Date". A
rating above its scale fills the scale and still prints its number. An attachment cell accepts the
single path the app writes today or the legacy list the panel already reads.

## Tests

`tests/views/grid/cellFormatting.test.ts` — 44 tests, 25 of them new:

| Describe | Pins |
|---|---|
| a rating cell is stars plus the scale (5) | star count, filled count, `4/5`, `aria-hidden` stars, the Max scale, a value above the scale, and that the bare `4` is gone |
| timestamps read as the local wall clock (4) | `date_time` and `created_time`, the stored ISO kept, a corrupt value, an empty cell |
| a number cell groups its digits and sits right (5) | `1,234,567`, `-1,234.5`, `42`, empty, a corrupt value, and the alignment class on exactly the numeric types |
| url, email and phone cells are real links (5) | hrefs and schemes, `target`/`rel`, plain text for a bad address, the click does not select the cell, empty |
| an attachment cell is one chip per file (4) | a list, the single stored path, empty, a corrupt value |
| long text clamps to two lines (2) | the class on `long_text` only, and line breaks stay text |

The COD-71 test that pinned `1234567` / `4` / the raw address was narrowed to the two types COD-73
does not touch (text and date), with a comment saying why.

## Browser verification

`tests/e2e/fieldTypes.browser.ts` (production `TableView`, Chromium) — **100/100**, including 14
new checks: `42.5` stays readable, the numeric class is on the right columns, five filled stars and
`7/5`, the local stamp computed from the stored instant, `https://` / `mailto:` / `tel:` hrefs, the
attachment chip, the long-text clamp.

`/tmp/cod73audit.ts` — 8/8: a click on a link opens a tab and does **not** select the cell; the
model still holds `1234567` and the plain address; double-click on a link cell still opens its
editor; the copy path is untouched.

Screenshots: `repro/cod73-before-{light,dark}.png` → `repro/cod73-after-{light,dark}.png`, plus
`repro/cod73-after-{light,dark}-{small,large}.png` for the row heights. The small-row capture is
the one that matters for the clamp: one line, no half-line.

## Full regression run

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (119 pre-existing warnings) |
| `npm run test` | **117 files / 1770 tests** pass (1745 before + 25 new) |
| `npm run check:guard` / `check:docs` / `check:icons` / `build` | all PASS (docs: 142 files) |
| `npm run test:fields` | **100/100** (86 before + 14 new) |

Untouched: `format()`, the file format, sorting, searching, copy, export, the editors, the panels,
the embed view (it renders through the same `GridView`, so it inherits the new display for free).
