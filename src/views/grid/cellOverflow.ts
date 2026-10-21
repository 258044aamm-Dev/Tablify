/**
 * SAD-376 — when a cell offers Expand.
 *
 * The ticket asks for the expand option "when the cell's content exceeds the defined size limit".
 * The limit is one plugin setting (a character count, `src/settings.ts`), so this module is pure
 * arithmetic: no DOM, no Obsidian, no store. It is the single answer to the question, used by the
 * grid (to draw the control) and by the cell menu (to offer `Expand cell`), so the two can never
 * disagree about which cells overflow.
 *
 * Why a character count and not `scrollWidth > clientWidth`: the rendered text is produced by a
 * twelve-branch chain in `GridView.fillRow`, and jsdom has no layout at all (`scrollWidth` is 0),
 * so a geometric test would be both a second source of truth and untestable in this repo's unit
 * suite. `GridView` measures nothing and the ellipsis stays pure CSS.
 */

import type { CellOverflowConfig } from '../../settings.js';

/**
 * How long the pointer must rest on the expand control before the preview card opens. A table is
 * mostly pointer travel: without this, every diagonal move across a cell would flash a card.
 */
export const CARD_OPEN_DELAY_MS = 200;

/** How long the card survives the pointer leaving the control, so the 6px gap between the cell and
 *  the card can be crossed to reach its buttons. */
export const CARD_EXIT_GRACE_MS = 150;

/**
 * Is `displayText` longer than `maxChars` characters?
 *
 * Counted in code points, not UTF-16 units, so an emoji is one character to the reader. The fast
 * path matters: a string's UTF-16 length is never smaller than its code-point count, so anything
 * at or under the limit is answered without iterating.
 */
export function isOverflowing(displayText: string, maxChars: number): boolean {
  if (displayText === '' || !Number.isFinite(maxChars) || maxChars < 0) return false;
  if (displayText.length <= maxChars) return false;
  // Walk code points, stopping the moment the limit is passed, so a 100k-character value costs
  // no more than maxChars + 1 steps.
  const iterator = displayText[Symbol.iterator]();
  let counted = 0;
  while (counted <= maxChars) {
    if (iterator.next().done === true) return false;
    counted += 1;
  }
  return true;
}

/**
 * Whether this cell should offer the affordance: the feature is on *and* the text is over the
 * limit. One call for both the grid and the menu.
 */
export function offersOverflow(config: CellOverflowConfig, displayText: string): boolean {
  return config.enabled && isOverflowing(displayText, config.maxChars);
}
