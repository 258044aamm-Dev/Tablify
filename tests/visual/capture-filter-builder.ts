// SAD-78: filter builder parity capture. Opens the plugin's FilterBuilderModal (real class, in
// Obsidian's modal markup under the hostile host CSS) and the prototype's #filterModal with the
// same query on the same table, then pixel-compares the two cards.
//
//   npx tsx tests/visual/capture-filter-builder.ts [--theme dark|light|all] [--viewport owner|mobile|all] [--out dir]
import fs from 'node:fs';
import path from 'node:path';
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

const QUERY = 'Status:Todo "Due date":>2026-01-01 Name:~ship';

function pad(img: PNG, w: number, h: number): PNG {
  const out = new PNG({ width: w, height: h });
  out.data.fill(0);
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out;
}

async function main(): Promise<void> {
  const themes = expand<Theme>(arg('theme', 'all'), ['dark', 'light']);
  const viewports = expand<HarnessViewport>(arg('viewport', 'all'), ['owner', 'mobile'] as HarnessViewport[]);
  const out = path.resolve(arg('out', '.out/filter-builder'));
  fs.mkdirSync(out, { recursive: true });
  // The S-8 new table (Name / Notes / Status / Due date / Attachments); IDs need not be stable here.
  const fixture = newTableText('Untitled table');
  await buildHarness();
  const server = await startStaticServer(REPO);
  const lines = ['| Combo | Plugin | Prototype | Pixel diff |', '|---|---|---|---|'];
  try {
    for (const theme of themes) for (const viewport of viewports) {
      const combo = `${theme}-${viewport}`;
      const plugin = await openPlugin(server.origin, theme, viewport, fixture);
      await plugin.page.evaluate(`window.__tablifyOpenFilterBuilder(${JSON.stringify(QUERY)})`);
      // Faces load on first use (Lora 600 first appears in the modal), so wait again after opening.
      await plugin.page.evaluate('document.fonts.ready');
      await plugin.page.waitForTimeout(100);
      const a = await plugin.page.locator('.tablify__fb-modal').screenshot({ path: path.join(out, `${combo}.plugin.png`) });
      await plugin.page.screenshot({ path: path.join(out, `${combo}.plugin-full.png`) });
      await plugin.close();

      const proto = await openPrototype(server.origin, theme, viewport, fixture);
      await proto.page.evaluate(`(() => {
        document.getElementById('searchInput').value = ${JSON.stringify(QUERY)};
        openFilterBuilder();
      })()`);
      await proto.page.evaluate('document.fonts.ready');
      await proto.page.waitForTimeout(100);
      const b = await proto.page.locator('#filterModal > div').screenshot({ path: path.join(out, `${combo}.prototype.png`) });
      await proto.page.screenshot({ path: path.join(out, `${combo}.prototype-full.png`) });
      await proto.close();

      const pa = PNG.sync.read(a);
      const pb = PNG.sync.read(b);
      const w = Math.max(pa.width, pb.width);
      const h = Math.max(pa.height, pb.height);
      const diff = new PNG({ width: w, height: h });
      const n = pixelmatch(pad(pa, w, h).data, pad(pb, w, h).data, diff.data, w, h, { threshold: 0.1 });
      fs.writeFileSync(path.join(out, `${combo}.diff.png`), PNG.sync.write(diff));
      lines.push(`| ${combo} | ${pa.width}×${pa.height} | ${pb.width}×${pb.height} | ${((100 * n) / (w * h)).toFixed(2)} % |`);
    }
  } finally {
    await server.close();
  }
  fs.writeFileSync(path.join(out, 'report.md'), `# Filter builder parity (SAD-78)\n\nQuery: \`${QUERY}\`\n\n${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
}

void main();
