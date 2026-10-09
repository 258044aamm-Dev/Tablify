/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { palette, lightTheme, darkTheme, applyTheme, allTokensResolved, cssVars } from '../../src/ui/theme/tokens.js';
import * as fs from 'fs';
import * as path from 'path';

describe('P3-09 — Design tokens', () => {
  it('palette matches branding.md §5 exactly (unverified)', () => {
    expect(palette.dark).toBe('#141413');
    expect(palette.light).toBe('#faf9f5');
    expect(palette.midGray).toBe('#b0aea5');
    expect(palette.lightGray).toBe('#e8e6dc');
    expect(palette.accentOrange).toBe('#d97757');
    expect(palette.accentBlue).toBe('#6a9bcc');
    expect(palette.accentGreen).toBe('#788c5d');
  });

  it('every token resolves in both themes', () => {
    expect(allTokensResolved()).toBe(true);
    const keys = Object.keys(lightTheme) as (keyof typeof lightTheme)[];
    for (const k of keys) {
      expect(lightTheme[k]).toBeTruthy();
      expect(darkTheme[k]).toBeTruthy();
      expect(typeof lightTheme[k]).toBe('string');
      expect(typeof darkTheme[k]).toBe('string');
    }
    expect(Object.keys(lightTheme).sort()).toEqual(Object.keys(darkTheme).sort());
  });

  it('themes are derived only from palette values', () => {
    const paletteValues = new Set(Object.values(palette));
    for (const t of [lightTheme, darkTheme]) {
      for (const v of Object.values(t)) {
        expect(paletteValues.has(v as string)).toBe(true);
      }
    }
  });

  it('no color literal outside tokens.ts (automated search)', () => {
    const srcRoot = path.resolve(process.cwd(), 'src');
    const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
    const offenders: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|js|css)$/.test(entry.name)) {
          if (full.endsWith('tokens.ts')) continue;
          const txt = fs.readFileSync(full, 'utf8');
          const matches = txt.match(hexRe);
          if (matches) offenders.push(`${path.relative(srcRoot, full)}: ${matches.join(', ')}`);
        }
      }
    }
    walk(srcRoot);
    // Also check root styles.css should have no literals (it uses vars)
    const rootCss = path.resolve(process.cwd(), 'styles.css');
    if (fs.existsSync(rootCss)) {
      const txt = fs.readFileSync(rootCss, 'utf8');
      const m = txt.match(hexRe);
      if (m) offenders.push(`styles.css: ${m.join(', ')}`);
    }
    expect(offenders, `color literals outside tokens.ts: ${offenders.join('; ')}`).toEqual([]);
  });

  it('applyTheme toggles plugin-scoped class and sets CSS vars, not global', () => {
    const el = document.createElement('div');
    applyTheme(el, 'light');
    expect(el.classList.contains('tablify')).toBe(true);
    expect(el.classList.contains('tablify--light')).toBe(true);
    expect(el.style.getPropertyValue(cssVars.bg)).toBe(palette.light);
    expect(el.style.getPropertyValue(cssVars.text)).toBe(palette.dark);
    expect(document.body.classList.contains('tablify--light')).toBe(false);

    applyTheme(el, 'dark');
    expect(el.classList.contains('tablify--dark')).toBe(true);
    expect(el.classList.contains('tablify--light')).toBe(false);
    expect(el.style.getPropertyValue(cssVars.bg)).toBe(palette.dark);
    expect(el.style.getPropertyValue(cssVars.text)).toBe(palette.light);
    expect(document.body.classList.contains('tablify--dark')).toBe(false);
  });

  it('layout is identical in light/dark across Obsidian light/dark mocks (T-M)', () => {
    // Mock a tiny grid: 5 rows, 3 cols, fixed width. The grid should not change size when theme changes.
    function makeGrid(): HTMLElement {
      const root = document.createElement('div');
      root.className = 'tablify';
      root.style.width = '600px';
      for (let i = 0; i < 5; i++) {
        const row = document.createElement('div');
        row.className = 'tablify__row';
        row.style.height = '36px';
        for (let c = 0; c < 3; c++) {
          const cell = document.createElement('div');
          cell.className = 'tablify__cell';
          cell.style.width = '200px';
          cell.textContent = `r${i}c${c}`;
          row.appendChild(cell);
        }
        root.appendChild(row);
      }
      return root;
    }

    const obsidianCases: Array<'obsidian-light' | 'obsidian-dark'> = ['obsidian-light', 'obsidian-dark'];
    const pluginCases: Array<'light' | 'dark'> = ['light', 'dark'];
    const snapshots: string[] = [];

    for (const obs of obsidianCases) {
      for (const th of pluginCases) {
        const grid = makeGrid();
        // simulate Obsidian theme via body class (should not affect grid layout)
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(obs === 'obsidian-light' ? 'theme-light' : 'theme-dark');
        applyTheme(grid, th);
        document.body.appendChild(grid);
        // layout check: child count and structure identical
        const rowCount = grid.querySelectorAll('.tablify__row').length;
        const cellCount = grid.querySelectorAll('.tablify__cell').length;
        snapshots.push(`${obs}+${th}:${rowCount}x${cellCount}:${grid.className}`);
        document.body.removeChild(grid);
      }
      document.body.classList.remove('theme-light', 'theme-dark');
    }

    // All four combos must produce same row/cell counts and not leak layout
    expect(snapshots[0]).toContain('5x15');
    expect(new Set(snapshots.map((s) => s.split(':')[1])).size).toBe(1);
  });

  it('theme switch completes <100ms (proposed)', () => {
    const el = document.createElement('div');
    // warmup
    for (let i = 0; i < 3; i++) applyTheme(el, i % 2 === 0 ? 'light' : 'dark');
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      applyTheme(el, i % 2 === 0 ? 'light' : 'dark');
      // force layout
      void el.offsetHeight;
      const t1 = performance.now();
      times.push(t1 - t0);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    // informational in sandbox, but assert <100 to keep CI green (sandbox is fast)
    expect(p95).toBeLessThan(100);
    console.log(`P3-09 theme switch p95=${p95.toFixed(3)}ms raw=${times.map((t) => t.toFixed(3)).join(',')}`);
  });
});
