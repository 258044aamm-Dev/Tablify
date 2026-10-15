# SAD-127 — Improve the Field Type Selection Dropdown UI

**Mode:** plan only — no source code changed · **Issue:** [SAD-127](https://linear.app/sad-mod/issue/SAD-127/improve-the-field-type-selection-dropdown-ui) · **Base:** `3c588cb` · **Date:** 2026-10-15

## 1. Goal and scope

Polish the **Add New Field** dialog's field-type selector so it fits Tablify's visual language, presents each available type clearly, and works with keyboard, pointer/touch, narrow screens, and Obsidian light/dark themes.

Scope this to the native type selector in `src/views/grid/AddFieldModal.ts` (`#tablify__af-type`). Do not change the separate `TypePickerModal` used by the existing-field **Change field type…** menu, the cell-value dropdown in `src/views/grid/select/Dropdown.ts`, field-type definitions, conversion logic, or any other Add Field controls.

## 2. Current behavior and cause

- `AddFieldModal.onOpen()` creates a native `<select id="tablify__af-type">`, fills it from `TYPE_GROUPS` and `CHANGE_TARGET_TYPES`, and updates `this.type` / calls `showTypeRows()` on `change`.
- The option set is 18 user-creatable types, in five existing groups: Basic, Date, Links & contact, Select & attachment, and Computed. The “unlisted type” fallback prevents future offered types from silently disappearing.
- `styles.css` styles the closed `<select>` as a pill but explicitly keeps `appearance: auto`. The popup and its option rows are then rendered/styled by the host platform; per-option icons, consistent hover/selected states, and cross-platform popup theming cannot be controlled reliably.
- Tablify already has reusable metadata: `TYPE_LABELS`/`CHANGE_TARGET_TYPES` in `src/menus/tableMenuModel.ts`, `TYPE_GROUPS` in `AddFieldModal.ts`, and `typeIcon()` plus inline `faIcon()` in `src/views/grid/fieldTypeBadge.ts` / `src/ui/faIcons.ts`.
- Existing behavior tests in `tests/views/addFieldModal.test.ts` and the Add Field integration test in `tests/views/tableView.test.ts` set a native select's `.value` directly. `tests/visual/capture-add-field.ts` does the same for its type/formula parity captures; it must be updated if the UI control changes.

## 3. Recommended design

Replace only the Add Field type `<select>` with a **select-only combobox and listbox** built from the existing type data. A native select can remain the right control where only a simple value is needed, but it cannot meet this ticket's per-option icon and consistent popup-state requirements across Obsidian hosts.

### Closed control

- Keep the visible **Field type** label and its association with the control.
- Retain the stable `tablify__af-type` id on the trigger/control for test and label targeting.
- Show the selected type's existing icon, readable `TYPE_LABELS` label, and a small chevron; the default remains **Text**.
- Use the existing Add Field pill dimensions, typography, border, surface, and focus language rather than changing the whole modal.

### Open list

- Render the five existing group headings and all 18 types in exactly the current order. Each option has the matching `typeIcon()` SVG and label; mark icons decorative (`aria-hidden="true"`).
- Make the current selection unmistakable (selected-row surface plus a check glyph and the correct `aria-selected` state). Distinguish hover, active keyboard focus, and selected states without relying on color alone.
- Reuse existing theme tokens such as `--tablify-bg-pill`, `--tablify-bg-inner`/`--tablify-bg-pill-hover`, `--tablify-border-subtle`, `--tablify-text`, `--tablify-text-muted`, `--tablify-accent-primary`, and `--tablify-focus-ring`. Avoid hard-coded light/dark colors and new dependencies.
- Keep the popup anchored to the control, bounded to the viewport (for example, a capped height with internal vertical scrolling and upward placement when there is insufficient room below). Ensure the modal's own overflow and Obsidian's host CSS do not clip the list or put it behind the modal. Preserve the modal theme class/token inheritance.
- Do not add type descriptions or a search box in this task; grouped labels and keyboard type-ahead are sufficient for the existing 18 choices and avoid expanding the form.

### Accessibility and interaction

Use one consistent WAI-ARIA select-only combobox/listbox focus model (active-descendant or roving focus, not a mixture): associate the visible label, expose expanded/collapsed state and listbox relationship, identify the active option, group options accessibly, and expose the selected option.

Support:

- Pointer/touch to open and choose; outside pointer closes the list without saving the form.
- `Enter`/`Space` to open or choose; `ArrowDown`/`ArrowUp` to open and move; `Home`/`End` to move to the first/last option; optional type-ahead by label; `Escape` closes only the picker first and returns focus to its trigger; `Tab` closes and continues normal modal tab order.
- Closing the picker cleans up any document-level listeners. Opening/closing it must not submit or dismiss the Add Field modal.

On selection, update the existing `this.type` value, refresh the selected label/indicator, close the list, and invoke the existing `showTypeRows()` path. Keep `submit()`, validation, `onConfirm` arguments, and the conditional Options / Min-Max / Regex / Formula / Linked-table sections unchanged.

## 4. Planned files and changes (implementation phase only)

1. **`src/views/grid/AddFieldModal.ts`** — replace the native type-select construction with a small picker builder (keep it local to AddFieldModal unless a genuinely reusable internal helper makes the code simpler). Build groups/options from `TYPE_GROUPS` and `CHANGE_TARGET_TYPES`; use `TYPE_LABELS` and `typeIcon()`; connect selection to the existing state/`showTypeRows()` path.
2. **`styles.css`** — add narrowly scoped `.tablify__af-type-*` rules for the trigger, anchored list, group headings, options, selected/active/hover/focus states, scroll, and mobile sizing. Do not change generic select styles or unrelated modal controls.
3. **`tests/views/addFieldModal.test.ts`** — replace the native-select helper and direct `.value` assignments with helpers that query/select the custom control. Keep existing behavioral coverage for each conditional form section and `onConfirm` data. Extend coverage for exact group/order/value parity, default Text selection, pointer selection, keyboard navigation, ARIA state, Escape/focus restoration, and no accidental form submit.
4. **`tests/views/tableView.test.ts`** — update the Add Field integration test to select a type through the custom picker while asserting the created field and saved view are unchanged.
5. **`tests/visual/capture-add-field.ts`** — replace direct `sel.value` mutation with UI-driven selection (open the picker, select by stable type identifier); otherwise the existing Add Field visual parity script will fail after the native select is removed. Preserve its formula/select/number/link states.
6. Do **not** modify `src/menus/tableMenu.ts`, `src/menus/tableMenuModel.ts`, `src/model/*`, `src/views/grid/select/Dropdown.ts`, or the Add Field validation and save flow.

## 5. Verification plan

- Targeted: `npx vitest run tests/views/addFieldModal.test.ts tests/views/tableView.test.ts`.
- Full: `npm run check` (lint, full Vitest suite, guards, docs links, icon check, and production build).
- Visual: `npx tsx tests/visual/capture-add-field.ts --theme all --viewport all`; inspect light/dark and owner/mobile captures, especially the open list at mobile width. Also manually smoke-test a narrow viewport and touch selection in Obsidian if available.
- Confirm the exact 18 offered values/order and all existing `onConfirm`/validation/conditional-row behavior are unchanged. Confirm `TypePickerModal` and cell-value select panels are untouched.

## 6. Acceptance criteria

- The Add New Field type control and popup look like Tablify and Obsidian, with clear icons, labels, groups, selection, hover, active/focus states, and theme support.
- Keyboard, mouse, and touch users can open, navigate, select, and dismiss the picker without trapping focus or submitting/dismissing the parent form.
- The popup stays within the visible modal/viewport and scrolls internally on narrow screens.
- All and only the existing 18 offered types remain available in the same groups/order; Text remains the default.
- Type changes continue to show the same conditional controls and preserve all existing data/validation/save behavior.
- No changes leak into the separate Change Field Type modal, cell-value dropdown, or unrelated features.

## 7. Risks / safeguards

- **Accessibility regression:** a custom listbox is more work than native `<select>`. Implement the ARIA pattern and keyboard/focus tests before visual polish is considered complete.
- **Popup clipping/stacking:** the Add Field card is scrollable and hosted by Obsidian. Check layering, scroll clipping, modal close behavior, and both viewport sizes in the visual harness.
- **Test harness drift:** current unit/integration/visual tests write directly to the native select. Update all direct users in the same implementation step so the test surface follows the actual UI.
- Keep the change isolated to the Add Field type selector. No refactor of other pickers and no dependency addition.

## 8. Plan-only boundary

This file records the next implementation plan. No source code, tests, styles, Linear status, or runtime behavior has been changed in this plan-only step.
