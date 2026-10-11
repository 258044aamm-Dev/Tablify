// Plugin vs prototype visual comparison (SAD-75 / Step 0).
//
// Usage:
//   npx tsx tests/visual/capture-compare.ts [--theme dark|light|all] [--viewport owner|desktop|mobile|all]
//       [--fixture new|empty|populated|grouped|all] [--state default|options|selected|grouped|all] [--out dir]
//
// For every combination it renders the plugin (real TableView under hostile host CSS) and the
// prototype (same data, prototype-only chrome hidden), then per region (lib/regions.ts):
//   - computed-style diff of the listed properties + width/height,
//   - pixelmatch of the element crops (padded to a common size; a size mismatch counts as diff),
// and writes full-page screenshots, crops and report.json / report.md to the output directory.
import fs from 'node:fs';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import type { Page } from 'playwright';
import { startStaticServer } from './lib/server';
import { REPO, HARNESS_VIEWPORTS, buildHarness, openPlugin, openPrototype, type HarnessViewport } from './lib/harness';
import { REGIONS, OPTIONS_REGION, SELECTION_REGION, GROUP_REGIONS, type Region } from './lib/regions';
import type { Theme } from './lib/capture';
import { newTableText } from '../../src/menus/fileMenuModel';

type FixtureName = 'new' | 'empty' | 'populated' | 'grouped';
type StateName = 'default' | 'options' | 'selected' | 'grouped';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function expand<T extends string>(value: string, all: readonly T[]): T[] {
  return value === 'all' ? [...all] : (value.split(',') as T[]);
}

/** Fixtures. `new` is whatever newTableText() produces today, so Step 9 changes it automatically. */
function fixtureText(name: FixtureName): string {
  if (name === 'new') return stableIds(newTableText('Untitled table'));
  if (name === 'grouped') return stableIds(groupedFixture());
  if (name === 'populated') return fs.readFileSync(path.join(REPO, 'samples/v2/customers.tablify'), 'utf8');
  return fs.readFileSync(path.join(REPO, 'samples/v1/empty.tablify'), 'utf8');
}

/**
 * SAD-81: the new-table template with eight named rows whose Status covers every option plus an
 * empty value, so Group by Status draws chip headers and the text-only "(empty)" header.
 */
function groupedFixture(): string {
  const file = JSON.parse(newTableText('Grouped')) as {
    fields: Array<{ id: string; type: string; primary?: boolean; options?: Array<{ id: string }> }>;
    rows: Array<{ id: string; values: Record<string, unknown> }>;
  };
  const name = file.fields.find((f) => f.primary) ?? file.fields[0];
  const status = file.fields.find((f) => f.type === 'single_select');
  const options = status?.options?.map((o) => o.id) ?? [];
  const plan = [0, 1, 0, 2, -1, 1, 0, 2];
  const base = file.rows[0];
  file.rows = plan.map((k, i) => ({
    ...base,
    id: `row_grp${i}`,
    values: { [name.id]: `Task ${i + 1}`, ...(status && k >= 0 ? { [status.id]: options[k] } : {}) },
  }));
  return JSON.stringify(file, null, 2);
}

/** Make generated IDs/timestamps deterministic so repeated runs are comparable. */
function stableIds(text: string): string {
  let n = 0;
  const ids = new Map<string, string>();
  return text
    .replace(/"(tbl|fld|row|opt|view|viw)_[A-Za-z0-9_]+"/g, (m, p: string) => {
      if (!ids.has(m)) ids.set(m, `"${p}_fx${(n++).toString(36)}"`);
      return ids.get(m) as string;
    })
    .replace(/"\d{4}-\d\d-\d\dT[\d:.]+Z"/g, '"2026-10-10T06:00:00.000Z"');
}

interface StyleSnap { found: boolean; x: number; y: number; w: number; h: number; styles: Record<string, string> }

async function snap(page: Page, selectors: string[], props: string[]): Promise<StyleSnap> {
  return page.evaluate(
    `(() => {
      const sels = ${JSON.stringify(selectors)};
      const props = ${JSON.stringify(props)};
      let el = null;
      for (const s of sels) { el = document.querySelector(s); if (el) break; }
      if (!el) return { found: false, x: 0, y: 0, w: 0, h: 0, styles: {} };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const styles = {};
      for (const p of props) styles[p] = cs.getPropertyValue(p).trim();
      if (styles['font-family']) styles['font-family'] = styles['font-family'].split(',')[0].replace(/["']/g, '').trim();
      return { found: true, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), styles };
    })()`,
  ) as Promise<StyleSnap>;
}

async function crop(page: Page, s: StyleSnap): Promise<PNG | null> {
  if (!s.found || s.w < 1 || s.h < 1) return null;
  // Clamp to the viewport: on mobile the toolbar overflows horizontally, so some regions are
  // partly or fully offscreen. Fully offscreen regions get no pixel comparison.
  const vp = page.viewportSize() ?? { width: 0, height: 0 };
  const x0 = Math.max(0, s.x);
  const y0 = Math.max(0, s.y);
  const x1 = Math.min(vp.width, s.x + s.w);
  const y1 = Math.min(vp.height, s.y + s.h);
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  const buf = await page.screenshot({ clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  return PNG.sync.read(buf);
}

function padTo(img: PNG, w: number, h: number): PNG {
  const out = new PNG({ width: w, height: h });
  out.data.fill(0);
  PNG.bitblt(img, out, 0, 0, Math.min(img.width, w), Math.min(img.height, h), 0, 0);
  return out;
}

interface RegionResult {
  id: string;
  plugin: StyleSnap;
  prototype: StyleSnap;
  styleDiffs: Array<{ prop: string; plugin: string; prototype: string }>;
  pixelMismatch: number | null;
}

/** Colors are compared after normalizing whitespace; 'rgba(0, 0, 0, 0)' and 'transparent' are equal. */
function norm(v: string): string {
  return v.replace(/\s+/g, ' ').replace(/rgba\(0, 0, 0, 0\)/g, 'transparent').trim();
}

async function compareRegion(pp: Page, rp: Page, region: Region, dir: string): Promise<RegionResult> {
  const props = region.styles;
  const a = await snap(pp, region.plugin, props);
  const b = await snap(rp, region.prototype, props);
  const styleDiffs: RegionResult['styleDiffs'] = [];
  if (a.found && b.found) {
    if (Math.abs(a.w - b.w) > 1) styleDiffs.push({ prop: 'width', plugin: `${a.w}px`, prototype: `${b.w}px` });
    if (Math.abs(a.h - b.h) > 1) styleDiffs.push({ prop: 'height', plugin: `${a.h}px`, prototype: `${b.h}px` });
    for (const p of props) {
      if (norm(a.styles[p] ?? '') !== norm(b.styles[p] ?? '')) {
        styleDiffs.push({ prop: p, plugin: a.styles[p] ?? '', prototype: b.styles[p] ?? '' });
      }
    }
  }
  let pixelMismatch: number | null = null;
  if (region.pixels && a.found && b.found) {
    const ia = await crop(pp, a);
    const ib = await crop(rp, b);
    if (ia && ib) {
      const w = Math.max(ia.width, ib.width);
      const h = Math.max(ia.height, ib.height);
      const pa = padTo(ia, w, h);
      const pb = padTo(ib, w, h);
      const diff = new PNG({ width: w, height: h });
      const bad = pixelmatch(pa.data, pb.data, diff.data, w, h, { threshold: 0.1 });
      pixelMismatch = bad / (w * h);
      fs.writeFileSync(path.join(dir, `${region.id}.plugin.png`), PNG.sync.write(pa));
      fs.writeFileSync(path.join(dir, `${region.id}.prototype.png`), PNG.sync.write(pb));
      fs.writeFileSync(path.join(dir, `${region.id}.diff.png`), PNG.sync.write(diff));
    }
  }
  return { id: region.id, plugin: a, prototype: b, styleDiffs, pixelMismatch };
}

async function openOptions(pp: Page, rp: Page): Promise<void> {
  await pp.click('button[data-action="options"]');
  await rp.click('#optionsBtn');
  await pp.waitForTimeout(150);
  await rp.waitForTimeout(150);
}

/**
 * SAD-81: drive both Options panels through the same steps with real input — Group by the first
 * select field, sort by the primary field, add a second sort and flip it, hide the second field.
 * Both panels stay open afterwards (each re-renders in place).
 */
async function groupAndSort(pp: Page, rp: Page): Promise<void> {
  await openOptions(pp, rp);
  const pick = async (page: Page, sel: string, label: string) => {
    await page.selectOption(sel, { label });
    await page.waitForTimeout(120);
  };
  const groupLabel = (await pp.locator('select[data-option="group-by"] option').allTextContents()).find((t) => t === 'Status');
  if (groupLabel) {
    await pick(pp, 'select[data-option="group-by"]', groupLabel);
    await pick(rp, '#floatPanel select >> nth=0', groupLabel);
  }
  const sortable = await pp.locator('select[data-option="add-sort"] option').allTextContents();
  const [first, , , second] = sortable.slice(1);
  if (first) {
    await pick(pp, 'select[data-option="add-sort"]', first);
    await pick(rp, '#floatPanel select >> nth=1', first);
  }
  if (second) {
    await pick(pp, 'select[data-option="add-sort"]', second);
    await pick(rp, '#floatPanel select >> nth=1', second);
    await pp.click('button[data-sort-dir="1"]');
    await rp.click('#floatPanel button:has-text("A→Z") >> nth=1');
  }
  const hideable = await pp.locator('button[data-hide-field]:not([disabled])').first().getAttribute('aria-label');
  const fieldName = hideable?.replace(/^Hide field /, '');
  if (fieldName) {
    await pp.click(`button[aria-label="Hide field ${fieldName}"]`);
    await rp.click(`#floatPanel div.flex.items-center.justify-between:has(> span:text-is("${fieldName}")) button`);
  }
  await pp.mouse.move(0, 0);
  await rp.mouse.move(0, 0);
  await pp.waitForTimeout(150);
  await rp.waitForTimeout(150);
}

/** Close both float panels (Escape on the plugin toolbar, the prototype's document handler). */
async function closeOptions(pp: Page, rp: Page): Promise<void> {
  // Escape without focusing a control (a focused button would draw its focus ring), then undo
  // the scrolling selectOption() did to reach the panel — on mobile it scrolls the page and
  // the toolbar sideways — so both grids are captured from their resting position.
  const reset = `(() => {
    const a = document.activeElement; if (a && a.blur) a.blur();
    window.scrollTo(0, 0);
    document.querySelectorAll('*').forEach((e) => { if (e.scrollLeft) e.scrollLeft = 0; if (e.scrollTop) e.scrollTop = 0; });
  })()`;
  await pp.evaluate(`document.querySelector('.tablify__toolbar').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await rp.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await pp.evaluate(reset);
  await rp.evaluate(reset);
  await pp.mouse.move(0, 0);
  await rp.mouse.move(0, 0);
  await pp.waitForTimeout(150);
  await rp.waitForTimeout(150);
}

/**
 * SAD-80: tick rows 1 and 3 (or the last row) with real clicks on both pages, then park the
 * mouse so no hover state is captured. The prototype re-renders on every toggle, so each
 * click re-resolves its selector.
 */
async function selectRows(pp: Page, rp: Page): Promise<void> {
  const n = await pp.locator('.tablify__row-check').count();
  for (const i of n > 2 ? [0, 2] : n > 0 ? [0] : []) {
    await pp.click(`.tablify__row[data-row-index="${i}"] .tablify__row-check`);
    await rp.click(`#tableBody tr:nth-child(${i + 1}) td:first-child input`);
  }
  await pp.mouse.move(0, 0);
  await rp.mouse.move(0, 0);
  await pp.waitForTimeout(150);
  await rp.waitForTimeout(150);
}

async function main(): Promise<void> {
  const themes = expand<Theme>(arg('theme', 'dark'), ['dark', 'light']);
  const viewports = expand<HarnessViewport>(arg('viewport', 'owner'), Object.keys(HARNESS_VIEWPORTS) as HarnessViewport[]);
  const fixtures = expand<FixtureName>(arg('fixture', 'new'), ['new', 'empty', 'populated', 'grouped']);
  const states = expand<StateName>(arg('state', 'default'), ['default', 'options', 'selected', 'grouped']);
  const outRoot = path.resolve(arg('out', path.join(REPO, 'docs/evidence/visual-parity/latest')));
  fs.mkdirSync(outRoot, { recursive: true });

  await buildHarness();
  const server = await startStaticServer(REPO);
  const report: Array<{ combo: string; regions: RegionResult[] }> = [];
  try {
    for (const theme of themes) for (const viewport of viewports) for (const fixture of fixtures) for (const state of states) {
      const combo = `${theme}-${viewport}-${fixture}-${state}`;
      const dir = path.join(outRoot, combo);
      fs.mkdirSync(dir, { recursive: true });
      const text = fixtureText(fixture);
      // The prototype titles itself from the document name and shows `Tables/<name>.tablify`;
      // give the plugin the same file so the title row compares like for like (SAD-77).
      const docName = (JSON.parse(text) as { name?: string }).name ?? 'Untitled table';
      const plugin = await openPlugin(server.origin, theme, viewport, text, `Tables/${docName}.tablify`);
      const proto = await openPrototype(server.origin, theme, viewport, text);
      try {
        const regions = [...REGIONS];
        const results: RegionResult[] = [];
        if (state === 'grouped') {
          // The panel is compared while open (sort rows, struck field, Show pill); the grid after
          // it closes. Row-index regions address the prototype's first <tr>, a group header now.
          await groupAndSort(plugin.page, proto.page);
          await plugin.page.screenshot({ path: path.join(dir, 'plugin-panel.png') });
          await proto.page.screenshot({ path: path.join(dir, 'prototype-panel.png') });
          results.push(await compareRegion(plugin.page, proto.page, OPTIONS_REGION, dir));
          await closeOptions(plugin.page, proto.page);
          regions.splice(0, regions.length, ...REGIONS.filter((r) => r.id !== 'row-number' && r.id !== 'row-check'), ...GROUP_REGIONS);
        }
        if (state === 'options') {
          await openOptions(plugin.page, proto.page);
          regions.push(OPTIONS_REGION);
        }
        if (state === 'selected') {
          await selectRows(plugin.page, proto.page);
          regions.push(SELECTION_REGION);
        }
        await plugin.page.screenshot({ path: path.join(dir, 'plugin.png') });
        await proto.page.screenshot({ path: path.join(dir, 'prototype.png') });
        for (const r of regions) results.push(await compareRegion(plugin.page, proto.page, r, dir));
        report.push({ combo, regions: results });
      } finally {
        await plugin.close();
        await proto.close();
      }
    }
  } finally {
    await server.close();
  }

  fs.writeFileSync(path.join(outRoot, 'report.json'), JSON.stringify(report, null, 2));
  const md: string[] = ['# Visual parity report', '', `Generated by tests/visual/capture-compare.ts.`, ''];
  for (const { combo, regions } of report) {
    md.push(`## ${combo}`, '', '| Region | Plugin | Prototype | Pixel diff | Style differences |', '|---|---|---|---|---|');
    for (const r of regions) {
      const px = r.pixelMismatch === null ? '—' : `${(r.pixelMismatch * 100).toFixed(2)} %`;
      const dims = (s: StyleSnap) => (s.found ? `${s.w}×${s.h}` : 'missing');
      const diffs = r.styleDiffs.map((d) => `\`${d.prop}\`: ${d.plugin} → ${d.prototype}`).join('<br>') || (r.plugin.found && r.prototype.found ? 'none' : '—');
      md.push(`| ${r.id} | ${dims(r.plugin)} | ${dims(r.prototype)} | ${px} | ${diffs} |`);
    }
    md.push('');
  }
  fs.writeFileSync(path.join(outRoot, 'report.md'), md.join('\n'));
  console.log(`report: ${path.relative(REPO, path.join(outRoot, 'report.md'))}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
