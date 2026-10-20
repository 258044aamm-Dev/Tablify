/**
 * @vitest-environment jsdom
 *
 * SAD-350 round 2 — the opt-in vault last resort (owner decision 4).
 *
 * Off by default: the documented rule "an export never writes into the vault" is unchanged
 * unless the user turns the Export setting on. When it is on it is the *last* tier — after the
 * system dialog, the share sheet, the shared folder and the desktop download — and it never
 * overwrites.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { App, Modal, Notice, Platform, TFile } from 'obsidian';
import {
  openExportModal,
  setExportPreferences,
  writeExportToVault,
} from '../../src/commands/export.js';
import { saveExportArtifact, type ExportArtifact, type ExportSaveRuntime } from '../../src/io/export/destination.js';
import { serialize } from '../../src/format/serialize.js';
import { makeFile } from '../io/export.fixtures.js';

const artifact: ExportArtifact = {
  fileName: 'Budget.csv',
  mimeType: 'text/csv',
  data: 'Name,Amount\r\nAlpha,12\r\n',
};

function tableFile(): TFile {
  const file = new TFile();
  file.path = 'Tables/Budget.tablify';
  file.name = 'Budget.tablify';
  file.basename = 'Budget';
  file.extension = 'tablify';
  file.parent = { path: 'Tables' } as TFile['parent'];
  return file;
}

/** An App whose vault records writes and can pretend a path already exists. */
function vaultApp(existing: string[] = [], failWith?: string) {
  const app = new App();
  const writes: Array<{ kind: 'text' | 'binary'; path: string }> = [];
  const vault = app.vault as unknown as Record<string, unknown>;
  vault.getAbstractFileByPath = (path: string) => (existing.includes(path) ? ({} as never) : null);
  vault.create = async (path: string, _data: string) => {
    if (failWith) throw new Error(failWith);
    writes.push({ kind: 'text', path });
    return new TFile(path);
  };
  vault.createBinary = async (path: string, _data: ArrayBuffer) => {
    if (failWith) throw new Error(failWith);
    writes.push({ kind: 'binary', path });
    return new TFile(path);
  };
  return { app, writes };
}

beforeEach(() => {
  Modal.reset();
  Notice.messages = [];
});

afterEach(() => {
  setExportPreferences(() => ({ vaultFallback: false }));
  Platform.isMobile = false;
  Platform.isIosApp = false;
  Platform.isAndroidApp = false;
  Reflect.deleteProperty(window, 'Capacitor');
  Reflect.deleteProperty(window, 'showSaveFilePicker');
  vi.restoreAllMocks();
});

describe('writeExportToVault (SAD-350 round 2)', () => {
  it('writes text next to the table and reports the vault path', async () => {
    const { app, writes } = vaultApp();
    const result = await writeExportToVault(app, tableFile(), artifact);
    expect(writes).toEqual([{ kind: 'text', path: 'Tables/Budget.csv' }]);
    expect(result).toEqual({ ok: true, fileName: 'Budget.csv', displayPath: 'Tables/Budget.csv' });
  });

  it('never overwrites: numbered name on collision', async () => {
    const { app, writes } = vaultApp(['Tables/Budget.csv', 'Tables/Budget 2.csv']);
    const result = await writeExportToVault(app, tableFile(), artifact);
    expect(writes).toEqual([{ kind: 'text', path: 'Tables/Budget 3.csv' }]);
    expect(result).toEqual({ ok: true, fileName: 'Budget 3.csv', displayPath: 'Tables/Budget 3.csv' });
  });

  it('writes an XLSX artifact through the binary path', async () => {
    const { app, writes } = vaultApp();
    const xlsx: ExportArtifact = {
      fileName: 'Budget.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: new Uint8Array([0x50, 0x4b]).buffer,
    };
    const result = await writeExportToVault(app, tableFile(), xlsx);
    expect(writes).toEqual([{ kind: 'binary', path: 'Tables/Budget.xlsx' }]);
    expect(result).toEqual({ ok: true, fileName: 'Budget.xlsx', displayPath: 'Tables/Budget.xlsx' });
  });

  it('reports a write failure instead of claiming success', async () => {
    const { app } = vaultApp([], 'permission denied');
    const result = await writeExportToVault(app, tableFile(), artifact);
    expect(result).toEqual({ ok: false, error: 'Could not write into the vault: permission denied' });
  });
});

describe('the vault tier is last and opt-in (SAD-350 round 2)', () => {
  it('is used only after the shared folder fails', async () => {
    const saveToFallbackFolder = vi.fn(async () => ({ ok: false as const, error: 'folder denied' }));
    const saveToVault = vi.fn(async () => ({ ok: true as const, fileName: 'Budget.csv', displayPath: 'Tables/Budget.csv' }));
    const runtime: ExportSaveRuntime = { isMobile: true, mobilePlatform: 'android', saveToFallbackFolder, saveToVault };

    const result = await saveExportArtifact(artifact, runtime);
    expect(saveToFallbackFolder).toHaveBeenCalledOnce();
    expect(saveToVault).toHaveBeenCalledWith(artifact);
    expect(result).toEqual({ ok: true, method: 'vault', fileName: 'Budget.csv', displayPath: 'Tables/Budget.csv' });
  });

  it('never runs when the shared folder works', async () => {
    const saveToVault = vi.fn();
    const runtime: ExportSaveRuntime = {
      isMobile: true,
      mobilePlatform: 'android',
      saveToFallbackFolder: vi.fn(async () => ({ ok: true as const, fileName: 'Budget.csv', displayPath: 'Download/Tablify/Budget.csv' })),
      saveToVault,
    };
    await saveExportArtifact(artifact, runtime);
    expect(saveToVault).not.toHaveBeenCalled();
  });

  it('never changes a desktop export: the download still wins', async () => {
    const downloadFile = vi.fn();
    const saveToVault = vi.fn();
    const runtime: ExportSaveRuntime = { isMobile: false, downloadFile, saveToVault };
    const result = await saveExportArtifact(artifact, runtime);
    expect(result).toEqual({ ok: true, method: 'download', fileName: 'Budget.csv' });
    expect(saveToVault).not.toHaveBeenCalled();
  });

  it('names the vault path when it is the tier that saved the file', async () => {
    const saveToVault = vi.fn(async () => ({ ok: false as const, error: 'no free name' }));
    const runtime: ExportSaveRuntime = { isMobile: true, mobilePlatform: 'android', saveToVault };
    const result = await saveExportArtifact(artifact, runtime);
    expect(result).toEqual({
      ok: false,
      error: 'No supported save or download method is available. no free name',
    });
  });
});

describe('the setting drives the modal (SAD-350 round 2)', () => {
  function androidWithoutNativeDestination(): void {
    Platform.isMobile = true;
    Platform.isIosApp = false;
    Platform.isAndroidApp = true;
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: vi.fn(async () => {
        const error = new Error('The user aborted a request.');
        error.name = 'AbortError';
        throw error;
      }),
      configurable: true,
    });
  }

  function app(): App {
    const instance = new App();
    const workspace = instance.workspace as unknown as { activeLeaf: unknown; getLeavesOfType: () => unknown[] };
    workspace.activeLeaf = null;
    workspace.getLeavesOfType = vi.fn(() => []);
    (instance.vault as unknown as { read: () => Promise<string> }).read = async () => serialize(makeFile(2));
    return instance;
  }

  it('writes into the vault when the setting is on and nothing else works', async () => {
    androidWithoutNativeDestination();
    setExportPreferences(() => ({ vaultFallback: true }));
    const instance = app();
    const writes: string[] = [];
    (instance.vault as unknown as { getAbstractFileByPath: () => null; create: (p: string) => Promise<TFile> }).getAbstractFileByPath = () => null;
    (instance.vault as unknown as { create: (p: string, d: string) => Promise<TFile> }).create = async (path: string) => {
      writes.push(path);
      return new TFile(path);
    };

    openExportModal(instance, tableFile());
    await new Promise((r) => setTimeout(r, 0));
    Modal.opened.at(-1)?.contentEl.querySelector('button')?.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(writes).toEqual(['Tables/Budget.csv']);
    expect(Notice.messages.at(-1)).toBe('Saved Budget.csv (2 rows, 11 columns) to the vault at Tables/Budget.csv.');
  });

  it('stays off by default: no vault write, an honest error instead', async () => {
    androidWithoutNativeDestination();
    const instance = app();
    const create = vi.fn();
    (instance.vault as unknown as { create: unknown }).create = create;

    openExportModal(instance, tableFile());
    await new Promise((r) => setTimeout(r, 0));
    Modal.opened.at(-1)?.contentEl.querySelector('button')?.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(create).not.toHaveBeenCalled();
    expect(Notice.messages.at(-1)).toBe(
      'Export failed. No file was saved. No supported save or download method is available. The system save dialog did not open on this device.',
    );
  });
});
