/**
 * SAD-347 — Lightbox modal for inline cell image attachments.
 *
 * Uses the shared prototype modal shell (`dressProtoModal`) so header typography, border,
 * elevation, close button, and dark/light tokens match all other Tablify dialogs.
 */

import { App, Modal } from 'obsidian';
import { dressProtoModal } from '../../ui/protoModal.js';
import { attachmentFileName } from './attachment.js';

export interface ImagePreviewModalOptions {
  /** Stored vault-relative path or URL shown in the subtitle. */
  path: string;
  /** Resolved browser-renderable image URL (`app://...`, `https://...`, or `data:image/...`). */
  url: string;
}

export class ImagePreviewModal extends Modal {
  private readonly opts: ImagePreviewModalOptions;

  constructor(app: App, opts: ImagePreviewModalOptions) {
    super(app);
    this.opts = opts;
  }

  onOpen(): void {
    const { path, url } = this.opts;
    const name = attachmentFileName(path) || path;
    this.setTitle(name);
    dressProtoModal(this, {
      icon: 'paperclip',
      subtitle: path !== name ? path : 'Image attachment preview',
      size: 'xl',
    });

    this.modalEl.dataset.testid = 'tablify-image-preview-modal';
    this.contentEl.empty();
    this.contentEl.classList.add('tablify__image-lightbox');

    const stage = document.createElement('div');
    stage.className = 'tablify__image-lightbox-stage';
    stage.dataset.testid = 'tablify-image-preview-stage';

    const img = document.createElement('img');
    img.className = 'tablify__image-lightbox-img';
    img.dataset.testid = 'tablify-image-preview-img';
    img.src = url;
    img.alt = name;
    img.decoding = 'async';

    const meta = document.createElement('div');
    meta.className = 'tablify__image-lightbox-meta';
    meta.dataset.testid = 'tablify-image-preview-meta';
    meta.textContent = path;

    img.addEventListener('load', () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        meta.textContent = `${path} · ${img.naturalWidth} × ${img.naturalHeight} px`;
      }
    });

    img.addEventListener('error', () => {
      img.remove();
      const err = document.createElement('div');
      err.className = 'tablify__image-lightbox-error';
      err.dataset.testid = 'tablify-image-preview-error';
      err.textContent = `Could not load image preview for "${path}".`;
      stage.appendChild(err);
    });

    stage.appendChild(img);
    this.contentEl.append(stage, meta);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
