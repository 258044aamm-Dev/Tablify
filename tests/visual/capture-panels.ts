// Step 11: panel parity — the three `#floatPanel` screens the plugin now builds.
//
//   npx tsx tests/visual/capture-panels.ts [--theme dark|light|all] [--viewport owner|mobile]
//                                          [--out dir]
//
// For each screen the script opens it in both pages — select, attachment, option manager — and
// reports three things:
//
//   1. the card box (x, y, w, h) in both pages, plus where it sits relative to the cell it was
//      opened from (`top - cellBottom`, `left - cellLeft`): the prototype's `openPanel()` puts the
//      card 6 px under the cell and clamps it into the viewport, so placement is part of parity.
//   2. the pixel difference of the card crop (8 px shadow margin right/bottom) between the pages.
//   3. the computed styles of the card and its key parts, normalised (transparent shadow layers
//      are equal — see capture-compare.ts).
//
// Side-by-side montages (plugin above prototype) land in the output directory.

import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error -- pngjs ships no type declarations (dev-only script; same import as capture-compare).
import { PNG } from 'pngjs';
import type { Page } from 'playwright';
import { REPO, buildHarness, openPlugin, openPrototype, type HarnessViewport } from './lib/harness';
import { startStaticServer } from './lib/server';
import { newTableText } from '../../src/menus/fileMenuModel';

type Theme = 'dark' | 'light';

const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const expand = <T extends string>(value: string, all: readonly T[]): T[] =>
  value === 'all' ? [...all] : (value.split(',') as T[]);

/** Deterministic ids so two runs are comparable. */
function stableIds(text: string): string {
  let n = 0;
  const ids = new Map<string, string>();
  return text
    .replace(/"(tbl|fld|row|opt|view|viw)_[A-Za-z0-9_]+"/g, (m, p: string) => {
      if (!ids.has(m)) ids.set(m, `"${p}_px${(n++).toString(36)}"`);
      return ids.get(m) as string;
    })
    .replace(/"\d{4}-\d\d-\d\dT[\d:.]+Z"/g, '"2026-10-10T06:00:00.000Z"');
}

const PAD = 8;

interface Box {
  found: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  right: number;
  bottom: number;
  cellLeft: number | null;
  cellBottom: number | null;
  styles: Record<string, string>;
}

/** Measure one element plus, optionally, the cell it hangs from. */
async function box(page: Page, selector: string, anchor: string | null, props: string[]): Promise<Box> {
  const script = `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const cell = ${anchor ? `document.querySelector(${JSON.stringify(anchor)})` : 'null'};
    const empty = { found: false, x: 0, y: 0, w: 0, h: 0, right: 0, bottom: 0, cellLeft: null, cellBottom: null, styles: {} };
    if (!el) return empty;
    const r = el.getBoundingClientRect();
    const cr = cell ? cell.getBoundingClientRect() : null;
    const cs = getComputedStyle(el);
    const styles = {};
    for (const p of ${JSON.stringify(props)}) styles[p] = cs.getPropertyValue(p).trim();
    if (styles['font-family']) styles['font-family'] = styles['font-family'].split(',')[0].replace(/["']/g, '').trim();
    return {
      found: true,
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      right: Math.round(r.right), bottom: Math.round(r.bottom),
      cellLeft: cr ? Math.round(cr.x) : null, cellBottom: cr ? Math.round(cr.bottom) : null, styles,
    };
  })()`;
  return page.evaluate(script) as Promise<Box>;
}

function normShadow(value: string): string {
  return value
    .split(/,\s*(?![^()]*\))/)
    .map((layer) => layer.trim())
    .filter((layer) => !/^rgba\(0, 0, 0, 0\) 0px 0px 0px 0px$/.test(layer))
    .join(', ');
}

function norm(value: string, prop?: string): string {
  const base = prop === 'box-shadow' ? normShadow(value) : value;
  return base.replace(/\s+/g, ' ').replace(/rgba?\(([^)]+)\)/g, (_m, inner: string) => {
    const parts = inner.split(',').map((p) => Number.parseFloat(p));
    if (parts.length === 4 && parts[3] === 0) return 'transparent';
    return `rgb(${parts.slice(0, 3).map((n) => Math.round(n)).join(', ')})`;
  }).trim();
}

async function shot(page: Page, b: Box): Promise<PNG | null> {
  if (!b.found) return null;
  const vp = page.viewportSize() ?? { width: 0, height: 0 };
  // No padding on the top/left: the card hangs 6 px under its cell, and the cell's own focus
  // ring must not bleed into the crop (it is a documented WCAG addition, not a panel diff).
  const x0 = Math.max(0, b.x);
  const y0 = Math.max(0, b.y);
  const x1 = Math.min(vp.width, b.right + PAD);
  const y1 = Math.min(vp.height, b.bottom + PAD);
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  const buf = await page.screenshot({ clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  return PNG.sync.read(buf);
}

function mismatch(a: PNG, b: PNG): number | null {
  if (a.width !== b.width || a.height !== b.height) return null;
  let diff = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (Math.abs(a.data[i] - b.data[i]) > 8 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 8 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 8) {
      diff += 1;
    }
  }
  return (diff / (a.width * a.height)) * 100;
}

/** Stack two crops (plugin on top) with a 3 px separator, for eyeballing in the output folder. */
function stack(top: PNG, bottom: PNG, file: string): void {
  const w = Math.max(top.width, bottom.width);
  const out = new PNG({ width: w, height: top.height + bottom.height + 3 });
  out.data.fill(0);
  PNG.bitblt(top, out, 0, 0, top.width, top.height, 0, 0);
  PNG.bitblt(bottom, out, 0, 0, bottom.width, bottom.height, 0, top.height + 3);
  for (let x = 0; x < w; x += 1) {
    const i = ((top.height + 1) * w + x) << 2;
    out.data[i] = 200; out.data[i + 1] = 60; out.data[i + 2] = 60; out.data[i + 3] = 255;
  }
  fs.writeFileSync(file, PNG.sync.write(out));
}

/** The screens, with each side's own selectors. */
interface Screen {
  id: string;
  /** Card in the plugin page and in the prototype page. */
  plugin: string;
  prototype: string;
  /** The cell it hangs from, per side (used for the placement offsets). */
  pluginAnchor: string;
  prototypeAnchor: string;
  /** Parts compared by computed style: [label, plugin selector, prototype selector, props]. */
  parts: Array<[string, string, string, string[]]>;
  /** Prototype-only text that the plugin is not allowed to copy (registered, not "fixed"). */
  note?: string;
  /** Both sides type one attachment path before the crop is taken (the `attachment-row` screen). */
  seedAttachment?: boolean;
}

const CARD_PROPS = ['background-color', 'border', 'border-radius', 'box-shadow', 'padding', 'font-family', 'font-size', 'line-height', 'color', 'min-width', 'max-width', 'width'];

const SCREENS: Screen[] = [
  {
    id: 'select-panel',
    plugin: '[data-testid="tablify-select-panel"]',
    prototype: '#floatPanel',
    pluginAnchor: '.tablify__row .tablify__cell[data-field-id="{status}"] .tablify__capsule',
    prototypeAnchor: 'td[data-fld="{status}"] > div',
    parts: [
      ['card', '[data-testid="tablify-select-panel"]', '#floatPanel', CARD_PROPS],
      ['search', '.tablify__panel input.tablify__dropdown-input', '#floatPanel input[type=text]', ['width', 'height', 'padding', 'border-radius', 'border', 'background-color', 'font-size', 'line-height', 'margin-bottom']],
      ['row', '.tablify__panel .tablify__dropdown-item', '#floatPanel button[onclick^="selectPanelPick"]', ['width', 'height', 'padding', 'border-radius', 'font-size', 'line-height']],
      ['chip', '.tablify__panel .tablify__chip', '#floatPanel button[onclick^="selectPanelPick"] > span', ['height', 'padding', 'border-radius', 'font-size', 'font-weight', 'background-color', 'border-color', 'color']],
      ['chip-dot', '.tablify__panel .tablify__chip-dot', '#floatPanel button[onclick^="selectPanelPick"] > span > span', ['width', 'height', 'margin-right', 'border-radius', 'background-color']],
      ['foot', '.tablify__panel .tablify__dropdown-foot', '#floatPanel > div > div.border-t', ['height', 'padding-top', 'margin-top', 'border-top-width', 'justify-content']],
      ['clear', '.tablify__panel .tablify__dropdown-clear', '#floatPanel button[onclick="panelClear()"]', ['height', 'padding', 'font-size', 'color']],
      ['manage', '.tablify__panel .tablify__dropdown-manage', '#floatPanel button[onclick="openOptMgrFromPanel()"]', ['height', 'padding', 'font-size', 'color']],
    ],
    note:
      'the remaining crop difference is glyph/text rasterisation (chips, the check, the placeholder in Lora at 11–12 px) — the card, every part and the placement are identical (docs/evidence/SAD-90.md, the accepted AA class).',
  },
  {
    id: 'attachment-panel',
    plugin: '[data-testid="tablify-attachment-panel"]',
    prototype: '#floatPanel',
    pluginAnchor: '.tablify__row .tablify__cell[data-field-id="{files}"] .tablify__capsule',
    prototypeAnchor: 'td[data-fld="{files}"] > div',
    parts: [
      ['card', '[data-testid="tablify-attachment-panel"]', '#floatPanel', CARD_PROPS],
      ['body', '.tablify__panel .tablify__attach', '#floatPanel > div', ['padding', 'font-size', 'line-height']],
      ['head', '.tablify__panel .tablify__attach-head', '#floatPanel > div > div:first-child', ['height', 'margin-bottom', 'font-size', 'font-weight', 'line-height']],
      ['empty', '.tablify__panel .tablify__attach-empty', '#floatPanel > div > div.mb-2', ['height', 'margin-bottom', 'font-size', 'line-height', 'color']],
      ['input', '.tablify__panel input.tablify__attach-input', '#floatPanel > div > input', ['width', 'height', 'padding', 'border-radius', 'border', 'background-color', 'font-size', 'line-height', 'font-family']],
      ['hint', '.tablify__panel .tablify__attach-hint', '#floatPanel > div > div:last-child', ['height', 'margin-top', 'font-size', 'line-height', 'color']],
    ],
    note:
      'the plugin hint reads "Vault-relative path — the file is checked when you press Enter. An unknown path still saves once you confirm."; the prototype line is demo narration ("... (spec §2.3). File picking is Obsidian-side — simulated here.") — the hint band is the bulk of the crop difference. ' +
      'The `empty` part\'s `margin-bottom` differs structurally (the plugin puts the 8px after the list, the prototype on the empty row itself) and the card box is identical in every combo. ' +
      'The remainder is glyph rasterisation: Chromium paints the inlined Font Awesome paths and Lora about a pixel differently from the prototype\'s webfont at 10–12 px (the accepted AA class, see docs/evidence/SAD-90.md). ' +
      'SAD-356: an empty Attachment cell now opens a two-entry menu first (docs/plans/sad-356-attachment-field-plan.md); the capture takes "Enter a URL or file path…", which is the screen compared here. The panel then carries a plugin-only "Choose a file…" button and a status line below the hint — no prototype equivalent, the same call the plugin-only "Save anyway" row makes — so the card is taller by that row.',
  },
  {
    // Same card, one attachment in it: both sides type the same path, so the row layout compares
    // like for like. (The plugin warns about a path that is not in the vault and offers
    // "Save anyway" — the seeded interaction clicks it, which is the production path.)
    // SAD-356: a filled cell goes straight to the panel, which now also carries the plugin-only
    // "Choose a file…" button and status line — one row taller than the prototype, as above.
    id: 'attachment-row',
    plugin: '[data-testid="tablify-attachment-panel"]',
    prototype: '#floatPanel',
    pluginAnchor: '.tablify__row .tablify__cell[data-field-id="{files}"] .tablify__capsule',
    prototypeAnchor: 'td[data-fld="{files}"] > div',
    seedAttachment: true,
    parts: [
      ['card', '[data-testid="tablify-attachment-panel"]', '#floatPanel', CARD_PROPS],
      ['row', '.tablify__panel .tablify__attach-row', '#floatPanel > div > div.space-y-1 > div', ['height', 'padding', 'border-width', 'border-radius', 'background-color', 'gap', 'justify-content']],
      ['path', '.tablify__panel .tablify__attach-path', '#floatPanel > div > div.space-y-1 > div > span', ['font-family', 'font-size', 'line-height', 'color']],
      ['remove', '.tablify__panel .tablify__attach-remove', '#floatPanel > div > div.space-y-1 > div > button', ['width', 'height', 'color']],
      ['input', '.tablify__panel input.tablify__attach-input', '#floatPanel > div > input', ['width', 'height', 'font-size']],
    ],
  },
  {
    id: 'option-manager',
    plugin: '.tablify__optmgr-backdrop .tablify__pmodal',
    prototype: '#optMgrModal > div',
    pluginAnchor: '.tablify__row .tablify__cell[data-field-id="{status}"] .tablify__capsule',
    prototypeAnchor: 'td[data-fld="{status}"] > div',
    parts: [
      ['card', '.tablify__optmgr-backdrop .tablify__pmodal', '#optMgrModal > div', CARD_PROPS],
      ['header', '.tablify__optmgr-backdrop .tablify__optmgr-head', '#optMgrModal > div > div:first-child', ['height', 'margin-bottom']],
      ['title', '.tablify__optmgr-backdrop .modal-title', '#optMgrModal h3', ['height', 'font-size', 'font-weight', 'font-family', 'line-height', 'gap', 'color']],
      ['close', '.tablify__optmgr-close', '#optMgrModal button[onclick="closeOptMgr()"]', ['width', 'height', 'font-size', 'color']],
      ['rows', '.tablify__optmgr-rows', '#optMgrBody', ['gap', 'font-size']],
      ['row', '.tablify__optmgr-row', '#optMgrBody > div', ['height', 'gap']],
      ['move', '.tablify__optmgr-move', '#optMgrBody button[onclick^="optMgrMove"]', ['width', 'height', 'border-radius', 'border-width', 'background-color', 'font-size']],
      ['swatch', '.tablify__optmgr-swatch', '#optMgrBody button[onclick^="optMgrColor"]', ['width', 'height', 'border-radius', 'border-width']],
      ['name', '.tablify__optmgr-name', '#optMgrBody input[onchange^="optMgrRename"]', ['height', 'padding', 'border-radius', 'border-width', 'font-size']],
      ['delete', '.tablify__optmgr-delete', '#optMgrBody button[onclick^="optMgrDelete"]', ['width', 'height', 'font-size', 'color']],
      ['add-input', '.tablify__optmgr-input', '#optMgrNew', ['height', 'padding', 'border-radius', 'border-width', 'font-size']],
      ['add-btn', '.tablify__optmgr-addbtn', '#optMgrModal button[onclick="optMgrAdd()"]', ['height', 'padding', 'border-radius', 'background-color', 'font-size', 'font-weight']],
      ['hint', '.tablify__optmgr-hint', '#optMgrModal p', ['margin-top', 'font-size', 'line-height', 'color']],
    ],
    note:
      'the remaining crop difference is glyph/text rasterisation (arrows, swatch edge, trash glyph, the Add button label) — the card, every part and the placement are identical (docs/evidence/SAD-90.md, the accepted AA class).',
  },
];

const which = (sel: string, ids: Record<string, string>): string =>
  sel.replace(/\{(status|files)\}/g, (_m, key: string) => ids[key] ?? '');

async function openSelectPrototype(page: Page, ids: Record<string, string>): Promise<void> {
  await page.click(which('td[data-fld="{status}"] > div', ids));
  await page.waitForTimeout(120);
}
/**
 * Reach a cell with the keyboard. The phone layout scrolls the grid sideways, so a click on a
 * column past the frozen first one is intercepted by the frozen cells. The plugin's focus stays
 * on the grid root (the active cell is internal), so the route is: focus the grid, press
 * ArrowRight once per column, then Enter — the same gesture the grid's own tests use.
 */
async function focusCellPlugin(page: Page, columnIndex: number): Promise<void> {
  await page.evaluate(`(() => {
    const root = document.querySelector('.tablify--grid');
    if (root) root.focus();
  })()`);
  // The active cell survives between screens, so clamp back to the first column before counting.
  for (let i = 0; i < columnIndex + 2; i += 1) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(30);
  }
  for (let i = 0; i < columnIndex; i += 1) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(50);
  }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
}

async function openSelectPlugin(page: Page, ids: Record<string, string>, keyboard: boolean, columnIndex: number): Promise<void> {
  if (keyboard) {
    await focusCellPlugin(page, columnIndex);
    return;
  }
  await page.click(which('.tablify__row .tablify__cell[data-field-id="{status}"]', ids));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
}
async function openAttachmentPrototype(page: Page, ids: Record<string, string>): Promise<void> {
  await page.click(which('td[data-fld="{files}"] > div', ids));
  await page.waitForTimeout(120);
}
async function openAttachmentPlugin(page: Page, ids: Record<string, string>, keyboard: boolean, columnIndex: number): Promise<void> {
  if (keyboard) {
    await focusCellPlugin(page, columnIndex);
  } else {
    await page.click(which('.tablify__row .tablify__cell[data-field-id="{files}"]', ids));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
  }
  // SAD-356: the cell is empty, so what opens is the menu ("Choose a file…" / "Enter a URL or file
  // path…"). The crops compare the attachment panel itself, so take the path entry — the same screen
  // the prototype shows.
  const entry = page.locator('[data-testid="tablify-attachment-menu"] [role="menuitem"]').nth(1);
  if (await entry.count()) {
    await entry.click();
    await page.waitForTimeout(120);
  }
}

/** The path both sides type into the attachment panel for the `attachment-row` screen. */
const ATTACHMENT_PATH = 'Assets/example.png';

/**
 * Type one attachment path into an open panel. The plugin checks the path against the vault and
 * offers "Save anyway" for an unknown one (P3-04) — clicking it is the production path, so the
 * seeded state stays a state the product can actually reach.
 */
async function seedAttachment(page: Page, side: 'plugin' | 'prototype', value: string): Promise<void> {
  const input = side === 'plugin' ? '.tablify__panel input.tablify__attach-input' : '#floatPanel input[type=text]';
  await page.fill(input, value);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  if (side === 'plugin') {
    const warn = await page.$('.tablify__attach-warn-btn');
    if (warn) {
      await warn.click();
      await page.waitForTimeout(150);
    }
  }
}

async function run(theme: Theme, viewport: HarnessViewport, outDir: string): Promise<string[]> {
  const lines: string[] = [];
  /** Phones scroll the grid sideways: reach the cell with the keyboard instead of a click. */
  const keyboard = viewport === 'mobile';
  await buildHarness();
  const server = await startStaticServer(REPO);
  const fixture = stableIds(newTableText('Untitled table'));
  const parsed = JSON.parse(fixture) as { fields: Array<{ id: string; name: string }> };
  const byName = (name: string): string => parsed.fields.find((f) => f.name === name)?.id ?? '';
  const ids = { status: byName('Status'), files: byName('Attachments') };
  const columnIndex = (id: string): number => parsed.fields.findIndex((f) => f.id === id);

  const plugin = await openPlugin(server.origin, theme, viewport, fixture);
  const proto = await openPrototype(server.origin, theme, viewport, fixture);
  for (const page of [plugin, proto]) {
    await page.page.evaluate('window.scrollTo(0, 0)');
    await page.page.waitForTimeout(80);
  }

  try {
    for (const screen of SCREENS) {
      // Dismiss whatever the previous screen left open (a stale panel would be picked up first).
      for (const page of [plugin.page, proto.page]) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(80);
      }
      // Open the screen on each side.
      if (screen.id === 'select-panel') {
        await openSelectPrototype(proto.page, ids);
        await openSelectPlugin(plugin.page, ids, keyboard, columnIndex(ids.status));
      } else if (screen.id === 'attachment-panel' || screen.id === 'attachment-row') {
        await openAttachmentPrototype(proto.page, ids);
        await openAttachmentPlugin(plugin.page, ids, keyboard, columnIndex(ids.files));
        if (screen.seedAttachment) {
          await seedAttachment(proto.page, 'prototype', ATTACHMENT_PATH);
          await seedAttachment(plugin.page, 'plugin', ATTACHMENT_PATH);
        }
      } else {
        // The option manager opens from the select panel's footer on both sides.
        await openSelectPrototype(proto.page, ids);
        await proto.page.click('#floatPanel button[onclick="openOptMgrFromPanel()"]');
        await openSelectPlugin(plugin.page, ids, keyboard, columnIndex(ids.status));
        await plugin.page.click('.tablify__dropdown-manage');
        await plugin.page.waitForTimeout(120);
      }

      for (const [side, page, selector] of [
        ['plugin', plugin.page, screen.plugin],
        ['prototype', proto.page, screen.prototype],
      ] as const) {
        if (!(await page.$(selector))) {
          throw new Error(`${theme}/${viewport} ${screen.id}: the ${side} panel did not open (${selector})`);
        }
      }

      const pBox = await box(plugin.page, screen.plugin, which(screen.pluginAnchor, ids), CARD_PROPS);
      const rBox = await box(proto.page, screen.prototype, which(screen.prototypeAnchor, ids), CARD_PROPS);
      const pImg = await shot(plugin.page, pBox);
      const rImg = await shot(proto.page, rBox);
      if (pImg && rImg) {
        fs.writeFileSync(path.join(outDir, `${theme}-${viewport}-${screen.id}.plugin.png`), PNG.sync.write(pImg));
        fs.writeFileSync(path.join(outDir, `${theme}-${viewport}-${screen.id}.prototype.png`), PNG.sync.write(rImg));
        if (pImg.width === rImg.width && pImg.height === rImg.height) {
          stack(pImg, rImg, path.join(outDir, `${theme}-${viewport}-${screen.id}-stack.png`));
        }
      }

      lines.push(`### ${screen.id}`);
      lines.push('');
      lines.push('| | plugin | prototype | Δ |');
      lines.push('|---|---|---|---|');
      lines.push(`| card | ${pBox.w}×${pBox.h} @ ${pBox.x},${pBox.y} | ${rBox.w}×${rBox.h} @ ${rBox.x},${rBox.y} | ${pBox.w - rBox.w}×${pBox.h - rBox.h} @ ${pBox.x - rBox.x},${pBox.y - rBox.y} |`);
      const gap = (b: Box): string => (b.cellBottom === null || b.cellLeft === null ? '—' : `${b.y - b.cellBottom} / ${b.x - b.cellLeft}`);
      lines.push(`| offset under cell (top / left) | ${gap(pBox)} | ${gap(rBox)} | |`);
      const pixel = pImg && rImg ? mismatch(pImg, rImg) : null;
      lines.push(`| crop pixels | ${pImg ? `${pImg.width}×${pImg.height}` : '—'} | ${rImg ? `${rImg.width}×${rImg.height}` : '—'} | ${pixel === null ? 'size mismatch' : `${pixel.toFixed(2)} % differ`} |`);
      lines.push('');

      const styleRows: string[] = [];
      for (const [label, pSel, rSel, props] of screen.parts) {
        const pPart = await box(plugin.page, pSel, null, props);
        const rPart = await box(proto.page, rSel, null, props);
        for (const prop of props) {
          const pv = norm(pPart.styles[prop] ?? '', prop);
          const rv = norm(rPart.styles[prop] ?? '', prop);
          if (!pPart.found || !rPart.found) continue;
          if (pv !== rv) styleRows.push(`| ${label} | \`${prop}\` | \`${pv}\` | \`${rv}\` |`);
        }
      }
      lines.push(styleRows.length ? '| part | property | plugin | prototype |' : 'Computed styles: no differences.');
      if (styleRows.length) {
        lines.push('|---|---|---|---|');
        lines.push(...styleRows);
      }
      if (screen.note) lines.push('', `**ACCEPTED:** ${screen.note}`);
      lines.push('');

      // Reset both sides for the next screen.
      for (const page of [plugin.page, proto.page]) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(60);
      }
      await proto.page.evaluate('closeOptMgr && closeOptMgr()');
      await plugin.page.evaluate("document.querySelector('.tablify__optmgr-close')?.click()");
      await plugin.page.evaluate("document.querySelectorAll('.tablify__panel').forEach((el) => el.remove())");
      await plugin.page.waitForTimeout(80);
    }
  } finally {
    await plugin.close();
    await proto.close();
    await server.close();
  }
  return lines;
}

async function main(): Promise<void> {
  const themes = expand<Theme>(arg('theme', 'all'), ['light', 'dark']);
  const viewports = expand<HarnessViewport>(arg('viewport', 'owner'), ['owner', 'mobile']);
  const outDir = path.resolve(REPO, arg('out', '.out/panels'));
  fs.mkdirSync(outDir, { recursive: true });

  const report: string[] = [
    '# Step 11 — panel parity (select, attachment, option manager)',
    '',
    '`npx tsx tests/visual/capture-panels.ts ' + process.argv.slice(2).join(' ') + '`',
    '',
    'The card box, its offset from the cell it hangs from, the crop pixel difference and the',
    'computed styles of the card and its parts. Crops and stacked montages (plugin above',
    'prototype) sit next to this report.',
    '',
  ];
  for (const theme of themes) {
    for (const viewport of viewports) {
      report.push(`## ${theme} · ${viewport}`, '');
      report.push(...(await run(theme, viewport, outDir)));
    }
  }
  fs.writeFileSync(path.join(outDir, 'report.md'), report.join('\n'));
  process.stdout.write(`wrote ${path.join(outDir, 'report.md')}\n`);
}

void main();
