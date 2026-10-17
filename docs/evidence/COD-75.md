# COD-75 — the date & time picker: the plugin draws the window now

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` · **Issue:** [COD-75](https://linear.app/code-bro/issue/COD-75/date-time-picker-window) (priority 2, Improvement)
Plan: [`docs/plans/cod-75-date-picker-plan.md`](../plans/cod-75-date-picker-plan.md) ·
Design mock: [`cod-75/date-picker-mock.html`](cod-75/date-picker-mock.html)

## The finding that shaped the fix

The window the ticket is about was **not the plugin's**. `src/views/grid/editors/index.ts:112` gave
`date` and `date_time` cells:

```ts
inp.type = field.type === 'date' ? 'date' : field.type === 'date_time' ? 'datetime-local' : 'text';
```

so the card that opens is **Chromium's date picker** — drawn by the engine outside the page. It is
not in the DOM, takes no CSS, ignores the plugin's theme (a white sheet in dark mode), and on
Android it is not Chromium's calendar at all but the OS dialog. There is no way to "improve its
layout, spacing and typography" from the plugin side; the window had to become ours.

Before → after, headlessly:

```
before   <input type="date">            → browser dialog, unstyleable, unthemed
after    [data-testid="tablify-date-panel"]   → the plugin's own card (DOM, CSS, theme tokens)
```

## What shipped

| File | Role |
|---|---|
| `src/views/grid/date/calendar.ts` | Pure month maths: the weeks a month needs (5 for October 2026, never a padded sixth), leap years, year rollover, locale week start (`Intl.Locale.weekInfo`, Monday fallback), spoken day labels |
| `src/views/grid/date/draft.ts` | Every edit rule: untouched draft → the stored value verbatim; picking a day keeps hours/minutes/seconds/ms; a typed time means whole minutes; a corrupt stored value survives |
| `src/views/grid/date/DatePicker.ts` | The card, built on the prototype's `#floatPanel` (`select/panel.ts`): value field, month grid with a roving tab stop, time row + **Now**, footer **Today / Clear / Done** |
| `src/views/tableView.ts` | `startEdit` routes `date` / `date_time` to the card; a commit is one `setValue` command |
| `src/views/grid/editors/index.ts:112` *(@ `3eb74fe`, before)* | `<input type="date" \| datetime-local">` — the line the ticket is about |
| `src/views/grid/editors/index.ts` | `createEditor` returns `null` for both types — no native date control is created anywhere |
| `src/ui/theme/tokens.ts` | `textToday` — the only new token (AA: 4.78:1 light, 5.09:1 dark) |
| `styles.css` | A self-contained `/* ---- date & time panel (COD-75) ---- */` block; no existing selector edited |
| `scripts/gen-fa-icons.mjs` → `src/ui/faIcons.ts` | `chevron-left` (the month stepper) |

**Not touched:** the store, `createEditCellCommand`, `dateType` / `dateTimeType`, parse/serialize,
the schema, `FORMAT_SPEC.md`, Airtable sync, the filter builder, CSV/XLSX import and export, the
cell renderers, grouping and sorting, and every other cell editor.

## Behaviour, in the terms the ticket asked for

| Requirement | Where it is met |
|---|---|
| "layout, spacing, typography" | 320 px card · 12 px body · 30 px field (mono 11.5) · 36 px day cells, 2 px gap · 28 px clock · 26 px ghosts · 28 px Done. Table in the mock's *Geometry & type* section |
| "polished, modern" | the same tokens, radii and shadow as the select/attachment panels, so it is one visual language |
| "preserving the existing functionality" | same gestures (double-click / Enter / second tap / long-press → Edit cell), same commits (Enter/Done/blur commit, Escape cancels), same stored formats, same undo granularity |
| "works across supported screen sizes" | the card is clamped into the viewport and flipped above the cell near the bottom edge — measured **6 px under the cell, fully inside** at 1568×795 and 390×844 |
| "light and dark modes" | every colour is a theme variable; both themes captured |

### The rules that could have lost data

| Case | Rule | Test |
|---|---|---|
| Open a cell, close it | **nothing is written** — an untouched draft returns the stored value byte for byte | `draft.test.ts`, `datePanelHost.test.ts` |
| Stored `…09:30:45.123Z`, change only the day | the clock survives **with seconds and ms** | `draft.test.ts` |
| Type `hh:mm` that differs | seconds → `:00` (`15:30:45` → `15:31:00`) | `draft.test.ts` |
| Retype the *same* clock | nothing is lost; the value is unchanged | `draft.test.ts` |
| **Now** | the current minute, seconds and ms zeroed | `draft.test.ts` |
| Clear | one undo step that empties the cell | `datePanelHost.test.ts` |
| A value the field type cannot parse in the file | kept verbatim; the panel shows the text and writes nothing while untouched | `draft.test.ts` |

## Verification

### Unit — `npm run test`

| Suite | Result |
|---|---|
| `tests/views/grid/date/calendar.test.ts` *(new)* | 13 pass |
| `tests/views/grid/date/draft.test.ts` *(new)* | 23 pass |
| `tests/views/grid/date/datePicker.test.ts` *(new)* | 34 pass (incl. axe-core over the open card) |
| `tests/views/grid/datePanelHost.test.ts` *(new)* | 10 pass — through the real `TableView` |
| `tests/views/grid/dateTimeEditor.test.ts` (COD-68, re-pointed at the panel) | 11 pass |
| `tests/views/grid/editors.test.ts` | 9 pass (+1: both types build no editor) |
| `tests/ui/contrast.test.ts` | 15 pass (+1: `textToday`) |
| **Whole suite** | **122 files / 1863 tests** pass (was 118 / 1780 → **83 new**), 0 failures |

`npm run lint` → **0 errors**, **119 warnings — the same count `main` has**, so the panel adds no
new warning. (Two drafts did: the host test's six non-null assertions and one in `editors.test.ts`;
both are now explicit `throw`s.)

### Browser — `npm run test:fields` (real Chromium, the production `TableView`)

**102/102 pass.** The two date rows moved from `editor` to `panel`, and three new checks pin the
claim this ticket makes:

```
PASS  date: double-click opens panel
PASS  date: picking a day stores YYYY-MM-DD
PASS  date: the panel closes on the pick
PASS  date_time: double-click opens panel
PASS  date_time: picking a day and a time stores ISO UTC
PASS  date_time: the panel closes on Done
PASS  date_time: the panel replaces the native input
PASS  date_time: the panel shows the stored instant
PASS  date_time: open + click away preserves the value
PASS  date: unchanged after open + Escape
PASS  no native date input is ever created          ← document.querySelectorAll('input[type=date]') === 0
```

### Visual — `npx tsx tests/visual/capture-date-panel.ts` (new script)

```
light/owner:  320×393 at (1236,306) in 1568×795 · gap under cell 6px · INSIDE
light/mobile: 320×393 at (58,338)   in 390×844  · gap under cell 6px · INSIDE
dark/owner:   320×393 at (1236,306) in 1568×795 · gap under cell 6px · INSIDE
dark/mobile:  320×393 at (58,338)   in 390×844  · gap under cell 6px · INSIDE
```

Screenshots in this folder: `date-panel-{light,dark}-{owner,mobile}.png` (the card) and
`…-page.png` (the card in the grid). The 6 px gap is the prototype's `openPanel()` rule, the same
one the select and attachment panels follow.

### Accessibility

* `axe-core` over the open card: **no critical or serious violations** (`datePicker.test.ts`).
* Colour pairs (measured, in `tests/ui/contrast.test.ts`): selected day ink on the accent 5.23:1
  light / 5.74:1 dark; day numerals 17.14 / 12.92; today's numeral 4.78 / 5.09; muted labels and
  the neighbouring-month days 5.71 / 6.25; danger **Clear** 4.83 / 5.74.
  Why it matters: the bare accent is **3.28:1** on the white card, so "today" cannot use it —
  `textToday` carries the AA terracotta already used for the "N selected" label (SAD-80).
* ARIA: `role="dialog"` card, `role="grid"` with `columnheader`s and `aria-selected`, a spoken
  label per day ("Saturday 17 October 2026"), `aria-live="polite"` month heading, labelled
  `hh` / `mm` inputs, focus moved into the card on open and returned to the grid on close.

## Constraints checked

- **No new gesture, no removed shortcut:** double-click, Enter, the second touch tap, the
  long-press menu's *Edit cell* and the table menu's **Edit cell** all still call `startEdit`,
  which is the only function whose routing changed.
- **One undo step per commit** — a pick-then-Done sequence is one step, not one per click
  (`datePanelHost.test.ts` spies on `stack.execute`).
- **The file format did not move:** commits still go through `dateType.parse` /
  `dateTimeType.parse` → `YYYY-MM-DD` / ISO 8601 UTC. Airtable sync and the schema are untouched.
- **The panel lives in `document.body`** (like the select panel), so re-rendering the grid under it
  cannot take it down.

## What could not be verified headlessly

Nothing about the rendered card — it is a real DOM node, and both themes are captured. What is
*not* covered is Obsidian's own mobile keyboard behaviour when the `hh`/`mm` inputs take focus
(`inputmode="numeric"` is set; the OS decides the keypad). That is the manual step below.

## Manual check in Obsidian (~4 minutes)

1. Double-click a Date cell → the card opens under it; pick a day → it closes and the cell updates; **Ctrl/Cmd+Z** restores it.
2. Double-click a Date and time cell → change the day only → **Done**; the file shows the same time as before, seconds included.
3. Type `18:45` in the time boxes → **Done**; the stored value ends `:00Z`.
4. Change something, press **Escape** → the cell keeps its old value.
5. **Clear** → the cell is empty; undo restores it.
6. Paste `2026-12-24T18:45` into the value field → **Done** → the file carries the same instant in UTC.
7. Switch Obsidian to dark → every part of the card is themed.
8. On a phone: tap twice → the card fits the screen, the days are thumb-sized, the time boxes raise a numeric keypad.
9. Tab through the card with the keyboard only; Escape returns focus to the grid.
10. Open a cell, close it without touching anything → the file's modification time does not change.

## Notes

- The week starts on **Monday** unless the engine reports a different locale start
  (`Intl.Locale.weekInfo`). That is presentation only — it cannot change a stored value.
- `datetime-local` now appears **nowhere** in `src/` (`grep -rn "datetime-local" src/` → 0 hits
  outside comments), which is the checkable form of "the native dialog is gone".
- The **filter builder**'s value box (including for a date field) is still a plain
  text input (`src/views/grid/filterBuilder.ts:425`). It was explicitly out of scope; a picker there is a natural follow-up.
