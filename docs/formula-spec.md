# Formula specification (P8-01)

**Status:** APPROVED (owner, 2026-10-10: "Proceed and execute"). The §12 items were accepted as proposed. The engine (P8-02) may now be built against this spec (roadmap §11, Release 2.0).
**Linear:** SAD-60. **Golden cases:** `tests/formula/golden.cases.ts` (not executed against the engine yet).
**Decisions applied:** D-O1 = Airtable-like function set. Date and time functions use the viewer's local time zone. Formula results are not stored in the file.

---

## 1. Scope

- A formula field computes a value from other fields **in the same row**.
- Lookups, rollups, and cross-row references are **out of scope**.
- Formulas are read-only in the grid (P8-03).
- Formula text is saved in the field definition. Results are computed on load and after each edit. They are not written to the file.

## 2. Syntax

| Element | Form | Notes |
|---|---|---|
| Field reference | `{Field name}` | Exact, case-sensitive match on the field's display name in the same table. Inside braces, `\}` is a literal `}` and `\\` is a literal `\`. |
| Function call | `NAME(arg, arg, ...)` | Function names are case-insensitive. `sum(1,2)` = `SUM(1,2)`. |
| Number literal | `12`, `0.5`, `100.25` | Decimal only. No exponent. A leading digit is required (`0.5`, not `.5`). |
| Text literal | `"text"` | Escapes: `\"` and `\\` only. A raw line break is not allowed. |
| Boolean literal | `TRUE`, `FALSE` | Case-insensitive. |
| Grouping | `( … )` | |
| Whitespace | Ignored outside text literals and field names. | |

Limits: formula length 2,000 characters; nesting depth 50; 30 arguments per call. Exceeding a limit is a parse error (`#PARSE!`).

## 3. Operators and precedence

From highest to lowest. All binary operators are left-associative unless stated.

| Level | Operators | Notes |
|---|---|---|
| 1 | `( )` | |
| 2 | unary `-` | Binds **looser** than `^`: `-2^2` = `-4`. |
| 3 | `^` | Left-associative: `2^3^2` = `64`. |
| 4 | `*`, `/` | `/` by zero → `#DIV/0!`. |
| 5 | `+`, `-` | |
| 6 | `&` | Text concatenation. |
| 7 | `=`, `!=`, `<`, `<=`, `>`, `>=` | Non-associative: `1<2<3` is `#PARSE!`. |

## 4. Types

| Type | Meaning |
|---|---|
| number | Finite IEEE-754 double. A result that is not finite is `#OVERFLOW!`. |
| text | Unicode string. |
| boolean | `TRUE` or `FALSE`. |
| date | Calendar date with no time (`YYYY-MM-DD`). |
| datetime | A moment. Date and time functions use the viewer's local time zone. |
| blank | The absence of a value. |
| error | One of the error values in §7. An error is a value, not an exception. |

### 4.1 Field value mapping

| Tablify field type | Value in a formula |
|---|---|
| text, long_text, url, email, phone | text |
| single_select | text (option name) |
| multi_select | text: option names joined with `", "` in stored order |
| number, currency, rating, auto_number | number |
| percent | number as stored (60 means 60%) |
| duration | number of minutes |
| checkbox | boolean. Never blank: unchecked is `FALSE`. |
| date | date |
| date_time, created_time, modified_time | datetime |
| formula | the formula's result type |
| attachment, link | `#VALUE!` when referenced (not usable in v2) |
| empty cell | blank |

## 5. Blank (null) handling

- **Arithmetic** (`+ - * / ^`, unary `-`, numeric functions): blank counts as `0`.
- **Text** (`&`, text functions): blank counts as `""`.
- **Logic** (`IF`, `AND`, `OR`, `NOT`, `XOR`): blank counts as `FALSE`.
- **Comparison:** blank is compared as the zero value of the other operand's type: `0` for numbers, `""` for text, `FALSE` for booleans. Blank compared with a date or datetime is `#VALUE!`. Blank compared with blank is `TRUE`.
- **Result:** a formula may return blank. It displays as an empty cell.

## 6. Conversion

- **No implicit text-to-number conversion.** `"3" + 1` is `#VALUE!`. Use `VALUE()`.
- **Number to text:** decimal notation, at most 15 significant digits, no trailing zeros, no thousands separator, no exponent. `-0` becomes `0`.
- **Boolean to text:** `TRUE` or `FALSE`.
- **Date to text:** `YYYY-MM-DD`. **Datetime to text:** `YYYY-MM-DD HH:mm` (local time).
- **Date and datetime:** a date compared with a datetime is treated as that day at local `00:00`.
- **Mixed-type comparison** (for example number with text) is `#VALUE!`. `=` between different types is `FALSE`, except blank rules in §5.

## 7. Error values

Errors are values. They propagate: an operation or function returns the **leftmost** error among its arguments. Errors in unevaluated branches (§8) are ignored.

| Error | Meaning |
|---|---|
| `#PARSE!` | Syntax error, or a parse limit (§2) exceeded. |
| `#NAME?` | Unknown function name or unknown field name. |
| `#ARGS!` | Wrong number of arguments. |
| `#TYPE!` | A field type that cannot be used in a formula (attachment, link). |
| `#VALUE!` | Wrong type, failed conversion, invalid unit, invalid date text. |
| `#DIV/0!` | Division by zero, `MOD` by zero, `AVERAGE` of no numbers, `0^-1`. |
| `#NUM!` | Domain error: `SQRT` of a negative, negative counts, `ROUND` digits outside -15..15, non-integer power of a negative base, positions out of range. |
| `#OVERFLOW!` | Result not finite, or text longer than 100,000 characters. |
| `#CYCLE!` | Circular reference (§9). |

## 8. Evaluation order

- Binary operators evaluate the **left** operand, then the **right**.
- Function arguments evaluate **left to right**.
- `IF`, `AND`, `OR`, `SWITCH` are **lazy**. They stop as soon as the result is decided. An error met before the decision is returned. An error after the decision is never evaluated.
- No side effects and no randomness. `TODAY()` and `NOW()` read the clock once per recalculation pass.

## 9. Cycles

- Dependencies are resolved **per table, per field** (formulas reference same-row fields, so a cycle is the same in every row).
- A cycle is a loop in the field-reference graph among formula fields, including a formula that references itself.
- **Detection:** when a formula is saved in the field editor, and when a table loads.
- **Result:** every formula field on the loop returns `#CYCLE!` in every row. The field editor shows the loop path. The file still saves and opens.
- No crash, no partial value.

## 10. Function reference

Signatures use `[optional]` for optional arguments and `...` for repeated arguments. "Returns" is the result type.

### 10.1 Numeric (15)

| Function | Signature | Returns | Behavior |
|---|---|---|---|
| ABS | `ABS(n)` | number | Absolute value. |
| ROUND | `ROUND(n, [digits=0])` | number | Half away from zero. `digits` integer in -15..15, else `#NUM!`. |
| ROUNDUP | `ROUNDUP(n, [digits=0])` | number | Away from zero. |
| ROUNDDOWN | `ROUNDDOWN(n, [digits=0])` | number | Toward zero. |
| CEILING | `CEILING(n)` | number | Smallest integer ≥ n. |
| FLOOR | `FLOOR(n)` | number | Largest integer ≤ n. |
| INT | `INT(n)` | number | Same as `FLOOR(n)`. |
| MOD | `MOD(n, m)` | number | `n - m * FLOOR(n / m)`. The result has the sign of `m`. `m = 0` → `#DIV/0!`. |
| POWER | `POWER(a, b)` | number | Same as `a ^ b`. |
| SQRT | `SQRT(n)` | number | `n < 0` → `#NUM!`. |
| MIN | `MIN(n, ...)` | number | Numbers only. Blank arguments ignored. No numbers → blank. |
| MAX | `MAX(n, ...)` | number | Same rules as MIN. |
| SUM | `SUM([n, ...])` | number | Blank ignored. No numbers → `0`. Text argument → `#VALUE!`. |
| AVERAGE | `AVERAGE(n, ...)` | number | Blank ignored. No numbers → `#DIV/0!`. |
| COUNT | `COUNT(v, ...)` | number | Counts arguments that are numbers. Text, boolean, date, blank are not counted. Errors propagate. |

### 10.2 Text (14)

| Function | Signature | Returns | Behavior |
|---|---|---|---|
| CONCATENATE | `CONCATENATE(v, ...)` | text | Same as `&` across arguments. |
| LEN | `LEN(s)` | number | Count of Unicode code points. |
| LOWER | `LOWER(s)` | text | Unicode default lowercase, locale-independent. |
| UPPER | `UPPER(s)` | text | Unicode default uppercase, locale-independent. |
| TRIM | `TRIM(s)` | text | Removes leading and trailing spaces (U+0020) and collapses inner runs to one space. |
| LEFT | `LEFT(s, [n=1])` | text | First `n` code points. `n < 0` → `#NUM!`. |
| RIGHT | `RIGHT(s, [n=1])` | text | Last `n` code points. `n < 0` → `#NUM!`. |
| MID | `MID(s, start, n)` | text | 1-based. `start < 1` or `n < 0` → `#NUM!`. Past the end → shorter result. |
| FIND | `FIND(needle, hay, [start=1])` | number | Case-sensitive. 1-based index of the first match at or after `start`. Not found → `0`. `start` outside 1..len+1 → `#NUM!`. Empty needle returns `start`. |
| SEARCH | `SEARCH(needle, hay, [start=1])` | number | As FIND, case-insensitive (Unicode lowercase on both sides). |
| SUBSTITUTE | `SUBSTITUTE(s, old, new)` | text | Replaces every non-overlapping occurrence, left to right. Empty `old` returns `s`. |
| REPLACE | `REPLACE(s, start, count, new)` | text | 1-based. `start > len` appends `new`. `start < 1` or `count < 0` → `#NUM!`. |
| REPT | `REPT(s, n)` | text | `n` integer ≥ 0 (fraction truncated). Negative → `#NUM!`. Over 100,000 characters → `#OVERFLOW!`. |
| VALUE | `VALUE(s)` | number | Parses an optional sign, digits, and an optional decimal point. Surrounding spaces are trimmed. No separators or exponent. Otherwise `#VALUE!`. A number argument returns itself. |

### 10.3 Logic (7)

| Function | Signature | Returns | Behavior |
|---|---|---|---|
| IF | `IF(cond, a, [b])` | any | `cond` boolean, number (non-zero is `TRUE`), or blank (`FALSE`). Other types → `#VALUE!`. Missing `b` → blank. Lazy. |
| AND | `AND(v, ...)` | boolean | Each argument as a boolean: boolean as is, number (non-zero is `TRUE`), blank (`FALSE`). Other types → `#VALUE!`. Stops at the first `FALSE`. |
| OR | `OR(v, ...)` | boolean | Each argument as a boolean (same rules as AND). Stops at the first `TRUE`. |
| NOT | `NOT(v)` | boolean | Negation of the boolean value (same argument rules as AND). |
| XOR | `XOR(a, b)` | boolean | Exactly one of `a`, `b` is `TRUE`. |
| SWITCH | `SWITCH(x, v1, r1, ..., [default])` | any | Returns `r_i` for the first `v_i` equal to `x` (§3 `=` rules). No match: `default` if given, else blank. Lazy. Needs at least 3 arguments. |
| BLANK | `BLANK()` | blank | The blank value. |

### 10.4 Date and time (15)

Date and time functions use the viewer's **local** time zone (owner decision). The same file can show different results on machines in different zones. Date-only values have no time zone.

| Function | Signature | Returns | Behavior |
|---|---|---|---|
| DATE | `DATE(text)` | date | `"YYYY-MM-DD"` only, with a valid calendar date. Otherwise `#VALUE!`. |
| TODAY | `TODAY()` | date | Local date at evaluation time. |
| NOW | `NOW()` | datetime | Local datetime at evaluation time. |
| DATEADD | `DATEADD(d, n, unit)` | date or datetime | `n` integer (fraction truncated). `unit`, case-insensitive: `days`, `weeks`, `months`, `years`, `hours`, `minutes`, `seconds`. Months and years clamp the day to the end of the target month (Jan 31 + 1 month = Feb 28 or 29). Hours, minutes, seconds on a date → datetime. Other units → `#VALUE!`. |
| DATETIME_DIFF | `DATETIME_DIFF(a, b, unit)` | number | `a - b` in whole units, truncated toward zero. Units as DATEADD. Days and weeks use calendar dates. Months: the number of whole months `m` such that adding `m` months to `b` (clamped, §DATEADD) does not pass `a`, with the sign of `a - b`. Years are the same with years. |
| IS_BEFORE | `IS_BEFORE(a, b)` | boolean | `a < b`. Date vs datetime per §6. |
| IS_AFTER | `IS_AFTER(a, b)` | boolean | `a > b`. |
| YEAR | `YEAR(d)` | number | Calendar year. |
| MONTH | `MONTH(d)` | number | 1..12. |
| DAY | `DAY(d)` | number | 1..31. |
| WEEKDAY | `WEEKDAY(d)` | number | ISO: 1 = Monday, …, 7 = Sunday. |
| HOUR | `HOUR(dt)` | number | 0..23. Date input → `0`. |
| MINUTE | `MINUTE(dt)` | number | 0..59. Date input → `0`. |
| SECOND | `SECOND(dt)` | number | 0..59. Date input → `0`. |
| DATETIME_FORMAT | `DATETIME_FORMAT(d, pattern)` | text | Tokens: `YYYY`, `MM` (month), `DD`, `HH`, `mm` (minutes), `ss`. Other characters are literal. Date input uses `00:00:00`. |

### 10.5 Record (3)

| Function | Signature | Returns | Behavior |
|---|---|---|---|
| RECORD_ID | `RECORD_ID()` | text | The row's stable ID. |
| CREATED_TIME | `CREATED_TIME()` | datetime | The row's `createdTime`. |
| LAST_MODIFIED_TIME | `LAST_MODIFIED_TIME()` | datetime | The row's `modifiedTime`. |

Total: **54 functions** (15 numeric, 14 text, 7 logic, 15 date and time, 3 record).

## 11. Golden cases

- Golden cases live in `tests/formula/golden.cases.ts`. Each case has an id, a function group, the formula, the input fields, the context (`now`, row id, created and modified times), and the expected result.
- **Minimum:** at least 3 cases per function, plus core cases for operators, blanks, errors, and evaluation order.
- **Time zone for tests:** `Asia/Dhaka` (UTC+6, no DST), so datetime cases are stable.
- **Review:** the owner reviews each case for an unambiguous expected value. Cases are not yet run against the engine (P8-02).

## 12. Review decisions (accepted as proposed)

1. **Field rename (accepted):** formulas reference names. Proposal: renaming a field rewrites matching `{references}` in every formula in that table, in one command (undo-able). Confirm.
2. **Formula that references a link field (accepted)** (in v2 the link value is `#VALUE!`, §4.1). Confirm this is acceptable for v2.
3. **Result storage (accepted):** results are not stored in the file.
4. **Function list (accepted):** the 54 functions in §10.
5. **Error text (accepted):** the tooltip shows the code and a one-line reason (P8-03).

## 13. Acceptance for P8-01

- Owner approved this spec on 2026-10-10 ("Proceed and execute").
- Golden case count: 204 (178 function cases for 54 functions, 26 core).
- Golden cases match the spec with no ambiguous expected value.
