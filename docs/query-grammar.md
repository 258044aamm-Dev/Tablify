# Query Grammar — Tablify

**Status:** Authoritative for P2-01
**Linear:** SAD-25 (P2-01)
**Source:** `spec/features.md §2.6` and `spec/guidelines.md P2-01`
**Related:** `src/query/parse.ts`, `src/query/print.ts`

---

## 1. Overview

A query is a filter string typed by the user or emitted by the filter builder. It is parsed into an AST and then compiled into row predicates (see `src/query/evaluate.ts`).

- **Empty/whitespace-only query** → matches all rows (no filter). This is valid and parses to an empty `terms` array.
- **Non-empty query** → zero or more *Terms* separated by whitespace (implicit **AND**). No `OR` across terms, no parentheses, no `NOT` across fields in MVP.
- **Comma inside a term** → **OR** across values within that single field (see §4 for per-type meaning).
- The grammar is **case-insensitive for field names**; value case-sensitivity depends on field type (see §6).

Example:

```
status:Done name:~ship count:>5
```

is three terms (AND): `status equals Done` AND `name contains ship` AND `count greater than 5`.

---

## 2. Tokenization

Tokenization is performed character-by-character (no regex backtracking) over UTF-8 input with LF normalization.

### 2.1 Character classes

- **Whitespace (WS):** ` ` (space), `\t`, `\n`, `\r`. Skipped outside quotes/values; delimits terms.
- **Specials:** `:` (field/value separator), `,` (OR separator inside a value list), `"` (quote delimiter), `~` `!` `>` `<` (unary operators after colon), `empty` (keyword, see §3.5).

### 2.2 Quoting

- **Quoted field name:** `"` + *content* + `"` where *content* is any sequence where an embedded `"` is written as `""` (two double-quotes, CSV-style). This avoids introducing backslash escapes and matches the CSV parser (P4-01) already specified.
  - Example: field name `My "Special" Field` is written as `"My ""Special"" Field":value`.
  - Unclosed quote (missing closing `"`) is an error with `position` at the opening `"`.
  - Empty quoted name `""` is an error (`Empty field name`).

- **Quoted value:** same rule: `"` + *content* + `"` with `""` → `"` inside.
  - Keeps spaces and commas literally: `field:"hello, world"` → one value `hello, world` (not two).
  - `field:"a,b"` (quoted comma) is one value `a,b`; `field:a,b` (unquoted comma) is two values `a` OR `b`.
  - Empty quoted value `""` → one value `""` (empty string). Distinct from the `field:` empty-value syntax (see §3.6) but evaluates identically.
  - Unclosed value quote is an error at its opening `"`.

- **Quote escaping:** only `""` is recognized. Backslash `\"` is **not** an escape — it is a literal backslash followed by a quote, and will likely cause an unclosed-quote error if misused. This is intentional to keep the grammar small.

### 2.3 Whitespace rules

- **Around `:`** — whitespace is allowed and ignored: `field : value` is the same as `field:value`. After a quoted field name, whitespace between the closing `"` and `:` is also ignored (e.g., `"My Field" : value`).
- **Around `,`** — whitespace around commas inside a value list is ignored and trimmed: `field:a, b` → values `["a","b"]` (same as `field:a,b`).
- **Inside quotes** — whitespace is preserved literally (not trimmed, not a delimiter).
- **Between terms** — one or more WS delimits terms. No other delimiter.

---

## 3. Grammar (EBNF)

```ebnf
Query      := WS* (Term (WS+ Term)*)? WS*
Term       := FieldRef ":" WS* TermBody
FieldRef   := QuotedField | UnquotedField
QuotedField   := '"' ( '""' | [^"] )* '"'
UnquotedField := [^ \t\n\r:,"]+          (* no WS, colon, comma, quote; also no ~!>< before colon *)

TermBody   := EmptyKeyword
            | ContainsOp
            | NotOp
            | GtOp
            | LtOp
            | ValueList
            | EmptyValue                 (* field: with nothing after colon *)

EmptyKeyword := "empty"i                 (* case-insensitive, unquoted, terminated by WS/EOF *)
ContainsOp   := "~" WS* Value
NotOp        := "!" WS* Value
GtOp         := ">" WS* Value
LtOp         := "<" WS* Value
ValueList    := Value ( WS* "," WS* Value )*
Value        := QuotedValue | UnquotedValue
QuotedValue  := '"' ( '""' | [^"] )* '"'
UnquotedValue:= [^ \t\n\r,"]+            (* no WS, comma, quote; colon not allowed unquoted in value *)

EmptyValue   := (* no Value, e.g. "field:" at EOF or before WS *) (* represented in AST as op=eq values=[""] *)
```

Notes:

- `EmptyKeyword` (`empty`) is recognized **only** when it appears unquoted immediately after `:` (with optional WS) and is followed by WS/EOF (not by `,`). `field:"empty"` (quoted) is a normal value `"empty"`, not the keyword.
- Operators `~ ! > <` consume **exactly one** `Value`. `field:>a,b` is **not** a ValueList — the `,` after the value is an error (`Comma not allowed after '>' operator`). MVP has no per-value operators.
- `ValueList` with a single element is still `op=eq values=[one]`. Comma is the only OR syntax.
- An unquoted value may not contain `:` (must be quoted to include a colon). This prevents `value:with:colon` from being parsed as a field separator.

---

## 4. Comma semantics & ambiguous case resolution

`field:a,b` always means **OR** across the comma-list. The inner match depends on field type (resolved at evaluation time, see `src/query/evaluate.ts`), but the parser records the list verbatim. The choice `strict_each` (owner-approved 2026-10-09) is:

| Input | Text-family (text, long_text, url, email, phone, attachment) | multi_select | single_select | Numeric / date / rating / currency / percent / duration | Checkbox |
|-------|---------------------------------------------------------------|--------------|---------------|----------------------------------------------------------|----------|
| `f:a,b` | **containsAny** — cell string case-insensitive contains `a` **or** contains `b` (substring OR) | **containsAny** — `cell` array contains `a` **or** `b` (exact option ID OR) | **isAnyOf** — `cell === a` **or** `cell === b` (exact ID OR) | `equals a OR equals b` (exact numeric/date match OR) | `equals a OR equals b` (boolean OR, rarely used) |
| `f:"a,b"` | contains literal `"a,b"` | is `"a,b"` | is `"a,b"` | equals `"a,b"` → evaluate error (invalid number) | — |
| `f:empty` | `cell == null \|\| cell === ""` | `cell == null \|\| []` | `cell == null \|\| ""` | same empty check | `cell == null` |
| `f:` (empty value `""`) | same as `empty` (treated as empty predicate) | same | same | same | same |

Rationale and spec note:

- Both `containsAny` (text) and `isAnyOf` (select) are OR, but text does **substring** match per term while selects do **exact option-ID** match. This matches the spec table row `field:a,b → is any of / contains any`.
- A text field `field:value` (single, no comma) is **exact case-insensitive equality**; the substring form is `field:~value`. However `field:a,b` on text uses *contains* per element — this is the documented ambiguity: the comma-list for text is broadened to `containsAny` (not exact). Example: `title:ship,boat` matches any row whose title contains `ship` or contains `boat`.
- For select fields, `field:a,b` resolves each `a`/`b` to an option ID by case-insensitive name lookup (exact name) before comparison. An unknown option name matches no rows (not an error) except at the filter-engine layer where a type mismatch would already be an error.
- Quoted `field:"a,b"` preserves the comma literally, so `a,b` is one value, not two. Use quotes when the comma is part of the sought value.

---

## 5. Whitespace & quoting details (examples)

| Input | Parsed as | Notes |
|-------|-----------|-------|
| `field:value` | `eq ["value"]` | baseline |
| `field : value` | `eq ["value"]` | WS around `:` ignored |
| `"My Field":Done` | `eq ["Done"]` on normalized field `my field` | quoted field with space |
| `"My Field" : Done` | same | WS between `"` and `:` also ignored |
| `field:"hello world"` | `eq ["hello world"]` | space inside quoted value preserved |
| `field:"a,b"` | `eq ["a,b"]` one value | quoted comma not OR |
| `field:a, b` | `eq ["a","b"]` | WS around `,` trimmed |
| `field:a ,b` | same | |
| `field: "hello"` | `eq ["hello"]` | WS after `:` before quoted value ignored |
| `field:~ "ship"` | `contains ["ship"]` | WS after `~` ignored |
| `field:> 5` | `gt ["5"]` | WS after `>` ignored |
| `field:empty` | `empty` | keyword |
| `field:Empty` | `empty` | case-insensitive keyword |
| `field:"empty"` | `eq ["empty"]` | quoted → value, not keyword |
| `field:` | `eq [""]` | empty value ↔ empty predicate at evaluate |
| `field: ` (trailing WS) | `eq [""]` | same |
| `"a ""quoted"" name":value` | field raw `a "quoted" name` | doubled quotes |

---

## 6. Comparison semantics by type (summary; details in `src/query/evaluate.ts`)

- **Text-family:** `:` = equals case-insensitive exact; `~` = substring case-insensitive; `:a,b` = containsAny via OR; `:empty` / `field:` = empty. Operators `> < !` on text → evaluate error.
- **Selects:** `:` = is/contains exact ID (single) or contains any ID (multi) via resolved option IDs; `!` = single_select only (`is not`); `:a,b` = isAnyOf/containsAny; `~ > <` → error.
- **Numeric/date/rating/currency/percent/duration:** `:` = equals numeric/date; `>` `<` = compare after coercion; `~ !` → error. Non-numeric value for `>`/`<` → evaluate error. Dates use **UTC** (`Date.parse` → UTC instant).
- Unknown field name → **evaluate error**, not empty result (type-mismatch family).
- Unknown select option name (e.g., `status:Bogus`) → matches **no rows** (predicate `false`), not a parse/evaluate error, so the UI shows “no results” without an error banner.

---

## 7. Errors

Every error is returned as `{ ok: false, error: { message, position, line, column } }` and **never thrown**. `position` is a 0-based character offset (as `spec/guidelines.md P2-01` requires). `line`/`column` are 1-based helpers.

| Situation | Example | `position` | Message |
|-----------|---------|------------|---------|
| Missing `:` after field | `field` | 5 (EOF) | `Expected ':' after field name "field"` |
| Empty field name | `:value` | 0 | `Empty field name` |
| Unclosed quote — field | `"unclosed:foo` | 0 | `Unclosed quote in field name` |
| Unclosed quote — value | `f:"unclosed` | 2 (opening `"`) | `Unclosed quote in value` |
| Invalid char in unquoted field | `f,oo:val` / `f"oo:val` | index of `,`/`"` | `Invalid character ',' in field name` |
| Trailing comma | `f:a,` | 3 | `Trailing comma in value list` |
| Double comma | `f:a,,b` | 3 | `Unexpected ',' in value list` |
| Missing value after operator | `f:>`, `f:~`, `f:!`, `f:<` | after operator | `Expected value after '>'` |
| Comma after unary op | `f:>5,6` / `f:~a,b` | index of `,` | `Comma not allowed after '>' operator` |
| Unexpected `:` in unquoted value | `f:val:ue` without quotes | index of `:` | `Unexpected ':' in value — quote the value if it contains ':'` |

All errors obey `0 ≤ position ≤ input.length`.

---

## 8. Printer (canonical)

`printQuery(ast): string` emits minimal quoting:

- **Field:** quote if it contains WS, `:`, `,`, `"`, `~!><` or is empty / starts with digit. Quote content escapes `"` as `""`.
- **Value:** quote if it contains WS, `,`, `:`, `"`, or is `""` (empty string inside a list is represented as `""`, but `field:` empty value prints as `field:` with nothing, not `field:""`).
- **Empty vs empty value:**
  - `op=empty` → `field:empty`
  - `op=eq values=[""]` (sole empty string) → `field:` (no value). The parser distinguishes them but the evaluator treats both as “empty”; the printer preserves the distinction.

The printer is the path the filter builder (future `P3-08`) will use: `builderModel → printQuery → parseQuery → evaluateQuery`. `print-then-parse` round-trip must yield a structurally equal AST (ignoring `raw`, `rawInput`, and `position`).

---

## 9. Ambiguous cases table (recap — owner-approved strict_each)

| Input | Text | multi_select | single_select | number/date |
|-------|------|--------------|---------------|-------------|
| `f:a,b` | contains `a` OR contains `b` | contains `a` OR contains `b` (array) | `=== a` OR `=== b` | `=== a` OR `=== b` |
| `f:"a,b"` | contains `a,b` literally | is `a,b` literally | is `a,b` literally | `=== "a,b"` → type error at evaluate |
| `f:empty` | empty | empty | empty | empty |
| `f:` | empty (same as above) | empty | empty | empty |
| `f:""` | exact `""` (also empty at evaluate) | — | — | — |
| `f:~a,b` | error (comma after `~`) | error | error | error — `~` takes one value |
| `f:>5,10` | error (comma after `>`) | — | — | error — use two terms `f:>5 f:<10` for range (future builder could emit two terms) |

---

## 10. Performance note

The parser is a single-pass scanner over the input (`O(n)`). No regex backtracking. A 1 KB query (approx. 40 terms) parses in <1 ms (proposed, per `guidelines.md P2-01`). The reference benchmark in `tests/query/parse.test.ts` records median/p95 on sandbox and on the owner’s machine.

---

## 11. Decisions recorded (vs. roadmap defaults)

- Quote escaping: `""` (doubled) — matches P4-01 CSV parser, no backslashes introduced.
- Whitespace around `:` and `,` is allowed and normalized away.
- Field name normalization: `trim().toLowerCase()` (Unicode preserved).
- `field:empty` vs `field:` distinct at parser, both map to empty predicate at evaluate; printer keeps `field:empty` canonical for readability but `field:` round-trips faithfully.
- Comma semantics: `strict_each` as above.
- `field:>5` with comma list is an error (MVP has no per-value ops).

This document is the source of truth for P2-01; if `spec/features.md §2.6` disagrees, this file wins for implementation details and is kept in sync with it.
