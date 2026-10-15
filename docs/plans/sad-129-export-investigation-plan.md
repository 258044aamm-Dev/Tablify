# SAD-129 — Export investigation and implementation

**Mode:** Implementation authorized on 2026-10-15. The findings below record the pre-change state; implementation and verification are recorded afterward. SAD-129 remains Todo.

## Issue goal

Verify export generation, destination, error handling, and user feedback, then make only the necessary fixes. Preserve existing export formats and scope controls while meeting the user's clarified destination requirement.

## User's destination decision

On 2026-10-15, the user clarified that exports should go **outside the Obsidian vault**, not be saved next to the `.tablify` file. They chose a **save-location picker** for all platforms, defaulting to the Downloads folder where supported. This supersedes the initial vault-native proposal. A platform without a direct Downloads path should use an explicit native save/share flow or another agreed fallback; it must not silently write the export into the vault.

## Baseline findings (before implementation)

### Destination and formats

- The original export writer saved **inside the Obsidian vault**, next to the source table (or at the vault root for a root-level table). `exportFolderOf()` selected that vault-relative folder, and `vaultExportAdapter()` wrote with `app.vault.create()` / `createBinary()`. It did **not** save to the OS Downloads folder.
- The Export dialog offered CSV, Excel (`.xlsx`), and Markdown (`.md`). The original vault adapter chose a numbered name on collision (`Budget.csv`, `Budget 2.csv`, etc.) and did not silently overwrite existing vault files.
- **Copy current view as Markdown** is a separate command that copies to the clipboard; it does not create an `.md` file.
- The project had a pure export writer/adapter seam, but the UI had no system save-location picker.

### Generation, scope, and error handling

- `writeExport()` built CSV/Markdown/XLSX content before writing, then made one create call. It caught generation and write failures and returned a failure result.
- The Export dialog read the table with `await app.vault.read(this.source)` outside a try/catch, so a rejected read could escape without a normal failure notice.
- The modal's default current-view scope omitted saved search/query filters; formula results were not stored in `.tablify` rows and were blank in modal exports.
- The title-row Export action saved before opening the modal, but command-palette and file-explorer entry points opened it directly from a `TFile`, allowing a possible stale read before the debounced save.

## Implementation delivered

- Added `src/io/export/destination.ts`: a save-picker flow with the suggested basename/extension and `startIn: 'downloads'`; explicit mobile file-share and browser/Electron download fallbacks; no vault-write fallback. Picker cancellation writes nothing. Failed writes abort and report an error instead of silently switching destinations.
- Added `src/io/export/prepare.ts` to separate reading, parsing, scope resolution, and in-memory content generation from destination I/O. Read, invalid-file, scope, and generation failures return user-facing errors before any destination write.
- Refactored `src/io/export/exporter.ts` to build named artifacts in memory and reuse that builder in the existing adapter API, preserving CSV, XLSX, and Markdown generation.
- Routed both the Export dialog and **Export current view as CSV** through the external save/share/download flow. The native picker starts directly from the Export click, before asynchronous reads or generation. Success notices report the selected filename and destination method when available; clipboard Markdown remains unchanged.
- Added `flushPendingExportEdits()` for the shared modal path. It saves a matching open table view before the modal reads the file, covering title-row, command-palette, and file-explorer entry points; a closed table is still read from the vault as before.
- Updated current-view resolution to use the persisted view's search/query, visible fields, order, and sort through the same TableSession filtering path. Full-table mode remains unfiltered and in file order, includes every field/row, and still computes formula values. Formula results are populated for current-view and full-table CSV, XLSX, and Markdown; numeric/boolean formula results keep their value type in XLSX.
- Updated `docs/user-guide.md` §13 and the title-row description with the save-picker default, fallbacks, scope, formula behavior, and clipboard distinction.

## Verification results

- `npm test`: **111 files, 1,658 tests passed**. After the final export refinements, the focused export/modal/TableView rerun also passed: **8 files, 60 tests**.
- `npm run lint`: passed with 0 errors; existing lint warnings remain (119 total, primarily non-null assertions in unrelated code and existing export fixtures/tests).
- `npm run build`: passed.
- `npm run check:docs`: passed — 125 Markdown files, all relative links resolve.
- `npm run check:icons`: passed.
- `npm run check:guard`: passed. The pre-existing local modification to `scripts/check-tabula-guard.sh` was left untouched.
- A standalone `npx tsc --noEmit` is not clean because of existing project-wide type errors (including the Obsidian DOM mock augmentation and unrelated `TableView` typings); the normal esbuild production build passed, and the changed `src/io/export/*` and `src/commands/export.ts` modules had no source-only diagnostics.
- No actual Obsidian desktop/mobile runtime test was performed. In particular, native picker availability, OS overwrite prompts, and mobile share-sheet behavior remain to be manually verified; unsupported picker environments use the explicit download/share fallback and never write into the vault.

## Scope guard

Changes are limited to the export save flow, export scope/formula resolution, pending-save behavior, associated tests, and the export user-guide/plan notes. Existing CSV, XLSX, Markdown, current-view CSV, command-palette/file-menu/title-row, and clipboard behavior is retained. SAD-129's Todo status was not changed.

## Inspection references

`src/commands/export.ts`, `src/io/export/destination.ts`, `src/io/export/prepare.ts`, `src/io/export/exporter.ts`, `src/io/export/view.ts`, `src/io/export/csv.ts`, `src/io/export/markdown.ts`, `src/io/export/xlsx.ts`, `src/views/tableView.ts`, `src/menus/fileMenu.ts`, `src/model/tableSession.ts`, `src/model/rowFilter.ts`, `src/model/fieldTypes/formula.ts`, `src/model/formulaRuntime.ts`, `docs/user-guide.md` §13, `docs/evidence/P4-05.md`, `tests/io/export.view.test.ts`, `tests/io/export.e2e.test.ts`, `tests/views/tableViewTitleRow.test.ts`, and the new export destination/preparation/modal/formula tests.
