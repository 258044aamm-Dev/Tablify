# COD-75 — the date & time picker: an in-plugin panel instead of the browser's native dialog

**Approved and implemented** — see [`docs/evidence/COD-75.md`](../evidence/COD-75.md) for what shipped.
**Issue:** [COD-75](https://linear.app/code-bro/issue/COD-75/date-time-picker-window) · priority **2 (medium)** · label *Improvement*
**Your answers used here:** **both** `date` and `date_time` · **panel with everything in it** (no inline field any more) ·
**minutes, preserving sub-minute precision** · **same anchored card, clamped** (no bottom sheet).

**Design mock:** [`docs/evidence/cod-75/date-picker-mock.html`](../evidence/cod-75/date-picker-mock.html)
— light, dark, date-only and phone variants, all interactive. The shipped panel is captured beside
it in the same folder (`date-panel-*.png`).

---

## 1. Why the current window cannot be "polished"

`src/views/grid/editors/index.ts:112` gives these fields an **`<input type="date">` / `<input type="datetime-local">`**.
The card that appears when you click the calendar glyph is **Chromium's own date picker**, drawn by the
browser engine outside the page: it is not in the DOM, takes no CSS, cannot be reached by the plugin's
theme variables, and on Android it is not even Chromium's — it is the OS dialog.

So the ticket cannot be closed with CSS. The window has to be *ours*. The good news: the plugin already
has exactly the surface this needs — the prototype's anchored float panel (`#floatPanel`, built in
`src/views/grid/select/panel.ts`), which the select and attachment cells use today: 320 px card,
16 px radius, `--tablify-bg-pill`, 6 px under the cell, flips above it near the bottom edge, closes on
Escape or a press outside.

That is the whole design premise: **a third screen in a container the user has already seen twice.**

---

## 2. What the panel looks like

```
┌─────────────────────────────────────────┐  320 px, radius 16, --tablify-bg-pill
│ ┌─────────────────────────────────────┐ │
│ │ 2026-10-17T14:30              🗓    │ │  30 px field, JetBrains Mono 11.5
│ └─────────────────────────────────────┘ │
│  ‹   October 2026                   ›   │  Poppins 13/600 + mono 11 year
│  MO  TU  WE  TH  FR  SA  SU             │  Poppins 9.5/600, uppercase, muted
│  28  29  30   1   2   3   4             │  other month: muted (5.7:1), clickable
│   5   6   7   8   9  10  11             │  day: 40×36, radius 9, Poppins 12/500
│  12  13  14  15  16 █17█ 18             │  selected: accent fill, on-accent ink 5.2:1
│  19  20  21  22  23  24  25             │  today: 1 px accent ring + #B5573A ink
│  26  27  28  29  30  31   1             │
│ ──────────────────────────────────────  │
│  TIME  ┌────┬────┐                Now   │  only for date_time
│        │ 14 │: 30│                      │  capsule 28 px, mono 12
│ ──────────────────────────────────────  │
│  Today   Clear                     Done │  ghost 26 px · accent pill 28 px
└─────────────────────────────────────────┘
```

Open the mock for the rendered version in both themes.

### 2.1 Decisions inside the card

| Element | Decision | Why |
|---|---|---|
| Value field | Shows the **same text the cell shows** (`2026-10-17T14:30`), mono, editable | Copy a cell, paste into the field — the parser takes it. No second format to learn. |
| Month header | `October` + `2026`, chevrons `‹ ›` | The year is its own chip because the value's year is what people mistype. |
| Week start | **Monday**, from `Intl.Locale.weekInfo` where available, Monday otherwise | Matches the user's locale where the engine reports it; deterministic in tests. |
| Grid | Only the weeks the month needs (5 for October 2026), not a fixed 6 | Less empty paper; the card height stays under ~420 px, so it fits above a mid-screen cell. |
| Selected day | Accent fill + `--tablify-on-accent` ink — the toolbar's active-pill pair | Already audited at 5.23:1 (light) / 5.74:1 (dark). |
| Today | 1 px inset accent ring, ink `#B5573A` light / `--accent-primary` dark (4.78 / 5.09:1) | The bare accent is 3.28:1 on white — too low for 12 px text. `terracottaTextLight` already exists for this exact reason (SAD-80). |
| Other-month days | `--tablify-text-muted`, normal weight, still clickable | They are real targets; the placeholder ink measures 1.79:1, so it is not allowed on text. |
| Time | Two 18 px inputs (`hh`, `mm`) + **Now** | Deliberately *not* a spinner row: spinners are the thing that reads as "native picker". |
| Footer | **Today** · **Clear** ghost; **Done** accent pill | Two of the three are the requests the native dialog never answers. |
| Touch | `@media (pointer: coarse)`: day cells 44×44, card 352 px | Apple/Material minimum hit size; the 40 px cell is fine with a mouse, not with a thumb. |

### 2.2 Theme

Every colour comes from existing tokens (`--tablify-bg-pill`, `--tablify-text`, `--tablify-text-muted`,
`--tablify-border-subtle`, `--tablify-accent-primary`, `--tablify-on-accent`, `--tablify-bg-pill-hover`,
`--tablify-border-pill-hover`, `--tablify-text-danger`, `--tablify-focus`). **One new token** is needed:

```ts
// tokens.ts — lightTheme / darkTheme / cssVars
textTodayLight: palette.terracottaTextLight,   // #B5573A — 4.78:1 on the white card
textTodayDark:  palette.accentOrange,          // #d97757 — 5.09:1 on the pill card
```

That is +1 semantic token, and `tests/ui/contrast.test.ts` (the authority that mirrors
`scripts/check-contrast.mjs`) gets a row for it. Nothing else in `tokens.ts` changes.

---

## 3. The change, file by file

| # | File | Change |
|---|---|---|
| 1 | **`src/views/grid/date/calendar.ts`** *(new, ~140 lines, no DOM)* | Pure month maths: `monthOf(date)`, `gridFor(year, month, weekStart)` → 5–6 weeks of `{ y,m,d, inMonth }`, `addMonths`, `startOfWeek`, `formatYmd`. No `Date` arithmetic in the view (month ends, DST and leap years stay testable). |
| 2 | **`src/views/grid/date/draft.ts`** *(new, ~190 lines, no DOM)* | `DateDraft` — the value being edited and every rule for it: `fromStored(value, type)`, `pickDay(y,m,d)` (keeps the time for `date_time`, **keeps seconds/ms when the wall clock is unchanged**), `setTime(hh,mm)` (seconds → `:00`), `setNow(now)`, `clear()`, `text` (the field's string, also what is committed), `parse(text)` → `{ok}` / `{error}`, `toStored()`. Pure, so the whole commit contract is unit-testable without a browser. |
| 3 | **`src/views/grid/date/DatePicker.ts`** *(new, ~420 lines)* | The card. `createPanelCard('tablify-date-panel', theme, 'tablify__date-body')`, `anchorPanel`, `wirePanelDismiss` — the same three calls `SelectDropdown` makes. Public surface: `open(anchor)`, `close()`, `element`, `destroy()`, and the callback set `{ onCommit(value), onCancel(), onDismiss() }`. Owns focus handling and the ARIA wiring (§5). |
| 4 | **`src/views/grid/editors/index.ts`** | `createEditor` returns `null` for `date`/`date_time` (they are panels now, like `link`). `parseInput`, `commitValue`, `isReadOnly` unchanged — every other type keeps its editor byte-for-byte. The `toLocalDateTimeInput` / `isUnchanged` helpers move into `draft.ts` (they are date logic, not editor logic). |
| 5 | **`src/views/tableView.ts`** | `startEdit`: the existing `single_select | multi_select | attachment` branch gains `date | date_time` → `openCellPanel` → `new DatePicker(...)`. Commit path is the existing `s.setValue(rowId, field.id, value)` inside `afterChange()` — **one undo step**, saved like any edit, no new model path. |
| 6 | **`styles.css`** | A `/* ---- date panel (COD-75) ---- */` block: `.tablify__date-*` rules, `:focus-visible` rings, `@media (pointer: coarse)`. No existing selector is edited; the generic `.tablify__panel` card and every other surface are untouched. |
| 7 | **`src/ui/theme/tokens.ts`** | `textTodayLight` / `textTodayDark` + `cssVars.textToday` (see §2.2). |
| 8 | **`src/ui/faIcons.ts`** | Two glyphs the plugin does not inline yet: `chevron-left`, `chevron-up`. `calendar`, `clock`, `xmark`, `check`, `trash-can` are already there. Regenerated with `node scripts/gen-fa-icons.mjs`; `check:icons` stays green. |

**Explicitly not touched:** `createEditCellCommand`, `setValue`, the store, `dateType`/`dateTimeType`,
`parse`/`serialize`, the schema, `FORMAT_SPEC.md`, Airtable sync, the filter builder, the CSV/XLSX
importers, the grouping and sorting code, `embedView`, and every other cell editor.

---

## 4. Behaviour, exactly

### 4.1 What opens it

| Gesture | Today | After |
|---|---|---|
| Double-click a `date` / `date_time` cell | inline input | the panel |
| `Enter` on the selected cell | inline input | the panel |
| Second tap (touch) / long-press → *Edit cell* | inline input | the panel |
| `cell.edit` from the table menu | inline input | the panel |

No new gesture is added and no shortcut is taken away: the grid's key handling, `SAD-96`'s
double-click/tap rules and the menu's `cell.edit` all route through `startEdit`, which is the one
function that changes.

### 4.2 Commit, cancel, dismiss

| Action | Result |
|---|---|
| Pick a day in a **date** field | commits **and closes** (there is no time left to choose) |
| Pick a day / set time / **Now** / **Today** in a **date_time** field | updates the draft; the panel stays open |
| **Done** / `Enter` | commits the draft, closes, focus returns to the grid |
| Click outside / the panel loses the focus trap to a press elsewhere | commits the draft (same rule as today's blur-commit), closes |
| `Escape` | discards the draft, closes — exactly today's cancel |
| **Clear** | commits `null` (the cell is emptied, one undo step) |
| Draft equals the stored value | **no write at all** — the COD-68 rule (opening a cell and leaving it never writes) is kept, byte for byte |
| Invalid text in the value field | the field shows `aria-invalid`, the message is its `title`, and **Done does nothing** until it parses — the same "keep the editor open" rule as today |

**One undo step per commit**, through `s.setValue` → `createEditCellCommand`, exactly as the select panel
writes. A pick‑then‑Done sequence is *one* undo, not one per click.

### 4.3 Precision (your answer: minutes, preserve sub-minute)

| Case | Rule |
|---|---|
| Stored `2026-10-16T09:30:45.123Z`, user changes only the day | **the time is untouched**: same `hh:mm:ss.mmm` in local time, re-expressed for the new day |
| User edits `hh` or `mm` | seconds and ms become `:00` — an explicitly typed time is a whole‑minute time |
| Stored time is `09:30:45`, user types `09:30` | seconds → `:00`? **No** — the typed pair equals the displayed pair, so the draft is unchanged and nothing is written (the COD-68 no-op rule) |
| **Now** | current instant, seconds **and ms zeroed** (a "now" that carries 743 ms is noise in the file) |
| Stored value has ms, user never touches the time | ms survive — the cell keeps what it had |

This is why `DateDraft` keeps the *instant* and a *“time touched”* flag rather than a formatted string:
that flag is the only way to satisfy both "preserve" and "typing a time means whole minutes".

### 4.4 Format and time zone

* `date` → `YYYY-MM-DD`; `date_time` → ISO 8601 UTC (`toISOString()`), via the existing
  `dateType`/`dateTimeType.parse`, so **the file format does not change**.
* The panel works in the reader's local wall clock — the same model the cell already displays
  (`localDateTimeText`, `docs/user-guide.md` §3/§4) and the same one Airtable uses.

---

## 5. Keyboard & accessibility

| Key | Where | Effect |
|---|---|---|
| `Tab` / `Shift+Tab` | card | value field → `‹` → `›` → day grid (one tab stop, roving) → `hh` → `mm` → Now → Today → Clear → Done |
| `← → ↑ ↓` | day grid | ±1 day / ±7 days, crossing month boundaries (the month view follows) |
| `PageUp` / `PageDown` | day grid | ±1 month; `Shift` + them: ±1 year |
| `Home` / `End` | day grid | start / end of the displayed week |
| `Enter` / `Space` | day grid | pick the focused day |
| `↑ ↓` | `hh` / `mm` | ±1, wrapping 23→0 / 59→0 |
| `Alt+↓` | cell (grid) | open the panel; `Escape` inside the grid still does nothing new |
| `Enter` outside inputs | card | commit + close |
| `Escape` | card | cancel + close |

ARIA: the card is `role="dialog"` `aria-modal="false"` with `aria-label="Pick a date"` /
`"Pick a date and time"`; the grid is `role="grid"` with 7 `columnheader`s and `aria-selected` on the
picked day; day buttons carry `aria-label="Friday 17 October 2026"` (screen readers otherwise read "17");
the month heading is `aria-live="polite"`, so a month change is announced; the time inputs have explicit
`aria-label`s (`Hours`, `Minutes`) and `inputmode="numeric"`; focus is **moved into the card** on open and
**returned to the grid root** on close (the select panel already does the second half).
`axe-core` is run over the open panel in the new test (same harness as `tests/ui/axeGrid.test.ts`).

---

## 6. Tests

Red first, in this order. Every test names the COD-75 behaviour it locks.

### 6.1 New — `tests/views/grid/date/calendar.test.ts` (~10)
Month grid shape for October 2026 / February 2028 (leap) / December (year rollover); Monday vs Sunday
week start; `inMonth` flags; no fixed 6th week when the month does not need one.

### 6.2 New — `tests/views/grid/date/draft.test.ts` (~18)
The §4.3 table row by row, plus: empty → `null`; text round-trip (`2026-10-17T14:30`, `2026-10-17 14:30`,
`17/10/2026`, `tomorrow`? — **no**, only the formats `dateType.parse` already accepts); DST spring-forward
and fall-back days in `Asia/Dhaka` (no DST — so also `Europe/Amsterdam` via a fixed TZ in the test);
seconds/ms preservation; **Now** zeroing; `clear()`; and that `daft.toStored()` is exactly what
`dateTimeType.parse(text)` would produce.

### 6.3 New — `tests/views/grid/date/datePicker.test.tsx` (~22, jsdom)
Markup (field, header, 7 weekday labels, day buttons, time row only for `date_time`), the whole §5 key
table, focus in/out, `aria-*`, Escape vs Done vs outside-press, the invalid-text path, the no-op-on-open
rule, and `axe` with no critical/serious violations.

### 6.4 New — `tests/views/grid/datePanelHost.test.tsx` (~8, jsdom)
Through the real `TableView`: double-click and `Enter` on a `date` cell open the panel and **no**
`input.tablify__editor`; picking a day writes one command (spy on `stack.execute`) and saves; the same for
`date_time`; `Escape` writes nothing; `Clear` writes `null`; `open + dismiss` writes nothing.

### 6.5 Updated — existing files
| File | Change |
|---|---|
| `tests/views/grid/dateTimeEditor.test.ts` (10) | rewritten for the panel — the COD-68 guarantees stay as the assertions (shows the stored instant, open+dismiss is a no-op, ms survive, edit stores ISO UTC, `date` unchanged in kind) |
| `tests/views/grid/editors.test.ts` | `createEditor` returns `null` for `date`/`date_time`; every other type unchanged |
| `tests/e2e/fieldTypes.browser.ts` (Playwright, real Chromium) | the two date cases move from `editor` to `panel`; adds: pick a day, Done, assert the stored value; click outside → commit; Escape → unchanged; the panel is inside the viewport at 390 px **and** 1400 px |
| `tests/ui/contrast.test.ts` | the `textToday` pair |
| `tests/visual/capture-panels.ts` | a `date-panel` screen beside `select-panel` / `attachment-panel`, captured in both themes and both viewports (the script already has the machinery; this is one more `SCREENS` entry) |

---

## 7. Verification plan

| Gate | What it proves |
|---|---|
| `npm run test` | the full unit suite, old + new |
| `npm run test:fields` | real Chromium, 24 field types through the real view — the date rows now drive the panel |
| `npx tsx tests/visual/capture-panels.ts --theme all --viewport owner` | the new `date-panel` screen renders in light and dark (**screenshots go into `docs/evidence/cod-75/`**) |
| `scripts/check-contrast.mjs` + `tests/ui/contrast.test.ts` | every date-panel colour pair ≥ 4.5:1 (body) / 3:1 (rings) |
| `tests/ui/axeGrid.test.ts` + the new axe run | no critical/serious a11y violations in the open card |
| `npm run check` | lint 0 errors, guard, docs links, icons, build |
| manual, Obsidian desktop + phone | §8.3 |

---

## 8. Risks, and how they are handled

| Risk | Handling |
|---|---|
| **Anchoring above a short viewport** | The card is ~300 px (date) / ~360 px (date + time) tall; `anchorPanel` already flips it above the cell and clamps x. The test suite asserts the box is inside the viewport at 390×844 and 1400×900. |
| **The grid re-renders under an open panel** | The card lives in `document.body` (same as the select panel), so a render cannot remove it. Writes go through `setValue` + `afterChange()`, which is what the select panel already does. |
| **Undo semantics** | One `setValue` per commit — no per-click commands. Asserted with a `stack.execute` spy. |
| **Keyboard users lose the plain text path** | They don't: `Enter` on the cell opens the card with the value field **already focused and selected**, so `Enter`, type, `Enter` is unchanged in feel. |
| **Mobile** | No bottom sheet (your answer) — the same card, clamped, with 44 px day cells on coarse pointers. |
| **Regressions elsewhere** | Only `createEditor`'s date branch and `startEdit`'s panel branch change; every other editor, panel and menu is untouched. `npm run check` + `test:fields` + the panel captures are the net. |

---

## 9. Estimated size

| Area | Files | Lines (approx.) |
|---|---|---|
| New source | `calendar.ts`, `draft.ts`, `DatePicker.ts` | ~750 |
| Edited source | `editors/index.ts`, `tableView.ts`, `tokens.ts`, `faIcons.ts` (generated), `styles.css` | ~80 changed, ~230 added CSS |
| New tests | 3 files | ~40 tests |
| Updated tests | 5 files | — |
| Docs | `docs/evidence/COD-75.md`, `docs/evidence/cod-75/*.png`, `docs/plans/cod-75-date-picker-plan.md`, `CHANGELOG.md`, `docs/user-guide.md` §4/§12, `spec/features.md` §2.4 | — |

---

## 10. Found on the way — *not* in this ticket

1. The **filter builder** (`src/views/grid/filterBuilder.ts:424`) takes date conditions through a plain text
   input with the placeholder `value`. It is the next place where a picker would help, and it is **not**
   in this ticket (your answer was "both fields", not "both fields + filter builder").
2. `datetime-local` is still used **nowhere** after this change — worth grepping in the evidence so the
   claim "the native dialog is gone" is checkable.

---

## 11. Manual checklist (after implementation, before review)

1. Double-click a `date` cell → the panel opens under it, focused in the value field; pick a day → it closes, one undo takes it back.
2. Double-click a `date_time` cell → panel with the time row; change the day only → the time is preserved in the file.
3. Type a time → seconds go to `:00`; **Now** → whole minutes.
4. `Escape` after changes → the cell keeps its old value.
5. **Clear** → the cell is empty; undo restores it.
6. Paste `2026-12-24T18:45` into the value field → `Done` → the file carries `2026-12-24T12:45:00.000Z` (Dhaka).
7. Flip Obsidian to dark → every part of the card is themed; no white sheet.
8. On the phone: tap twice → the card fits, day cells are thumb-sized, the time inputs raise the numeric keypad.
9. Tab through the card with the keyboard only; Escape returns focus to the grid.
10. Open a cell and close it without touching anything → the file is **not** modified (check the mtime).

---

### Open questions (answer only if you disagree with a default)

1. **Week start** — Monday, unless the engine reports the user's locale (`Intl.Locale.weekInfo`). OK?
2. **Today + Now zero seconds** — should **Now** keep seconds (`14:30:07`) instead of `14:30:00`? Default: zeroed.
3. **Clear** — one undo step that empties the cell (default), or a "Reset" that restores the value the cell had when the panel opened?
4. **Date field picking a day closes immediately** — or should a `date` field also wait for **Done**? Default: closes, as the native dialog does.
