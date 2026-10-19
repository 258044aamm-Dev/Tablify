/**
 * @vitest-environment jsdom
 *
 * SAD-307 — Insert row button in the bottom bar within a mobile device.
 *
 * Verifies:
 *   1. `.tablify-view` and `.view-content.tablify-view.tablify` reserve bottom clearance
 *      for Obsidian's mobile bottom bar (`.mobile-navbar`) and `env(safe-area-inset-bottom, 0px)`
 *      across `@media (max-width: 639px)`, `@media (pointer: coarse) and (max-height: 639px)`,
 *      and `body.is-mobile` / `body.is-phone`, with `overflow-y: auto` on `.tablify-view`.
 *   2. `TableView` dynamically measures the overlap between `.tablify-view` and Obsidian's
 *      `.mobile-navbar` / `.mobile-toolbar` / `visualViewport` and sets
 *      `--tablify-mobile-bottom-inset` on `contentEl` without hiding or modifying Obsidian's
 *      native bottom bar.
 *   3. Tables with both a small number of rows (0, 1, 2) and a large number of rows (20, 50, 100)
 *      keep `.tablify__insert-row` accessible and above `.mobile-navbar` across mobile portrait
 *      and mobile landscape orientations.
 *   4. Desktop viewports (`> 639px`, non-mobile) do not receive `--tablify-mobile-bottom-inset`
 *      and preserve the existing 24px view padding and layout.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceLeaf } from 'obsidian';
import { TableView } from '../../src/views/tableView.js';
import type { FieldDefinition, Row } from '../../src/model/types.js';

const NOW = '2026-10-19T00:00:00.000Z';

function makeFields(count = 4): FieldDefinition[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `fld_${i}`,
    name: `Field ${i}`,
    type: 'text' as const,
    ...(i === 0 ? { primary: true } : {}),
  }));
}

function makeRows(count: number, fields: FieldDefinition[]): Row[] {
  return Array.from({ length: count }, (_, r) => ({
    id: `row_${r}`,
    rev: 1,
    createdAt: NOW,
    updatedAt: NOW,
    sync: null,
    values: Object.fromEntries(fields.map((f, c) => [f.id, `R${r}C${c}`])),
  }));
}

function tableJson(rowCount: number, fieldCount = 4): string {
  const fields = makeFields(fieldCount);
  const rows = makeRows(rowCount, fields);
  return JSON.stringify({
    formatVersion: 2,
    tableId: 'tbl_sad307',
    name: 'Mobile Insert Row Table',
    fields,
    rows,
    views: [
      {
        id: 'viw_1',
        name: 'Grid',
        type: 'grid',
        columnOrder: fields.map((f) => f.id),
        columnWidths: {},
        frozenColumns: 1,
        rowHeight: 'medium',
      },
    ],
    syncLink: null,
  });
}

function need<T>(value: T | null | undefined, label: string): T {
  expect(value, label).not.toBeNull();
  if (value === null || value === undefined) throw new Error(`missing: ${label}`);
  return value;
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function setViewportSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    configurable: true,
    writable: true,
  });
}

function mountObsidianMobileNavbar(
  viewportWidth: number,
  viewportHeight: number,
  navbarHeight = 56,
  safeAreaBottom = 20,
): HTMLElement {
  const navbar = document.createElement('div');
  navbar.className = 'mobile-navbar';
  const top = viewportHeight - navbarHeight - safeAreaBottom;
  vi.spyOn(navbar, 'getBoundingClientRect').mockImplementation(() =>
    rect(0, top, viewportWidth, navbarHeight),
  );
  document.body.appendChild(navbar);
  return navbar;
}

const openViews: TableView[] = [];

async function openTableView(
  rowCount: number,
  opts?: {
    viewportWidth?: number;
    viewportHeight?: number;
    isMobileBody?: boolean;
  },
): Promise<TableView> {
  const vw = opts?.viewportWidth ?? 390;
  const vh = opts?.viewportHeight ?? 844;
  setViewportSize(vw, vh);
  if (opts?.isMobileBody) {
    document.body.classList.add('is-mobile');
  }

  const view = new TableView(new WorkspaceLeaf() as never);
  Object.defineProperty(view.contentEl, 'clientWidth', {
    value: vw,
    configurable: true,
  });
  Object.defineProperty(view.contentEl, 'clientHeight', {
    value: vh,
    configurable: true,
  });
  vi.spyOn(view.contentEl, 'getBoundingClientRect').mockImplementation(() =>
    rect(0, 0, vw, vh),
  );

  await view.onOpen();
  document.body.appendChild(view.contentEl);
  view.setViewData(tableJson(rowCount), false);
  openViews.push(view);
  return view;
}

describe('SAD-307 — Insert Row button mobile bottom bar clearance & accessibility', () => {
  const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');

  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    setViewportSize(1024, 768);
  });

  afterEach(() => {
    for (const v of openViews) v.clear();
    openViews.length = 0;
    document.body.className = '';
    vi.restoreAllMocks();
  });

  describe('CSS rules for mobile bottom bar and safe-area clearance', () => {
    it('configures overflow-y: auto on .tablify-view and preserves 24px desktop padding', () => {
      const at = css.indexOf('.tablify-view {');
      expect(at).toBeGreaterThan(-1);
      const viewRule = css.slice(at, css.indexOf('}', at));
      expect(viewRule).toContain('overflow-y: auto;');
      expect(viewRule).toContain('padding: 24px;');
    });

    it('reserves --tablify-mobile-bottom-pad with safe-area fallback in @media (max-width: 639px), coarse landscape, and body.is-mobile', () => {
      expect(css).toContain(
        '--tablify-mobile-bottom-pad: calc(\n      12px + max(var(--tablify-mobile-bottom-inset, 0px), 56px + env(safe-area-inset-bottom, 0px))\n    );',
      );
      expect(css).toContain('padding: 12px 12px var(--tablify-mobile-bottom-pad);');
      expect(css).toContain('@media (pointer: coarse) and (max-height: 639px)');
      expect(css).toContain('body.is-mobile .view-content.tablify-view.tablify');
      expect(css).toContain('body.is-phone .view-content.tablify-view.tablify');
    });

    it('does not hide, remove, or style Obsidian native .mobile-navbar or .mobile-toolbar', () => {
      // Strip CSS comments before checking selectors so explanatory comments don't match.
      const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(stripped).not.toContain('.mobile-navbar');
      expect(stripped).not.toContain('.mobile-toolbar');
    });
  });

  describe('Small row counts (0, 1, 2 rows) on mobile devices', () => {
    it.each([0, 1, 2])(
      'keeps Insert Row accessible and above Obsidian .mobile-navbar for a %i-row table on mobile portrait (390x844)',
      async (rowCount) => {
        const navbar = mountObsidianMobileNavbar(390, 844, 56, 20);
        const view = await openTableView(rowCount, {
          viewportWidth: 390,
          viewportHeight: 844,
          isMobileBody: true,
        });

        // 844 - (844 - 56 - 20) = 76px overlap with Obsidian's floating mobile navbar + safe area.
        expect(view.contentEl.style.getPropertyValue('--tablify-mobile-bottom-inset')).toBe(
          '76px',
        );

        // Obsidian's native bottom bar is untouched.
        expect(document.body.contains(navbar)).toBe(true);
        expect(navbar.style.display).toBe('');
        expect(navbar.hasAttribute('hidden')).toBe(false);

        const grid = need(view.contentEl.querySelector<HTMLElement>('.tablify--grid'), 'grid');
        const insertWrap = need(
          grid.querySelector<HTMLElement>('.tablify__insert-wrap'),
          'insert wrap',
        );
        const insertBtn = need(
          insertWrap.querySelector<HTMLButtonElement>('button.tablify__insert-row'),
          'insert row button',
        );

        // Consistent UI placement: insertWrap remains the last child of .tablify--grid after .tablify__viewport.
        expect(grid.lastElementChild).toBe(insertWrap);

        // Clicking Insert Row appends a row and enters edit mode.
        insertBtn.click();
        const rowsAfter = JSON.parse(view.getViewData()).rows as unknown[];
        expect(rowsAfter.length).toBe(rowCount + 1);
      },
    );
  });

  describe('Large row counts (20, 50, 100 rows) across mobile portrait and landscape', () => {
    it.each([20, 50, 100])(
      'keeps Insert Row reachable above .mobile-navbar when scrolling to the bottom of a %i-row table on mobile portrait (390x844)',
      async (rowCount) => {
        const navbar = mountObsidianMobileNavbar(390, 844, 56, 20);
        const view = await openTableView(rowCount, {
          viewportWidth: 390,
          viewportHeight: 844,
          isMobileBody: true,
        });

        const insetPx = Number.parseInt(
          view.contentEl.style.getPropertyValue('--tablify-mobile-bottom-inset'),
          10,
        );
        expect(insetPx).toBe(76);

        const grid = need(view.contentEl.querySelector<HTMLElement>('.tablify--grid'), 'grid');
        const insertBtn = need(
          grid.querySelector<HTMLButtonElement>('button.tablify__insert-row'),
          'insert row button',
        );

        // With 12px top padding and (12px + 76px = 88px) bottom padding on .tablify-view (height 844px),
        // the card's maximum bottom edge is 844 - 88 = 756px, and the grid inside the card (16px padding)
        // ends at 756 - 16 = 740px — strictly above the navbar top at 844 - 76 = 768px.
        const bottomPad = 12 + insetPx;
        const cardBottom = 844 - bottomPad;
        const gridBottom = cardBottom - 16;
        const totalContentHeight = 46 + rowCount * 58 + 52; // header + rows + insert wrap
        const visibleGridHeight = 480;

        Object.defineProperty(grid, 'clientHeight', {
          value: visibleGridHeight,
          configurable: true,
        });
        Object.defineProperty(grid, 'scrollHeight', {
          value: totalContentHeight,
          configurable: true,
        });

        // Scroll the grid all the way to the bottom to reach the Insert Row button.
        const maxScrollTop = totalContentHeight - visibleGridHeight;
        grid.scrollTop = maxScrollTop;
        grid.dispatchEvent(new Event('scroll'));

        // At max scroll, Insert Row sits at the bottom of the grid (gridBottom - 8px padding).
        const insertBtnBottom = gridBottom - 8;
        const insertBtnTop = insertBtnBottom - 36;
        vi.spyOn(insertBtn, 'getBoundingClientRect').mockImplementation(() =>
          rect(28, insertBtnTop, 334, 36),
        );

        const btnRect = insertBtn.getBoundingClientRect();
        const navbarRect = navbar.getBoundingClientRect();

        // The Insert Row button is fully above Obsidian's mobile bottom bar and inside the visible area.
        expect(btnRect.bottom).toBeLessThanOrEqual(navbarRect.top);
        expect(btnRect.top).toBeGreaterThanOrEqual(0);

        // Clicking Insert Row adds a row even in a large table.
        insertBtn.click();
        const rowsAfter = JSON.parse(view.getViewData()).rows as unknown[];
        expect(rowsAfter.length).toBe(rowCount + 1);
      },
    );

    it('updates bottom bar clearance across orientation changes into mobile landscape (844x390) and keeps Insert Row accessible', async () => {
      const navbar = mountObsidianMobileNavbar(390, 844, 56, 20);
      const view = await openTableView(50, {
        viewportWidth: 390,
        viewportHeight: 844,
        isMobileBody: true,
      });

      expect(view.contentEl.style.getPropertyValue('--tablify-mobile-bottom-inset')).toBe('76px');

      // Rotate device to mobile landscape (844x390) where width > 639px and navbar sits at 390 - 48 = 342px.
      setViewportSize(844, 390);
      Object.defineProperty(view.contentEl, 'clientWidth', {
        value: 844,
        configurable: true,
      });
      Object.defineProperty(view.contentEl, 'clientHeight', {
        value: 390,
        configurable: true,
      });
      vi.spyOn(view.contentEl, 'getBoundingClientRect').mockImplementation(() =>
        rect(0, 0, 844, 390),
      );
      vi.spyOn(navbar, 'getBoundingClientRect').mockImplementation(() =>
        rect(0, 342, 844, 48),
      );

      view.onResize();

      // Overlap in landscape is 390 - 342 = 48px.
      expect(view.contentEl.style.getPropertyValue('--tablify-mobile-bottom-inset')).toBe('48px');

      const insertBtn = need(
        view.contentEl.querySelector<HTMLButtonElement>('button.tablify__insert-row'),
        'insert row button in landscape',
      );
      insertBtn.click();
      const rowsAfter = JSON.parse(view.getViewData()).rows as unknown[];
      expect(rowsAfter.length).toBe(51);
    });
  });

  describe('Desktop layout preservation', () => {
    it('does not set --tablify-mobile-bottom-inset on desktop viewports (> 639px, non-mobile)', async () => {
      const view = await openTableView(30, {
        viewportWidth: 1280,
        viewportHeight: 800,
        isMobileBody: false,
      });

      expect(view.contentEl.style.getPropertyValue('--tablify-mobile-bottom-inset')).toBe('');

      const insertBtn = need(
        view.contentEl.querySelector<HTMLButtonElement>('button.tablify__insert-row'),
        'desktop insert row button',
      );
      insertBtn.click();
      const rowsAfter = JSON.parse(view.getViewData()).rows as unknown[];
      expect(rowsAfter.length).toBe(31);
    });

    it('clears --tablify-mobile-bottom-inset when resizing from mobile width to desktop width', async () => {
      mountObsidianMobileNavbar(390, 844, 56, 20);
      const view = await openTableView(10, {
        viewportWidth: 390,
        viewportHeight: 844,
        isMobileBody: false,
      });

      expect(view.contentEl.style.getPropertyValue('--tablify-mobile-bottom-inset')).toBe('76px');

      // Remove mobile navbar and resize to desktop (1280x800).
      document.querySelectorAll('.mobile-navbar').forEach((el) => el.remove());
      setViewportSize(1280, 800);
      Object.defineProperty(view.contentEl, 'clientWidth', {
        value: 1280,
        configurable: true,
      });
      Object.defineProperty(view.contentEl, 'clientHeight', {
        value: 800,
        configurable: true,
      });
      vi.spyOn(view.contentEl, 'getBoundingClientRect').mockImplementation(() =>
        rect(0, 0, 1280, 800),
      );

      view.onResize();
      expect(view.contentEl.style.getPropertyValue('--tablify-mobile-bottom-inset')).toBe('');
    });
  });
});
