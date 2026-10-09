# Phase 1 Implementation Plan — Data Core

**Linear project:** Tablify — Obsidian Table Plugin  
**Phase:** P1 (Data core)  
**Linear issues:** SAD-19, SAD-20, SAD-21, SAD-22, SAD-23, SAD-24  
**Date:** 2026-10-09  
**Mode:** Plan only — no code changes until this plan is approved  
**Prerequisite:** Phase 0 gate passed ✅  

---

## 0. Executive summary

Phase 1 delivers the pure, tested data model — the logic backbone of Tablify with **zero Obsidian imports**. All modules under `src/model/` and `src/format/` are pure TypeScript that can be tested without Obsidian.

| Step | Linear | Objective | Depends on |
|------|--------|-----------|------------|
| P1-01 | SAD-19 | Field type registry (19 types) | P0-03 ✅ |
| P1-02 | SAD-20 | Row store (CRUD, stable IDs, auto-number, rev) | P1-01 |
| P1-03 | SAD-21 | Serializer and parser (round-trip `.tablify`) | P0-03 ✅, P1-02 |
| P1-04 | SAD-22 | Validation engine (required, unique, min, max, regex) | P1-01 |
| P1-05 | SAD-23 | Undo and redo command stack | P1-02 |
| P1-06 | SAD-24 | Select options (create-on-type, rename, delete with undo) | P1-01, P1-05 |

### Execution order (dependency-based parallelism)

```
Batch 1:  P1-01 (field type registry)  ══════════════════►
                                           │
Batch 2:  P1-02 (row store)  ═════════════┤
          P1-04 (validation) ═════════════┤  ← parallel after P1-01
                                           │
Batch 3:  P1-03 (serializer) ════════════┐│
          P1-05 (undo/redo)  ════════════┐││  ← parallel after P1-02
                                          │││
Batch 4:  P1-06 (select options) ════════┘│┘  ← after P1-01 + P1-05
                                           │
Batch 5:  Phase 1 gate + evidence compilation
```

---

## 1. Shared type definitions

Before any step, we establish the core types that multiple steps reference. These are defined once and imported everywhere.

### 1.1 File: `src/model/types.ts`

```typescript
// ---- Field types ----

export type FieldTypeName =
  | 'text' | 'long_text' | 'number' | 'currency' | 'percent'
  | 'duration' | 'rating' | 'checkbox' | 'date' | 'date_time'
  | 'url' | 'email' | 'phone'
  | 'single_select' | 'multi_select' | 'attachment'
  | 'auto_number' | 'created_time' | 'modified_time';

export interface SelectOption {
  id: string;        // pattern: opt_[A-Za-z0-9_]+
  name: string;
  color: OptionColor;
}

export type OptionColor =
  | 'gray' | 'brown' | 'orange' | 'yellow' | 'green'
  | 'blue' | 'purple' | 'pink' | 'red';

export interface FieldDefinition {
  id: string;          // pattern: fld_[A-Za-z0-9_]+
  name: string;
  type: FieldTypeName;
  primary?: boolean;
  options?: SelectOption[];    // only for single_select, multi_select
  required?: boolean;
  unique?: boolean;
  min?: number | string | null;
  max?: number | string | null;
  regex?: string | null;
}

// ---- Row types ----

export type CellValue = string | number | boolean | string[] | null;

export interface Row {
  id: string;          // pattern: row_[A-Za-z0-9]+
  rev: number;
  createdAt?: string;  // ISO 8601
  updatedAt: string;   // ISO 8601
  values: Record<string, CellValue>;
  sync: null;          // reserved for v1.1
}

// ---- View types ----

export type SortDirection = 'asc' | 'desc';
export type RowHeight = 'small' | 'medium' | 'large';

export interface SortEntry {
  fieldId: string;
  direction: SortDirection;
}

export interface ViewDefinition {
  id: string;
  name: string;
  sort: SortEntry[];
  groupBy: string | null;
  hidden: string[];
  frozenColumns: number;
  rowHeight: RowHeight;
  columnWidths: Record<string, number>;
}

// ---- Table (top-level) ----

export interface TablifyFile {
  formatVersion: 1;
  tableId: string;
  name: string;
  fields: FieldDefinition[];
  rows: Row[];
  views: ViewDefinition[];
  syncLink: null;
  [unknownKey: string]: unknown;  // unknown-key preservation
}
```

### 1.2 ID generation

```typescript
// src/utils/idGen.ts
// Uses crypto.getRandomValues() for 80+ bits of randomness (G-A6)
// Prefixes: row_, fld_, opt_, tbl_, view_
```

---

## 2. P1-01 — Field type registry (SAD-19)

### 2.1 Objective

Each of the 19 field types has one implementation for `validate`, `parse`, `format`, `defaultValue`, and `readOnly` status.

### 2.2 File layout

```
src/model/fieldTypes/
  interface.ts        FieldType interface definition
  text.ts             text, long_text
  number.ts           number, currency, percent, duration, rating
  boolean.ts          checkbox
  date.ts             date, date_time
  string.ts           url, email, phone
  select.ts           single_select, multi_select
  attachment.ts       attachment
  system.ts           auto_number, created_time, modified_time
  registry.ts         Registry: name → FieldType mapping
  index.ts            Barrel export
```

### 2.3 FieldType interface

```typescript
interface FieldType {
  /** Returns true if value is valid for this type */
  validate(value: CellValue, field?: FieldDefinition): boolean;

  /** Parse a string input into the typed value */
  parse(input: string, field?: FieldDefinition): CellValue;

  /** Format a typed value for display */
  format(value: CellValue, field?: FieldDefinition): string;

  /** Return the default (empty) value for this type */
  defaultValue(): CellValue;

  /** Whether users can edit this type (auto_number, created_time, modified_time = true) */
  readOnly: boolean;
}
```

### 2.4 Type implementations (19 types)

| Type | Value shape | Validate rules | Parse from string | Format | Default |
|------|------------|----------------|-------------------|--------|---------|
| text | `string \| null` | Max 10,000 chars | identity | identity | `null` |
| long_text | `string \| null` | Max 100,000 chars | identity | identity | `null` |
| number | `number \| null` | Finite number | `Number(input)`, reject NaN | `String(v)` | `null` |
| currency | `number \| null` | Integer minor units (cents), non-negative | Parse decimal string × 100, round | Divide by 100, format with 2 decimals | `null` |
| percent | `number \| null` | 0–1 range (stored as decimal) | Parse "75%" → 0.75 | Multiply by 100, append "%" | `null` |
| duration | `number \| null` | Non-negative integer (milliseconds) | Parse "1h30m" → ms | Format as human-readable | `null` |
| rating | `number \| null` | Integer 1–10 | `Number(input)`, clamp 1–10 | `String(v)` | `null` |
| checkbox | `boolean \| null` | Boolean | "true"/"1"/"yes" → true | "✓" / " " | `null` |
| date | `string \| null` | YYYY-MM-DD format | Parse date string | identity | `null` |
| date_time | `string \| null` | ISO 8601 UTC | Parse ISO string | identity | `null` |
| url | `string \| null` | Valid URL format | identity | identity | `null` |
| email | `string \| null` | Valid email format | Trimmed lowercase | identity | `null` |
| phone | `string \| null` | Valid phone format (allows `+`, spaces, dashes) | identity | identity | `null` |
| single_select | `string \| null` | Must be a valid option ID | Match by name (trimmed, case-insensitive) → return option ID | Lookup option name by ID | `null` |
| multi_select | `string[] \| null` | All must be valid option IDs | Split by comma, match each | Lookup option names | `null` |
| attachment | `string \| null` | Vault-relative path | identity | identity | `null` |
| auto_number | `number` (never null) | Read-only, integer | N/A (system-generated) | `String(v)` | 0 |
| created_time | `string` (never null) | Read-only, ISO 8601 | N/A | identity | `new Date().toISOString()` |
| modified_time | `string` (never null) | Read-only, ISO 8601 | N/A | identity | `new Date().toISOString()` |

### 2.5 Registry

```typescript
const registry = new Map<FieldTypeName, FieldType>();

export function getFieldType(name: FieldTypeName): FieldType { ... }
export function isKnownType(name: string): name is FieldTypeName { ... }
// Unknown type → throws error, never returns a silent default
```

### 2.6 Tests

| Code | Test | Count |
|------|------|-------|
| T-U | Table-driven: valid, invalid, empty values per type | ≥ 5 cases × 19 types = 95+ |
| T-M | `parse(format(v))` ≈ `v` for 1,000 random values per type (seeded) | 19 × 1,000 = 19,000 |
| T-U | Unknown type throws clear error | 1 |
| T-U | System types are read-only | 3 |
| Edge | Currency rounding (minor units), duration formats, leap-day dates, unicode URLs, phone with `+` | ≥ 10 |

### 2.7 Acceptance criteria
- [ ] All 19 types registered with tests
- [ ] Unknown types rejected with clear error
- [ ] Model-based round-trip tests pass
- [ ] Edge cases covered (currency, dates, unicode)

---

## 3. P1-02 — Row store (SAD-20)

### 3.1 Objective

In-memory table with stable IDs, timestamps, revisions, and auto numbers.

### 3.2 File: `src/model/tableStore.ts`

### 3.3 Interface

```typescript
export interface TableStore {
  // Create
  createRow(values: Record<string, CellValue>): Row;

  // Read
  getRow(id: string): Row | undefined;
  getAllRows(): Row[];  // returns copies in display order

  // Update
  updateRow(id: string, values: Record<string, CellValue>): Row;

  // Delete
  deleteRow(id: string): void;

  // Reorder
  moveRow(id: string, newIndex: number): void;

  // Auto number
  getNextAutoNumber(): number;

  // Metadata
  getFieldCount(): number;
  getRowCount(): number;
}

export function createTableStore(fields: FieldDefinition[]): TableStore;
```

### 3.4 Key behaviors

| Rule | Implementation |
|------|----------------|
| Row IDs | 80+ bits randomness, `row_` prefix, never reused (R-D9) |
| `rev` | Incremented by exactly 1 on every edit; starts at 1 on create |
| `updatedAt` | Set to UTC ISO 8601 on every edit |
| `createdAt` | Set once on create, never changed |
| Auto-number | Counter in metadata, never decrements, never reuses |
| Immutability | Operations return copies, never mutate input objects |
| Display order | Ordered list alongside the Map for insertion/reorder |

### 3.5 Tests

| Code | Test | Details |
|------|------|---------|
| T-U | Each operation contract | create, read, update, delete, reorder |
| T-U | Input immutability | Input objects unchanged after operations |
| T-U | 10,000 generated IDs unique | Record count |
| T-U | Auto-number not reused after delete | Delete row, create new → different number |
| T-M | 10,000 random operations vs reference model | Compare state every 100 steps and at end |

### 3.6 Acceptance criteria
- [ ] Model test matches for all operations
- [ ] 10,000 IDs unique
- [ ] Auto-number never reused
- [ ] Create 1,000 rows < 100 ms

---

## 4. P1-03 — Serializer and parser (SAD-21)

### 4.1 Objective

`.tablify` files round-trip byte-identical; invalid files never overwritten.

### 4.2 Files

- `src/format/serialize.ts` — TablifyFile → string
- `src/format/parse.ts` — string → TablifyFile (or error)
- `src/format/schema.ts` — schema validation helpers (using existing `tablify.schema.json`)

### 4.3 Serializer rules

1. Key order: as defined in FORMAT_SPEC.md §2–5
2. 2-space indentation
3. LF line endings
4. Trailing newline after closing `}`
5. Deterministic: same input always produces same output
6. Unknown keys preserved in their original position

### 4.4 Parser rules

1. Check `formatVersion` first — unknown version → error, no write
2. Validate structure against schema
3. Report first error with line and column
4. Preserve unknown keys (pass through to the model)
5. Never throw on malformed input — return error result

### 4.5 Write path

1. Serialize to string first
2. Validate the result
3. Only write if both succeed
4. Use atomic replace (temp file + rename) where supported

### 4.6 Tests

| Code | Test | Details |
|------|------|---------|
| T-U | Round-trip each `samples/v1/` file | Byte-identical after serialize→parse→serialize |
| T-U | Each `samples/invalid/` returns expected error | With line and column |
| T-F | 10,000 seeded random mutations | Parser returns valid model or error, never throws |
| T-I | Invalid file → write never called | Mock vault, assert zero writes |

### 4.7 Acceptance criteria
- [ ] Round-trips byte-identical for all valid samples
- [ ] Fuzz: zero uncaught exceptions in 10,000 cases
- [ ] Invalid files never overwritten
- [ ] Errors include line and column

---

## 5. P1-04 — Validation engine (SAD-22)

### 5.1 Objective

Rules checked consistently, no crash on bad config or pathological input.

### 5.2 File: `src/model/validation.ts`

### 5.3 Rules

| Rule | Types it applies to | Behavior |
|------|-------------------|----------|
| `required` | All | Value must not be null/empty |
| `unique` | All | No two rows have same value (case-sensitive by default) |
| `min` | number, currency, percent, duration, rating, date, date_time | Value ≥ min |
| `max` | Same as min | Value ≤ max |
| `regex` | text, long_text | Value matches regex pattern |

### 5.4 Interface

```typescript
export interface ValidationViolation {
  rowId: string;
  fieldId: string;
  rule: 'required' | 'unique' | 'min' | 'max' | 'regex';
  message: string;
}

export function validateTable(
  fields: FieldDefinition[],
  rows: Row[]
): ValidationViolation[];

export function validateCell(
  field: FieldDefinition,
  value: CellValue,
  allRows?: Row[]  // for unique check
): ValidationViolation[];
```

### 5.5 Safety features

- **Regex safety:** Compile once at config time. Reject invalid patterns. Limit input to 10,000 chars to prevent ReDoS.
- **ReDoS test:** Known pattern `(a+)+$` with 30 `a`s then `b` must either be rejected at config time or return in < 100 ms.
- **Unique case-sensitivity:** Documented as case-sensitive by default (assumption from P1 phase register).

### 5.6 Tests

| Code | Test | Details |
|------|------|---------|
| T-U | Each rule: positive and negative | 5 rules × 2 = 10+ |
| T-U | Invalid regex rejected at config | 2+ |
| T-P | ReDoS pattern: rejected or < 100 ms | 1 |
| T-M | Random tables: incremental vs full recompute | Identical results |

### 5.7 Acceptance criteria
- [ ] All rule tests pass
- [ ] Regex safety test passes
- [ ] Incremental and full validation results match
- [ ] Full validation of FX-M < 50 ms (proposed)

---

## 6. P1-05 — Undo and redo (SAD-23)

### 6.1 Objective

Local edits can be undone and redone in order.

### 6.2 File: `src/model/commands.ts`

### 6.3 Interface

```typescript
export interface Command {
  type: string;
  do(store: TableStore): void;
  undo(store: TableStore): void;
}

export interface CommandStack {
  execute(command: Command): void;
  undo(): boolean;       // returns false if nothing to undo
  redo(): boolean;       // returns false if nothing to redo
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;         // after sync (R-D14)
}

export function createCommandStack(store: TableStore, limit?: number): CommandStack;
```

### 6.4 Key behaviors

| Rule | Implementation |
|------|----------------|
| Do/undo data | Each command stores only its inverse data, not full snapshots |
| Coalescing | Consecutive edits to the same cell within 1 second → one command |
| Stack limit | 100 commands (configurable). Oldest dropped when full. |
| Redo cleared | New command after undo clears redo stack |
| Sync boundary | `clear()` empties both stacks (R-D14) |

### 6.5 Command types (initial set)

- `EditCellCommand` — stores old value, new value, row ID, field ID
- `AddRowCommand` — stores new row data (for undo: delete)
- `DeleteRowCommand` — stores deleted row (for undo: re-insert)
- `DuplicateRowCommand` — stores new row ID (for undo: delete)
- `ChangeFieldTypeCommand` — stores old and new type (for undo: restore old)
- `ChangeOptionCommand` — stores old and new option (for undo: restore old)

### 6.6 Tests

| Code | Test | Details |
|------|------|---------|
| T-M | 1,000 seeded random sequences | Undo all → initial state; redo all → pre-undo state |
| T-U | Redo cleared after new command | Execute, undo, new command → canRedo() = false |
| T-U | Stack limit 100 enforced | 101 commands → oldest dropped |
| T-U | Coalescing with fake timers | Same cell edits within 1s → one undo step |
| T-U | Clear after sync | Both stacks empty after clear() |

### 6.7 Acceptance criteria
- [ ] 1,000 random sequences pass (undo all, redo all)
- [ ] All unit cases pass
- [ ] Coalescing tested with fake timers

---

## 7. P1-06 — Select options (SAD-24)

### 7.1 Objective

Options created, renamed, reordered, and deleted with correct references.

### 7.2 File: `src/model/selectOptions.ts`

### 7.3 Interface

```typescript
export interface SelectOptionManager {
  /** Find existing option by trimmed, case-insensitive name, or create new one */
  findOrCreate(name: string, field: FieldDefinition): SelectOption;

  /** Rename an option. ID stays the same. */
  rename(optionId: string, newName: string, field: FieldDefinition): SelectOption;

  /** Reorder options within a field */
  reorder(optionIds: string[], field: FieldDefinition): void;

  /** Delete an option. Clears cells that reference it (R-D12). Returns affected row IDs. */
  delete(optionId: string, field: FieldDefinition, store: TableStore): {
    option: SelectOption;
    affectedRowIds: string[];
  };

  /** Create a DeleteOptionCommand (undoable via P1-05) */
  createDeleteCommand(optionId: string, field: FieldDefinition): Command;
}

export function createSelectOptionManager(): SelectOptionManager;
```

### 7.4 Key behaviors

| Rule | Implementation |
|------|----------------|
| Create-on-type | Trim + lowercase match against existing options. No match → create new option with random `opt_` ID. |
| Rename | Only changes `name`. ID stays. All cell references remain valid. |
| Delete (R-D12) | Clears the option from all cells that use it. Returns list of affected rows. |
| Delete is undoable | Implemented as one `Command` via P1-05. Undo restores all affected cells. |
| Color assignment | New options get the next color in the palette rotation |

### 7.5 Delete command implementation

```typescript
class DeleteOptionCommand implements Command {
  type = 'deleteOption';

  constructor(
    private optionId: string,
    private field: FieldDefinition,
    private affectedCells: Array<{ rowId: string; oldValue: CellValue }>
  ) {}

  do(store: TableStore): void {
    // Remove option from field.options
    // Clear affected cells
  }

  undo(store: TableStore): void {
    // Restore option to field.options
    // Restore all affected cell values
  }
}
```

### 7.6 Tests

| Code | Test | Details |
|------|------|---------|
| T-U | Create-on-type: same name different case → existing option | "To Do" and "to do" match same option |
| T-U | Create-on-type: new name → new option created | "Urgent" (new) creates opt_xxx |
| T-U | Rename keeps references valid | Cells with option ID still work after rename |
| T-U | Delete clears affected cells | All rows with option ID get null/empty |
| T-M | Delete then undo restores every affected cell | 100 seeded cases |
| T-U | Reorder changes display order | New order persisted |

### 7.7 Acceptance criteria
- [ ] All tests pass
- [ ] Delete-undo round trip exact
- [ ] Create-on-type case-insensitive matching verified

---

## 8. Fixture generation

Per guidelines §0.3, Phase 1 requires fixtures FX-S and FX-M to be generated.

### 8.1 File: `samples/generate-fixtures.mjs`

| Fixture | Rows | Columns | Use |
|---------|------|---------|-----|
| FX-S | 100 | 8 (all types) | Unit tests |
| FX-M | 1,000 | 12 (all types) | Target scale |

- Fixed seed for deterministic output
- Generated as `.tablify` files in `samples/fixtures/`
- Output hash recorded in evidence

### 8.2 Column coverage

Both fixtures include all 19 field types to exercise the full type registry:
1. Name (text, primary)
2. Description (long_text)
3. Count (number)
4. Price (currency)
5. Completion (percent)
6. Duration (duration)
7. Rating (rating)
8. Active (checkbox)
9. Due date (date)
10. Timestamp (date_time)
11. Website (url)
12. Contact (email)

FX-M adds: phone, single_select, multi_select, attachment, plus 3 system fields.

---

## 9. Module boundary rules

From roadmap §12: `src/model/` and `src/format/` **must not import from** `src/views/`, `src/menus/`, or `src/sync/`.

This keeps the data core:
- Testable without Obsidian
- Mobile-safe (no Node-only APIs)
- Independent of UI decisions

---

## 10. Full file inventory

```
src/
  model/
    types.ts                    (shared type definitions)
    fieldTypes/
      interface.ts              FieldType interface
      text.ts                   text, long_text
      number.ts                 number, currency, percent, duration, rating
      boolean.ts                checkbox
      date.ts                   date, date_time
      string.ts                 url, email, phone
      select.ts                 single_select, multi_select
      attachment.ts             attachment
      system.ts                 auto_number, created_time, modified_time
      registry.ts               type → FieldType mapping
      index.ts                  barrel export
    tableStore.ts               row CRUD, IDs, rev, auto-number
    validation.ts               required, unique, min, max, regex
    commands.ts                 undo/redo command stack
    selectOptions.ts            create-on-type, rename, delete with undo
  format/
    serialize.ts                TablifyFile → string
    parse.ts                    string → TablifyFile
    schema.ts                   schema validation helpers
  utils/
    idGen.ts                    ID generation (80+ bits, prefixed)

tests/
  model/
    fieldTypes.test.ts          per-type tests (95+ cases)
    fieldTypes.model.test.ts    model-based round-trip (19,000 cases)
    tableStore.test.ts          CRUD + immutability + ID uniqueness
    tableStore.model.test.ts    10,000 random ops vs reference
    validation.test.ts          per-rule positive/negative
    validation.model.test.ts    incremental vs full validation
    commands.test.ts            undo/redo + coalescing + limits
    commands.model.test.ts      1,000 random sequences
    selectOptions.test.ts       create-on-type, rename, delete
    selectOptions.model.test.ts delete-undo round-trip
  format/
    serialize.test.ts           round-trip all samples
    parse.test.ts               invalid samples + errors
    fuzz.test.ts                10,000 random mutations

samples/
  fixtures/
    fx-s.tablify                100 rows, 8 columns
    fx-m.tablify                1,000 rows, 12 columns
  generate-fixtures.mjs         fixture generator script

docs/
  evidence/
    P1-01.md
    P1-02.md
    P1-03.md
    P1-04.md
    P1-05.md
    P1-06.md
  gates/
    phase-1.md
```

---

## 11. Commit plan (one per step)

| # | Commit message | Content |
|---|----------------|---------|
| 1 | `P1-01: Field type registry (SAD-19)` | 19 types, registry, 95+ unit tests + model tests |
| 2 | `P1-02: Row store (SAD-20)` | TableStore, ID gen, auto-number, 10K ops model test |
| 3 | `P1-04: Validation engine (SAD-22)` | 5 rules, regex safety, incremental vs full |
| 4 | `P1-03: Serializer and parser (SAD-21)` | Round-trip, fuzz 10K, format validation |
| 5 | `P1-05: Undo and redo (SAD-23)` | Command stack, coalescing, 1K sequences |
| 6 | `P1-06: Select options (SAD-24)` | Create-on-type, rename, delete with undo |
| 7 | `Phase 1 gate: PASS` | Gate note, all evidence compiled |

Each commit is pushed to GitHub after passing `npm run check`.

---

## 12. Open questions

| ID | Question | Resolution (2026-10-09) |
|----|----------|-------------------------|
| Q1 | Currency minor units — which currency? | **Resolved:** Generic integer minor units. No currency code stored in v1 (documented as assumption). |
| Q2 | Duration parse format — what human-readable formats? | **Resolved:** Multiple formats supported: `HH:MM:SS`, `Xh Ym`, and raw milliseconds. |
| Q3 | Should we generate FX-S and FX-M as part of P1-01 or a separate commit? | **Resolved:** Generated as part of P1-02 (first step that needs them for model tests). |

---

## 13. Phase 1 gate conditions

| # | Condition | Verification |
|---|-----------|--------------|
| 1 | P1-01 through P1-06 accepted with evidence | All 6 evidence files present |
| 2 | `npm run lint`, `npm test`, `npm run build` pass | CI green |
| 3 | All Phase 0 regression tests still pass | 25 P0 tests in suite |
| 4 | No open S1/S2 issues | Decision log clean |
| 5 | Assumptions reviewed | P1 phase register items accepted |
| 6 | Gate note in `docs/gates/phase-1.md` | Written |
