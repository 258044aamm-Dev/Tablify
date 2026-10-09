# Phase 0 Implementation Plan — Foundation and Format Spec

**Linear project:** Tablify — Obsidian Table Plugin  
**Phase:** P0 (Foundation and format spec)  
**Linear issues:** SAD-15, SAD-16, SAD-17, SAD-18  
**Date:** 2026-10-09  
**Mode:** Plan only — no code changes until this plan is approved  

---

## 0. Executive summary

Phase 0 delivers four work items that establish the entire plugin foundation:

| Step | Linear | Objective | Depends on |
|------|--------|-----------|------------|
| P0-01 | SAD-15 | Scaffold the plugin — repo skeleton, manifest, esbuild build | — |
| P0-02 | SAD-16 | Tooling — ESLint, Vitest, npm scripts, CI | P0-01 |
| P0-03 | SAD-17 | Format spec v1 — FORMAT_SPEC.md, JSON Schema, sample files | — (parallel with P0-01) |
| P0-04 | SAD-18 | Extension guard — only `.tablify`, never `.tabula` | P0-01 |

**Execution order:**
1. **P0-01** + **P0-03** can start simultaneously (no dependencies on each other)
2. **P0-02** and **P0-04** start after P0-01 is accepted

---

## 1. P0-01 — Scaffold the plugin (SAD-15)

### 1.1 Prerequisites
- Repository already exists at `https://github.com/258044aamm-Dev/Tablify`
- Node LTS (20.x or later)
- Decisions locked by roadmap: TypeScript + esbuild (from roadmap §3.1)

### 1.2 Files to create

| File | Purpose |
|------|---------|
| `manifest.json` | Obsidian plugin manifest: `id: "tablify"`, `name: "Tablify"`, `isDesktopOnly: false`, `version: "0.0.1"`, `minAppVersion` set per decision below |
| `src/main.ts` | Plugin entry point. Extends `obsidian.Plugin`. Registers one no-op command ("Tablify: Hello") in `onload()`. |
| `package.json` | Dependencies: `obsidian` (dev), `typescript`, `esbuild`, `@types/node` |
| `tsconfig.json` | Target ES2022, module ESNext, strict mode, noEmit (esbuild handles output) |
| `esbuild.config.mjs` | Build config: entry `src/main.ts`, output `main.js`, bundle, external `obsidian`/`electron`, format `cjs`, platform `browser` |
| `versions.json` | Maps plugin version to minimum Obsidian version (start with `{"0.0.1": "1.14"}`) |
| `.gitignore` | Ignore `node_modules/`, coverage output. Note: `main.js` is committed (release artifact) |
| `docs/decisions/min-app-version.md` | Records which Obsidian APIs drove `minAppVersion` and why |
| `docs/evidence/P0-01.md` | Evidence file: commit hash, environment, commands, results |

### 1.3 Decision: minAppVersion (D-O4)

The APIs used in the scaffold are minimal:
- `Plugin` base class — available since very early Obsidian
- `addCommand()` — available since early versions
- No advanced APIs yet

**Decision (owner-confirmed 2026-10-09):** Set `minAppVersion: "1.14"`. The owner has specified this as the minimum. Document the rationale in `docs/decisions/min-app-version.md`, including which APIs drove this choice. The version can be raised later if newer APIs require it.

### 1.4 `manifest.json` structure

```json
{
  "id": "tablify",
  "name": "Tablify",
  "version": "0.0.1",
  "minAppVersion": "1.14",
  "description": "Airtable-like tables in .tablify files. Desktop and mobile.",
  "author": "258044aamm-Dev",
  "isDesktopOnly": false
}
```

### 1.5 `main.ts` structure

```typescript
import { Plugin } from 'obsidian';

export default class TablifyPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'tablify-hello',
      name: 'Hello from Tablify',
      callback: () => {
        console.log('Tablify plugin loaded');
      },
    });
  }
}
```

### 1.6 Verification checklist

| Code | Check | How |
|------|-------|-----|
| T-U | Unit test: parse `manifest.json`, assert `id === "tablify"`, `name === "Tablify"`, `isDesktopOnly === false`, `minAppVersion` present and non-empty | Vitest test file |
| T-I | Install into desktop test vault → enable plugin → command appears → no console errors | Manual integration test (recorded in evidence) |
| T-M-DEV | Enable on iOS and Android → record result | Manual device test on both iOS and Android (recorded in evidence) |
| Build reproducibility | Clone repo twice → `npm ci && npm run build` → compare `main.js` hashes | Recorded in evidence |
| Performance | Record `main.js` size as baseline | Informational only |

### 1.7 Acceptance criteria
- [ ] Plugin loads on desktop with no console errors
- [ ] Plugin loads on both iOS and Android with no console errors (T-M-DEV)
- [ ] `minAppVersion` backed by a written reason in `docs/decisions/min-app-version.md`
- [ ] Build reproducible from a clean clone (identical `main.js` hash)
- [ ] `manifest.json` unit test passes

---

## 2. P0-02 — Tooling: lint, test, build (SAD-16)

### 2.1 Prerequisites
- P0-01 accepted (repo builds, `main.js` generated)

### 2.2 Files to create/modify

| File | Purpose |
|------|---------|
| `package.json` (update) | Add devDependencies: `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `vitest`, `@vitest/coverage-v8`; add npm scripts |
| `.eslintrc.json` or `eslint.config.js` | ESLint config using Obsidian-recommended rules (reference: obsidian sample plugin config) |
| `vitest.config.ts` | Vitest config with coverage provider, output to `coverage/` |
| `package.json` scripts | `lint`, `test`, `test:coverage`, `build`, `check` (runs lint + test + build) |
| `docs/testing/approach.md` | Document UI test approach decision (G-L1) |
| `.github/workflows/ci.yml` | GitHub Actions CI workflow running `npm ci && npm run check` |

### 2.3 npm scripts

```json
{
  "scripts": {
    "build": "node esbuild.config.mjs",
    "lint": "eslint src/ --ext .ts",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "check": "npm run lint && npm run test && npm run build"
  }
}
```

### 2.4 ESLint configuration

Base on the [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin) ESLint config:
- `@typescript-eslint/recommended`
- No `any` in runtime code
- Obsidian-specific globals

### 2.5 UI test approach decision (G-L1)

Per the spec, automated UI testing inside Obsidian may be limited. The approach documented in `docs/testing/approach.md`:

**Decision:** Use a **manual test script with templates** for UI tests (T-E, T-M-DEV). Automated unit tests (Vitest) cover all pure logic. UI behavior is verified via scripted manual test cases recorded in `docs/testing/matrix.md` (expanded in P6-01). This is acceptable per G-L1.

### 2.6 CI workflow

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run check
```

### 2.7 Verification checklist

| Code | Check | How |
|------|-------|-----|
| Clean clone | `git clone` → `npm ci` → `npm run check` passes end-to-end | Automated in CI |
| Negative test | Intentional lint violation on a branch → `npm run check` fails; revert. Failing unit test → `npm run check` fails; revert. | Recorded in evidence |
| Performance | `npm run check` on clean clone completes in under 5 minutes | Recorded in evidence |

### 2.8 Acceptance criteria
- [ ] Clean clone passes `npm run check`
- [ ] Negative test proves check fails when it should (lint violation + failing test)
- [ ] UI test approach documented in `docs/testing/approach.md`
- [ ] Coverage output works via `npm run test:coverage`

---

## 3. P0-03 — Format spec v1 (SAD-17)

### 3.1 Prerequisites
- Roadmap decisions locked: D2 (JSON text, formatVersion 1), R-D8 (values keyed by field ID), R-D9 (row IDs stable), R-D10 (view settings in file)
- **No code dependency on P0-01** — can start in parallel

### 3.2 Files to create

| File | Purpose |
|------|---------|
| `FORMAT_SPEC.md` | Machine-checkable definition of `.tablify` v1 |
| `tablify.schema.json` | JSON Schema (draft 2020-12) for `.tablify` files |
| `samples/v1/empty.tablify` | Minimal valid file (no fields beyond a primary, no rows) |
| `samples/v1/typical.tablify` | Generated from FX-S fixture definition (100 rows, 8 columns, all types) |
| `samples/v1/edge.tablify` | Unicode, escaped quotes, newline in long text, empty values, unknown key, `sync: null` |
| `samples/invalid/wrong-type.tablify` | A field value has the wrong type |
| `samples/invalid/missing-format-version.tablify` | Missing `formatVersion` key |
| `samples/invalid/duplicate-field-id.tablify` | Two fields with the same ID |
| `samples/invalid/unknown-row-field.tablify` | Row references a field ID not in the fields array |
| `docs/evidence/P0-03.md` | Evidence file |

### 3.3 `FORMAT_SPEC.md` outline

Based on roadmap §7 contract and step spec:

1. **Encoding:** UTF-8, LF line endings, 2-space indent, trailing newline
2. **Top-level keys (in order):**
   - `formatVersion` (integer, required, must be `1`)
   - `tableId` (string, required, pattern `tbl_` prefix)
   - `name` (string, required)
   - `fields` (array, required)
   - `rows` (array, required)
   - `views` (array, required)
   - `syncLink` (null in v1, reserved for v1.1)
3. **Field object:**
   - `id` (string, required, pattern `fld_` prefix)
   - `name` (string, required)
   - `type` (string, required, enum of 19 types from P1-01)
   - `primary` (boolean, optional, default false; exactly one field must have it)
   - `options` (array, required only for select types; each option has `id`, `name`, `color`)
   - `required` (boolean, optional)
   - `unique` (boolean, optional)
   - `min`, `max` (number/date, optional)
   - `regex` (string, optional, for text types)
4. **Row object:**
   - `id` (string, required, pattern `row_` prefix)
   - `rev` (integer, required, starts at 1)
   - `createdAt` (ISO 8601 string, optional)
   - `updatedAt` (ISO 8601 string, required)
   - `values` (object, required, keys are field IDs)
   - `sync` (null in v1, reserved)
5. **View object:**
   - `id` (string, required)
   - `name` (string, required)
   - `sort` (array of `{fieldId, direction}`, required)
   - `groupBy` (string or null, optional)
   - `hidden` (array of field IDs, required)
   - `frozenColumns` (integer, required)
   - `rowHeight` (string enum: "small" | "medium" | "large", required)
   - `columnWidths` (object mapping fieldId → number, required)
6. **Rules:**
   - Values keyed by field ID (R-D8)
   - `sync` and `syncLink` are reserved keys — `null` in v1
   - Unknown keys are preserved on save (round-trip safe)
   - `.tabula` is never read, written, imported, detected, or migrated
   - `formatVersion` check: unknown versions show error and don't write
   - File must never contain Airtable token

### 3.4 JSON Schema (`tablify.schema.json`)

- Draft 2020-12
- Enforces required keys, types, patterns for IDs
- Enum for field types
- `additionalProperties: true` at top level and in rows (to preserve unknown keys)
- Validates `sync: null` and `syncLink: null`

### 3.5 Sample files

**`samples/v1/empty.tablify`:**
```json
{
  "formatVersion": 1,
  "tableId": "tbl_01J8Z3K9Q4",
  "name": "Empty",
  "fields": [
    { "id": "fld_name", "name": "Name", "type": "text", "primary": true }
  ],
  "rows": [],
  "views": [
    {
      "id": "view_default",
      "name": "Default",
      "sort": [],
      "groupBy": null,
      "hidden": [],
      "frozenColumns": 1,
      "rowHeight": "medium",
      "columnWidths": {}
    }
  ],
  "syncLink": null
}
```

**`samples/v1/typical.tablify`:** Generated from a script implementing the FX-S fixture definition (100 rows, 8 columns covering all types: text, number, checkbox, date, single_select, multi_select, url, email).

**`samples/v1/edge.tablify`:** Contains:
- Unicode characters in text values (e.g., emojis, CJK)
- Escaped quotes in strings
- Newlines embedded in long text values
- Empty string values
- An unknown key at top level (to test round-trip preservation)
- `sync: null` on rows
- `syncLink: null`

**Invalid samples:**
- `wrong-type.tablify`: a `rev` value is a string instead of integer
- `missing-format-version.tablify`: missing `formatVersion`
- `duplicate-field-id.tablify`: two fields share `"fld_status"`
- `unknown-row-field.tablify`: row has `values.fld_nonexistent`

### 3.6 Verification

| Code | Check | How |
|------|-------|-----|
| T-U | Schema validator (Ajv) accepts every file in `samples/v1/` | Vitest test using Ajv with JSON Schema draft 2020-12 |
| T-U | Schema validator rejects every file in `samples/invalid/` with expected error | Vitest test |
| Checklist | Every field in roadmap §7 appears in FORMAT_SPEC.md | Count and record in evidence |
| Review | Second reviewer checks spec against roadmap §7 contract | Sign-off recorded with commit hash |

### 3.7 Acceptance criteria
- [ ] All valid samples pass schema validation
- [ ] All invalid samples fail with expected error messages
- [ ] FORMAT_SPEC.md covers every field in roadmap §7 contract
- [ ] Spec explicitly states `.tabula` is not read
- [ ] `sync` and `syncLink` reserved keys documented
- [ ] Reviewer sign-off recorded

---

## 4. P0-04 — Extension guard (SAD-18)

### 4.1 Prerequisites
- P0-01 accepted (plugin scaffold exists)

### 4.2 Files to create/modify

| File | Purpose |
|------|---------|
| `src/main.ts` (update) | Register only `.tablify` extension; no `.tabula` references anywhere in `src/` |
| `scripts/check-tabula-guard.sh` | Repository check: `grep -ri tabula src/` returns zero matches |
| `package.json` (update) | Add script `check:guard` that runs the grep check |
| `tests/guard.test.ts` | Unit test: registered extension list equals `["tablify"]` |

### 4.3 Actions

1. **In `main.ts`:** The plugin should not register any file types for `.tabula`. When file-type registration is added later (P5-01), only `.tablify` should be listed.
2. **Grep guard:** A shell script `scripts/check-tabula-guard.sh` that runs `grep -ri 'tabula' src/` and exits with error code if any match is found. Documentation files may mention `.tabula`.
3. **Integration with build:** Add `check:guard` to the `check` script so it runs in CI.

### 4.4 `scripts/check-tabula-guard.sh`

```bash
#!/usr/bin/env bash
# Fails if 'tabula' appears anywhere in src/ (case-insensitive).
# Documentation may mention .tabula; this only checks source code.
if grep -ri 'tabula' src/; then
  echo "FAIL: src/ contains references to 'tabula'. Tablify never handles .tabula files."
  exit 1
fi
echo "PASS: No .tabula references in src/"
```

### 4.5 Verification

| Code | Check | How |
|------|-------|-----|
| T-U | Registered extension list equals `["tablify"]` | Unit test that inspects the plugin's registration |
| T-S | `grep -ri tabula src/` returns zero matches | Shell script in CI |
| T-I | Vault with `.tabula` files → plugin does not open, import, or migrate them | Scenario A9 (manual test, recorded) |

### 4.6 Acceptance criteria
- [ ] Extension registration is only for `.tablify`
- [ ] `grep -ri tabula src/` returns zero matches
- [ ] CI runs the guard check
- [ ] Scenario A9 test result recorded in evidence

---

## 5. Phase 0 Gate

Per `spec/phases/P0.md` and `spec/guidelines.md` §0.6:

| # | Condition | Status |
|---|-----------|--------|
| 1 | P0-01 through P0-04 accepted with evidence | Pending |
| 2 | `npm run lint`, `npm test`, `npm run build` all pass | Pending |
| 3 | All phase regression tests pass | Pending |
| 4 | No open S1/S2 issues | Pending |
| 5 | Assumptions and limitations reviewed and accepted | Pending |
| 6 | Gate note written to `docs/gates/phase-0.md` | Pending |

**Gate note file** `docs/gates/phase-0.md` will record:
- Result (pass/fail)
- Commit hash
- Environment details
- Open risks
- NOT RUN items with reasons

---

## 6. Execution order and parallelism

```
Time ─────────────────────────────────────────────────►

Step 1:  P0-01 (SAD-15)  ═══════════════════════►
         P0-03 (SAD-17)  ═══════════════════════►    ← parallel with P0-01

Step 2:  P0-02 (SAD-16)       ════════════════►      ← after P0-01
         P0-04 (SAD-18)       ════════════════►      ← after P0-01

Step 3:  Phase 0 gate review and evidence compilation
```

### Detailed task breakdown

#### Step 1a: P0-01 (Scaffold)
1. Create `package.json` with dependencies
2. Create `tsconfig.json`
3. Create `esbuild.config.mjs`
4. Create `manifest.json`
5. Create `src/main.ts` with no-op command
6. Create `versions.json`
7. Create `.gitignore`
8. Run `npm install`, `npm run build`, verify `main.js` output
9. Write `docs/decisions/min-app-version.md`
10. Write manifest unit test
11. Write `docs/evidence/P0-01.md`

#### Step 1b: P0-03 (Format spec) — in parallel
1. Write `FORMAT_SPEC.md` covering all keys, types, rules
2. Write `tablify.schema.json` (JSON Schema draft 2020-12)
3. Create `samples/v1/empty.tablify`
4. Create fixture generator script and produce `samples/v1/typical.tablify`
5. Create `samples/v1/edge.tablify`
6. Create `samples/invalid/` files
7. Write schema validation tests using Ajv
8. Verify all valid samples pass, all invalid samples fail
9. Write `docs/evidence/P0-03.md`

#### Step 2a: P0-02 (Tooling) — after P0-01
1. Add ESLint devDependencies and config
2. Add Vitest devDependencies and config
3. Add npm scripts (`lint`, `test`, `test:coverage`, `build`, `check`)
4. Write `docs/testing/approach.md`
5. Create `.github/workflows/ci.yml`
6. Run negative test (add violation → verify failure → revert)
7. Verify clean clone passes `npm run check`
8. Write `docs/evidence/P0-02.md`

#### Step 2b: P0-04 (Extension guard) — after P0-01
1. Confirm `src/main.ts` has no `.tabula` references
2. Create `scripts/check-tabula-guard.sh`
3. Add `check:guard` to npm scripts and `check` pipeline
4. Write guard unit test
5. Run `grep -ri tabula src/` — confirm zero matches
6. Write `docs/evidence/P0-04.md`

#### Step 3: Gate
1. Compile all evidence files
2. Verify all acceptance criteria pass
3. Run full `npm run check`
4. Write `docs/gates/phase-0.md`
5. Update Linear issues to "Done" with evidence links

---

## 7. Open questions / risks

| ID | Question | Resolution (2026-10-09) |
|----|----------|-------------------------|
| Q1 | minAppVersion target | **Resolved:** `1.14` (owner-specified) |
| Q2 | iOS/Android test devices available? | **Resolved:** Yes, both available — full T-M-DEV on iOS and Android |
| Q3 | Who reviews FORMAT_SPEC.md? | **Resolved:** Agent cross-checks spec against roadmap §7 and records review sign-off |
| Q4 | Should `main.js` be committed? | **Resolved:** Yes, commit `main.js` to the repo |

---

## 8. Evidence files

Per guidelines §0.1, each step gets a `docs/evidence/<step-ID>.md` file containing:
- Commit hash
- Date
- Tester name
- Environment (OS, Obsidian version, device if mobile)
- Exact commands run
- Test counts (passed/failed/skipped)
- Links to logs or screenshots
- Any deviations or NOT RUN items

Files to create:
- `docs/evidence/P0-01.md`
- `docs/evidence/P0-02.md`
- `docs/evidence/P0-03.md`
- `docs/evidence/P0-04.md`

---

## 9. Summary of all files to create

```
manifest.json
package.json (update)
tsconfig.json
esbuild.config.mjs
versions.json
.gitignore (update)
src/main.ts

.eslintrc.json (or eslint.config.js)
vitest.config.ts
.github/workflows/ci.yml

FORMAT_SPEC.md
tablify.schema.json
samples/v1/empty.tablify
samples/v1/typical.tablify
samples/v1/edge.tablify
samples/invalid/wrong-type.tablify
samples/invalid/missing-format-version.tablify
samples/invalid/duplicate-field-id.tablify
samples/invalid/unknown-row-field.tablify
samples/generate-fixtures.mjs   (fixture generator script)

scripts/check-tabula-guard.sh

docs/decisions/min-app-version.md
docs/testing/approach.md
docs/evidence/P0-01.md
docs/evidence/P0-02.md
docs/evidence/P0-03.md
docs/evidence/P0-04.md
docs/gates/phase-0.md
```

---

## 10. Next steps

1. **You review this plan** — confirm scope, ask questions, approve or request changes
2. Once approved, execute in order: P0-01 + P0-03 → P0-02 + P0-04 → gate
3. After each step, record evidence and update Linear status
4. At phase gate, compile `docs/gates/phase-0.md` and move to Phase 1
