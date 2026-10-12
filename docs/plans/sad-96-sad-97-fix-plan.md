# Tablify — SAD-96 / SAD-97 fix plan

> **Execution status (2026-10-12):** executed in full, same day. Two steps, two commits on
> `main`, each pushed and posted to its Linear issue:
> **SAD-97** `688d095` (touch dedupe, drag-blocker lifecycle, row-lead menu — Done) ·
> **SAD-96** `8c4031b` (double-click / tap-again / **Edit cell**, Enter-close fix — Done).
> Red→green tests first (`tests/views/contextMenu.test.ts` 8, `tests/views/editTriggers.test.ts`
> 8); `npm run check` green at every step — **97 files / 1562 tests** at close (baseline
> 95 / 1545; no existing test weakened). Evidence: `docs/evidence/SAD-97.md`,
> `docs/evidence/SAD-96.md`; CHANGELOG entries under `[Unreleased]`; `main.js` rebuilt with
> each step. Deviations from this plan: the drag blocker is scoped to the grid root *and*
> armed only after the threshold (belt-and-braces, §3 step 2.3); `onCellReselect` is a separate
> callback instead of a widened `onCellClick` signature (keeps the existing test contract
> exact); Enter/Escape consume their keystroke in the editor (a third defect found mid-fix —
> the commit keystroke re-opened the editor via the grid’s Enter→edit binding).

**Date:** 2026-10-12 · **Repo:** `258044aamm-Dev/Tablify` @ `830e692` (v2.0.0-beta.2) · **Mode:** plan (written first) → executed, see status above
**Linear:** project *Tablify* (`94bfabaa`, target 2026-10-15) — **SAD-96** “Cell editing is not working” (Bug, Urgent, Todo), **SAD-97** “Context menu” (Bug, Urgent, Todo). Both filed 2026-10-12, no comments yet.
**Baseline:** `npx vitest run` = **95 files / 1545 tests green** at plan time — the suite does not exercise either broken path (see §3).
**Sources:** `src/views/tableView.ts`, `src/views/grid/GridView.ts`, `src/views/grid/keyboard.ts`, `src/menus/tableMenuModel.ts`, `Prototype/script.js`, `README.md`, `docs/user-guide.md` §4/§18, `docs/shortcuts.md`, `docs/plans/prototype-visual-fidelity-plan.md` (SAD-82 programme), git history (`git log -S` on the relevant symbols).

---

## 1. Verdict

Two P1 bugs, two different failure classes — but both land on the *first touch* of the product, so together they make the grid feel dead:

| Issue | Class | Root cause | Deterministic? |
|---|---|---|---|
| **SAD-96** Cell editing | **Missing feature, documented as shipped** | No mouse edit trigger exists in the main `TableView` (double-click was never wired — `git log -S dblclick -- src/` shows only `embedView.ts` ever had one), and there is **no touch edit affordance at all**. The only trigger is keyboard **Enter** (`keyboard.ts:40` → `tableView.ts:624`), which needs grid focus. | Yes — 100 % reproducible by double-clicking a cell or tapping on mobile |
| **SAD-97** Context menu | **Regression-shaped logic bug** | `lastTouchAt` is stamped on **every** mouse/pen `pointerup` (`tableView.ts:687`), arming a 1.5 s touch-dedupe guard (`tableView.ts:650`) that swallows ordinary desktop right-clicks. Plus a latent global `blockMenu` leak from row-drag (`GridView.ts:947`). | Yes — right-click within 1.5 s of any click (i.e. almost always) is eaten |

Both fixes are small in code, high in leverage. Estimated effort: **SAD-97 ≈ ½ day**, **SAD-96 ≈ 1 day**, verification ½ day.

---

## 2. Root-cause analysis

### 2.1 SAD-96 — “Cell editing is not working”

**What the product promises**

- `README.md`: “Double-click (or press Enter on) a cell to edit.”
- `docs/user-guide.md` §4: “Click a cell to select it; press **Enter** (or double-click) to edit”; §18 (link fields): “Open the cell (Enter, double-click, or **Choose linked rows…** in the cell menu)”.
- `docs/shortcuts.md`: Enter = “Edit cell / Commit”.

**What the code does** (`src/views/tableView.ts`)

| Trigger | Behaviour | Line |
|---|---|---|
| Click a cell | `setSelection` + `grid.root.focus()` — **selects only, never edits** | `GridView.ts:332–341`, `onCellClick` passed at `tableView.ts:511` |
| Double-click | **No listener anywhere in the main view.** `git log -S "dblclick" -- src/` → only `5872950` (P7-01, `embedView.ts:198`) | — |
| Enter (keyboard) | `enterEdit` → `startEdit(sel)` — the **only** edit trigger; gated by `shouldHandleForGrid` (`gridRoot.contains(activeElement)`) | `keyboard.ts:40`, `tableView.ts:602–625` |
| Touch tap | Selects only (same click path) | — |
| Touch long-press | Opens cell menu — Copy / Paste / Clear / link items. **No Edit item** | `tableMenuModel.ts:75–110`, `tableView.ts:715` |

So:

1. **Desktop mouse users** — the documented double-click does nothing. Enter works *if* the grid root has focus (`tabIndex = 0` is set, `tableView.ts:551`), but nothing in the UI tells them that after a double-click fails. Symptom = “I cannot edit the content of any cell.”
2. **Mobile users** — literally no way to open an editor: no Enter key in the flow, no Edit menu item, tap only selects. The README’s “Works on desktop and mobile” claim fails here.
3. **Checkbox cells** — the prototype toggles on click (`Prototype/script.js` `cellClick`: `ft.editor === 'checkbox'` toggles); the plugin requires Enter → editor → toggle.

**Why 1545 tests are green anyway**

- `tests/views/tableView.test.ts:447` “lets the first cell be edited immediately” dispatches `keydown Enter` on the grid root — it tests the *only* path that exists.
- `tests/views/grid/editors.test.ts` calls `createEditor()` directly.
- **No test ever simulates a click / double-click / tap → editor**, so the gap is invisible to the suite. (Fix must add these tests first — §4.)

**What the prototype does** (source of truth for the SAD-82 programme)

`Prototype/script.js` `cellClick` (~line 654): a **single click** on an editable cell starts editing immediately (`startEdit(rowId, fieldId)`), opening the per-type surface (inline editor / `openSelectPanel` / `openAttachmentPanel` / `openLinkPanel`); shift-click extends a range; checkbox toggles; read-only types toast. Enter on the focused cell also edits (~line 1953). The prototype’s cell context menu is Copy/Paste/Clear only — it has no Edit item because the click *is* the edit affordance.

> **Design decision (D-1, needs owner input — see §5):** the programme rule is “match the prototype as closely as possible”, which means **click-to-edit**. The shipped docs (README/user-guide) promise **double-click-to-edit** with click = select. The plan below ships the documented double-click behaviour first (zero conflict with range selection and row drag), and lists prototype click-to-edit as a follow-up switch once the owner confirms.

### 2.2 SAD-97 — “The right-click context menu is not appearing as expected”

**Primary bug — the touch-dedupe window eats mouse right-clicks**

`src/views/tableView.ts`:

- `wirePressEvents` (P5-03, `82ba5f7`):
  - `pointerdown` (line 677–683): stamps `lastTouchAt` **only for touch** (`if (… || e.pointerType !== 'touch') return;`) ✔
  - `pointerup` (line 686–688): stamps `lastTouchAt = Date.now()` — **unconditional, for mouse and pen too** ✘
  - `pointercancel` (line 690–691): same unconditional stamp ✘
- `onContextMenu` (line 647–652):
  ```ts
  if (Date.now() - this.lastTouchAt < 1500) { e.preventDefault(); return; }
  ```
  Introduced to suppress the *native touch* context menu that follows a long-press (so the menu does not open twice, P5-03).

**Desktop event order** (Chromium, all platforms): `pointerdown (button 2)` → `contextmenu` → `pointerup (button 2)`. The guard is evaluated *before* the right-click’s own `pointerup`, so it compares against the **previous** pointer interaction — and users almost always click (select) a cell first. Even without that: the right-click’s `pointerup` re-stamps the clock, so every repeated right-click inside 1.5 s stays suppressed. The menu only appears after ~1.5 s of pointer quiet — exactly “not appearing as expected”.

Reproduction (deterministic): click any cell → right-click it within 1.5 s → nothing. Wait 1.5 s → right-click → menu appears. Right-click twice in a row quickly → second one swallowed.

**Secondary bug — document-level `blockMenu` can leak and then kill every context menu in Obsidian**

`src/views/grid/GridView.ts` `startRowDrag` (line 894–951):

- On any pointerdown on the `#` drag handle it immediately adds `doc.addEventListener('contextmenu', blockMenu, true)` (line 947) — capture phase, `preventDefault + stopPropagation`.
- It is removed only in `cleanup()` via `pointerup` / `pointercancel` (line 913).
- If neither event is delivered (window blur mid-press, browser quirks, drag ending outside the window), the capturing listener **persists for the whole session** and blocks every right-click anywhere in the app (document scope).
- Also: the listener is armed *before* the drag threshold is crossed, so even a simple tap on `#` briefly arms it — harmless when `pointerup` arrives, catastrophic when it doesn’t.

**Tertiary parity gap (small)** — right-click on the row-number/checkbox lead returns `false` from `openMenuFromTarget` (`tableView.ts:658–671`) and falls through to the **native** menu. The prototype opens the row menu for any target inside the row (`tr[data-row]`). Fold into the SAD-97 fix.

**Not the cause (ruled out):** menu construction (`buildTableMenu` → `Menu`, used identically by the keyboard Menu-key path that works), `showAtMouseEvent`, the SAD-90 panels (they live in `document.body` and only open for select/attachment cells), and the `⋮` header button (its own `click` handler, `GridView.ts:787`). Presentation swap to prototype cards is **SAD-91 scope**, not this bug — the fix here is about the menu *appearing*, whatever its skin.

---

## 3. Fix plan

Convention per `spec/guidelines.md` and SAD-75…SAD-92: **failing test → fix → evidence → commit**, `npm run check` green at every step, `main.js` rebuilt before release, house-style CHANGELOG entry.

### Step 1 — Reproduce both bugs as failing tests (red)

New/extended tests (jsdom + `tests/__mocks__/obsidian.ts`):

1. **Edit triggers** (`tests/views/tableView.test.ts` or new `tests/views/grid/editTriggers.test.ts`):
   - double-click a text cell → `input.tablify__editor` appears; commit/cancel round-trip.
   - double-click a select cell → select panel opens (SAD-90 path); attachment likewise.
   - tap (pointerdown/up `pointerType: 'touch'`) an editable cell → editor opens (mobile).
   - long-press still opens the cell menu; the menu now contains **Edit cell**.
   - click a checkbox cell → toggles value in one undoable step.
   - Enter path unchanged (existing test keeps passing).
2. **Context menu** (`tests/views/tableView.test.ts` / `tests/views/grid/`):
   - mouse `pointerup` then immediate `contextmenu` on a cell → `buildTableMenu` shown (regression test for the 1.5 s window).
   - two rapid `contextmenu` events → both open.
   - touch long-press then native `contextmenu` → still suppressed (P5-03 behaviour preserved).
   - row-drag `blockMenu`: after a pointerdown on `#` with no `pointerup` (blur/`pointercancel` missing), a later `contextmenu` must still open the menu (leak test); during an *active* drag it stays suppressed.
   - right-click on the row lead → row menu (parity).

Acceptance: tests fail exactly on the behaviours in §2; no test modified to pass artificially.

### Step 2 — SAD-97: context menu (½ day)

1. **`tableView.ts:686–692`** — stamp `lastTouchAt` only when `e.pointerType === 'touch'` in `pointerup`/`pointercancel` (mirror the `pointerdown` guard at line 680). Keep the 1500 ms window for touch only.
2. **`tableView.ts:650`** — additionally record the last pointer *type* (`lastPointerType`); suppress the native follow-up only when the menu was touch-originated. Belt-and-braces: keep the time guard, but it can no longer fire for mouse.
3. **`GridView.ts:904–947`** — harden `blockMenu`:
   - gate the handler on the drag being `active` (or arm it only after the threshold is crossed at line ~918);
   - move the listener from `doc` to `this.root` where possible (the menu to suppress is the grid’s own), or keep `doc` but add a capture-phase `pointerup` teardown fallback;
   - ensure `cleanup()` is also invoked from `cancelRowDrag` on view teardown (`GridView.destroy` if present).
4. **Row-lead parity** — `openMenuFromTarget`: treat `.tablify__lead` / row targets as row-menu targets (prototype `tr` behaviour).
5. Keep the keyboard Menu-key / Shift+F10 path untouched (it works and must keep working).

Acceptance: Step-1 menu tests green; manual matrix — right-click after click, rapid right-clicks ×3, right-click on header `⋮` area vs header body, `#` handle, frozen column, during scroll; touch long-press opens exactly one menu; `npm run check` green.

### Step 3 — SAD-96: cell editing (1 day)

1. **Double-click → edit** (the documented contract):
   - Add a delegated `dblclick` listener on `grid.root` (same target resolution as the click handler, `GridView.ts:332`) → `onCellActivate(row, col)` → `tableView.startEdit({row, col})` — `startEdit` already routes per type (inline editor / SAD-90 panels / link picker) at `tableView.ts:908–945`.
   - Keep click = select + focus (range select and `#` row-drag stay intact).
2. **Edit affordance in the cell menu** (`tableMenuModel.ts` `cellMenu`, ~line 75): add `cell.edit` (“Edit cell”, disabled with a reason for read-only/system/formula fields) → `runMenuAction` maps it to `startEdit`. This is also the **mobile fallback** and the discoverability fix for desktop.
3. **Mobile tap-to-edit**: on `pointerup` of a *touch* tap that lands on the selected cell’s capsule (second tap), call `startEdit` — or, simpler and closer to the prototype, treat a touch tap on an editable cell as select-and-edit (D-1). Guard: never on the `#` drag handle or checkboxes; long-press keeps opening the menu and suppresses the click (`suppressClick` already exists, `tableView.ts:704`).
4. **Checkbox click-toggle** (prototype parity): click on a checkbox cell toggles the value through `setValue` (one undo step) instead of merely selecting; Enter keeps opening the editor.
5. Re-verify every `startEdit` branch from the new triggers: text/number/date/select/attachment (panels), link (picker), formula/system (refused with a reason, never a dead click).
6. Focus hygiene: after the editor closes, focus returns to `grid.root` (already in the `onDone` callback, `tableView.ts:937`).

Acceptance: Step-1 trigger tests green; every type reachable by mouse and by touch; docs already promise this behaviour so no doc change needed (except `docs/shortcuts.md` gets a “Double-click / tap: edit cell” row); `npm run check` green; a11y suites (`axeGrid`, `keyboardCoverage`, `ariaGrid`) green — the new menu item needs its disabled-reason pattern like the others.

### Step 4 — Verification, evidence, release (½ day)

1. `npm run check` (lint + 1545+ tests + guards + docs links + icons + build).
2. Visual spot-check: `npx tsx tests/visual/capture-states.ts` — the editing/interaction states measured by SAD-85/92 must not regress (the editor overlay and menu cards are in those crops).
3. Evidence docs `docs/evidence/SAD-96.md`, `docs/evidence/SAD-97.md` (SAD-85/86 format: root cause, fix, measurements, manual matrix).
4. CHANGELOG `[Unreleased]` entries in the house style (the SAD-95 register): one entry per issue, user-facing prose, evidence cross-links.
5. Rebuild and commit `main.js` (repo rule — the shipped plugin is the committed bundle).
6. Linear: move SAD-96/SAD-97 to In Progress at Step 1, Done at Step 4 with evidence + commit links in comments; both are due for the project’s 2026-10-15 target.

**Order:** Step 1 → SAD-97 (Step 2) first — it is smaller, and a working context menu is needed to verify SAD-96’s menu-item fix manually — then SAD-96 (Step 3), then close-out (Step 4). One commit per step on `main`, per the programme convention.

---

## 4. Risks

1. **Click-to-edit vs double-click-to-edit (D-1).** If the owner wants full prototype parity (single click edits), range selection UX changes (prototype uses shift-click for ranges). Plan ships double-click first; switching later is a one-line trigger change plus test updates.
2. **Touch tap-to-edit vs scroll.** A tap that starts a scroll must not open an editor — reuse `LongPressDetector`’s move threshold (`press.pointerMove`) so a moved touch never edits.
3. **`blockMenu` hardening** must not re-enable the long-press-on-handle row menu mid-drag (the reason it exists) — the active-drag gate covers this; verify with the SAD-80 drag tests.
4. **Rebuild `main.js`** — forgetting it ships the old bundle (called out in the visual-fidelity plan §9 too).

---

## 5. Decisions needed from the owner

| # | Question | Recommendation |
|---|---|---|
| D-1 | Double-click-to-edit (matches README/user-guide) or prototype single-click-to-edit? | Ship double-click now (docs contract); evaluate click-to-edit after these P1s are fixed |
| D-2 | Should checkbox cells toggle on click (prototype) or open the editor? | Toggle on click — matches prototype and is what Airtable users expect |

---

## 6. Tracker discrepancy noticed during analysis (not part of this fix)

The 2026-10-12 “Linear status audit” closed **SAD-91** (Step 12: validation display + `#invalidBadge`, prototype context-menu cards, linked-record peek) and **SAD-93** (Step 14: desktop residue sweep) at 06:42, but `main` @ `830e692` contains none of that work: `validationDisplay.ts` is still imported by tests only, `tableMenu.ts` still builds Obsidian’s native `Menu`, and no peek card exists. SAD-95’s own body (written at 06:37 the same morning) lists “Step 12, Step 14” as *remaining*. Recommend reopening SAD-91/SAD-93 (or converting them to the agreed close-out tracking) so the programme’s remaining work is not lost — orthogonal to SAD-96/97, but both bugs sit on the same interaction layer those steps will touch.

---

## 7. Reproduction commands

```bash
npm ci
npx vitest run                                   # baseline: 95 files / 1545 tests green
# SAD-97: click a cell, right-click within 1.5 s -> no menu; wait 1.5 s -> menu
# SAD-96: double-click any cell -> nothing (no dblclick wiring); on mobile there is no edit path at all
```
