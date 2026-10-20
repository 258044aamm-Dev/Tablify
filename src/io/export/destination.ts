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

/**
 * SAD-350 round 2: which mobile host this runtime runs in. `null` (the default) keeps the
 * desktop policy — see the AbortError note in beginExportSave().
 */
export type MobilePlatform = 'ios' | 'android' | null;

export interface ExportSaveRuntime {
  isMobile: boolean;
  /** SAD-350 round 2: selects the AbortError policy in beginExportSave(). */
  mobilePlatform?: MobilePlatform;
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
  /**
   * SAD-350 round 2 (opt-in): the last resort when no native destination works — write the
   * export next to the table. Absent unless the user turned on the Export setting, so the
   * default behaviour ("exports never write into the vault") is unchanged.
   */
  saveToVault?: (artifact: ExportArtifact) => Promise<FolderSave>;
}

export type FolderSave =
  | { ok: true; fileName: string; displayPath: string }
  | { ok: false; error: string };

export type ExportPickerStart =
  | { kind: 'handle'; handle: SaveFileHandle }
  /** SAD-350 round 2: no dialog was presented — `reason` names why when one is known. */
  | { kind: 'unavailable'; reason?: string }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: string };

export type ExportSaveResult =
  | { ok: true; method: 'picker' | 'share' | 'download' | 'folder' | 'vault'; fileName: string; displayPath?: string }
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
 * SAD-350 round 2: how long an AbortError may take and still count as "the app never presented a
 * dialog". A person needs longer than this to open and dismiss a system dialog, and a WebView
 * that cancels at once answers in single-digit milliseconds.
 */
export const PICKER_SILENT_ABORT_MS = 1000;

/** What the last picker attempt actually looked like — read by the diagnostics probe. */
export interface PickerAttemptRecord {
  elapsedMs: number;
  /** True when the app lost focus or went hidden: the signal that a real dialog was shown. */
  presented: boolean;
  errorName: string;
  outcome: ExportPickerStart['kind'];
}

let lastPickerAttempt: PickerAttemptRecord | null = null;

/** The most recent picker attempt, for the read-only diagnostics command. `null` before any. */
export function lastExportPickerAttempt(): PickerAttemptRecord | null {
  return lastPickerAttempt;
}

/**
 * Watch for the app losing focus, which is what a native chooser does. Same signal, same
 * reasoning as `pickFileFromDevice()` for `<input type="file">`
 * (src/views/grid/attachmentImport.ts): a WebView that cannot open a chooser answers with
 * nothing at all, so "no focus change" means "no dialog was shown".
 *
 * Enabled for Android only. Elsewhere the result is never consulted, because a silent abort is
 * only ever inferred on Android (beginExportSave).
 */
function watchPickerPresentation(enabled: boolean): { presented(): boolean; stop(): void } {
  const noSignal = { presented: () => false, stop: () => undefined };
  if (!enabled || typeof window === 'undefined') return noSignal;
  let focusedAway = false;
  const mark = (): void => {
    focusedAway = true;
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') focusedAway = true;
  };
  window.addEventListener('blur', mark);
  document.addEventListener('visibilitychange', onVisibility);
  return {
    presented: () => focusedAway,
    stop: () => {
      window.removeEventListener('blur', mark);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}

function errorNameOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return String((error as { name?: unknown }).name);
  }
  return 'Error';
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

  const startedAt = Date.now();
  const watch = watchPickerPresentation(runtime.mobilePlatform === 'android');

  /**
   * SAD-350 round 2: on Android, `showSaveFilePicker` exists in the WebView (M132+) but the
   * host app must implement the save-mode chooser. When it does not, Chromium rejects at once
   * with AbortError and no dialog. Treating that as "cancelled" ended the export before the
   * share/folder tiers that do work — the reported bug. A dialog that was dismissed by the
   * user is still a cancellation, because the app lost focus when it appeared.
   */
  const settle = (error: unknown): ExportPickerStart => {
    const elapsedMs = Date.now() - startedAt;
    const presented = watch.presented();
    watch.stop();
    const errorName = errorNameOf(error);
    if (!isAbortError(error)) {
      lastPickerAttempt = { elapsedMs, presented, errorName, outcome: 'failed' };
      return { kind: 'failed', error: errorMessage(error) };
    }
    const silentAbort =
      runtime.mobilePlatform === 'android' && !presented && elapsedMs <= PICKER_SILENT_ABORT_MS;
    lastPickerAttempt = { elapsedMs, presented, errorName, outcome: silentAbort ? 'unavailable' : 'cancelled' };
    return silentAbort
      ? { kind: 'unavailable', reason: 'The system save dialog did not open on this device.' }
      : { kind: 'cancelled' };
  };

  try {
    return runtime.showSaveFilePicker(options).then<ExportPickerStart, ExportPickerStart>(
      (handle) => {
        watch.stop();
        return { kind: 'handle', handle };
      },
      settle,
    );
  } catch (error) {
    return Promise.resolve(settle(error));
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
  else if (picker.kind === 'unavailable' && picker.reason) reasons.push(picker.reason);

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

  // SAD-350 round 2 (opt-in): every destination above was unavailable or failed. With the
  // Export setting on, write the file next to the table rather than ending with nothing.
  // Deliberately last — after the desktop download — so enabling it can never change a
  // desktop export.
  if (runtime.saveToVault) {
    const saved = await runtime.saveToVault(artifact);
    if (saved.ok) {
      return { ok: true, method: 'vault', fileName: saved.fileName, displayPath: saved.displayPath };
    }
    reasons.push(saved.error);
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
export function browserExportSaveRuntime(
  isMobile: boolean,
  mobilePlatform: MobilePlatform = null,
): ExportSaveRuntime {
  const win = window as Window & { showSaveFilePicker?: ExportSaveRuntime['showSaveFilePicker'] };
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  const runtime: ExportSaveRuntime = {
    isMobile,
    mobilePlatform,
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
