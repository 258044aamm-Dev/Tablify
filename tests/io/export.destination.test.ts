import { describe, it, expect, vi } from 'vitest';
import {
  arrayBufferToBase64,
  beginExportSave,
  exportDeliveryMethod,
  saveExportArtifact,
  writeToCapacitorFolder,
  type CapacitorFilesystemBridge,
  type ExportArtifact,
  type ExportSaveRuntime,
  type SaveFileHandle,
  type SaveFileWriter,
} from '../../src/io/export/destination.js';

const artifact: ExportArtifact = {
  fileName: 'Budget.csv',
  mimeType: 'text/csv',
  data: 'Name,Amount\r\nAlpha,12\r\n',
};

function abortError(): Error {
  const error = new Error('User cancelled');
  error.name = 'AbortError';
  return error;
}

describe('export destination', () => {
  it('starts a save picker in Downloads with the requested name and type', async () => {
    const handle: SaveFileHandle = {
      name: 'Budget.csv',
      createWritable: async () => ({ write: vi.fn(), close: vi.fn() }),
    };
    const showSaveFilePicker = vi.fn(async () => handle);
    const runtime: ExportSaveRuntime = { isMobile: false, showSaveFilePicker };

    const started = await beginExportSave('Budget.csv', 'text/csv', runtime);
    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: 'Budget.csv',
      startIn: 'downloads',
      excludeAcceptAllOption: true,
      types: [{ description: 'CSV file', accept: { 'text/csv': ['.csv'] } }],
    });
    expect(started).toEqual({ kind: 'handle', handle });
  });

  it('writes the prepared artifact to the selected handle and closes it', async () => {
    const writer: SaveFileWriter = { write: vi.fn(async () => undefined), close: vi.fn(async () => undefined) };
    const handle: SaveFileHandle = { name: 'Chosen.csv', createWritable: vi.fn(async () => writer) };
    const runtime: ExportSaveRuntime = { isMobile: false };

    const result = await saveExportArtifact(artifact, runtime, Promise.resolve({ kind: 'handle', handle }));
    expect(writer.write).toHaveBeenCalledWith(artifact.data);
    expect(writer.close).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, method: 'picker', fileName: 'Chosen.csv' });
  });

  it('treats picker cancellation as cancellation and does not fall back to a download', async () => {
    const runtime: ExportSaveRuntime = { isMobile: false, downloadFile: vi.fn() };
    const result = await saveExportArtifact(artifact, runtime, Promise.resolve({ kind: 'cancelled' }));
    expect(result).toEqual({ ok: false, cancelled: true });
    expect(runtime.downloadFile).not.toHaveBeenCalled();
  });

  it('uses the system share sheet for a shareable mobile file', async () => {
    const file = { name: artifact.fileName } as File;
    const shareFile = vi.fn(async () => undefined);
    const runtime: ExportSaveRuntime = {
      isMobile: true,
      createFile: vi.fn(() => file),
      canShareFile: vi.fn(() => true),
      shareFile,
      downloadFile: vi.fn(),
    };

    const result = await saveExportArtifact(artifact, runtime);
    expect(runtime.createFile).toHaveBeenCalledWith(artifact);
    expect(runtime.canShareFile).toHaveBeenCalledWith(file);
    expect(shareFile).toHaveBeenCalledWith(file);
    expect(runtime.downloadFile).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, method: 'share', fileName: artifact.fileName });
  });

  it('uses a browser download when no save picker or mobile share is available', async () => {
    const downloadFile = vi.fn();
    const runtime: ExportSaveRuntime = { isMobile: false, downloadFile };
    const result = await saveExportArtifact(artifact, runtime);
    expect(downloadFile).toHaveBeenCalledWith(expect.any(Blob), artifact.fileName);
    expect(result).toEqual({ ok: true, method: 'download', fileName: artifact.fileName });
  });

  it('falls back to download if the platform picker is unavailable, but not if the user cancels', async () => {
    const downloadFile = vi.fn();
    const runtime: ExportSaveRuntime = {
      isMobile: false,
      showSaveFilePicker: vi.fn(async () => {
        throw new Error('picker is unavailable');
      }),
      downloadFile,
    };
    const failedPicker = await beginExportSave(artifact.fileName, artifact.mimeType, runtime);
    const result = await saveExportArtifact(artifact, runtime, Promise.resolve(failedPicker));
    expect(downloadFile).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, method: 'download', fileName: artifact.fileName });

    const cancelledPicker = await beginExportSave(artifact.fileName, artifact.mimeType, {
      ...runtime,
      showSaveFilePicker: async () => {
        throw abortError();
      },
    });
    expect(cancelledPicker).toEqual({ kind: 'cancelled' });
  });

  it('never claims a download on mobile: the anchor fallback is a silent no-op in mobile WebViews (SAD-350)', async () => {
    const downloadFile = vi.fn();
    const runtime: ExportSaveRuntime = { isMobile: true, downloadFile };
    const result = await saveExportArtifact(artifact, runtime);
    expect(downloadFile).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'No supported save or download method is available.' });
  });

  it('reports why each mobile method failed instead of a false download success (SAD-350)', async () => {
    const downloadFile = vi.fn();
    const runtime: ExportSaveRuntime = {
      isMobile: true,
      createFile: vi.fn(() => ({ name: artifact.fileName }) as File),
      canShareFile: vi.fn(() => true),
      shareFile: vi.fn(async () => {
        const error = new Error('User activation is required');
        error.name = 'NotAllowedError';
        throw error;
      }),
      downloadFile,
    };
    const result = await saveExportArtifact(artifact, runtime, Promise.resolve({ kind: 'failed', error: 'no picker UI' }));
    expect(downloadFile).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: 'No supported save or download method is available. Save picker failed: no picker UI. Share failed: User activation is required.',
    });
  });

  it('still treats a mobile share abort as cancellation, not an error (SAD-350)', async () => {
    const runtime: ExportSaveRuntime = {
      isMobile: true,
      createFile: vi.fn(() => ({ name: artifact.fileName }) as File),
      canShareFile: vi.fn(() => true),
      shareFile: vi.fn(async () => {
        throw abortError();
      }),
      downloadFile: vi.fn(),
    };
    const result = await saveExportArtifact(artifact, runtime);
    expect(result).toEqual({ ok: false, cancelled: true });
    expect(runtime.downloadFile).not.toHaveBeenCalled();
  });

  it('picks the delivery method from actual capabilities (SAD-350)', () => {
    const picker: ExportSaveRuntime['showSaveFilePicker'] = vi.fn();
    const share = {
      createFile: vi.fn(),
      canShareFile: vi.fn(),
      shareFile: vi.fn(),
    };
    const folder = { saveToFallbackFolder: vi.fn() };
    expect(exportDeliveryMethod({ isMobile: false, showSaveFilePicker: picker })).toBe('picker');
    expect(exportDeliveryMethod({ isMobile: true, showSaveFilePicker: picker, ...share, ...folder })).toBe('picker');
    expect(exportDeliveryMethod({ isMobile: true, ...share, ...folder })).toBe('share');
    expect(exportDeliveryMethod({ isMobile: true, ...folder })).toBe('folder');
    expect(exportDeliveryMethod({ isMobile: false, downloadFile: vi.fn() })).toBe('download');
    expect(exportDeliveryMethod({ isMobile: true, downloadFile: vi.fn() })).toBe('none');
    expect(exportDeliveryMethod({ isMobile: false, ...share, ...folder })).toBe('none');
  });

  it('saves through the Android fallback folder and reports the real path (SAD-350)', async () => {
    const runtime: ExportSaveRuntime = {
      isMobile: true,
      saveToFallbackFolder: vi.fn(async () => ({
        ok: true as const,
        fileName: 'Budget.csv',
        displayPath: 'Download/Tablify/Budget.csv',
      })),
    };
    const result = await saveExportArtifact(artifact, runtime);
    expect(runtime.saveToFallbackFolder).toHaveBeenCalledWith(artifact);
    expect(result).toEqual({
      ok: true,
      method: 'folder',
      fileName: 'Budget.csv',
      displayPath: 'Download/Tablify/Budget.csv',
    });
  });

  it('surfaces the fallback-folder failure instead of claiming success (SAD-350)', async () => {
    const runtime: ExportSaveRuntime = {
      isMobile: true,
      saveToFallbackFolder: vi.fn(async () => ({ ok: false as const, error: 'Could not write to a shared folder. denied' })),
    };
    const result = await saveExportArtifact(artifact, runtime);
    expect(result).toEqual({
      ok: false,
      error: 'No supported save or download method is available. Could not write to a shared folder. denied',
    });
  });

  it('aborts a failed write and returns a visible error instead of silently using another destination', async () => {
    const writer: SaveFileWriter = {
      write: vi.fn(async () => {
        throw new Error('disk full');
      }),
      close: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined),
    };
    const handle: SaveFileHandle = { createWritable: async () => writer };
    const runtime: ExportSaveRuntime = { isMobile: false, downloadFile: vi.fn() };

    const result = await saveExportArtifact(artifact, runtime, Promise.resolve({ kind: 'handle', handle }));
    expect(writer.abort).toHaveBeenCalledOnce();
    expect(runtime.downloadFile).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'Could not save the file: disk full' });
  });
});

/** A fake Capacitor Filesystem bridge: `existing` paths resolve on stat, others reject. */
function fakeBridge(options: {
  existing?: string[];
  failDirs?: string[];
  stat?: boolean;
  uri?: (path: string) => string | undefined;
}): CapacitorFilesystemBridge & { writes: Array<{ path: string; data: string; directory: string; encoding?: string }> } {
  const existing = new Set(options.existing ?? []);
  const failDirs = new Set(options.failDirs ?? []);
  const writes: Array<{ path: string; data: string; directory: string; encoding?: string }> = [];
  const bridge: CapacitorFilesystemBridge & { writes: typeof writes } = {
    writes,
    async writeFile(opts) {
      if (failDirs.has(opts.directory)) throw new Error(`${opts.directory} is not allowed`);
      writes.push({ path: opts.path, data: opts.data, directory: opts.directory, encoding: opts.encoding });
      const uri = options.uri?.(opts.path);
      return uri === undefined ? {} : { uri };
    },
  };
  if (options.stat !== false) {
    bridge.stat = async ({ path }) => {
      if (existing.has(path)) return {};
      throw new Error('File does not exist');
    };
  }
  return bridge;
}

const csvArtifact: ExportArtifact = {
  fileName: 'Budget.csv',
  mimeType: 'text/csv',
  data: '\uFEFFName,Amount\r\nAlpha,12\r\n',
};

describe('Android fallback folder writer (SAD-350)', () => {
  it('writes text with utf8 encoding into the first allowed directory, keeping the BOM', async () => {
    const bridge = fakeBridge({ uri: (p) => `file:///storage/emulated/0/${p}` });
    const saved = await writeToCapacitorFolder(bridge, 'Download/Tablify', csvArtifact);
    expect(bridge.writes).toEqual([
      {
        path: 'Download/Tablify/Budget.csv',
        data: csvArtifact.data,
        directory: 'EXTERNAL_STORAGE',
        encoding: 'utf8',
      },
    ]);
    expect(saved).toEqual({ ok: true, fileName: 'Budget.csv', displayPath: 'Download/Tablify/Budget.csv' });
  });

  it('falls through EXTERNAL_STORAGE and EXTERNAL to DOCUMENTS when scoped storage blocks them', async () => {
    const bridge = fakeBridge({ failDirs: ['EXTERNAL_STORAGE', 'EXTERNAL'] });
    const saved = await writeToCapacitorFolder(bridge, 'Download/Tablify', csvArtifact);
    expect(bridge.writes.map((w) => w.directory)).toEqual(['DOCUMENTS']);
    expect(saved).toEqual({ ok: true, fileName: 'Budget.csv', displayPath: 'Download/Tablify/Budget.csv' });
  });

  it('aggregates every directory failure into one honest error', async () => {
    const bridge = fakeBridge({ failDirs: ['EXTERNAL_STORAGE', 'EXTERNAL', 'DOCUMENTS'] });
    const saved = await writeToCapacitorFolder(bridge, 'Download/Tablify', csvArtifact);
    expect(saved).toEqual({
      ok: false,
      error:
        'Could not write to a shared folder. EXTERNAL_STORAGE: EXTERNAL_STORAGE is not allowed / EXTERNAL: EXTERNAL is not allowed / DOCUMENTS: DOCUMENTS is not allowed',
    });
  });

  it('never overwrites: numbered name on collision, timestamped name when stat is unavailable', async () => {
    const colliding = fakeBridge({ existing: ['Download/Tablify/Budget.csv', 'Download/Tablify/Budget 2.csv'] });
    const saved = await writeToCapacitorFolder(colliding, 'Download/Tablify', csvArtifact);
    expect(saved.ok && saved.fileName).toBe('Budget 3.csv');

    const blind = fakeBridge({ stat: false });
    const stamped = await writeToCapacitorFolder(blind, 'Download/Tablify', csvArtifact);
    expect(stamped.ok && stamped.fileName).toMatch(/^Budget \d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);
  });

  it('writes binary artifacts as base64 that decodes back byte-for-byte', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x80, 0x7f]);
    const xlsx: ExportArtifact = {
      fileName: 'Budget.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: bytes.buffer,
    };
    const bridge = fakeBridge({});
    const saved = await writeToCapacitorFolder(bridge, 'Download/Tablify', xlsx);
    expect(saved.ok).toBe(true);
    expect(bridge.writes[0].encoding).toBeUndefined();
    expect(new Uint8Array(Buffer.from(bridge.writes[0].data, 'base64'))).toEqual(bytes);
  });

  it('decodes and shortens the reported path like a file manager shows it', async () => {
    const bridge = fakeBridge({ uri: (p) => `file:///storage/emulated/0/${encodeURI(p)}` });
    const spaced: ExportArtifact = { ...csvArtifact, fileName: 'My Budget.csv' };
    const saved = await writeToCapacitorFolder(bridge, 'Download/Tablify', spaced);
    expect(saved).toEqual({ ok: true, fileName: 'My Budget.csv', displayPath: 'Download/Tablify/My Budget.csv' });
  });
});

describe('arrayBufferToBase64 (SAD-350)', () => {
  it('matches Node base64 for empty, tiny, chunk-boundary and large buffers', () => {
    const sizes = [0, 1, 3, 0x8000 - 1, 0x8000, 0x8000 + 1, 100_000];
    for (const size of sizes) {
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) bytes[i] = (i * 31 + 7) % 256;
      expect(arrayBufferToBase64(bytes.buffer)).toBe(Buffer.from(bytes).toString('base64'));
    }
  });
});

/**
 * SAD-350 round 2 — the reported bug, pinned.
 *
 * On Android, `showSaveFilePicker` exists in the WebView but the host app must implement the
 * save-mode chooser; when it does not, Chromium rejects at once with AbortError and no dialog.
 * Treating that as "cancelled" ended the export before the folder tier that does work.
 */
describe('SAD-350 round 2 — a picker that never opened is not a cancel', () => {
  const instantAbort = async (): Promise<never> => {
    throw abortError();
  };

  it('falls through to the Android shared folder when the picker aborts with no dialog (the reported bug)', async () => {
    const runtime: ExportSaveRuntime = {
      isMobile: true,
      mobilePlatform: 'android',
      showSaveFilePicker: vi.fn(instantAbort),
      saveToFallbackFolder: vi.fn(async () => ({
        ok: true as const,
        fileName: 'Budget.csv',
        displayPath: 'Download/Tablify/Budget.csv',
      })),
    };

    const picker = await beginExportSave(artifact.fileName, artifact.mimeType, runtime);
    expect(picker).toEqual({ kind: 'unavailable', reason: 'The system save dialog did not open on this device.' });

    const saved = await saveExportArtifact(artifact, runtime, Promise.resolve(picker));
    expect(runtime.saveToFallbackFolder).toHaveBeenCalledWith(artifact);
    expect(saved).toEqual({
      ok: true,
      method: 'folder',
      fileName: 'Budget.csv',
      displayPath: 'Download/Tablify/Budget.csv',
    });
  });

  it('keeps the desktop policy: an abort is still a cancellation and never downloads', async () => {
    const downloadFile = vi.fn();
    const runtime: ExportSaveRuntime = {
      isMobile: false,
      showSaveFilePicker: vi.fn(instantAbort),
      downloadFile,
    };

    const picker = await beginExportSave(artifact.fileName, artifact.mimeType, runtime);
    expect(picker).toEqual({ kind: 'cancelled' });
    const result = await saveExportArtifact(artifact, runtime, Promise.resolve(picker));
    expect(result).toEqual({ ok: false, cancelled: true });
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('keeps the iOS policy: a runtime without the Android tag never infers a silent abort', async () => {
    const runtime: ExportSaveRuntime = { isMobile: true, mobilePlatform: 'ios', showSaveFilePicker: vi.fn(instantAbort) };
    expect(await beginExportSave(artifact.fileName, artifact.mimeType, runtime)).toEqual({ kind: 'cancelled' });
  });

  it('names the real reason when nothing can deliver the file', async () => {
    const runtime: ExportSaveRuntime = {
      isMobile: true,
      mobilePlatform: 'android',
      showSaveFilePicker: vi.fn(instantAbort),
    };
    const picker = await beginExportSave(artifact.fileName, artifact.mimeType, runtime);
    const result = await saveExportArtifact(artifact, runtime, Promise.resolve(picker));
    expect(result).toEqual({
      ok: false,
      error:
        'No supported save or download method is available. The system save dialog did not open on this device.',
    });
  });

  it('still calls a slow abort a cancellation, so a real dismissal is never re-saved elsewhere', async () => {
    let clock = 1_000;
    const now = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    try {
      const folder = vi.fn(async () => ({ ok: true as const, fileName: 'Budget.csv', displayPath: 'x' }));
      const runtime: ExportSaveRuntime = {
        isMobile: true,
        mobilePlatform: 'android',
        showSaveFilePicker: vi.fn(async () => {
          clock += 5_000; // far longer than a human needs to dismiss a dialog
          throw abortError();
        }),
        saveToFallbackFolder: folder,
      };
      expect(await beginExportSave(artifact.fileName, artifact.mimeType, runtime)).toEqual({ kind: 'cancelled' });
      expect(folder).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
    }
  });
});
