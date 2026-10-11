# Tablify — MVP Test Matrix (P6-01)

**Date created:** 2026-10-09 (P6-01, Linear SAD-44)
**Scope:** every MVP acceptance scenario A1–A11 (`spec/roadmap.md` §10) × every target platform (Windows, macOS, Linux, iOS, Android) = 55 cells.
**Cell values:** `PASS` (evidence linked) · `FAIL` (linked issue `ISS-###`) · `NOT RUN` (reason + scripted case ID).
**Rules:** no cell may be empty (P6-01 verification). NOT RUN cells block the phase gate until the owner accepts them in the decision log (`spec/guidelines.md` §0.1). Mobile results must come from real devices (G-A2); performance results apply only to recorded hardware (G-A4).

## Sandbox reality at creation time

This matrix was created in a sandbox with **no Obsidian GUI, no Windows/macOS/iOS/Android devices** (G-L1). Every scenario cell is therefore **NOT RUN** with the scripted case to run, exactly like the T-M-DEV/T-I checks left open in P2–P5. The underlying logic of each scenario is covered by automated tests (footnotes below the grid); a NOT RUN cell means "the *on-device* confirmation of this scenario has not been recorded", not "the logic is untested".

**Obsidian version to record per platform at run time:** `________` (fill in when running; minimum supported version is 1.14 per `manifest.json`, decision D-O4 in `docs/decisions/min-app-version.md`).

## Result grid

| Scenario | Windows | macOS | Linux | iOS | Android |
|----------|---------|-------|-------|-----|---------|
| A1 New table via right-click | NOT RUN — run [T-M-DEV-P6-A1] | NOT RUN — run [T-M-DEV-P6-A1] | NOT RUN — run [T-M-DEV-P6-A1] | NOT RUN — run [T-M-DEV-P6-A1] | NOT RUN — run [T-M-DEV-P6-A1] |
| A2 Import 500-row CSV | NOT RUN — run [T-M-DEV-P6-A2] | NOT RUN — run [T-M-DEV-P6-A2] | NOT RUN — run [T-M-DEV-P6-A2] | NOT RUN — run [T-M-DEV-P6-A2] | NOT RUN — run [T-M-DEV-P6-A2] |
| A3 Import 500-row XLSX | NOT RUN — run [T-M-DEV-P6-A3] | NOT RUN — run [T-M-DEV-P6-A3] | NOT RUN — run [T-M-DEV-P6-A3] | NOT RUN — run [T-M-DEV-P6-A3] | NOT RUN — run [T-M-DEV-P6-A3] |
| A4 Filter query + builder parity | NOT RUN — run [T-M-DEV-P6-A4] | NOT RUN — run [T-M-DEV-P6-A4] | NOT RUN — run [T-M-DEV-P6-A4] | NOT RUN — run [T-M-DEV-P6-A4] | NOT RUN — run [T-M-DEV-P6-A4] |
| A5 Edit → delete → type change → undo ×3 → redo | NOT RUN — run [T-M-DEV-P6-A5] | NOT RUN — run [T-M-DEV-P6-A5] | NOT RUN — run [T-M-DEV-P6-A5] | NOT RUN — run [T-M-DEV-P6-A5] | NOT RUN — run [T-M-DEV-P6-A5] |
| A6 Duplicate row | NOT RUN — run [T-M-DEV-P6-A6] | NOT RUN — run [T-M-DEV-P6-A6] | NOT RUN — run [T-M-DEV-P6-A6] | NOT RUN — run [T-M-DEV-P6-A6] | NOT RUN — run [T-M-DEV-P6-A6] |
| A7 Long-press row on mobile | NOT RUN — run [T-M-DEV-P6-A7] | N/A (desktop scenario; run A6 menu checks instead) | N/A (desktop scenario; run A6 menu checks instead) | NOT RUN — run [T-M-DEV-P6-A7] | NOT RUN — run [T-M-DEV-P6-A7] |
| A8 Export filtered view (CSV/XLSX/MD) | NOT RUN — run [T-M-DEV-P6-A8] | NOT RUN — run [T-M-DEV-P6-A8] | NOT RUN — run [T-M-DEV-P6-A8] | NOT RUN — run [T-M-DEV-P6-A8] | NOT RUN — run [T-M-DEV-P6-A8] |
| A9 `.tabula` files ignored | NOT RUN — run [T-M-DEV-P6-A9] | NOT RUN — run [T-M-DEV-P6-A9] | NOT RUN — run [T-M-DEV-P6-A9] | NOT RUN — run [T-M-DEV-P6-A9] | NOT RUN — run [T-M-DEV-P6-A9] |
| A10 Broken `.tablify` shows error, file unchanged | NOT RUN — run [T-M-DEV-P6-A10] | NOT RUN — run [T-M-DEV-P6-A10] | NOT RUN — run [T-M-DEV-P6-A10] | NOT RUN — run [T-M-DEV-P6-A10] | NOT RUN — run [T-M-DEV-P6-A10] |
| A11 View settings survive restart | NOT RUN — run [T-M-DEV-P6-A11] | NOT RUN — run [T-M-DEV-P6-A11] | NOT RUN — run [T-M-DEV-P6-A11] | NOT RUN — run [T-M-DEV-P6-A11] | NOT RUN — run [T-M-DEV-P6-A11] |

Note on A7: the macOS/Linux cells are marked N/A because A7 exercises the mobile long-press path (`src/views/longPress.ts` is touch-only by design; desktop uses right-click / Menu key / Shift+F10, covered by A6 and the table-menu checks). If the owner prefers a uniform grid, run the desktop case there instead and mark PASS.

## Automated logic coverage (footnotes for the grid)

The scenario *logic* is covered by the automated suite (558 tests at creation, all passing — see `docs/evidence/P6-01.md`). Mapping:

- **A1** new-table default (`Untitled table`; five fields Name / Notes / Status / Due date / Attachments and three empty rows, SAD-84): `tests/menus/fileMenuModel.test.ts`; view wiring `tests/views/tableController.test.ts`, `tests/views/tableView.test.ts`.
- **A2** CSV parse + type inference + build: `tests/io/csv.test.ts`, `tests/io/csv.differential.test.ts`, `tests/io/csv.fuzz.test.ts`, `tests/io/infer.test.ts`, `tests/io/import.build.test.ts`, `tests/io/import.importer.test.ts`, `tests/io/import.e2e.test.ts`; 500-row round-trip: `tests/io/import.e2e.test.ts`.
- **A3** XLSX import: `tests/io/import.importer.test.ts`, `tests/io/import.e2e.test.ts` (5,000-row FX-XLSX fixture covers the same reader path).
- **A4** query parity: `tests/query/parse.test.ts`, `tests/query/evaluate.test.ts`, `tests/query/differential.test.ts`; builder UI: `tests/views/grid/filterBar.test.ts`.
- **A5** undo/redo semantics: `tests/model/commands.test.ts`, `tests/model/tableCommands.test.ts`, `tests/model/tableSession.test.ts`.
- **A6** duplicate row (new row ID, `rev: 1`, same values): `tests/model/tableCommands.test.ts`, `tests/menus/tableMenuModel.test.ts`.
- **A7** long-press state machine: `tests/views/longPress.test.ts` (500 ms threshold, 10 px cancel, scroll/pointercancel cancel, touch-only).
- **A8** export of current view vs full table: `tests/io/export.view.test.ts`, `tests/io/export.csv.test.ts`, `tests/io/export.markdown.test.ts`, `tests/io/export.e2e.test.ts`; title-row **Export CSV** / **Copy Markdown** write the current view (SAD-77): `tests/views/tableViewTitleRow.test.ts`.
- **Title row** (SAD-77) rename / name validation / collision / links: `tests/views/titleRow.test.ts`, `tests/views/tableViewTitleRow.test.ts`.
- **A9** `.tabula` guard: `tests/guard.test.ts` + `scripts/check-tabula-guard.sh` (source-level); extension registration only for `.tablify` (`tests/manifest.test.ts`).
- **A10** broken JSON handling: `tests/format/format.test.ts` (parser failure cases), `tests/schema.test.ts`; error surface in view: `tests/views/tableController.test.ts`.
- **A11** view settings normalize/persist: `tests/model/view.test.ts` (sort/freeze/widths/rowHeight survive normalize + round-trip in `tests/format/format.test.ts`).

## Scripted cases (T-M-DEV-P6-*) — owner runbook

Fixtures live in `samples/fixtures/` (deterministic; SHA-256 in `samples/fixtures/HASHES.json`; regenerate/verify with `node scripts/gen-fixtures.mjs --check`). For each case: record platform, OS version, Obsidian version, device model, date, tester; attach the listed evidence; log every failure as `docs/issues/ISS-###.md` and re-run the scenario plus its regressions after the fix.

### T-M-DEV-P6-A1 — New table via right-click (all platforms)
1. Right-click a folder in the file explorer → **New table**.
2. Expected: a new `.tablify` file is created and opens in the grid with default name `Untitled table`, five fields (`Name` primary, `Notes`, `Status` with Todo / In progress / Done, `Due date`, `Attachments`) and three empty rows; the first cell can be edited at once (SAD-84).
3. Evidence: screenshot of the new grid + the file visible in the explorer.
4. Title row (SAD-77): the title reads `Untitled table` with chip `<folder>/Untitled table.tablify`. Click the title, type `Q3 budget`, press Enter: the file is renamed in place and the chip updates. Click **Export CSV**: `Q3 budget.csv` appears next to the table. Click **Copy Markdown** and paste into a note: a Markdown table of the visible columns.

### T-M-DEV-P6-A2 — Import 500-row CSV (all platforms)
1. Right-click a folder → **Import CSV/Excel as table** → choose `samples/fixtures/import-a2.csv` (SHA-256 `970cc466c99104277f7f82bcdfee9dbb209e7d35aa55d749f0de686f19a2e55c`).
2. Expected: 500 rows, 7 columns; row count and cell values match the source; types inferred per `docs/reports/p4-03-accuracy.md` rules (id/amount → number, date → date, active → checkbox where unambiguous, category → single-select ≤ 20 options, else text).
3. Evidence: screenshot of row count + a spot-check of first/last rows against `import-a2.csv` opened in a text editor.

### T-M-DEV-P6-A3 — Import 500-row XLSX (all platforms)
1. Same as A2 with `samples/fixtures/import-a3.xlsx` (SHA-256 `aa5943d7f00fcde6a471072fc75d292196707a7cf277dba2b1e476f912ee16e0`).
2. Expected: identical row count and values to the A2 result (same 500 source rows; dates parsed from Excel serials as `yyyy-mm-dd`).
3. Evidence: screenshot; cross-check against the A2 imported table.

### T-M-DEV-P6-A4 — Filter query and builder parity (all platforms)
1. Open the A2 table. In the filter bar search/query enter `category:Alpha amount:>100`.
2. Note the visible row set. Clear, then build the same filter with the filter builder (field `category` is `Alpha`, field `amount` > `100`).
3. Expected: both paths return exactly the same rows.
4. Evidence: screenshots of both result sets with row counts.

### T-M-DEV-P6-A5 — Edit, delete, type change, undo ×3, redo ×1 (all platforms)
1. In any table: edit a cell value; delete a row (row menu → Delete); change a field type via the header menu (e.g. text → number where values convert).
2. Press Ctrl/Cmd+Z three times; then Ctrl/Cmd+Shift+Z once.
3. Expected: each undo reverts one step (type change → row restored with same row ID and position → cell value); the redo re-applies the last undo.
4. Evidence: screen recording or before/after screenshots; file diff if possible.

### T-M-DEV-P6-A6 — Duplicate row (all platforms)
1. Right-click a row → **Duplicate** (desktop: also verify Menu key / Shift+F10 opens the menu).
2. Expected: new row with a **new row ID**, `rev: 1`, identical values (per R-D9/R-D11 and `FEATURES.md` §2.17).
3. Evidence: screenshot before/after; inspect the file JSON to confirm the new `row_*` ID and `rev: 1`.

### T-M-DEV-P6-A7 — Long-press row on mobile (iOS and Android only)
1. On a real device, long-press (≈500 ms) a row without scrolling.
2. Expected: the same menu as the desktop right-click opens; a normal scroll gesture never opens it; a short tap does not open it; moving the finger more than ~10 px during the hold cancels it; native text selection is blocked during the press.
3. Evidence: screen recording on each device.

### T-M-DEV-P6-A8 — Export filtered view (all platforms)
1. Apply a filter that visibly reduces rows (e.g. the A4 filter). Table menu/command → **Export** → CSV, XLSX, Markdown; keep the "current view" default (D-O5).
2. Expected: each export contains exactly the filtered rows; XLSX/CSV open cleanly in a spreadsheet app; Markdown table renders.
3. Evidence: the three exported files + screenshot of the on-screen filter result.

### T-M-DEV-P6-A9 — `.tabula` files are ignored (all platforms)
1. Copy `samples/fixtures/decoy.tabula` (SHA-256 `9fdfa7d4cb423fc10e7f2eb62eafb19c2dac6293ff6d9c8054f9c4383dfd2ab3`) into the vault next to a real `.tablify` file. Restart Obsidian.
2. Expected: Tablify does not open, import, or prompt to migrate the `.tabula` file; no Tablify commands act on it; the `.tablify` file opens normally.
3. Evidence: screenshot of the vault with the decoy file untouched and Tablify UI showing nothing for it.

### T-M-DEV-P6-A10 — Broken `.tablify` shows an error, file unchanged (all platforms)
1. Copy `samples/fixtures/broken.tablify` (SHA-256 `cb6e36b398b9822624d87c4ce4d015855e716e83b040d5b9f298ec0f33c38329`) into the vault and open it.
2. Expected: an error message is shown (no crash, no partial grid write); the file on disk is byte-identical afterwards (`git diff` / hash check).
3. Evidence: screenshot of the error + hash of the file before/after.

### T-M-DEV-P6-A11 — View settings survive restart (all platforms)
1. Open `samples/fixtures/view-a11.tablify` (SHA-256 `33217efff5a583c98d317066333e8e7179d5a440483195a3ab09b6008a5fb914`) or set up any table: change a column width, freeze a column, sort by a column. Quit and restart Obsidian. Reopen the table.
2. Expected: width, freeze, and sort are all restored (settings live in the `.tablify` file, R-D10).
3. Evidence: screenshot after restart; file diff showing the saved `views[0]` values.

## Execution log

| Date | Platform | Obsidian | Case | Result | Evidence | Tester |
|------|----------|----------|------|--------|----------|--------|
| — | — | — | — | — | — | (no entries yet; owner to fill) |
