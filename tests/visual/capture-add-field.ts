// SAD-86: Add Field parity capture. Opens the plugin's AddFieldModal (real class, Obsidian modal
// markup, hostile host CSS) and the prototype's #addFieldModal on the same table, puts both in the
// same state (field type, formula), and pixel-compares the two cards.
//
//   npx tsx tests/visual/capture-add-field.ts [--theme dark|light|all] [--viewport owner|mobile|all] [--out dir]
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
        const sel = document.getElementById('tablify__af-type');
        sel.value = ${JSON.stringify(cfg.type)};
        sel.dispatchEvent(new Event('change'));
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
      const b = await proto.page.locator('#addFieldModal > div').screenshot({ path: path.join(out, `${combo}.${state}.prototype.png`) });
      await proto.close();

      const pa = PNG.sync.read(a);
      const pb = PNG.sync.read(b);
      const w = Math.max(pa.width, pb.width);
      const h = Math.max(pa.height, pb.height);
      const diff = new PNG({ width: w, height: h });
      const n = pixelmatch(pad(pa, w, h).data, pad(pb, w, h).data, diff.data, w, h, { threshold: 0.1 });
      fs.writeFileSync(path.join(out, `${combo}.${state}.diff.png`), PNG.sync.write(diff));
      lines.push(`| ${combo} | ${state} | ${pa.width}×${pa.height} | ${pb.width}×${pb.height} | ${((100 * n) / (w * h)).toFixed(2)} % |`);
    }
  } finally {
    await server.close();
  }
  fs.writeFileSync(path.join(out, 'report.md'), `# Add Field parity (SAD-86)\n\nFormula state expression: \`${FORMULA}\`\n\n${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
}

void main();
