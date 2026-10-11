// Plugin-vs-prototype capture sessions (SAD-75 / Step 0).
// Plugin side: the real TableView bundled with the obsidian mock, mounted under the hostile host
// stylesheet, with styles.css injected inline (as Obsidian does). Prototype side: Prototype/index.html
// seeded with the same table through its localStorage document store, prototype-only chrome hidden.
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { chromium, type Browser, type Page } from 'playwright';
import { installCdnRoutes } from './routes';
import { STABLE_CSS, type Theme } from './capture';

export const REPO = path.resolve(__dirname, '..', '..', '..');
const HARNESS_DIR = path.join(REPO, 'tests/visual/harness');
const OUT_DIR = path.join(HARNESS_DIR, '.out');

export const HARNESS_VIEWPORTS = {
  owner: { width: 1568, height: 795 },
  desktop: { width: 1400, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;
export type HarnessViewport = keyof typeof HARNESS_VIEWPORTS;

/** Bundle tests/visual/harness/entry.ts for the browser, `obsidian` -> the test mock. */
export async function buildHarness(): Promise<string> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outfile = path.join(OUT_DIR, 'bundle.js');
  await esbuild.build({
    entryPoints: [path.join(HARNESS_DIR, 'entry.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    outfile,
    alias: { obsidian: path.join(REPO, 'tests/__mocks__/obsidian.ts') },
    logLevel: 'error',
  });
  return outfile;
}

export interface OpenedPage {
  browser: Browser;
  page: Page;
  close(): Promise<void>;
}

async function newPage(theme: Theme, viewport: HarnessViewport): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: HARNESS_VIEWPORTS[viewport],
    colorScheme: theme,
    timezoneId: 'Asia/Dhaka',
    locale: 'en-US',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  });
  await installCdnRoutes(context);
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-10T06:00:00Z'));
  return { browser, page };
}

/** Open the plugin harness with a .tablify fixture text. */
export async function openPlugin(
  origin: string,
  theme: Theme,
  viewport: HarnessViewport,
  fixtureText: string,
  filePath = 'Tables/Untitled table.tablify',
): Promise<OpenedPage> {
  const { browser, page } = await newPage(theme, viewport);
  await page.addInitScript(
    ([text, p]) => {
      (window as unknown as { __TABLIFY_FIXTURE__: string }).__TABLIFY_FIXTURE__ = text;
      (window as unknown as { __TABLIFY_FILE_PATH__: string }).__TABLIFY_FILE_PATH__ = p;
    },
    [fixtureText, filePath],
  );
  await page.goto(origin + '/tests/visual/harness/index.html', { waitUntil: 'load' });
  await page.evaluate(`document.body.classList.toggle('theme-dark', ${theme === 'dark'});
    document.body.classList.toggle('theme-light', ${theme === 'light'});`);
  // Inline the plugin stylesheet like Obsidian: relative url()s resolve against this page.
  const css = fs.readFileSync(path.join(REPO, 'styles.css'), 'utf8');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ url: origin + '/tests/visual/harness/.out/bundle.js' });
  await page.waitForFunction('window.__tablifyReady === true');
  await page.addStyleTag({ content: STABLE_CSS });
  await page.evaluate('document.fonts.ready');
  await page.waitForTimeout(150);
  return { browser, page, close: () => browser.close() };
}

/** Convert a .tablify document into the prototype's in-memory document shape. */
export function toPrototypeDoc(file: Record<string, unknown>): Record<string, unknown> {
  const f = file as {
    tableId: string; name: string;
    fields: Array<Record<string, unknown>>;
    rows: Array<{ id: string; createdAt?: string; updatedAt: string; values: Record<string, unknown> }>;
    views: Array<{ columnOrder?: string[]; columnWidths?: Record<string, number>; hidden?: string[];
      frozenColumns?: number; rowHeight?: string; sort?: Array<{ fieldId: string; direction: string }> }>;
  };
  const v = f.views[0] ?? {};
  const rh = v.rowHeight === 'small' ? 's' : v.rowHeight === 'large' ? 'l' : 'm';
  return {
    formatVersion: 1,
    tableId: f.tableId,
    name: f.name,
    fields: f.fields.map((fd) => ({ required: false, unique: false, min: null, max: null, regex: null, primary: false, ...fd })),
    rows: f.rows.map((r, i) => ({
      id: r.id,
      cells: r.values ?? {},
      createdTime: r.createdAt ?? r.updatedAt,
      modifiedTime: r.updatedAt,
      autoNumber: i + 1,
    })),
    views: [{
      id: 'viw_fixture', name: 'Grid', type: 'grid', query: '',
      sorts: (v.sort ?? []).map((s) => ({ fieldId: s.fieldId, dir: s.direction === 'desc' ? -1 : 1 })),
      groupBy: null, hidden: v.hidden ?? [], order: v.columnOrder ?? f.fields.map((fd) => fd.id as string),
      widths: v.columnWidths ?? {}, freezePrimary: (v.frozenColumns ?? 1) > 0, rowHeight: rh, collapsed: [],
    }],
    syncLink: null,
    nextAutoNumber: f.rows.length + 1,
  };
}

/** CSS that removes the prototype-only chrome (decision S-1) and the 1152px cap (S-7). */
const PROTOTYPE_PRODUCTION_CSS = `
  header, footer, #vaultSidebar, #toast { display: none !important; }
  body { justify-content: flex-start !important; }
  main { max-width: none !important; margin: 0 !important; }
`;

/** Open the prototype seeded with the same table, prototype-only chrome hidden. */
export async function openPrototype(
  origin: string,
  theme: Theme,
  viewport: HarnessViewport,
  fixtureText: string,
): Promise<OpenedPage> {
  const { browser, page } = await newPage(theme, viewport);
  const doc = toPrototypeDoc(JSON.parse(fixtureText) as Record<string, unknown>);
  await page.addInitScript((d) => {
    localStorage.setItem('tablifyPrototypeV1', JSON.stringify({ docs: [d], active: (d as { tableId: string }).tableId }));
  }, doc);
  await page.goto(origin + '/Prototype/index.html', { waitUntil: 'load' });
  await page.evaluate(`(() => {
    const html = document.documentElement;
    html.classList.remove('light', 'dark');
    html.classList.add('${theme}');
    const tabs = document.getElementById('tableTabs');
    if (tabs && tabs.parentElement) tabs.parentElement.style.display = 'none';
  })()`);
  await page.addStyleTag({ content: PROTOTYPE_PRODUCTION_CSS + STABLE_CSS });
  // SAD-79: the prototype sizes its Insert Row pill (syncInsertRowWidth) and frozen offsets
  // at render time, i.e. before the chrome above was hidden — with the sidebar still taking
  // width. Its own resize listener re-renders the grid (150ms debounce); fire it once so the
  // reference reflects the production layout instead of the sidebar-era measurement.
  await page.evaluate("window.dispatchEvent(new Event('resize'))");
  await page.waitForTimeout(250);
  await page.evaluate('document.fonts.ready');
  await page.waitForTimeout(150);
  return { browser, page, close: () => browser.close() };
}
