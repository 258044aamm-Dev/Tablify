/* eslint-disable @typescript-eslint/no-non-null-assertion -- test code: DOM queries assert presence explicitly */
/**
 * @vitest-environment jsdom
 */
// P7-01 — embed DOM, two embeds of one file, keyboard, and the code block wiring (T-E).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EmbedRegistry, type EmbedIO } from '../../src/embed/embedDocument.js';
import { EmbedView, EMBED_VIEWPORT_HEIGHT } from '../../src/embed/embedView.js';
import { registerEmbedProcessor } from '../../src/embed/register.js';
import { parse } from '../../src/format/parse.js';
import { serialize } from '../../src/format/serialize.js';
import { createSession } from '../../src/model/tableSession.js';
import { TFile } from 'obsidian';

const TYPICAL = readFileSync(join(process.cwd(), 'samples', 'v1', 'typical.tablify'), 'utf-8');

function memIO(files: Record<string, string>) {
  const state = { files: { ...files }, writes: 0 };
  const io: EmbedIO = {
    read: async (p) => {
      if (!(p in state.files)) throw new Error('ENOENT');
      return state.files[p];
    },
    write: async (p, text) => {
      state.writes += 1;
      state.files[p] = text;
    },
  };
  return { io, state };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function key(el: HTMLElement, k: string, opts: KeyboardEventInit = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));
}

function cellText(view: EmbedView, row: number, col: number): string | null {
  return view.root.querySelector(
    `.tablify__row[data-row-index="${row}"] .tablify__cell[data-col-index="${col}"]`,
  )?.textContent ?? null;
}

function rowCount(view: EmbedView): number {
  return view.root.querySelectorAll('.tablify__row').length;
}

async function openDoc(files: Record<string, string>) {
  const { io, state } = memIO(files);
  const reg = new EmbedRegistry();
  const doc = await reg.acquire('Tables/a.tablify', io);
  return { reg, doc, state };
}

describe('EmbedView: header and limited size', () => {
  it('shows the file path in the header and opens the full table on click', async () => {
    const { doc } = await openDoc({ 'Tables/a.tablify': TYPICAL });
    const onOpenFull = vi.fn();
    const view = new EmbedView({ doc, onOpenFull, theme: 'light' });
    document.body.appendChild(view.root);
    expect(view.root.querySelector('.tablify-embed__path')?.textContent).toBe('file: Tables/a.tablify');
    (view.root.querySelector('[data-testid="tablify-embed-open"]') as HTMLButtonElement).click();
    expect(onOpenFull).toHaveBeenCalledWith('Tables/a.tablify');
    view.destroy();
  });

  it('renders the grid rows of the file', async () => {
    const { doc } = await openDoc({ 'Tables/a.tablify': TYPICAL });
    const view = new EmbedView({ doc, onOpenFull: () => undefined, theme: 'light' });
    document.body.appendChild(view.root);
    const parsed = parse(TYPICAL);
    if (!parsed.ok) throw new Error('fixture');
    const expected = createSession(parsed.data).getDisplayRows().length;
    expect(expected).toBeGreaterThan(0);
    expect(rowCount(view)).toBe(expected);
    expect(EMBED_VIEWPORT_HEIGHT).toBeLessThanOrEqual(400);
    view.destroy();
  });

  it('a missing file shows an error block and does not throw', async () => {
    const { reg, doc } = await openDoc({});
    const view = new EmbedView({ doc, onOpenFull: () => undefined, theme: 'light' });
    document.body.appendChild(view.root);
    const err = view.root.querySelector('[data-testid="tablify-embed-error"]');
    expect(err?.textContent).toContain('was not found');
    expect(view.root.querySelector('.tablify__row')).toBeNull();
    view.destroy();
    reg.release('Tables/a.tablify');
  });
});

describe('EmbedView: two embeds of one file share it (T-E)', () => {
  it('an edit made in one embed appears in the other after save, and the file is written once', async () => {
    const { doc, state } = await openDoc({ 'Tables/a.tablify': TYPICAL });
    const a = new EmbedView({ doc, onOpenFull: () => undefined, theme: 'light' });
    const b = new EmbedView({ doc, onOpenFull: () => undefined, theme: 'light' });
    document.body.append(a.root, b.root);
    const s = doc.getSession()!;
    const rowId = s.getDisplayRows()[0].id;
    const fieldId = s.getVisibleFields()[0].id;

    // Edit through the inline editor of embed A, as a user would.
    a.root.querySelector<HTMLElement>('.tablify__cell')!.click();
    const started = a.startEdit();
    expect(started).toBe(true);
    const input = a.root.querySelector<HTMLInputElement>('.tablify__editor')!;
    input.value = 'EDITED IN A';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await doc.save();
    await flush();

    expect(state.writes).toBe(1);
    expect(state.files['Tables/a.tablify']).toContain('EDITED IN A');
    expect(cellText(b, 0, 0)).toContain('EDITED IN A');
    expect(doc.getSession()!.store.getRow(rowId)?.values[fieldId]).toBe('EDITED IN A');
    a.destroy();
    b.destroy();
  });

  it('a change saved by the full view (external to this document) updates both embeds', async () => {
    const { doc, state, reg } = await openDoc({ 'Tables/a.tablify': TYPICAL });
    const a = new EmbedView({ doc, onOpenFull: () => undefined, theme: 'light' });
    const b = new EmbedView({ doc, onOpenFull: () => undefined, theme: 'light' });
    document.body.append(a.root, b.root);
    const parsed = parse(TYPICAL);
    if (!parsed.ok) throw new Error('fixture');
    const other = createSession(parsed.data);
    const rowId = other.getDisplayRows()[0].id;
    const fieldId = other.getVisibleFields()[0].id;
    other.setValue(rowId, fieldId, 'FROM FULL VIEW');
    state.files['Tables/a.tablify'] = serialize(other.toFile());
    await reg.fileChanged('Tables/a.tablify');
    expect(cellText(a, 0, 0)).toContain('FROM FULL VIEW');
    expect(cellText(b, 0, 0)).toContain('FROM FULL VIEW');
    a.destroy();
    b.destroy();
  });

  it('keeps the cursor position on an external reload where the row still exists', async () => {
    const { doc, state, reg } = await openDoc({ 'Tables/a.tablify': TYPICAL });
    const view = new EmbedView({ doc, onOpenFull: () => undefined, theme: 'light' });
    document.body.appendChild(view.root);
    view.moveBy('moveDown');
    const before = view.getSelection();
    const parsed = parse(TYPICAL);
    if (!parsed.ok) throw new Error('fixture');
    const other = createSession(parsed.data);
    other.setValue(other.getDisplayRows()[0].id, other.getVisibleFields()[0].id, 'X');
    state.files['Tables/a.tablify'] = serialize(other.toFile());
    await reg.fileChanged('Tables/a.tablify');
    expect(view.getSelection()).toEqual(before);
    view.destroy();
  });
});

describe('EmbedView: keyboard and commands (T-E)', () => {
  it('arrow keys move the selection', async () => {
    const { doc } = await openDoc({ 'Tables/a.tablify': TYPICAL });
    const view = new EmbedView({ doc, onOpenFull: () => undefined, theme: 'light' });
    document.body.appendChild(view.root);
    const root = view.root.querySelector<HTMLElement>('[tabindex="0"]')!;
    expect(root).toBeTruthy();
    key(root, 'ArrowDown');
    expect(view.getSelection().row).toBe(1);
    key(root, 'ArrowRight');
    expect(view.getSelection().col).toBe(1);
    view.destroy();
  });

  it('Insert Row adds a row, saves, and Ctrl+Z undoes it', async () => {
    const { doc, state } = await openDoc({ 'Tables/a.tablify': TYPICAL });
    const view = new EmbedView({ doc, onOpenFull: () => undefined, theme: 'light' });
    document.body.appendChild(view.root);
    const before = doc.getSession()!.store.getAllRows().length;
    (view.root.querySelector('[data-testid="tablify-embed-insert"]') as HTMLButtonElement).click();
    expect(doc.getSession()!.store.getAllRows().length).toBe(before + 1);
    await doc.save();
    const saved = parse(state.files['Tables/a.tablify']);
    if (!saved.ok) throw new Error('saved file must parse');
    expect(saved.data.rows).toHaveLength(before + 1);
    const root = view.root.querySelector<HTMLElement>('[tabindex="0"]')!;
    key(root, 'z', { ctrlKey: true });
    expect(doc.getSession()!.store.getAllRows().length).toBe(before);
    view.destroy();
  });

  it('Enter on a selected cell opens the editor', async () => {
    const { doc } = await openDoc({ 'Tables/a.tablify': TYPICAL });
    const view = new EmbedView({ doc, onOpenFull: () => undefined, theme: 'light' });
    document.body.appendChild(view.root);
    const root = view.root.querySelector<HTMLElement>('[tabindex="0"]')!;
    key(root, 'Enter');
    expect(view.root.querySelector('.tablify__editor')).not.toBeNull();
    key(view.root.querySelector<HTMLInputElement>('.tablify__editor')!, 'Escape');
    expect(view.root.querySelector('.tablify__editor')).toBeNull();
    view.destroy();
  });

  it('destroy detaches from the document; later edits do not touch the removed view', async () => {
    const { doc } = await openDoc({ 'Tables/a.tablify': TYPICAL });
    const view = new EmbedView({ doc, onOpenFull: () => undefined, theme: 'light' });
    document.body.appendChild(view.root);
    view.destroy();
    expect(() => doc.mutate((s) => s.addRow())).not.toThrow();
    expect(view.root.isConnected).toBe(false);
  });
});

describe('EmbedView: performance (informational, jsdom)', () => {
  it('renders a 40-row embed quickly (proposed target < 300 ms; jsdom is not Obsidian)', async () => {
    const parsed = parse(TYPICAL);
    if (!parsed.ok) throw new Error('fixture');
    const session = createSession(parsed.data);
    while (session.store.getAllRows().length < 40) session.addRow();
    const big = serialize(session.toFile());
    const { doc } = await openDoc({ 'Tables/a.tablify': big });
    const t0 = performance.now();
    const view = new EmbedView({ doc, onOpenFull: () => undefined, theme: 'light' });
    document.body.appendChild(view.root);
    const ms = performance.now() - t0;
    console.info(`[P7-01] embed render, 40 rows, jsdom: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(300);
    view.destroy();
  });
});

describe('code block wiring (registerEmbedProcessor)', () => {
  it('registers the tablify fence, renders the embed, and releases the document on unload', async () => {
    const files: Record<string, string> = { 'Tables/a.tablify': TYPICAL };
    const file = Object.assign(Object.create(TFile.prototype), { path: 'Tables/a.tablify' }) as TFile;
    const app = {
      vault: {
        getAbstractFileByPath: (p: string) => (p in files ? file : null),
        read: async (f: TFile) => files[f.path],
        modify: async (f: TFile, text: string) => {
          files[f.path] = text;
        },
        on: () => ({}),
      },
      workspace: { openLinkText: vi.fn(async () => undefined) },
    };
    const processors = new Map<string, (src: string, el: HTMLElement, ctx: unknown) => Promise<void>>();
    const plugin = {
      app,
      registerMarkdownCodeBlockProcessor: (lang: string, fn: never) => processors.set(lang, fn),
      registerEvent: vi.fn(),
    };
    const { registry } = registerEmbedProcessor(plugin as never);
    const proc = processors.get('tablify');
    expect(proc).toBeTypeOf('function');

    const el = document.createElement('div');
    const children: { unload(): void; onunload(): void }[] = [];
    await proc!('Tables/a.tablify', el, { addChild: (c: never) => children.push(c) });
    expect(el.querySelector('[data-testid="tablify-embed"]')).not.toBeNull();
    expect(registry.refCount('Tables/a.tablify')).toBe(1);
    expect(children).toHaveLength(1);

    (el.querySelector('[data-testid="tablify-embed-open"]') as HTMLButtonElement).click();
    expect(app.workspace.openLinkText).toHaveBeenCalledWith('Tables/a.tablify', '', false);

    children[0].onunload();
    expect(registry.refCount('Tables/a.tablify')).toBe(0);
    expect(registry.size()).toBe(0);
  });

  it('a bad fence body shows an error block and never loads a file', async () => {
    const app = { vault: { on: () => ({}) }, workspace: {} };
    const processors = new Map<string, (src: string, el: HTMLElement, ctx: unknown) => Promise<void>>();
    registerEmbedProcessor({
      app,
      registerMarkdownCodeBlockProcessor: (lang: string, fn: never) => processors.set(lang, fn),
      registerEvent: vi.fn(),
    } as never);
    const el = document.createElement('div');
    await processors.get('tablify')!('secret.tabula', el, { addChild: () => undefined });
    expect(el.querySelector('[data-testid="tablify-embed-error"]')?.textContent).toContain('only .tablify');
  });
});
