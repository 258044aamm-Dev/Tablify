# SAD-90: Step 11 — select panel, option manager and attachment panel

- **Linear:** SAD-90, sub-issue 2 of 5 of SAD-82 (Step 11). Plan: `docs/plans/prototype-visual-fidelity-plan.md` §3 A1–A3, Step 11.
- **Date:** 2026-10-11
- **Base commit:** `7a93a6b` (Step 10 — the phone toolbar and the parity harness)
- **Prototype source:** `Prototype/script.js` 740–1120 (`openPanel`, `renderSelectPanel`, `openAttachmentPanel`, `renderOptMgr`), `#floatPanel` `index.html:472`, `#optMgrModal` `index.html:291–301`, `Prototype/style.css` (the interactive states).

## Change

### 1. Select cell panel (A1 — `src/views/grid/select/Dropdown.ts`)

The orphaned `SelectDropdown` is now the prototype's `renderSelectPanel`: a card anchored under the
cell (`openPanel`: `y = anchor.bottom + 6`, flips above on overflow, x clamped into the viewport), a
search box ("Search or create…"), one row per option with its colour chip, a *Create "…"* row only
when the query has no case-insensitive exact match, and the footer *Clear* + *Manage options*.
Single-select picks and closes; multi-select toggles and stays open. Every write is one undo step
(`setValue`) and option creation is a single `createSetFieldOptionsCommand` (field + cell together),
so one undo takes back both.

Chip paint is one generated `<style>` per panel (`.tablify__panel .tablify__chip--<hue>`), not
per-row inline styles: 200 options opened in 23 ms per row with classes against 147.9 ms with inline
styles (the panel constructor's budget test in `select.test.ts` guards it).

### 2. Option manager (A2 — `src/views/grid/select/OptionManager.ts`)

Rebuilt as `#optMgrModal` on the prototype card (`dressProtoModal`): palette glyph + "Options —
<field name>" header, one row per option (↑ / ↓, colour swatch that cycles the palette, the name
input, trash), "New option…" + *Add*, and the hint line. Every change is routed through the host's
`apply` hook → one `createSetFieldOptionsCommand`; deleting an option carries the cells that
referenced it (`selectOptions.planOptionRemoval`, R-D12) in the same change. The plugin's 9-colour
palette stays (the prototype's 8 are a subset).

### 3. Attachment panel (A3 — `src/views/grid/AttachmentPanel.ts`)

New panel on the same card: paperclip header, the current path(s) with a remove button, the
path input, and a hint. One deliberate difference from the prototype demo: a plugin attachment cell
holds a single vault-relative path (FORMAT_SPEC §3), so the list shows at most one row and adding
replaces it, where the prototype pushed onto an array. The vault check (`checkAttachmentPath`,
P3-04) warns for a path the vault does not have and offers *Save anyway* — a state the product can
reach, which the capture seeds.

### 4. Shared card (`src/views/grid/select/panel.ts`)

`createPanelCard` (`.tablify__panel` + the active theme), `anchorPanel` (fixed, z 70, the
prototype's `openPanel` placement) and `wirePanelDismiss` (a press outside the card or Escape →
`onDismiss`). ``Dropdown`/`AttachmentPanel` append the card to `document.body` so a grid re-render
does not take it down.

### 5. Host wiring (`src/views/tableView.ts`)

`startEdit` routes `single_select` / `multi_select` / `attachment` cells to `openCellPanel` (anchored
on the cell's capsule); the grid keeps focus, and closing the panel returns focus to the grid.
Nothing else in the edit path changed; `embedView` is untouched.

## Verification

`npx tsx tests/visual/capture-panels.ts --theme all --viewport owner,mobile --out .out/panels-all`
(28 s). Card geometry is **identical on all four screens in all four combinations** (select
220×199, attachment 320×136, attachment-with-row 320×146, option manager 448×273 at 1568×795 /
358×288 at 390×844), and no part of any screen has a computed-style difference except the two
registered below.

| crop (card + 8px right/bottom) | light owner | light mobile | dark owner | dark mobile |
|---|---|---|---|---|
| select panel | 0.29 % | 0.72 % | 0.42 % | 0.91 % |
| attachment panel | 5.43 % | 6.25 % | 5.39 % | 6.14 % |
| attachment + one row | 5.12 % | 5.26 % | 5.09 % | 5.17 % |
| option manager | 0.74 % | 0.88 % | 0.60 % | 0.71 % |

Reports, crops and stacked montages: `docs/evidence/visual-parity/sad-90/`.

**Dark option-manager ink (fixed):** the prototype's `#optMgrModal` card carries no colour class, so
its ink — the header's `h3` above all — inherits `body.dark`'s Tailwind gray-100 (#F3F4F6), while the
plugin's darker body ink is the warmer #ECE7E1. New token `modalInkDark` (`--tablify-text-modal`),
applied to the option-manager card and its title. Dark owner 1.00 → 0.60 %, dark mobile 1.18 →
0.71 %; the computed-style difference is gone.

### Registered differences (not fixed, on purpose)

1. **The attachment hint copy.** The prototype line is demo narration ("… (spec §2.3). File picking
   is Obsidian-side — simulated here."); the plugin says what it actually does ("Vault-relative path
   — the file is checked when you press Enter. An unknown path still saves once you confirm."). The
   hint band is ≈85–93 % of the attachment crops' differing pixels (card y 96–128).
2. **`empty` `margin-bottom` (0px vs 8px).** The plugin puts the 8 px after the list, the prototype
   on the empty row itself; the card box is identical in every combination.
3. **Rasterisation.** The remaining pixels on the select (0.29–0.91 %) and option-manager
   (0.60–0.88 %) crops — and the rest of the attachment ones — are the accepted AA class: Chromium
   paints the inlined Font Awesome paths and Lora about a pixel differently from the prototype's
   webfont at 10–12 px. Verified not a geometry problem: rendering the inlined `trash-can` /
   `arrow-up` paths and the FA 6.4.0 webfont side by side at 128 px gives identical shapes.
4. **One path per attachment cell** (the prototype's array is a demo shape; FORMAT_SPEC §3 keeps one
   vault-relative path).
5. **Click-to-open.** The prototype opens a panel on a plain cell click (`script.js:537` → `654` →
   `667–669`); the plugin opens it on Enter on the focused grid (a click only moves focus). Behaviour
   parity, not visual — recorded here, left as-is pending an owner decision.

### Keyboard (acceptance)

Esc closes (and focus returns to the grid), Enter picks the highlighted option, ↑/↓ move the
highlight, IME composition never commits — `tests/views/grid/selectPanels.test.ts` (11 tests,
including a new "Escape closes the panel and returns focus to the grid").

### Gate

`npx vitest run` 95 files / 1545 tests green; `npx eslint src/ tests/` 0 errors / 119 warnings;
`npm run check:icons` PASS. The capture route itself was extended for phones: the frozen first
column intercepts clicks on the columns a 390 px pane scrolls off-screen, so the mobile run reaches
the cell with ArrowRight + Enter (the grid's own keyboard route) and each screen asserts that both
panels opened — a missed panel can no longer be written silently.
