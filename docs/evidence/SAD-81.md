# SAD-81: Step 6, Options panel and Group by

- **Linear:** SAD-81 (owner decision S-4: full prototype Options panel with Short / Medium / Tall, freeze toggle, Group by with collapsible groups, Sort list, Fields Hide / Show, clear search & filters, anchored float panel; S-5: freeze is an on / off toggle)
- **Date:** 2026-10-11
- **Base commit:** `80433e9`

## Change

### Options panel (prototype `openPanel`, `renderOptionsPanel`, `script.js` 744-770 and 1628-1695)

- **Panel.** The prototype's float panel: fixed-positioned under the **Options** button and right-aligned to it, clamped into the window (prototype `openPanel`). It is re-placed on scroll and resize while open.
  - **Card:** `bgPill` surface, `borderSubtle` border, radius 16, shadow `0 12px 32px rgba(0,0,0,.25)`.
  - **Inner:** 300px wide, padding 12, Lora 12/16, at most 70vh tall with its own scroll.
  - **Close:** Escape and an outside press close it, as before.
  - **Measurements** were taken from the prototype in Chromium (`.out/opts-*.txt` trees). Every size below is the prototype's.
- **Sections, in prototype order:**
  - **"View settings" title:** Poppins 11/600, uppercase, letter-spacing .55, muted.
  - **Row height:** **Short / Medium / Tall** pills (30h, 11px 500, gap 6); the active pill is filled.
    - The labels were Small / Medium / Large; the stored values (`small` / `medium` / `large`) are unchanged.
    - Short keeps the Medium pitch (the earlier step's decision).
  - **Freeze primary column:** a 36×20 switch with a 16px knob. **S-5:** on means `frozenColumns ≥ 1`. A file with `frozenColumns > 1` reads as on and keeps its value until the switch is turned off (→ 0). Turning it on sets 1.
  - **Group by:** a select with **None** plus the groupable fields (single select, checkbox, rating, text, date: prototype `groupable`). A non-groupable field already stored in the file stays listed, so the select shows the real state.
  - **Sort (multi — top first):**
    - one row per sort key: name chip, **A→Z / Z→A** (36×26, mono 10) to reverse, **✕** (16×16) to remove;
    - then a **+ Add sort…** select listing the unsorted fields.
  - **Fields (N hidden):** every field in column order (list max-height 144, rows 26h).
    - Visible fields have a **Hide** pill (40×22). The primary field's Hide is disabled (opacity .5) with the tooltip "Primary field cannot be hidden".
    - Hidden fields are struck through, with a filled **Show** pill (42×20).
  - **Clear search & filters** (276×30, radius 12): the prototype's `filter-circle-xmark` glyph. It empties the search and query and shows the prototype's notice, "Search & filters cleared".
- **Focus.** Every change re-renders the panel in place. Focus returns to the control that caused the change (`data-focus-key`), so keyboard users are not thrown back to the button.
- **Undo.** Group by, sort, hide, show, row height and freeze go through `session.setView()` and are undoable, like the same actions on the header menu.

### Group by and collapsible groups (prototype `renderGrid` group rows `script.js` 597-622, `toggleGroup` 1620)

- **New pure module `src/views/grid/grouping.ts`:** `groupRows(rows, field, collapsed)` takes the session's display rows (already sorted, searched and filtered) and returns the grouped rows plus one `GridGroup` per header.
- **Prototype rules kept:**
  - groups appear in order of first occurrence (not sorted by key);
  - an empty value forms the **(empty)** group; checkbox groups are `true` / `false`;
  - a collapsed group keeps its header and full count, but its rows leave the grid (not rendered, not selectable);
  - `#` row numbers run on across groups and skip the numbers of collapsed rows.
- **Group header.** Padding `16px 14px 2px`. The button holds:
  - a 9px chevron (down / right; Font Awesome, generated into `faIcons.ts`);
  - the value: a select option is drawn as its coloured chip (padding 2/10, 11px 500, 6px dot, inherited uppercase); other values are text, Poppins 11/600, uppercase, letter-spacing .55;
  - the count, JetBrains Mono 10/600.
- **Collapse.** A header click (or Enter / Space on its button) toggles the group. The collapsed keys are saved in the view as the new optional `collapsedGroups` (below).
  - Changing Group by clears them.
  - Collapse is **not** undoable (deviation 3).
- **GridView.** Grouped mode is opt-in: `setModel(rows, fields, view, groups)` and `GridOptions.groups` / `onToggleGroup`. Without groups the flat, uniform-pitch path runs exactly as before.
  - **Layout.** With groups, a layout of items (header or row) with cumulative tops drives the same windowed renderer: binary-search window plus overscan; header 40px with a chip, 34px text-only.
  - **Headers are not data rows.** They carry no `.tablify__cell` and no `data-row-id`, so cell selection, click-select, checkbox selection and the row-drag drop target ignore them.
  - **Row order.** Data rows keep contiguous `data-row-index` values (indices into the grouped rows), so keyboard navigation, editing and selection work unchanged.
- **TableView.**
  - `displayRows()` (grouped rows when Group by is set, else the session's display rows) replaces `session.getDisplayRows()` at the six grid sites.
  - The meta row count and exports still use the ungrouped display rows: the count includes collapsed rows, as the prototype's does.
  - Row drag stays blocked while grouped (SAD-80 message).
- **Embeds stay flat.** `embedView.ts` passes no groups.

### Format: `collapsedGroups` (FORMAT_SPEC §5, `tablify.schema.json`)

- **Key:** optional `string[]` on a view. The plugin omits it when no group is collapsed, so existing files and new tables serialise byte-for-byte as before.
- **Entries** are raw-value keys (option id, `"true"` / `"false"`, the stored string, the number as a string, `""` for the empty group), not labels. Renaming an option therefore does not reopen its group.
- **Validation:**
  - non-string entries are dropped with a warning;
  - a non-array value is dropped with a warning (in `normalizeView`, matching `search` / `query`);
  - clone, parse and serialize handle it like the other optional keys.

### View helpers (`src/views/grid/columns.ts`)

- `setGroupBy(view, fieldId | null, fields)`:
  - refuses unknown and non-groupable fields (returns the same view);
  - drops `collapsedGroups` on a change.
- `setSort(view, sort, fields)`: refuses a list with an unknown field or bad direction rather than repairing it.
- `hideField(view, fieldId, fields)`: refuses the primary field (R-D13 via `validateView`).

### Design tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `accentFill` (`--tablify-accent-fill`) | #CC785C | #CC785C | active pills, Show, switch on (prototype `bg-tablify-terracotta`) |
| `switchOff` (`--tablify-switch-off`) | #D1D5DB (new `switchOffLight`) | #4B5563 | switch track off (prototype `bg-gray-300 dark:bg-gray-600`) |
| `switchKnob` (`--tablify-switch-knob`) | white | white | switch knob |

**Option chips:** `optionChipColors(color, theme)` is the prototype's `OPT_COLORS`:
- a 15 % fill and 30 % border of the hue's Tailwind 500;
- a solid dot;
- 700 / 300 ink, with the three light-theme AA exceptions in deviation 1.

Plugin option colours map onto the prototype's hues (deviation 5).

## Decisions and deviations from the prototype

1. **AA text on fills and chips.** This follows the same rule as SAD-80 and `mutedLight`.
   - Text on the terracotta fill uses the on-accent ink: #1E1B18 light (5.23:1), #181715 dark (5.47:1). The prototype's white is 3.28:1.
   - In light theme, the emerald / amber / pink chip inks are the Tailwind 800 shade: 5.91 / 5.62 / 5.80:1 on their tint, where the prototype's 700 measures 4.22 / 3.98 / 4.44:1.
   - Every dark chip ink and the other light inks are the prototype's.
   - Geometry is identical; only the ink differs.
2. **Hidden field names are struck through in muted ink** (the prototype keeps body ink). The muted colour makes the hidden state readable at a glance and still passes AA.
3. **Collapse is not undoable.** Collapsing is navigation, like search. It is saved through `patchView` (no undo entry), so it never buries real edits.
   - **Known limitation (pre-existing pattern):** undoing an *earlier* layout change restores that whole view snapshot. That includes the collapsed groups, exactly as it already does for search and query since SAD-69.
   - Changing that would alter existing search / undo behaviour, so it is left as is.
4. **Group keys are raw values**, not labels (see Format).
5. **Colour mapping.** The plugin has nine option colours and the prototype seven chip hues:
   - brown / orange / yellow → amber;
   - green → emerald;
   - blue → sky;
   - red → rose;
   - gray, purple and pink map to themselves;
   - unknown colours → gray, as the prototype's `optColor()` does.
6. **A hidden primary field can still be shown.** A corrupt file can hide it; **Show** is the recovery path. Hiding it is still refused.
7. **`validateView` keeps `collapsedGroups` when `groupBy` is null.** It is inert there. TableView clears it on every Group by change, so it never applies to a different field.
8. **ARIA.** The panel is `role="dialog"` labelled "View settings". The **Options** button's existing attributes are unchanged.
9. **Freeze switch semantics (S-5):** see above. `frozenColumns > 1` is preserved until the user turns the switch off.

## Out of scope, found during verification

- **Select values in grid cells show the raw option id** (`opt_…`) instead of the prototype's chip. This is pre-existing: the cell renderer writes `String(value)` (`GridView.ts`, unchanged since `80433e9`).
  - It is the "typed cell formatting" follow-up.
  - Chips there could reuse `optionChipColors`.
  - Changing the cell renderer would alter an existing feature, so it is not part of this step.

## Tests

- **New `tests/views/grid/grouping.test.ts` (41):**
  - **grouping helpers:** first-occurrence order, contiguous regrouping, chip colours, `firstNumber` / `rowStart`, collapse skipping rows and numbers, deleted option id, checkbox `true` / `false`, text keys, groupable types, `toggleCollapsed` purity;
  - **`columns.ts` helpers:** Group by sets and drops `collapsedGroups`, refuses unknown and non-groupable fields; sort order and refusal; hide and the primary refusal;
  - **GridView grouped layout:**
    - chip vs text headers with count and chevron, chip paint from `optionChipColors`;
    - headers are not data rows; `aria-rowcount` with headers; `aria-colspan`; `aria-expanded`;
    - numbering across groups; collapsed header state and the skipped numbers;
    - header click → `onToggleGroup(key)` with no cell selection; Enter kept from the grid;
    - windowing of 400 grouped rows; `setModel(…, null)` back to flat; flat grid unchanged;
    - **axe** on a grouped grid with a collapsed group: 0 critical / 0 serious;
  - **TableView wiring:**
    - Group by select persists and groups, and offers only groupable fields; stored groupBy opens grouped; None → flat;
    - header collapse persists `collapsedGroups` and expanding omits it; stored collapse opens collapsed; Group by change clears it;
    - Add sort / reverse / remove persist and reorder the grid;
    - Hide / Show round-trip, with primary Hide disabled;
    - Clear search & filters with its notice;
    - focus kept on the re-rendered control;
  - **format:** `collapsedGroups` round-trip through parse / serialize; omitted when absent; non-string entries and non-array values dropped with warnings;
  - **contrast:** on-accent ink on the fill ≥ 4.5:1; switch on ≥ 3:1; every chip colour ≥ 4.5:1 on its blended tint, both themes.
- **Updated:**
  - `tests/views/toolbar.test.ts`: freeze select → switch (two tests); the empty hidden list now reads "(0 hidden)".
  - `tests/views/tableView.test.ts`: freeze switch persistence.
  - `tests/views/toolbarParity.test.ts`: panel is fixed, `bgPill`, radius 16, the prototype shadow; the active pill uses `accentFill`.
  - `tests/ui/formControlSpecificity.test.ts`: the five new button classes.
  - `tests/ui/theme.test.ts`: palette snapshot gains `switchOffLight`.
- **`npm run check`:** lint 0 errors (119 warnings, unchanged); vitest **1494** passing in 89 files (was 1453 in 88); guard, docs and icons PASS; build OK.

## Visual verification

**Commands:**

```
npx tsx tests/visual/capture-compare.ts --theme all --viewport all --fixture all --state default,options
npx tsx tests/visual/capture-compare.ts --theme all --viewport all --fixture new,grouped --state grouped
```

That is 48 + 12 combos: dark and light × owner, desktop and mobile. The full report is `visual-parity/sad-81/report.md`.

**Harness changes:**
- **New `grouped` fixture:** the new-table template with eight named rows whose Status covers every option plus an empty value.
- **New `grouped` state.** Both UIs are driven through their own panels with real input:
  1. Group by Status.
  2. Sort by the primary field.
  3. Add a second sort and flip it to Z→A.
  4. Hide the first hideable field.
  5. Compare the open panel.
  6. Close the panel, reset scroll and focus, then compare the grid.
- **New regions:** `group-header`, `group-chip`, `group-row` (geometry only) and `sort-arrow`.
- **Selector fix:** the prototype `type-badge` selector now requires `[title]`. It used to match the sort arrow first whenever a sort was active.

| Region (worst of all combos) | Pixel mismatch | Size |
|---|---|---|
| options-panel, default content (new / empty / populated) | ≤ 0.12 % | 302×472 / 360 / 388, matches |
| options-panel with two sorts, a hidden field and Group by set | ≤ 0.21 % | 302×530, matches |
| group-chip | ≤ 1.66 % | 71×22, matches |
| group-header (chip / text) | ≤ 4.24 % / ≤ 5.73 % | 102 vs 103 wide (chip); 84×16, matches (text) |
| sort-arrow | 0.00 % | 12×16, matches |
| grid-shell, grouped, new fixture (one "(empty)" group) | ≤ 0.41 % | matches |
| type-badge in the grouped state | ≤ 2.23 % | 49×22, matches |

**Reading notes:**
- **Group header.** The 1px width difference and the residual mismatch come from the chevron: the prototype uses the Font Awesome webfont, the plugin an SVG of the same glyph. Sub-pixel advance rounding moves the chip by ≤ 1px; this was already accepted for toolbar icons in SAD-78.
- **Grouped grid with eight rows.**
  - **Content matches exactly:** scroll height 689 px in both (measured in Chromium).
  - **Shell height differs** (555 / 660 / 560 px vs 691 / 683 px) because the plugin's shell is capped at the pane (S-6), while the prototype grows the page. The plugin scrolls inside instead.
  - **Insert Row:** the same cap moves the pill on desktop (≤ 5.30 %).
- **Mobile `options` state: only the panel region is meaningful.** Opening Options there must first bring the off-screen button into view.
  - The prototype scrolls the whole page sideways; the plugin scrolls its toolbar strip (the known SAD-78 mobile-toolbar deviation).
  - Both panels anchor under the button and match (≤ 0.12 %), but every region behind them is shifted.
  - The same regions match in the default state.
- **No regression in the default state.** Every region equals its SAD-80 value: grid-shell ≤ 0.76 %, header capsule ≤ 0.53 %, row number ≤ 1.01 %, type badge ≤ 2.41 %, insert row ≤ 0.01 %, title row ≤ 0.39 %, checkboxes 0.00 %.

**Captures** (`visual-parity/sad-81/`):
- `options-compare-{dark,light}.png`: the panel in the grouped state (prototype / plugin / diff);
- `grouped-compare-{dark,light}.png`: the grouped grid (prototype / plugin).

**Behaviour in Chromium** (eight-row fixture of the same shape as the harness `grouped` fixture, owner viewport, both themes, real clicks and keys; identical results in dark and light):

| Check | Result |
|---|---|
| Group by Status | 4 headers: Todo 3, In progress 2, Done 2, (empty) 1; numbers 1-8 |
| Panel placement (1568×795) | `position: fixed`, x 1236-1538, y 153-625: under the button, right-aligned, inside the window |
| Panel placement (360×640) | clamped to x 28-330 inside the 360px window, not clipped by the card |
| Collapse "In progress" (real click) | `aria-expanded=false`; rows 4-5 gone, numbers 1, 2, 3, 6, 7, 8; `collapsedGroups` = that option id |
| Reopen from the saved text | 4 headers, still collapsed, numbers 1, 2, 3, 6, 7, 8 |
| Freeze switch off / on | `frozenColumns` 0 / 1, `aria-checked` false / true, primary cell `static` / `sticky`; focus stays on the switch |
| Hide Notes / Show Notes | column gone, name `line-through` with a Show pill / `hidden` back to `[]` |
| Search "Task 1", then Clear search & filters | 1 row → box empty, 6 rows (the collapsed group stays collapsed) |
| Two sorts, second flipped (grouped harness state) | header arrows ▲1 / ▼2 as the prototype (`sort-arrow` 0.00 %) |

The "Search & filters cleared" notice is asserted in `grouping.test.ts` (the harness has no Obsidian notice UI).
