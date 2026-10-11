# SAD-85: Step 7a, prototype modal card and interaction states

- **Linear:** SAD-85, sub-issue 1 of 5 of SAD-82 (Step 7). The owner chose on 2026-10-11 that modals get the prototype look **and** the prototype layouts, that Import becomes a prototype-style dialog and that the Sync modal is restyled. The layouts follow in SAD-86 (Add Field), SAD-87 (Export), SAD-88 (Import) and SAD-89 (Sync).
- **Date:** 2026-10-11
- **Base commit:** `ba44389`

## Change

### Shared prototype modal card (`src/ui/protoModal.ts`, `styles.css` "Prototype modal card")

- **`dressProtoModal(modal, { icon, size })`** sets up a dialog in three ways:
  - It adds `tablify__modal tablify__pmodal tablify__pmodal--<size>`.
  - It applies the plugin theme variables.
  - It puts one decorative (`aria-hidden`) Font Awesome glyph before the title.

  It never touches a dialog's controls, handlers or content.
- **Card.** These are the SAD-78 filter-builder card rules, now shared (the selectors are grouped, so the filter builder is unchanged):
  - Shape: `rounded-2xl p-6 shadow-2xl`, at most 85vh tall.
  - Type: Lora 12 for the body; the title in Poppins 14/600 with a terracotta glyph and gap 8.
  - Close button: muted ✕.
  - Widths are the prototype's: `sm` 384, `md` 448, `xl` 576, `2xl` 672 (`max-w-*`), capped at `100vw − 32px`.
- **Field rhythm.** Prototype `space-y-3`: labels are 12/500 in muted clay with 4px below them.
  - Obsidian `Setting` rows are laid out the same way: the label sits over a full-width control and the description is 10/15 muted.
  - A row whose control holds only buttons becomes the prototype footer: 20px above, right-aligned, gap 8.
- **Controls:**
  - **`.pill-input`:** radius 12, padding 10/14, 12/16 text, pill surface, subtle border. On focus it gets the accent border with a 15% ring, and the plugin's focus outline is kept.
  - **Ghost button (prototype Cancel):** `px-3.5 py-2`, muted, with the inner surface on hover.
  - **Primary button (prototype Save):** `px-4 py-2`, 600 weight, radius 12, `shadow`, on the prototype terracotta in both themes (`accentFill`). It has on-accent ink instead of white for AA (5.23 / 5.47 : 1) and a darker terracotta on hover.
  - **Warning buttons** (Clear links) take the danger ink.
  - **Checkboxes** are the native box tinted terracotta, as the SAD-80 row checkboxes are.
  - Class hooks `tablify__pmodal-input` and `tablify__pmodal-btn(--primary|--danger)` are ready for the layouts in 7b–7e. The selectors follow the form-control and button specificity rules (`formControlSpecificity.test.ts`).
- **Applied as a shell only** to the dialogs that have no prototype layout. Their controls, labels, order and behaviour are unchanged:

  | Dialog | Glyph | Width |
  |---|---|---|
  | Edit formula | `square-root-variable` | sm |
  | Link picker | `link` | md (inner-surface row list, radius 12) |
  | Link integrity | `link` | md |

  Link integrity did not call `applyTheme` before, so its `.tablify__modal` variables were unresolved. The helper now themes it.

### Cell states

- **Editing (prototype `.cell-editing`).** The cell editor overlays the capsule (`tableView` sizes it to the capsule rect). Before this step it had no plugin styling and wore Obsidian's input.
  - It now takes the capsule's paint: surface, border, `rounded-2xl`, `px-3.5`, Lora 12 and `shadow-sm`, plus the 2px accent outline at −1px.
  - A rejected value keeps the editor open with the rose-500 border. The checkbox editor keeps its native box.
- **Editor position fix.** The editor sat 1px right of and below the capsule because absolute offsets start inside the grid root's border. The offset now subtracts `clientLeft` / `clientTop`. Measured rect: plugin `203,266,247,34` = prototype `203,266,247,34`.
- **Invalid (prototype `.cell-invalid`).** The rose-500 border is drawn on the capsule, not on the slot, like selection.
  - In the rendered prototype, the 1px ring of `.cell-invalid` loses to the capsule's `shadow-sm`, so the capsule shadow stays. The plugin matches that rendered result.
  - Note: the grid does not call `applyValidationState` yet, so no cell gets the class today. That gap predates this step and is listed as a follow-up. The style is ready for it.
- **Already in place (verified, unchanged):**
  - Cell focus = prototype `.cell-focus` (SAD-79).
  - Toolbar pill hover and `active:scale-95` (SAD-78). These are the only prototype elements in scope with `active:scale-95`.
  - Focus-visible outlines on every pill, panel item and capsule button.
- **Range selection does not apply.** The plugin has no range selection, and adding one would be a new feature, so `.cell-range` has no counterpart.

### Scrollbars

The prototype's 6px rounded scrollbars:
- The track is the view background (`--tablify-bg`; it was transparent).
- The thumb uses the new `scrollThumb` token: `#D5CEC2` light (new palette entry `scrollThumbLight`) and `#3A3630` dark (`capsuleBorderDark`).

### Prototype annotations guard

`tests/ui/noPrototypeAnnotations.test.ts` fails if "Feature N", "simulated", "UI-only" or "spec §" appears in `src/` outside comments. Code comments may still cite spec sections. It passes today: the three hits are comments.

## Verification

- **Modal card parity:** `tests/visual/capture-modals.ts`.
  - **Method:** the real dialog classes run in Obsidian modal markup under the hostile host CSS. The harness host CSS now also carries Obsidian's `Setting` and `mod-cta` / `mod-warning` rules. Card, title, label, input, primary and ghost computed styles are compared with the prototype's Add Field card, in both themes and both viewports.
  - **Result: 0 unaccepted mismatches.** Report: `docs/evidence/visual-parity/sad-85/modals/report.md`. Screenshots are next to it.
  - **Accepted difference: the dark title ink.** The plugin title is `#ECE7E1` and the prototype's Add Field title is `#FAF7F2`. Prototype dialog headings inherit the body ink; only Add Field sets `dark:text-tablify-paper`. The shell dialogs follow the inheriting ones, as the filter builder does, and Add Field takes the paper ink in SAD-86.
- **Cell states:** `.out/states85.mts` (scratch).
  - **Editing:** every compared property matches in both themes (border, shadow, outline colour / width / offset, radius, surface, padding, font) and the rect is identical.
  - **Invalid:** the border colour, radius, surface and shadow match.
  - Crops are in `docs/evidence/visual-parity/sad-85/states/`.
- **Regression gate:** `npm run check` is green:
  - lint: 0 errors (119 warnings, unchanged);
  - vitest: 1501 tests in 91 files (+7);
  - guard / docs / icons: PASS;
  - build: exit 0.

  `tsc --noEmit` reports 793 errors, the same as at `ba44389`.

## Not changed

- Filter builder: same card, same rules.
- Embed buttons: still flat.
- Behaviour of the three dialogs: Enter submits the formula, a syntax error keeps the dialog open, and the link picker's Save / Clear / Cancel and missing rows work as before.
