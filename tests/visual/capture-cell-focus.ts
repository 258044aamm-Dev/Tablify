// COD-77: cell-focusing evidence. Shoots the real TableView (the harness mounts the
// production class) with one cell focused, then the same grid after a pointerdown on
// the toolbar — outside the table surface — which must drop the highlight immediately.
//
// Plugin-only shots: the prototype already had this behavior (outsideTapClear,
// Prototype/script.js:866) and there is no pixel parity to measure here — the ticket
// is the disappearance itself.
//
//   npx tsx tests/visual/capture-cell-focus.ts [--out dir] [--theme dark|light|all]
//                                                [--viewport owner|mobile|all]
//   npx tsx tests/visual/capture-cell-focus.ts --evidence docs/evidence/cod-77/shipped
import fs from 'node:fs';
import path from 'node:path';
import { startStaticServer } from './lib/server';
import { REPO, openPlugin, type HarnessViewport } from './lib/harness';
import { newTableText } from '../../src/menus/fileMenuModel';

type Theme = 'dark' | 'light';
const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const expand = <T extends string>(v: string, all: T[]): T[] => (v === 'all' ? all : [v as T]);

/**
 * The stock new-table fixture, seeded with a few values so the focused cell is
 * one a user would actually press: names, statuses, due dates.
 */
function seededFixture(): string {
  const parsed = JSON.parse(newTableText('Cell focusing')) as {
    fields: Array<{ id: string; name: string; type: string }>;
    rows: Array<{ id: string; values: Record<string, unknown> }>;
  };
  const id = new Map(parsed.fields.map((f) => [f.name, f.id]));
  const names = ['Sprint review', 'Field notes', 'Launch checklist', 'Retro actions', 'Budget draft'];
  const statuses = ['In progress', 'Todo', 'Done', 'Todo', 'In progress'];
  parsed.rows.forEach((row, i) => {
    row.values[id.get('Name') ?? ''] = names[i % names.length];
    row.values[id.get('Status') ?? ''] = statuses[i % statuses.length];
    row.values[id.get('Due date') ?? ''] = `2026-10-2${(i % 8) + 1}`;
  });
  return JSON.stringify(parsed);
}

/** Clip the whole leaf card — toolbar, grid and the Insert Row pill — so both shots
 * show the surface the press lands on and the cell that lost its outline. */
async function clipOf(page: { evaluate: (s: string) => Promise<unknown> }): Promise<{ x: number; y: number; width: number; height: number }> {
  return (await page.evaluate(`(() => {
    const card = document.querySelector('.view-content').getBoundingClientRect();
    const pad = 6;
    return {
      x: Math.max(0, Math.round(card.left - pad)),
      y: Math.max(0, Math.round(card.top - pad)),
      width: Math.round(card.width + 2 * pad),
      height: Math.round(card.height + 2 * pad),
    };
  })()`)) as { x: number; y: number; width: number; height: number };
}

async function main(): Promise<void> {
  const out = path.resolve(arg('out', arg('evidence', 'docs/evidence/cod-77/shipped')));
  const themes = expand<Theme>(arg('theme', 'all'), ['dark', 'light']);
  const viewports = expand<HarnessViewport>(arg('viewport', 'all'), ['owner', 'desktop', 'mobile']);
  const fixture = seededFixture();
  fs.mkdirSync(out, { recursive: true });
  const server = await startStaticServer(REPO);
  const shots: string[] = [];
  try {
    for (const theme of themes) {
      for (const viewport of viewports) {
        const combo = `${theme}-${viewport}`;
        const plugin = await openPlugin(server.origin, theme, viewport, fixture);
        try {
          // 1. focused: one click on a body cell, exactly as a user presses it.
          // The state is asserted, not assumed — a shot that does not show a
          // focused cell would prove nothing.
          await plugin.page.evaluate(`(() => {
            const cell = document.querySelector(
              '.tablify__row[data-row-index="1"] .tablify__cell[data-col-index="0"]',
            );
            if (!cell) throw new Error('no cell to focus');
            cell.click();
            const selected = document.querySelectorAll('.tablify__cell--selected');
            if (selected.length !== 1 || !selected[0].isSameNode(cell)) {
              throw new Error('the click did not focus the cell');
            }
          })()`);
          await plugin.page.waitForTimeout(120);
          const focused = path.join(out, `${combo}.cell-focused.png`);
          await plugin.page.locator('.view-content').screenshot({ path: focused, clip: await clipOf(plugin.page) });
          shots.push(`${combo}.cell-focused.png`);

          // 2. cleared: a pointerdown on the toolbar — outside the table surface.
          // The real press event, not a scripted state change, so the capture
          // exercises the same document listener a user's tap does. The
          // assertion is the ticket: nothing may stay selected.
          await plugin.page.evaluate(`(() => {
            const bar = document.querySelector('.tablify__toolbar');
            if (!bar) throw new Error('no toolbar');
            bar.dispatchEvent(
              new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }),
            );
            if (document.querySelectorAll('.tablify__cell--selected').length !== 0) {
              throw new Error('the outside press did not drop the focused cell');
            }
          })()`);
          await plugin.page.waitForTimeout(120);
          const cleared = path.join(out, `${combo}.cell-cleared.png`);
          await plugin.page.locator('.view-content').screenshot({ path: cleared, clip: await clipOf(plugin.page) });
          shots.push(`${combo}.cell-cleared.png`);
        } finally {
          await plugin.close();
        }
      }
    }
  } finally {
    await server.close();
  }
  fs.writeFileSync(
    path.join(out, 'report.md'),
    '# Cell-focusing evidence (COD-77)\n\n' +
      'Each combo: the grid with one cell focused, then the same grid after a `pointerdown`\n' +
      'on the toolbar — outside the table surface. The capsule outline must be gone in the\n' +
      'second shot of every pair.\n\n' +
      shots.map((s) => `- ${s}`).join('\n') + '\n',
  );
  console.log(shots.join('\n'));
}

void main();
