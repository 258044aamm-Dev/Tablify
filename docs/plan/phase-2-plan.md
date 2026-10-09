# Phase 2 Implementation Plan — Query and View State

**Linear project:** Tablify — Obsidian Table Plugin (`e3c5e537-58fc-47a6-a3a1-b7664e69d85b`)  
**Phase:** P2 — Query and View State (MVP-critical, release 1.0)  
**Linear issues:** SAD-25 (P2-01 Query parser), SAD-26 (P2-02 Filter engine), SAD-27 (P2-03 View state)  
**Date:** 2026-10-09  
**Mode:** **Plan only — no code has been changed in this plan.** All file paths below are *proposed* until approved.  
**Prerequisite:** Phase 1 gate **PASSED** ✅ (`docs/gates/phase-1.md`, commit `e315176`, 172/172 tests). Phase 1 gate conditions are copied in §1 for traceability.  
**Repo cloned:** `https://github.com/258044aamm-Dev/Tablify.git` → `/home/user/Tablify` on `main` at `e315176` (ahead of origin). Workspace is clean.  
**Authoritative spec:** `spec/` directory in repo wins over Linear if they disagree. This plan links every requirement to its spec file.

---

## 0. Executive summary

Phase 2 turns the data core from Phase 1 into a **queryable, view-configurable table**. It is pure logic again — `src/query/` and `src/model/view.ts` must have **zero Obsidian imports** (so they stay testable and mobile-safe), exactly like `src/model/` and `src/format/` in Phase 1.

| Step | Linear | Objective | Depends on | Parallel slot | Can start |
|------|--------|-----------|------------|---------------|-----------|
| **P2-01** | SAD-25 | Parse `FEATURES.md §2.6` grammar into an AST with precise errors + printer | none (grammar only) | **Batch A** | Immediately — Phase 1 gate already passed |
| **P2-03** | SAD-27 | Define, validate, and persist `ViewDefinition`; never crash on deleted fields | P1-03 (serializer/parser) ✅ done | **Batch A** (in parallel with P2-01) | Immediately — P1-03 is done; confirmed by `docs/gates/phase-1.md` |
| **P2-02** | SAD-26 | Compile AST → predicates using the 19-type registry; match a naive reference on 10k random queries; type mismatches become errors | P2-01 + P1-02 ✅ | **Batch B** | After P2-01 is accepted (needs its AST + printer) |

> **Your answers to clarifying questions (2026-10-09) are baked in:**
> - *Order:* “as you wish, completely fulfill phase two” → we use the spec-recommended parallel order above (P2-01 + P2-03 parallel → P2-02) because it is fastest and still respects dependencies. Sequential P2-01→P2-02→P2-03 would also satisfy the gate but wastes ~30% calendar time.
> - *Ambiguous `field:a,b`:* `strict_each` → **text/long_text/url/email/phone/attachment = `containsAny`** (substring OR), **selects = `isAnyOf`** (exact option ID OR). Documented in `docs/query-grammar.md §4`. Both are OR across the comma-list, but the inner match differs by type.
> - *View model:* `add_column_order` → add explicit `columnOrder: string[]` to `ViewDefinition`. Guidelines says “column order and widths” — they are two different keys.
> - *Perf hardware:* `dev_machine` → sandbox benchmarks first, record as *proposed/informational*; your local hardware provides the final evidence for the gate.

### Phase 2 gate (from `spec/phases/P2.md`)

- **Gate:** P2-01 through P2-03 accepted. Gate note `docs/gates/phase-2.md`.
- **Assumptions & limitations (carried forward):**
  - Grammar covers only operators in `FEATURES.md §2.6`. No `OR`, no parentheses, no cross-field `NOT` in MVP. (AND across terms is implicit.)
  - Date comparisons use UTC unless spec says otherwise.
  - PERF-2 (filter FX-M <200 ms p95) remains **proposed** until you confirm hardware (G-P1).
- **Gate checklist (§10 of this plan)** must pass before any P3 work starts.

---

## 1. Repo analysis — where we are

### 1.1 Clone & current HEAD

```bash
git clone https://github.com/258044aamm-Dev/Tablify.git
# branch: main, HEAD: e315176 "Phase 1 gate: PASS — all 6 steps accepted"
# Phase 1 gate doc: docs/gates/phase-1.md — 172 tests, 0 lint errors, P1-01..P1-06 evidences present
```

### 1.2 What Phase 0 + Phase 1 delivered (so P2 can assume it)

| Area | Artefact | Evidence file | Status for P2 |
|------|----------|---------------|---------------|
| Format v1 | `FORMAT_SPEC.md`, `tablify.schema.json`, `samples/v1/{empty,typical,edge}.tablify` | `docs/evidence/P0-03.md` | ✅ Canonical file shape; `ViewDefinition` shape is the *starting point* for P2-03 to extend. `src/format/parse.ts` + `serialize.ts` preserve unknown keys and enforce `sync: null`, `syncLink: null`. |
| Guard | `src/main.ts` registers only `.tablify` | `docs/evidence/P0-04.md` | ✅ No `.tabula` handling; P2 must not introduce any `.tabula` code path (T-S checks). |
| Field types | `src/model/fieldTypes/*` + `registry.ts` — 19 types, each with `validate/parse/format/defaultValue/readOnly` | `docs/evidence/P1-01.md` (73 tests) | ✅ `getFieldType(name)` throws on unknown type — P2-02 must surface this as a *query error* (not silent fallback). |
| Row store | `src/model/tableStore.ts` — stable `row_` IDs, `rev`, timestamps, display order, auto-number | `docs/evidence/P1-02.md` (10k unique IDs, 15 tests) | ✅ P2-02’s `evaluate` needs `getAllRows(): Row[]` and `getFields(): readonly FieldDefinition[]`. No modification to the store is required for P2. |
| Validation | `src/model/validation.ts` — required/unique/min/max/regex | `docs/evidence/P1-04.md` | ✅ Not directly used by P2, but P2-02 predicates must not bypass it — filter is read-only. |
| Undo/redo | `src/model/commands.ts` (command stack, 1-sec coalescing) | `docs/evidence/P1-05.md` | ✅ P2 does not touch undo; tests ensure undo stack is not cleared by filtering (filter is pure). |
| Select options | `src/model/selectOptions.ts` — create-on-type, rename, delete with confirmation | `docs/evidence/P1-06.md` | ✅ Needed for P2-02 semantics: `single_select` values are *option IDs*, not display names. The filter’s “is any of” must match on ID after resolving name→ID via field options. |
| Types | `src/model/types.ts` — `FieldDefinition`, `Row`, `CellValue`, `ViewDefinition`, `SortEntry` | — | See §1.3 — **View needs extension** for P2-03. |
| Tests | `tests/{format,model}/*`, `vitest.config.ts`, `npm run check` | `docs/gates/phase-1.md` | ✅ 172 passing. New tests must not break them (regression guard). |
| Docs | `docs/{evidence,gates,decisions,testing/approach.md}` | — | `docs/query-grammar.md` does **not** exist yet — it is the first deliverable of P2-01. |

### 1.3 Current `ViewDefinition` (from `src/model/types.ts`)

```ts
export type SortDirection = 'asc' | 'desc';
export type RowHeight = 'small' | 'medium' | 'large';
export interface SortEntry { fieldId: string; direction: SortDirection; }

export interface ViewDefinition {
  id: string;                      // view_ prefix
  name: string;
  sort: SortEntry[];               // ordered list
  groupBy: string | null;          // fieldId or null  ← singular (not array)
  hidden: string[];                // fieldId array
  frozenColumns: number;            // ≥0, integer
  rowHeight: RowHeight;
  columnWidths: Record<string, number>; // fieldId → px
  // MISSING: columnOrder, warnings — added in P2-03 (see §5)
}
```

**Gap:** Guidelines/roadmap say *“column order and widths”* (plural) but `FORMAT_SPEC.md §5` and `types.ts` only store `columnWidths`. The plan therefore **adds** `columnOrder: string[]` in P2-03 (your `add_column_order` choice). This is a backward-compatible extension: missing `columnOrder` on load → derive from field order; extra key is preserved by the `unknown-key` rule in `parse.ts`. JSON Schema `tablify.schema.json` must also be updated in P2-03 (pure additive change — older files still validate).

### 1.4 No P2 code exists yet

```
src/query/        ← does not exist
src/model/view.ts ← does not exist
docs/query-grammar.md ← does not exist
tests/query/      ← does not exist
```

Phase 2 therefore starts from a clean slate; there is no legacy query code to migrate.

### 1.5 Module boundary to keep

`src/model/`, `src/query/`, `src/format/`, `src/utils/` **must not import** from `views/`, `menus/`, `sync/`, `embed/`, `formula/`. Same rule as Phase 1 — preserves mobile safety and testability. ESLint boundary check in `eslint.config.js` already enforces `no-restricted-imports` for `obsidian` in model/format/query; P2 will not add an exception.

---

## 2. Specification references (authoritative)

| Spec file | Relevant section for P2 | What it locks |
|-----------|-------------------------|---------------|
| `spec/features.md §2.6` | Filter grammar table (6 pattern rows) + “field names case-insensitive, quoted if spaces” + “builder and query string same result” | The only 6 operators allowed. No OR, no parentheses, no NOT-across-fields in MVP. |
| `spec/roadmap.md §5` | Dependency graph: `P2-01 → P2-02 ← P1-02`; `P1-03 → P2-03` | `P2-01` can start day one; `P2-03` after `P1-03`; `P2-02` after both `P2-01` and `P1-02`. |
| `spec/guidelines.md §0.2` | Test types T-U/T-F/T-D/T-I/T-M-DEV/T-P | Verification matrix in §8 below maps 1:1 to these codes. |
| `spec/guidelines.md §0.3` | Fixtures FX-S (100×8), FX-M (1000×12), FX-L (10000×12) | P2-02 differential uses **FX-M** (target scale). FX-L recorded for information only. |
| `spec/guidelines.md §0.4 + §0.7` | Benchmark method + PERF-2 (filter FX-M p95 <200 ms) | Proposed target — must be labeled *proposed* until you confirm. |
| `spec/guidelines.md P2-01` | Actions 1–4, Verification, Performance, Acceptance | Exact T-U/T-F counts and error-position requirement. |
| `spec/guidelines.md P2-02` | Actions 1–3, Verification, Performance | Type mismatch → error; printer used by builder; 10k random differential. |
| `spec/guidelines.md P2-03` | Actions 1–3, Verification | View shape, unknown field handling, primary-field hide rejection. |
| `spec/phases/P2.md` | Gate note + assumptions | P2-01..P2-03 accepted → `docs/gates/phase-2.md`. UTC for dates. |
| `spec/steps/P2-{01..03}.md` | Per-step spec (copied from guidelines) | Canonical step context; Linear metadata only tracks status. |
| `FORMAT_SPEC.md §3–§5` + `tablify.schema.json` | Field/row/view JSON shape | Current view shape; P2-03 adds `columnOrder` + warning field without breaking unknown-key preservation. |
| `spec/glossary.md` | Query = filter text like `status:todo`; View = saved settings | Vocabulary used in this plan. |
| `spec/roadmap.md §3.2 R-D13` | “Primary field cannot be hidden or deleted” | Enforced in `src/model/view.ts` for P2-03. |
| `spec/roadmap.md §3.3 D-O1..D-O5`, `G-P1` | Open decisions | P2 does not block on D-O1..D-O5; G-P1 keeps PERF targets provisional. |

---

## 3. Cross-cutting design decisions (apply to all 3 steps)

### 3.1 Pure modules, no Obsidian

- `src/query/parse.ts`, `src/query/evaluate.ts`, `src/query/print.ts` (printer co-located with parser), and `src/model/view.ts` import **only** from `src/model/types.ts`, `src/model/fieldTypes/*`, and `src/utils/`. Never `obsidian`.
- Tests run with `vitest` on Node, no vault required, except the single `T-I` vault-restart check in P2-03 (§5.4).

### 3.2 ID & case rules

- **Field name lookup:** case-insensitive everywhere, trimmed. Implementation: `normalizeFieldName(name: string): string → name.trim().toLowerCase()` and a shared `Map<normalizedName, FieldDefinition>` built per table (or per query). Quoted names (`"My Field"`) are unescaped before normalization.
- **Quoting rule (P2-01):** field name containing `:` ` ` `"` `,` `>` `<` `~` `!` or empty string, or starting with digit, **must** be quoted in the printer. Parser accepts both quoted and unquoted when unambiguous. Quote char is `"` (double quote); inside quoted name `""` → `"` (CSV-style escaping) or `\"` — grammar doc picks one and sticks to it (chosen: doubled `""` because it matches the CSV parser already in P4-01 spec; no new escaping style introduced).
- **Whitespace:** ignored around `:` and `,` inside value lists; not ignored inside quoted strings; outer query is trimmed and terms split on whitespace **outside** quotes. `field: value` (space after colon) is accepted as `field:value` for UX — grammar doc calls this out.

### 3.3 Error model (all query errors are values, never throws)

Every public function that can fail returns a **result object**, matching the pattern already used in `src/format/parse.ts`:

```ts
type QueryParseResult =
  | { ok: true;  ast: QueryAST }
  | { ok: false; error: QueryError };   // error has { message, position: number, line, column }

type FilterResult =
  | { ok: true;  rows: Row[] }
  | { ok: false; error: QueryError };   // type mismatch etc.
```

- `position` is a character offset from 0 (as guidelines require “character offset”). `line`/`column` are derived helpers for DX (1-based). Every error path populates `position`. Tests assert `error.position >= 0 && error.position <= input.length`.
- Never `throw` on user input; `throw` only for programmer errors (unknown internal field type).

### 3.4 Date handling

- `date` = `YYYY-MM-DD` (date-only, no time). `date_time` = ISO 8601 UTC with `Z` (e.g., `2026-10-09T10:00:00Z`). Comparisons use UTC. `parse.ts` for field types already stores these as strings; P2 comparator parses to `Date` once per distinct row value and caches per evaluation run.
- Operator `>` / `<` on dates means `after` / `before` in UTC. Equality `:` on dates is exact string match (day). `>n` / `<n` with date textual value like `"2026-01-01"` is parsed via `Date.parse`; ambiguous date strings (e.g., `"9/10/2026"`) are **not** inferred here — the user must supply ISO form; grammar doc says this explicitly (G-A5).

### 3.5 Performance bundle discipline

- Query modules are **synchronous** and allocation-light: no async, no `requestUrl`, no DOM. Tokenizer works on a single pass with index cursor (no regex backtracking). Predicate compilation produces closures that read `row.values[fieldId]` directly — no intermediate row copies per predicate.
- FX-M (1,000 rows × 12 cols) is the measured target. FX-L (10,000) is recorded for information only — never a gate blocker.

---

## 4. P2-01 — Query parser (SAD-25)

### 4.1 Objective

Parse the grammar in `FEATURES.md §2.6` into an **AST**, with clear errors that include character offset. Provide a **printer** that round-trips `print(parse(q))` back to the same AST, so the filter builder (later P3-08) can use the same code path as typed queries.

### 4.2 Grammar (to be written in `docs/query-grammar.md`)

`docs/query-grammar.md` is the **first deliverable**. Outline (what the file will contain):

```markdown
# Query Grammar — Tablify

## 1. Overview
- Query = zero or more Terms separated by whitespace (implicit AND).
- Empty/whitespace-only query = match-all (no filter). This is valid and parses to empty AST.

## 2. Tokenization
- Input is UTF-8, LF normalized.
- Tokens: FIELD_NAME (quoted or unquoted), COLON `:`, OP `~` `!` `>` `<`, COMMA `,`, VALUE word, QUOTED_VALUE "…", KEYWORD `empty`.
- Whitespace = ` ` `\t` `\n` `\r`. Skipped outside quotes/values.
- Quoted field name: " + (any char except " or "" ) + " ; embedded " is "" (doubled). Empty quoted name error with position at opening ".
- Quoted value: " + (any char) + " ; same "" rule. Keeps spaces/commas inside.
- Case-insensitive field names after unquoting+trim.

## 3. Grammar (EBNF)
Query      := WS* (Term (WS+ Term)*)? WS*
Term       := FieldRef ":" WS* TermBody
FieldRef   := QuotedName | UnquotedName   // UnquotedName = [^ :~!>,<",\s][^ :,\s]*  (no : , space, comma, quote)
TermBody   := EmptyKw | ContainsOp | NotOp | GtOp | LtOp | ValueList
EmptyKw    := "empty"                    // case-insensitive
ContainsOp := "~" Value
NotOp      := "!" Value
GtOp       := ">" Value                  // >n  or >date
LtOp       := "<" Value
ValueList  := Value ("," Value)*         // comma = OR (see §4)
Value      := QuotedValue | UnquotedValue | ""  // empty after colon: field:  (value = "")
UnquotedValue := [^",\s]+               // no spaces/commas unless quoted
QuotedValue   := "\"" ( '""' | [^"] )* "\""

## 4. Comma semantics & ambiguous case resolution (your strict_each choice)
- `field:a,b` = OR across values.
- For text-family (text, long_text, url, email, phone, attachment): OR is `containsAny` — substring match per term (case-insensitive, see §6).
- For single_select / multi_select: OR is `isAnyOf` — exact option ID(s) match. Input "a" is resolved to option ID via field.options (name case-insensitive exact; if not found then treated as raw value and will not match — not an error at parse time; evaluate time decides).
- For numeric/date/rating/currency/percent/duration: comma list is allowed but each value must be numeric/date; evaluation will treat as OR across equality/containsAny depending on field type (see P2-02).
- For checkbox: `field:true` `field:false` etc. (commas allowed as OR).
- `field:>5` with commas: `field:>5` takes one value; multi-value with > is written as `field:>5,>10` is NOT supported — parser errors (position at second >). MVP does not have per-value ops.

## 5. Whitespace & quoting details
- `field : value` (space around colon) = `field:value`.
- `field:"hello world"` keeps space inside.
- `field:"a,b"` keeps comma inside (not OR).
- Trailing comma `field:a,` is error at position of comma.

## 6. Comparison semantics by type (summary, details in P2-02)
- Text: `:` = equals case-insensitive exact; `~` = substring case-insensitive; `:a,b` = containsAny; `:empty` = null or "".
- Select: `:` = is/contains (single) or contains (multi) exact ID; `!` = single_select only; `:a,b` = isAnyOf/containsAny.
- Number/date: `:` = equals; `>n` / `<n` = numeric/date compare; type mismatch with ~ or ! = evaluate error (P2-02).

## 7. Errors
- Every error has { message, position, line, column }.
- Examples: missing colon, empty field name, unclosed quote, trailing comma, empty term.

## 8. Printer
- Minimal quoting: quotes field name only if needed; quotes value only if it contains space/comma/colon/quote.
- Always emits canonical form: lowercase field names normalized? No — printer preserves field name as provided in AST `rawFieldName` but parser stores normalized form for lookup; round-trip uses normalized printer for deterministic compare.
## 9. Ambiguous cases table (recap)
| Input | Text field | multi_select | single_select | number/date |
|-------|------------|--------------|---------------|-------------|
| `f:a,b` | contains "a" OR "b" | is any of a,b | is any of a,b | equals a OR equals b |
| `f:"a,b"` | contains "a,b" literally | is "a,b" | is "a,b" | equals "a,b" as string → type error |
| `f:empty` | null/"" | null/[]/"" | null/"" | null |
| `f:` (empty val) | empty | empty | empty | empty |
```

Editor review checkpoint: the doc is merged only after you (owner) sign the ambiguous-cases table.

### 4.3 AST shape

```ts
// src/query/parse.ts

export interface QueryError {
  message: string;
  position: number;   // char offset 0..input.length
  line: number;       // 1-based
  column: number;     // 1-based
}

export type QueryAST = {
  terms: QueryTerm[];          // [] = match-all
  rawInput: string;            // kept for error reporting, not used in equality
};

export type QueryTerm = {
  fieldName: string;           // normalized (trimmed, lowercased) — for lookup
  rawFieldName: string;        // as typed (unquoted form) — for printer
  op: QueryOp;
  values: string[];            // raw value strings (unquoted); [] for `empty`; [""] for `field:` with empty value
  raw: string;                 // slice of input for this term (for debugging)
  position: number;            // offset of term start (field name)
};

export type QueryOp =
  | 'eq'           // field:value  or field:a,b (values.length may be >1)
  | 'contains'     // field:~value
  | 'not'          // field:!value   (single value)
  | 'gt'           // field:>value
  | 'lt'           // field:<value
  | 'empty';       // field:empty

// Additional discriminant for comma meaning (resolved at evaluate time, but flagged here):
// term.isCommaList = values.length > 1
```

Design note: the AST stores **raw strings**, not typed values. Typing/coercion happens in `evaluate.ts` using the field registry — this keeps parsing pure and makes the printer trivial (string in → string out). The alternative (parse numbers/dates eagerly) would couple parser to field types, which the spec forbids (“pure module, no prerequisites in code”).

Error example: `bad field:foo` (space in unquoted name) → `{ message: "Unexpected whitespace in field name — quote the name: \"bad field\"", position: 3 }`.

### 4.4 File layout

```
src/query/
  parse.ts        tokenizer + parser + AST types + QueryError
  print.ts        printer: AST → canonical query string (re-exported from parse.ts or standalone)
  index.ts        barrel: export { parseQuery, printQuery, type QueryAST, type QueryError }

docs/
  query-grammar.md   ← grammar doc (deliverable #1)
tests/query/
  parse.test.ts      T-U cases + fuzz + round-trip
  print.test.ts      printer cases (or co-located in parse.test.ts)
  fixtures.ts        shared helpers: makeField(name,type), seeded PRNG, random string generator
```

No `src/query/evaluate.ts` yet — that is P2-02.

### 4.5 Tokenizer & parser algorithm (plan, not code)

**Tokenizer:** single pass with index `i` over `input`. States: `WS`, `FIELD`, `QUOTE_FIELD`, `AFTER_COLON`, `OP`, `VALUE`, `QUOTE_VALUE`, `EMPTY_KW`. Emit tokens with `start` offset. No regex with backtracking — char-by-char loop, O(n).

**Parser:** recursive-descent over token stream (LL(1) enough for this grammar — no OR/parentheses in MVP). Steps:
1. Skip leading WS.
2. While not EOF: parse `Term` → expect `FieldRef`, `COLON`, `TermBody` (look ahead for OP char or `empty` keyword or value list). On any missing piece, create `QueryError` with `position = tokens[pos].start` (or `input.length` for unexpected EOF).
3. Terms delimited by WS; if a term ends with unclosed quote → error at opening quote position.
4. Comma lists: `Value ("," Value)*` — a second comma in a row or trailing comma is error at that comma.
5. `TermBody` empty (just `field:` and then WS/EOF or next field) → `values: [""]` with `op: 'eq'` (so `field:` and `field:empty` are distinct — latter is `op: 'empty'`).
6. Return `{ ok: true, ast }` or `{ ok: false, error }` — never throw on malformed input.

**Printer:** `printQuery(ast): string` — for each term emit `quoteIfNeeded(rawFieldName):opPrefix + values.map(quoteIfNeeded).join(",")`. `empty` prints `field:empty`. Printer is the path the future builder (P3-08) will call.

### 4.6 Verification (from spec, made concrete)

| Spec code | Required | How we will test | File | Pass condition |
|-----------|----------|------------------|------|----------------|
| **T-U 30** | At least 30 cases covering each operator row, quoted names, case-insensitive, empty value, error cases | Table-driven `it.each` over ≥40 cases (hand-written) — each with `input`, `expectedAST` and, for errors, `expectedPosition`. Covers the 6 rows + quoted/CI/empty. | `tests/query/parse.test.ts` | All 40 pass |
| **T-F 10k** | 10,000 seeded random strings. No uncaught exception; every error has valid position | Use deterministic PRNG `mulberry32(seed)` (same seed helper used in Phase 1 model-based tests). Generator: `charset = ascii + unicode + operators (:~!>,<", )` length 0..200. Run `parseQuery(s)` for each; `expect(result.ok ? ... : result.error.position >=0 && <= s.length)` + `expect(() => parseQuery(s)).not.toThrow()`. | `tests/query/parse.test.ts` describe “fuzz” | 10k pass, 0 throws |
| **T-U round-trip** | `print-then-parse` gives equal AST | For every T-U case + 100 random generated valid queries (via printer-inverse generator): `expect(parse(print(parse(input).ast)).ast).toEqual(parse(input).ast)` (structural equality ignoring `raw`/`rawInput`). | `tests/query/parse.test.ts` | 100% equal |
| **Perf (proposed)** | Parse 1 KB query <1 ms | Benchmark `performance.now()` loop 1000× parsing a 1 KB query (40 terms) on sandbox + on your machine; median/p95 in evidence. Not a gate blocker — labeled *proposed*. | `tests/query/benchmark.test.ts` or `scripts/bench-query.mjs` | p95 <1 ms if reported; if >1 ms, still PASS with note “proposed, not confirmed”. |

Example hand-written cases (subset, to be expanded to 40):

```ts
[
  // empty / match-all
  { input: "",            expect: { terms: [] } },
  { input: "   ",         expect: { terms: [] } },
  // eq
  { input: "status:Done", expect: { terms: [{ fieldName: "status", op: "eq", values: ["Done"] }] } },
  { input: "Status:done", expect: { terms: [{ fieldName: "status", op: "eq", values: ["done"] }] } }, // case-insensitive name
  { input: '"My Field":Done', expect: { terms: [{ fieldName: "my field", op: "eq", values: ["Done"] }] } },
  { input: 'title:"hello world"', expect: { terms: [{ fieldName: "title", op: "eq", values: ["hello world"] }] } },
  { input: "field:empty", expect: { terms: [{ fieldName: "field", op: "empty", values: [] }] } },
  { input: "field:",      expect: { terms: [{ fieldName: "field", op: "eq", values: [""] }] } }, // empty value vs empty keyword
  { input: 'field:a,b',   expect: { terms: [{ fieldName: "field", op: "eq", values: ["a","b"] }] } }, // comma list
  { input: 'field:"a,b"', expect: { terms: [{ fieldName: "field", op: "eq", values: ["a,b"] }] } }, // quoted comma = one value
  // contains
  { input: "name:~ship",  expect: { terms: [{ fieldName: "name", op: "contains", values: ["ship"] }] } },
  // not / single_select
  { input: "status:!Done", expect: { terms: [{ fieldName: "status", op: "not", values: ["Done"] }] } },
  // gt / lt
  { input: "count:>5",    expect: { terms: [{ fieldName: "count", op: "gt", values: ["5"] }] } },
  { input: "due:<2026-01-01", expect: { terms: [{ fieldName: "due", op: "lt", values: ["2026-01-01"] }] } },
  // multi-term (AND)
  { input: "status:Done name:~ship", expect: { terms: [ {op:"eq",...}, {op:"contains",...} ] } },
  // errors
  { input: "field",       errorAt: 5 },           // missing colon
  { input: ":value",      errorAt: 0 },           // empty field name
  { input: '"unclosed:foo', errorAt: 0 },         // unclosed quote
  { input: "f:a,,b",      errorAt: 3 },           // double comma
  { input: "f:a,",        errorAt: 3 },           // trailing comma
  { input: "f:>a,b",      errorAt: 5 },           // GT with comma list (MVP: not supported)
]
```

### 4.7 Outputs & acceptance (exactly as spec)

- **Deliverables:** `src/query/parse.ts` (+ `print.ts` / barrel), `docs/query-grammar.md`, tests.
- **Acceptance:** all tests pass, fuzz clean (0 throws, every error has valid position), ambiguous cases documented in `docs/query-grammar.md §4`. No Obsidian imports in `src/query/`.

### 4.8 Proposed `docs/query-grammar.md` decisions recorded

- Quote escaping: `""` inside quoted string (CSV-style) — no backslash escapes introduced.
- Whitespace around `:` is allowed and normalized away.
- Field name normalization: `trim().toLowerCase()`, Unicode preserved.
- `field:empty` vs `field:` distinction (empty keyword vs empty value) is intentional.
- Comma semantics: `strict_each` (see §4.2 §4).
- `field:>5` with commas errors; per-value ops not in MVP.

---

## 5. P2-03 — View state (SAD-27)

### 5.1 Objective

View settings save and reload exactly, never crash when a referenced field no longer exists, and reject hiding the primary field (R-D13).

### 5.2 View object — proposed shape (extends current `ViewDefinition`)

```ts
// src/model/view.ts — extends types.ts ViewDefinition

export interface ViewDefinition {
  id: string;
  name: string;
  sort: SortEntry[];                 // [{ fieldId, direction }]
  groupBy: string | null;            // fieldId or null
  hidden: string[];                  // fieldId[]
  frozenColumns: number;             // 0..fields.length (validated)
  rowHeight: RowHeight;              // 'small' | 'medium' | 'large'
  columnWidths: Record<string, number>; // fieldId → width px (integer, 60..800 recommended, min 60 proposed)
  columnOrder: string[];             // ← NEW per your choice (fieldId[]; length == fields.length, permutation)
  warnings?: string[];               // ← NEW: non-fatal validation messages (e.g., "unknown fieldId fld_x ignored in sort")
}

export interface ViewValidationResult {
  view: ViewDefinition;              // normalized copy
  warnings: string[];                // e.g., "hidden contains unknown field fld_z — ignored"
  errors: string[];                  // e.g., "primary field fld_name cannot be hidden"
  ok: boolean;                       // true if no errors (warnings allowed)
}
```

`types.ts` is updated to add `columnOrder` and optional `warnings`. `tablify.schema.json` is updated additively:

```json
"columnOrder": { "type": "array", "items": { "type": "string" } },
"warnings":   { "type": "array", "items": { "type": "string" } }
```

Both are optional for backward compat — missing `columnOrder` on load keeps old files valid (see §5.3 migration rule).

Field spec actions mapping (from `guidelines.md P2-03`):

| Spec action | Implementation |
|-------------|----------------|
| 1. Define view object (sort list, group field, hidden, column order/widths, frozen count, row height) | Above interface + `createDefaultView(fields)` factory that builds a view from field list (sort=[], groupBy=null, hidden=[], frozenColumns=1 per R-D11, rowHeight='medium', columnOrder = fields.map(f=>f.id), columnWidths = {}, warnings=[]). |
| 2. Validate on load: unknown field IDs ignored with warning, not error | `validateView(view, fields): ViewValidationResult` — walks every fieldId-reference location (sort[].fieldId, groupBy, hidden[], columnOrder[], columnWidths keys) → if unknown, remove/clear it and push a warning string. Never throws. Preserves the removed IDs in `warnings` message so the user can see what was dropped. |
| 3. Reject hiding primary field (R-D13) | If `hidden` contains the field with `primary: true`, return `{ ok:false, errors:["Primary field '...' cannot be hidden (R-D13)"] }` and **do not** apply the view. Caller (serializer/UI) shows the error. This is the one hard error in view validation. |

### 5.3 Load/normalize rules (pure functions)

```ts
export function normalizeView(raw: unknown, fields: FieldDefinition[]): ViewValidationResult;
export function validateView(view: ViewDefinition, fields: FieldDefinition[]): ViewValidationResult;
export function createDefaultView(fields: FieldDefinition[], name?: string): ViewDefinition;
export function cloneView(view: ViewDefinition): ViewDefinition; // deep copy

// Helpers for serializer integration:
export function sanitizeViewsForSave(views: ViewDefinition[], fields: FieldDefinition[]): ViewDefinition[];
// sanitizeViewsForSave does the same unknown-field stripping as normalize, so saved files never contain dangling fieldIds.
```

Migration rule: if `columnOrder` is missing on load (old `typical.tablify` / `empty.tablify`), derive it as `fields.map(f=>f.id)` and add a warning `"columnOrder missing — derived from field order"`. If `warnings` is missing, default to `[]`. If `rowHeight` value is the old spec’s `medium`/`small`/`large` it maps directly (no migration needed — `types.ts` already uses those three strings; `FORMAT_SPEC.md` sample uses `medium`). If `frozenColumns` is `null` or missing → default `0`.

Freeze bound: `frozenColumns` clamped to `0..fields.length` with warning if out of range (not error). `columnWidths` entries with non-integer or <0 are dropped with warning.

### 5.4 Module boundary & wiring to `src/format/`

- `view.ts` is pure; it does not import `obsidian`, does not touch vault.
- `src/format/parse.ts` after JSON parse currently validates top-level keys and iterates `views` only checking `id` is string. **P2-03 will extend it** to call `validateView` for each view after fields are known, collect warnings into the returned `TablifyFile` and drop dangling references — but only after the view module exists. Alternatively, keep `parse.ts` minimal and let `createTableStoreFromFile` / future `TableFileManager` call `validateView`. Decision: the minimal safe wiring is to make `parse.ts` import `validateView` and run it (still pure, no Obsidian), so any file load path automatically sanitizes. This keeps the invariant “a loaded file never has dangling view fieldIds” regardless of caller. `serialize.ts` will call `sanitizeViewsForSave` before writing.
- In tests, we assert `parse` of a file whose `hidden:["fld_deleted"]` succeeds (`ok:true`) and `view.warnings` contains the drop notice.

### 5.5 Verification (from spec, made concrete)

| Spec code | Required | How we will test | Pass condition |
|-----------|----------|------------------|----------------|
| **T-U each setting save/reload** | Every view setting survives `serialize(parse(file))` byte-identical *modulo* added `columnOrder`/`warnings` normalization | For each of the 7 settings (sort, groupBy, hidden, columnOrder, columnWidths, frozenColumns, rowHeight): create a file with field set FX-S fields, craft a `ViewDefinition` covering all combinations, `serialize → parse → assert deepEqual(view, parsed.view)`. Use `tablify.schema.json` via Ajv to confirm the serialized file still validates. | All per-setting tests pass; file validates. |
| **T-U deleted field** | View referencing a deleted field loads without error and warning is recorded | Hand-crafted JSON strings with `views[0].sort=[{fieldId:"fld_gone"}]`, `groupBy:"fld_gone"`, `hidden:["fld_gone"]`, `columnOrder:["fld_gone",...]`, `columnWidths:{"fld_gone":120}`. Call `parse(s)`. Assert `ok:true`, view no longer contains `fld_gone` in those slots, `view.warnings` (or result warnings array) includes mention of `fld_gone` and valid position not needed (parse success). Also test via `validateView` directly: unknown IDs → warning, primary hide → error. | Loads without throw; warning recorded. |
| **T-I vault restart** | Change settings in a real vault, restart Obsidian, confirm restored | Manual `T-I` script in `docs/testing/approach.md` style: open `samples/v1/typical.tablify`, change every view setting via the API helper `src/model/view.ts`, call `serialize` → vault `modify` → close file → reopen → assert equal. Second run actually restarts Obsidian desktop (record steps + screenshot). If automation not available, record as `T-M-DEV` with reason `T-I vault automation pending P0-02 approach` but still count as PASS for phase gate only if evidence video exists. | Settings equal after reopen/restart; evidence video + file hashes recorded. Mark `NOT RUN` on mobile if no device — but desktop T-I is required. |
| **R-D13 hidden primary** | Reject hiding primary | Call `validateView({...hidden:[primaryFieldId]}, fields)` → `ok:false`, `errors` contains `primary`, and original view unchanged (caller must not save it). Integration: try to save a file with that view and confirm `serialize` path would surface the error (or prevent save). | Error returned, save blocked. |

**Additional T-U we will add (beyond spec minimum, to reach high coverage):**

| Extra | Case | Why |
|-------|------|-----|
| T-U | `columnOrder` length ≠ fields.length or not a permutation | Must warn and auto-fix to field order |
| T-U | `frozenColumns` out of range (e.g., 999) | Warn + clamp |
| T-U | `columnWidths` with negative/zero/float/∞ | Drop with warning |
| T-U | `groupBy` on checkbox/number vs text | Allowed at view-layer; type compatibility is a P3-08 concern (view still saves) |
| T-U | Two views, one with dangling field, one clean | Both normalized independently |
| T-U | `cloneView` deep-copy guarantee (mutate original not leaked) | Same immutability contract as `TableStore` |

### 5.6 File layout

```
src/model/
  view.ts             pure view logic (validate, normalize, factories)
  types.ts            updated ViewDefinition (+ columnOrder, warnings)
src/format/
  parse.ts            extended to call validateView for each view
  serialize.ts        sanitizes views before write
tablify.schema.json   add columnOrder + warnings (optional, for backward compat)
tests/model/
  view.test.ts        T-U settings + deleted-field + R-D13 + extra cases (~25 tests)
tests/format/
  view-persistence.test.ts  T-U save/reload via parse/serialize helpers (co-located or separate)
```

### 5.7 Outputs & acceptance

- **Deliverables:** `src/model/view.ts`, updated `src/model/types.ts`, updated `tablify.schema.json`, updated `src/format/*` integration, tests.
- **Acceptance:** all T-U pass, deleted-field warning recorded, restart test evidence captured, no regressions in Phase 0/1 tests.

---

## 6. P2-02 — Filter engine (SAD-26)

### 6.1 Objective

A parsed query returns **exactly the same row set** as a naive reference implementation, on 10,000 random queries over FX-M. Type mismatches (e.g., `count:>nonsense` or `textField:>5`) surface as **query errors**, not silent empty results. The builder (future P3-08) will emit queries via the P2-01 printer, so both paths share one parser.

### 6.2 Predicate compilation model

```ts
// src/query/evaluate.ts
import type { QueryAST, QueryError } from './parse.js';
import type { Row, FieldDefinition, CellValue } from '../model/types.js';
import { getFieldType } from '../model/fieldTypes/registry.js';

export type Predicate = (row: Row) => boolean;

export type EvaluationResult =
  | { ok: true; rows: Row[]; matchedIds: string[] }   // same set regardless of order
  | { ok: false; error: QueryError };                 // type mismatch / unknown field

export type EvaluateOptions = {
  // If true, unknown field name in term → error (default true for strictness).
  // Needed because Linear says “query error, not empty result” — unknown field = type mismatch family.
  strictFieldNames?: boolean;
};

// Main API:
export function evaluateQuery(
  ast: QueryAST,
  rows: Row[],
  fields: FieldDefinition[],
  options?: EvaluateOptions
): EvaluationResult;

// Lower-level (also exported for testing the differential):
export function compilePredicate(
  ast: QueryAST,
  fields: FieldDefinition[]
): { ok: true; predicate: Predicate } | { ok: false; error: QueryError };

export function compileTerm(
  term: QueryTerm,
  field: FieldDefinition,
  knownFieldsByName: Map<string, FieldDefinition>
): { ok: true; predicate: Predicate } | { ok: false; error: QueryError };
```

**Conjunction (AND):** `terms = [T1, T2, …]` → predicate = `row => p1(row) && p2(row) && …`. Empty `terms` → `() => true` (match-all).

**Disjunction (OR) within a term:** comma list `a,b` inside one term → `row => match(row,a) || match(row,b)`. This is the only OR in MVP; no cross-term OR.

### 6.3 Type-specific term semantics (the evaluator’s truth table)

Every comparator below uses the field’s runtime value from `row.values[fieldId]`. `null` / missing key is treated as “empty”.

| Field families | `op:eq` (`field:value` or `field:a,b`) | `op:contains` (`field:~value`) | `op:not` (`field:!value`) | `op:gt` / `op:lt` (`field:>n` / `<n`, dates also) | `op:empty` (`field:empty`) | Type-mismatch cases → error |
|---|---|---|---|---|---:|---|
| **text, long_text, url, email, phone, attachment** | Single value: case-insensitive exact string match after `String(cell)`. Multi `a,b`: **containsAny** — cell string case-insensitive `includes` any of `a,b`. (So `field:value` on text is not “substring” — it is exact; use `~` for substring; but `a,b` per your choice uses *contains* not exact. This is the documented nuance.) | Case-insensitive substring `includes(value)` on `String(cell)`. `value` exact substring. | **Not supported** → error `"! operator is only valid for single_select"` (unless we decide to allow for text as negated equality, but spec says `!value` means *is not* for single select — so treat as single_select-only). | Error: `"> operator not valid for text field ..."` | `cell == null \|\| cell === "" \|\| cell === undefined` | `>`, `<`, `!` on text family |
| **number, currency, percent, duration, rating** | Single: numeric equality `Number(cell) === Number(value)` (currency as stored cents; value “12.34” → `1234` via the field’s parse logic? For filtering we compare stored numbers, not display strings — use `Number(value)` and for currency multiply by 100. For percent value may be “75%” or “0.75” — accept both, normalize.) Multi `a,b`: OR across equalities. | Error | Error | `>` / `<` do numeric compare after same normalization. `value` must parse to finite number or it’s an error at evaluate-time: `QueryError { message: "Invalid number 'foo' for field 'count'" }` | same empty rule | `~`, `!` on numeric |
| **single_select** | Single: `cell === optionIdFor(value)` where `value` matched to `field.options[].name` case-insensitive exact. If name not found and value looks like an `opt_*` ID it matches ID directly. Multi `a,b`: **isAnyOf** — `cell` is any of the resolved option IDs. | Error (or reuse `eq` semantics) — but spec says `~value` is text-contains, not select. So `~` on select → error. | Single `!value`: `cell !== optionIdFor(value)` — the canonical “is not” use case. On `multi_select` `!` → error. | Error | `cell == null \|\| cell === ""` (attachment-style) — also covers case where option was deleted and cell was cleared to null by `selectOptions` rule | `~`, `>`, `<` on selects |
| **multi_select** | Single `value`: `Array.isArray(cell) && cell.includes(optionIdFor(value))` (contains). Multi `a,b`: **containsAny** — `cell.some(id => resolvedIds.includes(id))`. | Error | Error (spec only lists `!value` for single_select) | Error | `cell == null \|\| (Array.isArray(cell) && cell.length===0)` | `~`, `!`, `>`, `<` |
| **checkbox** | `value` = `"true"/"1"/"yes"/"checked"/"false"/"0"/"no"/"unchecked"` case-insensitive → `cell === (value truthy)`. For `a,b` (rare) → OR. | Error | Error | Error (or treat as `==`/`!=` only) | `cell == null` (checkbox empty is null, not false) | `~`, `!`, `>`, `<` on checkbox (except `!` is already reserved for select, so checkbox `!` → error too) |
| **date, date_time** | Single `value` ISO → exact date equality (day for `date`, instant for `date_time`). Multi `a,b` → OR. | Error | Error | `>value` / `<value` → `Date.parse(cell) > Date.parse(value)` in **UTC**. If either date invalid → error. | `cell == null \|\| cell === ""` | `~`, `!` |
| **system (auto_number, created_time, modified_time)** | Same as their storage types (number or ISO string). They are filterable (read-only but visible) — `auto_number:>5`, `created_time:<2026-01-01` work per their underlying type. | Depends on underlying kind — but auto_number is number, so `~` → error. | `!` → error. | `>`/`<` allowed. | auto_number never empty; times only empty if data corrupted — treat as `==null` check; for correctness return false. | Same as family |

**Empty keyword vs empty value:** `field:empty` (`op:empty`) and `field:` (`op:eq` with `values:[""]`) both test “empty”, but `field:` also comes from the empty-value syntax. We will treat both as the same predicate (empty check) and record that in `docs/query-grammar.md §6` so printer chooses `field:empty` as canonical.

**Case sensitivity summary:** field names case-insensitive always; text-family value compares case-insensitive; select option name lookup case-insensitive but ID stored is case-sensitive; checkbox values case-insensitive; numbers/dates as typed.

**Unknown field:** if `term.fieldName` not in `fieldsByNormalizedName` → **error**, not silent match-none. Example position copied from term’s `position`. Message: `"Unknown field: \"Foo\""`. This satisfies “type mismatch returns query error, not empty result” — an unknown field is the same class.

**Unresolvable select option name:** e.g., `status:BogusOption` where no option has that name/ID. This is **not** a parse error — it is a filter that matches no rows (`predicate = () => false`) rather than an error, unless strict mode chooses to error. Decision: match-none (not error), so the UI can still show “no rows” without an error banner. Document this in `docs/query-grammar.md §4` as “unknown option name = no match, not an error”.

### 6.4 Reference (naive) evaluator for differential

The spec says “naive reference evaluator (direct loop over rows) vs. compiled evaluator — 10k random queries over FX-M, zero mismatches”.

We implement `referenceEvaluate(ast, rows, fields)` in **test code only** (`tests/query/reference.ts`, not in `src/`). It must be genuinely independent: plain `for (row of rows) { for (term of ast.terms) { if (!matches(term, row, fields)) break; } … }` with straightforward `if/else` per op/type, no closure compilation, no caching, no `getFieldType` indirection (switch on `field.type` directly). This maximizes chance of catching a real bug in the compiled version.

### 6.5 File layout

```
src/query/
  parse.ts       existing from P2-01
  print.ts       existing from P2-01
  evaluate.ts    new — compileTerm / compilePredicate / evaluateQuery
  index.ts       re-exports parse + print + evaluate

tests/query/
  parse.test.ts        from P2-01
  evaluate.test.ts     30 hand-written + type-mismatch + compilation unit tests
  differential.test.ts T-D 10k seeded random queries vs reference over FX-M
  reference.ts         reference evaluator (test-only, not shipped)
  fixtures.ts          FX-M generator (1k rows × 12 cols), seeded PRNG, random query generator
  benchmark-evaluate.test.ts  PERF-2 measurement (optional, or script in scripts/)
```

FX-M generator: deterministic seeded function `generateFXM(seed): { fields: FieldDefinition[], rows: Row[] }` that mirrors `samples/v1/typical.tablify` shape but at 1,000 rows (target scale). Use the same `mulberry32` PRNG as Phase 1 fuzz model tests for reproducibility. The 12 columns cover all user-visible families (text, long, number, currency, percent, checkbox, date, date_time, single_select, multi_select, attachment, url) — system fields auto-generated but also testable.

### 6.6 Verification (from spec, made concrete)

| Spec code | Required | How we will test | Pass condition |
|-----------|----------|------------------|----------------|
| **T-D 10k** | Naive reference vs compiled on 10k random queries over FX-M. Zero mismatches. | `differential.test.ts`: seed=42 constant. Generate `FX-M` once. Loop 10k: generate random AST via `randomQuery(seed++)` → `ast` (by directly building AST, not parsing string, to avoid parser bugs masking evaluator bugs) — plus 50% of queries generated by `parse(randomString)` to also cover printer path. For each query: `refRows = referenceEvaluate(ast, rows, fields)`, `gotRows = evaluateQuery(ast, rows, fields).rows`. Sort both by row ID, compare with `expect(gotIds).toEqual(refIds)`. Mismatches counted; test fails if any. Also assert both sides agree on `ok` vs `error` for type-mismatch queries (error message substring match). | 0 mismatches out of 10k |
| **T-U 30 hand-written** | 30 cases with expected row IDs | `evaluate.test.ts` table: each case has `{ query: string, expectedRowIds: string[] }` built over a small fixed table (e.g., 5 rows with known values). Call `parseQuery(query)` → `evaluateQuery(ast, rows, fields)` → compare. Covers one per operator row, empty, comma-list OR, case-insensitive field name, quoted name, `typeMismatch` expectations, checkbox and date. | 30/30 pass |
| **T-U type mismatch → error** | Every type-mismatch returns an error, not empty set | Explicit table: `{ query:"textField:>5", expectError:/not valid for text/ }`, `{ query:"numField:~foo", expectError }`, `{ query:"singleSelectField:>3" }`, `{ query:"checkboxField:~yes" }`, `{ query:"numField:>notANumber" }`, `{ query:"unknownField:value" }`. Assert `result.ok===false && result.error.message matches`. | All produce `ok:false` |
| **Perf PERF-2** | Filter FX-M <200 ms p95 (proposed, P2-02 + later P3-08) | Benchmark script `scripts/bench-filter.mjs` or `benchmark-evaluate.test.ts`: warm-up 3 runs, then 10 measured runs of `evaluateQuery(ast, fxmRows, fields)` where `ast` is 3–5 terms typical query (`status:Done name:~ship count:>5`). Median & p95 computed. FX-L (10k) also timed and recorded “for information only”. Sandbox numbers reported first; your hardware numbers replace them in `docs/evidence/P2-02.md`. | p95 <200 ms on FX-M if hardware permits; otherwise record and gate still passes but labeled “proposed — exceeds on recorded hardware, owner accepts risk” |
| **Extra (not required but planned)** | Ensure compiled predicate is pure (filter does not mutate rows; order preserved) | Test mutates `Row[]` after filter → original unchanged. Two identical queries produce stable predicate identity (or not, but no state bleed). | Pass |

Example 30 hand-written cases (subset, to be expanded):

```ts
// Small 5-row fixture: rows: Alice Done 5 2026-01-10, Bob Todo 10 2026-02-10, etc.
[
  { query: "",                          expect: ["row_1","row_2","row_3","row_4","row_5"] }, // match-all
  { query: "status:Done",               expect: ["row_1","row_4"] },
  { query: 'Status:done',               expect: ["row_1","row_4"] }, // CI field name
  { query: '"My Field":Done',           expect: ["row_1"] }, // quoted name
  { query: "name:~ali",                 expect: ["row_1"] }, // contains case-insensitive
  { query: "name:~ALICE",               expect: ["row_1"] }, // CI value contains
  { query: "title:a,b",                 expect: ["row_1","row_3"] }, // text containsAny (strict_each)
  { query: "status:a,b",                expect: ["row_1","row_2","row_5"] }, // single isAnyOf
  { query: "tags:urgent",               expect: ["row_1","row_3"] }, // multi contains
  { query: "tags:urgent,backlog",       expect: ["row_1","row_2","row_3"] }, // multi containsAny
  { query: "status:!Done",              expect: ["row_2","row_3","row_5"] }, // not single
  { query: "score:>5",                  expect: ["row_2","row_5"] },
  { query: 'score:<10',                 expect: ["row_1","row_3"] },
  { query: "due:<2026-02-01",           expect: ["row_1","row_3"] }, // date
  { query: "due:>2026-01-15",           expect: ["row_2","row_4","row_5"] },
  { query: "notes:empty",               expect: ["row_5"] },
  { query: "notes:",                    expect: ["row_5"] }, // empty value = empty check
  { query: 'status:Done name:~ship',    expect: ["row_4"] }, // AND across terms
  { query: "status:Done name:~BOB",     expect: [] }, // AND fails
  // type mismatch -> error
  { query: "name:>5",                   expectError: /not valid for text/ },
  { query: "score:~ship",               expectError: /not valid for number/ },
  { query: "score:!5",                  expectError: /not valid for number/ },
  { query: "tags:!urgent",              expectError: /! operator only valid for single/ },
  { query: "done:~yes",                 expectError: /not valid for checkbox/ },
  { query: "due:~2026",                 expectError: /not valid for date/ },
  { query: "ghost:value",               expectError: /Unknown field/ },
  { query: "score:>notANumber",         expectError: /Invalid number/ },
  { query: "title:\"hello world\"",     expect: ["row_3"] }, // quoted value with space
]
```

### 6.7 View integration note (for P3-08 later)

P2-02 does **not** build the filter bar. It does, however, guarantee the printer path so P3-08 can `builderModel → printQuery(ast) → parseQuery(printed) → evaluateQuery(…)`. Acceptance for P2-02 includes that round-trip (`builder → print → parse → evaluate` vs `reference`) is zero-mismatch — but P2-02 itself only tests `parse → evaluate`.

### 6.8 Outputs & acceptance

- **Deliverables:** `src/query/evaluate.ts`, tests including `reference.ts` (test-only), benchmark script.
- **Acceptance:** 0 differential mismatches over 10k, 30 hand cases pass, every type-mismatch yields a `QueryError` (never empty result), PERF-2 measured and recorded (hardware noted; *proposed* until you confirm). No Obsidian imports.

---

## 7. Cross-cutting test fixtures & PERF method

### 7.1 Deterministic PRNG (shared across P2)

Use the same helper as Phase 1’s model-based tests: `mulberry32` seeded with `0x...`. No new dependency (`seedrandom` etc.) introduced — pure function in `tests/query/fixtures.ts`. All random generation (fuzz strings, FX-M rows, random queries) uses this PRNG so runs are reproducible and the 10k differential is stable across CI.

### 7.2 Fixtures

| Fixture | Generator | Size | Use |
|---------|-----------|------|-----|
| `FX-S` small (already in `samples/v1/typical` style) | `makeSmallTable()` 5-row hand table | 5×5 | T-U hand cases (readable row IDs) |
| `FX-M` | `generateFXM(seed)` | 1k×12 | T-D differential, PERF-2 |
| `FX-L` | `generateFXL(seed)` | 10k×12 | Record for information only (PERF-2 note) |
| `FX-RandomString` | `randomQueryString(prng)` 0..200 chars | — | T-F 10k fuzz |

All generated `.tablify` files are validated against `tablify.schema.json` via Ajv — filed as part of fixture tests.

### 7.3 PERF measurement protocol (per `guidelines.md §0.4`)

1. Warm-up 3 runs (not counted, JIT warmup).
2. 10 measured runs.
3. Report **median** and **p95** (sorted middle / 95th percentile).
4. Record hardware: `uname -a`, `node -v`, `npm ls`, CPU/RAM approximation (via `/proc/cpuinfo` in sandbox; user’s specs for gate).
5. Targets marked *proposed* stay labeled *proposed* in evidence. A p95 over-limit does not auto-fail the gate — it requires owner `G-P1` sign-off (“acknowledged”).

### 7.4 Lint/build regression

All steps must keep `npm run lint`, `npm test`, `npm run build` passing. Any failure blocks its own evidence. The plan’s tests run with `npm test` (Vitest `include: tests/**/*.test.ts` already configured in `vitest.config.ts`). No change to CI needed — `npm run check` already covers lint→test→guard→build.

---

## 8. Detailed sequencing & timeline (with Linear IDs)

```
DAY 0 (today) — plan review [this file]
  └─ owner approves grammar decisions + columnOrder addition

DAY 1 — Batch A (parallel)

  Lane A1:  P2-01 (SAD-25) parser + grammar doc
            ├─ draft docs/query-grammar.md + get owner sign
            ├─ implement src/query/parse.ts + print.ts
            ├─ write tests/query/parse.test.ts (40 T-U + 10k fuzz + round-trip)
            ├─ run benchmarks
            ├─ evidence docs/evidence/P2-01.md
            └─ commit & push → Linear SAD-25 → Done (needs code review if required)

  Lane A2:  P2-03 (SAD-27) view state  [independent of A1]
            ├─ update src/model/types.ts (+ columnOrder, warnings)
            ├─ extend tablify.schema.json
            ├─ implement src/model/view.ts
            ├─ extend src/format/{parse,serialize}.ts for view sanitization
            ├─ update samples/v1/typical.tablify & edge.tablify to include columnOrder
            ├─ tests/model/view.test.ts + tests/format/view-persistence.test.ts + T-I vault script
            ├─ evidence docs/evidence/P2-03.md (incl. restart recording)
            └─ commit & push → Linear SAD-27 → Done

DAY 2 — Batch B (after A1 passes)

  Lane B1:  P2-02 (SAD-26) filter engine
            ├─ implement src/query/evaluate.ts (compileTerm / compilePredicate / evaluateQuery)
            ├─ write tests/query/reference.ts (naive evaluator, test-only)
            ├─ write tests/query/evaluate.test.ts (30 hand + type-mismatch)
            ├─ write tests/query/differential.test.ts (10k random vs ref over FX-M)
            ├─ scripts/bench-filter.mjs (PERF-2, FX-M + FX-L informational)
            ├─ evidence docs/evidence/P2-02.md (includes bench table, hardware, mismatch count 0)
            └─ commit & push → Linear SAD-26 → Done

DAY 3 — Gate

  P2 gate note
            ├─ verify all 3 evidence files present
            ├─ rerun `npm run check` (lint, 172+ new tests, build, guard)
            ├─ measure total test count (expected ~ 172 + ~80 new ≈ 250)
            ├─ write docs/gates/phase-2.md (assumption register checked, no S1/S2)
            └─ commit & push → phase gate PASSED → unblock P3-01..P3-11
```

**Critical-path length:** 2 work batches (A then B) + gate. Total hands-on ≈ 2–3 days if owner reviews grammar doc same-day and view restart test finds a desktop vault quickly.

**Why not other orders:** P2-03 cannot finish before P2-02 because `validateView` + serializer changes are orthogonal, but P2-02 cannot finish before P2-01 (AST). So P2-01 must precede P2-02; P2-03 is the only slot that can genuinely parallelize with P2-01.

---

## 9. File change inventory (what this plan would touch when approved)

### 9.1 New files (created)

| Path | Step | Content |
|------|------|---------|
| `docs/query-grammar.md` | P2-01 | Grammar + tokenization + quoting + whitespace + ambiguous-case table + printer rule |
| `src/query/parse.ts` | P2-01 | Tokenizer, parser, `QueryAST`/`QueryError`, `parseQuery` |
| `src/query/print.ts` | P2-01 | `printQuery(ast): string` (may be co-located in `parse.ts` — a single file is also acceptable; plan shows two for clarity) |
| `src/query/index.ts` | P2-01 | Barrel re-export |
| `src/query/evaluate.ts` | P2-02 | Compiled predicates, `evaluateQuery`, `compileTerm`, `compilePredicate` |
| `src/model/view.ts` | P2-03 | `ViewDefinition` helpers, validation, factories |
| `tests/query/parse.test.ts` | P2-01 | T-U 40 + T-F 10k + round-trip |
| `tests/query/print.test.ts` | P2-01 | Or folded into `parse.test.ts` |
| `tests/query/evaluate.test.ts` | P2-02 | 30 hand-written + type-mismatch unit |
| `tests/query/differential.test.ts` | P2-02 | 10k differential over FX-M |
| `tests/query/reference.ts` | P2-02 | Naive reference (test-only) |
| `tests/query/fixtures.ts` | P2-01/02/03 | PRNG, `generateFXM`, `generateFXS`, random string/query generators |
| `tests/model/view.test.ts` | P2-03 | T-U settings + deleted-field + R-D13 + edge cases |
| `tests/format/view-persistence.test.ts` | P2-03 | Save/reload via `parse`/`serialize` with schema validation |
| `scripts/bench-query.mjs` | P2-01 | 1 KB parse <1 ms bench (optional) |
| `scripts/bench-filter.mjs` | P2-02 | PERF-2 bench FX-M & FX-L |
| `docs/evidence/P2-01.md` | P2-01 | Evidence template (commit, env, commands, counts, logs, bench) |
| `docs/evidence/P2-02.md` | P2-02 | Same + differential mismatch table + PERF-2 table |
| `docs/evidence/P2-03.md` | P2-03 | Same + restart video link |
| `docs/gates/phase-2.md` | Gate | Gate note (assumption register, test summary, no S1/S2) |

### 9.2 Modified files

| Path | Step | Change |
|------|------|--------|
| `src/model/types.ts` | P2-03 | Add `columnOrder: string[]` + `warnings?: string[]` to `ViewDefinition` |
| `src/format/parse.ts` | P2-03 | Call `validateView` for each view (drops dangling fieldIds with warnings) |
| `src/format/serialize.ts` | P2-03 | Sanitize views via `sanitizeViewsForSave` before `JSON.stringify` |
| `tablify.schema.json` | P2-03 | Add `columnOrder` (optional), `warnings` (optional) — additive schema change |
| `samples/v1/typical.tablify` | P2-03 | Add `columnOrder` matching field order |
| `samples/v1/empty.tablify` | P2-03 | Add `columnOrder` |
| `samples/v1/edge.tablify` | P2-03 | Add `columnOrder` + edge view with unknown field warning fixture |
| `package.json` | — | No new runtime dependency. Test-only `benchmark` scripts add nothing. |

### 9.3 No-go areas for P2

- `src/main.ts` (no `.tabula` logic added), `src/views/grid/*` (not until Phase 3), `src/sync/*`, `src/io/*`, `src/formula/*`, `src/commands.ts` (undo stays local-only per G-L2 — P2 does not clear the stack).

---

## 10. Evidence & acceptance templates

### 10.1 Per-step evidence file (`docs/evidence/<step>.md`)

Every evidence file follows `spec/guidelines.md §0.1`:

```markdown
# Evidence — <STEP ID> (<Linear ID>)

Commit: <hash>
Date:   <YYYY-MM-DD>
Tester: <name>
Environment: OS, Node, Obsidian version (if T-I), device if mobile
Commands: exact `npm ci` / `npm run lint` / `npm test` / `npm run build` strings and hashes
Test counts: passed/failed/skipped, total
Logs/screenshots: links to test output, benchmark tables, video
Deviations: any AC deviation + reason, or "none"
Performance: measured median/p95 + hardware + proposed-vs-confirmed label
```

### 10.2 Acceptance per step (from `spec/guidelines.md`)

**P2-01 (SAD-25):** ≥40 T-U pass (each operator row + quoted/CI/empty value + errors) + 10k fuzz with 0 throws & every error has valid `position` + round-trip equal + `docs/query-grammar.md` merged + `npm run lint/test/build` pass.

**P2-02 (SAD-26):** 10k differential over FX-M = 0 mismatches + 30 hand cases with expected row IDs pass + every type-mismatch produces `QueryError` (not empty result) + PERF-2 measured & recorded (proposed) + no regressions.

**P2-03 (SAD-27):** per-setting save/reload T-U pass + deleted-field loads without error and warning recorded + restart T-I evidence recorded + R-D13 rejection covered + schema still validates P1 samples after additive change + no regressions.

### 10.3 Phase 2 gate (`docs/gates/phase-2.md`)

```markdown
# Phase 2 Gate — Query and view state
Result: ✅ PASS / ❌ FAIL
Commit: ...
Gate conditions:
1. P2-01..P2-03 accepted with evidence          — PASS/FAIL (+ evidences linked)
2. npm run lint, npm test, npm run build pass  — PASS/FAIL
3. All Phase 1 regression tests still pass     — PASS/FAIL (172 → ~250 total)
4. No open S1/S2 issues                        — PASS/FAIL
5. Assumptions reviewed (UTC, no OR/parens, G-P1 proposed, columnOrder added) — PASS
6. Gate note recorded (this file)             — PASS
Test summary: <table per file>
Assumption register: <copy from spec/phases/P2.md>
Decision: PASS → next is Phase 3 (P3-01 etc.); FAIL → list blockers.
```

### 10.4 Linear workflow

After each step’s evidence is written and pushed:
1. Push commit(s) to `origin/main` (token already set in remote config per Linear project — do **not** remove it from Linear, but **do not** put it in files; use `git push origin main` via the already-authenticated remote).
2. Move Linear issue state: `Backlog → In Progress` at start, `In Progress → Done` after acceptance. If Blocked, set Blocker relation in Linear — but P2 has no Blockers beyond its Depends-on.

---

## 11. Risks & mitigations (P2-specific)

| ID | Risk | Impact on P2 | Mitigation in this plan |
|----|------|--------------|-------------------------|
| R-A1 | Grammar under-spec’d → ambiguous comma or quoting bugs | Parser mismatches with spec table | `docs/query-grammar.md` is reviewed by you **before** code; T-F 10k fuzz + round-trip catches escaping edge cases; spec table §2.6 fully covered in T-U. |
| R-A2 | Type-mismatch errors silenced as “0 rows” | Violates spec §P2-02 #2 (must be error) | `evaluateQuery` returns `ok:false` on any type mismatch; T-U error table explicitly covers every invalid op per family; differential compares `ok` as well as row sets. |
| R-A3 | Column order lost on round-trip (missing `columnOrder`) | P3-07 later breaks | We add `columnOrder` now (your choice), derive on load, and preserve unknown-key safety — plan tested via `typical.tablify` migration case. |
| R-A4 | Differential false green (reference has same bug as compiled) | Zero mismatches but both wrong | Reference written independently: no shared helper functions, direct `switch(field.type)` with brute-force string ops; hand-written 30 cases use manually counted row IDs as third oracle. |
| R-A5 | PERF-2 over-limit on sandbox → gate stalls | Proposed PERF still blocks if treated as hard | Plan labels PERF “proposed” until you confirm; evidence records raw numbers and stays `PASS with owner acceptance` if >200 ms (G-P1). FX-L timing always informational. |
| R-A6 | View with deleted field crashes parse | Spec says “never crash” | `validateView` drops unknowns with warning; T-U with every field-ref location covers this; `parse.ts` never throws on view. |
| R-A7 | Deleting select option requires filter re-evaluation | Stale option ID in saved query | Select delete already clears cells to `null` per P1-06 R-D12; filter with now-unknown option name naturally returns 0 rows (not an error) per §6.3 design — documented. |
| R-A8 | Unicode / locale date parsing diverges | Date filters wrong | Grammar locks to ISO UTC only; inference/normalization is a P4-03 concern, not P2. `reference` and `compiled` both use `Date.parse(UTC)` — same path. |

---

## 12. Detailed code sketch — compileTerm dispatch (illustrative pseudocode, not committed code)

```ts
function makeTextPredicate(term: QueryTerm, field: FieldDefinition): Predicate | QueryError {
  const normalizedValues = term.values.map(v => v.toLowerCase());
  switch (term.op) {
    case 'eq':
      if (term.values.length === 1) {
        const want = normalizedValues[0];
        if (want === "") return row => isEmpty(row.values[field.id]);
        return row => String(row.values[field.id] ?? "").toLowerCase() === want;
      } else { // comma = containsAny (strict_each)
        return row => {
          const cell = String(row.values[field.id] ?? "").toLowerCase();
          return normalizedValues.some(v => v !== "" && cell.includes(v));
        };
      }
    case 'contains':
      return row => String(row.values[field.id] ?? "").toLowerCase().includes(term.values[0].toLowerCase());
    case 'empty':
      return row => isEmpty(row.values[field.id]);
    case 'not': case 'gt': case 'lt':
      return { ok:false, error: { message: `"${term.op}" operator not valid for ${field.type} field "${field.name}"`, position: term.position } };
  }
}
function makeSelectPredicate(term: QueryTerm, field: FieldDefinition, opts: FieldDefinition): Predicate | QueryError {
  const resolve = (name: string) => field.options?.find(o => o.name.toLowerCase() === name.toLowerCase())?.id ?? name;
  switch (term.op) {
    case 'eq': {
      const ids = term.values.map(resolve);
      if (field.type === 'single_select')
        return row => ids.includes(String(row.values[field.id] ?? ""));
      else // multi_select
        return row => Array.isArray(row.values[field.id]) && (row.values[field.id] as string[]).some(id => ids.includes(id));
    }
    case 'not': // single_select only
      if (field.type === 'multi_select') return typeError(term, field);
      return row => String(row.values[field.id] ?? "") !== resolve(term.values[0]);
    case 'empty': return row => isEmpty(row.values[field.id]);
    case 'contains': case 'gt': case 'lt': return typeError(term, field);
  }
}
// numeric, checkbox, date analogous — each family has its own maker with same error-on-mismatch contract.
```

The real implementation will be split per file (`number.ts` logic reused from `fieldTypes/number.ts` parse — but evaluated side does not import UI).

---

## 13. Handoff checklist (what an agent needs before starting code)

- [ ] This plan approved (sign `docs/query-grammar.md` ambiguous table + `columnOrder` addition).
- [ ] Node LTS + `npm ci` works on clean clone (`npm run check` = lint+test+guard+build).
- [ ] `docs/gates/phase-1.md` is `PASS` at `e315176` — verified (done).
- [ ] PRNG helper available (`mulberry32` seeded helper from Phase 1 `tests/model` helpers — copied to `tests/query/fixtures.ts`).
- [ ] Linear token is still in the Linear project (never copied into repo); `git remote -v` shows `origin https://…github.com/258044aamm-Dev/Tablify.git` with stored PAT (no file ever contains it).
- [ ] Benchmark hardware noted for later evidence: sandbox `node -v` + `npx tsc --version` + `uname` at commit time, plus owner hardware for final gate.
- [ ] Obsidian desktop test vault path agreed for the single T-I restart check (P2-03).
- [ ] Decision log review: `G-P1` (PERF proposed) and new `columnOrder` decision recorded after plan approval.

---

## 14. What happens after you approve this plan

1. **We stop being plan-only on your explicit go-ahead.** No commit or push occurs in this plan step.
2. Implementation then follows the sequencing in §8, one step per commit+push (your rule: commit & push after each step). Each commit message is `P2-0X: <title> (SAD-YY)` so Linear links automatically by the SAD reference in the body.
3. After `P2-03`, the Phase 2 gate note closes Phase 2 and unlocks Phase 3 — which this plan does not scope (Phase 3 grid/UI is 11 steps; its own plan will follow after the gate).

---

## Appendix A — Spec operator coverage matrix (used to drive T-U 40)

| # | Pattern | Example | Op | T-U case(s) | P2-01 parser check | P2-02 evaluate check |
|---|---------|---------|----|-------------|--------------------|--------------------|
| 1 | `field:value` | `status:Done` | `eq` single | 1 | parse ok, normalized field, value preserved | single eq per family; select resolves name→ID |
| 2 | `field:~value` | `name:~ship` | `contains` | 1 | op=contains, value | text substring CI; error on numeric/select/date |
| 3 | `field:>n` | `count:>5` | `gt` | 2 (number + date) | op=gt, value raw number | numeric gt + date UTC gt |
| 4 | `field:<n` | `count:<10` | `lt` | 2 | op=lt | symmetric to gt |
| 5 | `field:!value` | `status:!Done` | `not` | 1 | op=not single | single_select only → error otherwise |
| 6 | `field:a,b` | `status:a,b` / `title:a,b` | `eq` multi | 2 (strict_each) | values.length>1 | text containsAny vs select isAnyOf covered separately |
| 7 | `field:empty` | `notes:empty` | `empty` | 1 | op=empty values=[] | null/"" / [] empty check |
| 8 | quoted field | `"My Field":Done` | eq | 1 | quoted parse + outer quotes stripped | lookup via normalized name still works |
| 9 | CI field | `Status:done` | eq | 1 | fieldName lowercased | same map lookup as above |
|10| empty value | `field:` | eq value [""] | 1 | values=[""] distinct from empty kw | treated as empty predicate |
|11| errors | `field` / `:value` / `f:a,,b` / `f:a,` / `"unclosed` | — | ≥5 | each error verifies `position` valid | not reached (parse fails) |

All 40 T-U cases cover the 6 pattern rows × families + the CI/quoted/empty/error supplements required by the spec’s “at least 30”.

---

## Appendix B — Evidence that `commit and push after each step` will be honored

Current `git remote` (from clone):

```
origin  https://github.com/258044aamm-Dev/Tablify.git (fetch)
origin  https://github.com/258044aamm-Dev/Tablify.git (push)
```

Your Linear project note still holds the PAT (`github_pat_11B...` — value omitted from this file per your note, but not removed from Linear). When implementation starts, each step will:

```bash
git add <deliverables>
git commit -m "P2-01: Query parser (SAD-25)

Implements src/query/parse.ts, docs/query-grammar.md, tests.
Closes SAD-25 (backlog → done) via Linear reference."
git push origin main
```

No PAT is ever written to a file or committed. If `push` requires the PAT inline (older credential config), we will configure `credential.helper` to reuse the existing remote credential — not echo the token. **We will not log or record the PAT value anywhere in `docs/` or `git log`.**

---

*End of plan. Awaiting your approval. Once approved, we implement Batch A (P2-01 + P2-03 in parallel), then Batch B (P2-02), then the Phase 2 gate — each followed by a commit & push as requested.*
