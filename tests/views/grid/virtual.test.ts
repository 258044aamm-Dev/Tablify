/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { getVisibleRange, rowHeightPx, capsuleHeightPx, rowHeightKey, totalHeight, OVERSCAN } from '../../../src/views/grid/virtual.js';

describe('P3-01 — Virtual rows', () => {
  // SAD-79: prototype pitch — 34/34/40 capsule + 2×4 cell padding + 8 row spacing.
  it('rowHeightPx maps small/medium/large (and the compact/tall aliases) to the prototype pitch', () => {
    expect(rowHeightPx('small')).toBe(50);
    expect(rowHeightPx('compact')).toBe(50);
    expect(rowHeightPx('medium')).toBe(50);
    expect(rowHeightPx('large')).toBe(56);
    expect(rowHeightPx('tall')).toBe(56);
    expect(rowHeightPx('unknown')).toBe(50);
  });

  it('capsule heights follow the prototype CAPH table', () => {
    expect(capsuleHeightPx('small')).toBe(34);
    expect(capsuleHeightPx('medium')).toBe(34);
    expect(capsuleHeightPx('large')).toBe(40);
    expect(rowHeightKey('compact')).toBe('small');
    expect(rowHeightKey('tall')).toBe('large');
    expect(rowHeightKey('weird')).toBe('medium');
  });

  it('totalHeight is rows * height', () => {
    expect(totalHeight(1000, 36)).toBe(36000);
  });

  it('getVisibleRange at top', () => {
    const r = getVisibleRange(0, 600, 36, 1000);
    const visible = Math.ceil(600 / 36); // 17
    expect(r.start).toBe(0);
    expect(r.end).toBe(visible + OVERSCAN);
  });

  it('getVisibleRange middle', () => {
    const r = getVisibleRange(3600, 600, 36, 1000); // scroll 100 rows
    expect(r.start).toBe(100 - OVERSCAN);
    expect(r.end).toBe(100 + Math.ceil(600 / 36) + OVERSCAN);
  });

  it('getVisibleRange at bottom clamped', () => {
    const r = getVisibleRange(36000 - 600, 600, 36, 1000);
    expect(r.end).toBe(1000);
    expect(r.start).toBeGreaterThanOrEqual(0);
  });

  it('overscan documented as 5', () => {
    expect(OVERSCAN).toBe(5);
  });

  it('empty cases', () => {
    expect(getVisibleRange(0, 600, 36, 0)).toEqual({ start: 0, end: 0 });
    expect(getVisibleRange(0, 0, 36, 100)).toEqual({ start: 0, end: 0 });
  });
});
