/**
 * Row pool — recycles HTMLElements for virtual rows.
 * Keeps DOM size bounded at visible + overscan.
 */

export class RowPool {
  private pool: HTMLElement[] = [];
  private active: Map<number, HTMLElement> = new Map();

  constructor(private createRow: () => HTMLElement) {}

  /**
   * Update pool for visible range [start, end). Returns active elements in order.
   * Recycles elements that fall outside the range.
   */
  update(start: number, end: number): HTMLElement[] {
    const needed = end - start;
    // Release rows that are no longer visible
    for (const [idx, el] of this.active) {
      if (idx < start || idx >= end) {
        this.pool.push(el);
        this.active.delete(idx);
      }
    }
    // Ensure we have enough elements
    while (this.pool.length < needed - this.active.size) {
      this.pool.push(this.createRow());
    }
    // Assign elements for new indices
    const result: HTMLElement[] = [];
    for (let i = start; i < end; i++) {
      if (!this.active.has(i)) {
        const el = this.pool.pop()!;
        this.active.set(i, el);
      }
      result.push(this.active.get(i)!);
    }
    return result;
  }

  /** Current DOM size (active + pooled) — should stay bounded. */
  get size(): number {
    return this.active.size + this.pool.length;
  }

  /** Active count — visible + overscan */
  get activeCount(): number {
    return this.active.size;
  }

  /** For tests: get active indices */
  getActiveIndices(): number[] {
    return Array.from(this.active.keys()).sort((a, b) => a - b);
  }

  clear(): void {
    this.pool.push(...this.active.values());
    this.active.clear();
  }
}
