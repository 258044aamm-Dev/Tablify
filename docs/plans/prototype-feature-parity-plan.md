# Tablify — Prototype Feature-Parity Plan (PLAN ONLY)

**Date:** 2026-10-10 · **Repo:** `258044aamm-Dev/Tablify` @ `49a6770` (v1.0.2) · **Mode:** plan only — no prototype code changed yet
**Target file:** `Prototype/Anthropic Table Workspace.html`
**Sources:** `spec/features.md` (authoritative, 20 included features), `spec/branding.md`, `spec/glossary.md`, `docs/query-grammar.md`, `docs/shortcuts.md`, `docs/plans/prototype-parity-review.md` (SAD-71), `tablify.schema.json`

## 0. Direction of this work (do not confuse with SAD-71)

- **SAD-71 (done, v1.0.2):** plugin UI was restyled to match the prototype's *visual* language. The prototype was the **design source**.
- **This plan:** the prototype itself is upgraded so it **functionally demonstrates all 20 included features** of `spec/features.md`. The prototype becomes the **feature reference**: every included feature must be visible and (where browser-feasible) interactive in the single HTML file.
- The prototype's approved visual language (palette ladder, capsule grid, card wrapper — branding §5) is **kept**; the plugin and prototype stay visually aligned in both directions.

## 1. Owner decisions recorded 2026-10-10 (this session)

| # | Decision | Answer |
|---|----------|--------|
| PD-1 | Feature scope | **All 20 included features** (MVP + v1.1 embeds/Airtable + v2 formulas/linked records). Feature 13 (Kanban/Calendar/Gallery) stays excluded. |
| PD-2 | Obsidian-/network-dependent features (file-explorer menu, vault attachments, embed-in-note, Airtable sync) | **UI-only mockups** — the menus, dialogs, and panels appear with realistic content and flow, but behavior behind them is simulated/placeholder. |
| PD-3 | Typography | **Poppins (headings) + Lora (body) + JetBrains Mono (badges/counts)** per branding §4 and SAD-71 D-2. The prototype's Inter + DM Serif Display are retired. Palette ladder (branding §5) unchanged. |
| PD-4 | Plan delivery | Workspace doc + committed to repo (`docs/plans/`) + tracked in Linear. |

## 2. Verdict

The current prototype is a polished *visual* sketch but covers roughly **4 of 20** features, and two of those only partially. It has: 4 ad-hoc field types (text / status tag / 1–5 score / model badge), substring search, add row/field, row-select + bulk delete, CSV download, copy-Markdown, light/dark theme, and demo chrome (dataset tabs, "Ask Claude" modal, saved-to-cloud pulse). It has **no** `.tablify` document model, no typed-field registry, no query grammar, no view settings, no undo/redo, no keyboard grid navigation, no validation, no import, no XLSX export, no context menus, no select option manager, no attachments, no system fields, no embeds, no sync UI, no formulas, no linked records.

## 3. Gap register (feature → current prototype → required)

| # | Feature (spec §) | In prototype today | Required state after this plan | Mode |
|---|------------------|--------------------|-------------------------------|------|
| 1 | `.tablify` format (§2.1) | None — ad-hoc JS arrays, no stable row IDs, no schema header | In-memory document matching `tablify.schema.json` (formatVersion 1, schema + rows with stable IDs); "View file source" panel showing the exact serialized text; localStorage persistence | Functional |
| 2 | Typed fields (§2.2) | 4 ad-hoc types | All 13 scalar types: text, long text, number, currency, percent, duration, rating, checkbox, date, date & time, URL, email, phone — each with correct renderer + editor + Add Field support | Functional |
| 3 | Selects & attachments (§2.3) | "Status" and "Model" are hard-coded cycling badges | Single + multi select with colored options, searchable dropdown, create-on-type, option manager (rename/recolor/reorder/delete); attachment cell storing a vault-relative path typed + Enter | Functional (attachment preview mocked) |
| 4 | System fields (§2.4) | None | Auto number, created time, last-modified time — auto-set, read-only, visibly badged | Functional |
| 5 | Grid inline editing (§2.5) | contenteditable cells, commit on blur only | Commit on **Enter or blur**, cancel on **Escape**, for every editable type | Functional |
| 6 | Search / filter builder / query string (§2.6) | Plain substring search | Full grammar: `field:value`, `field:~value`, `field:>n` / `field:<n`, `field:!value`, `field:a,b`, `field:empty`, case-insensitive names, quoted names with spaces; filter-builder UI that round-trips with the query string | Functional |
| 7 | View settings (§2.7) | None | Multi-sort, group by, hide/show fields, column resize + drag-reorder, freeze primary column, row height — saved per view (localStorage) | Functional |
| 8 | Undo / redo (§2.8) | None | History covering cell edits, row add/delete, column changes, option changes; toolbar buttons + shortcuts | Functional |
| 9 | Keyboard navigation (§2.9) | None | Arrow-key cell focus, Tab/Enter advance, range selection, copy/paste of ranges, Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z | Functional |
| 10 | Validation rules (§2.10) | None | Per-field required / unique / min / max / regex; invalid-cell highlight; reason on hover; runs on edit and on save | Functional |
| 11 | Formula fields (§2.11) | None | Formula field type with the D-O1 default set (arithmetic/comparison operators, SUM, IF, CONCAT, date diff); editor dialog with live preview; recompute on dependency change | Functional (simple engine) |
| 12 | Linked records (§2.12) | None | Link field pointing at rows of the *other* prototype table by stable row ID; record-picker dropdown; linked chips open a read-only row peek | Functional (within the two in-memory tables) |
| 13 | Kanban/Calendar/Gallery | Absent | **Stays absent** (excluded by spec) | — |
| 14 | Import CSV/Excel (§2.14) | None | Import dialog: paste/choose CSV → header row, type-inference preview (text/number/date/checkbox/single-select), creates a new table and opens it. XLSX path appears in the dialog as a mocked choice | CSV functional, XLSX UI-only |
| 15 | Export CSV/XLSX/Markdown (§2.15) | CSV download + copy-Markdown (full table only) | Export dialog with **scope chooser** (current view vs full table, honoring filter + hidden fields); CSV + Markdown real downloads; XLSX button present with mocked download | CSV/MD functional, XLSX UI-only |
| 16 | File-explorer right-click (§2.16) | None | Mock vault sidebar listing `.tablify` files + folders; right-click (and ⋯ button) menus: file → Open / Duplicate / Export; folder → New table / Import CSV-Excel | UI-only (Duplicate/New table work in-memory) |
| 17 | Table right-click (§2.17) | Column ⋯ menu with Sort A→Z / Hide / Delete (toast stubs) | Full custom context menus — cell: Copy/Paste/Clear; row: Insert above/below, Duplicate, Copy, Delete; header: Change field type, Hide, Sort asc/desc, Freeze | Functional |
| 18 | Embedded table in a note (§2.18) | None | "Note view" tab: a mock Markdown note containing a ```tablify fenced block``` rendered as the live grid; edits in the embed reflect in the main grid | UI-only shell, live render functional |
| 19 | Airtable sync (§2.19) | None | Settings panel with masked token field + scopes note; "Link to Airtable" dialog (base/table pickers, mock data); manual **Pull** / **Push** buttons with simulated progress + results | UI-only |
| 20 | Conflict detection (§2.20) | None | Simulated conflict scenario on Push: conflict list dialog with per-row **Keep local / Keep remote / Keep both**; never silently overwrites | UI-only |
| 21 | Auto-create Airtable fields (§2.21) | None | On push with unmapped local fields: confirmation dialog listing fields + mapped Airtable types; proceeds only after confirm | UI-only |

**De-scoped prototype chrome** (not features; to be removed or rebranded — see O-1): dataset tabs as "Anthropic datasets", "Ask Claude" modal, "Saved to Anthropic Cloud" pulse, footer text. The two sample datasets are *kept* (renamed) because Feature 12 needs two tables.

## 4. Constraints & technical notes

- **Single self-contained HTML file** stays the format (owner can open it anywhere). Keep CDN usage as today (Tailwind CDN; Google Fonts switches to Poppins + Lora + JetBrains Mono). Replace Font Awesome icons with inline SVGs where convenient, matching the plugin's no-CDN icon direction (SAD-71 step 3) — optional, see O-2.
- **State model first:** all features hang off a real document model (`formatVersion: 1`, `schema.fields[]` with ids/types/options/validation, `rows[]` with stable ids + createdTime/modifiedTime/autoNumber). This is the backbone step; UI steps consume it.
- **Persistence:** localStorage snapshot per table + per-view settings, with a "Reset demo data" action.
- **Fonts/contrast:** keep the approved palette ladder; text pairs stay ≥4.5:1 (reuse the accessible clay `#6E655C` for muted-on-light, per SAD-71).
- **Token hygiene:** the Airtable settings mock must display a **fake** masked token only. Never embed any real token in the prototype. (Reminder recorded again: the GitHub PAT shared in the Linear project body is exposed credential material; branding.md §1 already says to revoke and re-issue. Recommendation stands.)

## 5. Step plan (PR-00 … PR-12)

Each step ends with a commit to `main` (repo rule). Acceptance = the listed checks pass manually in Chrome desktop + one mobile-width check.

| Step | Scope | Key acceptance |
|------|-------|----------------|
| **PR-00 Rebrand + typography** | Retitle to "Tablify Prototype"; swap fonts to Poppins/Lora/JetBrains Mono; remove/rename Anthropic-specific chrome per O-1; keep palette ladder | No Inter/DM Serif requests; headings Poppins, body Lora, badges mono; palette unchanged |
| **PR-01 Document model + file source panel** (F1) | In-memory `.tablify` docs for both tables per `tablify.schema.json`; stable row ids; localStorage; "View source" panel with serialized text; Reset demo | Source panel matches schema; edits persist across reload |
| **PR-02 Field registry — 13 scalar types** (F2, F5) | Renderer + editor per type; Enter/blur commit, Esc cancel; Add Field modal lists all types with per-type config | Every type addable, editable, formatted (currency symbol, %, duration h:mm, rating stars, checkbox, date/datetime pickers, URL/email/phone link-out) |
| **PR-03 Selects, attachments, system fields** (F3, F4) | Single/multi select with colors, searchable dropdown, create-on-type, option manager; attachment path cell; auto number / created / modified read-only fields | Option manager renames/recolors/reorders/deletes and updates cells; system fields auto-fill and refuse edits |
| **PR-04 Query grammar + filter builder** (F6) | Parser for §2.6 grammar; builder UI ⇄ query string round-trip; result count badge | All 6 grammar rows demonstrably work; quoted field names; case-insensitive |
| **PR-05 View settings** (F7) | Multi-sort (shift-click + panel), group by with collapsible groups, hide/show, drag resize + reorder, freeze primary, row height S/M/L; per-view persistence | Each setting visibly works and survives reload |
| **PR-06 Undo/redo + keyboard nav + range copy/paste** (F8, F9) | Command-pattern history; arrow/Tab/Enter focus model; range select; clipboard | Shortcut list in a "?" help popover matches `docs/shortcuts.md` subset; undo depth ≥50 |
| **PR-07 Validation** (F10) | required/unique/min/max/regex per field; red capsule outline + hover reason; validate on edit + save | Invalid demo rows ship in sample data; fixing clears the mark |
| **PR-08 Import + export** (F14, F15) | CSV import (paste/file) with inference preview → new table; export dialog with scope chooser; CSV/MD real, XLSX mocked | Imported table opens in tabs; "current view" export respects filter + hidden fields |
| **PR-09 Context menus** (F16, F17) | Mock vault sidebar + file/folder menus; full cell/row/header context menus | Every §2.16/§2.17 item present; functional ones act, mocked ones toast "simulated" |
| **PR-10 Embed view** (F18) | Note tab with fenced block rendering the live grid; edits sync both ways in-memory | Embed and main grid show identical data after edits |
| **PR-11 Airtable sync suite** (F19–F21) | Settings (masked fake token + scopes), link dialog, Pull/Push with staged mock scenarios: clean push, conflict set (keep local/remote/both), auto-create-fields confirm | All three flows walkable end-to-end; no real network calls; conflict never auto-resolves |
| **PR-12 Traceability + close-out** | Feature checklist 1–21 rendered inside the prototype (hidden dev panel) + this doc updated with evidence; contrast spot-check; CHANGELOG entry | Every feature row links to its UI location; all marked ✅ or "UI-only ✅" |

Suggested batching: PR-01 → PR-02/PR-03 → PR-04/PR-05 (parallel) → PR-06/PR-07 (parallel) → PR-08/PR-09 (parallel) → PR-10/PR-11 (parallel) → PR-12.

## 6. Open decisions (owner)

| # | Question | Default if unanswered |
|---|----------|----------------------|
| O-1 | Rebranding depth: rename "Anthropic Studio / Claude" chrome to Tablify wording (branding §2 forbids Anthropic naming in product surfaces; the prototype is internal but feeds screenshots/docs) | Rename everything to Tablify; drop "Ask Claude" modal |
| O-2 | Keep Font Awesome CDN icons or switch to inline SVGs like the plugin | Keep FA for prototype speed |
| O-3 | XLSX: truly parse/generate via SheetJS CDN, or keep UI-only mock | UI-only mock (consistent with PD-2) |
| O-4 | Keep the file as one HTML document even as it grows (~3–5× current size) | Yes, single file |

## 7. Out of scope

- Any plugin (`src/`) changes — the plugin already tracks the spec through the P0–P8 pipeline.
- Kanban/Calendar/Gallery views (Feature 13, excluded by spec).
- Real Airtable/network traffic, real vault/filesystem access.
- `.tabula` anything (scope rule §0).
