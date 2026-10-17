# COD-67 — one field editor, a header without a type badge, and Field details

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` · **Issue:** [COD-67](https://linear.app/code-bro/issue/COD-67/field-investigation) (priority 2)
Plan: [`docs/plans/cod-67-field-investigation-plan.md`](../plans/cod-67-field-investigation-plan.md)

## The ticket, and what the code actually did

The report said a pop-up appears instead of “the expected main window for editing the field name
and field type”. Inspection found the opposite of a mis-wired dialog:

| Claim | Reality (before) |
|---|---|
| There is a field-editing window | **There was none.** No rename existed anywhere: `grep -rn "renameField\|setFieldName\|updateField" src/` returned nothing — no session method, no command, no menu entry |
| *Change field type…* opens the wrong dialog | It opened `TypePickerModal`, a purpose-built type-only fuzzy picker guarded by `planTypeChange` — deliberate, not a copy of the Add Field dialog |
| Column headers show the type | A badge (icon + type name painted through CSS `attr(data-type)`) sat between the name and the ⋮ |

So part 1 was **a new feature**, not a rewiring. That is why the fix is a model addition plus one
dialog that both creates and edits.

## What changed

### 1. The editor is the Add Field window (`src/views/grid/AddFieldModal.ts`)

`AddFieldModal` gained `mode: 'create' | 'edit'` and is exported under a second name:

```ts
export { AddFieldModal as FieldEditorModal };
```

There is **one** layout. In edit mode the window is titled **Edit Field**, pre-fills the name and
type, drops the options / validation / formula / link rows (those belong to field settings and the
formula editor), and its primary button reads **Save**. The type list is filtered by
`planTypeChange(rows, field, type).ok`, so a type that would lose values cannot be picked — the
same rule the header menu used. Create mode is untouched: same title, same rows, same
`Save Field`, same callback.

### 2. Renaming exists, and carries its references (`src/model/renameRefs.ts`, `tableSession.editField`)

Formulas store `{ k: 'ref'; name }` and queries match `fieldName`, so both address fields **by
name**. A rename that only touched `field.name` would silently turn `{Price}` into `#NAME?` and
`Price:>10` into a term that matches nothing.

| Piece | Behaviour |
|---|---|
| `renameInFormula` | Hand-written scanner: copies string literals verbatim (`"{Price}"` is data), decodes `\}` / `\\` inside a reference, replaces only a whole `{ref}` whose name is exactly the old name |
| `renameInQuery` | Parses with `parseQuery`; if the query does not parse it is returned unchanged. Otherwise the field-name span of each matching term is spliced, right to left, keeping every other byte — and the new name is quoted when it needs to be (`Unit Price` → `"Unit Price"`) |
| `createFieldEditCommand` | One command writes the field, its converted values and every rewritten formula, then applies the rewritten view — **one undo step** |
| `session.editField(id, name, type?)` | Validation (`Field not found`, `Field name cannot be empty`, `A field named "X" already exists`), no-op fast path, and type changes through `planTypeChange`. A blocked type change returns `{ ok: false, reason, blockedRows }` and applies **neither** half |

A name-only edit passes empty value maps, so cell values and row revisions do not move — undo
restores the previous state exactly rather than looking like a fresh edit.

### 3. Header shows the name only (`src/views/grid/GridView.ts`, `styles.css`)

The badge block, its three CSS rules and `src/views/grid/fieldTypeBadge.ts` (its icon map, now
unused) are gone. `data-field-type` stays on the header cell — menus and tests read it. This is a
**conscious divergence from the prototype**, which still draws the badge; the `type-badge` visual
region in `tests/visual/lib/regions.ts` is removed with a comment rather than left failing.

### 4. Field details, and clicking the field

| Entry point | Result |
|---|---|
| Click the header cell | Opens **Edit Field** (clicks on the name, ⋮, grip and resize handle are excluded; a drag’s trailing click is swallowed) |
| Right-click / ⋮ → **Field details…** | Same editor. It replaces the old *Change field type…* item; `TypePickerModal` and its `TypeTarget` row type are deleted as dead code |
| Toolbar **Add Field** | Unchanged — the create mode of the same window |

## Verification

### Unit and view tests — 25 new

| File | Tests | Covers |
|---|---|---|
| `tests/model/renameField.test.ts` | 15 | rename + values/rev untouched; formula rewrite in the same undo step; undo **and** redo; saved-query rewrite; a query/formula that never mentioned the field; string literals untouched; escaped braces; empty/duplicate names blocked with no history entry; missing field; combined rename + retype in one step; blocked retype blocks the rename; type-only edit |
| `tests/views/grid/fieldEditorModal.test.ts` | 8 | `FieldEditorModal === AddFieldModal`; Edit Field title/pre-fill/Save label; create-only rows absent; `canPickType` filtering plus the current type; `onEdit` receives the trimmed name; blank name keeps the dialog open; create mode unchanged |
| `tests/views/grid/headerCapsule.test.ts` | +2 | header click opens the editor but its controls do not; a column drag does not count as a click |
| `tests/menus/tableMenuModel.test.ts` | +1 | menu leads with `header.details` and has no `header.type` |

Full gate — `npm run check`: lint **0 errors** (119 pre-existing warnings), **114 files / 1695
tests**, `.tabula` guard, docs links (132 files), FA icons, build. `main.js` rebuilt.

### Browser — `npm run test:fields` (Chromium, production `TableView`)

**77/77 checks pass** — every field type still renders, edits and validates as before, including the
`date_time` and checkbox regressions fixed in COD-66/COD-68.

### Manual check of the new paths

| Gesture | Result |
|---|---|
| Click header of *Price* | Edit Field opens with “Price”, type *Number* |
| Rename to `Unit Price`, Save | Header shows `Unit Price`; `{Price} + {Tax}` becomes `{Unit Price} + {Tax}`; query `Price:>100` becomes `"Unit Price":>100` |
| Undo once | Name, every formula and the query return together |
| ⋮ → **Field details…** | Same window for that field |
| Edit mode type list | Types that cannot convert are absent; the current type is always present |

## Blast radius / non-regressions

- **Creation** — `AddFieldModal` create mode has no new required options; the two existing modal
  suites and the browser run pass unchanged.
- **Type change** — still `planTypeChange` + `changeFieldType`, still converts only when every value
  converts; the editor calls the same planner.
- **Values** — a rename writes `{}` value maps, so row `rev`/`updatedAt` do not move.
- **Airtable sync** — fields map by **id** (`sync/fieldMap.ts`), so renames do not disturb a link.
- **Formulas/queries that do not mention the field** are returned byte-identical (tested).
- **Sorting, resize, reorder, hide, freeze** — untouched paths; their tests pass.

## Deliberate divergence

The prototype’s header badge and its *Change field type…* entry no longer have counterparts. Both
are recorded here so a later visual review does not treat them as regressions.
