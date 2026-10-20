import { describe, it, expect, vi } from 'vitest';
import {
  beginExportSave,
  saveExportArtifact,
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
