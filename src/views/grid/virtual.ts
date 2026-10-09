/**
 * Virtual row helper — pure math, no DOM.
 * Fixed row height per rowHeight setting; overscan = 5 (documented).
 * Column virtualization is **not** implemented in this step — see docs/evidence/P3-01.md for measured column limit.
 */

export const OVERSCAN = 5;

export function rowHeightPx(rowHeight: string): number {
  switch (rowHeight) {
    case 'compact':
    case 'small':
      return 28;
    case 'medium':
      return 36;
    case 'tall':
    case 'large':
      return 48;
    default:
      return 36;
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
