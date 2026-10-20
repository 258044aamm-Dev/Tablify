/**
 * Attachment panel — the prototype's `#floatPanel` attachment screen (`Prototype/script.js`
 * `openAttachmentPanel`, ~line 987): a paperclip header, a row per attachment with its
 * vault-relative path and a remove button, then the path field. Geometry follows the prototype's
 * classes (`p-2.5 text-xs`, row `px-2 py-1 rounded-lg` on the inner surface, path `font-mono
 * text-[10px]`); paint lives in the `.tablify__attach*` rules in styles.css.
 *
 * One deliberate difference from the prototype's demo: a plugin attachment cell holds a single
 * vault-relative path (FORMAT_SPEC §3, `fieldTypes/attachment.ts`), so the list shows at most one
 * row and adding replaces the path, where the prototype pushed onto an array. The row, the input
 * and the hint are otherwise the prototype's.
 *
 * Paths belong to the caller: it normalises them and checks the vault
 * (`checkAttachmentPath`), and a path that is not in the vault asks before it is saved
 * (`confirmAttachmentSave`). The panel only collects the path.
 *
 * SAD-347: when an attachment path resolves to a valid image URL (`resolveImageUrl`), the panel
 * renders a clickable image preview banner above the row and an inline thumbnail inside the row.
 */

import { faIcon } from '../../ui/faIcons.js';
import { anchorPanel, createPanelCard, wirePanelDismiss } from './select/panel.js';
import { attachmentFileName, isImageAttachmentPath, isRemoteAttachmentPath, type AttachmentSaveResult } from './attachment.js';
import type { CellValue, FieldDefinition } from '../../model/types.js';

export interface AttachmentPanelOptions {
  field: FieldDefinition;
  /** Current cell value — the plugin keeps one vault-relative path per cell. */
  value?: CellValue;
  /** Add (or replace) the attachment path. The host normalises, writes and re-renders. */
  onAdd: (path: string) => void;
  /** Drop the attachment at `index` (the plugin stores one path, so it is almost always 0). */
  onRemove: (index: number) => void;
  /** Vault check (P3-04): a path that is not in the vault needs an explicit "Save anyway". */
  checkPath?: (raw: string) => AttachmentSaveResult;
  /**
   * SAD-347: resolve a stored path to a browser-renderable image URL when it points to an image
   * in the vault (or an image URL). Return null for non-images or missing vault files.
   */
  resolveImageUrl?: (path: string) => string | null;
  /**
   * SAD-347: open the full-size image lightbox when the user clicks the panel preview.
   */
  onPreviewImage?: (path: string, url: string) => void;
  /**
   * SAD-356: open the device picker for a cell that already holds an attachment. Absent for every
   * caller that only wants the path field, in which case the panel renders exactly as it always has.
   */
  onChooseFile?: () => void;
  onDismiss?: () => void;
  theme?: 'light' | 'dark';
}

const INPUT_PLACEHOLDER = 'Vault-relative path, e.g. Assets/photo.png';
/**
 * The prototype's line is demo narration ("Type the path and press Enter (spec §2.3). File picking
 * is Obsidian-side — simulated here."), which must not be copied. The plugin's own behaviour is
 * worth a line of its own: the path is checked against the vault before it is saved (P3-04).
 */
const HINT = 'Vault-relative path — the file is checked when you press Enter. An unknown path still saves once you confirm.';

export class AttachmentPanel {
  private container: HTMLElement;
  private body: HTMLElement;
  private list: HTMLElement;
  private input: HTMLInputElement;
  private warn: HTMLElement | null = null;
  /** SAD-356: the host's message line; only present when `onChooseFile` is wired. */
  private msg: HTMLElement | null = null;
  private unwireDismiss: (() => void) | null = null;

  constructor(private opts: AttachmentPanelOptions) {
    const theme = opts.theme ?? 'light';
    const { card, body } = createPanelCard('tablify-attachment-panel', theme, 'tablify__attach');
    card.classList.add('tablify__panel--attach');
    this.container = card;
    this.body = body;
    this.container.setAttribute('aria-label', `Attachments for ${opts.field.name}`);

    const head = document.createElement('div');
    head.className = 'tablify__attach-head';
    const icon = document.createElement('span');
    icon.className = 'tablify__attach-icon';
    icon.innerHTML = faIcon('paperclip', 11);
    head.appendChild(icon);
    head.appendChild(document.createTextNode('Attachments'));

    this.list = document.createElement('div');
    this.list.className = 'tablify__attach-list';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'tablify__attach-input';
    this.input.placeholder = INPUT_PLACEHOLDER;
    this.input.setAttribute('aria-label', INPUT_PLACEHOLDER);
    this.input.addEventListener('keydown', (ev) => this.onKey(ev));

    const hint = document.createElement('div');
    hint.className = 'tablify__attach-hint';
    hint.textContent = HINT;

    this.body.appendChild(head);
    this.body.appendChild(this.list);
    this.body.appendChild(this.input);
    this.body.appendChild(hint);
    // SAD-356: a cell that already holds an attachment can still take a file from the device.
    // Appended after the hint and only when the host wires it, so a panel built without the option
    // keeps the exact DOM it has always had (SAD-347's preview banner is inserted above the list).
    if (opts.onChooseFile) {
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'tablify__attach-pick';
      pick.dataset.testid = 'tablify-attachment-pick';
      const glyph = document.createElement('span');
      glyph.className = 'tablify__attach-pick-icon';
      glyph.innerHTML = faIcon('plus', 10);
      pick.appendChild(glyph);
      pick.appendChild(document.createTextNode('Choose a file…'));
      pick.addEventListener('click', () => this.opts.onChooseFile?.());

      const msg = document.createElement('div');
      msg.className = 'tablify__attach-msg';
      msg.setAttribute('role', 'status');
      msg.hidden = true;

      this.msg = msg;
      this.body.appendChild(pick);
      this.body.appendChild(msg);
    }
    this.render();
  }

  get element(): HTMLElement {
    return this.container;
  }

  /** Anchor the panel under a cell and take over dismissal, like `openPanel()` does. */
  open(anchor: HTMLElement): void {
    // Outside the grid, like the prototype's `#floatPanel`, so a grid re-render keeps it open.
    if (!this.container.isConnected) document.body.appendChild(this.container);
    anchorPanel(this.container, anchor);
    this.input.focus();
    this.unwireDismiss ??= wirePanelDismiss(this.container, () => {
      this.close();
      this.opts.onDismiss?.();
    });
  }

  /** Update the shown list after the host wrote a new value. */
  setValue(value: CellValue): void {
    this.opts.value = value;
    this.warn = null;
    this.render();
  }

  close(): void {
    this.unwireDismiss?.();
    this.unwireDismiss = null;
    this.container.remove();
  }

  /** SAD-356: the host's message line (a refused picker, a failed copy). No-op without a picker. */
  setMessage(text: string): void {
    if (!this.msg) return;
    this.msg.textContent = text;
    this.msg.hidden = text === '';
  }

  /** SAD-356: disable the panel's controls while a picked file is copied into the vault. */
  setBusy(label: string | null): void {
    this.container.setAttribute('aria-busy', label ? 'true' : 'false');
    const controls = this.body.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input');
    for (const el of Array.from(controls)) el.disabled = label !== null;
    // One message channel: the busy label shows while work runs, and clears when it ends.
    this.setMessage(label ?? '');
  }

  // ---- behaviour -------------------------------------------------------------------------

  private onKey(ev: KeyboardEvent): void {
    ev.stopPropagation();
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    const raw = this.input.value.trim();
    if (!raw) return;
    // SAD-356: a URL or data: URI is not a vault path — there is nothing to look up, so it saves as
    // typed. Everything else keeps the P3-04 vault check and its "Save anyway" confirmation.
    const check = isRemoteAttachmentPath(raw) ? undefined : this.opts.checkPath?.(raw);
    if (check && !check.ok) {
      this.showWarning(check);
      return;
    }
    this.add(check?.path ?? raw);
  }

  private add(path: string): void {
    this.opts.onAdd(path);
    this.input.value = '';
    this.warn = null;
    this.render();
  }

  private showWarning(result: Extract<AttachmentSaveResult, { ok: false }>): void {
    this.warn = document.createElement('div');
    this.warn.className = 'tablify__attach-warn';
    const message = document.createElement('span');
    message.textContent = result.message;
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'tablify__attach-warn-btn';
    save.textContent = 'Save anyway';
    save.addEventListener('click', () => this.add(result.path));
    this.warn.appendChild(message);
    this.warn.appendChild(save);
    this.render();
  }

  /** The paths shown: the cell's single path, or every entry of a legacy list value. */
  private paths(): string[] {
    const v = this.opts.value;
    if (Array.isArray(v)) return v.map((entry) => String(entry));
    return typeof v === 'string' && v ? [v] : [];
  }

  private render(): void {
    // Drop any warning currently in the tree: `add()`/`setValue()`/`remove()` clear the state, and
    // the card must not keep a stale "Save anyway" row behind (the input is re-inserted below).
    for (const stale of Array.from(this.body.querySelectorAll('.tablify__attach-warn'))) stale.remove();
    this.list.textContent = '';
    const paths = this.paths();
    paths.forEach((path, index) => {
      const imageUrl = isImageAttachmentPath(path) ? (this.opts.resolveImageUrl?.(path) ?? null) : null;
      if (imageUrl) {
        const onPreview = this.opts.onPreviewImage;
        const previewEl = document.createElement(onPreview ? 'button' : 'div');
        previewEl.className = 'tablify__attach-preview';
        previewEl.dataset.testid = 'tablify-attachment-preview';
        if (onPreview) {
          const btn = previewEl as HTMLButtonElement;
          btn.type = 'button';
          btn.setAttribute('aria-label', `Preview ${path}`);
          btn.title = 'Click to view full size';
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onPreview(path, imageUrl);
          });
        }
        const previewImg = document.createElement('img');
        previewImg.className = 'tablify__attach-preview-img';
        previewImg.src = imageUrl;
        previewImg.alt = attachmentFileName(path);
        previewImg.decoding = 'async';
        previewImg.addEventListener('error', () => {
          previewEl.remove();
        });
        previewEl.appendChild(previewImg);
        this.list.appendChild(previewEl);
      }

      const row = document.createElement('div');
      row.className = 'tablify__attach-row';
      row.dataset.testid = 'tablify-attachment-row';

      if (imageUrl) {
        const rowThumb = document.createElement('img');
        rowThumb.className = 'tablify__attach-row-thumb';
        rowThumb.src = imageUrl;
        rowThumb.alt = attachmentFileName(path);
        rowThumb.decoding = 'async';
        rowThumb.addEventListener('error', () => {
          rowThumb.remove();
        });
        row.appendChild(rowThumb);
      }

      const label = document.createElement('span');
      label.className = 'tablify__attach-path';
      label.textContent = path;
      label.title = path;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tablify__attach-remove';
      remove.setAttribute('aria-label', `Remove ${path}`);
      remove.innerHTML = faIcon('xmark', 10);
      remove.addEventListener('click', () => this.remove(index));
      row.appendChild(label);
      row.appendChild(remove);
      this.list.appendChild(row);
    });
    if (!paths.length) {
      const empty = document.createElement('div');
      empty.className = 'tablify__attach-empty';
      empty.textContent = 'No attachments.';
      this.list.appendChild(empty);
    }
    if (this.warn) this.body.insertBefore(this.warn, this.input);
    // `openAttachmentPanel` re-opens (and so re-focuses) the input after every change
    // (`script.js:1015`); the panel keeps the same resting state.
    const active = document.activeElement as unknown as HTMLElement | null;
    if (this.container.isConnected && active !== this.input) this.input.focus();
  }

  private remove(index: number): void {
    this.opts.onRemove(index);
    this.warn = null;
    this.render();
  }
}
