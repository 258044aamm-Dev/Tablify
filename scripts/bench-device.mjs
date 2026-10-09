#!/usr/bin/env node
// P6-02 — Owner runbook for OFFICIAL performance measurement (guidelines §0.4).
// The sandbox numbers (scripts/bench-perf.mjs) are approximations. This script
// prints the step-by-step in-Obsidian measurement checklist for the desktop
// reference machine and a mid-range phone, with the exact fixtures, run counts,
// and the table to fill in docs/performance/report-<date>.md.

const OBS_MIN = '1.14';

console.log(`
Tablify — official performance measurement runbook (P6-02, PERF-1…PERF-8)
=========================================================================

BEFORE YOU START (protocol §0.4)
  1. Record hardware: CPU model, RAM, OS version, Obsidian version (≥ ${OBS_MIN}), device model (mobile).
  2. Close other heavy applications. Use a FRESH vault containing only the fixture under test.
  3. Every measurement: 3 warm-up runs (not counted), then 10 measured runs.
  4. Report median and p95; keep raw numbers (docs/performance/raw/).
  5. A target is met only if the p95 is within the limit. Never change a target to pass.
  6. If a target fails: open an issue (docs/issues/ISS-###.md) or list it as a known
     limitation in the release notes — with the measured numbers.

FIXTURES
  FX-M (1,000 rows × 12 fields): create by importing samples/fixtures/import-a2.csv
  twice, or generate via a scratch table — the reference is a 1,000×12 table.
  FX-L (10,000 rows): duplicate rows in the CSV ten times, or ask the agent to emit
  a generator output; PERF-5 uses the 10,000-row CSV directly (samples/fixtures/CSV-10k
  can be produced by running: node scripts/gen-fixtures.mjs && node -e
  "console.log(require('fs').readFileSync('samples/fixtures/import-a2.csv','utf8').repeat(20))"
  — 500 rows × 20 = 10,000 rows).

DESKTOP (reference machine) — in-Obsidian timings
  Stopwatch method (no source instrumentation needed):
  - PERF-1  Open FX-M table (cold view): click the .tablify file, stop when the first
            rows are painted. 3 warm-ups + 10 runs. Target: p95 < 1,000 ms.
  - PERF-2  With FX-M open, type a filter (e.g. status:Done count:>10) in the filter
            bar; stop when the row count updates. Target: p95 < 200 ms.
  - PERF-3  Edit one cell and press Escape-to-commit; measure autosave settle
            (write indicator / file mtime change). Target: p95 < 300 ms.
  - PERF-4  Scroll the FX-M table end-to-end and back; record jank (dropped/stuttering
            frames) qualitatively AND, if available, a frame-time overlay. Target: p95 ≤ 33 ms.
  - PERF-5  Import the 10,000-row CSV via the import command; measure pick→grid shown.
            (Import includes parse; parse-only reference: sandbox numbers in
            docs/performance/raw/.) Target: parse 10k < 1,000 ms desktop.
  - PERF-6  Import the 1,000-row CSV (samples/fixtures/import-a2.csv is 500 rows ×2).
            Target: < 2,000 ms.
  - PERF-7  Export FX-M to CSV, XLSX, Markdown (Full table checkbox on). Target: < 2,000 ms each.
  - PERF-8  Scroll + edit FX-M for 10 continuous minutes, then check vault memory in
            Task Manager / Activity Monitor (or Obsidian process memory). Target: growth < 10 %.

MOBILE (mid-range phone, per platform: iOS + Android)
  - PERF-1m Open the FX-M table from the file list. Target: p95 < 2,000 ms.
  - PERF-4m Scroll FX-M end-to-end; record visible stutter (screen recording at 60 fps
            is acceptable evidence). Target: p95 frame ≤ 33 ms (qualitative pass/fail
            if no frame overlay is available — record the method used).

AFTER MEASURING
  - Fill the results table in docs/performance/report-<date>.md (target / measured
    median / measured p95 / pass-fail / hardware / Obsidian version).
  - Put the raw stop-watch numbers in docs/performance/raw/device-<date>.md.
  - Re-run the suite once more on a different day (second-person tolerance check,
    proposed: within 10 % of the first run; otherwise investigate before publishing).
`);

console.log('This runbook is printed, not executed — measurement happens in a real Obsidian vault.');
