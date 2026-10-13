# Tablify — SAD-107 / SAD-108 / SAD-109 fix plan

**Date:** 2026-10-13 · **Repo:** `258044aamm-Dev/Tablify` @ `e10bd3b` (v2.0.0-beta.2 + SAD-96..100 fixes) · **Mode:** plan only (not executed)
**Linear:** project *Tablify* (`94bfabaa`). All three issues are in state **Todo**, priority High, labelled Bug / Improvement, assigned to MD Limon Islam. None has comments or a detailed description.

| Issue | Title | Label | Linear description |
|---|---|---|---|
| **SAD-107** | Sync button displays ununderstandable overlay | Bugs, Improvement | "clicking the Sync button displays a overlay whose content is difficult to read… Use appropriate colors, sufficient contrast, clear typography, and a user-friendly layout. Preserve the existing synchronization functionality." |
| **SAD-108** | drag-and-drop button | Improvement | "The drag-and-drop button is currently always visible… remains hidden by default and appears only when the user hovers over the relevant element… disappears when the cursor moves away." |
| **SAD-109** | Fix Duplicate Tooltips | Bug | "Fix Duplicate Tooltips" (no further detail — see §5, decision D-3) |

**Baseline:** not run in this step (no `npm ci`). Prior plan recorded 97 files / 1562 tests green at `e10bd3b`-era; re-run `npm run check` before and after.

---

## 1. Verdict

- **SAD-108** is a CSS visibility change with one real constraint: touch devices have no hover, so "appears on hover" must be gated by `(hover: hover)`. Otherwise the grips become undiscoverable on mobile, which breaks the row-drag path the README advertises.
- **SAD-109** is most likely caused by elements that set **both** `title=` and `aria-label=` to the same text. Obsidian renders its own popover for `aria-label`, and the browser renders a native tooltip for `title`, so hovering shows two. This is a hypothesis from code reading; it must be confirmed in Obsidian before the fix (Step 1).
- **SAD-107** is a readability problem, not a logic problem. The sync modal has almost no styling of its own, and its error and secondary text fail WCAG AA in the light theme. Sync behaviour is not touched.

Estimated effort: SAD-108 ≈ ½ day, SAD-109 ≈ ½ day, SAD-107 ≈ 1 day, verification ½ day.

---

## 2. Root-cause analysis

### 2.1 SAD-108 — drag-and-drop button always visible

Two always-visible drag affordances exist, both drawn by `GridView.ts`:

| Element | Created at | CSS (`styles.css`) | Current visibility |
|---|---|---|---|
| Row-number drag grip (`#` cell) | `GridView.ts` `rowGrip()` (~686) and row render (~1264–1269) | `.tablify__lead-grip` (~2225): `font-size: 8px; color: var(--tablify-text-placeholder)` | Always rendered, always visible |
| Column header grip | `GridView.ts` `buildHeaderCapsule` (~767–773) | `.tablify__hc-grip` (~2019): `color: var(--tablify-text-faint)` | Always rendered, always visible |

The `#` cell itself is the drag handle (`.tablify__lead--drag`, ~2270), so the grip glyph is only a visual cue. Hiding the glyph does not remove the drag behaviour.

**Conflict with the programme rule.** The prototype (`Prototype/script.js` ~487 and ~592) renders both grips always. The SAD-82 programme says "match the prototype". SAD-108 asks for a deliberate deviation. The plan treats the Linear issue as the owner decision and records the deviation (D-1).

### 2.2 SAD-109 — duplicate tooltips

Confirmed in code: the same element receives both a native `title` and an `aria-label` with the same text.

| File:line | Element | `title` | `aria-label` |
|---|---|---|---|
| `src/views/grid/toolbar.ts:297–298` (`makeButton`) | every toolbar button, including **Sync**, Filter, Add row, Options | `title` | same text |
| `src/views/grid/toolbar.ts:726–733` | hide/show field buttons | `title` (primary-field case) | same element |
| `src/views/grid/select/OptionManager.ts:300–301` | Delete option | `title` | `Delete <name>` |
| `src/views/grid/select/OptionManager.ts:319–320` | move / colour buttons | `title` | same text |
| `src/views/grid/filterBuilder.ts:392–393` | Remove condition | `title` | same text |
| `src/views/grid/GridView.ts:824–825` | header field-menu `⋮` | `title = 'Field menu'` | `Field menu: <name>` |

Not duplicates (listed to rule them out): header grip, key, badge, resize handle, sort button and row grip each carry a single `title` and no `aria-label`.

Secondary observation: `src/views/grid/validationDisplay.ts` `applyValidationState()` is the only place that sets the validation tooltip, and a search of `src/` finds **no call site**. The invalid-cell tooltip described in `docs/user-guide.md` §130 may therefore never show. Treat this as a related finding to confirm (D-4); it is not the cause of "duplicate" tooltips.

### 2.3 SAD-107 — Sync modal overlay is hard to read

Code: `src/views/sync/SyncModal.ts` (rendering) and `styles.css` ~2367–2403 (`.tablify-sync__*`). The Sync button opens it from `toolbar.ts:206/396` → `tableView.ts:386` → `main.ts:55`.

Measured WCAG contrast against the card background (computed from `src/ui/theme/tokens.ts` values; `#FFFFFF` light card, `#22201D` dark card):

| Text | Light | Dark | AA (4.5:1) |
|---|---|---|---|
| Primary ink | 17.14:1 | 13.22:1 | pass |
| Muted ink (`mutedLight` / `mutedDark`) | 5.71:1 | 6.40:1 | pass |
| **Error status** (`--tablify-accent-primary` = terracotta `#CC785C` light, `#d97757` dark) | **3.28:1** | 5.20:1 | **fail in light** |
| Grip / faint (`#B7B2AE`) | 2.10:1 | — | fail (decorative only) |
| Placeholder (`#4B5563` dark) | — | 2.15:1 | fail (placeholder only) |

Further problems visible in the code:

1. **Unstyled container.** `.tablify-sync__*` rules are not scoped under `.tablify`, and the modal only sets `background`, `border`, `border-radius` (`.tablify__modal`, ~1118). Buttons, selects and checkboxes fall back to Obsidian defaults, so the modal does not use the plugin's tokens or spacing.
2. **Dimmed text.** `.tablify-sync__token`, `__scopes`, `__last` use `opacity: 0.8`, which lowers the effective contrast further.
3. **Long run-on lines.** The scopes line joins three scopes plus a sentence about `schema.bases:write` in one 11px line. Status messages are 12px with no structure.
4. **Italic progress line.** `.tablify-sync__progress` is 11px italic.
5. **No contrast coverage.** `tests/ui/contrast.test.ts` does not cover the sync modal (grep finds no `sync` or `modal` references), so the failure is invisible to the suite.

What must not change: every action path (`link`, `unlink`, `pull`, `push`, `resolveConflict`, `createFields`), the token-never-shown rule, and the error-message redaction (`redactSecrets`). Existing tests in `tests/views/syncModal.test.ts` assert on text content and button labels, so wording changes need test updates.

---

## 3. Fix plan

Convention (as in `docs/plans/sad-96-sad-97-fix-plan.md`): **failing test → fix → evidence → commit**, `npm run check` green at every step, `main.js` rebuilt, CHANGELOG entry under `[Unreleased]`.

### Step 1 — Reproduce and pin the behaviour (red tests + evidence)

**SAD-109 (confirm the cause first):**
1. In a dev vault with the plugin loaded, hover the Sync button, a toolbar button and the `⋮` field menu. Record whether Obsidian's own tooltip and the native tooltip both appear. Save screenshots to `docs/evidence/SAD-109/`. **If only one tooltip appears, stop and re-scope SAD-109 (D-3).**
2. Test (jsdom, `tests/views/toolbar.test.ts`, `tests/views/grid/grid.test.ts`): no element in the grid, toolbar, option manager, filter builder or field menu carries both `title` and `aria-label`. This fails today on the six sites in §2.2.

**SAD-108:**
3. CSS-contract test (new `tests/ui/hoverGrips.test.ts`, same style as `tests/ui/faIconBox.test.ts`): parse `styles.css` and assert that `.tablify__lead-grip` and `.tablify__hc-grip` have `opacity: 0` (or `visibility: hidden`) by default, and are revealed under `@media (hover: hover)` on `.tablify__row:hover` / `.tablify__header-cell:hover`, plus `:focus-within` and `.tablify__row--dragging`. Fails today.
4. Behaviour test: while a row drag is active, the grip stays visible on the dragged row (`tablify__row--dragging`).

**SAD-107:**
5. Contrast test (extend `tests/ui/contrast.test.ts`): every sync-modal text role (`.tablify-sync__status--error`, `__token`, `__scopes`, `__last`, `__progress`, `__skipped`) meets AA against `--tablify-bg-card` in both themes. Expect the light error colour to fail (3.28:1).
6. Keep the existing `syncModal.test.ts` behaviour tests unchanged; they are the "preserve sync" guard.

Acceptance: new tests fail on the behaviours in §2; no existing test is weakened.

### Step 2 — SAD-108: hover-revealed drag grips (½ day)

1. `styles.css`:
   - Base state: `.tablify__lead-grip` and `.tablify__hc-grip` `opacity: 0`, keeping their layout box so columns do not shift.
   - `@media (hover: hover)`: reveal on `.tablify__row:hover > .tablify__lead--drag .tablify__lead-grip` and `.tablify__header-cell:hover .tablify__hc-grip`. Transition 120 ms.
   - Keyboard and focus: reveal on `:focus-within` of the grid root.
   - Active drag: keep visible on `.tablify__row--dragging` and on the header cell with `.tablify__header-cell--dragging`.
   - **Touch (`hover: none`)**: keep the grips visible. Touch users have no hover, so hiding them would remove the only visual cue for the drag handle.
2. No DOM or JS change. The `#` cell and header grip remain the drag handles, so behaviour is unchanged.
3. Visual check with `tests/visual/capture-states.ts` (hover state already exists in `docs/evidence/visual-parity/sad-92/states-insertrow-hover-3x.png`) plus a new mobile capture.

Acceptance: grips invisible at rest on desktop; appear on row/header hover and disappear on mouse-out; always visible on touch; row and column drag still work (existing `rowSelection.test.ts`, `grid/geometry.test.ts`, drag tests green).

### Step 3 — SAD-109: remove duplicate tooltips (½ day)

Rule chosen: **one tooltip per element.** Elements keep `aria-label` for the accessible name (screen readers, Obsidian's popover). The native `title` is removed where `aria-label` already carries the same text.

1. `src/views/grid/toolbar.ts:297–298`: keep `aria-label`, drop `btn.title`. Do the same for the `title` set on the primary-field hide button (line ~733), which already has an `aria-label`.
2. `src/views/grid/select/OptionManager.ts:300–301, 319–320`: drop `title`.
3. `src/views/grid/filterBuilder.ts:392–393`: drop `title`.
4. `src/views/grid/GridView.ts:824–825`: drop `menu.title`; keep the `Field menu: <name>` `aria-label`.
5. Alternative, if Step 1 shows Obsidian's popover is the one users prefer: use Obsidian's tooltip API (`setTooltip`) instead of `title` on visual-only buttons. Check the installed typings first; the repo declares `obsidian ^1.5.0`.
6. Decide on the validation tooltip (D-4): either wire `applyValidationState` into the grid render path (it currently has no caller), or leave it and record it in CHANGELOG known limitations.

Tests: the Step 1 no-double-tooltip test turns green. Add a test that the `aria-label` on each of these buttons is unchanged (accessibility is not regressed).

Acceptance: hovering any toolbar, option, filter or field-menu button shows one tooltip; screen-reader names unchanged; `npm run check` green.

### Step 4 — SAD-107: readable sync modal (1 day)

Keep the logic and the wording of actions. Change only the presentation.

1. **Scope the styles.** Move `.tablify-sync__*` under `.tablify` (or apply `tablify` to the modal, as `.tablify__modal` already does for the card) so tokens apply.
2. **Contrast fixes.**
   - Error status: use the **ink** for error text and a left accent bar (`border-left: 3px solid var(--tablify-accent-primary)`), not the accent colour as text. This keeps the terracotta accent without the 3.28:1 text.
   - Remove `opacity: 0.8`; use `var(--tablify-text-muted)` (AA in both themes).
3. **Typography and layout.**
   - Split the scopes line into a list of three scope names, each on its own line, followed by one line for "create fields" scope, in 12px.
   - Give the status, progress and last-sync rows fixed spacing and a clear heading (`Status`, `Last sync`).
   - Progress: non-italic, 12px, with an accessible `role="status"`.
   - Keep the plan-cancel default focus behaviour (`cancelButton.focus()`).
4. **Buttons.** Use plugin button classes for Pull, Push, Link, Unlink, Check fields, Create fields, and the conflict choices, so spacing and focus rings match the rest of the plugin.
5. **Overlay.** Keep Obsidian's modal backdrop (it is the standard). Cap the width (`min(560px, 100vw - 32px)`) and allow vertical scroll so long conflict lists do not overflow on mobile.
6. **Do not change:** `SyncModal` action methods, `redactSecrets` use, token-status wording ("stored in Tablify settings"), conflict choice labels (`Keep local`, `Keep remote`, `Keep both`, `Remove row`), or the `changed` callback.

Tests:
- Contrast test from Step 1 green in both themes.
- `syncModal.test.ts` green without edits to assertions (button labels and text remain).
- Visual capture of the modal (`tests/visual/capture-modals.ts`) in light/dark, desktop/mobile, with before/after evidence in `docs/evidence/SAD-107/`.

Acceptance: contrast passes AA for every sync text role; all sync behaviour tests green; the modal reads top-to-bottom with clear headings on desktop and mobile.

### Step 5 — Verification and close-out (½ day)

1. `npm run check` (lint, vitest, guard, docs links, icons, build).
2. Manual matrix: desktop light/dark, mobile emulation (touch), keyboard only.
   - SAD-108: hover on row and header; touch shows grips; drag still reorders.
   - SAD-109: each button in §2.2 shows one tooltip.
   - SAD-107: open Sync with no token, with token but unlinked, linked with conflicts.
3. CHANGELOG under `[Unreleased]`, one entry per issue.
4. One commit per issue (SAD-108, SAD-109, SAD-107), each pushed and posted to its Linear issue as a comment with the evidence link, mirroring SAD-96/97 and SAD-98/100.

---

## 4. Risks

| Risk | Mitigation |
|---|---|
| Hover-only grips are not discoverable on touch | `hover: none` keeps them visible (Step 2) |
| Removing `title` loses the native tooltip for keyboard-only users | `aria-label` is kept; `:focus-visible` tooltip behaviour verified in Step 5 |
| Sync CSS scoping changes the modal's look on the host theme | Visual before/after in Step 4; contrast test in both themes |
| Visual-parity programme (SAD-82) regresses | Re-run `npm run visual:compare` after Steps 2 and 4 |

---

## 5. Decisions needed (defaults in brackets)

- **D-1 (SAD-108) — which grips hide?** [Both the `#` row grip and the header column grip hide on hover; both stay visible on touch and while dragging.] Hiding them departs from the prototype's always-visible grips. Confirm this is intended.
- **D-2 (SAD-107) — what counts as "the Sync overlay"?** [The sync modal (`SyncModal`) opened by the toolbar Sync button.] Confirm there is no other overlay (for example the Options panel or the select panel) that is meant.
- **D-3 (SAD-109) — which tooltips are duplicated?** [The double `title` + `aria-label` pattern in §2.2.] The Linear issue has no detail. A screenshot of a duplicate would confirm this in one step; if Obsidian shows only one tooltip, SAD-109 needs re-scoping before any code change.
- **D-4 (SAD-109, related) — validation tooltip.** [Wire `applyValidationState` into the grid, because `docs/user-guide.md` promises it.] Alternative: record it as a known limitation and leave it out of this change.

---

## 6. Out of scope

- Changing sync behaviour, conflict rules or the Airtable client.
- Prototype click-to-edit (SAD-96 D-1) and the card-based header redesign (SAD-91).
- Any change to `.tabula` handling (none, by design).

---

## 7. Execution status

| Issue | Commit | Linear state | Linear comment |
|---|---|---|---|
| SAD-108 drag grips on hover | `c7dd671` | Done | posted |
| SAD-109 duplicate tooltips and validation marker | `695ce1d`, `77706ce` | Done | posted |
| SAD-107 readable sync modal | `a849fcb` | Done | posted (`ba72346b`) |

Every commit is pushed to `main`. Decisions D-1 to D-4 were confirmed as written in §5.
Visual check: SAD-107 before and after headless Chromium captures were taken in light and dark themes. The after capture shows the card styled and the text readable.
