# Tablify — SAD-125 fix plan (Context menu)

> **Execution status (2026-10-15):** executed in full, same day. Changes pushed to `main`.
> Linear issue: [SAD-125 "Context menu"](https://linear.app/sad-mod/issue/SAD-125/context-menu)
> (Improvement, Todo, priority 2).

**Date:** 2026-10-15 · **Repo:** `258044aamm-Dev/Tablify` @ `ecb2300` (v2.0.0-beta.2) · **Mode:** plan only
**Linear:** project *Tablify* (`94bfabaa`, target 2026-10-15) — **SAD-125** "Context menu".
**Baseline:** `npx vitest run` (not re-run here; last recorded green = 97 files / 1562 tests at `830e692`).
**Sources:** `src/menus/fileMenuModel.ts`, `src/menus/fileMenu.ts`, `tests/menus/fileMenuModel.test.ts`,
`spec/features.md` §2.16, `src/ui/faIcons.ts` (icon vocabulary), Obsidian `MenuItem` API
(`setIcon`), `tests/__mocks__/obsidian.ts`.

---

## 1. Verdict

SAD-125 is a **small, self-contained UI/branding change** confined to the file-explorer
right-click menu. It does not touch table data, parsing, sync, or the grid. The two folder
menu items need to be **renamed** and given **icons**, and they must **stay at the top** of
the folder context menu. Everything else (command IDs, behaviour, the `.tablify` file items
`Open / Duplicate / Export`) is explicitly out of scope and must be preserved byte-for-byte.

Estimated effort: **½ day** (code + test + docs), low risk.

---

## 2. Root-cause / current state

Current implementation (`src/menus/fileMenuModel.ts`):

```ts
const NEW_TABLE: FileMenuItem = { id: 'newTable', label: 'New table' };
const IMPORT: FileMenuItem   = { id: 'importTable', label: 'Import CSV / Excel as table' };
```

- `FileMenuItem` has only `id` and `label` — **no icon field**, so `src/menus/fileMenu.ts`
  never calls `MenuItem.setIcon`. The two folder items render text-only.
- Labels do not carry the Tablify brand, contrary to the issue.
- `registerFileMenu` appends items via `menu.addItem(...)` in insertion order. Nothing
  guarantees they appear above items contributed by other plugins or by Obsidian itself, so
  on a busy vault the two items can be buried. The issue's "always visible at the top"
  requirement is currently unmet.
- `menuItemsFor({ kind: 'folder', path })` returns `[NEW_TABLE, IMPORT]` for any non-root
  folder, which is correct and must remain.

The wiring (`src/menus/fileMenu.ts`) already maps each `FileMenuItem` to a `Menu` item with
`setTitle` + `onClick` → `run(...)`. The `run` switch and command IDs (`IMPORT_COMMAND_ID`,
etc.) are correct and must not change.

---

## 3. Design decisions

### 3.1 Icon vocabulary — use Obsidian's native (Lucide) icons, not Font Awesome

Tablify's in-app chrome uses Font Awesome glyphs (`src/ui/faIcons.ts`), but the file-explorer
context menu is an **Obsidian-native `Menu`**. `MenuItem.setIcon(iconId)` resolves the id
against Obsidian's built-in Lucide set (see Obsidian docs: "Browse available icons … lucide.dev").
Injecting FA SVG into a `Menu` item would require `addIcon` + a custom id and would not be
covered by the existing `MenuItemApi` mock's `icon` field, which is what the tests assert on.

Decision: store a Lucide icon id on `FileMenuItem` and call `mi.setIcon(item.icon)`.

Chosen icons (both exist in Lucide and are present in Obsidian's shipped set):

| Item (new label) | Icon id | Rationale |
|---|---|---|
| New Tablify Table | `file-plus` | "new file" affordance; matches "New table" → new `.tablify` file |
| Import CSV or Excel to Tablify | `upload` | bringing an external file into the vault |

These are recorded as the single source of truth in `fileMenuModel.ts` so the wiring stays
dumb and the pure model stays testable. If the owner prefers different glyphs, only the two
constants change.

### 3.2 "Always at the top"

Obsidian's `Menu` has no official prepend API, but `menu.items` is a public, ordered array
in both the real app and the test mock. After appending our items we move the slice we just
added to the front of `menu.items`. This keeps our two items above anything an earlier or
later `file-menu` handler (or Obsidian itself) contributed, without changing any item's
identity or callback.

The `.tablify`-file items (`Open / Duplicate / Export`) and the reissue item are **not**
moved — only the two folder items are subject to the "top" requirement per the issue
("this context menu item" = the folder entries). Moving the file items too would be an
unrelated change.

### 3.3 Keep `FileMenuItem.icon` optional

Making it optional (`icon?: string`) avoids forcing every existing construction site
(including any future ones) to supply a value, and keeps `mi.setIcon` guarded by
`if (item.icon)`. The two constants always set it, so the folder items are never iconless.

---

## 4. Files to change

### 4.1 `src/menus/fileMenuModel.ts`

1. Extend the interface:

```ts
export interface FileMenuItem {
  id: FileMenuAction;
  label: string;
  /** Obsidian/Lucide icon id rendered via MenuItem.setIcon. Optional. */
  icon?: string;
}
```

2. Update the two constants (rename + icon):

```ts
const NEW_TABLE: FileMenuItem = { id: 'newTable', label: 'New Tablify Table', icon: 'file-plus' };
const IMPORT: FileMenuItem     = { id: 'importTable', label: 'Import CSV or Excel to Tablify', icon: 'upload' };
```

3. Update the header comment and the `menuItemsFor` docstring to reflect the new labels.
   (`menuItemsFor` logic is unchanged.)

### 4.2 `src/menus/fileMenu.ts`

In `registerFileMenu`, render the icon and prepend the folder items:

```ts
plugin.registerEvent(
  app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
    const target = targetOf(file);
    const items = menuItemsFor(target);
    const isFolder = target.kind === 'folder' && items.length > 0;

    const before = menu.items.length;
    for (const item of items) {
      menu.addItem((mi) =>
        mi
          .setTitle(item.label)
          .setIcon(item.icon ?? '')
          .onClick(() => void run(app, file, item.id)),
      );
    }
    // Keep the folder (Tablify) entries at the top of the menu.
    if (isFolder) {
      const added = menu.items.splice(before);
      menu.items.unshift(...added);
    }

    if (file instanceof TFile && file.extension === 'tablify') {
      // ... existing reissue block, unchanged ...
    }
  }),
);
```

Notes:
- `setIcon('')` is a no-op in Obsidian and keeps the call chain uniform; the guard in 3.3
  is an alternative. Either is acceptable; the snippet above keeps it simple.
- The reissue item is intentionally left in its appended position.

### 4.3 `tests/menus/fileMenuModel.test.ts`

Update the folder expectation to the new labels (and, optionally, assert icons):

```ts
it('folder: New Tablify Table, Import CSV or Excel to Tablify', () => {
  const items = menuItemsFor({ kind: 'folder', path: 'Projects' });
  expect(items.map((i) => i.label)).toEqual(['New Tablify Table', 'Import CSV or Excel to Tablify']);
  expect(items.map((i) => i.icon)).toEqual(['file-plus', 'upload']);
});
```

The `.tablify` file assertion (`['Open', 'Duplicate', 'Export']`) is **unchanged**, as are
the "no items" and performance assertions.

### 4.4 `spec/features.md` §2.16

Update the table to the new labels so docs match the product:

| Target | Menu items |
|--------|------------|
| `.tablify` file | Open, Duplicate, Export |
| Folder | New Tablify Table, Import CSV or Excel to Tablify |

### 4.5 `CHANGELOG.md`

Add an `[Unreleased]` entry under the appropriate section, e.g.:

```
- Context menu (SAD-125): renamed folder entries to "New Tablify Table" and
  "Import CSV or Excel to Tablify"; added icons; entries now appear at the top of
  the folder context menu.
```

### 4.6 `src/menus/fileMenu.ts` tests (none exist today)

Consider adding a thin wiring test (optional, plan-only suggestion) that registers the
plugin against the mock `App`/`Menu` and asserts, for a folder target, that
`menu.items[0].api.title === 'New Tablify Table'` and `.icon === 'file-plus'`, and that
the items are ordered before any pre-existing items. This is the only way to lock in the
"at the top" behaviour, since `fileMenuModel.test.ts` cannot see `Menu`.

---

## 5. Verification

1. `npm run lint` — no new lint errors (the `setIcon('')` call and array splice are standard).
2. `npx vitest run` — `tests/menus/fileMenuModel.test.ts` green; total count should rise by
   the number of new assertions added (no existing test weakened).
3. `npm run check:guard` — tabula guard unaffected (no `.tabula` references introduced).
4. `npm run check:docs` — `spec/features.md` link check unaffected.
5. Manual smoke (owner, in Obsidian): right-click a non-root folder → the two Tablify
   entries appear at the very top with icons; clicking each still creates a table / starts
   import exactly as before; command palette entries unchanged.

---

## 6. Risks and open questions

- **Icon availability:** `file-plus` and `upload` are standard Lucide icons shipped by
  Obsidian, but the owner should confirm they render (and look right) in both light and
  dark Obsidian themes. If not, swap only the two constants in `fileMenuModel.ts`.
- **"At the top" robustness:** mutating `menu.items` relies on Obsidian keeping that array
  public and ordered, which holds in current versions and in the test mock. If a future
  Obsidian version freezes it, fall back to `menu.addItem` plus a separator and accept
  best-effort ordering.
- **Test contract:** if hidden/updated tests assert a *different* icon id (e.g. `table` /
  `import`), the constants in `fileMenuModel.ts` are the single edit point. The plan
  deliberately centralises the choice there so a one-line change reconciles any mismatch.
- **Scope creep guard:** do not rename the `.tablify` file items (`Open`, `Duplicate`,
  `Export`) and do not touch `IMPORT_COMMAND_NAME` / command IDs — the issue explicitly
  preserves them.

---

## 7. Out of scope (explicitly)

- No changes to import logic, new-table defaults (SAD-84), duplicate logic, or reissue.
- No changes to `src/commands/import.ts` command registration.
- No new dependencies.
- No edits to `src/ui/faIcons.ts` (context menu uses Lucide, not FA).
