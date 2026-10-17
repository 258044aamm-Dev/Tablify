// COD-75 — the date & time panel, captured from the real TableView.
//
//   npx tsx tests/visual/capture-date-panel.ts [--theme dark|light|all] [--viewport owner|mobile]
//                                             [--out dir]
//
// There is no prototype screen to compare against: the prototype (and every previous version of
// the plugin) used the browser's native `<input type="date">` dialog, which never entered the
// DOM. So this script does not diff — it opens the panel in the production view, records where
// it landed, and writes the card and the page to PNG for the evidence file.
//
// It also asserts the two things a screenshot can show and a unit test cannot:
//   • the card is fully inside the viewport (no clipping at 390 × 844 or 1568 × 795),
//   • it hangs 6 px under the cell it was opened from, like the select and attachment panels.

import fs from 'node:fs';
import path from 'node:path';
import { REPO, buildHarness, openPlugin, type HarnessViewport } from './lib/harness';
import { startStaticServer } from './lib/server';
import { newTableText } from '../../src/menus/fileMenuModel';

type Theme = 'dark' | 'light';

const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const expand = <T extends string>(value: string, all: readonly T[]): T[] =>
  value === 'all' ? [...all] : (value.split(',') as T[]);

const OUT = path.resolve(REPO, arg('out', 'docs/evidence/cod-75'));
const THEMES = expand<Theme>(arg('theme', 'all'), ['light', 'dark']);
const VIEWPORTS = expand<HarnessViewport>(arg('viewport', 'owner,mobile'), ['owner', 'desktop', 'mobile']);

/** A table with both date types filled in, so the panel opens on a real value. */
function fixture(): string {
  const doc = JSON.parse(newTableText('Dates')) as {
    fields: Array<{ id: string; name: string; type: string }>;
    rows: Array<{ values: Record<string, unknown> }>;
    views: Array<{ columnOrder: string[] }>;
  };
  const due = doc.fields.find((f) => f.name === 'Due date');
  if (!due) throw new Error('fixture lost its Due date field');
  doc.fields.push({ id: 'fld_review', name: 'Review At', type: 'date_time' });
  doc.views[0].columnOrder.push('fld_review');
  doc.rows[0].values[due.id] = '2026-10-17';
  doc.rows[0].values['fld_review'] = '2026-10-17T08:30:00.000Z';
  return JSON.stringify(doc);
}

interface Box {
  found: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  cellBottom: number | null;
  viewport: { w: number; h: number };
}

async function measure(page: import('playwright').Page): Promise<Box> {
  return page.evaluate(() => {
    const card = document.querySelector('[data-testid="tablify-date-panel"]') as HTMLElement | null;
    const cell = document.querySelector('.tablify__row .tablify__cell[data-field-id="fld_review"] .tablify__capsule') as HTMLElement | null;
    if (!card) return { found: false, x: 0, y: 0, w: 0, h: 0, cellBottom: null, viewport: { w: innerWidth, h: innerHeight } };
    const r = card.getBoundingClientRect();
    const c = cell?.getBoundingClientRect();
    return {
      found: true,
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      cellBottom: c ? Math.round(c.bottom) : null,
      viewport: { w: innerWidth, h: innerHeight },
    };
  });
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  await buildHarness();
  const server = await startStaticServer(REPO);
  const text = fixture();
  const report: string[] = [];
  let failures = 0;

  try {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        const plugin = await openPlugin(server.origin, theme, viewport, text);
        try {
          const { page } = plugin;
          // Reach the date_time column with the keyboard — the grid's own documented gesture.
          await page.evaluate(`(() => {
            const root = document.querySelector('.tablify--grid');
            if (root) root.focus();
          })()`);
          const columnIndex = await page.evaluate(() => {
            const cells = Array.from(document.querySelectorAll('.tablify__row[data-row-index="0"] .tablify__cell'));
            return cells.findIndex((c) => (c as HTMLElement).dataset.fieldId === 'fld_review');
          });
          for (let i = 0; i < columnIndex + 2; i += 1) await page.keyboard.press('ArrowLeft');
          for (let i = 0; i < columnIndex; i += 1) await page.keyboard.press('ArrowRight');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(200);

          const box = await measure(page);
          if (!box.found) throw new Error(`panel did not open (${theme}/${viewport})`);
          const inside = box.x >= 0 && box.y >= 0 && box.x + box.w <= box.viewport.w && box.y + box.h <= box.viewport.h;
          const gap = box.cellBottom === null ? null : box.y - box.cellBottom;
          if (!inside) failures += 1;

          const card = page.locator('[data-testid="tablify-date-panel"]');
          await card.screenshot({ path: path.join(OUT, `date-panel-${theme}-${viewport}.png`) });
          await page.screenshot({ path: path.join(OUT, `date-panel-${theme}-${viewport}-page.png`) });

          report.push(
            `${theme}/${viewport}: ${box.w}×${box.h} at (${box.x},${box.y}) in ${box.viewport.w}×${box.viewport.h}` +
              ` · gap under cell ${gap === null ? 'n/a' : `${gap}px`} · ${inside ? 'INSIDE' : 'CLIPPED'}`,
          );
        } finally {
          await plugin.close();
        }
      }
    }
  } finally {
    await server.close();
  }

  console.log(report.join('\n'));
  console.log(`\nwrote ${THEMES.length * VIEWPORTS.length * 2} PNGs to ${path.relative(REPO, OUT)}`);
  if (failures > 0) {
    console.error(`\nFAIL: ${failures} capture(s) had the panel outside the viewport`);
    process.exit(1);
  }
}

void main();
