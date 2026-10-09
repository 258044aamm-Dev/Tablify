# Decision D-O2 — XLSX read/write library

**Step:** P4-02 (Linear SAD-37)
**Date:** 2026-10-09
**Status:** DECIDED (desktop spike complete; device checks NOT RUN — see §6)
**Decider:** Agent (Arena.ai), per owner default "spike two options, choose the smaller working one" (`spec/roadmap.md` §3.3)

---

## 1. Decision

**Use candidate A: `read-excel-file` (browser build) 8.0.3 for reading and `write-excel-file` (browser build) 1.4.30 for writing.**

Both are MIT-licensed, browser-safe, and produce no Node-only imports in the bundle. Candidate A is the smaller working option: about 47 KB gzip versus about 143 KB gzip for candidate B.

## 2. Candidates

| ID | Library | Role | License |
|----|---------|------|---------|
| A | `read-excel-file@8.0.3` (`/browser`) + `write-excel-file@1.4.30` (browser entry) | read + write | MIT + MIT |
| B | `xlsx@0.18.5` (SheetJS, `xlsx.mjs`) | read + write | Apache-2.0 |

Candidate B is the "one library for both directions" alternative. It was included as the comparison baseline.

## 3. Measurements (spike, `spike/xlsx/results.json`)

Environment: Node v20.20.2, Linux x64, Intel Xeon @ 2.60 GHz, 2 vCPU. Bundles built with esbuild 0.20 (`platform: browser`, `minify`, `format: esm`). Stub baseline = empty module.

| Measure | A (read-excel-file + write-excel-file) | B (SheetJS) | Notes |
|---------|----------------------------------------|-------------|-------|
| Bundle, minified | 155,721 B (delta 155,693 B) | 429,174 B (delta 429,146 B) | Stub = 28 B |
| Bundle, gzip | 47,030 B (delta 46,982 B) | 142,543 B (delta 142,495 B) | Bundle-size criterion from P4-02 |
| Node-only imports in bundle | 0 matches | 0 matches | Patterns: `require/import` of fs, path, stream, zlib, crypto, child_process, `node:*` |
| FX-XLSX read: row count | 5,001 of 5,001 | 5,001 of 5,001 | Includes header |
| FX-XLSX read: cell mismatches vs generator (UTC) | **0 of 50,000** | **0 of 50,000** | Compared cell by cell |
| FX-XLSX read: cell mismatches vs generator (`TZ=Asia/Dhaka`) | **0** | **5,000** (every date one day early) | See finding F2 |
| FX-XLSX read: cell mismatches vs generator (`TZ=America/Los_Angeles`) | **0** | **0** | |
| FX-XLSX read time, median / p95 (10 runs, 3 warm-up) | 2,062 ms / 2,184 ms* | 207 ms / 329 ms | Target < 3,000 ms desktop (proposed) |
| Write round-trip: A writes, B reads (501 rows) | — | 501 rows, header + values match | Second-reader check |
| Write round-trip: B writes, A reads (501 rows) | 501 rows | — | Second-reader check |
| Written file size, 500 × 5 table | 97,940 B | 106,032 B | |

\* Candidate A's time is measured with **jsdom's `DOMParser`** because Node has none. The browser build uses `DOMParser` by design. Real-browser timing is not measured, so A's figure is an upper bound for the spike only. Candidate A is under the 3,000 ms proposed target even with this overhead.

## 4. Findings (fidelity and traps)

| # | Finding | Impact | Mitigation in P4-03 / P4-04 / P4-05 |
|---|---------|--------|--------------------------------------|
| F1 | read-excel-file v8 **trims cell text by default** (`"trailing space "` → `"trailing space"`). | Silent data change on import | Pass `{ trim: false }` on every read. Covered by the fidelity test. Without it: 1,708 mismatches |
| F2 | SheetJS with `cellDates: true` returns **local-midnight** Dates. Converting with `toISOString()` shifts dates back a day in UTC+ zones. | Real risk for the owner's timezone (Asia/Dhaka, UTC+6). 5,000 date mismatches | Do not use `cellDates` in candidate B. Not an issue for A, which returns UTC-midnight dates. The importer must use UTC date components. Covered by TZ tests in P4-03 |
| F3 | write-excel-file v1 **silently writes an empty sheet** when cells are plain values (no error). | Silent data loss on export | Export code must wrap every cell as `{ value }`. P4-05 test: export a table, read it back, compare every cell. The writer must not be trusted without that test |
| F4 | read-excel-file v8 has **no public sheet-name API**. Its `sheet` option did not filter in the browser build; it always returns every sheet as `[{ sheet, data }]`. | Import UI cannot list sheets without parsing the whole file | Read the whole file once and select sheets from the result. Document the memory cost; P4-04 may add a sheet picker later |
| F5 | Formulas: read-excel-file returns **cached values** (matches the phase assumption "formulas imported as cached values only"). | None beyond the known limit | Recorded as an accepted limitation |
| F6 | read-excel-file (browser build) requires a **DOM parser** (`DOMParser`). Obsidian runs in a browser-like WebView, so it is present on desktop and mobile. | Unit tests need a DOM shim | Tests use jsdom's `DOMParser`. Mobile presence of `DOMParser` is part of the NOT RUN device check |
| F7 | Merged cells: fixture merges (`Summary!A1:D1`) do not break reads. Merged-cell **export** is out of scope (phase assumption). | None | Recorded as an accepted limitation |

## 5. Accepted limitations (from `spec/phases/P4.md`)

- Formulas are read as cached values only.
- Merged cells and cell styles are not exported.
- Date inference may misclassify ambiguous dates (for example `01/02/2026`). Handled in P4-03.

## 6. Checks not run here (NOT RUN, per `guidelines.md` §0.1)

- **T-M-DEV:** plugin loads and reads a file on iOS and Android in a test build. NOT RUN (no device in sandbox). Owner to run before the P4 gate.
- **Native-browser timing:** the read timing above uses jsdom's `DOMParser`. Re-measure in Obsidian desktop (Electron) and on a mobile device.
- **Bundle delta in the real plugin build** (`main.js`) once the library is imported: measure after P4-04 wiring.

## 7. Reproduce

```bash
npm ci                                  # root (includes xlsx as a test-only devDependency)
node scripts/gen-fixtures.mjs --check   # FX-XLSX hash must match samples/fixtures/HASHES.json
cd spike/xlsx && npm install && node run-spike.mjs   # writes spike/xlsx/results.json
TZ=Asia/Dhaka node run-spike.mjs        # the timezone check in finding F2
```

## 8. Versions

| Package | Version | Used in |
|---------|---------|---------|
| read-excel-file | 8.0.3 | spike (A) → P4-03/P4-04 once accepted |
| write-excel-file | 1.4.30 | spike (A) → P4-05 |
| xlsx (SheetJS) | 0.18.5 | spike (B); **test-only** fixture writer in `scripts/gen-fixtures.mjs` |
| jsdom | 29.x (root) | spike and tests only (`DOMParser` shim) |
