// SAD-85 (Step 7a): prototype modal card parity for the plugin dialogs.
//
// Opens each plugin dialog (real class, Obsidian modal markup, hostile host CSS) and the
// prototype's Add Field card — the prototype dialog every plugin card follows — then:
//   1. saves a screenshot of each card, and
//   2. compares the computed card / title / label / input / button styles element by element
//      (the dialogs without a prototype layout cannot be pixel-diffed, but their parts can).
//
//   npx tsx tests/visual/capture-modals.ts [--theme dark|light|all] [--viewport owner|mobile|all] [--out dir]
import fs from 'node:fs';
import path from 'node:path';
import { REPO, buildHarness, openPlugin, openPrototype, type HarnessViewport } from './lib/harness';
import { startStaticServer } from './lib/server';
import { newTableText } from '../../src/menus/fileMenuModel';

type Theme = 'dark' | 'light';
const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const expand = <T extends string>(v: string, all: T[]): T[] => (v === 'all' ? all : [v as T]);

/** Part → [plugin selector inside the card, prototype selector, compared properties]. */
type Part = { plugin: string; proto: string; props: string[] };
const PARTS: Record<string, Part> = {
  card: {
    plugin: '',
    proto: '',
    // The card's own font-size is never painted (its content is `text-xs`), so it is not compared.
    props: ['background-color', 'border-top-color', 'border-top-left-radius', 'padding-top', 'padding-left', 'box-shadow', 'font-family'],
  },
  title: { plugin: '.modal-title', proto: 'h3', props: ['font-family', 'font-size', 'font-weight', 'line-height', 'color'] },
  label: { plugin: '.setting-item-name', proto: 'label', props: ['font-family', 'font-size', 'font-weight', 'line-height', 'color'] },
  input: {
    plugin: "input[type='text']",
    proto: '#newFieldName',
    props: ['background-color', 'border-top-color', 'border-top-left-radius', 'padding-top', 'padding-left', 'font-family', 'font-size', 'line-height', 'height'],
  },
  primary: {
    plugin: 'button.mod-cta',
    proto: '.mt-5 > button:last-child',
    props: ['background-color', 'border-top-left-radius', 'padding-top', 'padding-left', 'font-family', 'font-size', 'font-weight', 'line-height', 'box-shadow'],
  },
  ghost: {
    plugin: '.setting-item-control button:not(.mod-cta):not(.mod-warning)',
    proto: '.mt-5 > button:first-child',
    props: ['background-color', 'color', 'border-top-left-radius', 'padding-top', 'padding-left', 'font-family', 'font-size', 'font-weight', 'line-height'],
  },
};
/** Deliberate, documented differences (docs/evidence/SAD-85.md). */
const ACCEPTED: Record<string, string> = {
  'primary.color': 'on-accent ink instead of white (AA)',
  // Prototype dialog headings inherit the body ink (`dark:text-gray-100`); only Add Field sets
  // `dark:text-tablify-paper`. Shell dialogs follow the inheriting ones, as the filter builder does.
  'title.color': 'heading takes the plugin text ink, as the other prototype dialogs (dark only)',
};

/** Same rendering, different serialisation: Tailwind's transparent ring layers, font fallbacks. */
function normalise(prop: string, value: string): string {
  if (prop === 'box-shadow') return value.split(/,\s*(?![^()]*\))/).filter((l) => !/^rgba\(0, 0, 0, 0\) 0px 0px 0px 0px$/.test(l.trim())).join(', ');
  if (prop === 'font-family') return value.split(',')[0].trim().replace(/['"]/g, '');
  return value;
}

const KINDS = ['formula', 'linkPicker', 'linkIntegrity'];

function styleScript(root: string, parts: Record<string, string>, props: Record<string, string[]>): string {
  return `(() => {
    const root = document.querySelector(${JSON.stringify(root)});
    const parts = ${JSON.stringify(parts)};
    const props = ${JSON.stringify(props)};
    const out = {};
    for (const [name, sel] of Object.entries(parts)) {
      const el = sel ? root && root.querySelector(sel) : root;
      if (!el) continue;
      const cs = getComputedStyle(el);
      out[name] = {};
      for (const p of props[name]) out[name][p] = cs.getPropertyValue(p);
    }
    return out;
  })()`;
}

async function main(): Promise<void> {
  const themes = expand<Theme>(arg('theme', 'all'), ['dark', 'light']);
  const viewports = expand<HarnessViewport>(arg('viewport', 'all'), ['owner', 'mobile'] as HarnessViewport[]);
  const out = path.resolve(arg('out', '.out/modals'));
  fs.mkdirSync(out, { recursive: true });
  const fixture = newTableText('Untitled table');
  await buildHarness();
  const server = await startStaticServer(REPO);
  const props = Object.fromEntries(Object.entries(PARTS).map(([k, v]) => [k, v.props]));
  const report: string[] = ['# Prototype modal card parity (SAD-85)', ''];
  let mismatches = 0;
  try {
    for (const theme of themes) for (const viewport of viewports) {
      const combo = `${theme}-${viewport}`;
      const proto = await openPrototype(server.origin, theme, viewport, fixture);
      await proto.page.evaluate('showAddFieldModal()');
      // The prototype focuses the name field on open; compare resting states.
      await proto.page.evaluate('document.activeElement && document.activeElement.blur()');
      await proto.page.evaluate('document.fonts.ready');
      await proto.page.waitForTimeout(100);
      await proto.page.locator('#addFieldModal > div').screenshot({ path: path.join(out, `${combo}.prototype-addfield.png`) });
      const protoStyles = (await proto.page.evaluate(
        styleScript('#addFieldModal > div', Object.fromEntries(Object.entries(PARTS).map(([k, v]) => [k, v.proto])), props),
      )) as Record<string, Record<string, string>>;
      await proto.close();

      report.push(`## ${combo}`, '', '| Dialog | Part | Property | Plugin | Prototype |', '|---|---|---|---|---|');
      for (const kind of KINDS) {
        const plugin = await openPlugin(server.origin, theme, viewport, fixture);
        await plugin.page.evaluate(`window.__tablifyOpenModal(${JSON.stringify(kind)})`);
        await plugin.page.evaluate('document.fonts.ready');
        await plugin.page.waitForTimeout(100);
        await plugin.page.locator('.tablify__pmodal').screenshot({ path: path.join(out, `${combo}.${kind}.png`) });
        const pluginStyles = (await plugin.page.evaluate(
          styleScript('.tablify__pmodal', Object.fromEntries(Object.entries(PARTS).map(([k, v]) => [k, v.plugin])), props),
        )) as Record<string, Record<string, string>>;
        await plugin.close();
        for (const [part, values] of Object.entries(pluginStyles)) {
          for (const [prop, value] of Object.entries(values)) {
            const want = protoStyles[part]?.[prop];
            if (want === undefined || normalise(prop, want) === normalise(prop, value)) continue;
            const note = ACCEPTED[`${part}.${prop}`];
            if (!note) mismatches++;
            report.push(`| ${kind} | ${part} | ${prop} | ${value} | ${want}${note ? ` (accepted: ${note})` : ''} |`);
          }
        }
      }
      report.push('');
    }
  } finally {
    await server.close();
  }
  report.push(`Unaccepted mismatches: ${mismatches}`);
  fs.writeFileSync(path.join(out, 'report.md'), report.join('\n') + '\n');
  console.log(report.join('\n'));
}

void main();
