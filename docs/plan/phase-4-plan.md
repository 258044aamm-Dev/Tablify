# Phase 4 Plan — Import and Export

**Status:** PLAN ONLY (no code written yet)
**Date:** 2026-10-09
**Linear:** SAD-36 (P4-01), SAD-37 (P4-02), SAD-38 (P4-03), SAD-39 (P4-04), SAD-40 (P4-05)
**Specs (authoritative):** `spec/phases/P4.md`, `spec/steps/P4-01..05.md`, `spec/guidelines.md` §0, §1, §7 (P4), `spec/roadmap.md` §3, §6

---

## 1. Current repo state (as analyzed)

| Area | State |
|------|-------|
| Phases 0–1 | Done. Gates `docs/gates/phase-0.md`, `phase-1.md` = PASS |
| Phases 2–3 | Commits exist (P2-01..03, P3-01..11). **No gate notes** for Phase 2 or 3 |
| `src/io/` | Does not exist |
| `src/main.ts` | Still the hello-world stub. No real commands are wired yet |
| Dependencies | No CSV or XLSX library installed. Test-only reference libraries are needed for T-D |
| Reusable modules | `src/model/tableStore.ts` (rows, IDs), `src/model/fieldTypes/*` (19 types), `src/model/validation.ts`, `src/format/serialize.ts` / `parse.ts` (atomic-ready `.tablify` I/O), `src/query/*` + `src/model/view.ts` (filter, sort, visible columns for export scope), `src/utils/idGen.ts` |
| Test harness | Vitest, `npm run check` = lint + test + guard + build |

## 2. Decisions locked for this phase (from your answers)

| Item | Decision |
|------|----------|
| D-O2 XLSX library | Run the spike (P4-02). Compare `read-excel-file` for reading plus one browser-safe writer, and choose the smaller working option based on measurements |
| D-O5 Export default | **Current view** by default, with a "Full table" checkbox |
| Device / Obsidian-vault checks (T-I, T-M-DEV) | Automate what I can in Vitest with a vault-free harness. Mark device and vault checks **NOT RUN** with reasons in evidence. They block the gate until you accept the risk in the decision log |
| Wiring | Wire P4 commands into `src/main.ts` (Import, Export). Keep P5 menus out of scope |
| Git | One commit per step (`P4-0x: ... (SAD-nn)`), then push |

## 3. Conflicts and gaps found in the spec (need your sign-off)

| # | Issue | Proposed resolution |
|---|-------|---------------------|
| C1 | **P4-03 test set size.** Roadmap says "10 columns". Guidelines say "≥30 columns × 100 values, with noisy values" | Use the **guidelines** (stricter). Confirm |
| C2 | **Phase 3 gate.** `P4.md` says Phase 3 gate must pass for UI steps. No Phase 2 or 3 gate file exists | I will build the Phase 2/3 gate check first (run `npm run check`, confirm all evidence), then proceed. Confirm you accept this |
| C3 | **PERF-6 and PERF-7** are *proposed*. Public claims must wait for owner confirmation (guidelines §0.7) | Record as "proposed" in evidence. Do not claim pass as a release fact |
| C4 | **P4-02 "loads on iOS and Android"** cannot be run here | Mark T-M-DEV as NOT RUN. The decision record will list the measured desktop numbers only |
| C5 | **P4-03 accuracy threshold (≥90%)** is *proposed*. The labeled set is authored by me, so accuracy on my own set is not independent | Report the measured number and say so in the accuracy report. Do not report above the measured value |
| C6 | **P4-04 wording.** Roadmap says "creates `.tablify` in the chosen folder". Guidelines say "Name collision: append a number" and "Import CSV / Excel as table" | Implement both: chosen folder (desktop picker), collision → `Name 2.tablify`, never overwrite |

## 4. Step-by-step plan

Order follows the dependency graph: P4-01 and P4-02 can start first (no dependencies). P4-03 needs both plus P1-01. P4-04 needs P4-03 and P1-03. P4-05 needs P2-02 and P1-03.

### Step P4-01 — CSV parser (SAD-36) — MVP
- **Files:** `src/io/csv.ts`, `tests/io/csv.test.ts`, `tests/io/csv.differential.test.ts`, `tests/io/csv.fuzz.test.ts`, `samples/fixtures/fx-csv-rfc/*`
- **Behavior:** RFC 4180 (quoted fields, `""` escapes, embedded `,` / `;` / newlines, CRLF and LF), strip UTF-8 BOM, delimiter detection `,` vs `;` on line 1 (rule recorded in code and evidence), chunked streaming parser (no full string copy)
- **Tests:** T-U (RFC examples + FX-CSV-RFC), T-D (10,000 random CSVs vs a test-only reference CSV library, 0 mismatches), T-F (10,000 seeded malformed inputs, no uncaught exception), T-P (PERF-5: 10,000 rows < 1,000 ms, p95 over 10 runs after 3 warm-ups, from `scripts/`)
- **Evidence:** `docs/evidence/P4-01.md`

### Step P4-02 — XLSX spike and library decision (SAD-37)
- **Files:** `docs/decisions/xlsx.md`, spike code in `spike/xlsx/` (**not shipped**, excluded from the build)
- **Work:** Spike two candidates (read-excel-file + one browser-safe writer, plus one alternative). Read FX-XLSX (5,000 rows). Measure bundle delta and read time (target < 3,000 ms desktop, proposed). Grep the bundle for `require("fs")` and other Node-only imports (T-S, must be 0)
- **Not run here:** T-M-DEV on iOS and Android (NOT RUN, see §2)
- **Known limits to record:** formulas read as cached values only; merged cells and styles not exported
- **Evidence:** `docs/evidence/P4-02.md`

### Step P4-03 — Type inference (SAD-38)
- **Files:** `src/io/infer.ts`, `samples/fixtures/labeled/*` (labeled set), `scripts/infer-accuracy.mjs`, `docs/reports/p4-03-accuracy.md`, `tests/io/infer.test.ts`
- **Rules (documented):** accepted date formats (listed explicitly), number with `.` decimal (G-A5), checkbox from true/false/yes/no/1/0, single select when distinct ≤ 20 and ≤ 50% of rows (thresholds recorded), ambiguous → text (G-P3). Example: `01/02/2026` is ambiguous, so it goes to text
- **Tests:** T-U per rule; per-type precision and recall on the labeled set; inference on FX-XLSX < 500 ms (proposed)
- **Evidence:** `docs/evidence/P4-03.md`

### Step P4-04 — Import command (SAD-39)
- **Files:** `src/commands/import.ts`, `src/io/import/build.ts` (in-memory build → validate → serialize), wiring in `src/main.ts`, tests
- **Behavior:**
  1. Command "Import CSV / Excel as table" (file picker on desktop; mobile file selection)
  2. Build the table in memory, validate (P1-04), serialize (P1-03), then **write once** (atomic)
  3. Name collision → `Tasks 2.tablify`. Never overwrite
  4. Open the new file
- **Tests:** T-I scripted (500-row CSV and XLSX vs source, cell-by-cell comparison, forced serialization error leaves no file, collision test) → **automated proxy** as a vault-free harness with a fake vault adapter; real vault run = NOT RUN. T-P: PERF-6 on FX-M (1,000 rows) < 2,000 ms (proposed)
- **Evidence:** `docs/evidence/P4-04.md`

### Step P4-05 — Export (SAD-40)
- **Files:** `src/io/export/csv.ts`, `src/io/export/xlsx.ts`, `src/io/export/markdown.ts`, `src/io/export/scope.ts` (current view vs full table), `src/commands/export.ts`, wiring in `src/main.ts`, tests
- **Behavior:**
  1. Scope default = current view (filter, visible columns, sort order). "Full table" checkbox
  2. CSV: RFC 4180, same format as P4-01 parser
  3. XLSX: writer chosen in P4-02
  4. Markdown: escape `|` and newlines in cells
- **Tests:** T-D (export CSV → parse with P4-01 parser and reference library; equal to on-screen rows for the filter), T-I automated proxy for XLSX (second reader, values match) + real-second-reader NOT RUN, T-U Markdown escaping, T-P: PERF-7 on FX-M < 2,000 ms (proposed)
- **Evidence:** `docs/evidence/P4-05.md`

## 5. Phase-level gate work

- `docs/gates/phase-4.md` with the gate table (6 conditions from `guidelines.md` §0.6)
- Regression: re-run all P0–P3 tests
- `npm run lint`, `npm test`, `npm run check:guard`, `npm run build` must pass on the release commit
- Assumptions register from `spec/phases/P4.md`, each item accepted or resolved:
  - XLSX formulas imported as cached values only
  - Date inference may misclassify ambiguous dates (for example 01/02/2026). Listed in accuracy report
  - Merged cells and styles not supported in export
- Decision log items to close: D-O2 (decision record), D-O5 (default = current view), G-P3 (date rules), C1–C6 above

## 6. Risks

| Risk | Mitigation |
|------|------------|
| R3: XLSX library breaks mobile or bloats bundle | Spike first (P4-02), measure, choose the smaller working option |
| Node-only import leaks into bundle | T-S grep check in P4-02 and in build |
| Reference-library dependency bloat | Test-only devDependencies, never imported from `src/` |
| Large-file import blocks UI | Chunked parser; measure PERF-5/6 |
| Phase 3 gate not formally recorded | C2: build the missing gate check first |

## 7. Questions still open

1. Confirm C1 (use the guidelines' 30-column labeled set, not the roadmap's 10 columns)
2. Confirm C2 (build the missing Phase 2/3 gate check before P4 UI work)
3. Confirm C5 (I author the labeled set, so the accuracy result is not independent. Is that acceptable for the gate?)
4. Confirm you accept NOT RUN for device and real-vault checks (blocks the gate until the risk is accepted in the decision log)
