// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from 'obsidian';
import { AttachmentPanel } from '../../../src/views/grid/AttachmentPanel.js';
import { ImagePreviewModal } from '../../../src/views/grid/ImagePreviewModal.js';
import { GridView } from '../../../src/views/grid/GridView.js';
import { createDefaultView } from '../../../src/model/view.js';
import type { FieldDefinition, Row } from '../../../src/model/types.js';

const ATTACH_FIELD: FieldDefinition = {
  id: 'f_attach',
  name: 'Attachments',
  type: 'attachment',
};

function makeAnchor(): HTMLElement {
  const anchor = document.createElement('div');
  anchor.getBoundingClientRect = () =>
    ({
      top: 100,
      left: 80,
      bottom: 134,
      right: 260,
      width: 180,
      height: 34,
      x: 80,
      y: 100,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(anchor);
  return anchor;
}

describe('SAD-347 — ImagePreviewModal, AttachmentPanel image preview, and cell vs thumbnail interaction', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('ImagePreviewModal renders the prototype modal shell, stage image, dimension caption on load, and error message on decode failure', () => {
    const app = new App();
    const modal = new ImagePreviewModal(app, {
      path: 'Assets/diagram.png',
      url: 'app://local/Assets/diagram.png',
    });
    modal.open();

    expect(modal.modalEl.dataset.testid).toBe('tablify-image-preview-modal');
    expect(modal.modalEl.classList.contains('tablify__pmodal')).toBe(true);
    expect(modal.modalEl.classList.contains('tablify__pmodal--xl')).toBe(true);
    expect(modal.titleEl.textContent).toBe('diagram.png');

    const img = modal.contentEl.querySelector<HTMLImageElement>('[data-testid="tablify-image-preview-img"]');
    const meta = modal.contentEl.querySelector<HTMLElement>('[data-testid="tablify-image-preview-meta"]');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('app://local/Assets/diagram.png');
    expect(img?.getAttribute('alt')).toBe('diagram.png');
    expect(meta?.textContent).toBe('Assets/diagram.png');

    // Simulate image load with natural dimensions.
    if (img) {
      Object.defineProperty(img, 'naturalWidth', { value: 640, configurable: true });
      Object.defineProperty(img, 'naturalHeight', { value: 480, configurable: true });
      img.dispatchEvent(new Event('load'));
    }
    expect(meta?.textContent).toBe('Assets/diagram.png · 640 × 480 px');

    // Simulate runtime error fallback inside the lightbox stage.
    img?.dispatchEvent(new Event('error'));
    expect(modal.contentEl.querySelector('[data-testid="tablify-image-preview-img"]')).toBeNull();
    const err = modal.contentEl.querySelector<HTMLElement>('[data-testid="tablify-image-preview-error"]');
    expect(err?.textContent).toContain('Could not load image preview for "Assets/diagram.png"');

    modal.close();
  });

  it('AttachmentPanel renders an image preview banner and row thumbnail for existing image attachments, and omits them for non-images or missing vault files', () => {
    const anchor = makeAnchor();
    const previews: Array<{ path: string; url: string }> = [];
    const panel = new AttachmentPanel({
      field: ATTACH_FIELD,
      value: 'Assets/photo.png',
      resolveImageUrl: (p) => (p === 'Assets/photo.png' ? 'app://local/Assets/photo.png' : null),
      onPreviewImage: (path, url) => previews.push({ path, url }),
      onAdd: () => {},
      onRemove: () => {},
      onDismiss: () => {},
    });
    panel.open(anchor);

    const previewBtn = panel.element.querySelector<HTMLButtonElement>('[data-testid="tablify-attachment-preview"]');
    expect(previewBtn).not.toBeNull();
    const previewImg = previewBtn?.querySelector<HTMLImageElement>('img.tablify__attach-preview-img');
    expect(previewImg?.getAttribute('src')).toBe('app://local/Assets/photo.png');
    const rowThumb = panel.element.querySelector<HTMLImageElement>('img.tablify__attach-row-thumb');
    expect(rowThumb?.getAttribute('src')).toBe('app://local/Assets/photo.png');

    previewBtn?.click();
    expect(previews).toEqual([{ path: 'Assets/photo.png', url: 'app://local/Assets/photo.png' }]);

    // Switching to a non-image PDF omits the preview banner and row thumbnail.
    panel.setValue('Docs/spec.pdf');
    expect(panel.element.querySelector('[data-testid="tablify-attachment-preview"]')).toBeNull();
    expect(panel.element.querySelector('img.tablify__attach-row-thumb')).toBeNull();
    expect(panel.element.querySelector('.tablify__attach-path')?.textContent).toBe('Docs/spec.pdf');

    panel.close();
  });

  it('clicking the inline thumbnail opens preview without moving cell selection, whereas clicking the rest of the cell selects/activates normally', () => {
    const rows: Row[] = [
      {
        id: 'r1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        values: { f_attach: 'Assets/photo.png' },
      },
    ];
    const previews: string[] = [];
    const selected: Array<{ row: number; col: number }> = [];
    const activated: Array<{ row: number; col: number }> = [];
    const grid = new GridView({
      rows,
      fields: [ATTACH_FIELD],
      view: createDefaultView([ATTACH_FIELD]),
      theme: 'light',
      viewportWidth: 600,
      viewportHeight: 300,
      resolveAttachmentUrl: (p) => `app://local/${p}`,
      onPreviewAttachment: (path) => previews.push(path),
      onCellClick: (row, col) => selected.push({ row, col }),
      onCellActivate: (row, col) => activated.push({ row, col }),
    });
    document.body.appendChild(grid.root);

    const cell = grid.root.querySelector<HTMLElement>(
      '.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="0"]',
    );
    const thumbBtn = cell?.querySelector<HTMLButtonElement>('button.tablify__chip-thumb-btn');
    expect(thumbBtn).not.toBeNull();

    // 1. Clicking thumbnail triggers preview only.
    thumbBtn?.click();
    expect(previews).toEqual(['Assets/photo.png']);
    expect(selected).toEqual([]);
    expect(grid.getSelection()).toBeNull();

    // 2. Clicking the cell capsule outside the thumbnail selects the cell.
    cell?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selected).toEqual([{ row: 0, col: 0 }]);
    expect(grid.getSelection()).toEqual({ row: 0, col: 0 });

    // 3. Double-clicking the cell capsule activates the editor/panel.
    cell?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(activated).toEqual([{ row: 0, col: 0 }]);

    grid.destroy();
  });
});
