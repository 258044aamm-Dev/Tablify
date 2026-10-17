# COD-69 — “Modify field”: one window, every row

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` · **Issue:** [COD-69](https://linear.app/code-bro/issue/COD-69/rename-the-field-details-menu-into-field-modification) (priority 1, Improvement)
Plan: [`docs/plans/cod-69-field-modification-plan.md`](../plans/cod-69-field-modification-plan.md)

## What was asked, and what was already true

The ticket asked to rename *Field details* and to make it open **the same window that creates a
field**, pre-filled, for both actions.

The window was already shared — `export { AddFieldModal as FieldEditorModal }`, added by COD-67 —
but edit mode *removed* the options, validation, formula and link rows. So the window was the same
component showing a different form: it did not display the field’s information the way the create
window does.

## What changed

### 1. The menu

`header.details` → **`header.modify`**, label **`Modify field…`** (`src/menus/tableMenuModel.ts`).
Sentence case matches the rest of the menu (*Hide field*, *Sort ascending*). The dialog title is
**Modify Field**; create mode keeps **Add New Field** and its **Save Field** button — the edit mode
now uses the same button label, because it is the same window.

### 2. The window shows the create rows, pre-filled

`src/views/grid/AddFieldModal.ts`

| Row | Edit mode |
|---|---|
| Field name | `field.name` |
| Field type | `field.type`; options filtered by `planTypeChange` + the current type. A read-only type that is not a change target (*auto number*…) is still shown instead of silently falling back to Text |
| Options | `N options: a, b, c` + **Manage options…** (select types only) |
| Validation rules | `required`, `unique`, `min`, `max`, `regex`, pre-filled |
| Formula + *Preview (row 1)* | `field.formula`, preview computed immediately |
| Linked table | `field.linkTableId`, from the same target list Add Field builds |

The `if (this.isEdit) return` guard in `showTypeRows()` and the block that removed the four rows are
gone, so visibility now follows the selected type in both modes.

### 3. Options are not a textarea in edit mode

Cells store option **ids**, and `planOptionRemoval` clears the cells that point at a deleted option
(R-D12). A list of names cannot tell “renamed *Done* to *Completed*” from “deleted *Done*, added
*Completed*”, so a save through a textarea could blank every cell that said Done. The row therefore
shows what the field has and opens the existing `OptionManagerDialog`, which renames **by id**.

Two supporting changes:

- `OptionManagerHooks.onClose` — lets the field window refresh its summary when the manager closes.
- `OptionManagerOptions.stacked` — the manager’s backdrop is `z-index: 50` on `document.body`, while
  the field window is an Obsidian modal in a higher layer; opened from inside it the manager would
  have rendered *behind* the window. The opt-in class raises it to `z-index: 1000`. The path from a
  cell dropdown is unchanged.

### 4. One patch, one undo step

`session.editField(fieldId, edit: FieldEdit)` (`src/model/tableSession.ts`) accepts
`name`, `type`, `required`, `unique`, `min`, `max`, `regex`, `formula`, `linkTableId`.

- **Only keys present in the patch are written** — the window builds the patch from the rows it
  actually showed, so a hidden row can never clear the value behind it.
- `false` / `null` / `''` **removes** a rule, so a rule can be switched off (the create dialog only
  ever added rules).
- A formula is `compileFormula`-checked and a regex compiled **before anything lands**; a blocked
  type change still blocks the whole edit, rename included.
- A save that changes nothing returns `{ ok: true }` **without** pushing a command: no undo entry,
  no row `rev` bump.
- `options` is deliberately absent from the patch — option ids stay owned by
  `createSetFieldOptionsCommand`.
- The old `(fieldId, name, type?)` call still works, so `renameField` and every COD-67 caller are
  unchanged.

## Verification

### Unit and view tests — 34 new or rewritten

| File | Tests | Covers |
|---|---|---|
| `tests/model/editField.test.ts` | 14 | Rules in one undo step; keys cleared rather than stored as `false`; invalid regex / unparseable formula refused with nothing written; formula + rename in one undo; type changes still dropping the keys they own; blocked type change blocks the rename; no-op save leaves no history entry and no `rev` bump; options untouched; link target only on link fields |
| `tests/views/grid/fieldEditorModal.test.ts` | 20 | Title *Modify Field*; `Save Field`; rules pre-filled and hidden per type; Min/Max only for number/date; formula + preview; linked table; options summary + `Manage options…` and no textarea; summary refresh; patch contains only visible rows; emptied rule → `null`; blank name / bad regex / bad formula keep the dialog open; type filter; read-only type shown; create mode byte-for-byte as before |
| `tests/menus/tableMenuModel.test.ts` | 1 updated | First item is `header.modify` / *Modify field…*; no `header.type`, no `header.details` |

### Browser check — the window in Chromium, production bundle

`repro/cod69Window.ts` (a read-only script against the built bundle and the real `TableView`, the
same harness `npm run test:fields` uses) opens the window the way a user does and asserts what the
DOM says: **20/20**.

| Check | Observed |
|---|---|
| Header click opens the window | `.tablify__af-modal` present |
| Title | `Modify Field` |
| Number field pre-filled | name `Amount`, type `number`, min `0`, max `100`, regex row hidden, `Save Field` |
| Text field pre-filled | regex `^[A-Z]` shown, `Required` ticked |
| Formula field | `{Amount} * 2` in the box, preview already reads `20` on open |
| Select field | `2 options: To do, Done`, `Manage options…`, **no** options textarea |
| `Manage options…` | manager opens with `--stacked`: computed `z-index: 1000` while the base backdrop computes `50`, and `elementFromPoint` over the manager lands inside it (above the field window) |
| Escape | closes the manager |

Screenshots: `repro/cod69-number.png`, `cod69-text.png`, `cod69-formula.png`, `cod69-select.png`,
`cod69-select-manage.png`.

### Gate

- `npm run check`: **115 test files / 1721 tests**, lint **0 errors** (119 pre-existing warnings),
  `.tabula` guard, docs links (136 files), FA icons, build.
- `npm run test:fields` (Chromium, production `TableView`): **77/77** — every field type still
  renders, edits and validates, including the COD-66 and COD-68 regressions.

## Blast radius

| Area | Effect |
|---|---|
| Create a field | None by design — same class, `mode: 'create'` default, same title, rows, textarea and callback. `addFieldModal.test.ts` and the create-mode assertions above prove it |
| Rename / type change | Same command (`createFieldEditCommand`), same reference rewrite, same `planTypeChange` |
| Options | Still written only by `createSetFieldOptionsCommand`; no new option writer, no id churn |
| Validation paint | Rules are now editable, so a save can flag cells on the next render — one undo step, and the model tests assert the rules come back |
| Formula | Two entry points, one command path (`session.setFormula` and `editField` both go through the stack) |
| Airtable sync | Maps fields by **id**; nothing here touches ids |
| File format | No new keys — `required/unique/min/max/regex` already round-trip |
| Standalone option manager | Unchanged: `stacked` is opt-in, `onClose` is optional |

## Deliberate choices

- **`Modify field…`, not `Field modification…`** — sentence case, matching every other header item.
- **`Save Field` in both modes** — the ticket asks for one window; a different button label is what
  made the old edit dialog feel like a different dialog.
- **Options behind a button** — the id-preservation reason above. Recorded in the user guide too.
