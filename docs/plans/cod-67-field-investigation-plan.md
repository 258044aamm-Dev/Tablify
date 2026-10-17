# Tablify — COD-67 “Field investigation” plan

> **Status: plan only.** Nothing changed; the repo is clean at `5982735`. This document is the
> output of the “inspect before implementing” step the ticket asks for (§4), and three of the
> findings change the ticket's scope (§2).

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` @ `5982735` · **Mode:** plan only
**Linear:** [COD-67 “Field investigation”](https://linear.app/code-bro/issue/COD-67/field-investigation) — priority 2, Todo, assigned to Md Limon Islam

---

## 1. What the ticket asks for

1. **Bug** — clicking a field, right-clicking it, or *⋮ → Change Field Type* opens a pop-up
   “instead of the expected main window for editing the field name and field type”. It should be
   the same window used when creating a new field.
2. **Header shows only the field name** — hide the field type from the column header.
3. **“Field Details” in the ⋮ menu** — view the field's details without opening a separate window.
4. Preserve renaming, type changing and field creation.

---

## 2. What the code actually does (inspection)

| Surface | Today | Where |
|---|---|---|
| ⋮ → **Change field type…** | Opens `TypePickerModal` — a **type-only** list with per-target feasibility (`planTypeChange`). It does **not** touch the name. | `tableMenuModel.ts:152`, `tableView.ts:921-933` |
| Right-click on a header | Same menu as ⋮ (header menu) | `tableView.ts` `openHeaderMenu` |
| **… → Rename field** | **Does not exist.** There is no entry, no modal, no session method. | — |
| Add field | `AddFieldModal` — name + grouped type picker + formula/link/options/validation | `AddFieldModal.ts:63` |
| Header capsule | grip · key · name (sort button) · sort arrow · **type badge** · ⋮ | `GridView.ts:780-845` |

### Finding A — there is nothing to “fix”: the field-editing window does not exist

The ticket assumes a field-editing window that the wrong pop-up is shadowing. The opposite is true:
the plugin has **no way to rename a field at all**, and type changes are a purpose-built picker,
not a copy of the add-field dialog.

```
$ grep -rn "renameField|setFieldName|updateField" src/    → no matches
$ grep -rn "\.name =" src/model/ src/views/grid/AddFieldModal.ts
  → only AddFieldModal's own input state
```

So part 1 is **a new feature** (rename + a unified editor), not a rewiring. That is the main reason
this plan exists.

### Finding B — renaming is not local: formulas and queries reference fields **by name**

- `src/formula/parser.ts:11` — a `{…}` reference is stored as `{ k: 'ref'; name }`; there is no
  field id anywhere in a formula.
- `src/query/parse.ts` — filter/query terms parse a **field name** (`Field:value`).
- Airtable sync maps by field **id** (`sync/fieldMap.ts`), so sync is safe, but the file's saved
  `formula` strings and saved view queries are not.

Consequence: `renameField` alone would silently break every formula and saved query that used the
old name. Any rename must either rewrite those references in the same undo step, or refuse/warn.

### Finding C — hiding the header type badge collides with prototype parity and a measured region

- The prototype renders the type in the header (`tests/visual/lib/regions.ts:39` measures
  `.header-capsule span.font-mono[title]` against `.tablify__hc-badge` as the **`type-badge`**
  region).
- `SAD-82` is a “match the prototype as closely as possible” programme; removing the badge is a
  deliberate divergence and invalidates that baseline.
- Existing assertions to update: `tests/views/grid/capsule.test.ts:96-97,135-136,143` and
  `tests/views/grid/headerCapsule.test.ts:103-104,230`.
- The badge is also part of the header's measured width math (`headerCapsule` fill mode), so
  removing it changes column widths — the geometry tests must be re-derived, not just deleted.

---

## 3. Proposed design (smallest appropriate change)

### 3.1 A shared `FieldEditorModal` (new), used by both create and edit

Generalise today's `AddFieldModal` rather than fork it:

```
new FieldEditorModal(app, { mode: 'create' | 'edit', field?, … })
```

- **create** → current behaviour exactly (title “Add New Field”, every section offered).
- **edit** → title “Field Details” / “Edit field”, name pre-filled and editable, type pre-selected,
  name + type always shown; the type list is filtered by `planTypeChange` (a type that would lose
  data is disabled with its existing reason), so the current safety behaviour is preserved.
- On save in edit mode: `renameField` (if the name changed) + `changeFieldType` (if the type
  changed) as **one undo step**.

`TypePickerModal` stays for the command palette / any one-click path, or is retired if nothing else
uses it (`grep` in Step 1 decides).

### 3.2 `session.renameField(id, name)` + an undoable command

- new `createRenameFieldCommand`, mirroring `createChangeFieldTypeCommand` (snapshot before/after),
- validation: non-empty, trimmed, **unique within the table** (formulas and queries resolve by name,
  so duplicates would be ambiguous), and a length cap consistent with the schema,
- reference rewrite (pending decision Q1): replace `{Old}` → `{New}` in every `formula` of the same
  table and the old name in saved view queries, inside the same command,
- name uniqueness today is not enforced anywhere — check `validateTable`/schema before adding.

### 3.3 Header: name only

- drop `.tablify__hc-badge` from `buildHeaderCell` (`GridView.ts:823-829`),
- keep `data-field-type` on the header cell (already set at `GridView.ts:750`) so styling/tests that
  need the type still have it,
- move the type into the ⋮ → **Field Details** panel (3.4) so it stays discoverable,
- re-derive the `headerCapsule` width expectations; update `regions.ts` (drop the `type-badge`
  region) and the two test files listed in Finding C,
- **decision Q2** governs how far this goes.

### 3.4 “Field Details” in the ⋮ menu

New first-class item `header.details` → opens `FieldEditorModal` in `edit` mode (name + type +
formula/link/options/validation sections where relevant). That satisfies both part 1 and part 3 with
one window instead of two.

---

## 4. Test plan (red first, as with COD-66/68)

| # | Test | Asserts |
|---|---|---|
| 1 | `tests/views/grid/fieldEditor.test.ts` | edit mode pre-fills name + type; saving a changed name writes it and **one** undo restores both name and type |
| 2 | same | renaming to an existing name is refused with a reason; empty/whitespace is refused |
| 3 | same | a type that `planTypeChange` rejects is disabled with its reason (existing safety kept) |
| 4 | `tests/model/renameField.test.ts` | rename rewrites `{Old}` → `{New}` in formulas and saved queries **in the same undo step** (Q1) |
| 5 | `tests/views/grid/headerCapsule.test.ts` | header renders the name and **no** type badge; `data-field-type` still present (Q2) |
| 6 | `tests/menus/tableMenuModel.test.ts` | `header.details` exists, first in the menu, and is enabled for every field type |
| 7 | `tests/e2e/fieldTypes.browser.ts` | unchanged 77 checks still pass — the matrix must not regress |

Gate: `npm run check` (lint 0 errors, suite green, guard/docs/icons/build) + `npm run test:fields`,
`main.js` rebuilt, evidence doc, CHANGELOG entry.

---

## 5. Blast radius

| Area | Risk | Mitigation |
|---|---|---|
| Header geometry | badge removal changes measured widths | re-derive `headerCapsule` expectations; visual sweep before/after |
| Visual parity | `type-badge` region disappears; prototype still shows it | remove the region consciously, record it in evidence (Q2) |
| Formulas / queries | rename can orphan references | rewrite in the same command + test #4 (Q1) |
| Airtable sync | maps by field **id**, not name | no change expected; assert in test #4 that `syncLink` mapping is untouched |
| Add field flow | shared modal | create-mode tests (`addFieldModal.test.ts`, 86+ assertions) must stay green unchanged |

---

## 6. Decisions needed before implementation

| # | Question | Options | Recommendation |
|---|---|---|---|
| Q1 | What should a rename do to `{Old}` references in formulas and saved queries? | (a) rewrite them in the same undo step · (b) rename only, warn about broken references · (c) rewrite formulas only, leave saved queries | **(a)** — the alternative silently breaks user data |
| Q2 | The type badge in the header | (a) remove entirely (diverges from the prototype, drop the visual region) · (b) hide the glyph but keep the type as the header's tooltip/`aria-description` · (c) leave it | **(a)** per the ticket; (b) if you want the type discoverable without opening the menu |
| Q3 | “Field Details” | (a) the same modal in edit mode (one window for details + editing) · (b) a small inline popover that only displays details, with an *Edit* button | **(a)** — matches “the same window as creating a field” |
| Q4 | Scope | (a) all three parts in one change · (b) part 1 only first, header badge separately | **(a)** with separate commits per part |

---

## 7. Execution outline (once approved)

1. Commit A — `FieldEditorModal` + `renameField` (+ reference rewrite) + tests #1-4.
2. Commit B — header shows the name only + test #5 + visual region update.
3. Commit C — `Field Details` menu entry + test #6 + docs/user-guide.
4. Each commit: red-first tests → `npm run check` → `npm run test:fields` → push → Linear comment.
5. End state: **In review** (never Done), with an evidence doc `docs/evidence/COD-67.md`.
