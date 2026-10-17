/**
 * Field-type matrix in a real browser — `npm run test:fields`.
 *
 * Mounts the **production** `TableView` through the visual-parity harness (the same one
 * `npm run visual:compare` uses) and drives every registered field type the way a user does:
 * double-click → the right surface appears → type → commit → the value is read back from
 * `getViewData()`. Nothing here is a mock of the editor: the real `startEdit`, the real
 * `createEditor`, the real select/attachment panels and the real command stack all run.
 *
 * It exists because the jsdom suites cannot see what a browser does — COD-66 (a double-click that
 * never fired because the first click rebuilt the row) and COD-68 (a `date_time` editor that
 * blanked and then deleted its value) were both invisible to `npm test`.
 *
 * Deliberately NOT part of `npm test`: it needs Chromium and ~15 s. Run it before a release, after
 * touching the grid, the editors or a field type.
 *
 * Exit code 1 when any check fails; prints a table and a summary either way.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { buildHarness, REPO } from '../visual/lib/harness';
import { installCdnRoutes } from '../visual/lib/routes';
import { startStaticServer } from '../visual/lib/server';
import type { FieldDefinition } from '../../src/model/types.js';

const NOW = '2026-10-17T00:00:00.000Z';
const OPTIONS = [
  { id: 'opt_a', name: 'Alpha', color: 'blue' },
  { id: 'opt_b', name: 'Beta', color: 'green' },
];

/** One column per registered field type (21). Formula and link need formatVersion 2. */
const FIELDS: FieldDefinition[] = [
  { id: 'fld_text', name: 'Text', type: 'text', primary: true },
  { id: 'fld_long', name: 'Long', type: 'long_text' },
  { id: 'fld_num', name: 'Number', type: 'number' },
  { id: 'fld_cur', name: 'Currency', type: 'currency' },
  { id: 'fld_pct', name: 'Percent', type: 'percent' },
  { id: 'fld_dur', name: 'Duration', type: 'duration' },
  { id: 'fld_rating', name: 'Rating', type: 'rating' },
  { id: 'fld_check', name: 'Checkbox', type: 'checkbox' },
  { id: 'fld_date', name: 'Date', type: 'date' },
  { id: 'fld_dt', name: 'DateTime', type: 'date_time' },
  { id: 'fld_url', name: 'Url', type: 'url' },
  { id: 'fld_email', name: 'Email', type: 'email' },
  { id: 'fld_phone', name: 'Phone', type: 'phone' },
  { id: 'fld_single', name: 'Single', type: 'single_select', options: OPTIONS },
  { id: 'fld_multi', name: 'Multi', type: 'multi_select', options: OPTIONS },
  { id: 'fld_attach', name: 'Attach', type: 'attachment' },
  { id: 'fld_auto', name: 'Auto', type: 'auto_number' },
  { id: 'fld_created', name: 'Created', type: 'created_time' },
  { id: 'fld_modified', name: 'Modified', type: 'modified_time' },
  { id: 'fld_formula', name: 'Formula', type: 'formula', formula: '1 + 1' },
  { id: 'fld_link', name: 'Link', type: 'link', linkTableId: 'tbl_other1' },
] as FieldDefinition[];

const COL = Object.fromEntries(FIELDS.map((f, i) => [f.id, i])) as Record<string, number>;

function fixture(): string {
  return JSON.stringify({
    formatVersion: 2,
    tableId: 'tbl_fields1',
    name: 'All fields',
    fields: FIELDS,
    rows: [
      // row 0 is the edit target; row 1 starts populated for the "existing value" checks.
      { id: 'row_a', rev: 1, createdAt: NOW, updatedAt: NOW, values: {}, sync: null },
      {
        id: 'row_b',
        rev: 1,
        createdAt: NOW,
        updatedAt: NOW,
        sync: null,
        values: {
          fld_text: 'existing',
          fld_date: '2026-10-16',
          fld_dt: '2026-10-16T09:30:00.000Z',
          // COD-73: the attachment cell that already holds a path (row 0's panel is only opened).
          fld_attach: 'Files/brief.pdf',
        },
      },
    ],
    views: [
      {
        id: 'viw_grid',
        name: 'Grid',
        type: 'grid',
        columnOrder: FIELDS.map((f) => f.id),
        columnWidths: Object.fromEntries(FIELDS.map((f) => [f.id, 120])),
        frozenColumns: 1,
        rowHeight: 'medium',
      },
    ],
    syncLink: null,
  });
}

// ---- harness -----------------------------------------------------------------

const cell = (row: number, col: number): string =>
  `.tablify__row[data-row-index="${row}"] .tablify__cell[data-col-index="${col}"]`;

interface Session {
  browser: Browser;
  page: Page;
  close(): Promise<void>;
}

async function open(origin: string, text: string): Promise<Session> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    // Wide enough that all 21 columns are laid out: no horizontal scrolling to fight.
    viewport: { width: 3000, height: 900 },
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'Asia/Dhaka',
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  });
  await installCdnRoutes(context);
  const page = await context.newPage();
  await page.addInitScript((t) => {
    (window as unknown as { __TABLIFY_FIXTURE__: string }).__TABLIFY_FIXTURE__ = t;
  }, text);
  await page.goto(origin + '/tests/visual/harness/index.html', { waitUntil: 'load' });
  // Obsidian injects the plugin stylesheet; the harness does not, so do it here.
  await page.addStyleTag({ content: fs.readFileSync(path.join(REPO, 'styles.css'), 'utf8') });
  await page.addScriptTag({ url: origin + '/tests/visual/harness/.out/bundle.js' });
  await page.waitForFunction('window.__tablifyReady === true');
  // COD-75: the date panel opens its calendar on the stored value's month, or on "today" when
  // the cell is empty. Pin the clock so "today" is 17 October 2026 in every run.
  await page.clock.setFixedTime(new Date('2026-10-17T06:00:00Z'));
  await page.waitForTimeout(150);
  return { browser, page, close: () => browser.close() };
}

// ---- page helpers ---------------------------------------------------------------

type Surface = 'editor' | 'panel' | 'none';

async function surface(page: Page): Promise<{ kind: Surface; editorType: string | null }> {
  const s = await page.evaluate(() => {
    const editors = document.querySelectorAll<HTMLElement>('input.tablify__editor, textarea.tablify__editor');
    const panels = document.querySelectorAll('.tablify__panel');
    const first = editors[0];
    return {
      editors: editors.length,
      panels: panels.length,
      editorType: first ? (first.getAttribute('type') ?? first.tagName.toLowerCase()) : null,
    };
  });
  return { kind: s.editors > 0 ? 'editor' : s.panels > 0 ? 'panel' : 'none', editorType: s.editorType };
}

/** The value the editor currently holds (for "the editor shows what was stored" checks). */
async function editorValue(page: Page): Promise<{ type: string | null; value: string; invalid: string | null }> {
  return page.evaluate(() => {
    const e = document.querySelector<HTMLInputElement>('input.tablify__editor, textarea.tablify__editor');
    return e
      ? { type: e.getAttribute('type'), value: e.value, invalid: e.getAttribute('aria-invalid') }
      : { type: null, value: '', invalid: null };
  });
}

/** The stored value of a cell, read from the live document. */
async function stored(page: Page, row: number, fieldId: string): Promise<unknown> {
  return page.evaluate(
    ([r, id]) => {
      const doc = JSON.parse((window as unknown as { __tablifyView: { getViewData(): string } }).__tablifyView.getViewData()) as {
        rows: Array<{ values: Record<string, unknown> }>;
      };
      const rowValues = doc.rows[r]?.values ?? {};
      return rowValues[id] === undefined ? null : rowValues[id];
    },
    [row, fieldId] as const,
  );
}

async function dismiss(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(60);
}

async function dblclickCell(page: Page, row: number, col: number): Promise<void> {
  const target = page.locator(cell(row, col));
  await target.scrollIntoViewIfNeeded();
  await target.dblclick();
  await page.waitForTimeout(140);
}

// ---- checks ---------------------------------------------------------------------

const checks: Array<{ ok: boolean; name: string; detail: string }> = [];

function check(name: string, ok: boolean, detail = ''): void {
  checks.push({ ok, name, detail });
}

interface EditCase {
  fieldId: string;
  label: string;
  expect: Surface;
  /** Value typed into the editor; committed when present. */
  input?: string;
  /** Expected stored value after committing. Compared with JSON equality. */
  expected?: unknown;
  /** Skip the Escape/round-trip half of the check (panels with no text input). */
  noEscape?: boolean;
}

const EDIT_CASES: EditCase[] = [
  { fieldId: 'fld_text', label: 'text', expect: 'editor', input: 'Hello world', expected: 'Hello world' },
  { fieldId: 'fld_long', label: 'long_text', expect: 'editor', input: 'Line one', expected: 'Line one' },
  { fieldId: 'fld_num', label: 'number', expect: 'editor', input: '42.5', expected: 42.5 },
  { fieldId: 'fld_cur', label: 'currency', expect: 'editor', input: '1,234.56', expected: 123456 },
  { fieldId: 'fld_pct', label: 'percent', expect: 'editor', input: '25%', expected: 0.25 },
  { fieldId: 'fld_dur', label: 'duration', expect: 'editor', input: '1:30', expected: 90000 },
  { fieldId: 'fld_rating', label: 'rating', expect: 'editor', input: '7', expected: 7 },
  { fieldId: 'fld_check', label: 'checkbox', expect: 'editor', expected: true },
  // COD-75: date and date_time open the anchored picker, not an inline input.
  { fieldId: 'fld_date', label: 'date', expect: 'panel' },
  { fieldId: 'fld_dt', label: 'date_time', expect: 'panel' },
  { fieldId: 'fld_url', label: 'url', expect: 'editor', input: 'https://example.com/a', expected: 'https://example.com/a' },
  { fieldId: 'fld_email', label: 'email', expect: 'editor', input: 'User@Example.com', expected: 'user@example.com' },
  { fieldId: 'fld_phone', label: 'phone', expect: 'editor', input: '+880 1712-345678', expected: '+880 1712-345678' },
  { fieldId: 'fld_single', label: 'single_select', expect: 'panel', expected: 'opt_a', noEscape: true },
  { fieldId: 'fld_multi', label: 'multi_select', expect: 'panel', expected: ['opt_a', 'opt_b'], noEscape: true },
  { fieldId: 'fld_attach', label: 'attachment', expect: 'panel', noEscape: true },
  { fieldId: 'fld_auto', label: 'auto_number', expect: 'none', noEscape: true },
  { fieldId: 'fld_created', label: 'created_time', expect: 'none', noEscape: true },
  { fieldId: 'fld_modified', label: 'modified_time', expect: 'none', noEscape: true },
  { fieldId: 'fld_formula', label: 'formula', expect: 'none', noEscape: true },
  { fieldId: 'fld_link', label: 'link', expect: 'none', noEscape: true },
];

async function runEditingMatrix(page: Page): Promise<void> {
  for (const c of EDIT_CASES) {
    const col = COL[c.fieldId];
    await dblclickCell(page, 0, col);
    const shown = await surface(page);

    // The link picker is a Modal; the obsidian mock never attaches it to the DOM, so "none" is
    // the correct observable here and linkPicker.test.ts covers the picker's contents.
    const expectKind: Surface = c.expect;
    check(`${c.label}: double-click opens ${expectKind}`, shown.kind === expectKind, `got ${shown.kind}`);

    if (shown.kind === 'editor' && c.input !== undefined) {
      const editor = page.locator('input.tablify__editor, textarea.tablify__editor').first();
      await editor.fill(c.input);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(160);
      const got = await stored(page, 0, c.fieldId);
      // date_time: the typed local value must land as the same instant in ISO UTC. The browser
      // runs in its own timezone (Asia/Dhaka below), so the expectation is computed there —
      // computing it in Node would assume the CI machine's zone.
      const expected =
        c.fieldId === 'fld_dt'
          ? await page.evaluate((local: string) => new Date(local).toISOString(), c.input)
          : c.expected;
      check(`${c.label}: commit stores the parsed value`, JSON.stringify(got) === JSON.stringify(expected), `got ${JSON.stringify(got)} want ${JSON.stringify(expected)}`);

      if (!c.noEscape) {
        // Reopen, change, Escape: the committed value must survive.
        await dblclickCell(page, 0, col);
        const again = await surface(page);
        if (again.kind === 'editor') {
          // Each input type has its own value grammar; a datetime-local needs a time part.
          const cancelValue =
            c.fieldId === 'fld_dt' ? '2027-01-01T10:00' : c.fieldId === 'fld_date' ? '2027-01-01' : 'CANCELLED';
          await page.locator('input.tablify__editor, textarea.tablify__editor').first().fill(cancelValue);
          await dismiss(page);
          await page.waitForTimeout(120);
          const after = await stored(page, 0, c.fieldId);
          check(`${c.label}: Escape keeps the committed value`, JSON.stringify(after) === JSON.stringify(got), `got ${JSON.stringify(after)}`);
        }
      }
    } else if (shown.kind === 'editor' && c.fieldId === 'fld_check') {
      // Checkbox: click it, then Enter.
      await page.locator('input.tablify__editor').first().click();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(160);
      const got = await stored(page, 0, c.fieldId);
      check('checkbox: commit stores true', got === true, `got ${JSON.stringify(got)}`);
    } else if (shown.kind === 'panel' && (c.fieldId === 'fld_single' || c.fieldId === 'fld_multi')) {
      const options = page.locator('.tablify__panel .tablify__dropdown-item');
      const count = await options.count();
      if (count === 0) {
        check(`${c.label}: options are listed`, false, 'no .tablify__dropdown-item');
      } else {
        await options.nth(0).click();
        await page.waitForTimeout(150);
        if (c.fieldId === 'fld_multi') {
          await page.locator('.tablify__panel .tablify__dropdown-item').nth(1).click();
          await page.waitForTimeout(150);
        }
        const got = await stored(page, 0, c.fieldId);
        check(`${c.label}: choosing an option stores the option id`, JSON.stringify(got) === JSON.stringify(c.expected), `got ${JSON.stringify(got)}`);
      }
      await dismiss(page);
    } else if (shown.kind === 'panel' && (c.fieldId === 'fld_date' || c.fieldId === 'fld_dt')) {
      // COD-75: pick through the panel's calendar. A date field commits on the day; a date_time
      // keeps the panel open so the time can follow, then Done commits.
      await page.locator('.tablify__date-day[data-date="2026-10-21"]').click();
      await page.waitForTimeout(140);
      if (c.fieldId === 'fld_date') {
        const got = await stored(page, 0, 'fld_date');
        check('date: picking a day stores YYYY-MM-DD', got === '2026-10-21', `got ${JSON.stringify(got)}`);
        check('date: the panel closes on the pick', (await surface(page)).kind === 'none', 'panel still open');
      } else {
        await page.locator('.tablify__date-clock input[aria-label="Hours"]').fill('14');
        await page.locator('.tablify__date-clock input[aria-label="Minutes"]').fill('18');
        await page.locator('.tablify__date-done').click();
        await page.waitForTimeout(140);
        const got = await stored(page, 0, 'fld_dt');
        const want = await page.evaluate(() => new Date(2026, 9, 21, 14, 18, 0, 0).toISOString());
        check('date_time: picking a day and a time stores ISO UTC', got === want, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
        check('date_time: the panel closes on Done', (await surface(page)).kind === 'none', 'panel still open');
      }
    } else if (shown.kind === 'panel' && c.fieldId === 'fld_attach') {
      check('attachment: panel renders an input', (await page.locator('.tablify__panel input').count()) > 0, 'no input');
      await dismiss(page);
    }

    // Leave no surface open for the next case.
    const leftover = await surface(page);
    if (leftover.kind === 'editor') await dismiss(page);
    else if (leftover.kind === 'panel') await dismiss(page);
  }
}

async function runReadOnlyRefusals(page: Page): Promise<void> {
  for (const id of ['fld_auto', 'fld_created', 'fld_modified', 'fld_formula']) {
    const col = COL[id];
    await dblclickCell(page, 0, col);
    check(`${id}: double-click opens nothing`, (await surface(page)).kind === 'none');
    const target = page.locator(cell(0, col));
    await target.click({ button: 'right' });
    await page.waitForTimeout(120);
    check(`${id}: right-click opens no editor`, (await surface(page)).kind === 'none');
    await page.keyboard.press('Escape');
  }
}

async function runInvalidInput(page: Page): Promise<void> {
  const cases: Array<[string, string]> = [
    ['fld_num', 'abc'],
    ['fld_url', 'not-a-url'],
    ['fld_email', 'nope'],
  ];
  for (const [id, bad] of cases) {
    await dblclickCell(page, 0, COL[id]);
    const editor = page.locator('input.tablify__editor, textarea.tablify__editor').first();
    const before = await stored(page, 0, id);
    await editor.fill(bad);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(160);
    const info = await editorValue(page);
    check(`${id}: invalid "${bad}" stays open and marks aria-invalid`, info.type !== null && info.invalid === 'true', JSON.stringify(info));
    check(`${id}: invalid input writes nothing`, JSON.stringify(await stored(page, 0, id)) === JSON.stringify(before));
    await dismiss(page);
  }
}

async function runEmptyCommit(page: Page): Promise<void> {
  await dblclickCell(page, 0, COL.fld_text);
  check('text: editor opened for the clear check', (await surface(page)).kind === 'editor');
  await page.locator('input.tablify__editor, textarea.tablify__editor').first().fill('');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(160);
  const got = await stored(page, 0, 'fld_text');
  // Text types keep an empty string where numeric/date types store null — a pre-existing
  // inconsistency recorded as F4 in docs/plans/all-fields-verification-plan.md. Pinned here so
  // that changing it is a deliberate, visible decision.
  check('text: clearing a cell empties it ("" — text types keep empty strings)', got === '', `got ${JSON.stringify(got)}`);
}

/** What the open date panel shows: the value field's text and the day marked as picked. */
async function panelValue(page: Page): Promise<{ value: string; selected: string | null }> {
  return page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('input.tablify__date-input');
    const selected = document.querySelector('.tablify__date-day[aria-selected="true"]') as HTMLElement | null;
    return { value: input?.value ?? '', selected: selected?.dataset.date ?? null };
  });
}

/** Date/time round-trips — the COD-68 guard, re-asserted through the COD-75 panel. */
async function runDateTimeRoundTrip(page: Page): Promise<void> {
  const iso = '2026-10-16T09:30:00.000Z';

  await dblclickCell(page, 1, COL.fld_dt);
  const info = await panelValue(page);
  const sameInstant = await page.evaluate(
    (args: { value: string; iso: string }) => args.value !== '' && new Date(args.value).getTime() === Date.parse(args.iso),
    { value: info.value, iso },
  );
  check('date_time: the panel replaces the native input', (await surface(page)).kind === 'panel', 'no panel');
  check('date_time: the panel shows the stored instant', sameInstant, `field ${JSON.stringify(info.value)}`);
  check('date_time: the stored day is the selected day', info.selected !== null, `selected ${JSON.stringify(info.selected)}`);

  // Dismissing without an edit must not touch the cell.
  await page.mouse.click(2980, 880);
  await page.waitForTimeout(180);
  check('date_time: open + click away preserves the value', (await stored(page, 1, 'fld_dt')) === iso, `got ${JSON.stringify(await stored(page, 1, 'fld_dt'))}`);

  await dblclickCell(page, 1, COL.fld_date);
  const dateInfo = await panelValue(page);
  check('date: the panel shows the stored day', dateInfo.value === '2026-10-16', JSON.stringify(dateInfo));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
  check('date: unchanged after open + Escape', (await stored(page, 1, 'fld_date')) === '2026-10-16');

  // The claim this ticket is about: no native date control is ever created.
  const native = await page.evaluate(
    () => document.querySelectorAll('input[type="date"], input[type="datetime-local"]').length,
  );
  check('no native date input is ever created', native === 0, `${native} native input(s)`);
}

/** A checkbox that was never set must stay unset when the cell is opened and dismissed. */
async function runCheckboxNull(page: Page): Promise<void> {
  // Clear it first so the check does not depend on the editing matrix's outcome.
  await dblclickCell(page, 1, COL.fld_check);
  const opened = page.locator('input.tablify__editor[type="checkbox"]');
  if ((await opened.count()) > 0) {
    await dismiss(page);
  } else {
    const cb = page.locator('input.tablify__editor').first();
    await cb.click();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  const before = await stored(page, 1, 'fld_check');
  await dblclickCell(page, 1, COL.fld_check);
  await page.mouse.click(2980, 880);
  await page.waitForTimeout(180);
  const after = await stored(page, 1, 'fld_check');
  check('checkbox: open + click away never rewrites the value', JSON.stringify(before) === JSON.stringify(after), `${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
}

/**
 * What the grid renders.
 *
 * COD-71 changed six of these: a select cell shows the option's name (as the prototype's chip),
 * currency / percent / duration show their unit, and a checkbox is a box instead of the word
 * "true". The rest still render their stored text, and those remain pinned — a change to them
 * should fail loudly, exactly as before.
 */
async function runRenderedValues(page: Page): Promise<void> {
  const rendered = (col: number) =>
    page.evaluate(
      (c) =>
        document.querySelector(`.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="${c}"] .tablify__cell-text`)
          ?.textContent ?? null,
      col,
    );
  const expected: Array<[string, string]> = [
    ['fld_text', 'Hello world'],
    ['fld_cur', '1234.56'],
    ['fld_pct', '25%'],
    ['fld_dur', '1m 30s'],
    ['fld_single', 'Alpha'],
    ['fld_multi', 'Alpha Beta'],
    ['fld_formula', '2'],
  ];
  for (const [id, text] of expected) {
    check(`${id}: cell renders "${text}"`, (await rendered(COL[id])) === text, `got ${JSON.stringify(await rendered(COL[id]))}`);
  }

  const chips = await page.evaluate(
    (cols) =>
      cols.map(
        (c) =>
          document.querySelectorAll(
            `.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="${c}"] .tablify__chip`,
          ).length,
      ),
    [COL.fld_single, COL.fld_multi] as const,
  );
  check('single_select: one chip in the cell', chips[0] === 1, `got ${chips[0]}`);
  check('multi_select: one chip per value', chips[1] === 2, `got ${chips[1]}`);

  const leaks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.tablify__row .tablify__cell-text'))
      .map((el) => el.textContent ?? '')
      .filter((t) => t.includes('opt_')).length,
  );
  check('no cell shows a raw option id', leaks === 0, `${leaks} cell(s) with opt_`);
}

/**
 * COD-73: the types COD-71 left raw now render like the prototype.
 *
 * Runs after the edit pass, so each of these is a value the user just typed: the grid must show
 * the meaning (grouped digits, stars, a local stamp, a link, a chip) while the file keeps what
 * was stored. The types COD-71 already covered are pinned above.
 */
async function runCod73Rendering(page: Page): Promise<void> {
  const cellText = (col: number) =>
    page.evaluate(
      (c) =>
        document.querySelector(`.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="${c}"] .tablify__cell-text`)
          ?.textContent ?? null,
      col,
    );
  const cellHasClass = (col: number, cls: string) =>
    page.evaluate(
      ([c, name]) =>
        document.querySelector(`.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="${c}"]`)?.classList.contains(name as string) ?? false,
      [col, cls] as const,
    );

  // number 42.5 stays 42.5; a seven-digit number is grouped. The stored value is untouched.
  check('number: cell renders "42.5"', (await cellText(COL.fld_num)) === '42.5', `got ${JSON.stringify(await cellText(COL.fld_num))}`);
  check('number: cell is right-aligned', await cellHasClass(COL.fld_num, 'tablify__cell--numeric'), 'no numeric class');
  check('number: text is not right-aligned', !(await cellHasClass(COL.fld_text, 'tablify__cell--numeric')), 'text carries the class');
  check('number: stored value is still the number', (await stored(page, 0, 'fld_num')) === 42.5, `got ${JSON.stringify(await stored(page, 0, 'fld_num'))}`);
  check('currency: cell is right-aligned too', await cellHasClass(COL.fld_cur, 'tablify__cell--numeric'), 'no numeric class');

  // rating 7 of a default scale of 5: five stars, all filled, and the label the group heading uses.
  const stars = await page.evaluate(
    (c) =>
      Array.from(
        document.querySelectorAll(
          `.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="${c}"] .tablify__star`,
        ),
      ).map((el) => el.classList.contains('tablify__star--on')),
    COL.fld_rating,
  );
  check('rating: five stars', stars.length === 5, `got ${stars.length}`);
  check('rating: filled up to the value', stars.every(Boolean), `got ${JSON.stringify(stars)}`);
  check('rating: label reads "7/5"', (await cellText(COL.fld_rating)) === '7/5', `got ${JSON.stringify(await cellText(COL.fld_rating))}`);

  // date_time: the local wall clock, the same value the editor shows.
  const localStamp = await page.evaluate((iso) => {
    const d = new Date(iso as string);
    // No helper declarations here: the bundler names them and the page has no `__name`.
    const parts = [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()].map((n, i) =>
      i === 0 ? String(n) : String(n).padStart(2, '0'),
    );
    return `${parts[0]}-${parts[1]}-${parts[2]}T${parts[3]}:${parts[4]}`;
  }, String(await stored(page, 0, 'fld_dt')));
  check('date_time: cell renders the local stamp', (await cellText(COL.fld_dt)) === localStamp, `got ${JSON.stringify(await cellText(COL.fld_dt))} want ${localStamp}`);

  // url / email / phone: real links with the right scheme.
  const hrefs = await page.evaluate(
    (cols) =>
      cols.map(
        (c) =>
          document.querySelector(`.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="${c}"] a.tablify__cell-link`)
            ?.getAttribute('href') ?? null,
      ),
    [COL.fld_url, COL.fld_email, COL.fld_phone] as const,
  );
  check('url: cell is a link to the address', hrefs[0] === 'https://example.com/a', `got ${JSON.stringify(hrefs[0])}`);
  check('email: cell is a mailto: link', hrefs[1] === 'mailto:user@example.com', `got ${JSON.stringify(hrefs[1])}`);
  check('phone: cell is a tel: link', hrefs[2] === 'tel:+880 1712-345678', `got ${JSON.stringify(hrefs[2])}`);

  // attachment: one chip per path (row 1 carries the path; row 0's panel is only opened).
  const chips = await page.evaluate(
    (c) =>
      Array.from(
        document.querySelectorAll(
          `.tablify__row[data-row-index="1"] .tablify__cell[data-col-index="${c}"] .tablify__chip--file`,
        ),
      ).map((el) => el.textContent ?? ''),
    COL.fld_attach,
  );
  check('attachment: one paperclip chip per file', chips.length === 1 && chips[0] === 'Files/brief.pdf', `got ${JSON.stringify(chips)}`);

  // long_text: the two-line clamp class (the capsule height decides how many lines fit).
  check('long_text: cell carries the clamp', await cellHasClass(COL.fld_long, 'tablify__cell--long-text'), 'no clamp class');
}

/**
 * COD-71: the checkbox is a real box. One click flips the value (one undo step), the cell is not
 * selected by that click, and the toolbar's Undo puts the value straight back.
 */
async function runCheckboxClick(page: Page): Promise<void> {
  const selectedCol = () =>
    page.evaluate(() => document.querySelector<HTMLElement>('.tablify__cell--selected')?.dataset.colIndex ?? null);
  const before = await stored(page, 0, 'fld_check');
  const selBefore = await selectedCol();

  const box = page.locator(cell(0, COL.fld_check) + ' .tablify__check');
  await box.scrollIntoViewIfNeeded();
  await box.click();
  await page.waitForTimeout(160);

  const after = await stored(page, 0, 'fld_check');
  check(
    'checkbox: one click flips the value',
    after === (before !== true),
    `${JSON.stringify(before)} -> ${JSON.stringify(after)}`,
  );
  const selAfter = await selectedCol();
  check('checkbox: clicking the box does not move the cell selection', selBefore === selAfter, `${selBefore} -> ${selAfter}`);
  check('checkbox: clicking the box opens no editor', (await surface(page)).kind === 'none');
  const aria = await page.evaluate(
    (c) =>
      document
        .querySelector(`.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="${c}"] .tablify__check`)
        ?.getAttribute('aria-checked') ?? null,
    COL.fld_check,
  );
  check('checkbox: aria-checked follows the value', aria === String(after === true), `${aria} vs ${JSON.stringify(after)}`);

  await page.locator('button.tablify__toolbar-button[data-action="undo"]').click();
  await page.waitForTimeout(160);
  const undone = await stored(page, 0, 'fld_check');
  check(
    'checkbox: one click is one undo step',
    JSON.stringify(undone) === JSON.stringify(before),
    `${JSON.stringify(after)} -> ${JSON.stringify(undone)}, wanted ${JSON.stringify(before)}`,
  );
}

// ---- runner ----------------------------------------------------------------------

async function main(): Promise<void> {
  await buildHarness();
  const server = await startStaticServer(REPO);
  let session: Session | null = null;
  try {
    session = await open(server.origin, fixture());
    await session.page.locator(cell(0, 0)).waitFor({ state: 'visible' });
    await runEditingMatrix(session.page);
    // Before runEmptyCommit: the clearing check empties the text cell these assert on.
    await runRenderedValues(session.page);
    await runCod73Rendering(session.page);
    await runCheckboxClick(session.page);
    await runReadOnlyRefusals(session.page);
    await runInvalidInput(session.page);
    await runEmptyCommit(session.page);
    await runDateTimeRoundTrip(session.page);
    await runCheckboxNull(session.page);
  } finally {
    if (session) await session.close();
    await server.close();
  }

  const width = Math.max(...checks.map((c) => c.name.length), 12);
  console.log('\nField-type matrix (production TableView, Chromium)');
  console.log('-'.repeat(width + 8));
  for (const c of checks) {
    console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(width)}${c.ok ? '' : `  ${c.detail}`}`);
  }
  const failed = checks.filter((c) => !c.ok).length;
  console.log('-'.repeat(width + 8));
  console.log(`${checks.length - failed}/${checks.length} passed`);

  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
