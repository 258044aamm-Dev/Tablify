/**
 * Test support for the COD-76 field type picker.
 *
 * The picker's panel lives inside the Add / Modify Field window's own element since SAD-353
 * (Obsidian's newer modal only lets focus hold inside the window's subtree, so the COD-76
 * `document.body` placement left the search box un-typeable). Every test that picks a type has to
 * go through the same three steps: mount the window like Obsidian does, open the trigger, find
 * the panel, click the row. This module is that one place, so the tests read as behaviour rather
 * than as DOM digging.
 */

import type { FieldTypeName } from '../../../src/model/types.js';

/** The picker's panel while it is open. Throws with a useful message when it is not. */
export function openTypePanel(): HTMLElement {
  const panel = document.querySelector('[data-testid="tablify-field-type-panel"]') as HTMLElement | null;
  if (!panel) throw new Error('the field type panel is not open');
  return panel;
}

/** All rows currently drawn, in order. */
export function typeRows(panel: HTMLElement = openTypePanel()): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>('[data-type]'));
}

/** The row for one type, or null. */
export function typeRow(type: FieldTypeName, panel: HTMLElement = openTypePanel()): HTMLElement | null {
  return panel.querySelector<HTMLElement>(`[data-type="${type}"]`);
}

/** The trigger inside a window (`#tablify__af-type` by default). */
export function typeTrigger(root: ParentNode = document): HTMLButtonElement {
  const trigger = root.querySelector('#tablify__af-type') as HTMLButtonElement | null;
  if (!trigger) throw new Error('the field type trigger is missing');
  return trigger;
}

/** Open the picker from its trigger and return the panel. */
export function openPicker(root: ParentNode = document): HTMLElement {
  typeTrigger(root).click();
  return openTypePanel();
}

/** Open, pick a type, and leave the panel closed — what a user does in two clicks. */
export function pickType(type: FieldTypeName, root: ParentNode = document): void {
  openPicker(root);
  const row = typeRow(type);
  if (!row) throw new Error(`no row for ${type}`);
  row.click();
}

/** Type into the search box without re-opening the panel. */
export function searchTypes(text: string): void {
  const input = openTypePanel().querySelector('.tablify__tp-input') as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Place a mock-opened window in the document the way Obsidian does — `titleEl` and `contentEl`
 * inside `modalEl`, `modalEl` on `document.body`. SAD-353: the picker mounts its panel inside the
 * window, so no window interaction can be observed while the window is detached.
 */
export function mountWindow(modal: { modalEl: HTMLElement; titleEl: HTMLElement; contentEl: HTMLElement }): void {
  modal.modalEl.appendChild(modal.titleEl);
  modal.modalEl.appendChild(modal.contentEl);
  document.body.appendChild(modal.modalEl);
}

/** Remove any panel or mounted window — a modal that never closed would otherwise leak into the next test. */
export function cleanupPickers(): void {
  document.querySelectorAll('[data-testid="tablify-field-type-panel"]').forEach((n) => n.remove());
  document.querySelectorAll('.tablify__af-modal').forEach((n) => n.remove());
}
