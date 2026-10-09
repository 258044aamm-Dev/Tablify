# Changelog

All notable changes to Tablify are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/).

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

[1.0.0]: https://github.com/258044aamm-Dev/Tablify/releases/tag/v1.0.0
