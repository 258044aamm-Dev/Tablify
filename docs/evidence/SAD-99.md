# SAD-99 — Table's folder name and file name

**Issue:** [SAD-99](https://linear.app/sad-mod/issue/SAD-99/tables-folder-name-and-file-name) (Improvement, P1)
**Plan:** [`docs/plans/sad-98-sad-100-fix-plan.md`](../plans/sad-98-sad-100-fix-plan.md) §Step 2
**Status:** complete

## What the owner asked for

The active table's folder name and file name are displayed in the interface; the owner does not
want that information visible. Remove it without affecting the table's functionality or other UI.

## What was there

The title row's `span.tablify__file-chip` (`#fileChip` equivalent) rendered the file's full vault
path — folder + file name, e.g. `Tables/Untitled table.tablify`. On narrow widths it sits to the
right of the title (see the 390px capture in
`docs/evidence/visual-parity/sad-77/dark-mobile.title-row.plugin.png`), which is the "right side"
the issue describes. It was display-only.

## What changed

- Removed the chip element, `TitleRowState.path` and `renderChip()` from `src/views/titleRow.ts`;
  `TitleRowState` is `{ title: string }` and `TableView.titleState()` no longer computes a path.
- The title itself (click-to-rename file) is untouched — renaming, its validation and its notices
  are exactly as before (same tests, green unchanged).
- `tests/visual/lib/regions.ts` drops the `file-chip` parity region, with a comment recording the
  owner-directed deviation from the prototype (which keeps `#fileChip`).

## Verification

- Red first: 15 failing tests (chip content, chip hiding, chip refresh after rename/move,
  constructor crash on the dropped `path` key) → all green after removal.
- `tests/views/titleRow.test.ts` — new regression test asserts **no** `.tablify__file-chip` /
  `data-testid="tablify-file-chip"` element exists; `update()` still never clobbers an edit in
  progress.
- `tests/views/tableViewTitleRow.test.ts` — the open/move tests assert the title refresh and chip
  absence; rename suite unchanged.
- `npm run check` green — lint 0 errors, **98 files / 1565 tests**, guards, docs links, FA icons,
  build.

## Deviations from the prototype

- The prototype shows `#fileChip`; the owner explicitly asked for its removal. Visual-parity
  sweeps (SAD-92/93) must not expect the `file-chip` region — owner-directed, not a regression.
