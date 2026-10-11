# SAD-84: Step 9, new-table defaults (5 fields × 3 empty rows)

- **Linear:** SAD-84 (owner decision S-8, 2026-10-10)
- **Date:** 2026-10-10
- **Base commit:** `f62028b`

## Change

`src/menus/fileMenuModel.ts › newTableText()` is the only function changed. Its only production caller is the file-menu **New table** action (`fileMenu.ts › createNewTable()`), so Import, Duplicate, `reissueTableId` and existing files are untouched. Nothing injects defaults when a file is opened.

| # | Field | Type | Config |
|---|---|---|---|
| 1 | Name | `text` | `primary: true` |
| 2 | Notes | `long_text` | none |
| 3 | Status | `single_select` | Todo (gray), In progress (blue), Done (green); fresh `opt_` ids |
| 4 | Due date | `date` | none |
| 5 | Attachments | `attachment` | none |

- **Rows:** 3 rows of `{ id: row_…, rev: 1, createdAt = updatedAt = now, values: {}, sync: null }`, the same shape as `tableStore.createRow()`.
- **View:** `createDefaultView(fields)`, i.e. all 5 columns in order, nothing hidden, primary frozen.
- **Format:** `formatVersion` stays 1, since every type is v1.

The prototype's own `makeDoc()` gives 1 field and 1 empty row. The difference is the owner's explicit override (S-8). Styling still follows the prototype.

## Evidence

- `tests/menus/fileMenuModel.test.ts`: 8 tests replace the P5-01 default test. They check field names, types and order, a single primary, the Status options, 3 empty rows with the `createRow()` shape, column order and freeze, fresh ids per call, ajv schema validity, and a stable serialize round-trip. **3 of them failed on `f62028b`** before the change.
- `tests/views/tableView.test.ts`: the real `TableView` renders 5 header cells and 3 empty rows. Enter on the grid, typing `First task`, then Enter commits, and the saved file has the value in row 1 with rows 2 and 3 still empty.
- `tests/links/reissueTableId.test.ts` passes **unchanged**. It compares the whole table except `tableId`, so it now covers the richer default.
- Render (SAD-75 harness, dark, 1568×795): `visual-parity/sad-84/new-table-dark-owner.plugin.png`, showing 5 typed columns, 3 empty rows and the "3 rows" badge. The `attachment` type badge overflowing its 160 px header capsule is existing header styling, replaced in Step 4 (SAD-79) by the prototype badge.
- `npm run check`: lint 0 errors / 119 warnings (unchanged), **1261/1261** tests (+9), guard PASS, docs PASS, build OK.

## Docs updated

README "Getting started", `docs/user-guide.md` (table of the defaults), `docs/testing/matrix.md` (A1 + manual step), CHANGELOG. The historical decision records (`docs/plan/phase-6-plan.md`, `docs/gates/phase-5.md`) are left as written.
