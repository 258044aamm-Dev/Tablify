# Tablify — Implementation Roadmap

**Type:** Plan only. No code is in this document.
**Companion docs:** `FEATURES.md` (what to build), `FEATURE_LIST.md` (original draft).
**Reference project:** airtable-tabula (MIT). We do not copy its code. We use its feature list only as a parity baseline.
**Status:** Ready for handoff. Open decisions are listed in §3.3 and do not block Phase 0–6.

---

## 0. How to use this roadmap

- Each work item has an ID (for example `P1-02`), dependencies, deliverables, and acceptance criteria (AC).
- Do not start an item until every ID in its **Depends on** column is done.
- Items marked **MVP** must be done before the first release. Items marked **v1.1** or **v2** come later.
- Follow the global Definition of Done (§9) for every item.
- If an AC cannot be met, stop and record the blocker in the decision log (§3). Do not change the AC silently.

---

## 1. Summary

Tablify is an Obsidian plugin that stores Airtable-like tables in `.tablify` files (formatVersion 1, JSON text). It supports desktop and mobile.

- **MVP (release 1.0):** typed fields, grid editing, query/filter, view settings, undo/redo, keyboard shortcuts, validation, CSV/XLSX import, CSV/XLSX/Markdown export, file-explorer right-click, table right-click (desktop and long-press on mobile).
- **v1.1:** embedded tables in notes, optional Airtable sync (pull, push, conflict detection, auto-create fields).
- **v2:** formula fields, linked records between tables.
- **Excluded:** `.tabula` support of any kind, Kanban/Calendar/Gallery views, lookups/rollups.

---

## 2. Constraints and non-goals

**Hard constraints**
1. Plugin ID `tablify`, plugin name `Tablify`. `isDesktopOnly: false`.
2. The plugin registers only the `.tablify` extension. It never reads, writes, imports, detects, or migrates `.tabula` files.
3. No Node-only APIs in runtime code (`fs`, `path`, `child_process`, Node `Buffer`-only paths). Mobile must work. Use the Obsidian vault API.
4. All network calls to Airtable use Obsidian's `requestUrl`, not `fetch`.
5. The Airtable token is stored only in plugin settings. It is never written to a `.tablify` file, logged, or exported.
6. Builds must follow Obsidian community plugin review rules (see P6-04).

**Non-goals for this release**
- Formula fields (v2).
- Linked records (v2).
- Kanban, Calendar, Gallery views (excluded).
- Lookups and rollups.
- Real-time multi-user editing.
- Conflict resolution beyond "detect and ask" (see P7-08).

---

## 3. Decision log

### 3.1 Locked decisions (from stakeholder answers)

| ID | Decision | Consequence |
|----|----------|-------------|
| D1 | Platforms: desktop **and** mobile | Long-press menu (P5-03), touch-safe grid, mobile QA (P6-01), browser-safe libraries only |
| D2 | Storage: pretty-printed JSON text, `formatVersion: 1` | Spec in P0-03. Reserved `sync` keys in v1 so v1.1 needs no migration |
| D3 | Formulas deferred to v2 | Formula level still open (D-O1). P8 blocked until decided |
| D4 | MVP = features 1–10, 14–17 | Sync, embeds, formulas, linked records are not MVP |
| D5 | Auto-create Airtable fields uses `schema.bases:write` | README and token-setup docs must list this scope (P7-09) |
| D6 | Name `Tablify`, extension `.tablify` | Used in manifest, commands, file registration |
| D7 | Target scale: about 1,000 rows per table | Performance targets in P6-02 |

### 3.2 Recommended decisions (applied unless the owner objects)

| ID | Decision | Why |
|----|----------|-----|
| R-D8 | Field IDs and row IDs are stable. Row values are keyed by **field ID**, not name | Renaming a field does not break data, sync, or links |
| R-D9 | Row IDs are generated once and never reused | Needed for undo, sync, and v2 links |
| R-D10 | View settings are stored in the `.tablify` file | The table travels with its layout |
| R-D11 | Duplicate table: new table ID, row IDs kept | Keeps row identity within each file; table ID changes so links stay unambiguous |
| R-D12 | Deleting a select option that is in use clears those cell values after a confirm dialog | Avoids dangling option IDs |
| R-D13 | Primary field cannot be hidden or deleted | Every row needs a visible label |
| R-D14 | Undo covers local edits only. Pull and push are not undoable, and the undo stack is cleared after a sync | Keeps undo predictable |

### 3.3 Open decisions (need an owner answer before the phase named)

| ID | Question | Needed by | Default if no answer |
|----|----------|-----------|----------------------|
| D-O1 | Formula level for v2: simple operators and a few functions, or Airtable-like function set? | P8-01 | Simple operators plus SUM, IF, CONCAT, date diff |
| D-O2 | XLSX read/write library. Must be browser-safe and mobile-safe. Candidates include `read-excel-file` (Tabula uses it for read) and a browser-safe writer. Final choice after spike | P4-02 | Spike two options, choose smaller working one |
| D-O3 | Plugin license | Before release (P6-06) | MIT, to match the reference's license model |
| D-O4 | Minimum Obsidian version | P0-01 | Set to the lowest version that supports every API used, verified during scaffold |
| D-O5 | Export "current view" vs "full table" default | P4-05 | Current view, with a checkbox for full table |

---

## 4. Phases and priorities

| Phase | Name | Priority | Release | Features covered |
|-------|------|----------|---------|------------------|
| P0 | Foundation and format spec | MVP-critical | 1.0 | 1 (partial), guard for `.tabula` |
| P1 | Data core | MVP-critical | 1.0 | 1, 2, 3, 4, 8, 10 |
| P2 | Query and view state | MVP-critical | 1.0 | 6, 7 |
| P3 | Grid UI | MVP-critical | 1.0 | 3, 5, 6, 7, 9, 10 |
| P4 | Import and export | MVP-critical | 1.0 | 14, 15 |
| P5 | Right-click | MVP-critical | 1.0 | 16, 17 |
| P6 | Hardening and release | MVP-critical | 1.0 | All MVP |
| P7 | Embeds and Airtable sync | High | 1.1 | 18, 19, 20, 21 |
| P8 | Formulas and linked records | Later | 2.0 | 11, 12 |

---

## 5. Dependency graph

```
P0-01 scaffold ──► P0-02 tooling ──────────────────────────────┐
P0-03 format spec ──► P1-01 field types ──► P1-02 row store ──┤
                         │                     │               │
                         ├──► P1-04 validation │               │
                         ├──► P1-06 select options             │
                         │                     ▼               │
                         │               P1-03 serializer ◄───┘
                         │                     │
                         │   P1-05 undo ◄──────┤
                         │                     │
P2-01 query parser ──► P2-02 filter engine ◄───┤
                         P2-03 view state ◄────┘
                                  │
P3-01 grid shell ──► P3-02 cell editors ──► P3-03 select UI
                         │        ├──► P3-04 attachments
                         │        ├──► P3-05 validation display
                         │        └──► P3-06 keyboard  (needs P1-05)
                         P3-07 column/row UI (needs P2-03)
                         P3-08 filter bar (needs P2-02)
                                  │
P4-01 CSV ─┐                      │
P4-02 XLSX ┴► P4-03 inference ─► P4-04 import ─┐
                                 P4-05 export ◄┘ (needs P2-02, P1-03)
                                  │
P5-01 file menu (needs P4-04, P4-05)
P5-02 table menu (needs P3-06, P1-05, P2-03)
P5-03 long-press (needs P5-02)
                                  │
P6-x hardening (needs all MVP items)
                                  │
P7-x sync and embeds (need P1-03, P0-03 sync keys)
P8-x formulas and links (need P1-02 stable IDs; P8-01 needs D-O1)
```

**Critical path (MVP):** P0-03 → P1-01 → P1-02 → P1-03 → P2-02 → P3-02 → P3-06 → P5-02 → P5-03 → P6-01 → P6-06.

**Parallel tracks that can run at the same time**
- Track A: P0-03, P1-x (data).
- Track B: P2-01 (pure logic, no dependencies). Can start on day one.
- Track C: P4-01, P4-02 spike (independent of UI).

---

## 6. Work items

Notation: **Depends on** lists item IDs. **AC** must all pass.

### Phase 0 — Foundation and format spec (MVP-critical)

| ID | Task | Depends on | Deliverables | Acceptance criteria |
|----|------|------------|--------------|---------------------|
| P0-01 | Scaffold Obsidian plugin (TypeScript, esbuild) with manifest `id: tablify`, `name: Tablify`, `isDesktopOnly: false` | — | Repo skeleton, `manifest.json`, `main.ts` stub | Builds to `main.js`. Plugin loads and shows in community plugin list on desktop and mobile. `minAppVersion` set (D-O4) |
| P0-02 | Tooling: ESLint with Obsidian rules, Vitest for pure modules, npm scripts `build`, `test`, `lint` | P0-01 | Config files, sample test | `npm run lint`, `npm test`, `npm run build` all pass on a clean clone |
| P0-03 | Write the `.tablify` format spec v1: `FORMAT_SPEC.md`, JSON Schema file, 3 sample files (empty, typical, edge cases) | — | `FORMAT_SPEC.md`, `tablify.schema.json`, `samples/` | Spec covers every field in §7. Schema validates all samples. Spec states that `.tabula` is not read |
| P0-04 | Extension guard: register only `.tablify`. No `.tabula` registration, import filter, detection, or migration prompt | P0-01 | Code in `main.ts` and tests | Vault with `.tabula` files: plugin does not open them, does not list them in import, and shows no migration prompt. Unit test asserts the registered extension list equals `["tablify"]` |

### Phase 1 — Data core (MVP-critical)

| ID | Task | Depends on | Deliverables | AC |
|----|------|------------|--------------|-----|
| P1-01 | Field type registry: 13 user types (text, long text, number, currency, percent, duration, rating, checkbox, date, date & time, URL, email, phone) plus single select, multi select, attachment, auto number, created time, modified time | P0-03 | `src/model/fieldTypes/*` with per-type `validate`, `parse`, `format`, `default` | Each type has unit tests for valid, invalid, and empty values. System types are marked read-only |
| P1-02 | Row store: create, read, update, delete rows; generate stable row IDs; auto number; created and modified timestamps; `rev` counter incremented on every change | P1-01 | `src/model/tableStore.ts` | IDs unique across 10,000 generated rows. `rev` increments exactly once per edit. Auto number never reused after delete |
| P1-03 | Serializer and parser for `.tablify`. Checks `formatVersion`. Preserves unknown keys on round-trip. Reports errors without overwriting the file | P0-03, P1-02 | `src/format/serialize.ts`, `parse.ts` | Round-trip of all samples is byte-identical after formatting. Unknown key survives a save. Invalid file gives an error and leaves the file untouched |
| P1-04 | Validation engine: required, unique, min, max, regex. Runs on edit and save | P1-01 | `src/model/validation.ts` | Each rule has positive and negative tests. Unique check is case-sensitive by default and documented |
| P1-05 | Command stack for undo and redo (R-D14) | P1-02 | `src/model/commands.ts` | Undo and redo work for: cell edit, row add, row delete, row duplicate, field type change, option change. Stack depth at least 100. Sync operations are not recorded |
| P1-06 | Select option model: color, create-on-type, rename, reorder, delete (R-D12) | P1-01 | `src/model/selectOptions.ts` | Creating an option from a value adds it once. Delete with values in use clears those cells only after confirmation |

### Phase 2 — Query and view state (MVP-critical)

| ID | Task | Depends on | Deliverables | AC |
|----|------|------------|--------------|-----|
| P2-01 | Query parser for the grammar in `FEATURES.md` §2.6. Pure module, no Obsidian imports | — | `src/query/parse.ts` | Every row in the operator table has a test. Quoted field names work. Case-insensitive field names. Syntax errors return a position |
| P2-02 | Filter engine: runs a parsed query over rows. Builder UI output is a query string, so both produce identical results | P2-01, P1-02 | `src/query/evaluate.ts` | Results match a reference table of 30 cases. Builder and query string give the same rows on the same data |
| P2-03 | View state: multi-sort, group by, hidden fields, column order and width, frozen column count, row height. Stored in `views[]` of the file (R-D10) | P1-03 | `src/model/view.ts` | Changing any setting writes to the file. Reopen restores all settings. Hidden primary field is rejected (R-D13) |

### Phase 3 — Grid UI (MVP-critical)

| ID | Task | Depends on | Deliverables | AC |
|----|------|------------|--------------|-----|
| P3-01 | Grid shell with virtual rows. Virtual columns optional. Works with touch scrolling | P1-02 | `src/views/grid/*` | 1,000-row table scrolls smoothly. Only visible rows are in the DOM (verify by DOM count) |
| P3-02 | Cell editors per field type | P3-01, P1-01 | `src/views/grid/editors/*` | Every type can be edited, validated, and saved. Enter commits. Escape cancels |
| P3-03 | Select dropdown: searchable, create-on-type, option manager dialog | P3-02, P1-06 | `src/views/grid/select/*` | Typing an unknown value offers "Create". Option manager rename and recolor persist |
| P3-04 | Attachment cell: vault-relative path, Enter to save, warning if the file does not exist in the vault | P3-02 | `src/views/grid/attachment.ts` | Valid path saves. Missing file shows a warning but still saves when confirmed |
| P3-05 | Validation display: red border and tooltip with rule message | P3-02, P1-04 | Styles and tooltip code | Invalid cell is visible without opening it. Tooltip shows the failing rule |
| P3-06 | Keyboard navigation: arrows, Tab, Enter, Shift+Tab, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+C and V on ranges | P3-02, P1-05 | `src/views/grid/keyboard.ts` | Every shortcut has a test or a manual test case in P6-01. No shortcut conflicts with Obsidian defaults |
| P3-07 | Column resize, reorder, freeze, row height UI, persisted | P3-01, P2-03 | `src/views/grid/columns.ts` | Settings survive reopen. Freeze keeps the primary column visible on horizontal scroll |
| P3-08 | Filter bar: search box, query string input, builder, multi-sort menu | P2-02, P2-03 | `src/views/grid/toolbar.ts` | Query errors show inline. Builder and text query stay in sync |

### Phase 4 — Import and export (MVP-critical)

| ID | Task | Depends on | Deliverables | AC |
|----|------|------------|--------------|-----|
| P4-01 | CSV parser: quoted fields, embedded newlines, BOM, `,` and `;` delimiters | — | `src/io/csv.ts` | Passes an RFC 4180 test set. Handles a 10,000-row file in under 1 second on desktop |
| P4-02 | XLSX spike and read/write choice (D-O2). Document findings in `docs/decisions/xlsx.md` | — | Decision record, spike code (not shipped) | Chosen library loads on iOS and Android Obsidian in a test build. Bundle size increase recorded |
| P4-03 | Type inference: text, number, date, checkbox, single select (when few distinct values) | P4-01, P4-02, P1-01 | `src/io/infer.ts` | Test set of 10 columns infers the expected type. Ambiguous columns default to text |
| P4-04 | Import command "Import CSV / Excel as table": creates `.tablify` in the chosen folder and opens it | P4-03, P1-03 | `src/commands/import.ts` | 500-row CSV and XLSX imports with row count and values matching the source |
| P4-05 | Export: CSV, XLSX, Markdown table. Current view or full table (D-O5) | P2-02, P1-03 | `src/io/export/*` | Exported rows match on-screen rows for the current filter. Markdown escapes pipes and newlines |

### Phase 5 — Right-click (MVP-critical)

| ID | Task | Depends on | Deliverables | AC |
|----|------|------------|--------------|-----|
| P5-01 | File explorer menu. `.tablify` file: Open, Duplicate (R-D11), Export. Folder: New table, Import CSV / Excel as table | P4-04, P4-05 | `src/menus/fileMenu.ts` | Each item appears only on the correct target. Duplicate creates a new file with a new table ID and the same row IDs |
| P5-02 | Table context menu on cell, row, and column header, as listed in `FEATURES.md` §2.17 | P3-06, P1-05, P2-03 | `src/menus/tableMenu.ts` | Each item works and is undoable where expected. Items that do not apply are hidden or disabled with a reason |
| P5-03 | Touch equivalent: long-press (about 500 ms) opens the same menu. Must not interfere with scrolling or selection | P5-02 | Touch handler in `src/views/grid/` | On mobile: long-press opens the menu, normal scroll does not. Tested on iOS and Android |

### Phase 6 — Hardening and release (MVP-critical)

| ID | Task | Depends on | Deliverables | AC |
|----|------|------------|--------------|-----|
| P6-01 | Test matrix: desktop (Windows, macOS, Linux) and mobile (iOS, Android). Scripted manual test cases for every MVP acceptance scenario (§10) | All MVP items | `docs/testing/matrix.md`, results log | All scenarios A1–A11 pass on every platform in the matrix |
| P6-02 | Performance check at 1,000 rows (D7). Targets are proposed and must be confirmed in this item | P3-01, P2-02 | Benchmark script, results | Open table under 1 second. Filter update under 200 ms. No dropped-frame stutter during scroll on a mid-range phone |
| P6-03 | Accessibility basics: focus visible, ARIA grid roles, keyboard-only use of every MVP action | P3-06, P5-02 | Audit notes | Every action reachable by keyboard. Screen reader announces cell and column names |
| P6-04 | Community plugin review checklist: use `Setting().setHeading()` for settings headings, `requestUrl` for network calls, `activeDocument` when working with DOM windows, no leaf detach on unload, no unsafe HTML insertion, no bundled Node-only code | P0-02 | `docs/review-checklist.md`, checked | Checklist complete with no open items. Lint passes with Obsidian rules |
| P6-05 | Documentation: README (install, features, Obsidian requirements), user guide for MVP, CHANGELOG | All MVP items | `README.md`, `docs/user-guide.md`, `CHANGELOG.md` | README does not mention `.tabula` as a supported format. Install steps verified by someone who did not build the plugin |
| P6-06 | Release: GitHub release with `main.js`, `manifest.json`, `styles.css`. Optional tag-triggered workflow with build attestation (as the reference project does). License file per D-O3 | P6-01 to P6-05 | Tagged release 1.0.0 | Release assets install correctly in a clean vault on desktop and mobile |

### Phase 7 — Embeds and Airtable sync (v1.1)

| ID | Task | Depends on | Deliverables | AC |
|----|------|------------|--------------|-----|
| P7-01 | Embed code block (feature 18). Fence language `tablify` with the file path inside | P3-01, P1-03 | `src/embed/*` | Embed renders the table. Edits save to the source file. Two embeds of the same file stay in sync after each save |
| P7-02 | Airtable client: list bases and tables, read and write records, pagination, rate-limit queue with backoff. Uses `requestUrl` | — | `src/sync/airtableClient.ts` | Client handles 429 responses with retry. Pagination returns all records for a 2,500-record test table |
| P7-03 | Token storage: plugin settings only, masked input, never written to `.tablify` | P0-01 | `src/settings.ts` | Token is absent from every `.tablify` file after link, pull, and push. Grep test in CI on the sample folder |
| P7-04 | Link metadata in the `sync` block of the file (keys reserved in v1). Per-row `sync.airtableId` and `sync.syncedRev` | P0-03, P1-03 | Format update in `FORMAT_SPEC.md` | Link survives save and reopen. Old v1 files without `sync` still open |
| P7-05 | Field type mapping Airtable ↔ Tablify. List unsupported Airtable types and show them as read-only | P1-01, P7-02 | `src/sync/fieldMap.ts` | Mapping test covers every supported type. Unsupported types are shown, not dropped |
| P7-06 | Pull from Airtable (feature 19): manual action, writes to file, creates undo boundary | P7-02, P7-04, P7-05, P1-02 | `src/sync/pull.ts` | Pulled values match Airtable for a 200-record test table. Local-only rows are kept |
| P7-07 | Push to Airtable (feature 19): manual action | P7-02, P7-04, P7-05 | `src/sync/push.ts` | Pushed records match local values. Records changed remotely since last pull are not overwritten (handled by P7-08) |
| P7-08 | Conflict detection (feature 20): compare row `rev` and `syncedRev` with remote change timestamps. Show keep local, keep remote, keep both | P7-06, P7-07 | `src/sync/conflicts.ts`, dialog | Test with a row changed on both sides shows the dialog. No silent overwrite. Keep both creates a new row |
| P7-09 | Auto-create missing Airtable fields on push (feature 21, D5). Lists fields before creating, requires confirmation. README and setup docs list `schema.bases:write` | P7-05, P7-07 | `src/sync/autoCreate.ts`, docs | Confirmation dialog appears before any field is created. Token without the scope shows a clear error |
| P7-10 | Sync UI: link dialog (base, table, replace-columns option), pull and push buttons, last sync time and status | P7-06, P7-07 | `src/views/sync/*` | Full flow works: link, pull, edit, push, pull again. Status shows last sync time |

### Phase 8 — Formulas and linked records (v2, later)

| ID | Task | Depends on | Deliverables | AC |
|----|------|------------|--------------|-----|
| P8-01 | Formula spec. Requires D-O1 answer | D-O1 | `docs/formula-spec.md` | Spec reviewed. Function list and error behavior defined |
| P8-02 | Formula engine: parser, evaluator, dependency graph, cycle detection | P8-01, P1-01 | `src/formula/*` | Cycles reported as errors, not crashes. Test suite covers every function |
| P8-03 | Formula field type and UI | P8-02, P3-02 | `src/model/fieldTypes/formula.ts` | Formula recalculates on dependent edits and is read-only in the grid |
| P8-04 | Linked records: link field type, cross-file references by table ID and row ID, broken-link display | P1-02, P1-03 | `src/model/link.ts`, UI | Renaming a linked row keeps the link. Deleting a target shows a broken-link marker instead of data loss |

---

## 7. File format v1 contract (summary)

Full spec is `FORMAT_SPEC.md` (P0-03). Summary for implementers:

```json
{
  "formatVersion": 1,
  "tableId": "tbl_01J8Z3K9Q4",
  "name": "Tasks",
  "fields": [
    { "id": "fld_name",   "name": "Name",   "type": "text", "primary": true },
    { "id": "fld_status", "name": "Status", "type": "single_select",
      "options": [ { "id": "opt_todo", "name": "To do", "color": "gray" } ] }
  ],
  "rows": [
    {
      "id": "row_01J8Z3M2A7",
      "rev": 3,
      "updatedAt": "2026-10-09T10:00:00Z",
      "values": { "fld_name": "Write spec", "fld_status": "opt_todo" },
      "sync": null
    }
  ],
  "views": [
    { "id": "view_default", "name": "Default", "sort": [], "groupBy": null,
      "hidden": [], "frozenColumns": 1, "rowHeight": "medium", "columnWidths": {} }
  ],
  "syncLink": null
}
```

Rules:
- `formatVersion` is required. Unknown versions show an error and do not write.
- Values are keyed by field ID (R-D8).
- `sync` (per row) and `syncLink` (per table) exist in v1 as `null`, so v1.1 needs no migration.
- Unknown keys are preserved on save.
- The file must never contain the Airtable token.

---

## 8. Risks

| ID | Risk | Likelihood | Impact | Mitigation | Owner trigger |
|----|------|-----------|--------|------------|---------------|
| R1 | JSON storage looks too similar to `.tabula`, so the new format has no clear advantage | Medium | Medium | Document differences: stable IDs, per-row `rev`, reserved sync keys, formatVersion checks, schema file. Show these in README | Stakeholder review of FORMAT_SPEC |
| R2 | Mobile support adds cost: touch grid, long-press conflicts with scroll, memory on large tables | High | High | Build mobile-safe from P0. Long-press is its own item (P5-03). Test early in P6-01 | Mobile smoke test fails in P3 |
| R3 | XLSX libraries break on mobile or add large bundle size | Medium | High | Spike in P4-02 before depending on it | Bundle over agreed size or mobile crash |
| R4 | Two views or a sync write change the same file at once, causing lost data | Medium | High | One in-memory store per file. Debounced writes. Reload on external change. Tests for concurrent edits | Any lost-edit bug in P3 or P7 |
| R5 | `schema.bases:write` makes users nervous about token power | Medium | Medium | Clear README explanation. Feature 21 is optional (only runs when the user confirms). Token is never written to files | User feedback after 1.1 |
| R6 | Airtable rate limits and pagination cause partial pulls or pushes | Medium | High | Queue with backoff (P7-02). Show progress and errors. Partial failure reports which records failed | 429 errors in test runs |
| R7 | Undo interacts badly with pull and push | Medium | Medium | Undo covers local edits only (R-D14). Stack cleared after sync | Undo restores stale values in test |
| R8 | Community plugin review rejects the release | Medium | High | Checklist in P6-04, lint with Obsidian rules, follow reference project's review fixes | Review feedback |
| R9 | Formulas or linked records creep into MVP | High | High | Explicit non-goals (§2). Any change needs a decision log entry | Scope request during MVP |
| R10 | Obsidian API changes break right-click menus | Low | Medium | Pin `minAppVersion`. Test on current Obsidian at each release | Obsidian update |
| R11 | Format change in later versions breaks old files | Low | High | `formatVersion` checks. Unknown-key preservation. Migration tests from v1 samples | Any format bump |
| R12 | Airtable auto-create creates unwanted fields | Low | Medium | Confirmation dialog listing exact fields (P7-09) | User report |

---

## 9. Global Definition of Done

An item is done only when all of the following are true:

1. All AC for the item pass, with evidence (test name, or manual test case ID).
2. `npm run lint`, `npm test`, and `npm run build` pass.
3. No code path reads, writes, or registers `.tabula`.
4. No Node-only API is used in runtime code.
5. No Airtable token appears in any file, log, or export.
6. Public behavior is documented in `FEATURES.md` or the user guide.
7. The decision log (§3) is updated if any decision changed.

---

## 10. MVP acceptance scenarios (release 1.0)

| ID | Scenario | Pass condition |
|----|----------|----------------|
| A1 | Right-click a folder → New table | New `.tablify` file opens in the grid with a default primary field |
| A2 | Import a 500-row CSV | Row count and cell values match the source. Types inferred as expected |
| A3 | Import a 500-row XLSX | Same as A2 |
| A4 | Filter with `status:Done name:~ship`, then build the same filter in the builder | Both return the same rows |
| A5 | Edit a cell, delete a row, change a field type, then undo three times and redo once | Each step reverts or re-applies correctly |
| A6 | Right-click a row → Duplicate | New row with a new row ID, `rev: 1`, same values |
| A7 | On mobile, long-press a row | Same menu as desktop right-click. Normal scrolling still works |
| A8 | Export the filtered view to CSV, XLSX, and Markdown | Exported rows match the on-screen filter result |
| A9 | Vault with `.tabula` files | Tablify does not open, import, or prompt to migrate them |
| A10 | Open a `.tablify` file with broken JSON | Error shown, file unchanged on disk |
| A11 | Set column width, freeze, and sort, then restart Obsidian | All settings restored |

---

## 11. Acceptance for later releases

**Release 1.1**
- Embed renders and edits the source file (P7-01).
- Full sync loop works: link, pull, edit, push, pull again (P7-10).
- Conflict dialog appears when the same row changed on both sides (P7-08).
- Auto-create shows the field list and waits for confirmation (P7-09).
- Token absent from all `.tablify` files after the full sync loop.

**Release 2.0**
- Formula spec approved (P8-01) before any engine code.
- Formula cycles produce a visible error, not a crash.
- Renaming a linked row keeps the link. Deleting a target shows a broken-link marker.

---

## 12. Suggested module layout

```
src/
  main.ts                 plugin entry, command and event registration
  settings.ts             settings tab, token storage (P7-03)
  model/                  pure logic, no Obsidian imports
    fieldTypes/           P1-01
    tableStore.ts         P1-02
    validation.ts         P1-04
    commands.ts           P1-05 undo/redo
    selectOptions.ts      P1-06
    view.ts               P2-03
  query/                  P2-01, P2-02 (pure)
  format/                 P1-03 serialize/parse, schema checks
  io/
    csv.ts, infer.ts      P4-01, P4-03
    xlsx.ts               P4-02 (decision record first)
    export/               P4-05
  views/
    grid/                 P3-01 to P3-08
    sync/                 P7-10
  menus/
    fileMenu.ts           P5-01
    tableMenu.ts          P5-02, P5-03
  sync/                   P7-02 to P7-09 (Airtable)
  embed/                  P7-01
  formula/                P8-02 (v2)
docs/
  decisions/              decision records (e.g. xlsx.md)
  testing/matrix.md       P6-01
  review-checklist.md     P6-04
samples/                  .tablify sample files used by tests
```

Rule: `model/`, `query/`, and `format/` must not import from `views/`, `menus/`, or `sync/`. This keeps the logic testable and mobile-safe.

---

## 13. Handoff checklist

Before a new developer or agent starts:

- [ ] Read `FEATURES.md`, then this file, then `FORMAT_SPEC.md` once it exists.
- [ ] Confirm the decision log (§3) has no open item needed for your phase.
- [ ] Start with the items that have no dependencies: P0-01, P0-03, P2-01, P4-01, P4-02.
- [ ] Record every deviation from an AC in the decision log before merging.
- [ ] Ask the owner before touching any item in §2 non-goals.
