/**
 * SAD-304 — the pure arithmetic behind a rating's stars.
 *
 * The cell, the panel and their tests all need the same three answers: how full is each star,
 * what value does a pointer position mean, and what does a typed value mean. Keeping them here
 * (no DOM, no store) means the answers are tested once and both surfaces agree.
 */

import type { CellValue } from '../../../model/types.js';

/** Two decimals, the same rule `ratingType.parse` stores with. */
export function roundRating(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A finite numeric rating, or null for empty and for a value that is not a number at all. */
export function ratingNumber(value: CellValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * The fill of every star, left to right: `1` is full, `0` is empty, and anything between is a
 * partial star. A value below 0 fills nothing; a value above the scale fills the scale, exactly
 * as the all-or-nothing renderer clamped before this change.
 */
export function starFills(value: CellValue | undefined, scale: number): number[] {
  const rating = ratingNumber(value);
  const fills: number[] = [];
  for (let i = 0; i < scale; i += 1) {
    if (rating === null) {
      fills.push(0);
      continue;
    }
    fills.push(Math.max(0, Math.min(1, rating - i)));
  }
  return fills;
}

/**
 * The value a pointer at `x` (within `width`) chooses.
 *
 * `step: 0.5` reads half-star zones — the left half of a star is `x.5`, the right half is `x` —
 * and `step: 1` reads whole stars, which is what a click in the grid cell writes. A press always
 * chooses at least one step, so the extreme left edge is `0.5` / `1`, never the empty value.
 */
export function ratingFromPosition(x: number, width: number, scale: number, step: 0.5 | 1): number {
  if (!(width > 0) || !(scale > 0)) return step === 1 ? 1 : 0.5;
  const ratio = Math.max(0, Math.min(1, x / width));
  const raw = Math.ceil((ratio * scale) / step) * step;
  return roundRating(Math.max(step, Math.min(scale, raw)));
}

export type ParsedRating = { ok: true; value: number | null } | { ok: false; error: string };

/** What the panel's numeric field accepts. Empty means "no rating", not zero. */
export function parseRatingInput(text: string, scale: number): ParsedRating {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return { ok: true, value: null };
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) {
    return { ok: false, error: `Enter a number from 0 to ${scale}, or leave it empty.` };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > scale) {
    return { ok: false, error: `Enter a number from 0 to ${scale}, or leave it empty.` };
  }
  return { ok: true, value: roundRating(n) };
}

/** `4.5 out of 5 stars`, or `No rating`. Used for ARIA and the panel's caption. */
export function ratingValueText(value: number | null, scale: number): string {
  if (value === null) return 'No rating';
  const stars = scale === 1 ? 'star' : 'stars';
  return `${value} out of ${scale} ${stars}`;
}
