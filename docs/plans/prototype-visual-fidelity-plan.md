# Tablify — Prototype Visual Fidelity: analysis & plan (PLAN ONLY)

**Date:** 2026-10-11 · **Repo:** `258044aamm-Dev/Tablify` @ `6dbdf00` (2.0.0-beta.1) · **Mode:** plan only — no product code changed
**Source of truth:** `Prototype/index.html` (482 lines) + `script.js` (2871 lines) + `style.css` (73 lines)
**Owner programme:** Linear project *Tablify — Prototype Visual Fidelity + New-Table Defaults* (`ca502e82`, 70 %), parent issue **SAD-82** (In Progress; sub-issues SAD-85 ✅, SAD-86 ✅, SAD-87 🚧, SAD-88 ⬜, SAD-89 ⬜)
**Measured with:** `npx tsx tests/visual/capture-compare.ts` (32 combos: dark/light × owner 1568×795 / mobile 390×844 × new/populated × default/options/selected/grouped) + `capture-modals.ts` + `capture-add-field.ts`; `npx vitest run` = **92 files / 1524 tests green**; raw output kept in `docs/evidence/visual-parity/plan-baseline-2026-10-11/`.

**Owner decisions resolved 2026-10-11 (this session):**

| # | Decision | Answer |
|---|---|---|
| D-1 | Mobile toolbar at ≤ 639 px | **Match the prototype exactly** — buttons shrink, labels wrap, toolbar 102 px, no horizontal scroll |
| D-2 | Context menus / toasts | **Prototype card for the three context menus** (icons, separators, rose danger); **`Notice` stays for toasts** (existing D5 precedent, recorded as a permanent deviation) |
| D-3 | The two orphaned modules | Plan assumes **wire them** (`SelectDropdown`, `OptionManagerDialog` are tested and match the model layer; only presentation is rebuilt) — confirm at Step 11 |
| D-5 | Missing owner screenshots | **Proceed without them** — the prototype is the source of truth and the harness reproduces the same vault conditions |
| — | Scope of the next session | **Steps 10 → 14, all of it**, in order |

---

## 1. Verdict

The visual-fidelity programme is **~75 % done and the remaining work is well-defined** — this is not a from-scratch restyle. Measured against the prototype with the repo's own harness:

* **Desktop (1568×795) is essentially at parity already.** 14 of 23 compared regions are at **≤ 0.5 %** pixel diff (the acceptance bar) — including the whole card, title row, file chip, header capsules, body capsules, insert-row, checkboxes, options panel and the grid shell (0.17–0.38 %).
* **9 desktop regions still exceed the bar**, all ≤ 7 %: type badge in the grouped state (6.86 / 7.05 %), group header (5.73 %), selection summary (5.04 %), Sync (3.40 / 3.80 %), Options (1.41 %), toolbar row (1.28 %), undo/redo (0.78–0.92 %), row number (0.52–0.63 %).
* **Mobile (390×844) is far off** — 20–60 % on toolbar buttons, 34–43 % on the grid shell, and the card is **16 px shorter** than the prototype. This is a **single, diagnosed root cause** (the plugin forbids the toolbar buttons from shrinking/wrapping; the prototype lets the labels wrap), not 12 separate defects.
* **Three prototype surfaces have no plugin counterpart at all**: the select/option dropdown panel, the option-manager dialog and the attachment panel. Two of them already exist as **unused, tested code** in `src/views/grid/select/` that no production file imports.
* **Validation states (Feature 10) are documented but not rendered**: `src/views/grid/validationDisplay.ts` is imported by tests only — no cell ever gets the invalid state, and the prototype's `#invalidBadge` has no plugin sibling.
* **Three dialogs are still Obsidian-styled** — Export, Import and Sync. Already tracked as **SAD-87/88/89**; their prototype layouts (`#exportModal`, `#importModal`, `#syncModal`) are unchanged since the parity programme started.
* **Prototype-only content is already clean in `src/`** — `tests/ui/noPrototypeAnnotations.test.ts` guards “Feature N / simulated / UI-only / spec §”, and the built `main.js` contains no `Feature N` string. What remains is in the **prototype**, not the plugin, and must simply not be copied (see §8).

**Bottom line:** finish the four open sub-issues, then close five specific gap groups (§3 A–E). Everything below is measured, reproducible with one command, and carries a test-first requirement.

---

## 2. What is already at parity (do not touch)

| Region | Measured (dark / light, owner) | Notes |
|---|---|---|
| `card` | size-identical 1520×480; `box-shadow` string differs only | Tailwind's multi-shadow normalisation — renders identically (§3 C-note) |
| `title-row`, `title`, `file-chip` | 0.33–0.35 % / — / — | SAD-77 |
| `search` | 890×38 vs **889×38**, radius `999px` vs `9999px` | §3 C |
| `grid-shell` | 0.06–0.18 % | SAD-79 |
| `header-capsule`, `header-name`, `header-num`, `body-cell`, `row-number` | 0.00–0.63 % | `row-number` 0.52–0.63 % is FA-glyph advance (§3 C-note) |
| `insert-row`, `header-check`, `row-check` | 0.00–0.05 % | SAD-79/80 |
| `options-panel` | 0.21–0.22 % | SAD-81 |
| `btn-add-row`, `btn-add-field`, `btn-filter` | 0.00–0.10 % | desktop only; mobile broken (§3 D) |
| `card`/`toolbar` structure, 5 fields × 3 rows default | verified | SAD-84 |

Interaction states already implemented and verified: cell focus (SAD-79), row selection + bulk delete + drag reorder (SAD-80), group headers/chips (SAD-81), editing and invalid *styling* (SAD-85), modal card shell (SAD-85), Add Field layout (SAD-86), 6 px themed scrollbars.

---

## 3. Gap register (prototype → plugin), with measurements

### A. Prototype surfaces that have no plugin UI (or only dead code)

| # | Prototype | Plugin today | Consequence | Proposed step |
|---|---|---|---|---|
| A1 | **Select cell panel** — `openSelectPanel` / `renderSelectPanel` (script.js 891–985): anchored panel, search box, option list with colour chips, “Create …”, *Clear*, *Manage options* link | Select cells open a **plain text editor** (`editors/index.ts` 75–79: “full dropdown is P3-03”); `SelectDropdown` (89 lines) exists **but nothing in `src/` imports it** | The most-used prototype interaction is missing; colour chips are replaced by comma text | Step 11 |
| A2 | **Option manager dialog** — `#optMgrModal` (index.html 291–307): palette glyph, one row per option (swatch / name / ↑ ↓ / 🗑), “New option…” + Add, “Changes are undoable” | `OptionManagerDialog` exists, **unused outside tests**; `docs/user-guide.md:122` documents the feature | Documented feature has no UI (**functional gap, not only visual**) | Step 11 |
| A3 | **Attachment panel** — `openAttachmentPanel` (987–1039): path input, list of attachments, remove | `attachment.ts` normalises/validates paths; **no panel** | Attachment cells are edited as raw text | Step 11 |
| A4 | **Invalid state + `#invalidBadge`** — `validateCell` / `computeInvalid` (1982–2024), `.cell-invalid` (rose border), meta-row badge with a hover reason | `validationDisplay.ts` (28 lines) is **imported by tests only**; no cell ever receives the class; no badge | Feature 10 is invisible in the real UI; the SAD-85 style is “ready but unused” | Step 12 |
| A5 | **Context menu cards** — `menuShow` (2035–2045): custom floating card, 195 px min-width, **a terracotta icon per item**, separators, rose “Delete row/field” | Items exist (P5-02, `src/menus/tableMenuModel.ts`) but render in **Obsidian's native `Menu`** | Item *sets* nearly match; the *appearance* (icons, colours, geometry) does not | Step 12 (decision D-2) |
| A6 | **Linked-record peek** — `#peekModal` / `openPeek` (2617–2645) | Link cells have a picker + chips; **no read-only peek** | Clicking a chip cannot show the linked row’s fields | Step 12 |
| A7 | **Toast** — `#toast` (bottom-centre capsule, terracotta ring) | Obsidian `Notice` (accepted deviation D5, SAD-71) | **D-2 decided: keep `Notice`.** Record once as a permanent, accepted deviation | — (closed) |
| A8 | **Shortcuts popover** — `#shortcutsBtn` header → `openShortcuts` | Shortcuts documented in `docs/shortcuts.md` only | Prototype’s header is out of scope (S-1) — no plugin surface planned | — (closed) |
| A9 | **Note/reading-view demo** (Feature 18), **file-source panel** (F1), **vault sidebar + file/folder menus** (F16), **dataset tabs, “Saved locally”, New Table, Checklist, brand header, footer, theme switch** | Plugin has a *real* embed view (`src/embed/embedView.ts`) and real Obsidian menus/vault | Prototype-only chrome — excluded by S-1/PD-2/SAD-72 §8; the embed itself needs an **evidence route**, not new UI | Step 13 |

### B. Dialogs that exist but are not in the prototype layout (already tracked)

| # | Prototype | Plugin today | Issue | Prototype card |
|---|---|---|---|---|
| B1 | `#exportModal` 382–409: “Export table”, *Scope* radios (Current view / Full table), **three pill format buttons** (CSV / XLSX / MD) | `src/commands/export.ts › ExportModal`: Obsidian `Modal` + `Setting` rows and a dropdown | **SAD-87** (In Progress) | `max-w-sm`, radius 16, p-6 |
| B2 | `#importModal` 347–380: two steps — file/paste + name + folder → **type-preview table** with per-column selects | `src/io/import/*` importer + Obsidian flow; no prototype dialog | **SAD-88** (Todo) | `max-w-2xl` |
| B3 | `#syncModal` 411–435: link state block, two-column Pull/Push grid, progress bar, mono log box | `src/views/sync/SyncModal.ts` + `syncController.ts`, Obsidian-styled | **SAD-89** (Todo) | `max-w-md` |
| B4 | `#conflictModal`, `#optMgrModal`, `#peekModal`, `#sourceModal`, `#checklistModal` | conflicts exist inside SAD-89; option manager = A2; peek = A6; source/checklist are prototype-only | folded into the steps above | `max-w-md` |

### C. Residues on surfaces already shipped (> 0.5 % bar, desktop)

| Region | Worst combo | Diff | Cause (verified) |
|---|---|---|---|
| `type-badge` | `dark-owner-populated-grouped` | **6.86 %** (light 7.05 %) | Badge text/icon metrics in the grouped state (sorted-arrow variant) — icon + label baseline, 9 px mono |
| `group-header` | `*-owner-new-grouped` | **5.73 %** | Chevron is an SVG in the plugin vs the FA webfont in the prototype (already noted in SAD-81); residual is the glyph advance |
| `selection-summary` | `dark-owner-populated-selected` | **5.04 %** (light 2.18 %) | “N selected · Delete” — glyph + gap metrics, plus the meta-row baseline |
| `btn-sync` | `*-owner-new-default` | **3.40 / 3.80 %** | FA glyph → SVG advance (~2 px) shifts the “Sync” label (crop-confirmed) |
| `btn-options` | `*-owner-new-default` | **1.41 / 1.44 %** | Same class: sliders glyph + label shift |
| `toolbar-row` | `*-owner-new-default` | **1.27 / 1.28 %** | Aggregate of the two above |
| `btn-redo` / `btn-undo` | `*-owner-new-default` | **0.78–0.92 %** | Glyph advance on an icon-only pill |
| `row-number` | `dark-mobile-new-default` | **0.52–1.01 %** | 10 px mono digit advance vs FA/webfont |
| `search` | every combo | size **890×38 vs 889×38** | 1 px width from the inset icon + padding arithmetic |
| `search` | every combo | radius `999px` vs `9999px` | cosmetic; identical rendering |

> **Note on `box-shadow` diffs (112 of 112 combos).** The plugin emits one shadow layer, the prototype two/three (`rgba(0,0,0,0) 0 0 0 0` placeholders from Tailwind's ring variables). The *rendered* result is identical — the strips differ only in the computed string. Recommendation: teach the harness to treat transparent placeholder layers as equal, so real residues are not buried (tooling, Step 10).

### D. Mobile viewport (390×844) — one root cause, twelve symptoms

| Region | dark | light | Sizes |
|---|---|---|---|
| `btn-add-field` | 58.25 % | 61.08 % | plugin 102×38 vs prototype **77×54** |
| `btn-add-row` | 37.07 % | 41.49 % | plugin 99×38 vs prototype **74×54** |
| `btn-filter` | 36.32 % | 40.69 % | 80×38 vs 80×38 (label position) |
| `grid-shell` | 33.92 % | 42.58 % | same size, different y (page shifted) |
| `toolbar-row` | 33.29 % | 37.38 % | plugin 332×**86** vs prototype 332×**102** |
| `title-row` | 31.58 % | 35.98 % | — |
| `insert-row` | 26.15 % | 33.99 % | — |
| `header-capsule` | 35.81 % | 39.51 % | — |
| `card` | — | — | 366×**572** vs 366×**588** (16 px) |
| `type-badge` | 12.15 % | 15.86 % | — |
| `body-cell` | 6.35 % | 9.48 % | — |

**Root cause (confirmed by reading both sources and the crops):**
`styles.css:283–300` — `.tablify button.tablify__toolbar-button { white-space: nowrap; flex: 0 0 auto; }` and `styles.css:261–274` — `.tablify__toolbar-actions { flex-wrap: nowrap; overflow-x: auto; }`.
The prototype's buttons are plain flex items (`pill-btn px-3/4 py-2.5 … flex items-center gap-1.5`, no `nowrap`, no `shrink-0`), so at 390 px they **shrink to 74–77 px and wrap their label onto two lines** (“Add / Row”), making the toolbar 102 px tall and the card 588 px. The plugin's buttons keep their intrinsic width and the row scrolls horizontally instead. Everything downstream (grid y-position, insert-row, card height) follows from those 16 px.

### E. Tooling / coverage gaps that block a one-command acceptance run

1. `--fixture populated --state grouped` **crashes** (`capture-compare.ts:199` waits forever for `button[data-hide-field]`), because `samples/v2/customers.tablify` has no select field to group by. The acceptance sweep in Linear (“every listed state”) cannot currently be produced in one command.
2. **No capture route** exists for: Export / Import / Sync dialogs (SAD-87–89 need them), the select panel, the option manager, the attachment panel, the context-menu cards, the invalid badge/cells and the **embed/note** surface. So “verified” claims for those areas are unverifiable today.
3. `box-shadow` normalisation noise (§3 C-note).
4. The harness compares `192` region/state pairs but **no `:hover` / `:focus-visible` / `:active` crops** — the prototype defines `.pill-btn:hover`, `active:scale-95`, `.cell-focus`, `.cell-editing`, `.cell-invalid`, and SAD-82 lists them as acceptance.

---

## 4. Root causes

| # | Cause |
|---|---|
| RC-1 | **Surfaces, not pixels:** four prototype surfaces were planned as “models/logic first” (P3-02/P3-03, P5-02) and their presentation layer never got built; two implementations exist as orphaned modules (`SelectDropdown`, `OptionManagerDialog`) with no production import. |
| RC-2 | **Wiring deferred:** `validationDisplay.ts` was written in P5 but no caller was added; the SAD-85 evidence records this as a known follow-up. |
| RC-3 | **Platform shortcuts kept:** context menus use Obsidian's native `Menu`, toasts use `Notice` — correct for platform integration, divergent from the prototype's card language (needs an explicit decision, not a silent one). |
| RC-4 | **Mobile was never in the parity scope:** SAD-71/78/79 tuned the toolbar for desktop and added `overflow-x:auto` defensively; the prototype's shrink-and-wrap behaviour was never replicated, so 390 px diverges by 16 px of layout and up to 61 % of pixels. |
| RC-5 | **Sub-pixel icon strategy:** inlining FA glyphs as SVG (offline requirement, SAD-78) reproduces shapes but not the webfont's advance widths → the 0.5–3.8 % residues on every icon+label pill. Accepting them individually is fine; not measuring them was not. |
| RC-6 | **Evidence blind spots:** the harness covers the grid/toolbar/meta/options regions only, so dialogs, panels and menus shipped without a comparison — which is how SAD-87–89 stayed open while `npm run check` stayed green. |

---

## 5. Step plan (test-first, one commit per step, `npm run check` green at every step)

Convention follows SAD-75…SAD-86: failing test → fix → capture → evidence doc → commit.

### Step 10 — Harness hardening + mobile wrap (RC-4, RC-6, §3 D/E1/E3)
*Scope:* tooling + one CSS change.
1. `capture-compare.ts`: skip/auto-report a state whose precondition is missing (no select field → no Group-by), so `--state all` completes for every fixture; print a `SKIPPED:` line instead of hanging.
2. Normalise `box-shadow` comparison (ignore fully transparent layers) and re-baseline.
3. **Add hover / focus-visible / active capture routes** for the pills, capsules and panel items (SAD-82 acceptance bullet).
4. CSS: align the toolbar buttons with the prototype at ≤ 639 px — **D-1 decided: match the prototype exactly.** Drop the label `white-space: nowrap` and `flex: 0 0 auto` so the actions row shrinks like the prototype's plain `flex items-center space-x-2` row; drop `overflow-x: auto` from `.tablify__toolbar-actions` (the row must not become a scroll container, or flex items will not be forced to shrink). Keep `nowrap` where the prototype keeps it (icon-only pills) and verify the label wrap is the prototype's two-line form.
*Acceptance:* mobile `card` 366×588, `toolbar-row` 332×102, `btn-add-row` 74×54, `btn-add-field` 77×54; every mobile region ≤ 0.5 %; `--state all` completes on all four fixtures; `npm run check` green.

### Step 11 — Select panel, option manager, attachment panel (A1–A3, RC-1)
1. Wire `SelectDropdown` (or rebuild it) as the **prototype select panel**: anchored card under the cell, search box, colour-chip option rows, `Create “…”`, *Clear*, *Manage options* link; multi-select toggles.
2. Wire `OptionManagerDialog` as `#optMgrModal` (palette glyph, per-option row: swatch / editable name / ↑ ↓ / 🗑, “New option…” + Add, hint line).
3. Build the **attachment panel** (path input + current attachments + remove) on the same card.
4. Keep the existing model paths (`selectOptions.ts`, `attachment.ts`, one undo step per change) — these are already tested; only presentation changes.
*Acceptance:* existing `select.test.ts` / `attachment.test.ts` green + new layout tests; crops vs prototype panels in both themes; keyboard: Esc closes, Enter picks, arrow keys move, focus returns to the cell.

### Step 12 — Validation display, context-menu cards, linked-record peek (A4–A6, RC-2, RC-3)
1. Call `applyValidationState` from the render/commit path; add the meta-row `#invalidBadge` (rose, mono, hover reason = the prototype's tooltip).
2. Context menus: prototype card (icons, separators, rose danger, 195 px min-width) — **D-2 decided: prototype card for the three menus** (cell / row / header), replacing Obsidian's native `Menu`. Item labels are already the prototype's (`tableMenuModel.ts` 75–171); this is a presentation swap, not a behaviour change. Keep Esc/outside-click close, focus return to the grid, and re-verify `axeGrid` / `keyboardCoverage` / `ariaGrid`. **Toasts stay Obsidian `Notice`** — record once as an accepted, permanent deviation in the evidence doc.
3. Linked-record peek card (read-only field list for the linked row), opened from a link chip.
*Acceptance:* an invalid row shows capsule border + badge in both themes; menu and peek crops vs prototype; existing keyboard/a11y tests green (`axeGrid`, `keyboardCoverage`, `ariaGrid`).

### Step 13 — Export, Import, Sync dialogs (SAD-87/88/89) + capture routes (B1–B4, RC-6)
Execute the three open sub-issues, adding `capture-export.ts`, `capture-import.ts`, `capture-sync.ts` (same pattern as `capture-add-field.ts`). No prototype-only text is copied (“simulated”, “SIMULATED”, “spec §”, “D-O5 default”, the demo token field).
*Acceptance:* each modal ≤ 0.5 % vs its prototype card in both themes; all existing export/import/sync tests green (no behaviour change to exporters, importer, conflict flow or auto-create confirm).

### Step 14 — Desktop residue sweep + acceptance run (RC-5, §3 C)
Work the remaining > 0.5 % desktop items in this order: `type-badge` grouped (6.86 %) → `group-header` (5.73 %) → `selection-summary` (5.04 %) → `btn-sync`/`btn-options`/toolbar row (1.3–3.8 %) → undo/redo → `row-number` → `search` 1 px + radius.
For each: either land ≤ 0.5 %, or record an **explicit, evidenced acceptance note** in the evidence doc (the repo already has this convention for glyph-advance differences). Preferred fix for the icon pills: give the inline SVG the **same advance width as the FA glyph** (letter-spacing/padding compensation) rather than accepting a 3.8 % drift.
*Acceptance:* the full 32-combo sweep from Step 10 shows **no unaccepted combination > 0.5 %**; report committed under `docs/evidence/visual-parity/`; `npm run check` green; the P6-02 grid-scroll benchmark not slower; `main.js` rebuilt.

---

## 6. Acceptance mapping (owner’s six criteria)

| Owner criterion | How this plan satisfies it |
|---|---|
| Rendered UI matches the prototype as closely as technically possible | Every compared region ≤ 0.5 %, or a recorded acceptance note; mobile and desktop both swept (Steps 10, 14) |
| Prototype-only annotations removed | Already guarded for `src/` (`noPrototypeAnnotations.test.ts`, passing) and required of the new dialogs in Step 13; §8 lists what must **not** be copied |
| Existing functionality intact | No behaviour change to importers/exporters/sync/undo/undo stack; each step keeps its existing tests green; new UI is wired to existing models |
| Desktop **and** mobile behave as intended | Step 10 fixes the single mobile root cause and adds mobile crops to every step |
| Interaction states and scrolling verified | Step 10 adds hover/focus/active capture routes; existing focus/selection/editing/invalid styles re-verified; scrollbars already themed (SAD-85) |
| No unrelated design changes or regressions | Steps are additive/scoped to the named selectors; no palette, typography or layout language changes; guard tests (`formControlSpecificity`, `tokensNoObsidianVars`, `fonts`, `contrast`) stay green |

---

## 7. Decisions needed from the owner

| # | Question | Recommendation |
|---|---|---|
All five were answered on 2026-10-11 — see the decisions table at the top of this document. Remaining open at execution time:

| # | Item | Status |
|---|---|---|
| **D-3** | `SelectDropdown` / `OptionManagerDialog`: wire vs rebuild | Plan wires them; **confirm at Step 11 kickoff** (a rebuild is the fallback if their DOM does not suit the prototype panel) |
| **D-4** | Search placeholder: prototype shows demo data (`Status:Done Task:~grid "Estimate (h)":>5 …`); plugin shows generic wording (`Status:Done Amount:>10`, S-3) | **Unanswered** — carried into Step 14; it is a visible 890 px string, so it is one of the last measured residues |

---

## 8. Explicitly excluded (prototype-only chrome — must not be copied)

Per S-1 (2026-10-10), SAD-71 §8, SAD-72 PD-2 and the parity programme’s standing rules, the plugin will **not** gain: brand header bar, vault sidebar, dataset tabs row, “Saved locally” indicator, “New Table” button, footer, theme switch, **Checklist modal**, **File-source modal**, **shortcuts header button** — and no string from the prototype’s annotation layer (`Feature N`, `spec §…`, `(simulated)`, `SIMULATED`, `UI-only`, `D-O1/D-O5`, the demo `pat_demo_…` token field, the migration banner, the `@@HEADERBTNS`/`@@SIDEBAR`/`@@TOOLBARBTNS` injection markers) may appear in `src/`. The embed/note tab is *not* excluded: the plugin has the real embed and only needs an evidence route (Step 13).

## 9. Risks

1. **Mobile wrap fix touches a defensive rule** (`overflow-x: auto`) added to survive a real Obsidian layout case — verify in a real vault with a long toolbar before landing (owner screenshots requested in Step 10).
2. **Context-menu card** replaces a native surface: keyboard/focus behaviour and `axeGrid` must be re-verified (Step 12 acceptance).
3. **Icon advance compensation** must not break the icon-only pills (undo/redo/Sync) — capture both icon-only and icon+label pills.
4. `main.js` is committed in the repo; every step must rebuild it, or the shipped plugin silently keeps the old UI.

---

## 10. Execution order (approved scope: Steps 10 → 14)

| Order | Step | Deliverable | Evidence |
|---|---|---|---|
| 1 | **10** | Harness hardening (skip-report, shadow normalisation, hover/focus/active routes) + mobile wrap fix | 32-combo sweep, mobile regions ≤ 0.5 %, `report.md` |
| 2 | **11** | Select panel, option manager, attachment panel | Panel crops both themes + new layout tests |
| 3 | **12** | Validation display + `#invalidBadge`, context-menu cards, linked-record peek | State crops, menu/peek crops, a11y suite green |
| 4 | **13** | Export / Import / Sync dialogs (SAD-87, SAD-88, SAD-89) + their capture routes | Modal crops both themes, existing IO/sync tests green |
| 5 | **14** | Desktop residue sweep to ≤ 0.5 % or recorded acceptance; `main.js` rebuild; CHANGELOG | Full sweep with no unaccepted combination |

Each step ends in its own commit on `main`, with an evidence doc in `docs/evidence/` following the SAD-85/86 format, and the affected Linear issue updated (SAD-87/88/89 already exist; Steps 10/11/12/14 need either a sub-issue each under SAD-82 or one combined “Step 8 — close-out” issue — **say which you prefer**).

---

## Appendix — reproduction commands

```bash
npm ci && npx playwright install chromium --with-deps
npx vitest run                                     # 92 files / 1524 tests green (baseline)
npx tsx tests/visual/capture-compare.ts --theme all --viewport owner,mobile \
    --fixture new,populated --state default,options,selected,grouped --out .out/sweep
npx tsx tests/visual/capture-modals.ts             # modal card parity (SAD-85/86)
npx tsx tests/visual/capture-add-field.ts          # Add Field layout (SAD-86)
```
Raw baseline of this analysis: `docs/evidence/visual-parity/plan-baseline-2026-10-11/report.md` (+ crops).
