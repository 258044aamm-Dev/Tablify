# All-field-type verification after COD-66

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` · **Context:** [COD-66](https://linear.app/code-bro/issue/COD-66) (double-click editing) and the follow-up it uncovered, [COD-68](https://linear.app/code-bro/issue/COD-68) (`date_time` editor).
**Question:** after the double-click fix, is editing still correct for **every** field type, and does anything else misbehave?

**Answer:** yes for all 21 registered types; one pre-existing bug was found (`date_time`, fixed in COD-68) and two known gaps were re-confirmed. The whole matrix now runs as `npm run test:fields`.

---

## 1. How to reproduce this document

```bash
npm run test:fields      # boots Chromium, mounts the production TableView, prints the matrix
```

`tests/e2e/fieldTypes.browser.ts` — 77 checks, exit code 1 on any failure. Not part of
`npm test`: it needs Chromium and ~19 s, so it stays a deliberate pre-release / after-a-grid-change
run. The harness is the same one the visual-parity suite uses (`tests/visual/lib/harness.ts`), so
this is the real `TableView` with the real `startEdit`, `createEditor`, select/attachment panels,
command stack and `getViewData()`.

Fixture: one `.tablify` document (format v2) with **one column per registered type**, two rows —
row 0 empty (the edit target), row 1 pre-populated (the "existing value" checks).

---

## 2. Editing matrix — 21/21

Values are read back from `getViewData()`, i.e. what actually lands in the file.

| Field type | Double-click opens | Commit stores | Escape |
|---|---|---|---|
| `text` | inline editor | `"Hello world"` | keeps value |
| `long_text` | inline editor (textarea) | `"Line one"` | keeps value |
| `number` | inline editor | `42.5` | keeps value |
| `currency` | inline editor | `123456` (minor units) | keeps value |
| `percent` | inline editor | `0.25` | keeps value |
| `duration` | inline editor | `90000` (ms) | keeps value |
| `rating` | inline editor | `7` | keeps value |
| `checkbox` | inline editor (checkbox) | `true` | keeps value |
| `date` | inline editor (`type=date`) | `"2026-10-17"` | keeps value |
| `date_time` | inline editor (`datetime-local`) | ISO 8601 UTC instant | keeps value |
| `url` | inline editor | `"https://example.com/a"` | keeps value |
| `email` | inline editor | `"user@example.com"` (lower-cased) | keeps value |
| `phone` | inline editor | `"+880 1712-345678"` | keeps value |
| `single_select` | select panel | `"opt_a"` | panel closes |
| `multi_select` | select panel | `["opt_a","opt_b"]` | panel closes |
| `attachment` | attachment panel | panel + vault-path check | panel closes |
| `auto_number` | **nothing** (read-only) | — | — |
| `created_time` | **nothing** (read-only) | — | — |
| `modified_time` | **nothing** (read-only) | — | — |
| `formula` | **nothing** (read-only) | — | — |
| `link` | row picker (Modal) | covered by `tests/views/linkPicker.test.ts` | — |

`link` shows as "nothing" in the browser check because the Obsidian mock never attaches a `Modal`
to the DOM; the picker's contents and save path are covered by 9 unit tests.

Also verified: the four read-only types refuse **both** double-click and right-click; invalid input
(`number "abc"`, `url "not-a-url"`, `email "nope"`) keeps the editor open with
`aria-invalid="true"` and writes nothing.

---

## 3. Findings from the verification

| # | Finding | Status |
|---|---|---|
| F1 | `date_time` editor rendered empty and **deleted the stored value** on blur; no way to enter a time | **Fixed** — [COD-68](https://linear.app/code-bro/issue/COD-68) `6755f07` |
| F2 | Cells render **raw stored values**: `currency 123456`, `percent 0.25`, `duration 90000`, `checkbox true`, `single_select opt_b` instead of `1234.56`, `25%`, `1m 30s`, `✓`, a chip | Pre-existing, already recorded in `docs/evidence/SAD-79.md` §5 and `docs/evidence/SAD-81.md` ("typed cell formatting" follow-up). Deliberately **pinned** by the new script so changing it is a visible decision |
| F3 | `auto_number` / `created_time` / `modified_time` render empty unless the value exists in the row; the three types are not offered by the Add Field modal (`SAD-86.md` §19) | Known, by design |
| F4 | Clearing a text cell stores `''`, while numeric/date types store `null` | Pre-existing inconsistency; pinned by the script, not changed |
| F5 | Opening a checkbox cell and dismissing it turned "never set" (`null`) into `false` | **Fixed** with COD-68 |

---

## 4. Gate

- `npm run test:fields` — **77/77 passed**; negative control (a deliberately wrong expectation)
  exits 1.
- `npm run check` — lint 0 errors, **112 files / 1670 tests**, guard, docs links, FA icons, build.

## 5. Why this exists

`npm test` runs in jsdom, which has no hit-testing, no layout and no real input-type sanitization.
Three of the four defects above were invisible to it: COD-66 (the browser never fired `dblclick`
because the first click rebuilt the row), COD-68 (a `type=date` input silently rejecting an ISO
value) and F5 (a blur commit rewriting an unset checkbox). A browser pass over every field type is
the cheapest guard against that whole class.
