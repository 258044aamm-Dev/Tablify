// SAD-86: Add Field parity capture. Opens the plugin's AddFieldModal (real class, Obsidian modal
// markup, hostile host CSS) and the prototype's #addFieldModal on the same table, puts both in the
// same state (field type, formula), and pixel-compares the two cards.
//
// COD-76: the Field type ROW is masked out of the comparison. The plugin now draws its own picker
// there (icon + name + chevron) while the prototype keeps a native <select>; that difference is the
// ticket, so comparing it pixel for pixel would only measure the ticket. Everything else on the card
// is still compared, which is what this script exists to protect.
//
//   npx tsx tests/visual/capture-add-field.ts [--theme dark|light|all] [--viewport owner|mobile|all] [--out dir]
//   npx tsx tests/visual/capture-add-field.ts --evidence docs/evidence/cod-76/shipped
//
// With --evidence the script also shoots the picker itself (open, searching, blocked rows) for the
// COD-76 board. Those are plugin-only shots: the prototype has no panel to compare against.
import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error -- pngjs ships no type declarations (dev-only script; same import as capture-filter-builder).
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { REPO, buildHarness, openPlugin, openPrototype, type HarnessViewport } from './lib/harness';
import { startStaticServer } from './lib/server';
import { newTableText } from '../../src/menus/fileMenuModel';

type Theme = 'dark' | 'light';
const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const expand = <T extends string>(v: string, all: T[]): T[] => (v === 'all' ? all : [v as T]);

const FORMULA = 'IF(1 > 0, "big", "small")';
/** State → field type (and, for formula, an expression typed into the box). */
const STATES: Record<string, { type: string; formula?: string }> = {
  text: { type: 'text' },
  select: { type: 'single_select' },
  number: { type: 'number' },
  formula: { type: 'formula', formula: FORMULA },
  link: { type: 'link' },
};

/**
 * COD-76: shoot the picker as a user sees it — the Add / Modify Field card plus the panel hanging
 * under it. The panel is on `document.body`, so the card alone would not contain it; the clip is the
 * union of the two, clamped to the viewport.
 */
async function capturePicker(
  server: Awaited<ReturnType<typeof startStaticServer>>,
  theme: Theme,
  viewport: HarnessViewport,
  fixture: string,
  dir: string,
  name: string,
  open: string,
): Promise<void> {
  const plugin = await openPlugin(server.origin, theme, viewport, fixture);
  try {
    await plugin.page.evaluate(open);
    await plugin.page.mouse.move(0, 0);
    await plugin.page.evaluate('document.fonts.ready');
    await plugin.page.waitForTimeout(120);
    const clip = (await plugin.page.evaluate(`(() => {
      const card = document.querySelector('.tablify__af-modal').getBoundingClientRect();
      const panel = document.querySelector('[data-testid="tablify-field-type-panel"]');
      if (!panel) throw new Error('the picker did not open');
      const p = panel.getBoundingClientRect();
      const pad = 8;
      const left = Math.max(0, Math.min(card.left, p.left) - pad);
      const top = Math.max(0, Math.min(card.top, p.top) - pad);
      const right = Math.min(window.innerWidth, Math.max(card.right, p.right) + pad);
      const bottom = Math.min(window.innerHeight, Math.max(card.bottom, p.bottom) + pad);
      return { x: Math.round(left), y: Math.round(top), width: Math.round(right - left), height: Math.round(bottom - top) };
    })()`)) as { x: number; y: number; width: number; height: number };
    await plugin.page.screenshot({ path: path.join(dir, `${theme}-${viewport}.${name}.png`), clip });
  } finally {
    await plugin.close();
  }
}

function pad(img: PNG, w: number, h: number): PNG {
  const out = new PNG({ width: w, height: h });
  out.data.fill(0);
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out;
}

async function main(): Promise<void> {
  const themes = expand<Theme>(arg('theme', 'all'), ['dark', 'light']);
  const viewports = expand<HarnessViewport>(arg('viewport', 'all'), ['owner', 'mobile'] as HarnessViewport[]);
  const out = path.resolve(arg('out', '.out/add-field'));
  fs.mkdirSync(out, { recursive: true });
  const evidence = arg('evidence', '');
  const fixture = newTableText('Untitled table');
  await buildHarness();
  const server = await startStaticServer(REPO);
  const lines = ['| Combo | State | Plugin | Prototype | Pixel diff |', '|---|---|---|---|---|'];
  try {
    for (const theme of themes) for (const viewport of viewports) for (const [state, cfg] of Object.entries(STATES)) {
      const combo = `${theme}-${viewport}`;
      const plugin = await openPlugin(server.origin, theme, viewport, fixture);
      await plugin.page.evaluate(`(() => {
        window.__tablifyOpenModal('addField');
        // COD-76: the type row is the plugin's picker, not a native select — pick through the UI
        // the way a user does, so the capture keeps testing the shipped control.
        const trigger = document.getElementById('tablify__af-type');
        trigger.click();
        const row = document.querySelector('[data-testid="tablify-field-type-panel"] [data-type="${cfg.type}"]');
        if (!row) throw new Error('no ${cfg.type} row in the field type picker');
        row.click();
        const formula = ${JSON.stringify(cfg.formula ?? '')};
        if (formula) {
          const box = document.getElementById('tablify__af-formula');
          box.value = formula;
          box.dispatchEvent(new Event('input'));
        }
        // Obsidian focuses after attaching; the harness attaches after onOpen, so focus here.
        document.getElementById('tablify__af-name').focus();
      })()`);
      await plugin.page.mouse.move(0, 0);
      await plugin.page.evaluate('document.fonts.ready');
      await plugin.page.waitForTimeout(100);
      // Where the type control sits inside the card, so the diff can skip it (see the header note).
      const pluginRow = await plugin.page.evaluate(`(() => {
        const card = document.querySelector('.tablify__af-modal').getBoundingClientRect();
        const row = document.querySelector('.tablify__tp-trigger').getBoundingClientRect();
        return { top: row.top - card.top, bottom: row.bottom - card.top };
      })()`) as { top: number; bottom: number };
      const a = await plugin.page.locator('.tablify__af-modal').screenshot({ path: path.join(out, `${combo}.${state}.plugin.png`) });
      await plugin.close();

      const proto = await openPrototype(server.origin, theme, viewport, fixture);
      await proto.page.evaluate(`(() => {
        showAddFieldModal();
        // Prototype-only annotations ("(19 types — spec …)", "(Feature 10)", "(D-O1: …)") are
        // removed in the plugin by design; strip them so the diff measures the real layout.
        document.querySelectorAll('#addFieldModal label > span.font-mono').forEach((e) => e.remove());
        document.getElementById('newFieldType').value = ${JSON.stringify(cfg.type)};
        onFieldTypeChange();
        const formula = ${JSON.stringify(cfg.formula ?? '')};
        if (formula) {
          document.getElementById('newFieldFormula').value = formula;
          formulaPreview();
        }
        document.getElementById('newFieldName').focus();
      })()`);
      await proto.page.mouse.move(0, 0);
      await proto.page.evaluate('document.fonts.ready');
      await proto.page.waitForTimeout(100);
      const protoRow = await proto.page.evaluate(`(() => {
        const card = document.querySelector('#addFieldModal > div').getBoundingClientRect();
        const row = document.getElementById('newFieldType').getBoundingClientRect();
        return { top: row.top - card.top, bottom: row.bottom - card.top };
      })()`) as { top: number; bottom: number };
      const b = await proto.page.locator('#addFieldModal > div').screenshot({ path: path.join(out, `${combo}.${state}.prototype.png`) });
      await proto.close();

      const pa = PNG.sync.read(a);
      const pb = PNG.sync.read(b);
      const w = Math.max(pa.width, pb.width);
      const h = Math.max(pa.height, pb.height);
      const diff = new PNG({ width: w, height: h });
      const dataA = pad(pa, w, h);
      const dataB = pad(pb, w, h);
      // Blank the Field type row in BOTH images: the control is deliberately different now.
      const bandTop = Math.max(0, Math.floor(Math.min(pluginRow.top, protoRow.top)) - 2);
      const bandBottom = Math.ceil(Math.max(pluginRow.bottom, protoRow.bottom)) + 2;
      const { maskRect } = await import('./lib/mask.js');
      maskRect(dataA, w, bandTop, bandBottom);
      maskRect(dataB, w, bandTop, bandBottom);
      fs.writeFileSync(path.join(out, `${combo}.${state}.plugin.png`), PNG.sync.write(dataA));
      fs.writeFileSync(path.join(out, `${combo}.${state}.prototype.png`), PNG.sync.write(dataB));
      const pixels = w * (h - (bandBottom - bandTop));
      const n = pixelmatch(dataA.data, dataB.data, diff.data, w, h, { threshold: 0.1 });
      fs.writeFileSync(path.join(out, `${combo}.${state}.diff.png`), PNG.sync.write(diff));
      lines.push(`| ${combo} | ${state} | ${pa.width}×${pa.height} | ${pb.width}×${pb.height} | ${((100 * n) / Math.max(1, pixels)).toFixed(2)} % |`);
    }

    if (evidence) {
      const dir = path.resolve(evidence);
      fs.mkdirSync(dir, { recursive: true });
      for (const theme of themes) for (const viewport of viewports) {
        // 1. the panel as it opens: search, five groups, the current row ticked.
        await capturePicker(server, theme, viewport, fixture, dir, 'type-open', `(() => {
          window.__tablifyOpenModal('addField');
          document.getElementById('tablify__af-type').click();
        })()`);
        // 2. typing: two letters narrow 18 rows to the two money-ish kinds.
        await capturePicker(server, theme, viewport, fixture, dir, 'type-search', `(() => {
          window.__tablifyOpenModal('addField');
          const trigger = document.getElementById('tablify__af-type');
          trigger.click();
          const input = document.querySelector('[data-testid="tablify-field-type-panel"] input');
          input.value = 'mo';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        })()`);
        // 3. Modify Field: every type but the field's own keeps its row, greyed, with the reason.
        await capturePicker(server, theme, viewport, fixture, dir, 'type-blocked', `(() => {
          window.__tablifyOpenModal('editField');
          document.getElementById('tablify__af-type').click();
        })()`);
      }
    }
  } finally {
    await server.close();
  }
  fs.writeFileSync(
    path.join(out, 'report.md'),
    `# Add Field parity (SAD-86)\n\nFormula state expression: \`${FORMULA}\`\n\n` +
      'The **Field type row is masked** in both images (COD-76 replaced the native `<select>` with the\n' +
      'plugin\'s own picker, so that row differs by design). Every other part of the card is compared.\n\n' +
      `${lines.join('\n')}\n`,
  );
  console.log(lines.join('\n'));
}

void main();
