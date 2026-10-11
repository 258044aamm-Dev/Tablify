/**
 * @vitest-environment jsdom
 *
 * TableView × title row integration (SAD-77). Proves the title row is mounted in the card
 * above the toolbar, renames the file (never the JSON), and that Export CSV / Copy Markdown
 * write the *current view* — the prototype's visible fields × pipeline rows.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/commands/import.js', () => ({ startImport: vi.fn() }));
vi.mock('../../src/commands/export.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/commands/export.js')>()),
  openExportModal: vi.fn(),
}));

import { TableView } from '../../src/views/tableView.js';
import { WorkspaceLeaf, Notice, TFile } from 'obsidian';
import { startImport } from '../../src/commands/import.js';
import { openExportModal } from '../../src/commands/export.js';
import { DEBOUNCE_MS } from '../../src/views/grid/toolbar.js';

function mkRow(id: string, values: Record<string, unknown>) {
  return { id, rev: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', values, sync: null };
}

function sampleFile(): string {
  return JSON.stringify({
    formatVersion: 1,
    tableId: 'tbl_test',
    name: 'Inner JSON name',
    fields: [
      { id: 'fld_name', name: 'Name', type: 'text', primary: true },
      { id: 'fld_status', name: 'Status', type: 'text' },
      { id: 'fld_secret', name: 'Secret', type: 'text' },
    ],
    rows: [
      mkRow('row_1', { fld_name: 'Alpha', fld_status: 'done', fld_secret: 's1' }),
      mkRow('row_2', { fld_name: 'Beta', fld_status: 'todo', fld_secret: 's2' }),
      mkRow('row_3', { fld_name: 'Gamma', fld_status: 'done', fld_secret: 's3' }),
    ],
    views: [
      {
        id: 'view_1',
        name: 'Default',
        sort: [{ fieldId: 'fld_name', direction: 'desc' }],
        groupBy: null,
        hidden: ['fld_secret'],
        frozenColumns: 1,
        rowHeight: 'medium',
        columnWidths: {},
        columnOrder: ['fld_name', 'fld_status', 'fld_secret'],
        warnings: [],
      },
    ],
    syncLink: null,
  });
}

function tableFile(path = 'Tables/Budget.tablify'): TFile {
  const f = new TFile();
  f.path = path;
  f.name = path.split('/').pop() ?? path;
  f.extension = 'tablify';
  f.basename = f.name.replace(/\.tablify$/, '');
  return f;
}

async function openView(file: TFile | null = tableFile()): Promise<TableView> {
  const view = new TableView(new WorkspaceLeaf() as never);
  await view.onOpen();
  document.body.appendChild(view.contentEl);
  (view as unknown as { file: TFile | null }).file = file;
  view.setViewData(sampleFile(), false);
  return view;
}

const q = (view: TableView, sel: string) => view.contentEl.querySelector<HTMLElement>(sel);
const flush = () => new Promise((r) => setTimeout(r, 0));

async function rename(view: TableView, text: string) {
  const title = q(view, '[data-testid="tablify-title"]');
  if (!title) throw new Error('no title');
  title.focus();
  title.textContent = text;
  title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await flush();
}

beforeEach(() => {
  Notice.messages = [];
  vi.mocked(startImport).mockClear();
  vi.mocked(openExportModal).mockClear();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('title row placement', () => {
  it('sits first in the card, above the toolbar and the grid body', async () => {
    const view = await openView();
    const card = q(view, '.tablify__card');
    const kids = [...(card?.children ?? [])].map((c) => c.className);
    expect(kids[0]).toBe('tablify__title-row');
    expect(kids[1]).toContain('tablify__toolbar');
    expect(kids[2]).toContain('tablify__body');
  });

  it('shows the file basename as the title and the vault path in the chip', async () => {
    const view = await openView();
    expect(q(view, '[data-testid="tablify-title"]')?.textContent).toBe('Budget');
    expect(q(view, '[data-testid="tablify-file-chip"]')?.textContent).toBe('Tables/Budget.tablify');
  });

  it('refreshes title and chip after Obsidian reports a rename/move', async () => {
    const view = await openView();
    const moved = tableFile('Archive/Old budget.tablify');
    (view as unknown as { file: TFile }).file = moved;
    await view.onRename(moved);
    expect(q(view, '[data-testid="tablify-title"]')?.textContent).toBe('Old budget');
    expect(q(view, '[data-testid="tablify-file-chip"]')?.textContent).toBe('Archive/Old budget.tablify');
  });
});

describe('meta row', () => {
  it('holds the row count in the right-hand badges and an empty hidden selection slot', async () => {
    const view = await openView();
    const meta = q(view, '.tablify__meta-row');
    expect(meta?.querySelector('.tablify__selection-summary')?.hasAttribute('hidden')).toBe(true);
    expect(meta?.querySelector('.tablify__badges [data-testid="tablify-rowcount"]')?.textContent).toBe('3 rows');
  });
});

describe('rename', () => {
  it('renames the file in its folder via fileManager, leaving the JSON alone', async () => {
    const view = await openView();
    const spy = vi.spyOn(view.app.fileManager, 'renameFile');
    const saves = view.saveRequests;
    await rename(view, 'Q3 budget');
    expect(spy).toHaveBeenCalledWith(view.file, 'Tables/Q3 budget.tablify');
    expect(view.saveRequests).toBe(saves);
    expect(JSON.parse(view.getViewData()).name).toBe('Inner JSON name');
  });

  it('renames at the vault root without a leading slash', async () => {
    const view = await openView(tableFile('Budget.tablify'));
    const spy = vi.spyOn(view.app.fileManager, 'renameFile');
    await rename(view, 'Costs');
    expect(spy).toHaveBeenCalledWith(view.file, 'Costs.tablify');
  });

  it('refuses a name that collides with an existing file, with a Notice, and reverts', async () => {
    const view = await openView();
    const spy = vi.spyOn(view.app.fileManager, 'renameFile');
    vi.spyOn(view.app.vault, 'getAbstractFileByPath').mockImplementation(
      (p?: string) => (p === 'Tables/Taken.tablify' ? new TFile() : null) as never,
    );
    await rename(view, 'Taken');
    expect(spy).not.toHaveBeenCalled();
    expect(Notice.messages.at(-1)).toMatch(/already exists/);
    expect(q(view, '[data-testid="tablify-title"]')?.textContent).toBe('Budget');
  });

  it('reports a failed rename and reverts', async () => {
    const view = await openView();
    vi.spyOn(view.app.fileManager, 'renameFile').mockRejectedValue(new Error('disk full'));
    await rename(view, 'Elsewhere');
    expect(Notice.messages.at(-1)).toBe('Could not rename the table: disk full');
    expect(q(view, '[data-testid="tablify-title"]')?.textContent).toBe('Budget');
  });

  it('an invalid name shows a Notice and never reaches the file manager', async () => {
    const view = await openView();
    const spy = vi.spyOn(view.app.fileManager, 'renameFile');
    await rename(view, 'a:b');
    expect(spy).not.toHaveBeenCalled();
    expect(Notice.messages.length).toBe(1);
  });
});

describe('links', () => {
  it('Import… runs the standard import flow', async () => {
    const view = await openView();
    q(view, '[data-action="import"]')?.click();
    expect(startImport).toHaveBeenCalledWith(view.app);
  });

  it('Export… saves pending edits, then opens the Export modal for this file', async () => {
    const view = await openView();
    q(view, '[data-action="export"]')?.click();
    await flush();
    expect(view.saves).toBe(1);
    expect(openExportModal).toHaveBeenCalledWith(view.app, view.file);
  });

  it('Export CSV writes the current view (visible fields, sorted + searched rows) next to the table', async () => {
    vi.useFakeTimers();
    const view = await openView();
    const create = vi.fn(async (_p: string, _d: string) => undefined);
    (view.app.vault as unknown as { create: typeof create }).create = create;
    const search = q(view, '[data-testid="tablify-search"]') as HTMLInputElement;
    search.value = 'done';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(DEBOUNCE_MS + 1);
    vi.useRealTimers();
    q(view, '[data-action="export-csv"]')?.click();
    await flush();
    await flush();
    expect(create).toHaveBeenCalledTimes(1);
    const [path, csv] = create.mock.calls[0];
    expect(path).toBe('Budget.csv');
    const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    expect(lines[0]).toBe('Name,Status');
    // Search "done" drops Beta; view sort is Name desc → Gamma, Alpha.
    expect(lines.slice(1)).toEqual(['Gamma,done', 'Alpha,done']);
    expect(csv).not.toContain('s1');
    expect(Notice.messages.at(-1)).toBe('Exported 2 rows and 2 columns to Budget.csv.');
  });

  it('Export CSV never overwrites: an existing target gets a numbered name', async () => {
    const view = await openView();
    const create = vi.fn(async (_p: string, _d: string) => undefined);
    (view.app.vault as unknown as { create: typeof create }).create = create;
    vi.spyOn(view.app.vault, 'getAbstractFileByPath').mockImplementation(
      (p?: string) => (p === 'Budget.csv' ? new TFile() : null) as never,
    );
    q(view, '[data-action="export-csv"]')?.click();
    await flush();
    await flush();
    expect(create.mock.calls[0][0]).not.toBe('Budget.csv');
    expect(create.mock.calls[0][0]).toMatch(/^Budget.*\.csv$/);
  });

  it('Copy Markdown puts the current view on the clipboard as a Markdown table', async () => {
    const view = await openView();
    const writeText = vi.fn(async (_t: string) => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    q(view, '[data-action="copy-markdown"]')?.click();
    await flush();
    expect(writeText).toHaveBeenCalledTimes(1);
    const md = writeText.mock.calls[0][0];
    expect(md.split('\n')[0]).toMatch(/^\|\s*Name\s*\|\s*Status\s*\|$/);
    expect(md).not.toContain('Secret');
    expect(md.indexOf('Gamma')).toBeLessThan(md.indexOf('Alpha'));
    expect(Notice.messages.at(-1)).toBe('Copied 3 rows as a Markdown table.');
  });

  it('Copy Markdown reports a clipboard failure', async () => {
    const view = await openView();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    q(view, '[data-action="copy-markdown"]')?.click();
    await flush();
    expect(Notice.messages.at(-1)).toBe('Could not copy to the clipboard.');
  });
});
