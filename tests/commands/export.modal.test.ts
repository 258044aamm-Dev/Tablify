/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { App, Modal, Notice, TFile } from 'obsidian';
import { openExportModal } from '../../src/commands/export.js';
import { serialize } from '../../src/format/serialize.js';
import { makeFile } from '../io/export.fixtures.js';

function createApp(read: (file: TFile) => Promise<string>, views: Array<{ view: unknown }> = []): App {
  const app = new App();
  const workspace = app.workspace as unknown as {
    activeLeaf: { view: unknown } | null;
    getLeavesOfType: (type: string) => Array<{ view: unknown }>;
  };
  workspace.activeLeaf = null;
  workspace.getLeavesOfType = vi.fn(() => views);
  const vault = app.vault as unknown as { read: (file: TFile) => Promise<string> };
  vault.read = read;
  return app;
}

function tableFile(): TFile {
  const file = new TFile();
  file.path = 'Tables/Budget.tablify';
  file.name = 'Budget.tablify';
  file.basename = 'Budget';
  file.extension = 'tablify';
  return file;
}

function installPicker(handle: unknown): void {
  Object.defineProperty(window, 'showSaveFilePicker', {
    value: vi.fn(async () => handle),
    configurable: true,
  });
}

function openAndClickExport(app: App, file: TFile): Modal {
  openExportModal(app, file);
  const modal = Modal.opened.at(-1);
  if (!modal) throw new Error('Export modal was not opened');
  const button = modal.contentEl.querySelector('button');
  if (!button) throw new Error('Export button was not rendered');
  button.click();
  return modal;
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  Modal.reset();
  Notice.messages = [];
  Reflect.deleteProperty(window, 'showSaveFilePicker');
});

describe('Export modal destination and read flow', () => {
  it('shows a clear read failure and does not write to the selected destination', async () => {
    const file = tableFile();
    const read = vi.fn(async () => {
      throw new Error('source is unavailable');
    });
    const app = createApp(read);
    const writer = { write: vi.fn(), close: vi.fn(), abort: vi.fn() };
    installPicker({ name: 'Budget.csv', createWritable: async () => writer });

    openAndClickExport(app, file);
    await flush();

    expect(read).toHaveBeenCalledOnce();
    expect(writer.write).not.toHaveBeenCalled();
    expect(Notice.messages.at(-1)).toBe('Export failed. No file was saved. Could not read the table file: source is unavailable');
  });

  it('treats picker cancellation as a no-op and never reads or writes the source', async () => {
    const file = tableFile();
    const read = vi.fn(async () => serialize(makeFile(2)));
    const app = createApp(read);
    const showSaveFilePicker = vi.fn(async () => {
      const error = new Error('cancelled');
      error.name = 'AbortError';
      throw error;
    });
    Object.defineProperty(window, 'showSaveFilePicker', { value: showSaveFilePicker, configurable: true });

    openAndClickExport(app, file);
    await flush();

    expect(read).not.toHaveBeenCalled();
    expect(Notice.messages.at(-1)).toBe('Export cancelled. No file was saved.');
  });

  it('reports a destination write failure and aborts the incomplete write', async () => {
    const file = tableFile();
    const read = vi.fn(async () => serialize(makeFile(2)));
    const app = createApp(read);
    const writer = {
      write: vi.fn(async () => {
        throw new Error('disk full');
      }),
      close: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined),
    };
    installPicker({ name: 'Budget.csv', createWritable: async () => writer });

    openAndClickExport(app, file);
    await flush();

    expect(read).toHaveBeenCalledOnce();
    expect(writer.abort).toHaveBeenCalledOnce();
    expect(Notice.messages.at(-1)).toBe('Export failed. No file was saved. Could not save the file: disk full');
  });

  it('flushes pending edits before reading and exports the newly saved content', async () => {
    const file = tableFile();
    const edited = makeFile(2);
    edited.rows[0].values.fld_name = 'Immediate edit';
    const savedText = serialize(edited);
    let saved = false;
    const tableView = {
      file: { path: file.path },
      save: vi.fn(async () => {
        saved = true;
      }),
    };
    const read = vi.fn(async () => {
      expect(saved).toBe(true);
      return savedText;
    });
    const app = createApp(read, [{ view: tableView }]);
    (app.workspace as unknown as { activeLeaf: { view: unknown } }).activeLeaf = { view: tableView };
    const written: string[] = [];
    const writer = {
      write: vi.fn(async (data: string | ArrayBuffer) => {
        written.push(typeof data === 'string' ? data : 'binary');
      }),
      close: vi.fn(async () => undefined),
    };
    installPicker({ name: 'Budget.csv', createWritable: async () => writer });

    openAndClickExport(app, file);
    await flush();

    expect(tableView.save).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledOnce();
    expect(written[0]).toContain('Immediate edit');
    expect(Notice.messages.at(-1)).toContain('Exported 2 rows');
  });
});
