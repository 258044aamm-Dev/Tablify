# COD-70 — clicking another cell while editing: one click is enough

**Date:** 2026-10-17 · **Repo:** `258044aamm-Dev/Tablify` · **Issue:** [COD-70](https://linear.app/code-bro/issue/COD-70) (priority 1, Improvement + UI-UX)
Plan and root-cause record: [`docs/plans/cod-70-cell-switch-while-editing-plan.md`](../plans/cod-70-cell-switch-while-editing-plan.md)

## What was wrong

Editing cell A and clicking cell B committed the edit but left the selection on A; the selection
only moved on the *second* click.

The commit runs on `blur`, which happens during `mousedown`, and its re-render rebuilds every row
(`rowEl.innerHTML = ''` in `fillRow`). The pressed element is detached before `mouseup`, and
Chromium dispatches no `click` for a gesture whose pressed node is gone — so `GridView`'s
click-to-select listener never ran. Nothing was slow or swallowed: the event the selection depends
on was never delivered.

## What changed

`src/views/tableView.ts` — one new press listener plus two small helpers. Nothing else changed.

- **`wireEditSwitchPress()`** — a `pointerdown` listener on the grid root, wired next to the touch
  press wiring. It acts only while an editor is open, only for a mouse/pen primary-button press on
  a body cell that is not the edited cell. It finishes the edit through the editor's own commit
  path, consumes the press, activates the pressed cell, and focuses the grid.
- **`finishEditOnPress()`** — dispatches the editor's `blur` event (the same listener the browser
  would trigger), so the commit path, validation and undo are exactly the ones already in use.
  Returns whether the editor closed.
- **`toggleCheckboxAt()`** — the checkbox write lifted out of the `onToggleCheckbox` closure so the
  grid's box control and the press handler share one implementation (COD-71: one click, one undo
  step).

Behaviour after the fix:

| Gesture while editing | Result |
|---|---|
| Press another cell (mouse) | commit, editor closes, **that cell is selected**, grid keeps focus (arrow keys work at once) |
| Press a checkbox box | commit, **box toggles** in the same click, selection stays where it was (the box owns its click, COD-71) |
| Press the edited cell / inside the editor | editor stays open, no write |
| Press with an invalid value | editor stays open, `aria-invalid`, nothing written, **caret stays in the field** (before: unfocused editor) |
| `Enter` / `Escape` | unchanged — commit / cancel, selection untouched |
| Right-click another cell | unchanged — commit, pressed cell selected, cell menu opens |
| Press header or toolbar | unchanged — commit on blur, no selection change |
| Touch tap, long press | unchanged (the new listener ignores touch) |

## Tests

`tests/views/editSwitch.test.ts` (new, 5 jsdom tests; 3 fail on the pre-fix code):

| Test | Pins |
|---|---|
| one press on another cell commits the edit and selects that cell | the ticket, end to end (value saved, exactly one selected cell) |
| one press on a checkbox cell toggles the box and leaves the selection alone | COD-71 box semantics through the new press path |
| an invalid value keeps the editor open and does not move the selection | the editor's existing rule survives the press |
| a press inside the editor leaves it open | the editor's own presses are not intercepted |
| a touch press is not the mouse path: it still only selects | no touch behaviour change |

## Browser verification

`/tmp/cod70audit.ts` — the real build in Chromium through the repo's visual harness, 20 checks, all
passing: editor closes and value commits on one click; selection lands on the pressed cell; grid
keeps focus; `ArrowDown` moves from the new cell; checkbox toggles in one click without selecting;
click-inside-editor and `Escape`; invalid value keeps the editor open, marked and unfocused-free;
`Enter` still commits; double-click still edits; right-click commits and selects; header press
commits. Before the fix, checks 1b–1d fail (`selection stays 0/0`), reproducing the ticket.

Screenshot of the post-fix state: `repro/cod70-after.png` (selection on the pressed cell after one
click; the edited cell shows the committed value).

## Full regression run

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (119 pre-existing warnings) |
| `npm run test` | **117 files / 1745 tests** pass (1740 before + 5 new) |
| `npm run check:guard` | PASS |
| `npm run check:docs` | PASS — 139 markdown files, all relative links resolve |
| `npm run check:icons` | PASS |
| `npm run build` | PASS |
| `npm run test:fields` | **86/86** browser field-type checks pass |

Untouched by construction: the editors (`src/views/grid/editors/`), `GridView`'s click, double-click
and keyboard handlers, the commit command and undo stack, the file format, and the embed view.
