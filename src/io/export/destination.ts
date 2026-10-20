/**
 * Deliver an export outside the vault. Prefer a system save picker (starting in Downloads),
 * then the mobile share sheet, then a browser/Electron download. No path is written into the vault.
 */

export interface ExportArtifact {
  fileName: string;
  mimeType: string;
  data: string | ArrayBuffer;
}

export interface SaveFileHandle {
  readonly name?: string;
  createWritable(): Promise<SaveFileWriter>;
}

export interface SaveFileWriter {
  write(data: string | ArrayBuffer | Blob): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

export interface SaveFilePickerOptions {
  suggestedName: string;
  startIn?: 'downloads';
  excludeAcceptAllOption?: boolean;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

export interface ExportSaveRuntime {
  isMobile: boolean;
  showSaveFilePicker?: (options: SaveFilePickerOptions) => Promise<SaveFileHandle>;
  createFile?: (artifact: ExportArtifact) => File;
  canShareFile?: (file: File) => boolean;
  shareFile?: (file: File) => Promise<void>;
  downloadFile?: (blob: Blob, fileName: string) => void;
}

export type ExportPickerStart =
  | { kind: 'handle'; handle: SaveFileHandle }
  | { kind: 'unavailable' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: string };

export type ExportSaveResult =
  | { ok: true; method: 'picker' | 'share' | 'download'; fileName: string }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled?: false; error: string };

/**
 * Start the native picker immediately from the Export button's click handler, before file reads
 * and XLSX generation can consume the browser's transient user activation.
 */
export function beginExportSave(
  fileName: string,
  mimeType: string,
  runtime: ExportSaveRuntime,
): Promise<ExportPickerStart> {
  if (!runtime.showSaveFilePicker) return Promise.resolve({ kind: 'unavailable' });

  const extension = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
  const options: SaveFilePickerOptions = {
    suggestedName: fileName,
    startIn: 'downloads',
    excludeAcceptAllOption: true,
    types: [{ description: descriptionFor(mimeType), accept: { [mimeType]: [extension] } }],
  };

  try {
    return runtime.showSaveFilePicker(options).then(
      (handle) => ({ kind: 'handle', handle }),
      (error: unknown) =>
        isAbortError(error) ? { kind: 'cancelled' } : { kind: 'failed', error: errorMessage(error) },
    );
  } catch (error) {
    return Promise.resolve(
      isAbortError(error) ? { kind: 'cancelled' } : { kind: 'failed', error: errorMessage(error) },
    );
  }
}

/** Save a prepared artifact to the selected handle, share sheet, or download fallback. */
export async function saveExportArtifact(
  artifact: ExportArtifact,
  runtime: ExportSaveRuntime,
  pickerStart: Promise<ExportPickerStart> = Promise.resolve({ kind: 'unavailable' }),
): Promise<ExportSaveResult> {
  const picker = await pickerStart;
  if (picker.kind === 'cancelled') return { ok: false, cancelled: true };

  if (picker.kind === 'handle') {
    try {
      const writer = await picker.handle.createWritable();
      try {
        await writer.write(artifact.data);
        await writer.close();
      } catch (error) {
        try {
          await writer.abort?.();
        } catch {
          // Preserve the original write/close error.
        }
        throw error;
      }
      return { ok: true, method: 'picker', fileName: picker.handle.name || artifact.fileName };
    } catch (error) {
      return { ok: false, error: `Could not save the file: ${errorMessage(error)}` };
    }
  }

  // SAD-350: collect every skipped/failed method so a final failure names its real causes
  // instead of pretending an unavailable destination worked.
  const reasons: string[] = [];
  if (picker.kind === 'failed') reasons.push(`Save picker failed: ${picker.error}.`);

  if (runtime.isMobile && runtime.createFile && runtime.canShareFile && runtime.shareFile) {
    try {
      const file = runtime.createFile(artifact);
      if (runtime.canShareFile(file)) {
        await runtime.shareFile(file);
        return { ok: true, method: 'share', fileName: file.name || artifact.fileName };
      }
      reasons.push('The system cannot share this file type.');
    } catch (error) {
      if (isAbortError(error)) return { ok: false, cancelled: true };
      reasons.push(`Share failed: ${errorMessage(error)}.`);
    }
  }

  // SAD-350: desktop only. The anchor-click blob download is a silent no-op in mobile WebViews
  // (iOS WKWebView and Android System WebView ignore it without throwing), so running it there
  // reported "Download started" while writing nothing — the root cause of the mobile bug.
  if (!runtime.isMobile && runtime.downloadFile) {
    try {
      const blob = new Blob([artifact.data], { type: artifact.mimeType });
      runtime.downloadFile(blob, artifact.fileName);
      return { ok: true, method: 'download', fileName: artifact.fileName };
    } catch (error) {
      return { ok: false, error: `Could not start the download: ${errorMessage(error)}` };
    }
  }

  const detail = reasons.length > 0 ? ` ${reasons.join(' ')}` : '';
  return { ok: false, error: `No supported save or download method is available.${detail}` };
}

/** Build platform capabilities lazily so tests can supply deterministic implementations. */
export function browserExportSaveRuntime(isMobile: boolean): ExportSaveRuntime {
  const win = window as Window & { showSaveFilePicker?: ExportSaveRuntime['showSaveFilePicker'] };
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  const runtime: ExportSaveRuntime = {
    isMobile,
    downloadFile(blob, fileName) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
  };

  if (typeof win.showSaveFilePicker === 'function') {
    runtime.showSaveFilePicker = win.showSaveFilePicker.bind(win);
  }
  if (typeof File !== 'undefined') {
    runtime.createFile = (artifact) => new File([artifact.data], artifact.fileName, { type: artifact.mimeType });
  }
  const canShare = nav.canShare;
  if (typeof canShare === 'function') runtime.canShareFile = (file) => canShare.call(nav, { files: [file] });
  const share = nav.share;
  if (typeof share === 'function') runtime.shareFile = (file) => share.call(nav, { files: [file], title: file.name });
  return runtime;
}

function descriptionFor(mimeType: string): string {
  if (mimeType === 'text/csv') return 'CSV file';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'Excel workbook';
  return 'Markdown file';
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && (error as { name?: unknown }).name === 'AbortError';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
