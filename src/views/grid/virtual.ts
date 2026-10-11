/**
 * Virtual row helper — pure math, no DOM.
 * Fixed row height per rowHeight setting; overscan = 5 (documented).
 * Column virtualization is **not** implemented in this step — see docs/evidence/P3-01.md for measured column limit.
 */

export const OVERSCAN = 5;

/**
 * Row pitch in px: the distance from one row's top to the next.
 *
 * SAD-79: the prototype's grid is a `border-separate` table with 8px vertical spacing, `py-1`
 * (4px) cells and fixed-height capsules — 34px for Short and Medium, 40px for Tall (`CAPH` in
 * Prototype/script.js). Pitch = capsule + 2×4 cell padding + 8 spacing: 50 / 50 / 56.
 * Short and Medium therefore share a pitch (the prototype changes only the capsule's inner
 * padding between them); `compact` / `tall` are the legacy model aliases of small / large.
 */
export function rowHeightPx(rowHeight: string): number {
  return capsuleHeightPx(rowHeight) + ROW_CHROME_PX;
}

/** Vertical px around a capsule inside one row pitch: 8px spacing + 2×4px cell padding. */
export const ROW_CHROME_PX = 16;

/** Capsule height in px per row-height setting (prototype `CAPH`). */
export function capsuleHeightPx(rowHeight: string): number {
  switch (rowHeight) {
    case 'tall':
    case 'large':
      return 40;
    default:
      return 34;
  }
}

/** Normalised row-height key for CSS hooks (`data-row-height`). */
export function rowHeightKey(rowHeight: string): 'small' | 'medium' | 'large' {
  switch (rowHeight) {
    case 'compact':
    case 'small':
      return 'small';
    case 'tall':
    case 'large':
      return 'large';
    default:
      return 'medium';
  }
}

/**
 * Compute visible range [start, end) for virtual rows.
 * start is inclusive, end exclusive, clamped to [0, totalRows].
 * Overscan extends both sides but is clamped.
 */
export function getVisibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  totalRows: number,
  overscan: number = OVERSCAN,
): { start: number; end: number } {
  if (totalRows <= 0 || rowHeight <= 0 || viewportHeight <= 0) return { start: 0, end: 0 };
  const visibleCount = Math.ceil(viewportHeight / rowHeight);
  const firstVisible = Math.floor(scrollTop / rowHeight);
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(totalRows, firstVisible + visibleCount + overscan);
  return { start, end };
}

export function totalHeight(totalRows: number, rowHeight: number): number {
  return totalRows * rowHeight;
}
