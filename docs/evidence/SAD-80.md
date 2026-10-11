# SAD-80: Step 5, row selection, bulk delete and row drag reorder

- **Linear:** SAD-80 (owner decision S-2: checkbox column, select / select-all / bulk delete, `#` column with drag reorder)
- **Date:** 2026-10-11
- **Base commit:** `1edd017`

## Change

### Checkbox column (prototype `renderGrid` checkbox cells, `toggleRowSelect`, `toggleSelectAll`)

- **Row checkboxes.** The 32px leading slot reserved in SAD-79 now holds a native checkbox per row, labelled "Select row N". The header slot holds "Select all rows".
- **Native rendering.** Both are native 13×13 controls tinted with the prototype's `accent-tablify-terracotta` (#CC785C in both themes). Like the prototype's, they sit on the text baseline: centred across the slot, with the top edge 12.5px into it.
  - Obsidian restyles every `input[type=checkbox]`: no native appearance, its own size and border, and a `::after` tick.
  - Element + class selectors (`.tablify input[type='checkbox'].tablify__row-check`) restore the native control.
  - The harness host CSS now carries Obsidian's checked state and tick, so every capture proves the override.
- **Select-all acts on the visible (filtered) rows**, as in the prototype. Selected rows hidden by a filter stay selected and are counted.
  - The header box is checked when every visible row is selected; clicking it then deselects them.
  - This fixes the prototype bug where the box never showed as checked and a click always selected.
  - There is no indeterminate state; the prototype has none.
- **Selection is UI state.** Toggling never saves, never re-renders the grid (boxes update in place via `GridView.setRowSelection`) and adds no undo entry.
- **Selection lifetime:**
  - Loading a file clears it (prototype `switchTable`).
  - A deleted row leaves it on the next render (`pruneSelection`), so an undo brings the row back unselected.
- **Keyboard.** Space toggles a focused checkbox natively. Enter and Space on a checkbox no longer reach the grid's key handler, so they don't open the cell editor; every other key (undo, arrows) still does.
- **Embeds are unchanged.** `GridView` draws checkboxes only when `onToggleRow` is passed. The embed passes no callbacks, so its leading slot stays empty and its ARIA column indexes are unchanged.
- **ARIA.** With the column on, `aria-colcount` and every `aria-colindex` shift by one, and the checkbox slots become `gridcell` / `columnheader` at index 1.

### Selection summary and bulk delete (prototype `#selectionSummary`, `deleteSelectedRows`, `script.js` 1135-1145)

- **Summary.** The meta row's left slot (reserved in SAD-77) shows "N selected" and a red **Delete** with the prototype's trash glyph (Font Awesome `trash-can`, generated into `faIcons.ts`).
  - Hidden while nothing is selected.
  - Lora 11px / 500, gap 8, glyph 11px with a 4px gap: all measured from the prototype.
- **Delete** removes every selected row in one undo step (`TableSession.deleteRows` → `createDeleteRowsCommand`). It then clears the selection and shows the prototype's notice, "Deleted N row(s)".
  - Undo restores the rows at their original positions, in ascending index order.
  - Unknown or duplicate ids are ignored. If nothing applies, nothing is recorded.

### Row drag reorder (prototype `.row-drag-handle`, `rowDragStart` / `rowDragMove` / `rowDragEnd`, `script.js` 780-860)

- **The `#` cell is the handle:** cursor `grab`, `touch-action: none`, tooltip "Drag to reorder row". Pointer events, so mouse, pen and touch all work.
- **Start.** A drag starts after 5px of travel (Manhattan distance, like the prototype); a press without travel is a click.
  - The press is not prevented, so an open cell editor blurs and commits first (verified in Chromium).
  - Only the primary button starts a drag.
- **Blocked states** use the prototype's checks and messages, shown once when the threshold is crossed:
  - a sorted view: "Clear sorting to reorder rows manually";
  - a grouped view: "Disable grouping to reorder rows manually".
- **Drop target.** The first rendered row whose capsule-slot midpoint is below the pointer. Below the last rendered row, the target is the next row outside the rendered window, or the end of the table.
- **Drop line.** The prototype's 3px accent line with a faint accent halo, drawn 5px above the target row's slot or 2px under the last row, inset 10px from each side of the shell.
  - It is placed from the visible box, so it stays in view when the grid is scrolled sideways (identical at scroll 0).
  - The dragged row is shown at opacity .45, and the grid uses the `grabbing` cursor with no text selection.
- **Edge auto-scroll.** Near the top (below the header) or bottom of the shell, the shell scrolls 14px per move. The prototype scrolls the window in a 70px band; the plugin scrolls its own shell in a 48px band, because the shell is the scroll container here.
- **Contextmenu.** The long-press / right-click menu is suppressed during a drag, so a touch drag never opens the row menu.
- **Drop.** Dropping in place does nothing, using the prototype's no-op check. A real move is one undo step (`TableSession.moveRowBefore` → `createMoveRowCommand`) and shows "Row moved". `pointercancel` and `destroy()` clean up without moving.

### Design tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `accentCheck` | #CC785C | #CC785C | checkbox tint (prototype value) |
| `textSelected` | #B5573A | #CC785C | "N selected" |
| `textDanger` | #DC2626 | #F87171 | Delete |

The drop line uses the existing `accentPrimary` (#CC785C light / #D97757 dark), as the prototype does.

## Decisions and deviations from the prototype

1. **Text colours that fail AA use the nearest AA shade.** This is the same rule as `mutedLight` (P3-11 / SAD-71).
   - Terracotta "N selected" is 3.28:1 on the white card, so light uses #B5573A (4.78:1). Dark keeps #CC785C (4.96:1).
   - Red-500 Delete is 3.76:1 light and 4.32:1 dark, so red-600 (4.83:1) and red-400 (5.87:1) ship.
   - Glyphs and positions are identical; only the ink differs.
   - The checkbox tint is a UI control and keeps the prototype value in both themes. On the light inner surface it is 2.86:1, the same value the light focus and selection accent already uses. The native control draws an auto-contrast tick on the fill and a grey border when unchecked, so the state never depends on the tint alone. Recorded in `docs/accessibility/audit.md`.
2. **Reorder writes the stored row order.** The prototype reorders `doc.rows`; the plugin reorders the table store (`moveRow`). The view's display order follows store order whenever no sort is set, and reorder is blocked while sorted or grouped, so the visible result is the same. This is a deviation from the plan, which said `viewOrder`.
3. **Select-all checked state (prototype bug fixed).** See above. The prototype header box never reflects "all selected".
4. **Auto-scroll band 48px in the shell** instead of 70px of the window (see above).
5. **Drop line follows horizontal scroll.** The prototype's line scrolls away with the content; the plugin's stays in the visible box.

## Tests

- **New `tests/views/grid/rowSelection.test.ts` (30):**
  - selection helpers: toggle, visible-only select-all, prune identity, label;
  - session commands: bulk delete (dedupe, unknown ids, one undo step, order restored, redo), no-op delete adds no entry, move before / end with undo and redo, the prototype no-op checks;
  - GridView checkbox column: embeds unchanged (no boxes, original `aria-colcount` / `aria-colindex`), labels, ARIA shift, change callbacks, in-place `setRowSelection` and select-all state across `setModel`, Enter / Space kept on the checkbox while Ctrl+Z and arrows still reach the grid;
  - GridView drag: drop target at the slot midpoint and drop-line geometry, end-of-table, next unrendered row, threshold click, press not prevented, non-primary button ignored, blocked drag reported once, `pointercancel` / `destroy()` cleanup, contextmenu suppressed only mid-drag, edge auto-scroll;
  - TableView wiring: summary visibility and count, no save and no undo for selection, select-all on / off, Delete with notice plus one undo, prune with undo restoring unselected, file load clears, drop reorders with notice plus undo, both blocked messages leave the file unchanged;
  - axe with the column on: no critical or serious violations.
  - **Mutation check.** Three deliberate breakages each fail the suite: drop midpoint taken from the row element instead of the slot, the Enter / Space guard removed, and prune removed.
- **`tests/ui/contrast.test.ts`:** +2 (summary and Delete ink ≥ 4.5:1 in both themes; checkbox tint is the prototype value and the light accent).
- **`tests/ui/theme.test.ts`:** palette snapshot extended with the three new entries.
- **`tests/views/tableView.test.ts`:** the new-table edit test now targets `input.tablify__editor`; a bare `input` matched the new select-all box first. Behaviour is unchanged.
- **`npm run check`:** lint 0 errors (119 warnings, unchanged); vitest **1453** passing in 88 files (was 1421 in 87); guard, docs and icons PASS; build OK.

## Visual verification

**Command:**

```
npx tsx tests/visual/capture-compare.ts --theme all --viewport all --fixture all --state default,selected
```

That is 36 combos: dark and light × owner, desktop and mobile × the new, empty and populated fixtures × default and the new `selected` state. The full report is `visual-parity/sad-80/report.md`.

**Harness changes:**
- New `selected` state: rows 1 and 3 (or the last row) are ticked with real clicks on both pages, then the mouse is parked.
- New regions: `header-check`, `row-check` (every state) and `selection-summary` (selected state).
- `host-obsidian.css` gains Obsidian's checked state and `::after` tick.

| Region (worst of all combos) | Pixel mismatch | Size |
|---|---|---|
| header-check | 0.00 % | 13×13, matches |
| row-check | 0.00 % | 13×13, matches |
| selection-summary | dark ≤ 5.04 %, light ≤ 2.18 % (deviation 1: ink only) | 107×17 / 105×17, matches |
| grid-shell | ≤ 0.76 % | matches |

**The grid shell is closer to the prototype in every combo,** because the checkboxes the prototype draws are now there. Default state, SAD-79 → SAD-80:
- owner new: 0.17 → 0.06 % dark, 0.08 → 0.05 % light;
- mobile populated: 1.22 → 0.76 % dark, 0.81 → 0.70 % light.

**Other regions are unchanged** from SAD-79: header capsule ≤ 0.53 %, row number ≤ 1.01 %, type badge ≤ 2.41 %, insert row ≤ 0.01 %, title row ≤ 0.39 %. The mobile toolbar is the known SAD-78 deviation, and the 1px search width predates this step.

**Captures** (`visual-parity/sad-80/`):
- `<combo>/` with full pages and the new region crops;
- `selected-compare-{dark,light}.png` (plugin / prototype / diff with rows 1 and 3 selected);
- `row-drag-indicator-{dark,light}.png` (mid-drag: dimmed row and drop line).

**Behaviour in Chromium** (10-row fixture, both themes, real mouse):

| Check | Result |
|---|---|
| Checkbox top / left vs prototype | identical (y 221 header, 274 row) |
| Tick rows 1 and 3 | "2 selected", select-all unchecked |
| Delete, then ↶ | 2 rows removed, summary hidden; restored |
| Drag row 1 below row 4 | order 2, 3, 4, 1, …; class, dim and line cleaned up |
| Drop line | 11px from the shell's outer edge (1px border + 10), width = client width − 20, 3px, accent colour |
| Click on `#` without travel | no change |
| Edit open, then drag from `#` | value committed, editor closed |
| Sorted view, drag | no drag state, order unchanged |
