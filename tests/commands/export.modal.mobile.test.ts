/**
 * @vitest-environment jsdom
 *
 * SAD-350: the Export modal's share destination (iOS "Save to Files" sheet). The WebKit rule
 * under test: navigator.share must be reached while the user's tap is still on the stack, so
 * the modal pre-builds the artifact and the Export tap shares it with no awaits in front.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { App, Modal, Notice, Platform, TFile } from 'obsidian';
import { openExportModal } from '../../src/commands/export.js';
import { serialize } from '../../src/format/serialize.js';
import { makeFile } from '../io/export.fixtures.js';

function createApp(read: (file: TFile) => Promise<string>): App {
  const app = new App();
  const workspace = app.workspace as unknown as {
    activeLeaf: { view: unknown } | null;
    getLeavesOfType: (type: string) => Array<{ view: unknown }>;
  };
  workspace.activeLeaf = null;
  workspace.getLeavesOfType = vi.fn(() => []);
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

/** Install navigator.canShare/share the way Obsidian's iOS WKWebView exposes them. */
function installShare(share: (data: { files: File[] }) => Promise<void>): { shared: File[][] } {
  const record: { shared: File[][] } = { shared: [] };
  Object.defineProperty(window.navigator, 'canShare', {
    value: (data: { files?: File[] }) => Array.isArray(data.files) && data.files.length > 0,
    configurable: true,
  });
  Object.defineProperty(window.navigator, 'share', {
    value: vi.fn(async (data: { files: File[] }) => {
      record.shared.push(data.files);
      await share(data);
    }),
    configurable: true,
  });
  return record;
}

function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  Modal.reset();
  Notice.messages = [];
  Platform.isMobile = true;
  Platform.isIosApp = true;
  Reflect.deleteProperty(window, 'showSaveFilePicker');
});

afterEach(() => {
  Platform.isMobile = false;
  Platform.isIosApp = false;
  Platform.isAndroidApp = false;
  Reflect.deleteProperty(window.navigator, 'canShare');
  Reflect.deleteProperty(window.navigator, 'share');
  Reflect.deleteProperty(window, 'Capacitor');
});

describe('Export modal on a share-destination device (SAD-350)', () => {
  it('pre-builds on open and shares synchronously from the Export tap — no reads in between', async () => {
    const file = tableFile();
    const events: string[] = [];
    const read = vi.fn(async () => {
      events.push('read');
      return serialize(makeFile(2));
    });
    const app = createApp(read);
    const record = installShare(async () => {
      events.push('share');
    });

    openExportModal(app, file);
    await flush();
    expect(read).toHaveBeenCalledOnce(); // preparation ran while the modal was open

    const modal = Modal.opened.at(-1);
    const button = modal?.contentEl.querySelector('button');
    if (!button) throw new Error('Export button was not rendered');
    button.click();
    // The share call happened inside the click stack: recorded before any further awaits.
    expect(record.shared).toHaveLength(1);

    await flush();
    expect(events).toEqual(['read', 'share']); // no second read between tap and share
    const shared = record.shared[0][0];
    expect(shared.name).toBe('Budget.csv');
    expect(shared.type).toContain('text/csv');
    expect(Notice.messages.at(-1)).toBe('Shared 2 rows and 11 columns as Budget.csv.');
    expect(modal?.isOpen).toBe(false);
  });

  it('re-prepares when the format changes and shares the matching file', async () => {
    const file = tableFile();
    const read = vi.fn(async () => serialize(makeFile(2)));
    const app = createApp(read);
    const record = installShare(async () => undefined);

    openExportModal(app, file);
    await flush();

    const modal = Modal.opened.at(-1);
    const dropdown = modal?.contentEl.querySelector('select');
    if (!dropdown) throw new Error('Format dropdown was not rendered');
    dropdown.value = 'md';
    dropdown.dispatchEvent(new Event('change'));
    await flush();

    const button = modal?.contentEl.querySelector('button');
    button?.click();
    await flush();

    expect(record.shared).toHaveLength(1);
    expect(record.shared[0][0].name).toBe('Budget.md');
    expect(Notice.messages.at(-1)).toBe('Shared 2 rows and 11 columns as Budget.md.');
  });

  it('treats a dismissed sheet as cancellation and keeps the modal open', async () => {
    const file = tableFile();
    const app = createApp(async () => serialize(makeFile(2)));
    installShare(async () => {
      throw namedError('AbortError');
    });

    openExportModal(app, file);
    await flush();
    const modal = Modal.opened.at(-1);
    modal?.contentEl.querySelector('button')?.click();
    await flush();

    expect(Notice.messages.at(-1)).toBe('Export cancelled. No file was saved.');
    expect(modal?.isOpen).toBe(true);
  });

  it('offers a fresh-tap retry when the system refuses for lost activation, then shares', async () => {
    const file = tableFile();
    const app = createApp(async () => serialize(makeFile(2)));
    let refuse = true;
    installShare(async () => {
      if (refuse) throw namedError('NotAllowedError');
    });

    openExportModal(app, file);
    await flush();
    const exportModal = Modal.opened.at(-1);
    exportModal?.contentEl.querySelector('button')?.click();
    await flush();

    // The export modal gave way to the retry modal; nothing was reported as saved.
    expect(exportModal?.isOpen).toBe(false);
    const retry = Modal.opened.at(-1);
    expect(retry).not.toBe(exportModal);
    const retryButton = retry?.contentEl.querySelector('button');
    if (!retryButton) throw new Error('Retry button was not rendered');
    expect(retryButton.textContent).toBe('Save file');

    refuse = false;
    retryButton.click();
    await flush();
    expect(Notice.messages.at(-1)).toBe('Shared 2 rows and 11 columns as Budget.csv.');
    expect(retry?.isOpen).toBe(false);
  });

  it('reports a preparation failure honestly and never calls share', async () => {
    const file = tableFile();
    const app = createApp(async () => {
      throw new Error('source is unavailable');
    });
    const record = installShare(async () => undefined);

    openExportModal(app, file);
    await flush();
    const modal = Modal.opened.at(-1);
    modal?.contentEl.querySelector('button')?.click();
    await flush();

    expect(record.shared).toHaveLength(0);
    expect(Notice.messages.at(-1)).toBe(
      'Export failed. No file was saved. Could not read the table file: source is unavailable',
    );
  });

  it('Android without a dialog falls back to the Capacitor shared folder and names the path', async () => {
    Platform.isIosApp = false;
    Platform.isAndroidApp = true; // Android WebView: no picker, no Web Share API
    const writes: Array<{ path: string; directory: string; encoding?: string }> = [];
    Object.defineProperty(window, 'Capacitor', {
      value: {
        Plugins: {
          Filesystem: {
            writeFile: vi.fn(async (opts: { path: string; directory: string; encoding?: string }) => {
              writes.push(opts);
              return { uri: `file:///storage/emulated/0/${opts.path}` };
            }),
            stat: vi.fn(async () => {
              throw new Error('File does not exist');
            }),
          },
        },
      },
      configurable: true,
    });
    const file = tableFile();
    const app = createApp(async () => serialize(makeFile(2)));

    openExportModal(app, file);
    await flush();
    const modal = Modal.opened.at(-1);
    modal?.contentEl.querySelector('button')?.click();
    await flush();

    expect(writes).toEqual([
      expect.objectContaining({ path: 'Download/Tablify/Budget.csv', directory: 'EXTERNAL_STORAGE', encoding: 'utf8' }),
    ]);
    expect(Notice.messages.at(-1)).toBe('Saved Budget.csv (2 rows, 11 columns) to Download/Tablify/Budget.csv.');
    expect(modal?.isOpen).toBe(false);
  });

  it('mobile without any delivery method fails honestly instead of claiming a download', async () => {
    Platform.isIosApp = false; // e.g. Android WebView: no picker, no Web Share API
    const file = tableFile();
    const read = vi.fn(async () => serialize(makeFile(2)));
    const app = createApp(read);

    openExportModal(app, file);
    await flush();
    const modal = Modal.opened.at(-1);
    modal?.contentEl.querySelector('button')?.click();
    await flush();

    expect(Notice.messages.at(-1)).toBe(
      'Export failed. No file was saved. No supported save or download method is available.',
    );
  });
});

/**
 * SAD-350 round 2 — the reported bug, end to end. Android's WebView exposes
 * `window.showSaveFilePicker` (M132+), but the host app must implement the save-mode chooser.
 * Obsidian does not, so the call rejects instantly with AbortError and no dialog: the export
 * used to stop there with "Export cancelled. No file was saved." and write nothing.
 */
describe('Export modal on Android where the save dialog never opens (SAD-350 round 2)', () => {
  function installAbortingPicker(onCall?: () => void): ReturnType<typeof vi.fn> {
    const picker = vi.fn(async () => {
      onCall?.();
      const error = new Error('The user aborted a request.');
      error.name = 'AbortError';
      throw error;
    });
    Object.defineProperty(window, 'showSaveFilePicker', { value: picker, configurable: true });
    return picker;
  }

  function installFilesystem(writes: Array<{ path: string; directory: string; encoding?: string }>): void {
    Object.defineProperty(window, 'Capacitor', {
      value: {
        Plugins: {
          Filesystem: {
            writeFile: vi.fn(async (opts: { path: string; directory: string; encoding?: string }) => {
              writes.push(opts);
              return { uri: `file:///storage/emulated/0/${opts.path}` };
            }),
            stat: vi.fn(async () => {
              throw new Error('File does not exist');
            }),
          },
        },
      },
      configurable: true,
    });
  }

  function android(): void {
    Platform.isIosApp = false;
    Platform.isAndroidApp = true;
  }

  it('saves to the shared folder instead of reporting a cancellation', async () => {
    android();
    const writes: Array<{ path: string; directory: string; encoding?: string }> = [];
    installFilesystem(writes);
    const picker = installAbortingPicker();

    const app = createApp(async () => serialize(makeFile(2)));
    openExportModal(app, tableFile());
    await flush();

    const modal = Modal.opened.at(-1);
    modal?.contentEl.querySelector('button')?.click();
    await flush();

    expect(picker).toHaveBeenCalledOnce();
    expect(writes).toEqual([
      expect.objectContaining({ path: 'Download/Tablify/Budget.csv', directory: 'EXTERNAL_STORAGE', encoding: 'utf8' }),
    ]);
    expect(Notice.messages.at(-1)).toBe('Saved Budget.csv (2 rows, 11 columns) to Download/Tablify/Budget.csv.');
    expect(Notice.messages).not.toContain('Export cancelled. No file was saved.');
    expect(modal?.isOpen).toBe(false);
  });

  it('still reports a real dismissal, and writes nothing', async () => {
    android();
    const writes: Array<{ path: string; directory: string; encoding?: string }> = [];
    installFilesystem(writes);
    installAbortingPicker(() => window.dispatchEvent(new Event('blur')));

    const app = createApp(async () => serialize(makeFile(2)));
    openExportModal(app, tableFile());
    await flush();

    const modal = Modal.opened.at(-1);
    modal?.contentEl.querySelector('button')?.click();
    await flush();

    expect(writes).toHaveLength(0);
    expect(Notice.messages.at(-1)).toBe('Export cancelled. No file was saved.');
  });
});
