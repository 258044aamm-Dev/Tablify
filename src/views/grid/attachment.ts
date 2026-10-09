/**
 * Attachment cell — vault-relative path normalization and existence check.
 */

export function normalizeAttachmentPath(input: string): string {
  let p = input.trim().replace(/\\/g, '/');
  p = p.replace(/^\/+/, '');
  p = p.replace(/\/{2,}/g, '/');
  return p;
}

export interface VaultLike {
  getAbstractFileByPath(path: string): unknown | null;
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
