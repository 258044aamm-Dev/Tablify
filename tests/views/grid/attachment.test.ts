import { describe, it, expect } from 'vitest';
import {
  normalizeAttachmentPath,
  checkAttachmentPath,
  confirmAttachmentSave,
  isImageAttachmentPath,
  attachmentFileName,
  resolveAttachmentImageUrl,
} from '../../../src/views/grid/attachment.js';

function mockVault(existing: string[]) {
  const set = new Set(existing);
  return {
    getAbstractFileByPath: (p: string) => (set.has(p) ? { path: p } : null),
    getResourcePath: (file: unknown) => {
      const f = file as { path?: string } | null;
      return f?.path ? `app://local/${f.path}` : null;
    },
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

describe('SAD-347 — Image attachment detection and vault resource resolution', () => {
  it('detects supported raster and vector image extensions case-insensitively', () => {
    for (const ext of ['png', 'PNG', 'jpg', 'JPG', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico']) {
      expect(isImageAttachmentPath(`Assets/photo.${ext}`), ext).toBe(true);
    }
    expect(isImageAttachmentPath('https://example.com/banner.webp?width=400#hero')).toBe(true);
    expect(isImageAttachmentPath('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')).toBe(true);
  });

  it('rejects non-image extensions, empty paths, and extensionless names', () => {
    for (const nonImg of ['', '   ', 'Files/brief.pdf', 'Files/data.csv', 'Notes/readme.md', 'Assets/noext', 'Assets/trailing.']) {
      expect(isImageAttachmentPath(nonImg), nonImg).toBe(false);
    }
  });

  it('extracts a clean file basename for alt text and titles', () => {
    expect(attachmentFileName('Assets/sub/photo.png')).toBe('photo.png');
    expect(attachmentFileName('https://example.com/img/avatar.jpeg?v=2#top')).toBe('avatar.jpeg');
    expect(attachmentFileName('data:image/png;base64,abc')).toBe('Embedded image');
  });

  it('resolves an existing vault image via vault.getResourcePath and normalizes slashes', () => {
    const vault = mockVault(['Assets/photo.png']);
    expect(resolveAttachmentImageUrl('  /Assets\\photo.png  ', vault)).toBe('app://local/Assets/photo.png');
  });

  it('falls back to vault.adapter.getResourcePath when vault.getResourcePath is absent', () => {
    const vault = {
      getAbstractFileByPath: (p: string) => (p === 'Assets/ diagram.svg' ? { path: p } : null),
      adapter: {
        getResourcePath: (p: string) => `app://adapter/${p}`,
      },
    };
    expect(resolveAttachmentImageUrl('Assets/ diagram.svg', vault)).toBe('app://adapter/Assets/ diagram.svg');
  });

  it('returns null when the image is missing in the vault, is a folder, or is not an image', () => {
    const vault = {
      getAbstractFileByPath: (p: string) => {
        if (p === 'Assets/folder.png') return { path: p, children: [] };
        if (p === 'Files/brief.pdf') return { path: p };
        return null;
      },
      getResourcePath: (f: unknown) => `app://local/${(f as { path: string }).path}`,
    };
    expect(resolveAttachmentImageUrl('Assets/missing.png', vault)).toBeNull();
    expect(resolveAttachmentImageUrl('Assets/folder.png', vault)).toBeNull();
    expect(resolveAttachmentImageUrl('Files/brief.pdf', vault)).toBeNull();
  });

  it('passes through direct https:// image URLs and data:image URIs', () => {
    expect(resolveAttachmentImageUrl('https://example.com/pic.png')).toBe('https://example.com/pic.png');
    expect(resolveAttachmentImageUrl('data:image/gif;base64,R0lGODlhAQABAAAAACw=')).toBe(
      'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    );
  });
});
