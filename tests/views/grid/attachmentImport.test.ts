/**
 * SAD-356 — the two pure rules the attachment cell's new entries rely on, and the copy that brings a
 * device file into the vault.
 *
 * The picker itself (`pickFileFromDevice`) drives a real `<input type="file">`, so it is exercised in
 * `tests/views/grid/attachmentMenu.test.ts` (jsdom) where a `Document` exists; everything here is
 * DOM-free and runs in Node.
 */

import { describe, it, expect } from 'vitest';
import { isAttachmentValueEmpty, isRemoteAttachmentPath } from '../../../src/views/grid/attachment.js';
import {
  importPickedFile,
  sanitizeAttachmentFileName,
  uniqueAttachmentPath,
  type AttachmentVaultIo,
} from '../../../src/views/grid/attachmentImport.js';

function fileOf(name: string, content = 'abc'): File {
  return new File([content], name, { type: 'application/octet-stream' });
}

/** A vault that records what it was asked to do. */
function makeIo(overrides: Partial<AttachmentVaultIo> = {}): AttachmentVaultIo & {
  written: Array<{ path: string; data: ArrayBuffer }>;
} {
  const written: Array<{ path: string; data: ArrayBuffer }> = [];
  return {
    written,
    createBinary: async (path, data) => {
      written.push({ path, data });
      return { path };
    },
    getAbstractFileByPath: () => null,
    ...overrides,
  } as AttachmentVaultIo & { written: Array<{ path: string; data: ArrayBuffer }> };
}

describe('SAD-356 — remote vs vault-path values', () => {
  it('treats http(s) URLs and data:image URIs as remote', () => {
    for (const remote of [
      'https://example.com/a.png',
      'HTTP://example.com/a.png',
      'http://example.com/a.pdf',
      '  https://example.com/a.png  ',
      'data:image/png;base64,iVBORw0KGgo=',
      'DATA:image/svg+xml;utf8,<svg/>',
    ]) {
      expect(isRemoteAttachmentPath(remote), remote).toBe(true);
    }
  });

  it('treats vault paths, bare hosts and unknown schemes as vault paths', () => {
    for (const local of [
      '',
      '   ',
      'Assets/photo.png',
      'Assets/photo.png?v=2',
      'www.example.com',
      'example.com/a.png',
      'C:/Users/me/a.png',
      'file:///Users/me/a.png',
      'app://local/Assets/a.png',
      'data:text/plain;base64,aGk=',
      'obsidian://open?vault=x',
    ]) {
      expect(isRemoteAttachmentPath(local), local).toBe(false);
    }
  });
});

describe('SAD-356 — empty attachment values', () => {
  it('is empty for null, undefined, empty and whitespace strings, and for empty legacy lists', () => {
    for (const empty of [null, undefined, '', '   ', [], ['', '  ']]) {
      expect(isAttachmentValueEmpty(empty), JSON.stringify(empty)).toBe(true);
    }
  });

  it('is not empty for a stored path or a legacy list with a path in it', () => {
    for (const filled of ['Assets/photo.png', '  Assets/photo.png  ', ['Assets/photo.png'], ['', 'a.pdf']]) {
      expect(isAttachmentValueEmpty(filled), JSON.stringify(filled)).toBe(false);
    }
  });

  it('agrees with the cell renderer on what counts as a path', () => {
    // The cell shows a chip for exactly the values this says are not empty; a value the chip
    // renders but the menu calls "empty" would open the menu over a filled cell.
    expect(isAttachmentValueEmpty([''])).toBe(true);
    expect(isAttachmentValueEmpty(['x'])).toBe(false);
  });
});

describe('SAD-356 — file names and target paths', () => {
  it('strips directories and characters a vault path cannot carry', () => {
    expect(sanitizeAttachmentFileName('photo.png')).toBe('photo.png');
    expect(sanitizeAttachmentFileName('../../DCIM/photo.jpg')).toBe('photo.jpg');
    expect(sanitizeAttachmentFileName('C:\\Users\\me\\photo.jpg')).toBe('photo.jpg');
    expect(sanitizeAttachmentFileName('a:b*c?.png')).toBe('abc.png');
    expect(sanitizeAttachmentFileName('with spaces and ünïcode.pdf')).toBe('with spaces and ünïcode.pdf');
  });

  it('falls back to a usable name for empty or dot-only input', () => {
    for (const bad of ['', '   ', '.', '..', '/', 'C:\\folder\\']) {
      expect(sanitizeAttachmentFileName(bad), bad).toBe('attachment');
    }
  });

  it('dedupes with a numbered suffix, keeping the extension', () => {
    const taken = new Set(['photo.png', 'photo 1.png']);
    expect(uniqueAttachmentPath('photo.png', '', (p) => taken.has(p))).toBe('photo 2.png');
  });

  it('keeps the folder prefix and handles an extension-less name', () => {
    const taken = new Set(['Attachments/README']);
    expect(uniqueAttachmentPath('README', 'Attachments', (p) => taken.has(p))).toBe('Attachments/README 1');
    expect(uniqueAttachmentPath('photo.png', '/Attachments/', () => false)).toBe('Attachments/photo.png');
  });
});

describe('SAD-356 — copying a picked file into the vault', () => {
  it('asks Obsidian for the folder and writes the picked bytes there', async () => {
    const calls: Array<[string, string | undefined]> = [];
    const io = makeIo({
      getAvailablePathForAttachment: async (filename, sourcePath) => {
        calls.push([filename, sourcePath]);
        return `Attachments/${filename}`;
      },
    });

    const result = await importPickedFile(fileOf('photo.png', 'hello'), io, 'Tables/Board.tablify');

    expect(result).toEqual({ ok: true, path: 'Attachments/photo.png' });
    expect(calls).toEqual([['photo.png', 'Tables/Board.tablify']]);
    expect(io.written).toHaveLength(1);
    expect(io.written[0].path).toBe('Attachments/photo.png');
    expect(new TextDecoder().decode(io.written[0].data)).toBe('hello');
  });

  it('normalises the path Obsidian hands back', async () => {
    const io = makeIo({ getAvailablePathForAttachment: async () => '/Attachments//photo.png' });
    const result = await importPickedFile(fileOf('photo.png'), io);
    expect(result).toEqual({ ok: true, path: 'Attachments/photo.png' });
    expect(io.written[0].path).toBe('Attachments/photo.png');
  });

  it('falls back to a free path when the API is absent, and never overwrites', async () => {
    const io = makeIo({
      getAbstractFileByPath: (p) => (p === 'photo.png' ? { path: p } : null),
    });
    const result = await importPickedFile(fileOf('photo.png'), io);
    expect(result).toEqual({ ok: true, path: 'photo 1.png' });
    expect(io.written).toHaveLength(1);
  });

  it('reports a write failure instead of throwing', async () => {
    const io = makeIo({
      getAvailablePathForAttachment: async (filename) => filename,
      createBinary: async () => {
        throw new Error('disk full');
      },
    });
    const result = await importPickedFile(fileOf('photo.png'), io);
    expect(result).toEqual({
      ok: false,
      reason: 'failed',
      message: 'Could not copy that file into the vault: disk full',
    });
  });

  it('reports an empty target instead of writing to the vault root', async () => {
    const io = makeIo({ getAvailablePathForAttachment: async () => '   ' });
    const result = await importPickedFile(fileOf('photo.png'), io);
    expect(result.ok).toBe(false);
    expect(io.written).toHaveLength(0);
  });
});
