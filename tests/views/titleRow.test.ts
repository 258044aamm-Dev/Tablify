/**
 * @vitest-environment jsdom
 *
 * TitleRow unit tests (SAD-77): the prototype's editable table name, file chip and the
 * Import… / Export… / Export CSV / Copy Markdown links. jsdom only, no Obsidian.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { TitleRow, validateTableName, type TitleRowCallbacks } from '../../src/views/titleRow.js';

function makeCallbacks(renameResult: boolean | (() => Promise<boolean>) = true) {
  const cb = {
    onRename: vi.fn(async (_name: string) =>
      typeof renameResult === 'function' ? renameResult() : renameResult,
    ),
    onImport: vi.fn(),
    onExport: vi.fn(),
    onExportCsv: vi.fn(),
    onCopyMarkdown: vi.fn(),
    onInvalidName: vi.fn(),
  };
  return cb satisfies TitleRowCallbacks;
}

function mount(cb = makeCallbacks(), state = { title: 'Budget', path: 'Tables/Budget.tablify' }) {
  const row = new TitleRow(state, cb);
  document.body.appendChild(row.root);
  const title = row.root.querySelector<HTMLElement>('[data-testid="tablify-title"]');
  const chip = row.root.querySelector<HTMLElement>('[data-testid="tablify-file-chip"]');
  if (!title || !chip) throw new Error('title row incomplete');
  return { row, cb, title, chip };
}

/** Type a new name and commit it the way a user does (focus, edit, Enter → blur). */
async function edit(title: HTMLElement, text: string, key: 'Enter' | 'Escape' = 'Enter') {
  title.focus();
  title.textContent = text;
  title.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('TitleRow structure', () => {
  it('renders the prototype order: title, file chip, then the four links', () => {
    const { row, title, chip } = mount();
    expect(row.root.classList.contains('tablify__title-row')).toBe(true);
    expect(title.tagName).toBe('H2');
    expect(title.textContent).toBe('Budget');
    expect(title.contentEditable).toBe('true');
    expect(chip.textContent).toBe('Tables/Budget.tablify');
    expect(chip.hidden).toBe(false);
    const links = [...row.root.querySelectorAll<HTMLButtonElement>('button.tablify__title-link')];
    expect(links.map((b) => b.textContent?.trim())).toEqual(['Import…', 'Export…', 'Export CSV', 'Copy Markdown']);
    expect(links.map((b) => b.dataset.action)).toEqual(['import', 'export', 'export-csv', 'copy-markdown']);
    for (const b of links) {
      expect(b.type).toBe('button');
      expect(b.querySelector('.tablify__title-link-icon svg')).not.toBeNull();
    }
  });

  it('hides the chip when there is no file path', () => {
    const { chip } = mount(makeCallbacks(), { title: '', path: '' });
    expect(chip.hidden).toBe(true);
  });

  it('contains no prototype-only annotation text', () => {
    const { row } = mount();
    expect(row.root.textContent).not.toMatch(/Prototype|Feature \d|simulated/i);
  });
});

describe('TitleRow links', () => {
  it.each([
    ['import', 'onImport'],
    ['export', 'onExport'],
    ['export-csv', 'onExportCsv'],
    ['copy-markdown', 'onCopyMarkdown'],
  ] as const)('%s fires %s only', (action, handler) => {
    const { row, cb } = mount();
    row.root.querySelector<HTMLElement>(`[data-action="${action}"]`)?.click();
    for (const key of ['onImport', 'onExport', 'onExportCsv', 'onCopyMarkdown'] as const) {
      expect(cb[key]).toHaveBeenCalledTimes(key === handler ? 1 : 0);
    }
  });

  it('a click on the icon still fires the link', () => {
    const { row, cb } = mount();
    row.root.querySelector<HTMLElement>('[data-action="export-csv"] svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cb.onExportCsv).toHaveBeenCalledTimes(1);
  });
});

describe('TitleRow rename', () => {
  it('Enter commits a trimmed, whitespace-collapsed name', async () => {
    const { cb, title } = mount();
    await edit(title, '  Q3   budget \n');
    expect(cb.onRename).toHaveBeenCalledWith('Q3 budget');
    expect(title.textContent).toBe('Q3 budget');
  });

  it('blur also commits', async () => {
    const { cb, title } = mount();
    title.focus();
    title.textContent = 'Projects';
    title.blur();
    await new Promise((r) => setTimeout(r, 0));
    expect(cb.onRename).toHaveBeenCalledWith('Projects');
  });

  it('Escape reverts without renaming', async () => {
    const { cb, title } = mount();
    await edit(title, 'Something else', 'Escape');
    expect(cb.onRename).not.toHaveBeenCalled();
    expect(title.textContent).toBe('Budget');
  });

  it('an unchanged or empty name reverts silently', async () => {
    const { cb, title } = mount();
    await edit(title, 'Budget');
    await edit(title, '   ');
    expect(cb.onRename).not.toHaveBeenCalled();
    expect(cb.onInvalidName).not.toHaveBeenCalled();
    expect(title.textContent).toBe('Budget');
  });

  it('an invalid name reports and reverts', async () => {
    const { cb, title } = mount();
    await edit(title, 'a/b');
    expect(cb.onRename).not.toHaveBeenCalled();
    expect(cb.onInvalidName).toHaveBeenCalledTimes(1);
    expect(title.textContent).toBe('Budget');
  });

  it('a failed rename reverts to the old name', async () => {
    const { cb, title } = mount(makeCallbacks(false));
    await edit(title, 'Taken');
    expect(cb.onRename).toHaveBeenCalledWith('Taken');
    expect(title.textContent).toBe('Budget');
  });

  it('a rename that throws still reverts and unlocks', async () => {
    const cb = makeCallbacks(() => Promise.reject(new Error('boom')));
    const { title } = mount(cb);
    title.focus();
    title.textContent = 'X';
    title.blur();
    await new Promise((r) => setTimeout(r, 0));
    expect(title.textContent).toBe('Budget');
    // Unlocked: the next edit reaches onRename again.
    await edit(title, 'Y');
    expect(cb.onRename).toHaveBeenCalledTimes(2);
  });

  it('update() refreshes title and chip, but never clobbers an edit in progress', () => {
    const { row, title, chip } = mount();
    title.focus();
    title.textContent = 'Half typed';
    row.update({ title: 'Renamed', path: 'Tables/Renamed.tablify' });
    expect(title.textContent).toBe('Half typed');
    expect(chip.textContent).toBe('Tables/Renamed.tablify');
    title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(title.textContent).toBe('Renamed');
  });
});

describe('validateTableName', () => {
  it('accepts ordinary names, including spaces, unicode and inner dots', () => {
    for (const ok of ['Budget', 'Q3 budget', 'Reading list 2026', 'বাজেট', 'v1.2 notes']) {
      expect(validateTableName(ok), ok).toBeNull();
    }
  });

  it('rejects empty names, a leading dot and characters Obsidian forbids in file or link names', () => {
    for (const bad of ['', '.hidden', 'a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b', 'a#b', 'a^b', 'a[b', 'a]b']) {
      expect(validateTableName(bad), bad).not.toBeNull();
    }
  });
});
