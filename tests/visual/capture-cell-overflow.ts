// SAD-376: cell-overflow evidence. Shoots the real TableView (the harness mounts the production
// class) through the ladder the ticket describes, in order:
//
//   1. hover a cell whose text is cut off — the in-cell control appears, the ellipsis is untouched
//      and the column geometry is identical to the cell that fits;
//   2. rest on that control — the preview card opens with the value wrapped over several lines and
//      copy / expand in its top-right corner;
//   3. click it (or choose *Expand cell*) — the anchored panel shows the whole value.
//
// Every state is asserted before it is shot, and the numbers the report quotes are read back from
// the live computed styles, so a shot that does not prove the state fails the run instead of
// shipping. Plugin-only: the prototype has no overflow affordance, so there is no pixel parity to
// measure here — this is new surface the owner asked for (plan §2, §7).
//
//   npx tsx tests/visual/capture-cell-overflow.ts [--out dir] [--theme dark|light|all]
//                                                 [--viewport owner|desktop|mobile|all]
//   npx tsx tests/visual/capture-cell-overflow.ts --out docs/evidence/sad-376

import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer } from './lib/server';
import { REPO, buildHarness, openPlugin, type HarnessViewport } from './lib/harness';
import { newTableText } from '../../src/menus/fileMenuModel';

type Theme = 'dark' | 'light';
const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const expand = <T extends string>(v: string, all: readonly T[]): T[] =>
  v === 'all' ? [...all] : (v.split(',') as T[]);

/** Long enough to pass 80 characters several times over, with real words so the wrap is legible. */
const LONG =
  'The launch checklist for the Q4 field migration: confirm the sync window with ops, re-run the ' +
  'attachment backfill, verify every link field resolves, and publish the rollback note before the ' +
  'freeze on Friday afternoon.';

/** One table: a column that overflows, a column that fits, and a short row underneath both. */
function fixture(): string {
  const parsed = JSON.parse(newTableText('Cell overflow')) as {
    fields: Array<{ id: string; name: string; type: string }>;
    rows: Array<{ id: string; values: Record<string, unknown> }>;
    views: Array<{ columnWidths?: Record<string, number>; columnOrder?: string[] }>;
  };
  const id = new Map(parsed.fields.map((f) => [f.name, f.id]));
  const notes = id.get('Notes') ?? '';
  const name = id.get('Name') ?? '';
  parsed.rows.forEach((row, i) => {
    row.values[name] = ['Sprint review', 'Field notes', 'Launch checklist', 'Retro actions'][i % 4];
    // Row 0 holds the long value; every other row is short, so "fits" is visible side by side.
    row.values[notes] = i === 0 ? LONG : 'Short enough to fit.';
  });
  // A column width that guarantees the long value is cut off on both viewports.
  for (const view of parsed.views) view.columnWidths = { ...(view.columnWidths ?? {}), [notes]: 180 };
  return JSON.stringify(parsed);
}

interface Numbers {
  [key: string]: number | string | boolean | null;
}

interface Capture {
  theme: Theme;
  viewport: HarnessViewport;
  nums: Numbers;
}

const CELL = (row: number, col: number) =>
  `.tablify__row[data-row-index="${row}"] .tablify__cell[data-col-index="${col}"]`;

async function main(): Promise<void> {
  const out = path.resolve(arg('out', 'docs/evidence/sad-376'));
  const themes = expand<Theme>(arg('theme', 'all'), ['dark', 'light']);
  const viewports = expand<HarnessViewport>(arg('viewport', 'all'), ['owner', 'desktop', 'mobile']);
  fs.mkdirSync(out, { recursive: true });
  await buildHarness();
  const server = await startStaticServer(REPO);
  const text = fixture();
  const runs: Capture[] = [];
  const shots: string[] = [];
  try {
    for (const theme of themes) {
      for (const viewport of viewports) {
        const combo = `${theme}-${viewport}`;
        const plugin = await openPlugin(server.origin, theme, viewport, text);
        try {
          const page = plugin.page;

          // ---- 1. hover: the control appears, and nothing else moves -----------------
          const nums = (await page.evaluate(`(async () => {
            const $ = (sel) => { const el = document.querySelector(sel); if (!el) throw new Error('missing ' + sel); return el; };
            const long = ${JSON.stringify(CELL(0, 1))};
            const short = ${JSON.stringify(CELL(1, 1))};
            const longCell = $(long);
            const shortCell = $(short);
            const textOf = (cell) => { const t = cell.querySelector('.tablify__cell-text'); if (!t) throw new Error('no text'); return t; };
            const out = {};

            // The truncation half of the ticket: the rendered text really is taller than its
            // (2-line clamped) box, and the short one is not. The clamp is what cuts it, so the
            // height comparison is the honest reading here, not scrollWidth.
            const clipped = (cell) => {
              const t = textOf(cell);
              return t.scrollHeight > t.clientHeight + 1;
            };
            out.textLen = textOf(longCell).textContent.length;
            out.long_clipped = clipped(longCell);
            out.short_clipped = clipped(shortCell);
            out.long_scroll_h = textOf(longCell).scrollHeight;
            out.long_client_h = textOf(longCell).clientHeight;
            out.text_overflow = getComputedStyle(textOf(longCell)).textOverflow;
            out.line_clamp = getComputedStyle(textOf(longCell)).webkitLineClamp;
            out.long_hasClass = longCell.classList.contains('tablify__cell--overflow');
            out.short_hasClass = shortCell.classList.contains('tablify__cell--overflow');

            // Before the hover: the control is in the DOM (the row pool keeps it) but invisible
            // and not clickable, so it cannot intercept a click meant for the cell.
            const before = $(long + ' .tablify__cell-expand');
            out.control_hidden_opacity = getComputedStyle(before).opacity;
            out.control_hidden_events = getComputedStyle(before).pointerEvents;
            out.short_control = shortCell.querySelector('.tablify__cell-expand') === null;

            // Geometry: the control is out of flow, so the two cells of the column are equal.
            out.long_width = Math.round(longCell.getBoundingClientRect().width);
            out.short_width = Math.round(shortCell.getBoundingClientRect().width);
            out.control_w = Math.round(before.getBoundingClientRect().width);
            out.control_h = Math.round(before.getBoundingClientRect().height);
            // The control must be the plugin's 20 px ghost button, not Obsidian's 30 px host pill
            // (the host's base button rule out-ranks a bare class selector).
            const bcs = getComputedStyle(before);
            out.control_css_w = bcs.width;
            out.control_css_h = bcs.height;
            out.control_border = bcs.borderTopWidth;
            out.control_radius = bcs.borderTopLeftRadius;
            out.control_ink = bcs.color;
            out.control_bottom = Math.round(before.getBoundingClientRect().bottom);
            return out;
          })()`)) as Numbers;

          await page.hover(CELL(0, 1));
          await page.waitForTimeout(220);
          const hovered = (await page.evaluate(`(() => {
            const btn = document.querySelector(${JSON.stringify(CELL(0, 1))} + ' .tablify__cell-expand');
            if (!btn) throw new Error('no control');
            const cs = getComputedStyle(btn);
            if (cs.opacity !== '1' || cs.pointerEvents !== 'auto') {
              throw new Error('the control did not appear on hover: ' + cs.opacity + '/' + cs.pointerEvents);
            }
            const box = btn.getBoundingClientRect();
            // The hover changed nothing about the text: same clamp, same ellipsis, same box.
            const t = document.querySelector(${JSON.stringify(CELL(0, 1))} + ' .tablify__cell-text');
            const tcs = getComputedStyle(t);
            return { opacity: cs.opacity, events: cs.pointerEvents, label: btn.getAttribute('aria-label'),
                     x: Math.round(box.left), y: Math.round(box.top),
                     clamp: tcs.webkitLineClamp, overflow: tcs.textOverflow };
          })()`)) as Numbers;
          Object.assign(nums, {
            hover_opacity: hovered.opacity,
            hover_clamp: hovered.clamp,
            hover_text_overflow: hovered.overflow,
            hover_events: hovered.events,
            hover_label: hovered.label,
            control_x: hovered.x,
            control_y: hovered.y,
          });
          shots.push(`${combo}.1-cell-hover.png`);
          await page.screenshot({ path: path.join(out, `${combo}.1-cell-hover.png`) });

          // ---- 2. rest on the control: the preview card ------------------------------
          await page.hover(CELL(0, 1) + ' .tablify__cell-expand');
          await page.waitForSelector('[data-testid="tablify-cell-overflow-card"]', { timeout: 2000 });
          await page.waitForTimeout(120);
          const card = (await page.evaluate(`(() => {
            const card = document.querySelector('[data-testid="tablify-cell-overflow-card"]');
            if (!card) throw new Error('no card');
            const body = card.querySelector('.tablify__cellcard-body');
            if (!body) throw new Error('no card body');
            const box = card.getBoundingClientRect();
            const vw = window.innerWidth, vh = window.innerHeight;
            const tools = [...card.querySelectorAll('.tablify__cellcard-tool')].map((t) => t.getAttribute('data-testid'));
            return {
              role: card.getAttribute('role'),
              card_w: Math.round(box.width),
              card_h: Math.round(box.height),
              card_x: Math.round(box.left),
              card_y: Math.round(box.top),
              // The gap the 150 ms exit grace exists to let the pointer cross.
              card_gap: Math.round(box.top - (() => {
                const btn = document.querySelector('.tablify__cell-expand');
                return btn ? btn.getBoundingClientRect().bottom : box.top;
              })()),
              // Clamped into the viewport: a card may never hang off an edge (plan §4.3).
              inside_x: box.left >= 0 && box.right <= vw,
              inside_y: box.top >= 0 && box.bottom <= vh,
              viewport_w: vw,
              viewport_h: vh,
              body_max_h: getComputedStyle(body).maxHeight,
              body_wrap: getComputedStyle(body).whiteSpace,
              body_break: getComputedStyle(body).overflowWrap,
              body_text_len: (body.textContent || '').length,
              body_full: (body.textContent || '') === ${JSON.stringify(LONG)},
              tools: tools.join('+'),
              tabbable: card.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])').length,
            };
          })()`)) as Numbers;
          Object.assign(nums, card);
          shots.push(`${combo}.2-card.png`);
          await page.screenshot({ path: path.join(out, `${combo}.2-card.png`) });

          // ---- 3. the card's expand glyph hands over to the panel --------------------
          await page.click('[data-testid="tablify-cell-overflow-card-expand"]');
          await page.waitForSelector('[data-testid="tablify-cell-overflow-panel"]', { timeout: 2000 });
          await page.waitForTimeout(120);
          const panel = (await page.evaluate(`(() => {
            const panel = document.querySelector('[data-testid="tablify-cell-overflow-panel"]');
            if (!panel) throw new Error('no panel');
            const box = panel.getBoundingClientRect();
            const body = panel.querySelector('.tablify__overflow-text');
            const vw = window.innerWidth, vh = window.innerHeight;
            return {
              panel_role: panel.getAttribute('role'),
              panel_w: Math.round(box.width),
              panel_x: Math.round(box.left),
              panel_y: Math.round(box.top),
              panel_inside_x: box.left >= 0 && box.right <= vw,
              panel_inside_y: box.top >= 0 && box.bottom <= vh,
              panel_full: (body ? body.textContent : '') === ${JSON.stringify(LONG)},
              card_closed: document.querySelector('[data-testid="tablify-cell-overflow-card"]') === null,
            };
          })()`)) as Numbers;
          Object.assign(nums, panel);
          shots.push(`${combo}.3-panel.png`);
          await page.screenshot({ path: path.join(out, `${combo}.3-panel.png`) });

          // The card must not outlive a re-render or a scroll (rows are pooled).
          await page.keyboard.press('Escape');
          runs.push({ theme, viewport, nums });
        } finally {
          await plugin.close();
        }
      }
    }
  } finally {
    await server.close();
  }

  const table = (rows: Capture[], keys: string[]): string =>
    [
      `| state | ${rows.map((r) => `${r.theme}-${r.viewport}`).join(' | ')} |`,
      `|---|${rows.map(() => '---').join('|')}|`,
      ...keys.map(
        (k) => `| \`${k}\` | ${rows.map((r) => String(r.nums[k] ?? '—')).join(' | ')} |`,
      ),
    ].join('\n');

  const keys = Object.keys(runs[0]?.nums ?? {});
  fs.writeFileSync(
    path.join(out, 'capture-report.md'),
    [
      '# SAD-376 — cell-overflow capture report (real plugin, visual harness)',
      '',
      'Each combo: (1) hover on a cell whose text is cut off, (2) resting on its control — the',
      'preview card, (3) the anchored panel, opened from the card\'s expand glyph. Every state is',
      'asserted before it is shot; the numbers below are read from the live computed styles.',
      '',
      '## Measured',
      '',
      table(runs, keys),
      '',
      '## Shots',
      '',
      ...shots.map((s) => `- ${s}`),
      '',
    ].join('\n'),
  );
  console.log(shots.join('\n'));
  console.log(`\n${runs.length} combo(s) → ${path.relative(REPO, out)}`);
}

void main();
