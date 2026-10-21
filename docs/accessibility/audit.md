# Tablify — Accessibility Audit (P6-03)

**Date:** 2026-10-09 · **Step:** P6-03 (SAD-46) · **Tester:** Tablify Agent (Arena.ai sandbox)
**Scope:** every MVP action reachable from the keyboard; grid usable with a desktop screen reader; focus visible; automated DOM checks (axe-core).
**Environment:** Node v20.20.2 sandbox, jsdom DOM (no rendered pixels), no screen reader, no Obsidian instance (G-L1). Items that need a human in a real Obsidian are marked **NOT RUN (owner)** with the checklist to run.

---

## 1. Keyboard-only run-through of every MVP action

Key source of truth: `src/views/grid/keyboard.ts` (guarded by `tests/ui/keyboardCoverage.test.ts`), `docs/shortcuts.md` (P3-06), `tests/menus/tableMenuModel.test.ts`, `tests/views/grid/columns.test.ts`.

| # | MVP action | Keyboard path | Automated evidence | In-Obsidian check |
|---|---|---|---|---|
| 1 | Move cell selection | Arrow keys | `getGridAction` → `moveUp/Down/Left/Right` | NOT RUN (owner, T-I) |
| 2 | Next / previous cell | Tab / Shift+Tab | `tabNext` / `tabPrev` | NOT RUN (owner, T-I) |
| 3 | Edit cell / commit | Enter (blur commits) | `enterEdit`; `tests/views/grid/editors.test.ts` | NOT RUN (owner, T-I) |
| 4 | Cancel edit | Escape | `escapeCancel` | NOT RUN (owner, T-I) |
| 5 | Copy range | Ctrl/Cmd+C (tab-separated) | `copy`; `copyRangeToText` | NOT RUN (owner, T-I) |
| 6 | Paste range | Ctrl/Cmd+V | `paste`; `parseTextToRange` | NOT RUN (owner, T-I) |
| 7 | Undo / redo | Ctrl/Cmd+Z; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y | `undo`/`redo`; P1-05 command stack tests | NOT RUN (owner, T-I) |
| 8 | Open table menu | Menu key or Shift+F10 on selection (plus right-click) | `tests/menus/tableMenuModel.test.ts` | NOT RUN (owner, T-I) |
| 9 | Row insert above/below, duplicate, copy, delete | table menu → item (arrow keys + Enter in menu; Obsidian native menu keyboard model) | menu model tests | NOT RUN (owner, T-I) |
| 10 | Cell clear / paste via menu | table menu → item | menu model tests | NOT RUN (owner, T-I) |
| 11 | Change field type | header menu → Change field type → picker (type list navigable with arrows; Enter confirms) | menu model + editor tests; reason shown for blocked types | NOT RUN (owner, T-I) |
| 12 | Hide column | header menu → Hide | menu model tests | NOT RUN (owner, T-I) |
| 13 | Sort asc / desc | header menu → Sort | menu model tests | NOT RUN (owner, T-I) |
| 14 | Freeze columns | header menu → Freeze | menu model tests | NOT RUN (owner, T-I) |
| 15 | Column reorder | keyboard alternative `reorderColumn(…, 'left' \| 'right')` via header menu path; drag is the pointer path | `tests/views/grid/columns.test.ts` ("reorder by drag and keyboard alternative") | NOT RUN (owner, T-I) |
| 16 | Column resize | drag only — **no keyboard path (finding F-3)** | — | N/A until F-3 decided |
| 17 | Row height | row-height setting via table menu (compact/medium/tall) | `tests/views/grid/columns.test.ts` | NOT RUN (owner, T-I) |
| 18 | Filter: query input | filter bar is a text input (type + Enter) | `tests/views/grid/filterBar.test.ts` | NOT RUN (owner, T-I) |
| 19 | Filter: builder | builder form fields are native inputs/controls | filterBar tests | NOT RUN (owner, T-I) |
| 20 | Select cell editor | open with Enter; type-to-search; ArrowUp/Down; Enter selects; type-new → Create; Escape closes; IME composition safe | `tests/views/grid/select.test.ts`, `gridSelect.test.ts` | NOT RUN (owner, T-I) |
| 21 | Create/rename/recolor/reorder/delete select options | option manager UI (buttons/inputs reachable by keyboard; Obsidian modal keyboard model) | `tests/model/selectOptions.test.ts`, `tests/views/grid/select.test.ts` | NOT RUN (owner, T-I) |
| 22 | Checkbox cell | Enter to edit → toggle → Enter commits (boolean editor) | `tests/views/grid/editors.test.ts` | NOT RUN (owner, T-I) |
| 23 | Attachment cell | edit flow with vault check + confirm dialog (dialog is keyboard-operable) | `tests/views/grid/attachment.test.ts` | NOT RUN (owner, T-I) |
| 24 | New table (folder menu) | file-explorer context menu; Obsidian host opens context menus for the selected item with the Menu key — **host-dependent (finding F-4)** | `tests/menus/fileMenuModel.test.ts` | NOT RUN (owner, T-I) |
| 25 | Import CSV/XLSX (folder menu + command) | command palette (Ctrl/Cmd+P → "Import") and folder menu | `tests/io/import.*.test.ts` + command registration | NOT RUN (owner, T-I) |
| 26 | Export (file menu + command) | command palette ("Export") and file menu; current-view vs full-table option in dialog | `tests/io/export.*.test.ts` | NOT RUN (owner, T-I) |
| 27 | Duplicate file | file menu → Duplicate | fileMenuModel tests | NOT RUN (owner, T-I) |
| 28 | Open `.tablify` file | Obsidian file list navigation + Enter (extension registered to the Tablify view) | `tests/manifest.test.ts`, `tests/views/tableController.test.ts` | NOT RUN (owner, T-I) |
| 29 | Long-press menu (mobile) | touch-only gesture by design; desktop keyboard equivalents are #8/#9; mobile has no hardware keyboard requirement for menu access — gesture + native touch model | `tests/views/longPress.test.ts` | NOT RUN (owner, T-M-DEV on iOS/Android) |
| 30 | Undo/redo scope note | undo covers local edits only (G-L2/R-D14) | P1-05 tests | — |

**Result:** every MVP action has a designed keyboard path except column resize (F-3) and the long-press gesture, which is the touch equivalent of the keyboard/right-click menu path (per A7's desktop counterpart). All "In-Obsidian" confirmations are owner checks.

## 2. Screen reader (desktop) — NVDA (Windows) + VoiceOver (macOS)

**NOT RUN in sandbox** (no screen reader / no Obsidian). Owner checklist — record result + evidence per row:

| Check | What should happen | NVDA/Windows result | VoiceOver/macOS result |
|---|---|---|---|
| Grid role | grid is announced as a grid/table with row + column counts (`aria-rowcount`/`aria-colcount`) | — | — |
| Cell name | focused cell announces its value plus "Row N, column FIELD" (`aria-description` set per cell) | — | — |
| Column name | column headers are `columnheader` with 1-based `aria-colindex`; traversal announces them | — | — |
| Row number | rows carry `aria-rowindex` (header = row 1; data rows 2…N+1) — announced as row N of total | — | — |
| Sorted column | primary sort column announces `aria-sort` = ascending/descending | — | — |
| Invalid state | `aria-invalid="true"` + tooltip rule message announced on invalid cells | — | — |
| Selection | selected cell announces selected state (`aria-selected="true"`) | — | — |
| Menus | table menu items announce label + disabled reason | — | — |
| Editor | cell editors (text/number/date/select/checkbox) announce label and value; select dropdown announces list size | — | — |

Phase assumption register (`spec/phases/P6.md`): results apply to these two desktop readers only; mobile screen-reader support is **not claimed** unless tested.

## 3. Focus visibility (measured)

`.tablify__cell:focus` renders a 2 px outline in `var(--tablify-focus)` (= accentOrange `#d97757`, both themes). Measured with `scripts/check-contrast.mjs` (WCAG 2.1 1.4.11 non-text ≥ 3:1):

| Theme | Focus ring vs background | 1.4.11 (≥ 3:1) |
|---|---|---|
| Light (`#faf9f5`) | **2.96:1** | **FAIL (marginal)** — finding F-2 |
| Dark (`#141413`) | 5.90:1 | PASS |

Selection additionally draws a 2 px outline in `--tablify-selection`, so a selected cell carries two visual indicators. Changing the palette is out of scope for P6 (P3-11/branding territory) — F-2 recorded below.

## 4. Automated DOM checks (axe-core, devDependency only)

`tests/ui/axeGrid.test.ts` runs axe against the grid (virtual rows, sorted header, selected cell) plus an `aria-invalid` cell. Rules that cannot produce meaningful results for a component-scoped jsdom run are disabled explicitly in the test and listed here: `region`, `landmark-one-main`, `page-has-heading-one`, `bypass`, `html-has-lang` (document-level rules — component fragment), `color-contrast` (no layout engine; measured in §3 instead).

**Result: 0 critical, 0 serious, 0 moderate/minor violations reported** at commit P6-03 (test output: `blocking: [] | other: []`). The run passes after the ARIA additions in this step (see §5).

## 5. Changes made in this step (attribute-only, owner-approved Option A)

`src/views/grid/GridView.ts` — no behavior, layout, or interaction change:

1. Root: `role="grid"`, `aria-rowcount` (data rows + 1 header), `aria-colcount`; both kept in sync in `setModel`.
2. Viewport/content containers: `role="presentation"` so the grid owns its rows for assistive tech.
3. Header cells: `aria-colindex` (1-based); primary sort column gets `aria-sort="ascending|descending"`, others have no `aria-sort`.
4. Rows: `aria-rowindex` (1-based; header is row 1, data rows 2…N+1 — correct across the virtualized window).
5. Cells: `aria-colindex` (1-based) and `aria-description` "Row N, column FIELD" so screen readers can announce cell coordinates.

New automated guards: `tests/ui/ariaGrid.test.ts` (5 tests), `tests/ui/keyboardCoverage.test.ts` (3 tests), `tests/ui/axeGrid.test.ts` (1 test). `scripts/check-contrast.mjs` extended with the focus-indicator measurement (§3). Full suite: **567 tests, all passing**; lint 0 errors.

## 6. Findings and their status

| ID | Finding | Severity | Status |
|---|---|---|---|
| F-1 | Grid keyboard handling is verified at unit level; whether focus actually moves cell-by-cell in a real Obsidian (cells have no `tabindex`; navigation is host-level) is unverified. Without it, screen-reader cell traversal may not work in-app even though the ARIA contract is correct. | S3 (deferred — needs owner T-I check; fix, if needed, would add `tabindex` management = behavior change beyond attribute-only scope) | **Owner sign-off required**; checklist row "Cell name" in §2 will expose it immediately |
| F-2 | Focus ring on light theme 2.96:1 vs 3:1 (WCAG 1.4.11) — marginal fail; dark theme passes | S4 (cosmetic-marginal; selection adds a second indicator) | Backlog / defer with owner sign-off (palette change is P3-11 scope) |
| F-3 | Column resize has no keyboard path (drag only) | S4 (workaround: none for resize specifically; hide/sort/freeze are keyboard-reachable) | Backlog with owner sign-off |
| F-4 | Folder context menu keyboard access depends on the Obsidian host (file-explorer Menu-key behavior) | S4 (host capability, not plugin defect) | Owner T-I check records the actual behavior |
| F-5 | SAD-80: row checkbox tint #CC785C (prototype `accent-tablify-terracotta`) is 2.86:1 on the light inner surface (#F4EFE6) vs 3:1 (WCAG 1.4.11) — the same value as the light focus/selection accent (F-2); dark passes. The control is native: Chrome draws an auto-contrast tick on the fill and a grey border when unchecked, so state is not conveyed by the tint alone | S4 (cosmetic-marginal; native tick and border carry the state) | Kept for prototype fidelity; decide together with F-2 |
| F-6 | SAD-80: row reorder is drag-only (`#` handle), as in the prototype; there is no keyboard path to move a row | S4 (same class as F-3; row order is also changeable by sorting, which is keyboard-reachable through the header menu) | Backlog with owner sign-off |
| F-7 | SAD-81: the Freeze switch's off track (prototype `bg-gray-300 dark:bg-gray-600`: #D1D5DB / #4B5563) is 1.47:1 (light) / 2.10:1 (dark) against the panel vs 3:1 (WCAG 1.4.11). The on state is the terracotta fill (≥ 3.28:1), the knob moves to the opposite end, and the control exposes `role="switch"` + `aria-checked` | S4 (cosmetic; the knob position and the on-fill carry the state) | Kept for prototype fidelity; decide together with F-2 / F-5 |

Per P6-03 acceptance: open findings are S3 or lower; F-1 (S3) and F-2/F-3/F-4 (S4) require owner sign-off in the decision log.

## 7. SAD-80 additions (row selection, bulk delete, row drag)

- **Checkboxes:** native `<input type="checkbox">` with `aria-label` "Select row N" / "Select all rows". With the column on (full table view only), `aria-colcount` and every `aria-colindex` shift by one, and the checkbox slots are `gridcell` / `columnheader` at index 1. Embeds are unchanged.
- **Keyboard:** Space toggles a focused checkbox natively; Enter and Space on a checkbox are kept from the grid's key handler, so they never open the cell editor. Undo, redo and arrows still reach the grid.
- **Delete:** "N selected" is `aria-live="polite"`. **Delete** is a real `<button>` with a visible focus ring (2px focus colour).
- **Drag:** the drop line is `aria-hidden`; the move is announced through the "Row moved" notice.
- **Contrast:** "N selected" #B5573A light (4.78:1) / #CC785C dark (4.96:1); Delete #DC2626 light (4.83:1) / #F87171 dark (5.87:1) on the card. The prototype's terracotta and red-500 fail AA for this 11px text, so the nearest AA shades ship, as for `mutedLight`. The checkbox tint is F-5.
- **axe:** `tests/views/grid/rowSelection.test.ts` runs axe on the grid with the checkbox column on and a row selected: 0 critical, 0 serious.

## 8. SAD-81 additions (Options panel, Group by)

- **Panel:** `role="dialog"` labelled "View settings", opened from the **Options** button; Escape and an outside press close it. Every control is a native `<button>` or `<select>`. A re-render after a change returns focus to the control that caused it, so keyboard users stay in place.
- **Freeze switch:** a `<button role="switch">` with `aria-checked` and `aria-labelledby` pointing at its visible label.
- **Sort and Fields:** **A→Z / Z→A** has an `aria-label` naming the field and current direction ("Name: ascending — reverse"); **✕** is "Remove sort by Name"; **Hide / Show** are "Hide field Notes" / "Show field Notes". The disabled primary **Hide** is a disabled button with a tooltip.
- **Group headers:** each is a grid row holding one `gridcell` that spans every column (`aria-colspan`), containing a real `<button>` with `aria-expanded`. Enter and Space press it and are kept from the grid's editor shortcut. `aria-rowcount` counts the header rows. Headers carry no `data-row-id`, so selection and row drag never treat them as rows. Collapsed rows leave the grid entirely (not merely hidden).
- **Contrast:** active pills, **Show** and the switch use the prototype's terracotta fill (#CC785C, both themes). Their text uses the on-accent ink (#1E1B18 light, 5.23:1 / #181715 dark, 5.47:1) instead of the prototype's white, which is 3.28:1. The switch track when on is 3.28:1 (light) / 4.85:1 (dark) against the panel; the off track is finding F-7. Option chips: in light theme the emerald, amber and pink inks are the Tailwind 800 shade (5.91 / 5.62 / 5.80:1 on their tint) because the prototype's 700 measures 4.22 / 3.98 / 4.44:1; every other chip ink is the prototype's (light ≥ 4.52:1, dark ≥ 7.81:1).
- **axe:** `tests/views/grid/grouping.test.ts` runs axe on a grouped grid with one group collapsed: 0 critical, 0 serious.

## 9. SAD-376 additions (reading a long cell)

- **The quiet requirement is the accessibility requirement.** A long cell keeps its ellipsis and its
  geometry: on hover only the 20 px control appears, and it is `opacity: 0` + `pointer-events: none`
  at rest, so the cell's click, its ARIA gridcell semantics and its text node are exactly what they
  were. Measured in the visual harness on all six theme × viewport combos: the long cell and the
  short cell in the same column are the same width (292 / 257 / 180 px), the 2-line clamp and
  `text-overflow` are unchanged on hover, and no control exists at all on a cell that fits.
- **Names, not tooltips.** The control is a `<button>` with `aria-label="Show full content of
  <field>"` and `aria-haspopup="dialog"`, and deliberately no `title` (a `title` beside an
  `aria-label` produces two tooltips — SAD-109).
- **Keyboard.** The cell menu carries **Expand cell** (Menu key / Shift+F10), which opens the same
  `role="dialog"` panel; that is the keyboard route that does not depend on pointer position.

  > **Correction recorded here rather than quietly assumed:** Tab inside the grid moves the cell
  > selection (P5-02), so it never lands on the in-cell control. The control is a real button and
  > shows its focus ring if it is focused, but it is *not* the keyboard path — the menu is. The
  > `tests/views/cellOverflowView.test.ts` case for Shift+F10 pins the route that exists.
- **The preview card is pointer-only on purpose.** It is `role="group"`, never `role="dialog"`,
  and it holds **no tabbable element**, so it cannot trap or steal focus the way a second dialog
  above a grid would. Opening it is not a focus change; the panel is the announced surface.
- **Touch.** The control stays visible at rest only under `@media (hover: none)` *and* the plugin's
  own `tablify--overflow-touch` class (the plugin setting), so a coarse pointer gets a target
  without a pointer ever hovering.
- **Contrast (measured, WCAG 1.4.11 non-text / 1.4.3 text):**

  | Element | Light | Dark | Requirement |
  |---|---|---|---|
  | ⤢ glyph on the capsule | 5.71:1 | 6.10:1 | ≥ 3:1 |
  | Preview-card body text on the card | 17.14:1 | 12.92:1 | ≥ 4.5:1 |
  | Panel body text on the panel | 17.14:1 | 12.92:1 | ≥ 4.5:1 |

  Every colour is an existing plugin token; the stylesheet test rejects any non-`--tablify` variable
  inside the feature's blocks.
- **Host-button specificity.** The stylesheet declares the control as `.tablify button.…` (0,2,1)
  because Obsidian's own `button:not(.clickable-icon)` (0,1,1) otherwise repaints it as a 30 px host
  pill — measured, see the SAD-376 evidence. The same convention the toolbar buttons follow
  (SAD-76 / RC-B).
- **No motion beyond a 120 ms opacity fade**, which `prefers-reduced-motion` removes; the card and
  panel are positioned, not animated.

