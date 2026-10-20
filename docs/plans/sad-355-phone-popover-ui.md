# SAD-355 — the phone country pop-up: UI polish

**Issue:** [SAD-355](https://linear.app/sad-mod/issue/SAD-355/the-phone-number-selection-pop-up-in-the-field-doesnt-look-good) (Improvement, P2)
**Decision record:** [`docs/decisions/country-flags.md`](../decisions/country-flags.md)
**Evidence:** [`docs/evidence/SAD-355.md`](../evidence/SAD-355.md)
**Status:** delivered; **In Review**

---

## 1. The report

> "The phone number selection pop-up in the field doesn't look good."

…and, when asked which surface and what "good" means:

> "The phone number selection pop-up displayed in the field does not look visually appealing. Please
> improve its UI design to make it cleaner, more polished, and consistent with the application's
> existing design system, while preserving its current functionality."

Plus a later instruction: **"Use an icon or flag for each country."**

So this is a design ticket, not a defect report. The plan was written against three testable
criteria — *cleaner*, *consistent with the design system*, *functionality preserved* — and every
change below cites the sibling surface it copies.

## 2. Which pop-up

The Default country popover in **Add / Modify Field** (`CountrySelect`), hosting the shared
`CountryList`. The phone cell panel's country view (`PhonePanel`) renders the same list and is
included wherever a rule is shared, because leaving one polished and the other raw would break the
"consistent" criterion.

## 3. What was actually wrong

The leading finding was measurable, not a matter of taste:

| step | value |
|---|---|
| `.tablify__pmodal` = `min(576px, 100vw − 32px)`, `padding: 24px` | 528 px content box |
| `.tablify__country-trigger` is `width: 100%` | **528 px** trigger |
| `CountrySelect.position()` computes and writes `width = 528` | inline 528 px |
| `.tablify__panel { max-width: 320px }` | **renders 320 px** |

The popover stopped **208 px short of the field it hangs from**, while the Field-type picker in the
same window renders at full field width (`fieldTypePicker.ts:535`; `.tablify__tp-panel` has no
`max-width`). `.tablify__country-popover` had no rule of its own — the cap leaked through a missing
override. On a 390 px viewport the same cap made the popover **10 px wider** than the field.

The rest of the audit found fourteen more items inside the same component; the ones that mattered:

- the search was a bordered box painted the same colour as the card it sat on;
- its placeholder carried `--tablify-field-placeholder` (`#9CA3AF`) at **2.54:1** on the white card —
  the muted ink measures **5.71:1** (in dark the two tokens are the same value, so nothing moves);
- the list sat 16 px under the search while the select panel uses 8 px;
- group headings did not stick, so scrolling 245 rows lost the *Suggested* / *All countries* line;
- **selecting a row shifted its dial**, because the tick was appended to a `space-between` flex row
  only when selected;
- dials were ragged (`+7`, `+880`, `+1 246` with no common edge);
- the clear action floated with no rule above it, and hovered to a *neutral* ink while every other
  clear action in the app hovers to danger;
- the card ended in a hard cut across a scrolled row;
- the popover appeared instantly while the picker beside it animates.

## 4. The design

The popover keeps the float-panel card (radius 16, `bg-pill`, panel shadow) and takes the Field-type
picker's **internal anatomy**, because it does the same job inside the same modal:

```
┌──────────────────────────────────────────────┐  radius 16, 1px border, panel shadow
│  Search country or +code                     │  37 px header, hairline under, no focus ring
├──────────────────────────────────────────────┤
│  SUGGESTED                                   │  sticky heading, Poppins 9 / 600 / .085em
│  🇧🇩  Bangladesh                      +880  ✓ │  grid 22 | 1fr | auto | 14, gap 10, r9
│  ALL COUNTRIES                               │  9 % accent tint + 600 name when chosen
│  🇧🇧  Barbados                     +1 246     │  dials right-aligned, tabular figures
│  …                                           │
├──────────────────────────────────────────────┤
│  No default (use my region)                  │  footer band, bg-inner, hairline, hover danger
└──────────────────────────────────────────────┘
```

Every value is either an existing `--tablify-*` token or a value a sibling surface already ships —
mostly the picker's own. Nothing new was invented.

## 5. Commits

| Commit | What it did |
|---|---|
| `f7ad99f` | **width** — `.tablify__country-popover { max-width: none; overflow: hidden }` releases the panel cap |
| `f313eed` | **search header band** — 37 px, transparent, bottom hairline, no focus ring, AA placeholder, body padding 0 |
| `a3d6d2e` | **one inset + sticky headings** — list `margin: 0; padding: 4px 6px 8px`; headings `sticky`; popover list cap `min(348px, 45vh)` |
| `539fd6e` | **row grid** — `22px \| minmax(0,1fr) \| auto \| 14px`, gap 10, r9, min-height 32; dial column 46 px, right-aligned, tabular |
| `9fb86b3` | **selection** — 9 % accent tint + 600 name + `--tablify-text-today` tick (the picker's current-row treatment) |
| `14e186f` | **footer band** — full-width, `bg-inner`, hairline, hover `--tablify-text-danger`; centred empty state |
| `44468ee` | **entrance** — reuses `tablify-tp-in` (130 ms) + `prefers-reduced-motion` |
| `a60e927` | **flags** — `country-flag-icons` → `src/ui/flags.ts` via `scripts/gen-flags.mjs`; `countryMark.ts`; three call sites; `check:flags`; `LICENSE-FLAGS` |
| this commit | docs, evidence, changelog |

## 6. What did not change

`src/model/phone/*` (the country table, E.164, parsing), `src/views/grid/AddFieldModal.ts`,
`src/views/grid/select/panel.ts`, `src/views/tableView.ts`, `tablify.schema.json`, `formatVersion`,
and every behaviour listed in the evidence file's preserved-functionality table — search scoring,
aliases, the Suggested group, ↑ ↓ Enter Esc, the IME guard, ARIA wiring, dismissal rules and the
write path.

## 7. Deliberately out of scope

**Layer 2** — the magnifier glyph and a `245 countries` count in the footer. Both need TypeScript,
and the wrapper for the glyph changes the list's `previousElementSibling` contract that
`phonePanel.test.ts` uses. They are designed (the mockup shows them) and can land as a follow-up
without touching anything in this change.

## 8. How to verify by hand

1. Add New Field → search `phone` → pick *Phone* → open **Default country**.
2. The card must be exactly as wide as the row above it, with its left edge flush.
3. Type `880`, `bd`, `uk`, `bangla` — the same countries rank as before.
4. Click a country: the dial must **not** move when the tick appears.
5. ↑ ↓ Enter Esc; then reopen and press **Esc** — the popover closes and focus returns to the
   trigger, and the window is still open.
6. Scroll the list: *Suggested* / *All countries* stays pinned at the top.
7. Hover **No default (use my region)**: the ink turns red.
8. Repeat 2–7 in the dark theme and at a 390 px viewport.
