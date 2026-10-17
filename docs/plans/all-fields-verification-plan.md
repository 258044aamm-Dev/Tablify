# Tablify — all-fields verification after COD-66

> **Execution status (2026-10-17):** Steps B/C shipped as **COD-68** `6755f07` (`date_time`
> editor + checkbox `null` → `false`), and Step A shipped as `npm run test:fields`
> (`tests/e2e/fieldTypes.browser.ts`, 77 checks; evidence in `docs/evidence/COD-66-all-fields.md`).
> Step E (user-guide note for system fields) shipped with them. Steps D (typed cell formatting) and
> F4 (empty-string vs `null`) stay on the existing SAD-79/SAD-81 follow-ups, per decision Q4.
>
> **Original status: plan + verification evidence only.** No source changes, no commits, no pushes. The
> repo is clean at `1e9dd9f`. Every check below was run read-only against the production
> `TableView` in real Chromium (repo Playwright harness); the runner scripts live outside the repo
> (`/home/user/repro/*.ts`) so nothing in the working tree moved.

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` @ `1e9dd9f` · **Mode:** plan only
**Question answered:** after COD-66 (`d428179`), does editing still work for **every** field type — and does anything else misbehave?

---

## 1. Verdict

**Editing is intact for all 21 registered field types.** COD-66 changed only *how the selection is
painted*; every editor route below behaves exactly as designed, and nothing regressed.

While verifying, I found **one real, pre-existing bug that COD-66 now makes much easier to hit**:
the `date_time` editor. It shows a blank field for a stored timestamp, and **clicking away deletes
the value**. It is not caused by COD-66 (the editor factory last changed in SAD-96, `8c4031b`; the
date type in `3487411`), but it is now reachable by the documented double-click as well as Enter.
Details in §4 F1.

Three further observations are **pre-existing and already documented** as known gaps (raw cell
formatting, system fields) or are minor semantic nits (F4, F5).

---

## 2. Method

| | |
|---|---|
| Fixture | one `.tablify` file, format v2, **one column per registered type** (21), 1–2 rows |
| Harness | `tests/visual/lib/harness.ts` — mounts the real `TableView` with `styles.css` inline |
| Browser | Chromium 156 headless, 3000×900 and 2200×900 viewports (all columns visible, no horizontal scroll guesswork) |
| Per type | double-click → classify the surface → commit a value → read the stored value back → reopen → Escape → confirm the value is unchanged |
| Read-only types | double-click and right-click must open nothing |
| Display | rendered cell text vs the type's own `format()` |
| Runners | `allFields.ts` (surface + commit + cancel, 21 types), `fieldEdge.ts` (display, invalid input, clearing, checkbox, date/date_time, attachment), `display.ts` (rendered values), `dtConfirm.ts` (date_time via Enter) |

Unit suites re-run for the paths a browser cannot observe: `linkPicker.test.ts` (9) — the link
picker is a modal that the `obsidian` mock never attaches to the DOM — plus `editTriggers.test.ts`
(10) and the model suite (**301 tests** across 18 files), all green.

---

## 3. Editing matrix — all 21 types

Legend: **surface** = what a double-click opens. Values are the *stored* value read back from
`getViewData()`, i.e. what lands in the file.

| # | Field type | Surface | Commit (stored) | Escape |
|---|---|---|---|---|
| 1 | `text` | inline editor | `"Hello world"` ✔ | keeps value ✔ |
| 2 | `long_text` | inline editor (textarea) | `"Line one"` ✔ | keeps value ✔ |
| 3 | `number` | inline editor | `42.5` ✔ | keeps value ✔ |
| 4 | `currency` | inline editor | `123456` (minor units) ✔ | keeps value ✔ |
| 5 | `percent` | inline editor | `0.25` ✔ | keeps value ✔ |
| 6 | `duration` | inline editor | `90000` (ms) ✔ | keeps value ✔ |
| 7 | `rating` | inline editor | `7` ✔ | keeps value ✔ |
| 8 | `checkbox` | inline editor (checkbox) | `true` ✔ | keeps value ✔ |
| 9 | `date` | inline editor (`type=date`) | `"2026-10-17"` ✔ | keeps value ✔ |
| 10 | `date_time` | inline editor (`type=date`) | `"2026-10-17T00:00:00.000Z"` ✔ | keeps value ✔ — **but see F1** |
| 11 | `url` | inline editor | `"https://example.com/a"` ✔ | keeps value ✔ |
| 12 | `email` | inline editor | `"user@example.com"` (lower-cased) ✔ | keeps value ✔ |
| 13 | `phone` | inline editor | `"+880 1712-345678"` ✔ | keeps value ✔ |
| 14 | `single_select` | select panel | `"opt_a"` ✔ | panel closes ✔ |
| 15 | `multi_select` | select panel | `["opt_a","opt_b"]` ✔ | panel closes ✔ |
| 16 | `attachment` | attachment panel | panel opens ✔ (path checked against the vault) | panel closes ✔ |
| 17 | `auto_number` | **none** (read-only) ✔ | — | — |
| 18 | `created_time` | **none** (read-only) ✔ | — | — |
| 19 | `modified_time` | **none** (read-only) ✔ | — | — |
| 20 | `formula` | **none** (read-only) ✔ | — | — |
| 21 | `link` | row picker modal ✔ | covered by `linkPicker.test.ts` (9 ✔) — mock modal has no DOM | — |

Also verified: invalid input (`number "abc"`, `url "not-a-url"`, `email "nope"`, `currency "-5"`)
keeps the editor open and marks it `aria-invalid="true"`; Escape then leaves the stored value
untouched. Read-only cells open nothing on double-click **and** on right-click.

**No COD-66 regression in any type.** The two behaviours COD-66 owns — click selects, double-click
edits — hold across all 21.

---

## 4. Findings

### F1 — `date_time` editor destroys the value (P1, pre-existing, now easier to hit)

`createEditor` gives **both** `date` and `date_time` an `<input type="date">`
(`src/views/grid/editors/index.ts`), but `dateTimeType.format()` returns a full ISO string. A
`type=date` input rejects that value, so it renders **empty**; the blur handler then commits `''`,
which parses to `null`.

Measured (`dtConfirm.ts`), through **Enter** — the path that existed before COD-66:

```
date_time before:                  "2026-10-16T09:30:00.000Z"
editor via Enter:                  { type: "date", value: "" }     ← timestamp invisible
date_time after Enter + click away: null                            ← value destroyed

date (control) before:             "2026-10-16"
date editor via Enter:             { type: "date", value: "2026-10-16" }
date after Enter + click away:     "2026-10-16"                      ← unaffected
```

Two defects in one: **the value is invisible while editing**, and **opening then dismissing the
editor silently deletes it**. A user cannot set a time at all (`date_time` is offered in the Add
Field modal, `AddFieldModal.ts` `TYPE_GROUPS` → `['date','date_time']`).

Severity: P1 — silent data loss on a documented gesture, in a user-creatable field type.

### F2 — cells render raw stored values, not formatted ones (known, documented)

`GridView.fillRow` writes `String(value)` for every type except `link`. Rendered output for one row:

| Field | Stored | Rendered | `format()` would give |
|---|---|---|---|
| currency | `123456` | `123456` | `1234.56` |
| percent | `0.25` | `0.25` | `25%` |
| duration | `90000` | `90000` | `1m 30s` |
| checkbox | `true` | `true` | `✓` |
| single_select | `opt_b` | `opt_b` | `Beta` (chip) |
| multi_select | `["opt_a","opt_b"]` | `opt_a, opt_b` | `Alpha, Beta` (chips) |
| date_time | ISO | ISO | — |

**This is pre-existing and already recorded**: `docs/evidence/SAD-79.md` §5 (“Typed cell formatting
is not part of this step … a follow-up is recorded for Step 8”) and `docs/evidence/SAD-81.md`
“Out of scope” (“Select values in grid cells show the raw option id … pre-existing”). Not a COR-66
regression, and not something to fold in silently — the cell renderer feeds the visual-parity
baselines.

### F3 — system fields render empty (known, by design)

`auto_number`, `created_time`, `modified_time` show blank unless the value happens to sit in
`row.values`. `SAD-86.md` §19 records that the prototype's System group is not offered by the
header menu, so these types cannot be created from the UI (they can still arrive via import or a
hand-edited file). Out of scope here; worth one line in the user guide.

### F4 — clearing a text cell stores `''`, numeric types store `null` (minor)

`textType.parse`/`longTextType.parse` return the input unchanged (so `''`), while number, currency,
date, url, email, phone… return `null` for empty input. Both render as empty and both pass
`isEmptyValue`, but they serialise differently (`""` vs absent) and differ for `required`
validation and Airtable push. Low priority; needs a model decision, not a UI patch.

### F5 — checkbox: open + dismiss writes `false` over an empty cell (minor)

`checkboxBefore null` → double-click → click away → `false`. The commit path treats “unchecked” as
a change from `null`. Same call: pressing Enter without toggling also writes `false`. Semantics
differ from “never set”, which matters for filters and Airtable. One-line fix: compare the checkbox
state with `Boolean(oldValue)` and skip the command when unchanged.

---

## 5. Proposed work (plan only — nothing done)

### Step A — make this matrix repeatable *(recommended first)*

Move the four throwaway runners into the repo as one checked-in script:

- `tests/e2e/fieldTypes.browser.ts` (the current `allFields.ts` + `fieldEdge.ts` merged)
- `npm run test:fields` → runs it against the built harness; **not** part of `npm test`, so CI
  stays browser-free and fast
- evidence doc `docs/evidence/COD-66-all-fields.md` with this matrix

Blast radius: test-only. No production code touched.

### Step B — fix F1 (`date_time`), its own ticket *(recommended)*

Minimal, contained change in `src/views/grid/editors/index.ts` (+ a small helper on `dateTimeType`):

- editor element `<input type="datetime-local">` with `step="1"` for seconds
- ISO ⇄ input conversion in **local** time (stored format stays ISO UTC — **no file-format change**)
- `date` keeps `<input type="date">`
- tests: reopen shows the stored timestamp; changing the date keeps the time; blur without edit is a
  no-op; the value survives open + dismiss; `date` is unchanged

Blast radius: one factory branch + one field-type helper. Nothing else reads editor values. The
Airtable pull/push path keeps ISO strings, so sync is unaffected. Estimated: ~½ day with tests.

### Step C — fix F5 (checkbox) *(optional, 15 minutes)*

Skip the command when `checked === Boolean(oldValue)`; test that open + dismiss leaves `null` alone
and that toggling still commits.

### Step D — F2 typed cell formatting *(separate, larger)*

Render cells through `getFieldType(type).format(value, field)` and add chips for selects. This
changes every visual baseline and touches the most-tested renderer in the repo — it deserves its
own plan and its own before/after visual sweep, not a rider on COD-66.

### Step E — docs

One paragraph in `docs/user-guide.md` for F3 (system fields arrive without values unless imported),
and the F4/F5 decisions once taken.

---

## 6. Decisions (locked 2026-10-17)

| # | Question | Decision |
|---|---|---|
| Q1 | F1 `date_time` data loss | **New ticket, fix next** → [COD-68](https://linear.app/code-bro/issue/COD-68) (Urgent, Todo). Not folded into COD-66. |
| Q2 | Step A repeatable matrix | **Commit it** — `tests/e2e/fieldTypes.browser.ts` + `npm run test:fields`, outside `npm test`. |
| Q3 | F5 checkbox `null → false` | **Fix alongside F1**, in COD-68 (one line + two tests). |
| Q4 | F2 raw cell display | **Leave on the existing SAD-79 §5 / SAD-81 follow-up.** No work here. |

### Execution order when this plan is approved

1. **COD-68** — `date_time` editor (`datetime-local`, local ⇄ ISO, stored format unchanged) + the
   checkbox `null → false` fix, tests first (red on `main`), `npm run check`, evidence doc,
   `main.js` rebuilt, push, Linear updated.
2. **Step A** — move the runners into `tests/e2e/fieldTypes.browser.ts`, add `npm run test:fields`,
   record `docs/evidence/COD-66-all-fields.md` with §3's matrix, push, Linear updated.
3. **Step E** — one user-guide paragraph for F3 and whatever F4 decides to be.

Nothing is committed from this document's work yet: the repo is clean at `1e9dd9f` and the four
runner scripts live in `/home/user/repro/`.

---

## 7. Out of scope for this verification

Validation rules (`required`/`unique`/`min`/`max`/`regex` rendering), Airtable push/pull semantics,
CSV/XLSX import and export. Each has its own suite and none of them is on the COD-66 path.
