# COD-73 — cell display parity: the seven types COD-71 left raw

**Issue:** [COD-73](https://linear.app/code-bro/issue/COD-73/cell-display-parity-rating-stars-local-timestamps-links-number) · priority 3 · Improvement · project Tablify
**Baseline:** `main` @ `e081d19` (COD-70 delivered)
**Outcome:** `src/views/grid/cellRender.ts`, `src/views/grid/GridView.ts`, `styles.css`, tests and docs.

---

## 1. What the ticket asks

COD-71 made six types show what their value means. Seven more still printed the stored form:

| Type | Before | After |
|---|---|---|
| `rating` | `4` | five stars filled to `4` + `4/5` (ten stars for a Max of 10) |
| `date_time`, `created_time`, `modified_time` | `2026-10-17T14:30:00.000Z` | local `2026-10-17T14:30` |
| `url`, `email`, `phone` | plain text | a link (`https://…`, `mailto:`, `tel:`) |
| `number` | `1234567` | `1,234,567`, and the numeric columns right-aligned |
| `attachment` | `Files/a.pdf, Files/b.csv` | one paperclip chip per file |
| `long_text` | one clipped line | clamped to two lines |

Non-negotiable, from the ticket: sorting, searching, copy and export keep reading **stored** values;
only the rendering changes.

## 2. Where the work goes

`src/views/grid/cellRender.ts` already owns the value-to-DOM rules (COD-71), and
`GridView.fillRow` is the one dispatch that decides which builder draws a cell. The field types'
`format()` stays untouched — it is what copy, export and search call, and changing it would leak
`1,234,567` into CSV files and the clipboard.

## 3. Decisions

**Rating scale = `field.max`, default 5.** The group headings already do exactly this
(`grouping.ts` → `${key}/${max}`), so a cell and its group header can never disagree. The type
validates 1–10, so the scale is clamped to that range; a value above the scale fills the scale and
still prints its number (`7/5` for a 7 in a default field, which is what the heading says too).

**Empty ratings draw their stars, without a `0/5` label.** The prototype draws five grey stars for
an empty value, and the checkbox already draws an empty box (COD-71). The label is the part that
carries meaning, so it is only drawn when there is a value.

**Timestamps use the editor's wall clock.** `2026-10-17T14:30` — the local form COD-68's
`date_time` editor opens with. The prototype's `Oct 17, 2026 14:30` was rejected deliberately: the
ticket names the ISO-like local form, and a date that changes shape when you open it is worse than
one that reads like a machine. `date` is untouched (it is already what a person typed, and the
ticket does not list it).

**Links keep the cell's ink.** The prototype paints them sky blue. A table with a URL column would
then be a page of blue links; the cell instead carries a faint underline that turns accent-coloured
on hover and keyboard focus. The link owns its click (`stopPropagation`), like the checkbox — a
click opens the address, it does not select the cell. A value that is not a usable address
(a corrupt `example` in a URL column) is plain text, never a link, so a stray value cannot navigate
the window.

**Numeric alignment follows the prototype's `align: 'right'`.** number, currency, percent, duration
and auto number sit right; rating does not (it is stars plus a label), and neither does a formula
that happens to produce a number — the prototype does not align those either.

**Attachments read the same two shapes the panel reads.** `AttachmentPanel.paths()` accepts a single
path (what the app writes today) or a legacy list; the renderer uses the same rule, so an imported
file with a list shows one chip per entry.

**Long text clamps to what fits.** Medium and large rows fit two 14px lines once the capsule trades
its vertical padding (the same trade select cells make for their chip, COD-71); a **small** row is
28px and clamps to one line rather than clipping a half line.

## 4. What was deliberately not done

- **Clicking a star to rate.** The prototype's stars are clickable; the ticket asks for display
  ("five stars (filled up to the value) + `4/5`"), so stars are `aria-hidden` decoration here and
  rating is still edited through the cell editor. A click-to-rate gesture is its own ticket
  (touch targets, undo granularity, the 1–10 range).
- **Opening an attachment.** A chip names the file and carries the path as its tooltip; it does not
  open it (the panel already opens attachments).
- **Right-aligning the editor input.** The inline editor is a separate element; the prototype has
  the same left-aligned input over a right-aligned cell.

## 5. Verification

- `tests/views/grid/cellFormatting.test.ts` — 25 new jsdom tests (44 in the file), one per rule
  above plus the corrupt-value cases.
- `tests/e2e/fieldTypes.browser.ts` — 14 new checks in a new `runCod73Rendering` pass (100 total),
  against the production `TableView` in Chromium: grouped digits, numeric alignment, stars and the
  `7/5` label, the local stamp computed from the stored instant, the three link schemes, the
  attachment chip and the long-text clamp.
- Browser probe `/tmp/cod73audit.ts` — 8 checks: a click on a link opens a tab and does **not**
  select the cell, the model keeps raw numbers, double-click still opens the editor, the stored
  values are untouched.
- Screenshots: `repro/cod73-before-{light,dark}.png`, `repro/cod73-after-{light,dark}.png`,
  `repro/cod73-after-{light,dark}-{small,large}.png` (row heights).
- Full gate: `npm run check` (lint, 117 files / 1770 tests, guard, docs, icons, build) and
  `npm run test:fields` (100/100).
