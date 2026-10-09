# Phase 0 Gate — Foundation and Format Spec

**Date:** 2026-10-09  
**Result:** ✅ **PASS**  
**Commit:** `5461361`  
**Tester:** Agent (Arena.ai)  

---

## Gate conditions

| # | Condition | Status | Notes |
|---|-----------|--------|-------|
| 1 | P0-01 through P0-04 accepted with evidence | ✅ PASS | See evidence files below |
| 2 | `npm run lint`, `npm test`, `npm run build` pass | ✅ PASS | 0 lint errors, 25/25 tests pass, build produces main.js |
| 3 | Phase regression tests pass | ✅ PASS | All tests from P0-01 through P0-04 still pass |
| 4 | No open S1 or S2 issues | ✅ PASS | No issues recorded |
| 5 | Assumptions and limitations reviewed | ✅ PASS | See below |
| 6 | Gate note recorded | ✅ PASS | This file |

---

## Step evidence

| Step | Linear | Evidence file | Key results |
|------|--------|---------------|-------------|
| P0-01 | SAD-15 | `docs/evidence/P0-01.md` | Plugin scaffold builds (main.js = 2.2 KB), 7 manifest tests pass, minAppVersion=1.14 |
| P0-02 | SAD-16 | `docs/evidence/P0-02.md` | ESLint + Vitest + CI configured. Negative tests verified. UI test approach documented |
| P0-03 | SAD-17 | `docs/evidence/P0-03.md` | FORMAT_SPEC.md, JSON Schema, 7 sample files. 14 schema tests pass. Roadmap §7 checklist complete |
| P0-04 | SAD-18 | `docs/evidence/P0-04.md` | Extension guard: 4 tests pass, grep guard in CI, no .tabula references in src/ |

---

## Test summary

| Test file | Tests | Status |
|-----------|-------|--------|
| tests/manifest.test.ts | 7 | ✅ |
| tests/schema.test.ts | 14 | ✅ |
| tests/guard.test.ts | 4 | ✅ |
| **Total** | **25** | **✅ All pass** |

---

## Assumptions and limitations register

From `spec/phases/P0.md`:

| ID | Assumption / Limitation | Status |
|----|-------------------------|--------|
| — | The spec is a v1 contract. Changes after release require a `formatVersion` bump (R11). | ✅ Accepted. Schema enforces `formatVersion: 1`. |
| — | Obsidian's file-type registration behavior is assumed to match the documentation of the tested version. Verified by T-I. | ⏳ T-I pending owner manual test. Accepted with risk. |

---

## Open risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| T-I (Scenario A9) not yet run on real Obsidian vault | Low — code-level guard verified by tests and CI | Owner to test with .tabula files in vault |
| T-M-DEV (mobile) not yet run on real devices | Low — scaffold is minimal | Owner to test on iOS and Android |
| ESLint warnings in test files (6 warnings) | None — warnings only, no errors | Acceptable for test code |

---

## NOT RUN items

| Item | Step | Reason |
|------|------|--------|
| T-I: Desktop integration | P0-01 | Requires Obsidian desktop test vault |
| T-M-DEV: iOS test | P0-01 | Requires physical iOS device (owner has one) |
| T-M-DEV: Android test | P0-01 | Requires physical Android device (owner has one) |
| T-I: Scenario A9 (.tabula ignored) | P0-04 | Requires Obsidian vault with .tabula files |

All NOT RUN items are manual integration/device tests that require the owner's local environment. Code-level guarantees are verified by automated tests and CI.

---

## Decision: Phase 0 gate PASSES

All automated checks pass. Manual tests are deferred to the owner with clear instructions. Phase 1 may begin once the owner completes T-I and T-M-DEV tests and accepts any findings.

**Next phase:** P1 — Data core (SAD-19 through SAD-24)
