# Testing Approach

**Date:** 2026-10-09  
**Decision for:** G-L1 (Automated UI testing limitation)  
**Step:** P0-02 (SAD-16)  

---

## Summary

Given the limitations of automated UI testing inside Obsidian (G-L1), the Tablify project uses a **hybrid testing strategy** combining automated unit/integration tests with manual scripted tests on real devices.

---

## Test layers

### Layer 1: Automated unit tests (Vitest)

- **Tool:** Vitest with v8 coverage
- **Location:** `tests/**/*.test.ts`
- **Scope:** All pure logic modules (`src/model/`, `src/query/`, `src/format/`)
- **Coverage target:** Meaningful coverage of all public functions
- **Command:** `npm test` (run once), `npm run test:coverage` (with coverage report)
- **CI:** Runs automatically on every push/PR via GitHub Actions

### Layer 2: Automated integration checks

- **Schema validation tests** — validate all sample files against the JSON Schema
- **Manifest tests** — verify plugin manifest correctness
- **Extension guard** — grep-based check that `src/` contains no `.tabula` references
- **Command:** Part of `npm run check`
- **CI:** Runs automatically

### Layer 3: Manual scripted tests (T-M-DEV)

- **Tool:** Scripted test cases run on real devices
- **Location:** `docs/testing/matrix.md` (expanded in P6-01)
- **Scope:** UI behavior, mobile compatibility, Obsidian integration
- **Devices:** iOS and Android physical devices
- **Format:** Each test case has a numbered ID (e.g., T-M-DEV-001), step-by-step instructions, and expected results
- **Execution:** Tester follows the script, records pass/fail with screenshots

### Layer 4: Manual integration tests (T-I)

- **Tool:** Desktop Obsidian test vault
- **Scope:** Plugin loading, command registration, file handling within a real vault
- **Format:** Scripted steps with expected outcomes
- **Execution:** Performed by the tester in a controlled vault environment

---

## What is NOT automated (and why)

| Test type | Why manual |
|-----------|-----------|
| T-E (End-to-end UI) | Obsidian does not expose a testable UI automation interface. See G-L1. |
| T-M-DEV (Mobile) | No reliable mobile emulator for Obsidian; real devices required (G-A2) |
| T-I (Integration) | Requires a running Obsidian instance with plugin loaded |

---

## Deterministic fixtures

All generated test fixtures use a fixed seed (see `spec/guidelines.md` §0.3):

| Fixture | Size | Use |
|---------|------|-----|
| FX-S | 100 rows, 8 columns | Unit and integration tests |
| FX-M | 1,000 rows, 12 columns | Target scale, performance |
| FX-L | 10,000 rows, 12 columns | Stress testing only |

---

## Evidence standard

Per `spec/guidelines.md` §0.1, every test run is recorded in `docs/evidence/<step>.md` with:
- Commit hash
- Date and environment
- Exact commands run
- Pass/fail/skip counts
- Screenshots for manual tests
- NOT RUN items with reasons
