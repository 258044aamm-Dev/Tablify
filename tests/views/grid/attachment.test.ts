import { describe, it, expect } from 'vitest';
import { normalizeAttachmentPath, checkAttachmentPath, confirmAttachmentSave } from '../../../src/views/grid/attachment.js';

function mockVault(existing: string[]) {
  const set = new Set(existing);
  return {
    getAbstractFileByPath: (p: string) => (set.has(p) ? {} : null),
  };
}

describe('P3-04 — Attachment cell', () => {
  it('normalization: backslashes, leading slash, spaces, unicode', () => {
    expect(normalizeAttachmentPath('  foo\\bar\\baz.png  ')).toBe('foo/bar/baz.png');
    expect(normalizeAttachmentPath('/foo/bar.png')).toBe('foo/bar.png');
    expect(normalizeAttachmentPath('///foo//bar.png')).toBe('foo/bar.png');
    expect(normalizeAttachmentPath('  Attachments/日本語 file.png  ')).toBe('Attachments/日本語 file.png');
    expect(normalizeAttachmentPath('a\\b/c\\d')).toBe('a/b/c/d');
  });

  it('existing file saves without warning', () => {
    const vault = mockVault(['Assets/file.png']);
    const res = checkAttachmentPath('Assets/file.png', vault);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.path).toBe('Assets/file.png');
  });

  it('missing file warns and needs confirm', () => {
    const vault = mockVault([]);
    const res = checkAttachmentPath('Missing/file.png', vault);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.needsConfirm).toBe(true);
      expect(res.message).toMatch(/File not found/);
    }
  });

  it('confirmed save writes the path', () => {
    const vault = mockVault([]);
    const check = checkAttachmentPath('Missing/file.png', vault);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      const confirmed = confirmAttachmentSave(check.path);
      expect(confirmed.ok).toBe(true);
      if (confirmed.ok) expect(confirmed.path).toBe('Missing/file.png');
    }
  });

  it('empty path is ok (clear)', () => {
    const vault = mockVault([]);
    const res = checkAttachmentPath('   ', vault);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.path).toBe('');
  });
});
