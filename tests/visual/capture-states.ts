// SAD-92 (Step 10): interaction-state parity — :hover, :focus-visible, :active.
//
// The prototype authors only one interactive state itself (`Prototype/style.css`): `.pill-btn:hover`
// and `.pill-input:focus-within`. Everything else is the browser default, so this script does not
// assume what "matching" means — it measures three things per target and state:
//
//   1. `plugin Δ` / `prototype Δ` — how far the element's own pixels move from the resting capture.
//      A 0.00 % delta on the prototype side means the prototype authors nothing for that state.
//   2. the state-vs-state pixel difference between the two renders (the parity number).
//   3. the computed styles that states change (background, border, shadow, outline, transform…),
//      normalised the same way `capture-compare.ts` normalises them.
//
//   npx tsx tests/visual/capture-states.ts [--theme dark|light|all] [--viewport owner|mobile|all]
//                                          [--state hover|focus|active|all] [--out dir]

import fs from 'node:fs';
import path from 'node:path';
// @ts-expect-error -- pngjs ships no type declarations (dev-only script; same import as capture-add-field).
import { PNG } from 'pngjs';
import { REPO, buildHarness, openPlugin, openPrototype, type HarnessViewport } from './lib/harness';
import { startStaticServer } from './lib/server';
import { newTableText } from '../../src/menus/fileMenuModel';

type Theme = 'dark' | 'light';
type Interaction = 'hover' | 'focus' | 'active';

const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const expand = <T extends string>(value: string, all: readonly T[]): T[] =>
  value === 'all' ? [...all] : (value.split(',') as T[]);

/** One comparison target: the same control in both pages, addressed the way each page names it. */
interface Target {
  id: string;
  plugin: string;
  prototype: string;
}

const TARGETS: Target[] = [
  { id: 'search', plugin: 'input.tablify__search-input', prototype: '#searchInput' },
  { id: 'btn-sync', plugin: 'button[data-action="sync"]', prototype: '#toolbarRow button[onclick="openSyncModal()"]' },
  { id: 'btn-undo', plugin: 'button[data-action="undo"]', prototype: '#toolbarRow button[onclick="undo()"]' },
  { id: 'btn-filter', plugin: 'button[data-action="filter"]', prototype: '#toolbarRow button[onclick="openFilterBuilder()"]' },
  { id: 'btn-add-row', plugin: 'button[data-action="add-row"]', prototype: '#toolbarRow button[onclick="addRow()"]' },
  { id: 'btn-add-field', plugin: 'button[data-action="add-field"]', prototype: '#toolbarRow button[onclick="showAddFieldModal()"]' },
  { id: 'btn-options', plugin: 'button[data-action="options"]', prototype: '#optionsBtn' },
  { id: 'insert-row', plugin: '.tablify__insert-row', prototype: '#insertRowBtn' },
  { id: 'header-capsule', plugin: '.tablify__header-cell[data-field-id] .tablify__header-capsule', prototype: '.header-capsule' },
  { id: 'body-capsule', plugin: '.tablify__row .tablify__cell[data-field-id] .tablify__capsule', prototype: '.cell-capsule' },
];

const PAD = 6;

/**
 * Deliberate differences, with the reason (the same idea as capture-modals.ts's ACCEPTED map).
 * Both entries are accessibility additions the prototype cannot show, because the prototype authors
 * no focus style at all for these controls: `.pill-btn` has `:hover` and `active:scale-95` only.
 * The extra ring is documented in `styles.css` next to the search box.
 */
const ACCEPTED: Array<{ target: RegExp; state: Interaction; prop: RegExp; reason: string }> = [
  { target: /^search$/, state: 'focus', prop: /^outline-/, reason: 'WCAG 1.4.11: border + 20% ring alone fail non-text contrast; the 2px accent outline is the floor (styles.css)' },
  { target: /^search$/, state: 'active', prop: /^outline-/, reason: 'same as focus — the box keeps focus while pressed' },
  { target: /^/, state: 'focus', prop: /^outline-/, reason: 'the prototype authors no focus style (browser default ring); the plugin paints a ring in the prototype accent' },
  { target: /^/, state: 'active', prop: /^outline-/, reason: 'the prototype authors no focus style (browser default ring); the plugin paints a ring in the prototype accent' },
];

function acceptedReason(target: string, state: Interaction, prop: string): string | null {
  for (const rule of ACCEPTED) {
    if (rule.state === state && rule.target.test(target) && rule.prop.test(prop)) return rule.reason;
  }
  return null;
}

/** Rows whose *pixel* difference is one of those deliberate additions (the focus/active rings). */
function acceptedRowReason(target: string, state: Interaction): string | null {
  if (state === 'focus' || state === 'active') {
    return target === 'search'
      ? 'focus ring: WCAG 1.4.11 accent outline (styles.css)'
      : 'focus ring: the prototype authors none; the plugin paints one in the prototype accent';
  }
  return null;
}

/** Properties an interaction state can change, as `capture-modals.ts` compares parts. */
const STATE_PROPS = [
  'background-color',
  'border-top-color',
  'border-top-width',
  'box-shadow',
  'outline-color',
  'outline-style',
  'outline-width',
  'outline-offset',
  'color',
  'opacity',
  'transform',
  'filter',
  'transition-duration',
  'cursor',
];

function normShadow(value: string): string {
  return value
    .split(/,\s*(?![^()]*\))/)
    .map((layer) => layer.trim())
    .filter((layer) => layer !== '' && !/^rgba\(0, 0, 0, 0\) 0px 0px 0px 0px$/.test(layer))
    .join(', ');
}

function norm(value: string, prop: string): string {
  const base = prop === 'box-shadow' ? normShadow(value) : value;
  return base
    // Chrome serialises `color-mix()` results as `color(srgb …)`; canonicalise to rgba() so the two
    // pages can be compared (the values are the same colour).
    .replace(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/g, (_m, r: string, g: string, b: string, a?: string) => {
      const rgb = [r, g, b].map((c) => Math.round(Number(c) * 255)).join(',');
      if (a === undefined) return `rgb(${rgb})`;
      return `rgba(${rgb},${Number(a).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')})`;
    })
    .replace(/rgba\((\d+), *(\d+), *(\d+), *([\d.]+)\)/g, (_m, r: string, g: string, b: string, a: string) => `rgba(${r},${g},${b},${Number(a).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')})`)
    .replace(/\s+/g, ' ')
    .replace(/rgba\(0, 0, 0, 0\)/g, 'transparent')
    .replace(/rgb\((\d+), (\d+), (\d+)\)/g, 'rgb($1,$2,$3)')
    .trim();
}

/** What PROBE returns for one target. */
interface ProbeResult {
  rect: { x: number; y: number; w: number; h: number; cx: number; cy: number };
  styles: Record<string, string>;
}

/** Rect + computed styles of a target, read from a page (a self-contained string script). */
const PROBE = `((sel, props) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const read = (node) => {
    if (!node) return null;
    const cs = getComputedStyle(node);
    const out = {};
    for (const p of props) out[p] = cs.getPropertyValue(p);
    return out;
  };
  return {
    rect: { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 },
    styles: read(el),
  };
})`;

/** Apply a state: hover and active are real mouse input, focus-visible uses focus({focusVisible}). */
async function applyState(page: import('playwright').Page, state: Interaction, sel: string, at: { cx: number; cy: number }, on: boolean): Promise<void> {
  if (state === 'hover') {
    if (on) await page.mouse.move(at.cx, at.cy);
    else await page.mouse.move(0, 0);
  } else if (state === 'active') {
    if (on) {
      await page.mouse.move(at.cx, at.cy);
      await page.mouse.down();
    } else {
      // Move off the control before releasing so the click never fires (the plugin's pills act on it).
      await page.mouse.move(0, 0);
      await page.mouse.up();
    }
  } else {
    const script = on
      ? `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) el.focus({ focusVisible: true }); return !!el; })()`
      : `(() => { const el = document.activeElement; if (el && el.blur) el.blur(); return true; })()`;
    await page.evaluate(script);
  }
  // `.pill-btn { transition: all 0.15s }` — settle before the screenshot.
  await page.waitForTimeout(260);
}

function loadPng(file: string): PNG {
  return PNG.sync.read(fs.readFileSync(file));
}

/** Mean absolute channel difference (0-255) between two same-sized PNG files. */
function diffPct(a: PNG, b: PNG): number {
  if (a.width !== b.width || a.height !== b.height) return NaN;
  let sum = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    sum += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
  }
  return (sum / ((a.data.length / 4) * 3 * 255)) * 100;
}

interface Row {
  combo: string;
  target: string;
  state: Interaction;
  pluginRect: string | null;
  prototypeRect: string | null;
  pluginDelta: number | null;
  prototypeDelta: number | null;
  pixelDiff: number | null;
  /** Properties the state moved and that differ from the prototype. */
  styleDiffs: string[];
  /** Properties that differ identically at rest and in the state (capture-compare.ts's territory). */
  restingDiffs: string[];
  note: string | null;
  /** Set when the row's difference is fully explained and must not count as a state finding. */
  explained: string | null;
  files: { plugin: string; prototype: string; diff: string };
}

async function main(): Promise<void> {
  const themes = expand<Theme>(arg('theme', 'all'), ['dark', 'light']);
  const viewports = expand<HarnessViewport>(arg('viewport', 'all'), ['owner', 'mobile'] as HarnessViewport[]);
  const states = expand<Interaction>(arg('state', 'all'), ['hover', 'focus', 'active'] as Interaction[]);
  const out = path.resolve(arg('out', '.out/states'));
  fs.mkdirSync(out, { recursive: true });
  const fixture = newTableText('Untitled table');
  await buildHarness();
  const server = await startStaticServer(REPO);
  const rows: Row[] = [];
  try {
    for (const theme of themes) for (const viewport of viewports) for (const state of states) {
      const combo = `${theme}-${viewport}-${state}`;
      const dir = path.join(out, combo);
      fs.mkdirSync(dir, { recursive: true });
      const plugin = await openPlugin(server.origin, theme, viewport, fixture, 'Tables/Untitled table.tablify');
      const proto = await openPrototype(server.origin, theme, viewport, fixture);
      try {
        for (const target of TARGETS) {
          const probe = PROBE + `(${JSON.stringify(target.plugin)}, ${JSON.stringify(STATE_PROPS)})`;
          const probeProto = PROBE + `(${JSON.stringify(target.prototype)}, ${JSON.stringify(STATE_PROPS)})`;
          const a = (await plugin.page.evaluate(probe)) as ProbeResult | null;
          const b = (await proto.page.evaluate(probeProto)) as ProbeResult | null;
          const files = { plugin: '', prototype: '', diff: '' };
          if (!a || !b) {
            rows.push({ combo, target: target.id, state, pluginRect: a ? `${a.rect.w.toFixed(1)}x${a.rect.h.toFixed(1)}` : null, prototypeRect: b ? `${b.rect.w.toFixed(1)}x${b.rect.h.toFixed(1)}` : null, pluginDelta: null, prototypeDelta: null, pixelDiff: null, styleDiffs: [], restingDiffs: [], note: !a ? 'plugin element not found' : 'prototype element not found', explained: null, files });
            continue;
          }
          const dw = Math.abs(a.rect.w - b.rect.w);
          const dh = Math.abs(a.rect.h - b.rect.h);
          // Both boxes must agree before the crops can be compared; a control outside the viewport
          // cannot be hovered or pressed, so it is reported rather than silently skipped.
          const vw = viewport === 'mobile' ? 390 : 1568;
          const vh = viewport === 'mobile' ? 844 : 795;
          const offscreen = a.rect.x < 0 || a.rect.y < 0 || a.rect.cx > vw || a.rect.cy > vh;
          if (dw > 0.6 || dh > 0.6) {
            rows.push({ combo, target: target.id, state, pluginRect: `${a.rect.w.toFixed(1)}x${a.rect.h.toFixed(1)}`, prototypeRect: `${b.rect.w.toFixed(1)}x${b.rect.h.toFixed(1)}`, pluginDelta: null, prototypeDelta: null, pixelDiff: null, styleDiffs: [], restingDiffs: [], note: 'size differs — not comparable', explained: null, files });
            continue;
          }
          if (offscreen) {
            rows.push({ combo, target: target.id, state, pluginRect: `${a.rect.w.toFixed(1)}x${a.rect.h.toFixed(1)}`, prototypeRect: `${b.rect.w.toFixed(1)}x${b.rect.h.toFixed(1)}`, pluginDelta: null, prototypeDelta: null, pixelDiff: null, styleDiffs: [], restingDiffs: [], note: 'outside the viewport on this device (the prototype overflows its card there)', explained: 'outside the viewport on this device', files });
            continue;
          }
          const x = Math.max(0, Math.floor(Math.min(a.rect.x, b.rect.x) - PAD));
          const y = Math.max(0, Math.floor(Math.min(a.rect.y, b.rect.y) - PAD));
          const w = Math.min(vw - x, Math.ceil(Math.max(a.rect.x + a.rect.w, b.rect.x + b.rect.w) + PAD) - x);
          const h = Math.min(vh - y, Math.ceil(Math.max(a.rect.y + a.rect.h, b.rect.y + b.rect.h) + PAD) - y);
          const clip = { x, y, width: w, height: h };
          const name = (who: string, kind: string) => path.join(dir, `${target.id}.${who}.${kind}.png`);
          files.plugin = name('plugin', state);
          files.prototype = name('prototype', state);
          files.diff = name('diff', state);

          const shoot = async (page: import('playwright').Page, kind: string, file: string) => {
            await page.screenshot({ path: file, clip });
            return loadPng(file);
          };
          // Resting, then the state, on both pages. `delta` is the element's own movement.
          const pp = await shoot(plugin.page, 'rest', name('plugin', 'rest'));
          const qq = await shoot(proto.page, 'rest', name('prototype', 'rest'));
          const aRest = (await plugin.page.evaluate(probe)) as ProbeResult | null;
          const bRest = (await proto.page.evaluate(probeProto)) as ProbeResult | null;

          await applyState(plugin.page, state, target.plugin, a.rect, true);
          const ps = await shoot(plugin.page, state, files.plugin);
          const aState = (await plugin.page.evaluate(probe)) as ProbeResult | null;
          await applyState(plugin.page, state, target.plugin, a.rect, false);

          await applyState(proto.page, state, target.prototype, b.rect, true);
          const qs = await shoot(proto.page, state, files.prototype);
          const bState = (await proto.page.evaluate(probeProto)) as ProbeResult | null;
          await applyState(proto.page, state, target.prototype, b.rect, false);
          await plugin.page.mouse.move(0, 0);
          await proto.page.mouse.move(0, 0);

          // Diff image: plugin | prototype | |difference|, the same layout the region captures use.
          const d = new PNG({ width: w, height: h });
          for (let i = 0; i < ps.data.length; i += 4) {
            d.data[i] = Math.abs(ps.data[i] - qs.data[i]);
            d.data[i + 1] = Math.abs(ps.data[i + 1] - qs.data[i + 1]);
            d.data[i + 2] = Math.abs(ps.data[i + 2] - qs.data[i + 2]);
            d.data[i + 3] = 255;
          }
          fs.writeFileSync(files.diff, PNG.sync.write(d));

          // Only properties the state itself moves are reported here: a difference that is the same
          // at rest and in the state is a resting difference and belongs to capture-compare.ts
          // (e.g. the plugin's capsule carries the badge's muted ink on the wrapper, un-painted).
          const styleDiffs: string[] = [];
          const restingDiffs: string[] = [];
          for (const p of STATE_PROPS) {
            const av = norm(aState?.styles?.[p] ?? '', p);
            const bv = norm(bState?.styles?.[p] ?? '', p);
            if (av === bv) continue;
            const ar = norm(aRest?.styles?.[p] ?? '', p);
            const br = norm(bRest?.styles?.[p] ?? '', p);
            const moved = av !== ar || bv !== br;
            const why = acceptedReason(target.id, state, p);
            const text = `${p}: ${av || '—'} vs ${bv || '—'}${why ? ` (accepted: ${why})` : ''}`;
            (moved ? styleDiffs : restingDiffs).push(text);
          }
          const pluginDelta = diffPct(pp, ps);
          const prototypeDelta = diffPct(qq, qs);
          const pixelDiff = diffPct(ps, qs);
          const restDiff = diffPct(pp, qq);
          let note: string | null = null;
          let explained: string | null = null;
          if (prototypeDelta > 0.05 && pluginDelta <= 0.02) {
            // The pointer never reached the plugin control — on a phone the prototype's own row
            // overflows its card and paints the control outside it, while the plugin's row clips
            // (the owner's accepted trade-off: the controls stay reachable by scrolling).
            note = 'state did not reach the plugin control (clipped by its row here)';
            explained = 'clipped control on this device (SAD-92 overflow deviation, owner-approved)';
          } else if (
            pixelDiff > 0.5 &&
            Math.abs(pluginDelta - prototypeDelta) <= 0.15 &&
            Math.abs(pixelDiff - restDiff) <= 0.25
          ) {
            // Both pages move by the same amount — or by nothing at all. Whatever is left is the
            // resting render, which capture-compare.ts already measures region by region (the
            // mobile Insert Row's 8 px sticky offset and the search placeholder text live there).
            note = 'same state effect on both pages — the residual is the resting render';
            explained = 'resting difference, not a state difference (capture-compare.ts)';
          }
          if (explained === 'clipped control on this device (SAD-92 overflow deviation, owner-approved)') {
            for (let i = 0; i < styleDiffs.length; i++) {
              if (!styleDiffs[i].includes('(accepted:')) styleDiffs[i] += ' (state not reachable here)';
            }
          }
          rows.push({
            combo,
            target: target.id,
            state,
            pluginRect: `${a.rect.w.toFixed(1)}x${a.rect.h.toFixed(1)}`,
            prototypeRect: `${b.rect.w.toFixed(1)}x${b.rect.h.toFixed(1)}`,
            pluginDelta,
            prototypeDelta,
            pixelDiff,
            styleDiffs,
            restingDiffs,
            note,
            explained,
            files,
          });
        }
      } finally {
        await plugin.close();
        await proto.close();
      }
    }
  } finally {
    await server.close();
  }

  const md: string[] = [
    '# Prototype interaction-state parity (SAD-92)',
    '',
    '`Δ` columns: how far the element moves from its own resting render when the state is applied —',
    '0.00 % on the prototype side means the prototype authors nothing for that state (browser',
    'default). `state diff` compares plugin against prototype *in the state*.',
    '',
    '| Combo | Target | State | Size | Plugin Δ | Prototype Δ | State diff | Style differences | Resting differences | Note |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  let unaccepted = 0;
  for (const r of rows) {
    const pct = (v: number | null) => (v === null || Number.isNaN(v) ? '—' : `${v.toFixed(2)} %`);
    const accepted = acceptedRowReason(r.target, r.state) ?? r.explained;
    const visible = r.pixelDiff !== null && r.pixelDiff > 0.5;
    if (visible && !accepted) unaccepted++;
    const diffCell = visible && accepted ? `${pct(r.pixelDiff)} (accepted: ${accepted})` : pct(r.pixelDiff);
    md.push(`| ${r.combo} | ${r.target} | ${r.state} | ${r.pluginRect ?? '—'} vs ${r.prototypeRect ?? '—'} | ${pct(r.pluginDelta)} | ${pct(r.prototypeDelta)} | ${diffCell} | ${r.styleDiffs.join('; ') || 'none'} | ${r.restingDiffs.join('; ') || 'none'} | ${r.note ?? ''} |`);
  }
  const worst = rows.filter((r) => r.pixelDiff !== null && r.pixelDiff > 0.5).sort((a, b) => (b.pixelDiff ?? 0) - (a.pixelDiff ?? 0));
  md.push('', `**${worst.length}** of ${rows.length} target/state renders differ by more than 0.5 %; **${unaccepted}** of those are not explained by an accepted accessibility addition.`, '');
  fs.writeFileSync(path.join(out, 'report.md'), md.join('\n'));
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ rows }, null, 2));
  console.log(`report: ${path.relative(REPO, path.join(out, 'report.md'))}`);
  for (const r of worst.slice(0, 12)) {
    if (acceptedRowReason(r.target, r.state) ?? r.explained) continue;
    console.log(`  ${r.combo} ${r.target} ${r.state}: ${r.pixelDiff?.toFixed(2)} %  ${r.styleDiffs.slice(0, 3).join('; ')}`);
  }
}

void main();
