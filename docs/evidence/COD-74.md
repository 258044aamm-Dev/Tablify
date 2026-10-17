# COD-74 — the file menu's Tablify items: icons and branding

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` · **Issue:** [COD-74](https://linear.app/code-bro/issue/COD-74/tablify-right-click) (priority 1, Bug + Feature)
Plan: [`docs/plans/cod-74-file-menu-branding-plan.md`](../plans/cod-74-file-menu-branding-plan.md)

## What was wrong

Right-clicking a `.tablify` file showed three items with **no icons** and **nothing naming Tablify**,
while the folder items beside them were branded. Measured before the fix:

```ts
const OPEN:      FileMenuItem = { id: 'open',      label: 'Open' };        // no icon
const DUPLICATE: FileMenuItem = { id: 'duplicate', label: 'Duplicate' };   // no icon
const EXPORT:    FileMenuItem = { id: 'export',    label: 'Export' };      // no icon
const NEW_TABLE: FileMenuItem = { id: 'newTable',  label: 'New Tablify Table', icon: 'file-plus' };
const IMPORT:    FileMenuItem = { id: 'importTable', label: 'Import CSV or Excel to Tablify', icon: 'upload' };
```

```ts
menu.addItem((mi) => mi.setTitle(item.label).setIcon(item.icon ?? '') /* ← '' */ …)
```

Four linked defects:

| # | Defect | Where |
|---|---|---|
| R1 | The three file items were declared without `icon`, so the wiring called `setIcon('')` — an empty id, which draws nothing | `fileMenuModel.ts`, `fileMenu.ts:28` |
| R2 | Their labels were generic (`Open` / `Duplicate` / `Export`) while the folder items named the plugin | `fileMenuModel.ts` |
| R3 | `FileMenuItem.icon` was **optional**, so nothing failed when it was missing — and the only test pinned icons for the folder items | `fileMenuModel.ts:21`, `fileMenuModel.test.ts:21` |
| R4 | The inline *Give this copy a new table ID* item had no icon either | `fileMenu.ts:41` |
| R5 | `TableView` never set `View.icon`, so every table tab drew Obsidian's generic file glyph | `src/views/tableView.ts` |

Not a bug: the `file-menu` handler, the five actions, the duplicate/new-table builders and the folder
items all behaved correctly.

## What changed

| File | Change |
|---|---|
| `src/menus/fileMenuModel.ts` | `Open Tablify Table` (`table`), `Duplicate Tablify Table` (`copy`), `Export Tablify Table` (`download`); **`FileMenuItem.icon` is required** |
| `src/menus/fileMenu.ts` | `.setIcon(item.icon)` — the `''` fallback is gone; `REISSUE_ICON = 'refresh-cw'` for the inline reissue item (its label is unchanged: the integrity notice and four docs quote it) |
| `src/views/tableView.ts` | `readonly icon = 'table'` — `View.icon` / `getIcon()` |
| `tests/__mocks__/obsidian.ts` | `Events` bus, `Workspace` class with `on`/`trigger`/`onLayoutReady`, `TFolder.isRoot()`, `TextFileView.icon` + `getIcon()` |

Menu order is unchanged: the three items still sit after Obsidian's own entries, so nothing moves
under an existing user's cursor. The folder items keep their labels, icons and top-of-menu position.

## Before → after

| Target | Before | After |
|---|---|---|
| `.tablify` file | `Open` —, `Duplicate` —, `Export` — | 🗔 `Open Tablify Table` · ⧉ `Duplicate Tablify Table` · ⤓ `Export Tablify Table` |
| Folder | `New Tablify Table` (file-plus), `Import CSV or Excel to Tablify` (upload) | unchanged |
| `.md` file, vault root | no Tablify items | unchanged |
| Copy sharing a table ID | `Give this copy a new table ID` — no icon | same label, `refresh-cw` |
| Table tab | Obsidian's generic file glyph | `table` glyph |

Dump from the model on the delivered tree (`/tmp/cod74menu.ts`):

```
.tablify file  (AFTER COD-74)
  title: Open Tablify Table                 icon: table
  title: Duplicate Tablify Table            icon: copy
  title: Export Tablify Table               icon: download

folder
  title: New Tablify Table                  icon: file-plus
  title: Import CSV or Excel to Tablify     icon: upload

.md file          (no Tablify items)
vault root        (no Tablify items)
```

## Tests

| File | Pins |
|---|---|
| `tests/menus/fileMenuWiring.test.ts` **(new, 7)** | fires the real `file-menu` event through the mock: the three titles and icons **in order**; **no empty icon id for any target**; `.md` / vault root get nothing; folder items still branded with their icons **and still first** even when Obsidian added an item before the handler ran; the *Open* item's callback reaches `getLeaf().openFile(file)`; the reissue item carries `REISSUE_ICON`; `TableView.getIcon() === 'table'` |
| `tests/menus/fileMenuModel.test.ts` **(updated)** | branded labels and `['table','copy','download']`; **every item for every target has a non-empty label and icon** (the gate for R1/R3) |

The wiring test is the important one: the bug was in `setIcon('')`, which a model-only test cannot
see. The mock had no event bus at all before this, which is why the wiring was never exercised.

## Browser / regression run

| Check | Result |
|---|---|
| `npm run test` | **118 files / 1780 tests** pass (1772 before + 8 new) |
| `npm run lint` | 0 errors (119 pre-existing warnings) |
| `npm run test:fields` | **100/100** |
| `npm run check:guard` / `check:docs` / `check:icons` / `build` | all PASS |

Untouched: the five actions, the folder items and their order, `duplicateTableText`, `newTableText`,
`uniqueName`, the reissue flow, the table context menu, the grid, the toolbar, the file format.

## What could not be verified headlessly

Obsidian draws its native menu, and the harness `Menu` is a deliberate no-op, so the *contents* the
plugin hands to Obsidian are proven by the wiring test but the rendered menu is not. Manual check:

1. Right-click a `.tablify` file → three items, each with an icon, each naming Tablify.
2. Right-click a folder → unchanged; right-click a `.md` → no Tablify items.
3. Open a table → the tab shows the table glyph.
4. If a copy shares a table ID → its reissue item has an icon.

Anyone who wants the icons *visually* confirmed in Obsidian should run those four steps; the code
path behind each is covered by the tests above.

## Notes

- `IconName` is `string`, so a mistyped icon id fails silently in Obsidian. The four ids used here
  (`table`, `copy`, `download`, `refresh-cw`) are long-standing Lucide names, the same library that
  already supplies `file-plus` / `upload`; the manual check's step 1 is the visual confirmation.
- Found but deliberately **not** fixed here (separate scope, flagged on the issue):
  the **in-table** right-click menu has no icons at all (`MenuEntry` has no icon field and
  `buildTableMenu` never calls `setIcon`), and `spec/features.md` §2.17 still lists *Freeze column*
  and *Change field type*, which COD-72 and COD-69 removed/renamed.
