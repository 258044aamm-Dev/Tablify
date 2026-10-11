/**
 * The prototype's `#floatPanel` card, shared by the panels that open over a cell.
 *
 * `Prototype/index.html:472` holds one `<div id="floatPanel" class="hidden float-panel">`, and
 * `openPanel()` (`Prototype/script.js:744`) fills it with whatever screen was asked for — select,
 * attachment, view settings. The geometry lives in `openPanel()`: width `min(320, innerWidth - 24)`,
 * x clamped to the viewport, `y = anchor.bottom + 6`, flipping above the anchor when the card would
 * run past the bottom edge. Dismissal is a document-level press outside the card plus Escape
 * (`script.js:765–771`).
 *
 * This module keeps that host behaviour in one place so every panel lands in the same spot with the
 * same dismiss rules. Card paint (fixed, z 70, radius 16, shadow, 220-320 px, fit-content) is
 * `.tablify__panel` in styles.css; the theme variables come from `applyTheme`, because the panel is
 * attached to `document.body` rather than inside the grid where the variables are already set.
 */

import { applyTheme } from '../../../ui/theme/tokens.js';

/** `openPanel()` caps the card at 320 px (or the viewport minus 24). */
export const PANEL_WIDTH = 320;

export interface PanelCard {
  /** The card itself — the element to append to the document. */
  card: HTMLElement;
  /** Inner wrapper carrying the panel's own padding (the prototype's `p-2` / `p-2.5`). */
  body: HTMLElement;
}

/**
 * Build an empty `#floatPanel` card. `testid` lands on the card so tests and capture routes can
 * find it; `bodyClass` is the screen's padding/size class (`tablify__dropdown-body` etc.).
 */
export function createPanelCard(
  testid: string,
  theme: 'light' | 'dark' = 'light',
  bodyClass = 'tablify__dropdown-body',
): PanelCard {
  const card = document.createElement('div');
  card.className = 'tablify__panel';
  card.dataset.testid = testid;
  card.setAttribute('role', 'dialog');
  applyTheme(card, theme);

  const body = document.createElement('div');
  body.className = bodyClass;
  card.appendChild(body);

  return { card, body };
}

/** Anchor a card under `anchor` exactly like the prototype's `openPanel()`. */
export function anchorPanel(card: HTMLElement, anchor: HTMLElement): void {
  const r = anchor.getBoundingClientRect();
  const vw = typeof window === 'undefined' ? PANEL_WIDTH + 24 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  // The prototype only uses `pw` to clamp x; the card's own width stays content-driven (its CSS
  // carries the 220 px floor and 320 px cap, like `.float-panel` does).
  const pw = Math.min(PANEL_WIDTH, vw - 24);
  const x = Math.min(r.left, vw - pw - 12);
  const y = r.bottom + 6;

  card.style.position = 'fixed';
  card.style.left = `${Math.max(8, x)}px`;
  card.style.top = `${y}px`;
  card.style.zIndex = '70';

  // Flip above the cell when the card would run off the bottom (prototype openPanel()).
  const height = card.getBoundingClientRect().height;
  if (y + height > vh - 8) card.style.top = `${Math.max(8, r.top - height - 6)}px`;
}

/**
 * Close on a press outside the card or on Escape — the prototype's `#floatPanel` listeners.
 * Returns the unwire function; the panel calls it from its own `close()`.
 */
export function wirePanelDismiss(card: HTMLElement, onDismiss: () => void): () => void {
  const onPress = (ev: Event): void => {
    if (!card.contains(ev.target as Node)) onDismiss();
  };
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') onDismiss();
  };
  document.addEventListener('mousedown', onPress);
  document.addEventListener('touchstart', onPress, { passive: true });
  document.addEventListener('keydown', onKey);
  return () => {
    document.removeEventListener('mousedown', onPress);
    document.removeEventListener('touchstart', onPress);
    document.removeEventListener('keydown', onKey);
  };
}
