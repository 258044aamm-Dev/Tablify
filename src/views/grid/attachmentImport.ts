/**
 * SAD-356 — bringing a file from the device into the vault.
 *
 * Two independent pieces, both free of Obsidian imports so they run in jsdom/node:
 *
 *  - `pickFileFromDevice()` — a real `<input type="file">`, and an honest answer when a WebView
 *    never opens a chooser. `unavailable` is that answer: the caller (the cell menu) then leaves the
 *    user on the path/URL entry instead of a button that silently did nothing.
 *  - `importPickedFile()` — copies the picked `File` into the vault through Obsidian's own attachment
 *    folder (`FileManager.getAvailablePathForAttachment`) and returns the vault-relative path the
 *    cell stores. The vault calls are injected (`AttachmentVaultIo`), the same shape
 *    `attachment.ts` uses for `VaultLike`, so the rules are testable without a vault.
 *
 * Nothing here touches the .tablify format: the cell keeps one vault-relative path string.
 */

import { normalizeAttachmentPath } from './attachment.js';

export interface AttachmentTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type PickOutcome =
  | { kind: 'file'; file: File }
  | { kind: 'cancelled' }
  /** No chooser ever appeared (some WebViews) — the caller shows the fallback message. */
  | { kind: 'unavailable' };

export interface PickFileOptions {
  accept?: string;
  doc?: Document;
  /** How long to wait before a silent WebView is called `unavailable`. */
  noChooserMs?: number;
  timers?: AttachmentTimers;
}

/**
 * How long a click waits for the chooser to announce itself. A real dialog answers with `change`
 * (a file was picked) or `cancel` (it was dismissed); a WebView that cannot open one answers with
 * nothing at all, which is what this clock turns into an answer.
 */
export const NO_CHOOSER_MS = 1500;

/**
 * Ask the device for one file. Always resolves — never rejects, and never leaves the temporary
 * input in the DOM.
 */
export function pickFileFromDevice(options: PickFileOptions = {}): Promise<PickOutcome> {
  const doc = options.doc ?? document;
  const timers = options.timers ?? {
    setTimeout: (fn: () => void, ms: number): unknown => setTimeout(fn, ms),
    clearTimeout: (handle: unknown): void => clearTimeout(handle as number),
  };
  const noChooserMs = options.noChooserMs ?? NO_CHOOSER_MS;

  return new Promise<PickOutcome>((resolve) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.multiple = false;
    if (options.accept) input.accept = options.accept;
    // Off-screen but connected: some WebViews ignore a click on a detached input.
    input.style.position = 'fixed';
    input.style.left = '-1000px';
    input.style.width = '1px';
    input.style.height = '1px';
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');

    let settled = false;
    let timer: unknown = null;
    const win = doc.defaultView;

    const cleanup = (outcome: PickOutcome): void => {
      if (settled) return;
      settled = true;
      if (timer !== null) timers.clearTimeout(timer);
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      win?.removeEventListener('blur', onBlur);
      input.remove();
      resolve(outcome);
    };

    const onChange = (): void => {
      const file = input.files?.[0] ?? null;
      cleanup(file ? { kind: 'file', file } : { kind: 'cancelled' });
    };

    // Chromium 113+ and WebKit fire `cancel` when the user dismisses the dialog.
    const onCancel = (): void => cleanup({ kind: 'cancelled' });

    // A native chooser takes the window's focus: stop the "nothing happened" clock while it is away.
    const onBlur = (): void => {
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
    };

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    win?.addEventListener('blur', onBlur, { once: true });
    doc.body.appendChild(input);
    timer = timers.setTimeout(() => cleanup({ kind: 'unavailable' }), noChooserMs);
    // Clicked from inside the caller's own click handler, so the browser's user activation holds.
    input.click();
  });
}

/** The subset of the Obsidian vault this module needs. Injected by the host view. */
export interface AttachmentVaultIo {
  /**
   * `FileManager.getAvailablePathForAttachment` — resolves a unique path in the folder the user
   * chose in *Settings → Files and links*, and dedupes the filename. Optional: without it the
   * fallback below picks a free path instead of failing.
   */
  getAvailablePathForAttachment?(filename: string, sourcePath?: string): Promise<string>;
  createBinary(path: string, data: ArrayBuffer): Promise<unknown>;
  getAbstractFileByPath(path: string): unknown | null;
}

export type ImportOutcome =
  | { ok: true; path: string }
  | { ok: false; reason: 'failed'; message: string };

/** A name a vault path can carry: no separators, no characters Obsidian refuses on any platform. */
export function sanitizeAttachmentFileName(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[<>:"|?*\u0000-\u001F]/g, '').trim();
  return cleaned === '' || cleaned === '.' || cleaned === '..' ? 'attachment' : cleaned;
}

/** `photo.png` → `photo 1.png` → `photo 2.png`, inside `folder` ('' = vault root). */
export function uniqueAttachmentPath(
  name: string,
  folder: string,
  exists: (path: string) => boolean,
): string {
  const dir = folder.replace(/^\/+|\/+$/g, '');
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  const join = (n: string): string => (dir ? `${dir}/${n}` : n);
  let candidate = join(name);
  for (let i = 1; exists(candidate); i += 1) candidate = join(`${stem} ${i}${ext}`);
  return candidate;
}

/**
 * Copy `file` into the vault and return the path to store.
 *
 * Obsidian decides the folder (`getAvailablePathForAttachment`, which also dedupes); the fallback
 * keeps the same behaviour where that API is not available, and never overwrites a file.
 *
 * Never throws: a failure is `{ ok: false }` with a sentence the cell panel can show as it is.
 */
export async function importPickedFile(
  file: File,
  io: AttachmentVaultIo,
  sourcePath = '',
): Promise<ImportOutcome> {
  const name = sanitizeAttachmentFileName(file.name);
  try {
    const target = io.getAvailablePathForAttachment
      ? normalizeAttachmentPath(await io.getAvailablePathForAttachment(name, sourcePath))
      : uniqueAttachmentPath(name, '', (p) => io.getAbstractFileByPath(p) !== null);
    if (!target) {
      return { ok: false, reason: 'failed', message: 'Could not find a place in the vault for that file.' };
    }
    await io.createBinary(target, await file.arrayBuffer());
    return { ok: true, path: target };
  } catch (e) {
    return {
      ok: false,
      reason: 'failed',
      message: `Could not copy that file into the vault: ${(e as Error).message}`,
    };
  }
}
