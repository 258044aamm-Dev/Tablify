/**
 * Attachment cell — vault-relative path normalization, existence check, and image resolution.
 */

export function normalizeAttachmentPath(input: string): string {
  let p = input.trim().replace(/\\/g, '/');
  p = p.replace(/^\/+/, '');
  p = p.replace(/\/{2,}/g, '/');
  return p;
}

/**
 * SAD-347: raster and vector image extensions supported for inline per-cell rendering.
 */
export const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'avif',
  'ico',
]);

/**
 * SAD-347: true when `rawPath` is a `data:image/*` URI or has a supported image file extension
 * (case-insensitive, ignoring URL query strings and hash fragments).
 */
export function isImageAttachmentPath(rawPath: string): boolean {
  const trimmed = rawPath.trim();
  if (!trimmed) return false;
  if (/^data:image\/(png|jpe?g|gif|webp|bmp|avif|svg\+xml|x-icon)[;,]/i.test(trimmed)) {
    return true;
  }
  const clean = trimmed.split(/[?#]/, 1)[0] ?? '';
  const dot = clean.lastIndexOf('.');
  if (dot < 0 || dot === clean.length - 1) return false;
  const ext = clean.slice(dot + 1).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * SAD-347: human-readable file name for `alt` attributes and lightbox titles.
 */
export function attachmentFileName(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) return '';
  if (/^data:image\//i.test(trimmed)) return 'Embedded image';
  const clean = (trimmed.split(/[?#]/, 1)[0] ?? '').replace(/\\/g, '/').replace(/\/+$/, '');
  const slash = clean.lastIndexOf('/');
  const base = slash >= 0 ? clean.slice(slash + 1) : clean;
  return base || trimmed;
}

export interface VaultLike {
  getAbstractFileByPath(path: string): unknown | null;
  /** SAD-347: Obsidian Vault.getResourcePath(file: TFile) -> browser resource URI. */
  getResourcePath?(file: unknown): string | null;
  /** SAD-347: fallback to DataAdapter.getResourcePath(normalizedPath). */
  adapter?: {
    getResourcePath?(normalizedPath: string): string | null;
  };
}

/**
 * SAD-347: resolve an attachment path or URL to a browser-renderable image URI.
 *
 * Returns `null` when:
 * - the path is not a supported image format,
 * - a vault-relative path is not found in `vault` or points to a folder (`children` property), or
 * - no resource-path resolver is available on `vault`.
 *
 * Callers fall back to the standard paperclip chip when `null` is returned.
 */
export function resolveAttachmentImageUrl(raw: string, vault?: VaultLike): string | null {
  const trimmed = raw.trim();
  if (!isImageAttachmentPath(trimmed)) return null;
  if (/^data:image\//i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const path = normalizeAttachmentPath(trimmed);
  if (!path || !vault) return null;
  const file = vault.getAbstractFileByPath(path);
  if (file === null || file === undefined) return null;
  // A vault folder (TFolder) has `children` and cannot be rendered as an image.
  if (typeof file === 'object' && 'children' in file) return null;
  if (typeof vault.getResourcePath === 'function') {
    const uri = vault.getResourcePath(file);
    if (typeof uri === 'string' && uri.trim() !== '') return uri;
  }
  if (typeof vault.adapter?.getResourcePath === 'function') {
    const uri = vault.adapter.getResourcePath(path);
    if (typeof uri === 'string' && uri.trim() !== '') return uri;
  }
  return null;
}

export type AttachmentSaveResult =
  | { ok: true; path: string }
  | { ok: false; needsConfirm: true; path: string; message: string };

export function checkAttachmentPath(
  raw: string,
  vault: VaultLike,
): AttachmentSaveResult {
  const path = normalizeAttachmentPath(raw);
  if (path === '') return { ok: true, path: '' };
  const exists = vault.getAbstractFileByPath(path) !== null;
  if (exists) return { ok: true, path };
  return {
    ok: false,
    needsConfirm: true,
    path,
    message: `File not found in vault: "${path}". Save anyway?`,
  };
}

export function confirmAttachmentSave(path: string): AttachmentSaveResult {
  return { ok: true, path };
}
