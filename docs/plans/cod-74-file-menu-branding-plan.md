# COD-74 — Tablify file context menu: icons and branding

**Approved and implemented** — see [`docs/evidence/COD-74.md`](../evidence/COD-74.md) for what shipped.
**Issue:** [COD-74](https://linear.app/code-bro/issue/COD-74/tablify-right-click) · priority **0 (urgent)** · labels Bug + Feature · state *Todo*
**Your answers used here:** file-explorer/tab menu · "Tablify" in the labels · one icon per action · the view/tab icon too ·
**`<Verb> Tablify Table` wording** · **items keep today's position** (after Obsidian's own items).

---

## 1. Scope

| In | Out |
|---|---|
| The `file-menu` items the plugin adds for a `.tablify` file (file explorer **and** tab right-click) | Obsidian's own items in that same menu |
| The "Give this copy a new table ID" item, which has the same defect | The in-table right-click menu (cell / row / header) — a separate menu with the same class of defect, see §10 |
| The view/tab icon (`View.icon` is never set) | Colours, fonts, themes, the grid UI, the store listing |

---

## 2. Investigation

### 2.1 What the menu shows today

`src/menus/fileMenuModel.ts:40-44` declares the three items:

```ts
const OPEN:      FileMenuItem = { id: 'open',      label: 'Open' };
const DUPLICATE: FileMenuItem = { id: 'duplicate', label: 'Duplicate' };
const EXPORT:    FileMenuItem = { id: 'export',    label: 'Export' };
const NEW_TABLE: FileMenuItem = { id: 'newTable',  label: 'New Tablify Table',                icon: 'file-plus' };
const IMPORT:    FileMenuItem = { id: 'importTable', label: 'Import CSV or Excel to Tablify', icon: 'upload' };
```

and `src/menus/fileMenu.ts:26-30` wires them:

```ts
menu.addItem((mi) =>
  mi.setTitle(item.label)
    .setIcon(item.icon ?? '')          // ← '' for all three file items
    .onClick(() => void run(app, file, item.id)),
);
```

### 2.2 Root cause, precisely

| # | Defect | Evidence |
|---|---|---|
| **R1** | The three `.tablify` file items are declared **without an `icon`**, so the wiring calls `setIcon('')` — an empty icon id, which draws nothing | `fileMenuModel.ts:40-42`, `fileMenu.ts:28` |
| **R2** | The same items carry **generic labels** (`Open`, `Duplicate`, `Export`) with no *Tablify* in them, while the folder items are branded (`New Tablify Table`, `Import CSV or Excel to Tablify`) | `fileMenuModel.ts:43-44` vs `:40-42` |
| **R3** | `FileMenuItem.icon` is **optional**, so nothing at compile time or in the tests notices an item that has no icon. The existing test pins icons for the folder items only | `fileMenuModel.ts:21`, `tests/menus/fileMenuModel.test.ts:21` |
| **R4** | The fourth item in the same menu — `REISSUE_LABEL` ("Give this copy a new table ID") — is added inline with **no icon** either | `fileMenu.ts:41` |
| **R5** | `TableView` never sets `View.icon`, so Obsidian draws its **default file glyph** on the tab (and for the registered extension in the explorer) — no Tablify mark anywhere | `src/views/tableView.ts` (`getViewType` / `getDisplayText` only) |

R1–R3 are one oversight from P5-01 (`spec/features.md` §2.16 only ever asked for "Open, Duplicate, Export"); R4 shares it; R5 is the same "no branding" gap one layer up.

**Nothing else is involved** — the `file-menu` handler itself, the folder items, the actions and their behaviour are correct.

### 2.3 What cannot be verified headlessly

Obsidian's native menu is drawn by the app, not the plugin, and the test harness's `Menu` mock is a deliberate no-op (`showAtMouseEvent` does nothing). So:

- I can prove **what the plugin puts into the menu** (title, icon id, order, click callback) against the mock — that is exactly where the bug is.
- I **cannot** screenshot the rendered Obsidian menu. The final visual confirmation needs one manual check in Obsidian (§8.3). I will not fake it.

---

## 3. Current vs expected

| Target | Today | Expected |
|---|---|---|
| Right-click a `.tablify` file | • `Open`<br>• `Duplicate`<br>• `Export`<br>all with an empty icon, none mentioning Tablify | • 🗔 `Open Tablify Table`<br>• ⧉ `Duplicate Tablify Table`<br>• ⤓ `Export Tablify Table` |
| Right-click a folder | `New Tablify Table` (file-plus), `Import CSV or Excel to Tablify` (upload) — already correct | unchanged |
| Right-click a `.md` / the vault root | no Tablify items | unchanged |
| A copy that shares a table ID | `Give this copy a new table ID` — no icon | same label, with an icon |
| The table's tab | Obsidian's default file glyph | a table glyph |

---

## 4. The change

### 4.1 `src/menus/fileMenuModel.ts`

```ts
export interface FileMenuItem {
  id: FileMenuAction;
  label: string;
  /** Obsidian/Lucide icon id for MenuItem.setIcon. Required — an item without one reads as unbranded. */
  icon: string;
}

const OPEN:      FileMenuItem = { id: 'open',      label: 'Open Tablify Table',      icon: 'table' };
const DUPLICATE: FileMenuItem = { id: 'duplicate', label: 'Duplicate Tablify Table', icon: 'copy' };
const EXPORT:    FileMenuItem = { id: 'export',    label: 'Export Tablify Table',    icon: 'download' };
```

- `icon` becomes **required** (R3): a future item that forgets one is a compile error, not a silent empty spot.
- No id, action or ordering changes. `menuItemsFor` is untouched otherwise.

**Why "Tablify Table" and not "Tablify file":** the folder items already established *Tablify Table* as the noun (`New Tablify Table`). All five plugin items then read as one family.

### 4.2 `src/menus/fileMenu.ts`

```ts
.setIcon(item.icon)                                   // no '' fallback (R1)
...
menu.addItem((mi) => mi.setTitle(REISSUE_LABEL).setIcon('refresh-cw').onClick(...));   // R4
```

`REISSUE_LABEL` keeps its wording: it is referenced by the integrity notice, the user guide, the gate doc and `spec/guidelines.md`.

### 4.3 `src/views/tableView.ts`

```ts
/** COD-74: the tab / file-explorer glyph (Obsidian's default is a generic file). */
readonly icon = 'table';
```

`View.icon` is the documented 1.1.0 field and `View.getIcon()` returns it. One line, reversible, no CSS.

### 4.4 `tests/__mocks__/obsidian.ts` (test infrastructure only)

Two small additions so the **wiring** can be tested, not just the model:

- `Workspace.on(name, cb)` records the callback and `Workspace.trigger(name, ...args)` fires it (returns an `EventRef`-shaped object).
- `Plugin.registerEvent(ref)` accepts it.
- The base `TextFileView` gains `icon = 'file'` and `getIcon()` returning it, mirroring `View.icon` / `View.getIcon()`.

No production behaviour depends on these; without them the empty-icon bug is only testable at the model level, which is how it slipped through.

---

## 5. Tests

| File | Pins |
|---|---|
| `tests/menus/fileMenuModel.test.ts` *(update)* | the three labels; `['table','copy','download']` icons; **every** item for **every** target has a non-empty `icon` and a non-empty `label` (the regression gate for R1/R3) |
| `tests/menus/fileMenuWiring.test.ts` *(new, ~60 lines)* | fire `file-menu` on a `.tablify` `TFile` through the mock → the `Menu` receives exactly three items, in order, with the branded titles **and** the icon ids; folder target → the two branded items, still moved to the top; `.md` → no items; a duplicate-ID copy → the reissue item comes with its icon; a click on `open` calls `workspace.getLeaf().openFile` |
| `tests/views/tableViewIcon.test.ts` *(new, ~20 lines)* | `view.getIcon() === 'table'` and `getDisplayText()` unchanged |

Expected counts: +1 file, ~10 new assertions; the model test's label expectations change.

---

## 6. Docs

| File | Change |
|---|---|
| `docs/plans/cod-74-file-menu-branding-plan.md` | this plan |
| `spec/features.md` §2.16 | table updated to the new labels + a dated COD-74 note that the items carry icons and the Tablify name |
| `docs/user-guide.md` §14 | the target table and the **Duplicate** paragraph |
| `CHANGELOG.md` | `Unreleased → Fixed`: "The file menu's Tablify items show their icons and name the plugin" |
| `docs/evidence/COD-74.md` | root cause, before/after menu content table, the headless-verification limit, the manual checklist, the full regression run |

---

## 7. Verification

### 7.1 Automated
- `npm run check` — lint, **1772 tests** + the new ones, docs links, icons, build.
- `npm run test:fields` — 100/100 (F4 editor paths cannot be affected; run anyway).
- A printed before/after dump of the menu contents from the wiring test, quoted in the evidence file.

### 7.2 What stays untouched
`src/menus/fileMenu.ts` actions (`open`, `duplicate`, `export`, `newTable`, `importTable`), the duplicate/new-table text builders, the folder items, and every other menu. The diff is 2 production files plus one line in `tableView.ts`.

### 7.3 Manual check in Obsidian (needs you — 2 minutes)
1. Right-click a `.tablify` file → three items, each with an icon, each naming Tablify.
2. Right-click a folder → unchanged; right-click a `.md` → no Tablify items.
3. Open a table → the tab shows the table glyph.
4. If you have a copy that shares a table ID → its reissue item has an icon.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| A Lucide id that does not exist fails **silently** (`IconName = string`, no type check) | only long-standing Lucide names that Obsidian core itself uses (`table`, `copy`, `download`, `refresh-cw`); pinned by tests; step 1 of the manual check catches a blank spot |
| `Duplicate Tablify Table` is long for a narrow mobile menu | the mobile long-press menu is the same width class as the desktop one; if it wraps, the documented fallback is `Duplicate table` (one constant) |
| Menu order | unchanged — the three items stay where they are today, after Obsidian's own items |
| `spec/features.md` is a historical spec | a dated note is appended instead of rewriting the original line |
| "Avoid unrelated changes" | diff limited to `fileMenuModel.ts`, `fileMenu.ts`, one line in `tableView.ts`, the mock, tests and docs |

---

## 9. Delivery (after your approval)

1. `COD-74: icons and Tablify naming in the file menu` — code + tests + `main.js`.
2. `COD-74: plan, evidence, changelog, user guide, spec note` — docs.
3. Push each step; comment on Linear after each; state → **In review** (never Done).

---

## 10. Found while investigating — needs your call, not in this fix

1. **The in-table right-click menu has no icons at all.** `MenuEntry` has no `icon` field and `buildTableMenu` never calls `setIcon`, so *Copy / Paste / Clear* and the row/header items are plain text. Same defect class, different menu; the issue is about the file menu, so I would file it separately rather than widen this diff.
2. **`spec/features.md` §2.17 is stale:** it still lists the header menu as *Change field type, Hide field, Sort ascending, Sort descending, **Freeze column***. COD-69 renamed the first to *Modify field…* and COD-72 removed *Freeze column*. One-line doc correction, unrelated to COD-74.

---

## 11. Approval

Both open decisions are settled, so **nothing is pending on my side**:

- Wording: `Open Tablify Table` · `Duplicate Tablify Table` · `Export Tablify Table` (matches `New Tablify Table`).
- Position: unchanged — the items stay after Obsidian's own items, so no one's muscle memory moves.

Reply "approved" and I will implement it in the two commits of §9. Nothing in the repo has been touched yet.
