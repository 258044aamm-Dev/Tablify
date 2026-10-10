# Changelog

All notable changes to Tablify are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Insert Row label stays centered in view (prototype)** — the icon + text now live in a
  `position: sticky; left: <container padding>` strip sized to the scrollport's visible width
  (synced on render/resize), so they remain perfectly centered in the visible button area at any
  horizontal scroll position. Pure CSS during scrolling — no per-scroll JS; button behavior,
  styling and the full-width pill are unchanged.
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
