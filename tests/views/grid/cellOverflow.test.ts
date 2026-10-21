/**
 * SAD-376 — the pure half of the cell overflow feature.
 *
 * `isOverflowing` is the single answer to "does this cell offer Expand?", shared by the grid and
 * the cell menu. Everything here is arithmetic: no DOM, no Obsidian, no store, so it runs in the
 * default Node environment.
 */

import { describe, it, expect } from 'vitest';
import {
  CARD_EXIT_GRACE_MS,
  CARD_OPEN_DELAY_MS,
  isOverflowing,
  offersOverflow,
} from '../../../src/views/grid/cellOverflow.js';

/** The default configuration, spelled out so this file needs no runtime import of settings.ts
 *  (which pulls in Obsidian) and stays a pure Node test. */
const ON = { enabled: true, maxChars: 80, hoverCard: true, touchReveal: true } as const;
const OFF = { ...ON, enabled: false };

describe('SAD-376 — isOverflowing', () => {
  it('is false at and below the limit, true only above it', () => {
    const limit = 10;
    expect(isOverflowing('', limit)).toBe(false);
    expect(isOverflowing('a'.repeat(limit - 1), limit)).toBe(false);
    expect(isOverflowing('a'.repeat(limit), limit)).toBe(false);
    expect(isOverflowing('a'.repeat(limit + 1), limit)).toBe(true);
  });

  it('counts characters a reader would count, not UTF-16 units', () => {
    // '😀' is two UTF-16 units but one character; at a limit of 3 it must not overflow.
    expect(isOverflowing('😀😀😀', 3)).toBe(false);
    expect(isOverflowing('😀😀😀😀', 3)).toBe(true);
    // Code points, not grapheme clusters: a combining mark is its own code point, so
    // 'e' + U+0301 twice is four. Documented, deterministic, and the same rule the limit is
    // described with in the settings tab.
    expect(isOverflowing('e\u0301e\u0301', 4)).toBe(false);
    expect(isOverflowing('e\u0301e\u0301', 3)).toBe(true);
  });

  it('keeps whitespace significant', () => {
    // Nothing is trimmed: the limit applies to the text the reader is shown.
    expect(isOverflowing('   ', 2)).toBe(true);
    expect(isOverflowing('  ', 2)).toBe(false);
  });

  it('answers false for a limit that cannot mean anything', () => {
    expect(isOverflowing('abc', Number.NaN)).toBe(false);
    expect(isOverflowing('abc', Number.POSITIVE_INFINITY)).toBe(false);
    expect(isOverflowing('abc', -1)).toBe(false);
  });

  it('handles a very long value without throwing or stalling', () => {
    const huge = 'x'.repeat(100_000);
    expect(isOverflowing(huge, 80)).toBe(true);
    expect(isOverflowing(huge, 200_000)).toBe(false);
  });
});

describe('SAD-376 — offersOverflow', () => {
  it('needs the feature on and the text over the limit', () => {
    expect(offersOverflow(ON, 'a'.repeat(79))).toBe(false);
    expect(offersOverflow(ON, 'a'.repeat(80))).toBe(false);
    expect(offersOverflow(ON, 'a'.repeat(81))).toBe(true);
  });

  it('never offers anything when the feature is off, however long the text', () => {
    expect(offersOverflow(OFF, 'a'.repeat(50_000))).toBe(false);
  });

  it('honours the configured limit', () => {
    expect(offersOverflow({ ...ON, maxChars: 200 }, 'a'.repeat(150))).toBe(false);
    expect(offersOverflow({ ...ON, maxChars: 200 }, 'a'.repeat(201))).toBe(true);
  });
});

describe('SAD-376 — interaction timings', () => {
  it('keeps the card delay well under a second and the exit grace shorter than the delay', () => {
    expect(CARD_OPEN_DELAY_MS).toBeGreaterThan(0);
    expect(CARD_OPEN_DELAY_MS).toBeLessThanOrEqual(500);
    expect(CARD_EXIT_GRACE_MS).toBeGreaterThan(0);
    expect(CARD_EXIT_GRACE_MS).toBeLessThanOrEqual(CARD_OPEN_DELAY_MS);
  });
});
