/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { GridView } from '../../../src/views/grid/GridView.js';
import { generateFXM } from '../../query/fixtures.js';
import { createDefaultView } from '../../../src/model/view.js';

describe('P3-01 — Grid shell DOM bounded', () => {
  it('DOM row count stays at visible + overscan while scrolling FX-M', () => {
    const { fields, rows } = generateFXM(42); // 1k rows, 12 cols
    const view = createDefaultView(fields);
    view.rowHeight = 'medium';
    const grid = new GridView({ rows, fields, view, theme: 'light', viewportHeight: 600, viewportWidth: 800 });
    document.body.appendChild(grid.root);

    const checks: number[] = [];
    // simulate scroll from top to bottom in steps
    const rowH = 36;
    const totalH = rows.length * rowH;
    for (let top = 0; top < totalH; top += 600) {
      grid.setScrollTop(top);
      const count = grid.getRenderedRowCount();
      checks.push(count);
      // visible = ceil(600/36)=17, + overscan 5*2 ~10 => ~27 rows max
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(30);
    }
    // Ensure pool size never grows unbounded (visible+overscan+some recycled)
    expect(grid.getPoolSize()).toBeLessThanOrEqual(35);
    // Ensure counts are bounded and stable (no growth)
    const max = Math.max(...checks);
    const min = Math.min(...checks);
    expect(max - min).toBeLessThanOrEqual(5);

    grid.destroy();
    document.body.innerHTML = '';
  });

  it('touch scrolling style is set (no blocking)', () => {
    const { fields, rows } = generateFXM(1);
    const view = createDefaultView(fields);
    const grid = new GridView({ rows: rows.slice(0, 10), fields, view, theme: 'dark' });
    expect(grid.root.style.overflow).toBe('auto');
    // webkitOverflowScrolling touch is set via style (jsdom may not reflect but we set)
    expect(grid.root.style.webkitOverflowScrolling || (grid.root.style as unknown as Record<string, string>)['-webkit-overflow-scrolling']).toBeTruthy();
    grid.destroy();
  });

  it('theme class is plugin-scoped, not global', () => {
    const { fields, rows } = generateFXM(2);
    const view = createDefaultView(fields);
    const grid = new GridView({ rows: rows.slice(0, 5), fields, view, theme: 'light' });
    expect(grid.root.classList.contains('tablify--light')).toBe(true);
    expect(document.body.classList.contains('tablify--light')).toBe(false);
    grid.setTheme('dark');
    expect(grid.root.classList.contains('tablify--dark')).toBe(true);
    grid.destroy();
  });

  it('column virtualization is not implemented — all columns rendered', () => {
    const { fields, rows } = generateFXM(3);
    const view = createDefaultView(fields);
    const grid = new GridView({ rows: rows.slice(0, 1), fields, view, theme: 'light' });
    document.body.appendChild(grid.root);
    grid.setScrollTop(0);
    const firstRow = grid.content.firstElementChild as HTMLElement;
    expect(firstRow).toBeTruthy();
    const cells = firstRow.querySelectorAll('.tablify__cell');
    expect(cells.length).toBe(fields.length); // 12 cols, all rendered
    // Documented limit: 12 cols is smooth; we will benchmark 30 cols as degraded
    grid.destroy();
    document.body.innerHTML = '';
  });

  it('row pool recycles elements', () => {
    const { fields, rows } = generateFXM(4);
    const view = createDefaultView(fields);
    const grid = new GridView({ rows, fields, view, theme: 'light', viewportHeight: 600 });
    document.body.appendChild(grid.root);
    grid.setScrollTop(0);
    const firstBatch = Array.from(grid.content.children).map((el) => el as HTMLElement);
    grid.setScrollTop(600);
    const secondBatch = Array.from(grid.content.children).map((el) => el as HTMLElement);
    // At least some elements should be reused (same HTMLElement instances)
    const reused = firstBatch.filter((el) => secondBatch.includes(el)).length;
    expect(reused).toBeGreaterThan(0);
    grid.destroy();
    document.body.innerHTML = '';
  });
});
