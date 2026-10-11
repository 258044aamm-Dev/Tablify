# SAD-77: Step 2, title row, card chrome and meta row

- **Linear:** SAD-77 (owner decisions S-1, S-7)
- **Date:** 2026-10-11
- **Base commit:** `b8b4edb`

## Change

**New: `src/views/titleRow.ts`.** The prototype's `#titleRow` (`Prototype/index.html` lines 121-144), rebuilt without the prototype-only text (no "Feature N" tooltips):

| Part | Prototype | Plugin |
|---|---|---|
| Title | `#editableTableTitle` contenteditable `h2`; `commitTitle()` on blur/Enter | `h2.tablify__title` contenteditable. Enter / blur commit, Esc reverts, paste is plain text only. |
| File chip | `#fileChip` `Tables/<name>.tablify` | `.tablify__file-chip`: the real vault path, hidden when there is no file |
| Import… | `openImportModal()` | `startImport(app)`, the same flow as the **Import CSV / Excel as table** command |
| Export… | `openExportModal()` | `save()` pending edits, then `openExportModal(app, file)` (the existing dialog) |
| Export CSV | `exportData('csv')`: visible fields × `pipelineRows` | `writeExport(currentView, 'csv', …)`: visible fields × `session.getDisplayRows()` (sort + search + query), written next to the table, collision-safe, never overwrites |
| Copy Markdown | `copyMarkdownTable()` | `toMarkdown(currentView)` → `navigator.clipboard.writeText`, then a notice. Failure gives a notice. |

**Rename semantics.**
- The title is the **file basename**.
- A commit renames the file in its own folder through `app.fileManager.renameFile()`, so Obsidian updates links.
- The JSON `name` is not touched, and no save is requested.
- Rejected with a notice, then reverted:
  - names that are empty or start with `.`
  - names containing `\ / : * ? " < > | # ^ [ ]`
  - a path that already exists in the folder
  - a rename that throws
- `TableView.onRename()` (Obsidian's FileView hook) refreshes the title and chip after any rename or move, including moves made in the file explorer. `update()` never overwrites an edit in progress.

**Shared export writer.**
- `exporter.ts` gains `writeExport()`, the format → write step that `exportTable()` already did. `exportTable()` now calls it, with unchanged behaviour (125/125 IO and command tests).
- `commands/export.ts` exposes the modal's own `exportFolderOf()` and `vaultExportAdapter()`.
- So Export CSV and the Export dialog write through one path.

**Card, view and meta row (prototype measurements).**

| Element | Prototype class | Value |
|---|---|---|
| View | `body p-3 sm:p-6` | padding 24 / 12 px on `--tablify-bg`. `.view-content.tablify-view.tablify` (0,3,0) beats Obsidian's `.workspace-leaf-content .view-content {padding:0}`. |
| Card | `rounded-[24px] sm:rounded-[32px] p-4 sm:p-7 shadow-xl` | r32 / 24, pad 28 / 16, Tailwind `shadow-xl`. Gap 0: the sections space themselves. |
| Title row | `mb-5 flex items-baseline justify-between flex-wrap gap-2` | same |
| Title | `text-2xl sm:text-3xl font-serif`, paper / charcoal, `px-1 -ml-1 rounded`, `focus:ring-1 terracotta/40` | Poppins 400 30/36 → 24/32 px; new token `--tablify-text-title` (dark `#FAF7F2`, light `#1E1B18`); overrides the generic `.tablify h2` panel rule |
| Chip | `text-xs font-mono … px-2 py-0.5 rounded border` | JBM 12/16, muted, inner bg, border; wraps like the prototype |
| Links | `text-xs … hover:text-white px-2 py-1 rounded hover:bg-inner`; actions `flex items-center gap-2` (no wrap) | Lora 12/16, muted; hover uses new token `--tablify-text-strong` (dark `#FFFFFF`, light `#1E1B18`) on the inner bg. Element-qualified selector, fully reset (SAD-76 rule, added to `formControlSpecificity.test.ts`). |
| Icons | FA 6.4.0 solid `fa-file-import / -export / -csv / fa-copy` + `mr-1` + a space | The same four Font Awesome Free 6.4.0 paths inlined as SVG with FA's inline metrics (1em, `vertical-align:-0.125em`). CC BY 4.0, credited in README and the source. |
| Meta row | `#metaRow`: selection summary left, `#badges` right, `px-1`, `mb-2` | `.tablify__meta-row` > hidden `.tablify__selection-summary` (for SAD-80) + `.tablify__badges` > row count. Toolbar bottom rule removed. |
| Row count | `N row(s)` + ` (of M)` | `3 rows`, `1 row`, `12 rows (of 40)` (was `12 of 40 rows`; tests and user guide updated) |

## Deferred, proposed follow-up

The prototype's **"N invalid" badge** (`script.js` lines 630-650) is not added. The plugin grid never calls `applyValidationState()` (`src/views/grid/validationDisplay.ts`), so no invalid cell is ever outlined. A count with nothing to point at would mislead.

Proposed follow-up issue: *Wire grid validation display (outline + tooltip) and add the meta-row invalid badge.* The badge can then go in `.tablify__badges` next to the row count.

## Visual verification (SAD-75 harness)

`npx tsx tests/visual/capture-compare.ts --theme dark,light --viewport owner,mobile --fixture new`. The full report is `visual-parity/sad-77/report.md`, with per-combo `*.plugin.png` plus title-row plugin, prototype and diff crops.

| Combo | title-row size (plugin = prototype) | Pixel diff | Style diffs (title, chip, row count) |
|---|---|---|---|
| dark · owner 1568×795 | 1462×36 | **0.33 %** | none |
| light · owner | 1462×36 | **0.35 %** | none |
| dark · mobile 390×844 | 332×112 | **0.16 %** | none |
| light · mobile | 332×112 | **0.17 %** | none |

How it got there:
- First capture: 2.15 %. The outline icons differed from the prototype's solid glyphs.
- FA paths inlined: 1.69 %.
- Added the prototype's `</i> Label` space: 0.33 %.
- Mobile first showed 14-16 %: the chip was truncated and the links wrapped as a group. Matched to the prototype by letting the chip wrap and keeping links in one row with labels wrapping inside each button.

The remainder is sub-pixel anti-aliasing: the 13.5 px `file-export` glyph is rasterised from the webfont in the prototype and from SVG in the plugin. Shapes and positions agree to within 1 px.

Card: the computed `border-radius`, `padding` and `box-shadow` match. The only reported card difference is **height**, because the plugin card still fills the pane. Shrink-to-content is S-6, Step 6 (SAD-81).

Harness fix: `capture-compare.ts` now opens the plugin with `Tables/<doc name>.tablify`, as the prototype titles itself from the document name. The populated (Customers) and empty fixtures are now compared like for like: title row 0.33 % on both.

## Tests

| File | Tests | Covers |
|---|---|---|
| `tests/views/titleRow.test.ts` (new) | 18 | structure and order, no annotation text, each link fires only its callback (also from the icon), Enter / blur / Esc, trim and collapse, empty or unchanged revert silently, invalid name gives a notice and reverts, failed or throwing rename reverts and unlocks, `update()` during an edit, `validateTableName` accept and reject sets |
| `tests/views/tableViewTitleRow.test.ts` (new) | 15 | real `TableView`: title row first in card; basename and path; `onRename` refresh; meta row structure; rename → `fileManager.renameFile(file, 'Tables/Q3 budget.tablify')` with the JSON name and save count unchanged; root-folder rename; collision notice; failure notice; invalid name; Import / Export wiring (save first); Export CSV writes visible fields × sorted + searched rows (`Secret` hidden, Beta filtered out) to `Budget.csv`, numbered on collision; Copy Markdown content and failure notice |

- Updated: the row-count wording in `tableView.test.ts` and `toolbar.test.ts`, and the scoped-button list in `formControlSpecificity.test.ts`.
- Mock: `fileManager.renameFile`, `TextFileView.save()` with a counter, and the `onRename` hook.
- `npm run check`:
  - lint 0 errors / 119 warnings (unchanged)
  - **1294/1294** tests (+33)
  - guard PASS, docs PASS, build OK

## Not affected

- Grid, selection, editing, scrolling, Insert Row, the Options popover, sync, embeds and menus have no code changes.
- The toolbar change is limited to wrapping the row count in the meta row and its wording.
- The Options-state capture shows the panel unchanged against SAD-76 (53.67 % → 53.67 %; Step 7 restyles it).

## Docs updated

- `docs/user-guide.md`: §1 "The title row", plus pointers in §12 and §13 and the row-count wording in §10.
- `docs/testing/matrix.md`: A8 mapping, title-row mapping, A1 manual step 4.
- `spec/branding.md`: `text-title` and `text-strong` tokens.
- CHANGELOG.
- README: Font Awesome credit.
