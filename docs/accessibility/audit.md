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

Per P6-03 acceptance: open findings are S3 or lower; F-1 (S3) and F-2/F-3/F-4 (S4) require owner sign-off in the decision log.
