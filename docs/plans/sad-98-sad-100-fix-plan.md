# SAD-98 / SAD-99 / SAD-100 — Final Fix Plan

**Date:** 2026-10-12 · **Repo:** `258044aamm-Dev/Tablify` @ `13389ec` (v2.0.0-beta.2) · **Mode:** plan only — no code changed

**Issues (Linear project Tablify, all label *Improvement*, P1):**

| Issue | Title | One-line intent |
|---|---|---|
| [SAD-98](https://linear.app/sad-mod/issue/SAD-98/export-csv-and-copy-markdown-buttons) | Export CSV and Copy Markdown buttons | Remove **Import…**, **Export CSV**, **Copy Markdown** from the title row; keep **Export…** alone, pinned to the right, responsive on desktop and mobile |
| [SAD-99](https://linear.app/sad-mod/issue/SAD-99/tables-folder-name-and-file-name) | Table's folder name and file name | Remove the vault-path chip (folder + file name) from the UI without touching table functionality |
| [SAD-100](https://linear.app/sad-mod/issue/SAD-100/default-column-freeze-behavior) | Default Column Freeze Behavior | Freeze default follows the **current viewport** (not device type): mobile view → off, desktop view → on; an explicit user choice always wins |

---

## Owner decisions (clarified before planning)

These were confirmed interactively and are acceptance criteria:

1. **SAD-100 semantics — "viewport default, explicit choice wins".** The viewport decides the freeze state until the user touches **Options → Freeze primary column** or the header **Freeze column / Unfreeze** action. After that, the choice is saved in the file and applies at every size. Default for untouched tables: wide pane → frozen, narrow pane → not.
2. **SAD-100 breakpoint — table pane width ≤ 639px is "mobile view".** Same 639px breakpoint as the existing phone layout block (`styles.css` `@media (max-width: 639px)`), but measured on the **table pane** (`contentEl`), so a narrow split-pane on a desktop behaves like mobile. Never `Platform.isMobile` / device type.
3. **SAD-98 removed quick actions stay reachable as commands.** The buttons go; **Export current view as CSV** and **Copy current view as Markdown** become command-palette commands. **Import CSV / Excel as table** is already reachable via command palette + file-explorer folder menu and stays that way. No capability is lost.

**Assumptions (low-risk, stated for the record):**
- "The export button" in SAD-98 = the existing **Export…** link that opens the Export dialog (CSV/XLSX/Markdown with scope chooser). Its label and dialog behaviour are unchanged.
- "Right side of the interface" = far-right end of the title row **at every width**, including narrow viewports where today's links wrap left (confirmed from `docs/evidence/visual-parity/sad-77/*` crops: on the 390px capture the four links sit bottom-left and the path chip sits right of the title — exactly how the issues describe the current state).
- SAD-99 "folder name and file name" = the `#fileChip`-equivalent vault-path chip (`tablify__file-chip`, e.g. `Tables/Untitled table.tablify`). It is display-only; rename-by-click on the title is unaffected and must keep working.

**Non-goals:** no brand header / vault sidebar / tabs (SAD-77 scope, P4-01), no third freeze-switch state (SAD-81 S-5 owner decision keeps on/off), no `formatVersion` bump (see SAD-100 design), `.tabula` handling untouched (FORMAT_SPEC §9), no re-verification of SAD-96/97.

---

## Step 1 — SAD-98: title-row buttons → single Export… on the right

### What exists today
- `src/views/titleRow.ts` — `LINKS` renders four `.tablify__title-link` buttons (Import… / Export… / Export CSV / Copy Markdown) into `.tablify__title-actions`; `TitleAction` union of 4; callbacks `onImport/onExport/onExportCsv/onCopyMarkdown`.
- `src/views/tableView.ts` `titleCallbacks()` — `onImport: startImport(this.app)`, `onExport: openExport()`, `onExportCsv: exportCurrentViewCsv()` (private), `onCopyMarkdown: copyCurrentViewMarkdown()` (private). The two quick actions are **only** reachable from these buttons (no commands exist).
- `src/commands/export.ts` (`registerExportCommand`) registers one command: "Export table (CSV, Excel, Markdown)" (the modal). `src/commands/import.ts` registers "Import CSV / Excel as table"; `registerFileMenu` adds the folder-menu item — Import survives button removal with zero further work.
- Layout: `.tablify__title-row` is `flex; flex-wrap: wrap; justify-content: space-between`. With four links, a narrow container wraps the actions to a second line **left-aligned** (the owner's "top-left corner").

### Design
1. **TitleRow keeps exactly one link: `Export…`.** `TitleAction` becomes `'export'`. `TitleRowCallbacks` keeps `onRename`, `onExport`, `onInvalidName`; drops `onImport/onExportCsv/onCopyMarkdown`. `ICONS`/`LINKS` shrink to the one entry (icon `file-export`, title "Export CSV / Excel / Markdown" unchanged).
2. **New commands replace the removed buttons** in `registerExportCommand` (the export command home — no new file):
   - `Export current view as CSV` → active TableView's `exportCurrentViewCsv()` (writes `<name>.csv` next to the table, numbered on collision, never overwrites — the exact button behaviour).
   - `Copy current view as Markdown` → active TableView's `copyCurrentViewMarkdown()`.
   Both use `this.app.workspace.getActiveViewOfType(TableView)` with the existing "Open a .tablify table first." Notice pattern (`main.ts openSyncFor`). Make the two tableView methods `public` (or add thin public wrappers) — no logic changes inside them.
   `tests/views/tableViewTitleRow.test.ts` already covers their behaviour through button clicks; those tests **retarget to the command path** (same assertions, new entry point — a move, not a weakening).
3. **Pinned right at every width:** add `margin-left: auto` to `.tablify__title-actions` (the wrap case is what pushes a lone wrapped item right; `space-between` keeps the single-line case). Visual check at 1568px and 390px.

### Test-first (red first, then implement)
- `tests/views/titleRow.test.ts`: rewrite the link-list assertion to `['Export…']`; assert the other three labels are absent; assert `Export…` dispatches `onExport` and nothing else fires. (Existing expectations that pin four links change **because the issue changes them** — documented here and in the evidence doc.)
- `tests/views/tableViewTitleRow.test.ts`: retarget Import/Export-CSV/Copy-Markdown tests to command invocation; add a test that the three removed `data-action` buttons no longer exist in the rendered title row.

### Docs
- `docs/user-guide.md` §1 "The title row" (four links → single **Export…** button on the right), §12 (drop "click Import…" phrasing), §13 (the one-click shortcuts are now commands; adjust the parenthetical).
- `docs/shortcuts.md` if it lists title links.
- `CHANGELOG.md` `[Unreleased]` → **Changed** (house style: user-facing phrasing).
- `docs/evidence/SAD-98.md` + before/after crops at owner (1568×795) and phone (390×844) widths.

### Commit / Linear
One commit `SAD-98: …` (title-row buttons + commands + layout), `npm run check` green → push → Linear comment (root cause, what moved where, test counts, commit hash) → move to Done.

---

## Step 2 — SAD-99: remove the vault-path chip

### What exists today
- `src/views/titleRow.ts` — `TitleRowState.path`, `renderChip()`, the `#fileChip`-equivalent `span.tablify__file-chip` (`data-testid="tablify-file-chip"`); hidden when `path` is empty.
- `src/views/tableView.ts` `titleState()` returns `{ title: file.basename, path: file.path }`.
- Pins: `tests/views/titleRow.test.ts` (chip content + empty-path hiding), `tests/views/tableViewTitleRow.test.ts:114,123` (chip content after open/rename), `tests/visual/lib/regions.ts` parity region `file-chip`, `docs/user-guide.md` §1 ("the file's vault path").

### Design
1. Remove the chip element, `TitleRowState.path`, and `renderChip()` entirely. `TitleRowState` becomes `{ title: string }`. `titleState()` drops `path`. `update()` simplifies (no chip-only render path).
2. `tests/visual/lib/regions.ts`: drop the `file-chip` region. The prototype keeps `#fileChip` — record this as an **owner-directed deviation** from prototype parity in the evidence doc and the visual-parity README note (SAD-92/93 sweeps must not expect this region).
3. Assert **absence** going forward: `titleRow.test.ts` gets a "renders no path/file-name element" regression test; `tableViewTitleRow.test.ts` chip assertions are removed with the feature (they pinned the behaviour the issue deletes) — replace with the absence assertion so a re-introduction fails.

### Docs
- `docs/user-guide.md` §1 (drop the vault-path wording; "shows its name and one **Export…** button"), the rename note in the edit-title section ("the title shows just the name" — existing §5 wording stays true).
- `CHANGELOG.md` `[Unreleased]` → **Removed** ("the vault-path chip …").
- `docs/evidence/SAD-99.md` + crop.

### Commit / Linear
One commit `SAD-99: …`, gate green → push → Linear comment → Done.

---

## Step 3 — SAD-100: viewport-based default column freeze

### What exists today
- `src/model/view.ts` — `createDefaultView()` hard-codes `frozenColumns: 1` (primary frozen **everywhere**). `normalizeView()` coerces missing `frozenColumns` → `0` with a warning. `cloneView()` conditionally copies optional keys (`search`, `query`, `collapsedGroups`) to keep byte-identical round-trips.
- `src/format/parse.ts:176` — parse also coerces missing → `0`. `src/format/serialize.ts` — `VIEW_KEYS` whitelist (a key outside it never persists).
- `src/views/grid/GridView.ts` — `applyViewState` reads `view.frozenColumns` (clamped), computes sticky `left`s; a root `ResizeObserver` triggers `refreshGeometry`.
- `src/views/grid/toolbar.ts` — Options switch: `onFreezeColumns((frozenColumns ?? 0) >= 1 ? 0 : 1)`; `option-freeze` shows `frozenColumns >= 1`. Header context-menu "Freeze column" (`src/views/tableView.ts:901`): `setView({ ..., frozenColumns: col + 1 })`. Legacy multi-freeze files show the switch "on" (SAD-82) and keep working.
- `tests/views/tableView.test.ts:418-423` pins the toggle round-trip (`0 ↔ 1`); `tests/menus/fileMenuModel.test.ts:160` pins new-table `frozenColumns === 1`; `tests/sync/engineHarness.ts:71` uses `frozenColumns: 0` (explicit fixture).
- FORMAT_SPEC §12 already defines the precedent: optional view keys with "absent means default" semantics (`search`/`query` SAD-69, `collapsedGroups` SAD-81).

### Design — optional view key `freezeMode`, no formatVersion bump

**File state.** New optional view key `freezeMode?: 'viewport' | 'fixed'`:

| Stored state | Meaning |
|---|---|
| `freezeMode: 'viewport'` | follow the live viewport default (pane ≤ 639px → 0, else 1) |
| `freezeMode: 'fixed'` | `frozenColumns` is a deliberate choice; applies at every size |
| `freezeMode` absent, `frozenColumns === 1` | **legacy hard default** → treated as `'viewport'` (see migration) |
| `freezeMode` absent, `frozenColumns === 0` or `≥ 2` | legacy deliberate value → treated as `'fixed'` (0 stays unfrozen everywhere; legacy multi-freeze stays pinned — SAD-81/82 compatibility) |

**Runtime.** One helper in `src/model/view.ts`:

```ts
export function freezeModeOf(view: ViewDefinition): 'viewport' | 'fixed'
export function effectiveFrozenColumns(view: ViewDefinition, paneWidth: number): number
// effective = mode === 'viewport' ? (paneWidth <= 639 ? 0 : 1) : clamp(view.frozenColumns)
```

- **GridView** computes the effective count from its measured root width (`refreshGeometry` already re-measures) and re-applies sticky positions when a resize crosses 639px — live, per the issue ("based on the current viewport").
- **Options switch** shows the *effective* state; toggling writes `freezeMode: 'fixed'` + `frozenColumns: 0 | 1` via the existing `onFreezeColumns(count)` contract (tableView's callback adds the flag — the toolbar contract itself is unchanged). Once fixed, the switch is identical at every size ("explicit choice wins").
- **Header "Freeze column" / "Unfreeze"** (`tableView.ts:901` region) writes `freezeMode: 'fixed'` + the count.
- **`createDefaultView` keeps writing `frozenColumns: 1`** and adds `freezeMode: 'viewport'`. New tables are therefore auto, while an **older plugin build** that drops the unknown key degrades to today's behaviour exactly (frozen primary everywhere) — the safe direction.

**Persistence touch points** (house rules: conditional copy, byte-identical round-trips, guard tests):
1. `src/model/types.ts` — `freezeMode?: 'viewport' | 'fixed'` on `ViewDefinition`.
2. `src/model/view.ts` — `cloneView` conditional copy (like `collapsedGroups`); `normalizeView`/`validateView` accept `'viewport' | 'fixed'` and drop anything else with a warning; the two helpers above.
3. `src/format/serialize.ts` — add `freezeMode` to `VIEW_KEYS`.
4. `src/format/parse.ts` — `viewFromJson` passes the key through when valid.

**FORMAT_SPEC.md** — add `freezeMode` to the view-keys table as optional, with the interpretation table above in a short "viewport freeze default" note (docs-contract checker must pass). **No `formatVersion` change** — 1 and 2 are untouched; this is an optional key under the §12 precedent.

**Migration story (documented, deterministic).** Pre-change files always carry a number (normalize forced one). The only value that was ever a *default* rather than a choice is `1` (createDefaultView hard-coded it; the switch could only ever produce the same two values, so a deliberate "frozen" is indistinguishable from the old default). Policy, stated in FORMAT_SPEC + the user guide:
- `frozenColumns: 1` without `freezeMode` → viewport-auto. On a wide pane this renders identically to today (frozen primary) — zero desktop regression. On a narrow pane it renders **unfrozen, which is the point of SAD-100**.
- The one behavioural loss (a user who deliberately froze on mobile) is recovered by one switch tap, which writes `freezeMode: 'fixed'` and sticks.
- `0` and `≥ 2` never change meaning.

**Embeds** (`src/embed/*`): render through the same effective helper with the embed host width — no separate rule.

### Test-first (red first, then implement)
- `tests/model/` (new file or `tests/schema.test.ts`): `freezeModeOf` interpretation matrix (legacy 1 / legacy 0 / legacy 2 / explicit viewport / explicit fixed); `effectiveFrozenColumns` width matrix (639 boundary); normalize/clone/serialize round-trip preserves `freezeMode` and stays byte-identical when absent; invalid `freezeMode` dropped with warning.
- `tests/views/`: Options toggle on an auto view writes `freezeMode: 'fixed'` + `0`/`1`; header Freeze writes `'fixed'`; a grid rendered at 400px effective width pins nothing, at 1024px pins the primary column, and a live resize across 639px re-applies (the existing `tests/views/grid/*` suites pass explicit `frozenColumns` and must stay green unchanged).
- Existing pins that legitimately change: none expected — `fileMenuModel.test.ts:160` (`frozenColumns === 1`) stays green because the default keeps writing `1`; `tableView.test.ts:418-423` toggle round-trip stays green (numbers unchanged; the new flag is additive). Any pin that *does* move must be justified here in the evidence doc as behaviour the issue changes.

### Docs
- `docs/user-guide.md` Options section: "Freeze primary column" — default follows the viewport, switch overrides permanently; § the view-settings table.
- `FORMAT_SPEC.md` §4/§12 as above.
- `CHANGELOG.md` `[Unreleased]` → **Changed** (viewport default) + **Fixed** if resize behaviour needs a line.
- `docs/evidence/SAD-100.md` + crops (frozen on wide / unfrozen on narrow, same file).

### Commit / Linear
One commit `SAD-100: …`, gate green → push → Linear comment → Done.

---

## Cross-cutting: regression gate & protocol (unchanged from SAD-96/97 run)

- **Test-first every behaviour change**, implementation only after the red run is seen.
- **`npm run check` green after every change** — lint 0 errors (119 pre-existing warnings), **all** tests (baseline now **97 files / 1562 tests**), guard tests, `check:docs` (plan-doc path allowlist is pre-covered: `docs/plans/sad-98-sad-100-fix-plan.md` is the only new plan doc), FA-icon build, full build.
- **No existing test weakened** — retargets (SAD-98) assert the same behaviour through the new entry point; expectation changes are only for behaviour the issues themselves change (link list, chip absence), recorded in the evidence docs.
- One commit per issue on `main` (`SAD-NN: …` bullets), `npm run check` rebuilds `main.js` and it is committed; push with the PAT credential-helper command (token never in `.git/config`); Linear comment with root cause + fix + tests + commit hash; move each issue to Done (state `20caf607-…`).
- After the three steps: a Tablify **project update** summarizing the batch.

## Risks & edge notes

1. **Legacy `frozenColumns: 1` reinterpreted as viewport-auto** is a deliberate behaviour change on narrow panes for existing files (it is the issue's ask). Desktop rendering is bit-identical. Recovery for the rare deliberate-mobile-freeze is one switch tap. Stated in FORMAT_SPEC so it is policy, not accident.
2. **Older plugin builds rewriting a new file** drop `freezeMode` (their `normalizeView` keeps known keys only) → the table falls back to the legacy interpretation (frozen primary everywhere = old behaviour). Acceptable, self-healing, and the safe direction.
3. **Pane vs window width** — the freeze default keys off the table pane (`contentEl.clientWidth`, already used as `viewportWidth`). A full-width window with a narrow pane correctly gets mobile behaviour; the phone *toolbar* styling still keys off window width (CSS media) — cosmetic only, unchanged.
4. **Switch shows effective state on auto views** (off on a narrow pane even though the file has no explicit off). Toggling always writes an explicit state, so the switch can never feel "stuck"; once touched it is plain on/off at every size.
5. **Visual-parity harness** loses the `file-chip` region (SAD-99) and the title-row region contents change (SAD-98) — both owner-directed deviations from the prototype; recorded so the SAD-92/93 harness rediscovery does not treat them as regressions.

## Tracker hygiene (flag, do not act)

- **SAD-91 / SAD-93** remain closed although their steps never landed on `main` (06:42 status audit). Reopening is left to the owner.
- **SAD-96 / SAD-97** are currently in **In Review** (moved by the owner after completion) — left as the owner set them.
