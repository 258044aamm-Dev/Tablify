# SAD-98 — Export CSV and Copy Markdown buttons

**Issue:** [SAD-98](https://linear.app/sad-mod/issue/SAD-98/export-csv-and-copy-markdown-buttons) (Improvement, P1)
**Plan:** [`docs/plans/sad-98-sad-100-fix-plan.md`](../plans/sad-98-sad-100-fix-plan.md) §Step 1
**Status:** complete

## What the owner asked for

Remove the **Export CSV**, **Copy Markdown** and **Import** buttons from the top of the interface;
keep the one remaining **Export** button and move it to the right side; keep the remaining button's
functionality and the layout clean and responsive on desktop and mobile.

## What was there

The title row (`src/views/titleRow.ts`, SAD-77) rendered four `.tablify__title-link` buttons —
Import… / Export… / Export CSV / Copy Markdown — in a `.tablify__title-actions` flex group. With
`justify-content: space-between` and `flex-wrap`, a narrow container wraps the group to a second
line **left-aligned** — the "top-left corner" of the issue (see the 390px capture in
`docs/evidence/visual-parity/sad-77/dark-mobile.title-row.plugin.png`). The two one-click actions
were reachable **only** from those buttons (`tableView.titleCallbacks` → `exportCurrentViewCsv` /
`copyCurrentViewMarkdown`, no commands existed).

## What changed

- **TitleRow** keeps exactly one link: **Export…** (`data-action="export"`), same dialog flow
  (saves pending edits → `openExportModal`). `TitleAction`, `ICONS`, `LINKS` and
  `TitleRowCallbacks` shrink accordingly.
- **Right side at every width**: `styles.css` `.tablify__title-actions { margin-left: auto }` —
  `space-between` already pins the group right on one line; the auto margin also holds a wrapped
  lone button right on narrow panes.
- **No capability removed** (owner decision, clarified before planning):
  - **Export current view as CSV** and **Copy current view as Markdown** are now command-palette
    commands (`registerCurrentViewExportCommands`, ids `export-current-view-csv` /
    `copy-current-view-markdown`). The underlying `TableView` methods are unchanged and public —
    the exact button behaviour (current-view CSV next to the table, numbered name, never
    overwrite; Markdown to the clipboard) is asserted through the new entry point.
  - **Import CSV / Excel as table** was already a command and a file-explorer folder-menu item
    (`menuItemsFor` → `importTable`); both remain, now guarded by a test.
  - Registration lives in `commands/export.ts` with the active-view getter injected from
    `main.ts` — `commands/export.ts` must not import `views/tableView.js` (tableView already
    imports it; a module cycle). As-built note vs the plan's "register in registerExportCommand".

## Verification

- Red first: 7 failing tests (title-row link set, removed-link absence, 4 command tests) → all
  green after implementation.
- `tests/views/titleRow.test.ts` — structure pins `['Export…']` / `['export']` and asserts the
  three removed labels/actions are absent; rename suite untouched.
- `tests/views/tableViewTitleRow.test.ts` — Export CSV / Copy Markdown behaviour tests retargeted
  from button clicks to `view.exportCurrentViewCsv()` / `view.copyCurrentViewMarkdown()` (same
  assertions — a move, not a weakening); **Export…** modal flow test unchanged; new guards for
  the lone link and folder-menu Import.
- `tests/commands/currentViewExport.test.ts` (new) — registration (ids + names), dispatch to the
  open table, and the no-table notice.
- `npm run check` green — lint 0 errors, **98 files / 1565 tests** (baseline 97 / 1562), guards,
  docs links, FA icons, build.

## Deviations from the prototype

- The prototype shows four title links; the owner explicitly asked for one. Visual-parity sweeps
  (SAD-92/93) will see a changed `title-row` region — owner-directed, not a regression. Before
  captures: `docs/evidence/visual-parity/sad-77/*title-row*`; after captures land with the next
  parity sweep.
