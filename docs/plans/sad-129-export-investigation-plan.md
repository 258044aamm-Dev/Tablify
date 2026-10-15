# SAD-129 — Export investigation plan

**Mode:** Plan only. This file records read-only findings and the proposed follow-up; it does not change product code or the user guide.

## Issue goal

Verify export generation, destination, error handling, and user feedback, then make only the necessary fixes. Preserve existing export formats and scope controls while meeting the user's clarified destination requirement.

## User's destination decision

On 2026-10-15, the user clarified that exports should go **outside the Obsidian vault**, not be saved next to the `.tablify` file. They chose a **save-location picker** for all platforms, defaulting to the Downloads folder where supported. This supersedes the initial vault-native proposal. A platform without a direct Downloads path should use an explicit native save/share flow or another agreed fallback; it must not silently write the export into the vault.

## Findings from the current implementation

### Destination and formats

- The current export writer saves **inside the Obsidian vault**, next to the source table (or at the vault root for a root-level table). `exportFolderOf()` selects that vault-relative folder, and `vaultExportAdapter()` writes with `app.vault.create()` / `createBinary()`. It does **not** save to the OS Downloads folder. This is the main destination mismatch with the user's request.
- The Export dialog offers CSV, Excel (`.xlsx`), and Markdown (`.md`). It names output from the table's basename and chooses a numbered name on collision (`Budget.csv`, `Budget 2.csv`, etc.); it does not silently overwrite existing vault files.
- **Copy current view as Markdown** is a separate command that copies to the clipboard; it does not create an `.md` file.
- The project has a pure export writer/adapter seam, but the current UI is wired only to an Obsidian-vault adapter. No system save-location picker is currently wired. The cross-platform picker/API choice needs a small platform feasibility check before implementation.

### Generation and error handling

- `writeExport()` builds CSV/Markdown/XLSX content before writing, then makes one create call. It catches generation and write failures and returns a failure result; collision naming and no-overwrite behavior are covered by tests.
- Existing automated coverage checks CSV output against two parsers, opens XLSX with two independent readers, and covers collisions, failed writes, scope, and query errors. The repository also has TableView coverage for the current-view CSV path and the title-row Export button. This inspection did not run tests or an Obsidian runtime.
- The Export dialog reads the table with `await app.vault.read(this.source)` **outside a try/catch**. If that read rejects (for example, the source was removed or cannot be read), it can escape without the dialog's normal failure notice. Add explicit error feedback and a test.

### Scope mismatch and correctness risks

- The modal defaults **Full table** to off. It calls `exportTable()` with only `{ fullTable: false }`. `resolveExportTable()` applies saved column visibility/order and sorting, and can apply `scope.query` when supplied, but the modal does not supply a query and the resolver does not apply the saved `view.search` or `view.query`. Those view keys are persisted and are applied by `TableSession.getDisplayRows()`.
- Therefore the modal's default “current view” export can include rows hidden by the current search/query, although `docs/user-guide.md` §13 says the current-view export includes the filter. By contrast, **Export current view as CSV** uses the live TableSession and is tested to include the current search. The two paths can export different rows.
- Formula results are display-only and are not stored in the `.tablify` rows. The modal exports parsed file rows directly, so formula cells are currently blank in modal exports. The one-click current-view CSV uses TableSession display rows, where formula values are computed. Verify and align formula handling for CSV, XLSX, and Markdown, including Full table mode.
- The title-row **Export…** action explicitly awaits `TableView.save()` before opening the modal. The command-palette and file-explorer entry points open the modal directly from a `TFile`. Test whether an immediate export after an edit can read a stale on-disk snapshot; if so, flush pending edits consistently without changing exports of a closed table.

## Proposed follow-up after implementation is authorized

1. Replace the default vault write with a **system save-location picker** for CSV, XLSX, and Markdown. Pre-fill the suggested filename and extension, default to Downloads where supported, and let the user choose a destination. Validate the desktop and mobile behavior before choosing the API; cancellation should create no file, and an unsupported platform must not silently fall back to a vault write.
2. Keep content generation separate from destination I/O. Write the generated text/binary data to the selected location, preserve the existing formats and Full table toggle, and retain no-silent-overwrite behavior (use the platform's confirmation or collision-safe naming).
3. Align the modal's default current-view scope with the view displayed: apply persisted search and query using existing filter logic, preserve visible fields/order/sort, and include computed formula values. Full table mode should remain unfiltered and include every field and row, while still exporting computed formula values.
4. Handle source-read, generation, picker, and destination-write failures with clear Notices. Report the resulting filename/location on success when the platform exposes it; do not leave a partial file after a failed write.
5. Verify pending-save behavior for title-row, command-palette, and file-explorer entry points; fix only if a stale export is reproducible.
6. Update `docs/user-guide.md` §13 to explain the save picker, Downloads default, platform fallback, current-view/full-table scopes, and the separate clipboard action. Do not make this documentation change in Plan-only mode.

## Test plan for a later authorized implementation

- Add destination-adapter tests proving the picker receives the suggested basename/extension, exported bytes/text are written to the chosen location, and the vault adapter is not called by default.
- Add focused current-view tests where search and query both filter rows; assert the default scope exports only visible rows, while Full table exports all rows.
- Add formula-field cases for CSV, XLSX, and Markdown in both scopes and verify computed values rather than blanks.
- Add dialog tests for picker cancellation and `vault.read()`/destination-write rejection; assert appropriate feedback and no file creation or partial output.
- Exercise collision/overwrite handling and success feedback, including the final path/name where available.
- Verify pending edits from each entry point, or retain the existing save contract if no stale snapshot can occur.
- Run focused export tests and relevant checks after changes; separately note that actual save-picker behavior needs manual Obsidian desktop and mobile verification.

## Scope guard

No product-code or user-guide edits, no runtime tests, and no export behavior changes are included in this Plan-only step. Preserve the existing Export dialog, current-view CSV command, Markdown clipboard command, CSV/XLSX/Markdown generation, scope control, and safe collision behavior. Default file exports should move out of the vault to the user's selected location, with Downloads as the default where supported. Keep SAD-129 Todo until authorized fixes and tests are completed.

## Inspection references

`src/commands/export.ts`, `src/io/export/exporter.ts`, `src/io/export/view.ts`, `src/io/export/csv.ts`, `src/io/export/markdown.ts`, `src/io/export/xlsx.ts`, `src/views/tableView.ts`, `src/menus/fileMenu.ts`, `src/model/tableSession.ts`, `src/model/rowFilter.ts`, `src/model/fieldTypes/formula.ts`, `src/model/formulaRuntime.ts`, `docs/user-guide.md` §13, `docs/evidence/P4-05.md`, `tests/io/export.view.test.ts`, `tests/io/export.e2e.test.ts`, and `tests/views/tableViewTitleRow.test.ts`.
