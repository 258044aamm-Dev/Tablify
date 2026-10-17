# Changelog

All notable changes to Tablify are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- **One click on another cell while editing now selects it (COD-70)** — clicking a different cell
  with an editor open committed the edit but left the selection behind, so the cell had to be
  clicked twice. The commit re-rendered the rows under the pointer, and the browser never
  delivered the click that selects a cell; the press now finishes the edit and activates the cell
  itself. A checkbox toggles in that same click, an invalid value keeps the editor open with the
  cursor still in it, and everything else — Enter, Escape, touch, right-click — is unchanged.
- **Freezing now means one column, not a run of columns (COD-72)** — freezing is about the
  **primary column** only, so the column-header menu no longer offers *Freeze column* (it could
  only ever pin everything from the left edge, and on an already-frozen column it silently
  unfroze the ones to its right). The **Options → Freeze primary column** switch is the single
  control, and it is greyed out with the reason in its label on a pane too narrow to freeze
  (≤ 639 px), where nothing is pinned so the whole width stays scrollable. The primary column is
  now always the first column — it has no drag grip, and a column dropped onto it lands just
  after it — so "the frozen column" and "the primary column" can never drift apart when columns
  are reordered or hidden. The boundary is drawn: a hairline divider and a soft edge shadow mark
  where the frozen column ends, and the padding strip beside the row-number gutter is painted so
  scrolled cells no longer show through it. A table saved by an older build with several frozen
  columns opens with the primary column frozen and the rest scrolling normally; the removed
  `freezeMode` key is dropped on the next save.
- **Cells show what their value means, not its stored form (COD-71)** — a Single select cell shows
  the option as a coloured chip and a Multi select cell shows one chip per value, instead of the
  internal option ids (`opt_…`). Currency renders `1234.56`, percent `25%`, duration `1m 30s` (the
  file still stores minor units, the 0–1 fraction and milliseconds). A Checkbox is now a box you can
  click: one click is one undo step, and it is clickable in embeds too. Tables imported from CSV or
  Excel were always mapped correctly — only the grid was printing the raw value, which made imported
  select columns look like they carried fixed options.

### Changed

- **The header menu's *Field details…* is now *Modify field…*, and the window shows the whole
  field (COD-69)** — clicking a column header or choosing **Modify field…** opens the same window
  that creates a field, with every row the create dialog draws filled in from that field: name,
  type, options, validation rules, formula with its preview, and linked table. Create mode is
  unchanged. Saving is still one undo step; a save that changes nothing adds no undo entry.

- **Select options are edited through *Manage options…* in that window** — cells store each
  option's identity, so the window shows how many options the field has and opens the option
  manager instead of a free-text list, where renaming cannot be told apart from deleting and
  adding, and a delete clears the cells that used the option.

### Added

- **The rest of the grid now reads like the prototype (COD-73)** — a **Rating** cell is stars plus
  `4/5` (the scale is the field's Max), **Date and time** / **Created time** / **Last modified** show
  your local wall clock instead of the stored ISO instant, **URL** / **Email** / **Phone** cells are
  clickable links, **Number** cells group their digits (`1,234,567`) and the numeric columns sit
  right, an **Attachment** is one paperclip chip per file, and **Long text** clamps to two lines.
  Only the rendering changed: sort, search, copy and export still read the stored values.

- **Validation rules and formulas can be changed from the field window (COD-69)** — Required,
  Unique, Min, Max and Regex are pre-filled and editable for an existing field, and a formula
  field's expression is editable there next to its live preview. An invalid regex or an
  unparseable formula is refused before anything is written, and *Edit formula…* stays in the
  header menu.

## [2.0.0-beta.4] — 2026-10-17

### Added

- **Editing a field uses the same window that creates one (COD-67)** — clicking a column header,
  or choosing **Field details…** in its ⋮ menu (also on right-click), opens **Edit Field**: the
  same dialog as **Add New Field**, with the field's name and type filled in. Only the types that
  would convert every existing value are offered, the same rule the old type picker used. Create
  mode is unchanged.

- **Fields can be renamed, and formulas and saved queries follow (COD-67)** — renaming was not
  possible before. A rename now rewrites `{Old name}` in every formula of the table and the old
  name in the saved view query — `Price:>10` becomes `"Unit Price":>10` — and the whole edit is a
  single undo step. Names must be non-empty and unique within the table. Renaming and retyping at
  once is one step too; if the type change would lose values, nothing is applied. A rename leaves
  cell values and row revisions untouched, and Airtable sync is unaffected because it maps fields
  by id.

### Changed

- **Column headers show only the field name (COD-67)** — the type badge (icon plus type label) is
  gone from the header, freeing that width for the name. The field type is still recorded on the
  header cell for menus and tests. This is a deliberate divergence from the prototype, which still
  draws the badge.

- **The header menu's *Change field type…* is now *Field details…* (COD-67)** — it opens the field
  editor instead of a type-only picker. The picker had no other caller and was removed.

### Fixed

- **Date-and-time cells can be edited, and opening one no longer deletes it (COD-68)** — a
  `date_time` cell opened with an empty field even when it held a timestamp, and clicking away
  then erased the value. The editor now shows the stored moment in local time and accepts a date
  and a time; the file keeps storing the same UTC timestamp. Opening a cell and leaving it without
  typing anything changes nothing. A checkbox that was never set also stays unset instead of
  turning into an explicit "unchecked".

- **Double-clicking a cell edits it again (COD-66)** — the documented double-click did nothing,
  while Enter worked. The first click of the double-click rebuilt the grid rows, which destroyed
  the element under the pointer, so the browser never fired the `dblclick` that opens the editor.
  Selecting a cell now updates the highlight in place instead of re-rendering, so double-click
  reaches the editor again for text, select, attachment and link cells (read-only cells still
  open nothing). Single click still only selects, and keyboard navigation, row selection, row
  drag, the context menus and the embed view are unchanged. Files are not affected.

## [2.0.0-beta.3] — 2026-10-16

### Changed

- **Context menu branding (SAD-125)** — the folder right-click entries are renamed to
  "New Tablify Table" and "Import CSV or Excel to Tablify" and now carry icons
  (`file-plus`, `upload`). They are kept at the top of the folder context menu. Command IDs,
  behaviour and the `.tablify` file entries (Open / Duplicate / Export) are unchanged.

- **Row selection moves to the menu (SAD-114)** — the always-visible row checkbox column and the
  header select-all checkbox are removed. Select a row from its menu (**Select row** / **Deselect
  row**). Shift-click selects the rows from the last selected row to the clicked row. Ctrl/Cmd-click
  adds or removes one row. Selected rows are shaded. Bulk **Delete** is still on the summary bar.
  Selecting every row at once is not available any more.

- **Done rows move to the bottom (SAD-115)** — when a single-select field has an option named
  **Done**, changing a row to Done moves it to the bottom of its group (when the table is grouped
  by another field) or to the bottom of the table (when it is not grouped). Grouping by the same
  field does not move rows. A checkbox named Done does not trigger a move. The move is part of
  the same undo step as the value change. A status set to Done by an Airtable pull also moves the
  row. The move follows the saved row order, so in a sorted view it may not show until the sort is
  cleared.

- **Field count beside the row count (SAD-113)** — the title row's badge now shows the number of
  fields next to the row count, for example `12 rows · 7 fields`. The field count includes hidden
  fields and updates when fields are added, removed, hidden or shown. The row count is unchanged.

- **Small row height is distinct (SAD-112)** — the Small row-height setting now uses a 28px
  capsule (row pitch 44px). Before, Small and Medium both used 34px and looked the same. Medium
  (34px) and Large (40px) are unchanged. Existing files keep their saved row-height setting.

- **Sync modal is readable and themed (SAD-107)** — the Airtable sync modal now uses the Tablify
  theme tokens and the shared proto-modal styling, so its card, borders and status text no longer
  fall back to unstyled defaults. The error text is now full-contrast body text with an accent
  rule, not low-contrast accent-coloured text, and the secondary text no longer uses reduced
  opacity. Sync behaviour is unchanged.

- **Drag grips appear on hover (SAD-108)** — the `#` row-number grip and the column header grip
  are hidden until the pointer is over the row or column, then fade in. They stay visible on touch
  devices (no hover there) and on the row or column being dragged. Dragging works exactly as before.

- **Column freeze now follows the table pane width (SAD-100)** — the default freeze state is
  applied from the current viewport, not the device type: a mobile-width table pane (≤639px)
  starts unfrozen, a desktop-width pane starts with the primary column frozen, and resizing
  across that line changes it live. Touching the **Freeze primary column** switch or the
  header's **Freeze column** saves an explicit choice that then applies at every size. Existing
  files that still carry the old hard default (`frozenColumns: 1`) get the viewport behaviour;
  files with an explicit off or legacy multi-freeze keep their saved state everywhere.

- **Title row keeps a single Export… button (SAD-98)** — the **Import…**, **Export CSV** and
  **Copy Markdown** links are gone from the title row, and **Export…** alone sits on the right at
  every screen width. Nothing is lost: **Import CSV / Excel as table** stays on the command
  palette and the folder menu, and the two one-click current-view actions are now the commands
  **Export current view as CSV** and **Copy current view as Markdown**.

- **Exports save outside the vault (SAD-129)** — the format dialog and current-view CSV use a save-location picker, starting in Downloads where supported, with explicit share/download fallbacks. The default current-view scope follows saved search/query and view settings; formula values are included in all export formats. Pending edits and source/destination failures now receive explicit handling. The separate Markdown clipboard command is unchanged.

### Removed

- **Vault-path chip in the title row (SAD-99)** — the table's folder name and file name are no
  longer shown next to the title. Renaming (click the title) is unchanged.

### Fixed

- **One tooltip per control (SAD-109)** — toolbar buttons (Sync, Undo, Redo, Filter, Add row,
  Add field, View settings), the header `⋮` field menu, the option manager's delete and move
  buttons, and the filter builder's Remove button showed two tooltips at once (Obsidian's and the
  browser's). Each now shows one. The accessible names are unchanged. A hidden-field toggle for the
  primary field keeps its "cannot be hidden" reason, now in its single tooltip.

- **Invalid cells are marked and explained (SAD-109)** — a cell that breaks a field rule (an empty
  required field, a duplicate in a unique field, a number outside min/max, or a value that fails the
  regex) now gets the red marker and a tooltip with the rule message, as the user guide describes.
  This applies to existing tables, so cells that already break a rule will now show the marker. A
  formula error or a broken link keeps its own tooltip.

- **Cell editing is reachable the way the docs promise (SAD-96)** — double-click now opens a
  cell’s editor (inline editor, option panel, attachment panel or link picker, by field type);
  on touch, tapping the selected cell again edits it; and the cell menu gains **Edit cell**
  (disabled with a reason on read-only fields). Previously the only way in was the Enter key,
  so mouse and touch users could not edit any cell. Enter and Escape in the editor are now
  consumed there, so **Enter** commits and closes the editor instead of instantly reopening it.
- **Context menu appears reliably (SAD-97)** — the right-click menu was swallowed for about 1.5
  seconds after any click: a touch long-press guard (added for mobile) was being armed by mouse
  clicks too, so ordinary desktop right-clicks were treated as duplicates. The guard now applies
  to touch only. Row drag no longer blocks the menu before a drag has actually started, and its
  guard can never leak outside the grid. Right-clicking the row number or the checkbox now opens
  the row menu (Insert row above/below, Duplicate, Copy row, Delete row), matching the rest of
  the row.

## [2.0.0-beta.2] — 2026-10-12

### Added

- **Select panel, option manager and attachment panel (SAD-90)** — the prototype's anchored
  select card with hue-classed colour chips, **Create row** and a **Clear / Manage options**
  footer; the option manager (swatch / arrows / name / trash rows, **New option…**, every edit
  through one undoable `createSetFieldOptionsCommand`, delete carrying the affected cells); and
  the attachment panel — one vault-relative path per cell, its vault check warns and offers
  **Save anyway** (P3-04). (`721a858`)

- **Visual-parity harness (SAD-75)** — `tests/visual/` renders the real `TableView` and the
  prototype side by side under hostile host CSS, with pixel comparison for rest and interaction
  states; harness output is git-ignored. (`d5c4676`)

- **Options panel and Group by (SAD-81, prototype)**: **Options** now opens the prototype's
  view-settings panel: **Short / Medium / Tall** row height, a **Freeze primary column** switch,
  **Group by**, a multi-field **Sort** list (**+ Add sort…**, **A→Z / Z→A**, **✕**), a **Fields**
  list with **Hide / Show** for every field, and **Clear search & filters**. **Group by** (single
  select, checkbox, rating, text or date) splits the grid into groups, each with a header showing
  its value (select options as their coloured chip) and row count; click a header to collapse or
  expand it. The grouping is saved; collapsed groups are saved as the new optional
  `collapsedGroups` view key (FORMAT_SPEC §5), which older files simply do not have. Group by,
  sort and hide are undoable; collapsing is not. Embedded tables stay ungrouped. Freeze is now an
  on / off switch: files that freeze more than one column keep working and show it as on.

- **Row selection, bulk delete and row reorder (SAD-80, prototype)**: each row now has a
  checkbox, and the header checkbox selects every row the search or filter shows (or clears
  them). While rows are selected, the meta row shows the prototype's **"N selected · Delete"**;
  **Delete** removes them in one undoable step with a notice. Drag a row by its number (`#`) to
  reorder it, with the prototype's drop line and edge auto-scroll; mouse, pen and touch all work.
  A move is saved and undoable; while the view is sorted or grouped, the drag is refused with
  the prototype's message. Selection is UI state only: not saved and not undoable. Embedded
  tables are unchanged.

- **Prototype grid: header capsules, row numbers, Insert Row (SAD-79, prototype)**: the grid
  now uses the prototype's capsule layout. Each column header is a capsule with a drag grip, a
  key on the primary field, the name, the sort arrow (with its position in a multi-column sort),
  a type badge and a **⋮** button. **Click a header name** to sort ascending, descending, then
  off; **Shift-click** adds it as another sort key. **⋮** opens the column menu, the column edge
  resizes (120–520 px) and the grip drags a column to a new place. All of these are saved
  and undoable. Each row starts with a checkbox slot and its row number. Values sit in
  capsules and empty cells show a dash. **Insert Row** is inside the grid, under the last row.
  When the columns are narrower than the pane they stretch to fill it; the grid and card are
  only as tall as their content, up to the pane. Embedded tables keep a read-only header.

- **One "Search or query" box, Sync and Filter in the toolbar (SAD-78, prototype)**: the
  separate Search and Query inputs are merged into the prototype's single mono box. Free words
  search; `field:value` terms query; both combine (`ship Status:Done`). The two halves are still
  saved as the view's search and query, so existing files open unchanged with both shown in the
  box. Query errors show under the box with the position counted from the start of the box.
  The toolbar follows the prototype's order: **Sync** (same as the *Airtable sync for this table*
  command), **↶ ↷**, **Filter**, **Add Row**, **Add Field**, **Options**, with the prototype's
  measurements and Font Awesome Free 6.4.0 icons. On a narrow pane the buttons scroll sideways
  instead of overflowing.
- **Filter builder (SAD-78, prototype)**: **Filter** opens rows of *field · operator · value*
  joined by *and*, with the live equivalent query string, **Clear all**, **Cancel** and
  **Apply filter**. Each row is one query term, so the builder and the box always agree.
  Operators offered are the prototype's, minus the three the query engine does not accept
  (text "is not", multi-select "does not contain", number "≠"); formula and link fields are not
  listed. Values with commas, quotes or surrounding spaces round-trip exactly when quoted (`"a, b"`),
  and terms on unknown fields are kept rather than rewritten.

- **Title row (SAD-77, prototype)**: every table now opens with the prototype's title row above
  the toolbar. It shows the table name (click to rename the file in place; Enter commits, Esc
  cancels, invalid or colliding names are refused with a notice), the vault-path chip, and
  **Import…**, **Export…**, **Export CSV** and **Copy Markdown**. Export CSV and Copy Markdown use
  the current view (visible fields, sort, search and query); Export CSV never overwrites.
  The card, title and links use the prototype's measurements (card radius 32 / 24 px and padding
  28 / 16 px; title Poppins 30 / 24 px), verified against the prototype in dark and light, desktop and
  mobile. The row count moves to the prototype's meta row and reads `12 rows (of 40)` when filtered
  (was `12 of 40 rows`). Icons: Font Awesome Free 6.4.0 (CC BY 4.0).

- **New tables start ready to use (SAD-84)** — **New table** now creates five fields (`Name`
  primary text, `Notes` long text, `Status` single select with Todo / In progress / Done,
  `Due date`, `Attachments`) and three empty rows, so the first cell can be edited at once.
  Previously a new table had only `Name` and no rows. The file stays `formatVersion` 1. Import,
  Duplicate and existing tables are unchanged.

- **Insert Row button keeps balanced side spacing while scrolling (prototype)** — the button
  itself is now the sticky element, sized to the scrollport's visible width and pinned at the
  container's content edge. The whole pill (both rounded corners, equal left/right spacing,
  centered icon + text) stays fully in view at any horizontal scroll position; its wrapper row
  still spans the full table width. Centering/pinning during scroll is pure CSS (sticky);
  sizing re-syncs on render, viewport resize and live column drags.
- **Insert Row button spans the full scrollable table width (prototype)** — the button's wrapper
  was a plain block inside the overflow-x container, so it only covered the visible width and was
  left behind when scrolling right. `syncInsertRowWidth()` now sizes it to the table's full width
  after every grid render and live during column-resize drags, keeping it aligned with the grid at
  any viewport size.

- **Fixed, uniform cell dimensions (prototype)** — `#mainTable` now uses `table-layout: fixed`;
  every column carries an explicit width (default 160px or the user's resize), so content can
  never widen a column. Cell capsules have fixed heights matching the previous single-line
  rendering exactly (34px short/medium, 40px tall), with `overflow: hidden` + single-line
  ellipsis truncation. Full content stays accessible via hover tooltip and the cell editor;
  an actively-editing cell may grow transiently (long-text textarea scrolls internally,
  resize disabled). Row-number column widened to 40px so the drag grip + 3-digit numbers fit.

- **Row drag-and-drop reordering (prototype)** — drag the row-number cell (grip handle) to move a
  row; works with mouse and touch via Pointer Events (`touch-action: none` on the handle, so pages
  still scroll normally elsewhere). Terracotta drop-indicator line, dimmed dragged row, edge
  auto-scroll. Reorders go through `mutate()` (undo/redo + persistence); no-op drops create no
  history entry; row ids/cells/`modifiedTime` are untouched. Manual reordering is refused with a
  toast while sorting or grouping controls the row order.

### Changed

- **Host-CSS isolation and embedded fonts (SAD-76)** — fonts are embedded in `styles.css`, plugin
  controls are scoped past host CSS, and the search gutter, capsule focus ring and `[hidden]`
  handling are corrected. (`f62028b`)

- **Prototype modal shell and editing states (SAD-85)** — the shared modal card shell, cell
  editing and invalid states, and scrollbars (Step 7a of SAD-82). (`6a00bac`)

- **Add Field dialog (SAD-86)** — rebuilt in the prototype's layout (Step 7b). (`6dbdf00`)

- **Theme-aware focus ring (SAD-92)** — the search box's focus halo is now `--tablify-focus-ring`
  (15 % light / 20 % dark) with the 2 px WCAG 1.4.11 outline kept; both alphas are pinned by
  tests. (`7a93a6b`)

- **Smoother scrolling (SAD-79)**: scrolling within the rows already on screen no longer
  rebuilds them, so ordinary scrolling of large tables does about a third of the work it did.
- **Row height (SAD-79)**: rows follow the prototype's spacing (50 / 50 / 56 px for
  small / medium / large); small and medium look the same, as in the prototype.
- **Prototype refactored into three files** (`ce7870c`) — `Prototype/Anthropic Table Workspace.html`
  split into `Prototype/index.html` (markup + inline Tailwind CDN config), `Prototype/style.css`
  (all custom rules) and `Prototype/script.js` (entire app). No functional changes; UI, behavior
  and responsiveness preserved.
- **Primary-column freeze defaults to the viewport** (`c761a2a`) — `freezePrimary: 'auto'` resolves
  to off below 768px (mobile) and on at ≥768px (desktop); manual toggles store an explicit boolean
  that wins over the default; a debounced resize re-render applies the default when the viewport
  crosses the breakpoint; `serializeDoc` resolves `'auto'` to a boolean for schema conformance.

### Fixed

- **Stale cell highlight** (`ad03da5`) — tapping/clicking anywhere outside the grid now clears the
  focused-cell outline and range highlight (document-level mousedown handler; pending cell edits
  are committed first so no typed input is lost; clicks inside the grid, floating panels, or open
  modals leave the selection untouched).
- **Fragmented frozen columns during horizontal scroll** (`8e2da57`) — two root causes: transparent
  `border-separate` spacing gaps let scrolling capsules show through the frozen block, and sticky
  `left` offsets were hardcoded while table layout is auto. Fixed with exact-offset gap-filling
  shadows on `.sticky-col` and `syncFrozenOffsets()`, which measures rendered header widths +
  computed border-spacing after every render and aligns all sticky header/body cells.

### Removed

- **Empty-table hint (SAD-79)**: the sentence under an empty grid is gone; the Insert Row pill
  under the header is the way in, as in the prototype.

### Added

- **Prototype feature parity (SAD-72)** — `Prototype/Anthropic Table Workspace.html` upgraded
  from a visual sketch (~4 of 20 features) to a functional demonstration of **all 20 included
  features** of `spec/features.md`, per `docs/plans/prototype-feature-parity-plan.md` (single
  self-contained HTML file, D-O4; Feature 13 intentionally absent). Delivered in 7 batches:
  - `bac6e85` PR-00 — Tablify rebrand, neutral sample data, Poppins/Lora/JetBrains Mono,
    Ask-Claude modal removed.
  - `490771d` PR-01…03 — `.tablify` document model (formatVersion 1, stable `tbl_/fld_/row_/opt_`
    ids, views, localStorage), 19-type field registry, selects + option manager, attachments
    panel, system fields, Source modal.
  - `968fe05` PR-04…05 — full grid view (sticky/frozen, resize, drag-reorder, row heights,
    group-by) + complete §2.6 query grammar (`field:value`, `~ ! > <`, comma-OR, CSV-style
    quoting, `empty`).
  - `16a3669` PR-06…07 — undo/redo history, full keyboard navigation + TSV range copy/paste,
    validation rules (required/unique/min/max/regex) with invalid-cell highlighting.
  - `0608d13` PR-08…09 — CSV import (real parser + type inference + override UI; XLSX simulated
    per D-O3), export dialog (CSV/Markdown real, XLSX simulated per D-O2), cell/row/header
    context menus, vault sidebar with file/folder context menus.
  - `d0f6166` PR-10…11 + F11/F12 — note-embed view (live grid inside a simulated Obsidian note),
    formula engine (operators, `{Field}` refs, SUM/IF/CONCAT/DATEDIFF/ROUND/MIN/MAX/ABS, `#ERR`
    + circular guard, live preview), linked records (stable row IDs, picker, read-only peek),
    simulated Airtable sync suite (link/unlink, pull/push with per-row revisions, per-row
    conflict resolution keep local/remote/both, confirm-gated auto-create of missing fields).
  - PR-12 — in-app feature traceability checklist F01–F21 (header **Checklist** button), plan-doc
    execution evidence, this changelog entry.

### Verification

- Per-batch headless smoke suites (Node + DOM stubs against the extracted script); 41 assertions
  green on the final file. No real tokens in the prototype (masked `pat_demo…`, settings-only per
  §2.19); no `.tabula` references; all pre-existing prototype behaviors preserved.

- **Interaction states, empty and grouped fixtures (SAD-92)** — `tests/visual/capture-states.ts`
  drives hover / focus-visible / active over 10 targets per page at 1568x795 and 390x844, dark
  and light; the final matrix has 49 rows above 0.5 % and none unaccepted. A second 32-combo
  sweep covers the empty and grouped fixtures. Evidence: `docs/evidence/SAD-92.md` and
  `docs/evidence/visual-parity/sad-92/report-sweep-empty-grouped.md`. (`7a93a6b`, `519899f`)

## [2.0.0-beta.1] — 2026-10-10

**Pre-release for device testing.** Contains Phase 7 (embeds and Airtable sync) and Phase 8 (formulas and linked records). **Format version 2:** a file that uses a formula or link field is saved as `formatVersion: 2`. Tablify 1.0.2 and earlier refuse to open those files. Files without these fields are still saved as version 1.

### Added

- **Embedded tables (P7-01):** a ```` ```tablify ```` code block in a note shows a table, read from the `.tablify` file it names.
- **Airtable sync (P7-02 to P7-10):** link a table to an Airtable table. Pull, push, conflict handling and field creation are available from the sync modal. The token is kept in plugin settings and redacted from logs and saved files. Fields that do not map to a supported type are read-only.
- **Formula fields (P8-01 to P8-03):** 54 functions, read-only cells, error values such as `#DIV/0!` and `#CYCLE!` with a tooltip. Formula results are computed on open and are not saved. Dates use local time.
- **Linked records (P8-04):** link fields with a row picker, one chip per link, and a dashed chip for a missing row. The picker is the only way to set a link.
- **Link integrity check:** the command "Check link integrity (all tables)" lists broken links.
- **Names in sort, search and export:** a link column sorts, searches and exports by the linked row names. A broken link shows as `Missing row`.
- **Remove links to other tables:** a link cell that points at another table gets a menu item to remove those links.
- **Give this copy a new table ID:** a copy made with Obsidian's own Duplicate shares the table ID with the original. Its file menu offers this item, which changes only the copy's ID. Close the table tab first.

### Known limits (beta)

- The Airtable sync has been tested against a fake server only. Live Airtable tests and Obsidian checks have not been run.
- Renaming a field does not update formulas that use it. Those formulas show `#NAME?` until edited. Field rename is not built.
- Link fields have one target table each. To link into a second table, add a second link field.
- Export writes link names only; import does not restore links.
- Lookups and rollups are not included.

## [1.0.2] — 2026-10-10

### Added

- **Prototype-parity visual pass (SAD-71)** — the table view now matches `table-workspace.html`
  (light and dark) instead of the v1.0.1 flat panels:
  - **Capsule grid** — every header and body cell is a detached rounded capsule on a tinted
    inner shell; row separators and striping are retired. Header capsules carry grip dots and
    a JetBrains Mono type badge rendered from `data-field-type` (cell and header `textContent`
    contracts unchanged). Column widths, frozen offsets and row pitch are bit-identical, so
    every geometry guarantee from 1.0.1 holds.
  - **Workspace card** — toolbar and grid live inside one rounded card (card surface, subtle
    border, soft shadow) on a transparent app background; host theme flips reach the view
    surface and the grid without a model change.
  - **Toolbar restyle** — inline SVG icons, pill buttons with circular undo/redo, the Options
    menu is an anchored popover card with capsule option pills and solid active state, the
    row-count badge is mono, and inputs get the prototype's accent focus ring.
  - **Token ladder** — new `bg-inner` / `bg-capsule` / `bg-subtle` / `bg-stripe` / `on-accent`
    surfaces; every required text pair re-measured at WCAG AA or better in both themes
    (see `docs/evidence/P3-11.md` and `docs/evidence/SAD-71.md`).
  - **JetBrains Mono** bundled offline (latin-400, SIL OFL) for badges and the row count.
  - **Empty-state affordance** — an Insert Row pill above the grid when a table has no rows.
- **Resize refit** — the grid re-measures and refits when its pane resizes (ResizeObserver),
  ending the under/overfill and the black void beside short tables.

### Changed

- Add-field modal wears the plugin ladder (`.tablify__modal`), not host styles.
- Form-control rules are scoped to plugin surfaces (specificity guard covers the new selectors).
- `docs/evidence/fonts` bundle guard raised to 1.85 MB with recorded rationale (mono woff2 +
  dev sourcemap growth; production assets unchanged in shape).

### Notes

- Deferred to v1.1 (owner-accepted): checkbox/select-all column and bulk delete, row-number
  column, title row and in-pane export. Toasts stay Obsidian `Notice`.
- Visual sign-off evidence is owner screenshots on a real vault (see `docs/evidence/SAD-71.md`).

## [1.0.1] — 2026-10-10

### Added

- **Table toolbar** — a search box, a query field with inline errors, **Add row**, **Add field**, **Options**, **Undo/Redo**, and a live row-count badge, above the grid. The step that specified this UI (P3-08) was recorded as delivered, but the component was never built: the table view showed three bare buttons and nothing else. See `docs/evidence/P3-08.md`.
- **Options menu** — row height (small / medium / large), freeze columns, a **Show** button for each hidden field, and **Clear filters**. A hidden column can now be brought back from the UI.
- **Add field** — add a column from the toolbar with a name and type picker; the field and its place in the column order are a single undo step.

### Fixed

- **Dark-theme text contrast** — striped rows and the header used a mid-gray surface that put body text at **2.11:1**, far below the 4.5:1 WCAG AA floor. Two dark surface tokens were added; body text now measures **13.81:1** on striped rows and **12.19:1** on the header. `docs/evidence/P3-11.md` recorded the wrong pair, which is why this was not caught.
- **Header followed the Obsidian theme** — the grid header background and the selection outline used Obsidian's own CSS variables instead of Tablify tokens, breaking the plugin-scoped theming required by P3-09.
- **Row height did not apply to rows already on screen** — the grid recycles row elements and only set the height when an element was created.
- **Header scrolled independently of the body** — scrolling a wide table sideways moved the columns out from under their own headers.
- **Column widths and frozen columns were saved but never rendered** — both settings round-tripped through the file format and were ignored by the grid.

### Changed

- Row height is limited to **small / medium / large**. `compact` and `tall` were accepted by the model but rejected by the file schema, so choosing one could write a file the schema refuses.
- Search and query are saved in the file but are **not undoable**, so Ctrl/Cmd+Z steps through your edits rather than through your typing.

### Notes

- Confirmation inside a real Obsidian vault, on desktop and mobile in both themes, is still pending on the owner (device screenshots).

## [1.0.0] — 2026-10-09

First public release (MVP). Desktop and mobile.

### Added

- **Typed tables in `.tablify` files** — plain, pretty-printed JSON (`formatVersion: 1`) with stable row IDs, revisions, and per-file view settings; schema-validated on load.
- **Grid editor** — virtualized rows for ~1,000-row tables, cell editors for all field types (text, long text, number, date, checkbox, single select, attachment), range copy/paste as tab-separated text, bounded DOM usage.
- **Field system** — text, long text, number, date, checkbox, single select (create-on-type options with rename/recolor/reorder/delete), attachment (vault references with confirmation), validation rules (required, unique, number range) with visible invalid markers.
- **Undo/redo** — full local edit history; row deletion restores original row IDs and positions.
- **Query and views** — query language with parser/evaluator plus a filter builder; saved view settings (column width/order/hidden, frozen columns, row height, sort) stored in the file.
- **Context menus** — file explorer (.tablify: Open/Duplicate/Export; folder: New table/Import), table menu (cell/row/header actions with reasons for disabled items), keyboard open via Menu key or Shift+F10.
- **Mobile support** — long-press (500 ms) opens the same menu as desktop right-click; scrolling never triggers it; browser-safe dependencies only (no Node/Electron APIs).
- **Import** — CSV (RFC 4180: quotes, CRLF, BOM, delimiter detection) and XLSX with strict, documented type inference; atomic writes (no partial files on failure); collision-safe naming.
- **Export** — current view (default) or full table to CSV, XLSX, and Markdown; round-trip and differential tested against independent implementations.
- **Theming** — plugin-scoped light/dark themes with design tokens (Poppins headings, Lora body, bundled under the SIL Open Font License); body text contrast measured at 17.50:1 in both themes (WCAG AA).
- **Accessibility** — keyboard access for every MVP action, ARIA grid semantics (roles, row/column counts and indices, `aria-sort`, invalid-state announcement), axe-core automated DOM checks with zero violations.
- **Quality gates** — 567 automated tests (unit, model-based, differential, fuzz, integration-proxy, performance), lint with zero errors, `.tabula` extension guard, deterministic fixtures, per-step evidence under `docs/evidence/`.

### Known limitations

These are measured and disclosed rather than hidden:

1. **Type inference accuracy: 73.3 %** of labeled columns under strict rules (22/30 in the P4-03 benchmark; proposed threshold was 90 %). Strict inference deliberately leaves ambiguous columns as text rather than guessing wrong. Report: `docs/reports/p4-03-accuracy.md`.
2. **Platform verification status**: automated checks (567 tests, lint, build, guards) pass in CI-like conditions; on-device checks for Windows/macOS/Linux/iOS/Android (test matrix `docs/testing/matrix.md`), screen-reader checks (NVDA/VoiceOver), and real-device performance numbers are **owner-run checklists** — results are recorded as they are completed.
3. **Performance targets are sandbox-measured**: PERF-1…PERF-8 numbers published with this release come from Node/jsdom measurements (labelled approximations, see `docs/performance/`); jsdom runs ~10× slower than a real browser. Official numbers require the owner's hardware runs.
4. **CSV formula injection is not mitigated**: values beginning with `=`, `+`, `-`, `@` are exported as-is into CSV exports; open them carefully in spreadsheet applications (tracked for a post-1.0 hardening release).
5. **Column resize has no keyboard path** (drag only) — recorded as an accessibility backlog item (F-3 in `docs/accessibility/audit.md`).
6. **No settings tab in 1.0** — the plugin requires no configuration.

[1.0.1]: https://github.com/258044aamm-Dev/Tablify/releases/tag/v1.0.1
[1.0.0]: https://github.com/258044aamm-Dev/Tablify/releases/tag/v1.0.0
