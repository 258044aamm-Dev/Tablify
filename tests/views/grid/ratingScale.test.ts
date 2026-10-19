/**
 * SAD-304 — the arithmetic every rating surface shares: star fills, pointer mapping and the
 * numeric field's rules. Pure functions, so these assertions are the contract the cell and the
 * panel both lean on.
 */

import { describe, it, expect } from 'vitest';
import {
  parseRatingInput,
  ratingFromPosition,
  ratingNumber,
  ratingValueText,
  roundRating,
  starFills,
} from '../../../src/views/grid/rating/scale.js';

describe('SAD-304 — star fills', () => {
  it('a whole rating fills that many stars', () => {
    expect(starFills(4, 5)).toEqual([1, 1, 1, 1, 0]);
  });

  it('a half rating fills half of the next star', () => {
    expect(starFills(4.5, 5)).toEqual([1, 1, 1, 1, 0.5]);
  });

  it('any fraction fills by its own fraction', () => {
    const fills = starFills(3.7, 5);
    expect(fills.slice(0, 3)).toEqual([1, 1, 1]);
    expect(fills[3]).toBeCloseTo(0.7, 10);
    expect(fills[4]).toBe(0);
  });

  it('zero fills nothing, and is still a value', () => {
    expect(starFills(0, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(ratingNumber(0)).toBe(0);
  });

  it('empty, negative and non-numeric values fill nothing', () => {
    expect(starFills(null, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(starFills(undefined, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(starFills(-2, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(starFills('4', 5)).toEqual([0, 0, 0, 0, 0]);
    expect(starFills(Number.NaN, 5)).toEqual([0, 0, 0, 0, 0]);
  });

  it('a value above the scale fills the scale and no more', () => {
    expect(starFills(7, 5)).toEqual([1, 1, 1, 1, 1]);
    expect(starFills(9, 10)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
  });

  it('the array always has one entry per star', () => {
    expect(starFills(5, 10)).toHaveLength(10);
    expect(starFills(null, 1)).toHaveLength(1);
  });
});

describe('SAD-304 — pointer position → value', () => {
  it('half-star zones: the left half of star three is 2.5, the right half is 3', () => {
    // Scale 5 over 100 px: star three spans 40–60 px, its halves meet at 50.
    expect(ratingFromPosition(41, 100, 5, 0.5)).toBe(2.5);
    expect(ratingFromPosition(49, 100, 5, 0.5)).toBe(2.5);
    expect(ratingFromPosition(51, 100, 5, 0.5)).toBe(3);
    expect(ratingFromPosition(59, 100, 5, 0.5)).toBe(3);
  });

  it('whole stars: anywhere in star three is 3', () => {
    expect(ratingFromPosition(41, 100, 5, 1)).toBe(3);
    expect(ratingFromPosition(59, 100, 5, 1)).toBe(3);
    expect(ratingFromPosition(100, 100, 5, 1)).toBe(5);
  });

  it('the edges clamp to one step and to the scale', () => {
    expect(ratingFromPosition(0, 100, 5, 0.5)).toBe(0.5);
    expect(ratingFromPosition(-20, 100, 5, 0.5)).toBe(0.5);
    expect(ratingFromPosition(0, 100, 5, 1)).toBe(1);
    expect(ratingFromPosition(500, 100, 5, 1)).toBe(5);
  });

  it('a zero-width row (not laid out yet) still yields a legal value', () => {
    expect(ratingFromPosition(10, 0, 5, 0.5)).toBe(0.5);
    expect(ratingFromPosition(10, 0, 5, 1)).toBe(1);
  });
});

describe('SAD-304 — the panel’s numeric field', () => {
  it('empty means no rating, not zero', () => {
    expect(parseRatingInput('', 5)).toEqual({ ok: true, value: null });
    expect(parseRatingInput('   ', 5)).toEqual({ ok: true, value: null });
  });

  it('accepts whole numbers, decimals and a comma', () => {
    expect(parseRatingInput('4', 5)).toEqual({ ok: true, value: 4 });
    expect(parseRatingInput('4.5', 5)).toEqual({ ok: true, value: 4.5 });
    expect(parseRatingInput('3,7', 5)).toEqual({ ok: true, value: 3.7 });
    expect(parseRatingInput(' 2.25 ', 5)).toEqual({ ok: true, value: 2.25 });
    expect(parseRatingInput('0', 5)).toEqual({ ok: true, value: 0 });
  });

  it('rounds to two decimals', () => {
    expect(parseRatingInput('3.666', 5)).toEqual({ ok: true, value: 3.67 });
  });

  it('refuses text and values outside the field’s scale', () => {
    expect(parseRatingInput('abc', 5).ok).toBe(false);
    expect(parseRatingInput('-1', 5).ok).toBe(false);
    expect(parseRatingInput('6', 5).ok).toBe(false);
    expect(parseRatingInput('5.5', 5).ok).toBe(false);
  });

  it('a ten-star field accepts ten', () => {
    expect(parseRatingInput('10', 10)).toEqual({ ok: true, value: 10 });
    expect(parseRatingInput('10.5', 10).ok).toBe(false);
  });
});

describe('SAD-304 — labels and rounding', () => {
  it('spells the value out for ARIA and the caption', () => {
    expect(ratingValueText(4.5, 5)).toBe('4.5 out of 5 stars');
    expect(ratingValueText(1, 1)).toBe('1 out of 1 star');
    expect(ratingValueText(null, 5)).toBe('No rating');
  });

  it('rounds to two decimals', () => {
    expect(roundRating(3.666)).toBe(3.67);
    expect(roundRating(3.7)).toBe(3.7);
  });
});
