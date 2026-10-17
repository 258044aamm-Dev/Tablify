# COD-68 — the `date_time` editor shows the stored timestamp and stops deleting it

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` · **Issue:** [COD-68](https://linear.app/code-bro/issue/COD-68) (Bug, Urgent)
**Found by:** the all-fields verification after COD-66 (`docs/plans/all-fields-verification-plan.md` §4 F1/F5).

## Symptom

A `date_time` cell holding a timestamp opened **blank**, and clicking away **deleted the value**:

```
date_time before:                   "2026-10-16T09:30:00.000Z"
editor (double-click or Enter):     { type: "date", value: "" }   ← invisible
after click away (blur commits):    null                          ← value destroyed
```

Reproduced through **Enter** as well as double-click, so it predates COD-66. `date` cells through
the same path were unaffected.

## Root cause

`src/views/grid/editors/index.ts` gave **both** `date` and `date_time` an `<input type="date">`,
while `dateTimeType.format()` returns a full ISO string. A `type=date` input rejects an ISO
timestamp, so it rendered empty; the blur-commit then read `''`, `dateTimeType.parse('')` returned
`null`, and the command wrote `null` over the stored value. There was also no way to enter a time,
even though `date_time` is offered by the Add Field modal (`TYPE_GROUPS` → `['date', 'date_time']`).

A second, related defect: an unset `checkbox` (`null`) was written as an explicit `false` when the
cell was merely opened and dismissed.

## Fix (`src/views/grid/editors/index.ts`)

| Change | Detail |
|---|---|
| `date_time` editor element | `<input type="datetime-local" step="1">` — was `<input type="date">` |
| Editor value | `toLocalDateTimeInput()` converts the stored ISO UTC instant to the local wall-clock string the input requires |
| Stored format | **unchanged** — commits still go through `dateTimeType.parse()` → `toISOString()`, so the file stays ISO 8601 UTC and Airtable sync is untouched |
| No-op guard | `isUnchanged()`: a `date_time` whose local representation did not change writes nothing (browsers may drop seconds or milliseconds, so string equality is not enough); a `checkbox` compares `Boolean(old) === Boolean(new)`, so `null` stays `null` |
| `date` | unchanged: still `<input type="date">`, still `YYYY-MM-DD` |

## Verification

### Unit — `tests/views/grid/dateTimeEditor.test.ts` (10 tests, red first)

6 failed on the previous `main`; all 10 pass after:

- the editor is `datetime-local` and shows the **same instant** as the stored value ✔
- open + blur, and open + Enter, leave the value untouched (no command executes) ✔
- a value carrying milliseconds survives being opened (no lossy rewrite) ✔
- a changed timestamp is stored as ISO 8601 UTC ✔
- `date` keeps `type=date`, shows `YYYY-MM-DD`, and commits a change ✔
- checkbox: unset stays unset, set stays set, toggling commits ✔

Full gate: `npm run check` — lint **0 errors**, **112 files / 1670 tests** (was 111 / 1660; no
existing test weakened), `.tabula` guard, docs links, FA icons, build. `main.js` rebuilt in the
same commit.

### Browser — Chromium, production `TableView`

| Check | Result |
|---|---|
| Editor type / step / shown value | `datetime-local`, step `1`, `2026-10-16T15:30` for `09:30Z` in Asia/Dhaka ✔ |
| Enter + click away leaves the value | `"2026-10-16T09:30:00.000Z"` unchanged ✔ |
| Edit `2026-12-24T18:45` (Dhaka) → stored | `"2026-12-24T12:45:00.000Z"` — correct UTC ✔ |
| `date` cell through the same path | `"2026-10-16"` unchanged ✔ |
| Checkbox `null` after open + dismiss | still `null` ✔ |

Timezone note: the stored value is UTC and the editor works in the host's local time — the same
model Airtable uses. No file-format change, so nothing else in the app needs to know.

## Blast radius

One file, `src/views/grid/editors/index.ts`, three small changes (initial value, input type, the
no-op guard). Every other field type keeps `<input type="text">`/`textarea`/checkbox and the
previous `String(old) === String(new)` comparison, verified by the untouched suites for editors,
validation, clipboard and export. `format()` is unchanged, so copy/export/query output is
identical.
