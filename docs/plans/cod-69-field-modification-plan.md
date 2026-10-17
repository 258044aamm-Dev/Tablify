# COD-69 — “Modify field”: the create window, opened on an existing field

**Issue:** [COD-69](https://linear.app/code-bro/issue/COD-69/rename-the-field-details-menu-into-field-modification) · priority 1 · Improvement · project Tablify
**Mode:** plan only — no code written, no branch, no release
**Baseline:** `main` @ `4d8388f` (shipped as v2.0.0-beta.4), tree clean

---

## 1. What the ticket asks

1. Rename the **Field details** menu item.
2. Open the **same window that creates a field** when a field is inspected or edited, pre-filled
   with that field’s information, for both actions, without regressions.

## 2. What already exists

Part 2’s *plumbing* is already in the shipped build — COD-67 built it one release ago:

| Requirement | Where |
|---|---|
| Create → creation window | `promptAddField()` → `new AddFieldModal(...)` (`tableView.ts:477`) |
| ⋮ → *Field details* → **the same class** | `header.details` → `promptEditField()` (`tableView.ts:952`) → `new FieldEditorModal(...)` |
| One component, no copy | `export { AddFieldModal as FieldEditorModal }` (`AddFieldModal.ts`, last line) |
| Pre-filled with the field | `mode: 'edit'`, `initial: { name, type }` |

What is **missing** is the second half of requirement 2: today edit mode *removes* the options,
validation, formula and link rows, so it does **not** display “the selected field’s existing
information” the way the create window does.

### The reference UI (screenshot supplied by the owner)

`AddFieldModal` for a **Text** field, as it renders in the vault:

```
[▤] Add New Field                                   ✕
Field name
  [ e.g. Status, Budget, Due date… ]
Field type
  [ Text                     ▾ ]
Validation rules
  [ ] Required          [ ] Unique
  [ Regex, e.g. ^[A-Z].* ]
                                Cancel   [ Save Field ]
```

The screenshot matches this repo’s dialog row for row. Options / Min–Max / Formula / Linked table
are absent only because the type is **Text**; `showTypeRows()` (`AddFieldModal.ts:249-256`) shows
them for select / number / formula / link fields.

**Conclusion:** edit mode must render **the same rows the create window renders for that field’s
type**, pre-filled — not a stripped name + type form.

## 3. Decisions (all locked)

| # | Question | Answer |
|---|---|---|
| **Q1** | Menu label / dialog title | Sentence case: menu **`Modify field…`**, title **`Modify Field`** |
| **Q2** | Which rows edit mode shows | **Every row create mode shows for that type**, pre-filled (§4.2) |
| **Q2b** | Select options editing | **`Manage options…` button** — the existing id-safe `OptionManagerDialog`; no free-text option box in edit mode |
| **Q3** | Formula box vs *Edit formula…* | **Keep both**; both write through the command stack |
| **Q4** | Delivery | **Commit and push only** — no tag, no release, no version bump |
| **Q5** | Validation rules | **Fully editable** for an existing field, pre-filled, in the same undo step |

## 4. Design

### 4.1 Model — `session.editField(fieldId, edit: FieldEdit)`

Today: `editField(fieldId, name, type?)`. It becomes a **patch**, so the window can carry every row
it shows through one command:

```ts
export interface FieldEdit {
  name?: string;
  type?: FieldTypeName;
  required?: boolean;
  unique?: boolean;
  min?: number | string | null;
  max?: number | string | null;
  regex?: string | null;
  formula?: string;
  linkTableId?: string;
}
editField(fieldId: string, edit: FieldEdit): EditFieldResult
renameField(fieldId: string, name: string)   // unchanged: editField(id, { name })
```

Rules for applying a patch (all inside the **existing** `createFieldEditCommand`, so still one
undo step, still one `replaceField` per definition):

| Key | Behaviour |
|---|---|
| `name` | Trimmed; empty → `{ ok:false, reason:'Field name cannot be empty' }`; duplicate (case-insensitive, other field) → `{ ok:false }`. On success the existing reference rewrite runs: `{Old}` in every formula + the old name in the saved query |
| `type` | Runs through `planTypeChange` exactly as today (same blocking, same value conversion, same key-dropping: `options` / `formula` / `linkTableId` disappear when they no longer belong) |
| `required` / `unique` | `true` sets the key, `false` **deletes** it (so a rule can be switched off) |
| `min` / `max` | `null` deletes; a value is stored in the type’s own form (the window parses with the same `parseInput` create mode uses) |
| `regex` | `null`/empty deletes |
| `formula` | Only when the resulting type is `formula`; compile-checked with `compileFormula` — a syntax error returns `{ ok:false, reason }` and changes nothing (same message as `setFormula`) |
| `linkTableId` | Only when the resulting type is `link` |
| *(none)* | If the resulting definition deep-equals the current one → `{ ok:true }` **without** pushing a command: no undo entry, no row `rev` bump |

**Deliberate non-goal:** `options` is not part of `FieldEdit`. Option ids belong to the option
manager, which already writes them through `createSetFieldOptionsCommand`
(`planOptionAdd` / `planOptionRemoval`, `model/selectOptions.ts`). This is the reason Q2b exists.

### 4.2 The window — `AddFieldModal`, edit mode

Opened with the whole field, not just its name and type:

```ts
export interface AddFieldOptions {
  mode?: 'create' | 'edit';
  initial?: { field: FieldDefinition };        // was { name, type }
  onEdit?: (edit: FieldEdit) => void;          // was (name, type)
  canPickType?: (type: FieldTypeName) => boolean;
  onManageOptions?: () => void;                // edit mode, select fields
  getField?: () => FieldDefinition | undefined; // refreshes the options summary
  linkTargets?: LinkTargetChoice[];            // already exists
  formulaPreview?: (expression: string) => string; // already exists
}
```

| # | Row | Create mode | Edit mode (new) |
|---|---|---|---|
| 1 | **Field name** | empty, placeholder `e.g. Status, Budget, Due date…` | `field.name` |
| 2 | **Field type** | grouped select | `field.type`; options filtered by `canPickType` + the current type |
| 3 | **Options** | textarea, one per line | **summary** (`3 options: To do, Doing, Done`) + **`Manage options…`** button |
| 4 | **Validation rules** | Required · Unique unchecked, Min/Max/Regex empty | `field.required`, `field.unique`, `field.min`, `field.max`, `field.regex` |
| 5 | **Formula** + *Preview (row 1)* | empty + preview | `field.formula` + live preview (`previewFormula`) |
| 6 | **Linked table** | first target | `field.linkTableId` |
| 7 | **Footer** | Cancel · **Save Field** | Cancel · **Save Field** (same label — same window) |

Mechanics:

- Delete the `if (this.isEdit) return;` guard in `showTypeRows()` and the block that removes the four
  rows (`AddFieldModal.ts:249-262`). Rows then behave exactly as in create mode — visibility follows
  the selected type.
- `submit()` builds a `FieldEdit` from **visible rows only**. A row hidden for the selected type is
  omitted from the patch, so saving can never clear a key the window never showed.
- Pre-fill happens in `onOpen()` from `initial.field`; `showTypeRows()` runs after, so the right rows
  appear for the field’s type.
- Title `Modify Field`; the create title stays `Add New Field`.
- The formula compile check, the link-target check and the name check stay where they are, in
  `submit()`, so the dialog stays open with the user’s text on an error.

### 4.3 The options row (`Manage options…`)

- Rendered only for `single_select` / `multi_select`, in place of the textarea.
- Click → `onManageOptions()` → `tableView.openOptionManager(field)` — the **same** dialog the cell
  dropdown’s *Manage options* opens, so ids, colours and cell writes behave identically.
- **Stacking:** `.tablify__optmgr-backdrop` is `position: fixed; z-index: 50` and is appended to
  `document.body` (`OptionManager.ts:84`, `styles.css:2877`), while Obsidian modals sit in their own
  higher layer. Opened over the field window it would land **behind** it. Plan: an opt-in
  `stacked?: boolean` on `OptionManagerDialog` adding `.tablify__optmgr-backdrop--stacked`
  (`z-index: 1000`), used only by this path; assert the class in jsdom and eyeball it in the browser.
- When the option dialog closes, the summary refreshes through `getField()`; the field window stays
  open with any unsaved name/type/rule edits intact.
- Undo: option changes remain their **own** `createSetFieldOptionsCommand` step (as they are today
  from the cell dropdown). The field window’s Save stays one step for everything it owns.

### 4.4 Wiring — `src/views/tableView.ts`

```ts
private promptEditField(fieldId: string): void {
  const field = s.getFields().find(f => f.id === fieldId);
  new FieldEditorModal(this.app, () => {}, {
    mode: 'edit',
    initial: { field },
    canPickType: (type) => planTypeChange(s.store.getAllRows(), field, type).ok,
    linkTargets: [{ tableId: selfId, name: selfName }, ...others],   // same list as Add Field
    formulaPreview: (expr) => previewFormula(s.store.getFields(), firstRow, expr),
    onManageOptions: () => this.openOptionManager(s.getField(fieldId) ?? field),
    getField: () => s.getField(fieldId),
    onEdit: (edit) => {
      const result = s.editField(field.id, edit);
      if (!result.ok) new Notice(result.reason);
      this.afterChange();
    },
  }).open();
}
```

Entry points are unchanged: header click (`onHeaderActivate`), ⋮ / right-click →
**Modify field…** (`header.modify`).

### 4.5 Menu rename

`src/menus/tableMenuModel.ts:145`

```ts
{ id: 'header.modify', label: 'Modify field…', enabled: true }
```

`header.details` disappears (runtime id only — nothing is persisted). `header.formula` stays (Q3).
Docs: `docs/user-guide.md` §3, §15’s header table and the import troubleshooting line.

## 5. Tests

### Red first, per commit

| File | New / changed | Covers |
|---|---|---|
| `tests/menus/tableMenuModel.test.ts` | changed | First item is `Modify field…` with id `header.modify`; no `header.details`, no `header.type` |
| `tests/views/grid/fieldEditorModal.test.ts` | changed + new | Title *Modify Field*; **all rows present for a text field**, rules pre-filled; number field shows Min/Max and no Regex; formula field shows the expression + preview; link field shows the linked table; select field shows the summary + `Manage options…` and **no** textarea; clicking it calls `onManageOptions`; Save passes a patch containing only visible rows; blank name keeps the dialog open; `Save Field` label; **create mode untouched** |
| `tests/model/editField.test.ts` | new | Rules saved and undone in one step; clearing a rule deletes the key; formula saved in the same step as a rename (both restored by one undo); syntax error blocks everything; type change + extras (`text → number` keeps Min/Max, `formula → text` drops the formula); a blocked type change blocks the whole edit; options are never touched by `editField`; a no-op save adds **no** undo entry and does not bump `rev` |
| `tests/model/renameField.test.ts` | adjusted | Existing 15 tests move to the patch signature and must keep passing unchanged in behaviour |
| `tests/views/grid/select/optionManager.test.ts` | +1 | `stacked: true` adds the stacking class |

### Gate

- `npm run check` — lint 0 errors, full suite (1695 today + the new ones), guard, docs links, icons, build.
- `npm run test:fields` — **77/77** browser checks; this is the regression guard that no field type’s
  editing path changed.
- Manual, in the browser harness: open the window on a text field with rules, on a select field
  (`Manage options…` stacking), on a formula field (preview), on a number field (Min/Max).

## 6. Commits (delivery = commit + push only)

1. **A — model:** `FieldEdit` + `editField` patch + `tests/model/editField.test.ts` + the
   `renameField.test.ts` adjustment.
2. **B — UI:** `AddFieldModal` edit rows + `Modify Field` title + menu rename (`header.modify`) +
   `tableView` wiring + `OptionManagerDialog` stacking + user guide + `docs/evidence/COD-69.md`.

Each commit: tests → `npm run check` → `npm run test:fields` → push → Linear comment.
End state: **In review** (never Done).

## 7. Blast radius & risks

| Area | Effect | Guard |
|---|---|---|
| Create path | none by design — same class, `mode:'create'` default | every assertion in `addFieldModal.test.ts` unchanged |
| Rename / type change | same command, same reference rewrite | `renameField.test.ts` |
| Options | still written only by `createSetFieldOptionsCommand` | no `options` key in `FieldEdit` |
| Validation paint | rules become editable, so the grid can flag rows right after a save | test asserts the paint clears on undo |
| Blocked type change | must block the whole edit, not just the type half | model test |
| Formula | two entry points, one command path | test edits from each and undoes |
| Undo history | a no-op save must not add an entry | model test |
| Stacking the option dialog | z-index behind the Obsidian modal | `stacked` class + browser check |
| File format | no new keys; `required/unique/min/max/regex` already round-trip | format tests unchanged |

## 8. Out of scope

- Free-text option editing inside the field window (Q2b).
- Changing which types `planTypeChange` allows (`NOT_A_TARGET` stays as is).
- Any change to `.tablify` format, Airtable sync, or the embed view.
