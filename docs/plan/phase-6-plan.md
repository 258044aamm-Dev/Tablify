# Phase 6 Plan — Hardening and release

**Date:** 2026-10-09
**Scope:** P6-01 → P6-06 (SAD-44 → SAD-49). Canonical specs: `spec/phases/P6.md`, `spec/steps/P6-0*.md`, global rules `spec/guidelines.md` §0.
**Constraint (owner directive):** new changes must not influence existing features or functionality. P6 is therefore additive: new docs, tests, scripts, and release artifacts only. The single planned source edit (removing the P0-01 sample command, P6-04) is called out explicitly below.

---

## Decisions recorded for this phase

| ID | Decision | Source |
|----|----------|--------|
| D-O3 | License: **MIT** (added `LICENSE`, matches `package.json`) | Owner answer 2026-10-09; default per `spec/roadmap.md` §3.3 |
| G-P1 | PERF-1…PERF-8 **confirmed** as official 1.0.0 targets | Owner answer 2026-10-09 |
| P4-03 | Strict inference retained at measured **73.3%**; noted as a known limitation in CHANGELOG and release notes | Owner answer 2026-10-09 (P4 gate item 1) |
| P4-05 | Bundle guard **1,750,000 B** dev-build limit accepted (prod build 229,203 B) | Owner answer 2026-10-09 (P5 gate item 4) |
| P5-01 | New-table default **"Untitled table" + one primary text field "Name"** accepted | Owner answer 2026-10-09 (P5 gate item 3) |
| T-DEV split | Sandbox runs all automatable checks; real-Obsidian (Win/macOS/Linux) and phone (iOS/Android) cells are NOT RUN with reasons; owner runs the scripted device checklists and records results (P2–P5 pattern) | Owner answer 2026-10-09 |
| REL | Full public GitHub release at P6-06: tag `v1.0.0` + release with `main.js`, `manifest.json`, `styles.css`, SHA-256 hashes, rollback plan | Owner answer 2026-10-09 |

## Step order and dependencies

Per `spec/phases/P6.md` and the project parallel-implementation guide:

1. **P6-01** test matrix (SAD-44) — all MVP steps accepted (P0–P5 accepted, gates conditional).
2. **P6-03** accessibility (SAD-46), **P6-04** review checklist (SAD-47), **P6-05** documentation (SAD-48) — parallel candidates after MVP acceptance.
3. **P6-02** performance verification (SAD-45) — depends on P6-01 (device runbook + fixture protocol).
4. **P6-06** release (SAD-49) — last; depends on P6-01…P6-05 accepted + D-O3.

Each step ends with: evidence in `docs/evidence/P6-XX.md`, commit pushed to `main` (per project rule: commit and push after each step), Linear issue updated.

---

## P6-01 — Test matrix (SAD-44)

- Output: `docs/testing/matrix.md`
  - Grid: scenarios **A1–A11** (`spec/roadmap.md` §10) × platforms **Windows, macOS, Linux, iOS, Android** (55 cells).
  - Each cell: `PASS` / `FAIL` (linked issue) / `NOT RUN` (reason) per the step's verification rule.
  - Sandbox reality: no Obsidian GUI or phones available → every full-scenario cell is **NOT RUN (reason)** with a scripted case ID; underlying logic coverage (which unit/model tests cover which scenario) recorded as footnotes — automated evidence lives in `docs/evidence/P6-01.md`.
  - Scripted cases `T-M-DEV-P6-<scenario>`: exact steps, expected result, evidence type (screenshot / file diff / log), Obsidian version to record per platform.
  - Fixture preparation protocol: `node scripts/gen-fixtures.mjs` (+ `--check`), 500-row CSV/XLSX for A2/A3, `.tabula` decoy file for A9, broken-JSON `.tablify` for A10, view-settings file for A11 — all with recorded SHA-256.
- Regression evidence: `npm run check` (lint + 558-test suite + tabula guard + build) on the phase-6 start commit.
- Any failure during the automated pass → `docs/issues/ISS-###.md` per §0.5.
- Acceptance path: NOT RUN cells accepted by the owner with reasons in the decision log (as in P2–P5 gates).

## P6-03 — Accessibility (SAD-46)

- Output: `docs/accessibility/audit.md`
  - Keyboard-only run-through of **every MVP action** (create/open table, import, export, cell edit, copy/paste, select option, checkbox, row insert/duplicate/delete, field type change, hide/sort/freeze/resize, filter bar, undo/redo, file menu, table menu, long-press) with exact key sequences; cross-checked against `tests/views/grid/keyboard.test.ts` and menu model tests.
  - New additive test `tests/ui/keyboardCoverage.test.ts`: asserts the action→key map is complete for the MVP action list (guards against future regressions; no source change).
  - New additive test `tests/ui/axeGrid.test.ts`: **axe-core** run under jsdom on the grid + select dropdown + validation DOM; failures = issues. (axe-core is a devDependency only — zero runtime impact.)
  - Focus visibility: measured with the existing `scripts/check-contrast.mjs` (focus ring vs background).
  - Screen reader (NVDA on Windows, VoiceOver on macOS): scripted checklist in `docs/accessibility/audit.md` (announcements for cell name, column name, row number, invalid state) → owner runs; NOT RUN in sandbox.
- Findings triaged by severity (§0.5); open findings must be S3 or lower with owner approval.

## P6-04 — Community plugin review checklist (SAD-47)

- Output: `docs/review-checklist.md`
  - Copies the current Obsidian developer guidance (checked **2026-10-09**) with links:
    - Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
    - Developer policies: https://docs.obsidian.md/community-directory/developer-policies
    - Submission requirements for plugins: https://docs.obsidian.md/community-directory/submission-requirements-for-plugins
    - Submit your plugin: https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin
  - Item-by-item audit against this codebase, each item → code/test link or N/A reason. Includes the reference-review items from the step spec: `setHeading` settings API, `requestUrl` for network (N/A in 1.0 — no network calls), `activeDocument` for DOM windows, no leaf detach in `onunload`, no unsafe HTML insertion, no bundled Node-only code.
  - Known findings to fix in this step (documented, with regression evidence):
    1. **Sample code removal:** `tablify-hello` "Hello from Tablify" command in `src/main.ts` (P0-01 scaffold) — Obsidian requires sample code removed before submission. Removed in P6-04; no feature depends on it (console.log only; no test references it).
  - Lint run recorded (`npm run lint`; target: 0 errors).
- Verification: second person (owner) reviews the checklist; each item links to code or a test.

## P6-05 — Documentation (SAD-48)

- Outputs: `README.md`, `docs/user-guide.md`, `CHANGELOG.md`
  - README: what Tablify is, install (Community directory + BRAT/manual), requirements (Obsidian ≥ 1.14, platforms), supported file type `.tablify` only, **explicit statement that `.tabula` is not supported** (required by the spec's grep check).
  - User guide: one section per MVP feature (format, typed fields, grid, filter/search, view settings, undo/redo, keyboard, validation, import, export, file menu, table menu, long-press) + the shortcut table from `docs/shortcuts.md` (P3-06).
  - CHANGELOG 1.0.0: feature list, known limitations (73.3% strict inference threshold; device-check status; jsdom perf numbers labelled informational).
  - New additive `scripts/check-docs-links.mjs`: validates all relative links in `README.md`, `CHANGELOG.md`, `docs/**/*.md` resolve to existing files (no network calls → deterministic in CI). Wired into `npm run check`.
  - Grep guard: README must not describe `.tabula` as supported (checked in the P6-05 evidence; the existing `check-tabula-guard.sh` continues to scan `src/` only — semantics unchanged).
- Owner verification (recorded in evidence after execution): install from README on a clean vault, run A1 + A2, record time (proposed target < 10 min) and every question; each question → doc fix.

## P6-02 — Performance verification (SAD-45)

- Protocol: `spec/guidelines.md` §0.4 exactly — hardware recorded, fresh vault containing only the fixture, 3 warm-up + 10 measured runs, median + p95, raw numbers in evidence.
- Outputs: `docs/performance/report-2026-10-09.md` + `docs/performance/raw/`.
- New additive scripts (Node, no source changes):
  - `scripts/bench-perf.mjs` — PERF-1 (open FX-M: read → JSON parse → schema validate → store/view build → first grid paint in jsdom, labelled sandbox approximation), PERF-2 (filter/search update on FX-M via the query engine), PERF-3 (serialize + atomic-style write of FX-M), PERF-5 (parse 10,000-row CSV), PERF-6 (import FX-M CSV), PERF-7 (export FX-M to CSV/XLSX/Markdown). Each: 3 warm-up + 10 runs, median/p95 + raw output to `docs/performance/raw/`.
  - PERF-4 and PERF-8: existing `scripts/bench-grid-scroll.mjs` (jsdom frame time + heap, labelled ~10× slower than a real browser → informational). PERF-8 full 10-minute soak is run in the sandbox in the background (labelled reduced environment) and the same script is provided for a real desktop run.
  - `scripts/bench-device.mjs` — owner-facing runbook generator / instruction sheet for in-Obsidian measurement on desktop and phone (PERF-1/4/8 + mobile variants) since in-app instrumentation would require source changes (excluded by the owner constraint).
- Results table: target / measured median / p95 / pass-fail / hardware / Obsidian version. Mobile + in-Obsidian desktop cells: NOT RUN (sandbox) with owner runbook; jsdom/Node cells labelled as approximations.
- Rules: failing target → issue, or listed as known limitation in release notes. Targets are never changed to pass. Re-run tolerance 10% (proposed) verified by re-running the suite.

## P6-06 — Release (SAD-49)

- `LICENSE` (MIT) + `docs/decisions/license.md`.
- Version bump to **1.0.0** in `manifest.json`, `package.json`, `versions.json` (release metadata only; no behavior change).
- Phase gate note `docs/gates/phase-6.md` per §0.6: all conditions, assumption register (device results apply to recorded hardware only; screen reader support tested on two desktop readers when owner completes the checklist; target platforms only), open risks, NOT RUN acceptances.
- Clean build: fresh clone of the tag → `npm ci` → `node esbuild.config.mjs production` → `npm run check`.
- Tag **`v1.0.0`** → GitHub release with `main.js` (production build), `manifest.json`, `styles.css`; **SHA-256** of the three files in the release notes; rollback plan (no prior release → uninstall / BRAT revert to source install; known-issues list from CHANGELOG).
- Verification: rebuild from tag, hashes must match release assets (differences explained or absent); owner: clean-vault install on desktop + mobile, run A1 + A9.
- Attestation: no build-attestation workflow is configured for this repo → item recorded as not applicable with reason.

## Linear workflow (mirrors P0–P5)

- Each step: issue → **In Progress** on start, evidence comment with commit hash + evidence link, → **In Review** when sandbox work is complete and owner-facing checklist items remain (mirrors P5-03), → **Done** after owner confirms the remaining cells.
- Phase 6 gate note records the conditional status exactly as P4/P5 did.

## Risk register (phase 6)

| Risk | Mitigation |
|------|-----------|
| Device/desktop NOT RUN cells keep the gate conditional (P2–P5 pattern) | Scripted checklists, evidence templates, owner sign-off in decision log |
| jsdom performance numbers are not representative of Obsidian | Labelled "informational / sandbox approximation" everywhere; official numbers come from owner runs |
| axe-core/jsdom a11y results differ from real browsers | Findings triaged by severity; screen-reader checklist covers the rest |
| Public release is immediate and visible | Tag + release only after gate note and all hashes verified; rollback plan included |
