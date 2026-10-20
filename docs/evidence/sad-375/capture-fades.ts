/**
 * SAD-375 evidence — phone edge fades, captured from the real plugin harness.
 *
 * What it proves (measurement, not taste):
 *   1. At 390 px the tool row actually overflows (without overflow there is nothing to cue).
 *   2. In each scroll state the fade overlays carry exactly the planned opacities:
 *      at rest → right fade only; mid-scroll → both; at end → left fade only; computed on the
 *      real ::before/::after pseudo-elements, so a wrong class or a wrong rule fails the run.
 *   3. At the owner (desktop) viewport no fade state is active — the cue never touches desktop.
 *
 * Screenshots land in docs/evidence/sad-375/ next to capture-report.md.
 *
 * Run (browser binaries must be reachable):
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright npx tsx docs/evidence/sad-375/capture-fades.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { REPO, buildHarness, openPlugin } from '../../../tests/visual/lib/harness';
import { startStaticServer } from '../../../tests/visual/lib/server';
import { newTableText } from '../../../src/menus/fileMenuModel';

const OUT = path.join(REPO, 'docs', 'evidence', 'sad-375');

type ScrollState = 'start' | 'mid' | 'end';

const STATES: Array<{ name: string; scroll: ScrollState }> = [
  { name: 'at-rest', scroll: 'start' },
  { name: 'mid-scroll', scroll: 'mid' },
  { name: 'at-end', scroll: 'end' },
];

/** The class-gated opacity contract, per scroll state: [::before (left fade), ::after (right fade)]. */
const EXPECTED_OPACITY: Record<ScrollState, [number, number]> = {
  start: [0, 1],
  mid: [1, 1],
  end: [1, 0],
};

/** Drive a scroll state and read the live fade contract. A self-contained string script, so tsx
 *  never transpiles it into the page (the house PROBE pattern in tests/visual/capture-states.ts). */
const MEASURE = `((s) => {
  const el = document.querySelector('.tablify__toolbar-actions');
  const wrap = document.querySelector('.tablify__toolbar-actions-wrap');
  const max = el.scrollWidth - el.clientWidth;
  el.scrollLeft = s === 'start' ? 0 : s === 'mid' ? Math.round(max / 2) : max;
  el.dispatchEvent(new Event('scroll'));
  return {
    overflow: max,
    scrollLeft: el.scrollLeft,
    wrapClass: wrap.className,
    before: Number(getComputedStyle(wrap, '::before').opacity),
    after: Number(getComputedStyle(wrap, '::after').opacity),
    beforeContent: String(getComputedStyle(wrap, '::before').content),
    afterContent: String(getComputedStyle(wrap, '::after').content),
  };
})`;

async function measure(page: import('playwright').Page, scroll: ScrollState) {
  return page.evaluate(`${MEASURE}(${JSON.stringify(scroll)})`) as Promise<{
    overflow: number;
    scrollLeft: number;
    wrapClass: string;
    before: number;
    after: number;
    beforeContent: string;
    afterContent: string;
  }>;
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  await buildHarness();
  const server = await startStaticServer(REPO);
  const fixture = newTableText('Untitled table');
  const rows: string[] = [];
  const failures: string[] = [];

  try {
    for (const theme of ['light', 'dark'] as const) {
      const opened = await openPlugin(server.origin, theme, 'mobile', fixture, 'Tables/Untitled table.tablify');
      for (const state of STATES) {
        const m = await measure(opened.page, state.scroll);
        if (state.scroll === 'start' && m.overflow <= 1) {
          failures.push(`${theme}-mobile: tool row does not overflow at 390px (${m.overflow}px)`);
        }
        const [expBefore, expAfter] = EXPECTED_OPACITY[state.scroll];
        if (m.before !== expBefore || m.after !== expAfter) {
          failures.push(
            `${theme}-mobile ${state.name}: ::before=${m.before} (want ${expBefore}), ::after=${m.after} (want ${expAfter}), classes="${m.wrapClass}"`,
          );
        }
        // The overlays must generate a box on phones (content: ''), or the opacities prove nothing.
        if (!/^(""|'')$/.test(m.beforeContent) || !/^(""|'')$/.test(m.afterContent)) {
          failures.push(`${theme}-mobile ${state.name}: fade overlay has no box (content ${m.beforeContent}/${m.afterContent})`);
        }
        await opened.page.waitForTimeout(80); // let the reduced-motion-safe state settle
        await opened.page
          .locator('.tablify__toolbar-row')
          .screenshot({ path: path.join(OUT, `${theme}-mobile.toolbar-row.${state.name}.png`) });
        rows.push(
          `| ${theme} | ${state.name} | ${m.scrollLeft} / ${m.overflow} | \`${m.wrapClass}\` | ${m.before} | ${m.after} | ${m.beforeContent} / ${m.afterContent} |`,
        );
      }
      await opened.close();
    }

    // Desktop control: no fade state may be active at the owner width, and no overlay may
    // generate a box at all (content: none — opacity on a nonexistent pseudo is meaningless).
    for (const theme of ['light', 'dark'] as const) {
      const opened = await openPlugin(server.origin, theme, 'owner', fixture, 'Tables/Untitled table.tablify');
      const m = await measure(opened.page, 'start');
      if (m.wrapClass.includes('is-fade')) {
        failures.push(`${theme}-desktop: fade class active at owner width: "${m.wrapClass}"`);
      }
      for (const [side, content] of [['::before', m.beforeContent], ['::after', m.afterContent]] as const) {
        if (content !== 'none' && content !== 'normal') {
          failures.push(`${theme}-desktop: ${side} generates a box (content ${content}) — fade leaked off-phone`);
        }
      }
      await opened.page
        .locator('.tablify__toolbar-row')
        .screenshot({ path: path.join(OUT, `${theme}-desktop.toolbar-row.at-rest.png`) });
      rows.push(
        `| ${theme} | desktop control | — | \`${m.wrapClass}\` | n/a | n/a | ${m.beforeContent} / ${m.afterContent} |`,
      );
      await opened.close();
    }

    const report = `# SAD-375 — fade capture report (real plugin, visual harness)

Captured from the bundled plugin harness (\`tests/visual/harness\`) at 390×844 (phone) and 1568×795
(owner/desktop). Computed opacities are read from the live \`::before\` / \`::after\` overlays; the
run fails if any state disagrees with the class-gated contract, if a phone overlay generates no
box, or if a desktop overlay generates one. Context uses \`reducedMotion: 'reduce'\`, so states are
exact with no transition in flight.

| Theme | State | scrollLeft / overflow | fade classes on the wrapper | ::before | ::after | ::before / ::after content |
|---|---|---|---|---|---|---|
${rows.join('\n')}

Expected per state: at-rest \`0 / 1\` (right fade only), mid-scroll \`1 / 1\`, at-end \`1 / 0\`
(left fade only); phone overlays generate a box (\`"" / ""\`). Desktop control: no \`is-fade\`
classes and \`none / none\` content — the opacities of a nonexistent pseudo are initial values
and carry no meaning; the content check is the proof that nothing paints.

Deviation note: the visual-parity harness compares \`toolbar-row\` against the prototype
(\`tests/visual/lib/regions.ts\`), which has no fade — the prototype is desktop-oriented and the
phone scroll row itself is already a plugin-only layout (SAD-308). The fade is the SAD-375
owner-sanctioned improvement beyond the prototype, same class of deviation as SAD-308.

Manual device runbook (T-M-DEV) remains NOT RUN — no iOS/Android device in this environment.
`;
    fs.writeFileSync(path.join(OUT, 'capture-report.md'), report);
    console.log(rows.join('\n'));
    if (failures.length > 0) {
      console.error('FAILURES:\n' + failures.join('\n'));
      process.exitCode = 1;
      return;
    }
    console.log('all fade states match the class-gated contract');
  } finally {
    await server.close();
  }
}

void main();
