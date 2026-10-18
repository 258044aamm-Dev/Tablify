# COD-77 — cell focusing: a tap outside the table drops the focused cell

**Plan only — nothing implemented, no commits, no Linear status change.**
`main` is at `856d982` (COD-76 landed today); the working tree is clean.
**Issue:** [COD-77](https://linear.app/code-bro/issue/COD-77/cell-focusing) · priority **2 (medium)** ·
labels *Improvement*, *UI-UX*

**Your answers, used as the design brief:**
1. **keep-zone is prototype-faithful** — the highlight survives taps on the table surface
   (header + body), an open picker panel, an open menu, an open modal; it goes on taps on the
   toolbar, the workspace, the Insert Row pill — anywhere else;
2. **an open editor commits first, then the highlight goes** — never lose input; an invalid
   value that refuses to commit keeps both the editor and the highlight;
3. **taps only** — Escape stays out of scope (it is a no-op on the grid today);
4. **visual evidence ships** — before/after captures in `docs/evidence/cod-77/`, same
   convention as COD-76.

---

## 1. What is actually wrong today

A cell stays highlighted forever. The selection is painted in place
(`GridView.setSelection` → `paintSelection`, `src/views/grid/GridView.ts:462`) and nothing
ever un-paints it except:

- selecting another cell (the grid's delegated `click` handler, `GridView.ts:377-390`),
- a grouping change (`tableView.ts:720`),
- a model swap that prunes an out-of-range selection (`GridView.ts:430`).

Tap the toolbar, another pane, the empty workspace — the capsule outline (`2px solid
var(--tablify-selection)`, `GridView.ts:485-500`) stays on the cell. On a phone, where the
grid is most of the screen, the stuck highlight is the whole complaint in the ticket.

**The prototype already solved this.** `Prototype/script.js:866-887`:

```js
// Tapping/clicking anywhere outside the grid clears the focused-cell highlight
// (mousedown, not click: by click-time a re-render may have detached ev.target,
// which would make closest() checks unreliable).
function outsideTapClear(ev) {
  if (!state.focus && !state.anchor && !state.editing) return;
  const t = ev.target;
  if (t && t.closest && (t.closest('#mainTable') || t.closest('#floatPanel'))) return;
  // NOTE: deliberately NOT anyModalOpen() here — that helper also reports
  // "open" while a cell editor is active or any input has focus, which is
  // exactly the state this handler must clear. Only true modal overlays
  // (full-screen backdrops) keep the selection.
  const modalIds = ['addFieldModal', 'optMgrModal', …];
  for (const id of modalIds) { … if visible, return; }
  if (state.editing) commitEditor(false); // commit the pending edit before re-rendering, never lose input
  state.focus = null;
  state.anchor = null;
  renderGrid();
}
document.addEventListener('mousedown', outsideTapClear);
document.addEventListener('touchstart', outsideTapClear, { passive: true });
```

Tablify never ported this handler. Everything it needs already exists in Tablify's
architecture — the port is small, and every keep-zone has a direct analogue:

| Prototype keep-zone | Tablify analogue | why it keeps the highlight |
|---|---|---|
| `#mainTable` (header + body) | `.tablify__header, .tablify__viewport` | a press there is a normal grid press: it moves the selection, toggles a checkbox, starts a drag |
| `#floatPanel` (select/attachment/… panels) | `.tablify__panel` | every picker card is built by `createPanelCard` (`src/views/grid/select/panel.ts:39`), so one class covers select, attachment and date panels |
| (menus render *inside* `#floatPanel`) | `.menu, .menu-container` | Obsidian renders cell/row/header menus at document level; the prototype's menus were float-panel content, so they were keep-zones too |
| the modal id list | `.modal-container` | Add Field, Options, Filter builder, Formula, Link picker — all Obsidian `Modal`s |
| `#cellEditor` inside the cell | `this.editing?.contains(target)` | Tablify's editor floats inside the grid **root** but outside the viewport, so it needs its own check — tapping into it to move the caret must not commit-and-clear |

Two deliberate divergences from the prototype, both forced by Tablify's DOM:

- **Event:** `pointerdown`, not `mousedown`+`touchstart`. One listener covers mouse, pen and
  touch, fires at press time (the ticket's "immediately"), and matches how Tablify already
  wires every press (`wirePressEvents`, `wireEditSwitchPress`, the grid's drags). Tests
  dispatch `new MouseEvent('pointerdown', …)` with a `pointerType`, the established pattern
  (`tests/views/editSwitch.test.ts`).
- **Insert Row pill clears.** In the prototype the pill (`#insertRowWrap`) sits *outside*
  `#mainTable`, so pressing it clears the highlight. In Tablify the pill lives inside the
  grid shell but outside `.tablify__viewport` (`GridView.buildInsertRow`), so under the
  prototype-faithful rule a tap on it clears too — then inserts the row. Same outcome as
  the prototype, no special case needed.

---

## 2. What ships

**One behavior:** a press whose target is outside every keep-zone commits any open editor
and clears the single selected cell — in place, no re-render (`setSelection(null)` already
repaints only the previous cell, COD-66). Row selection (`tablify__row--selected`, SAD-114)
is a different UI state and is **not** touched.

The handler lives in `TableView`, which owns the editing state and knows what is open:

```ts
// src/views/tableView.ts (sketch)
private outsideTapClear = (ev: Event): void => {
  const t = ev.target as HTMLElement | null;
  if (!t?.closest) return;
  if (
    t.closest(
      '.tablify__header, .tablify__viewport, .tablify__panel, .menu, .menu-container, .modal-container',
    ) ||
    (this.editing && this.editing.contains(t))
  )
    return;
  if (!this.grid?.getSelection() && !this.editing) return;
  // Commit a pending edit first — never lose input (the prototype's rule). An invalid
  // value keeps the editor open, and with it the highlight.
  if (this.editing && !this.finishEditOnPress(this.editing)) return;
  this.grid?.setSelection(null);
};
```

Wired where the other document-level presses are wired — in `renderGrid()`'s
grid-construction branch, next to `wirePressEvents` / `wireEditSwitchPress` (~line 653) —
and unwired in `clear()` (~line 176) alongside `this.grid?.destroy()`, so a closed leaf
leaks no listener. `finishEditOnPress` (line 895) is reused as-is: it dispatches the blur
the editor's own listener owns, so the commit is exactly the normal one (one undo step,
one save).

## 3. What does NOT change

- No existing selector, class name, or handler is edited; the new listener is additive.
- Click-to-select, double-click-to-edit, touch tap-twice-to-edit (SAD-96), COD-70's
  press-while-editing switch, long-press menus (SAD-97), row drags, column drags — all
  untouched: every one of them is a press *inside* a keep-zone.
- No keyboard change: `escapeCancel` stays a no-op on the grid (your call), and arrows /
  Enter / Tab behave as documented.
- No model, persistence, or undo-stack change. Clearing a highlight is UI state, exactly
  like row selection (SAD-114's rule: UI state is never written to the file).

## 4. Tests — new `tests/views/cellFocus.test.ts` (modeled on `editSwitch.test.ts`)

A real `TableView` over a real session, `press()` = `pointerdown` with `pointerType`,
the same fixtures as COD-70's suite:

| # | gesture | expected |
|---|---|---|
| 1 | select a cell, press `view.contentEl` (outside the grid) | no `.tablify__cell--selected`, no `aria-selected`, capsule outline cleared |
| 2 | press inside `.tablify__viewport`, off any cell | highlight kept |
| 3 | press a header cell | kept |
| 4 | press the Insert Row pill | cleared (prototype parity: the pill is outside the table surface) |
| 5 | press a `.tablify__panel` card (open picker) | kept |
| 6 | press a `.menu` element | kept |
| 7 | press a `.modal-container` | kept |
| 8 | editing + press outside | value committed into the file, editor removed, highlight cleared |
| 9 | editing an **invalid** value + press outside | editor still open, highlight kept (the existing blur rule) |
| 10 | nothing selected, not editing + press outside | no-op, no throw |
| 11 | press a different cell (no editor) | selection moves — pins that the new listener never eats a normal grid press |
| 12 | after `clear()`, press on document | no throw (listener unwired) |

Existing suites (`gridSelect`, `editSwitch`, `editTriggers`, `longPress`, `contextMenu`)
must stay green unchanged — they are the regression net for "did not influence other
features".

## 5. Evidence — `docs/evidence/cod-77/` + `docs/evidence/COD-77.md`

A small `tests/visual/capture-cell-focus.ts` (harness fixture: render the grid, click a
cell, shoot; dispatch an outside `pointerdown`, shoot again) produces four shots —
`{dark,light}-focused.png` and `{dark,light}-cleared.png` — and the sheet records the
finding, the keep-zone table, the prototype citation, the unit table, and the manual
checklist, same shape as `COD-76.md`.

## 6. Docs

- `docs/user-guide.md` — the cell-selection paragraph gains one line: tapping anywhere
  outside the table (toolbar, another pane, the Insert Row button) drops the highlight;
  an open editor commits first.
- `docs/shortcuts.md` — *Mouse and touch* section: "Tap outside the table — clear the
  focused cell".
- `spec/features.md` — grid section: the focused cell is dropped by an outside press,
  keep-zones listed, editor commits first.
- `CHANGELOG.md` — **Fixed**: the focused cell now loses its highlight when you tap
  anywhere outside the table (COD-77).

## 7. Risks, and why they are small

- **Listener order with `wirePanelDismiss`:** both listen at document level; an outside
  press while a picker is open closes the panel *and* clears the highlight. That is the
  prototype's composed behavior (its `#floatPanel` check only keeps the highlight for
  presses *inside* the panel).
- **`pointerdown` vs the long-press detector:** the handler never calls
  `preventDefault`/`stopPropagation`, so `wirePressEvents`' suppression logic is
  untouched; a long-press starts inside the viewport (keep-zone) anyway.
- **jsdom:** `pointerdown` is dispatched as a `MouseEvent` in tests (the existing
  convention); the handler only reads `target`, so the type does not matter.

## 8. Steps (each: local commit + Linear comment; never Done)

1. **The behavior** — the handler, wiring, teardown; `tests/views/cellFocus.test.ts`.
   Gates: `npm run check` + `npm run test:fields`. Commit, comment on COD-77.
2. **The evidence** — capture script, four shots, `docs/evidence/COD-77.md`. Commit, comment.
3. **The docs** — user guide, shortcuts, spec, changelog. Gates again, commit, comment.

Status goes **Todo → In Progress** at step 1 and **→ In review** after step 3; you set the
final state. Pushes: the GitHub token is back in context, so each step can push like
normal — say the word and they push; otherwise the commits stay local, as COD-76's did.
