/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { getVisibleRange, rowHeightPx, totalHeight, OVERSCAN } from '../../../src/views/grid/virtual.js';

describe('P3-01 — Virtual rows', () => {
  it('rowHeightPx maps compact/medium/tall', () => {
    expect(rowHeightPx('compact')).toBe(28);
    expect(rowHeightPx('medium')).toBe(36);
    expect(rowHeightPx('tall')).toBe(48);
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
