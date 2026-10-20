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
  /** Desktop-only (SAD-350): mobile WebViews ignore anchor downloads without throwing. */
  downloadFile?: (blob: Blob, fileName: string) => void;
  /**
   * SAD-350 Android fallback: write to a shared folder through the Capacitor Filesystem
   * bridge the Obsidian mobile app exposes. Only used when no system save dialog or share
   * sheet is available (Android WebView has no Web Share API, and its File System Access
   * support depends on the WebView/host-app combination).
   */
  saveToFallbackFolder?: (artifact: ExportArtifact) => Promise<FolderSave>;
}

export type FolderSave =
  | { ok: true; fileName: string; displayPath: string }
  | { ok: false; error: string };

export type ExportPickerStart =
  | { kind: 'handle'; handle: SaveFileHandle }
  | { kind: 'unavailable' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: string };

export type ExportSaveResult =
  | { ok: true; method: 'picker' | 'share' | 'download' | 'folder'; fileName: string; displayPath?: string }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled?: false; error: string };

/**
 * SAD-350: how an export leaves the device, decided from the runtime's actual capabilities.
 * 'picker' — system save dialog (desktop Electron; Android WebViews that surface the File
 * System Access API). 'share' — system sheet with the file attached (iOS "Save to Files";
 * Android WebView has no Web Share API, so it never resolves to 'share'). 'folder' — Android
 * fallback write to a shared folder via the Capacitor bridge. 'download' — desktop-only
 * anchor download. 'none' — nothing available; callers must report an error.
 */
export type ExportDeliveryMethod = 'picker' | 'share' | 'folder' | 'download' | 'none';

export function exportDeliveryMethod(runtime: ExportSaveRuntime): ExportDeliveryMethod {
  if (runtime.showSaveFilePicker) return 'picker';
  if (runtime.isMobile && runtime.createFile && runtime.canShareFile && runtime.shareFile) return 'share';
  if (runtime.isMobile && runtime.saveToFallbackFolder) return 'folder';
  if (!runtime.isMobile && runtime.downloadFile) return 'download';
  return 'none';
}

/** Outcome of handing a file to the system sheet. 'activation' = WebKit refused because the
 * user's tap was already spent (NotAllowedError) — callers may retry from a fresh tap. */
export type ShareAttempt =
  | { ok: true; fileName: string }
  | { ok: false; kind: 'cancelled' | 'activation' | 'unsupported' | 'failed'; error: string };

/**
 * SAD-350: give a finished artifact to the system share sheet (iOS "Save to Files").
 * `runtime.shareFile` requires transient user activation, so call this while the user's tap is
 * still on the stack — everything up to the shareFile call runs synchronously.
 */
export async function shareExportArtifact(artifact: ExportArtifact, runtime: ExportSaveRuntime): Promise<ShareAttempt> {
  if (!runtime.createFile || !runtime.canShareFile || !runtime.shareFile) {
    return { ok: false, kind: 'unsupported', error: 'File sharing is not available on this device.' };
  }
  try {
    const file = runtime.createFile(artifact);
    if (!runtime.canShareFile(file)) {
      return { ok: false, kind: 'unsupported', error: 'The system cannot share this file type.' };
    }
    await runtime.shareFile(file);
    return { ok: true, fileName: file.name || artifact.fileName };
  } catch (error) {
    if (isAbortError(error)) return { ok: false, kind: 'cancelled', error: errorMessage(error) };
    if (isNotAllowedError(error)) return { ok: false, kind: 'activation', error: errorMessage(error) };
    return { ok: false, kind: 'failed', error: errorMessage(error) };
  }
}

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
    const shared = await shareExportArtifact(artifact, runtime);
    if (shared.ok) return { ok: true, method: 'share', fileName: shared.fileName };
    if (shared.kind === 'cancelled') return { ok: false, cancelled: true };
    reasons.push(shared.kind === 'unsupported' ? shared.error : `Share failed: ${shared.error}.`);
  }

  // SAD-350 Android fallback: no dialog or sheet available — write to a shared folder and
  // tell the user exactly where the file is.
  if (runtime.isMobile && runtime.saveToFallbackFolder) {
    const saved = await runtime.saveToFallbackFolder(artifact);
    if (saved.ok) return { ok: true, method: 'folder', fileName: saved.fileName, displayPath: saved.displayPath };
    reasons.push(saved.error);
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

/**
 * SAD-350: the subset of the Capacitor Filesystem bridge the Android fallback uses. The
 * Obsidian mobile app exposes it as `window.Capacitor.Plugins.Filesystem`; absent on desktop.
 */
export interface CapacitorFilesystemBridge {
  writeFile(options: {
    path: string;
    data: string;
    directory: string;
    encoding?: string;
    recursive?: boolean;
  }): Promise<{ uri?: string } | undefined>;
  getUri?(options: { path: string; directory: string }): Promise<{ uri?: string } | undefined>;
  /** Resolves when the path exists, rejects when it does not — used to never overwrite. */
  stat?(options: { path: string; directory: string }): Promise<unknown>;
}

/** Shared folder the Android fallback writes into (relative to the chosen base directory). */
export const FALLBACK_EXPORT_FOLDER = 'Download/Tablify';

/**
 * Allowed base directories differ per Android version (scoped storage): EXTERNAL_STORAGE
 * succeeds through Android 10, the later entries cover 11+. First success wins — the same
 * field-proven chain the Single HTML Export community plugin uses inside Obsidian mobile.
 */
const FALLBACK_DIRECTORIES = ['EXTERNAL_STORAGE', 'EXTERNAL', 'DOCUMENTS'] as const;

/** Write an export through the Capacitor bridge without ever overwriting an existing file. */
export async function writeToCapacitorFolder(
  bridge: CapacitorFilesystemBridge,
  folder: string,
  artifact: ExportArtifact,
): Promise<FolderSave> {
  const isText = typeof artifact.data === 'string';
  const payload = isText ? (artifact.data as string) : arrayBufferToBase64(artifact.data as ArrayBuffer);
  const failures: string[] = [];
  for (const directory of FALLBACK_DIRECTORIES) {
    try {
      const fileName = await freeFallbackName(bridge, folder, artifact.fileName, directory);
      const path = `${folder}/${fileName}`;
      const written = await bridge.writeFile({
        path,
        data: payload,
        directory,
        ...(isText ? { encoding: 'utf8' } : {}),
        recursive: true,
      });
      const uri = written?.uri ?? (await bridge.getUri?.({ path, directory }))?.uri;
      return { ok: true, fileName, displayPath: uri ? displayPathOf(uri) : path };
    } catch (error) {
      failures.push(`${directory}: ${errorMessage(error)}`);
    }
  }
  return { ok: false, error: `Could not write to a shared folder. ${failures.join(' / ')}` };
}

/** First free name: base, then "base 2", "base 3", … Timestamp when existence can't be probed. */
async function freeFallbackName(
  bridge: CapacitorFilesystemBridge,
  folder: string,
  fileName: string,
  directory: string,
): Promise<string> {
  const dot = fileName.lastIndexOf('.');
  const base = dot === -1 ? fileName : fileName.slice(0, dot);
  const ext = dot === -1 ? '' : fileName.slice(dot);
  const stat = bridge.stat;
  if (!stat) {
    // No way to check for collisions — a unique name is safer than a silent overwrite.
    const stamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    return `${base} ${stamp}${ext}`;
  }
  const exists = async (candidate: string): Promise<boolean> => {
    try {
      await stat.call(bridge, { path: `${folder}/${candidate}`, directory });
      return true;
    } catch {
      return false;
    }
  };
  if (!(await exists(fileName))) return fileName;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} ${n}${ext}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base} ${Date.now()}${ext}`;
}

/** `file:///storage/emulated/0/Download/Tablify/A%20b.csv` → `Download/Tablify/A b.csv`. */
function displayPathOf(uri: string): string {
  let path = uri.replace(/^file:\/\//, '');
  try {
    path = decodeURIComponent(path);
  } catch {
    // Keep the encoded form rather than fail the notice.
  }
  return path.replace(/^\/storage\/emulated\/0\//, '').replace(/^\/sdcard\//, '');
}

/** Base64 for Capacitor binary writes, chunked so large workbooks don't overflow the stack. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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

  // SAD-350 Android fallback: the Capacitor Filesystem bridge the Obsidian mobile app exposes.
  const bridge = (window as Window & { Capacitor?: { Plugins?: { Filesystem?: CapacitorFilesystemBridge } } })
    .Capacitor?.Plugins?.Filesystem;
  if (isMobile && typeof bridge?.writeFile === 'function') {
    runtime.saveToFallbackFolder = (artifact) => writeToCapacitorFolder(bridge, FALLBACK_EXPORT_FOLDER, artifact);
  }
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

/** WebKit rejects navigator.share with NotAllowedError when transient user activation is gone. */
function isNotAllowedError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && (error as { name?: unknown }).name === 'NotAllowedError';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
