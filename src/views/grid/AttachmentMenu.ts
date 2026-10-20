/**
 * SAD-356 — the menu an **empty** Attachment cell opens: choose a device file, or type a URL / path.
 *
 * The card is the same prototype `#floatPanel` host every cell panel uses (`select/panel.ts`): the
 * same factory (`createPanelCard`), the same anchoring (`anchorPanel`) and the same dismissal rules
 * (`wirePanelDismiss`), so it lands where the attachment panel lands and closes the way it closes.
 *
 * It is a view only. The host owns the vault, the copy and the write — `TableView.openAttachmentMenu`
 * and `TableView.chooseAttachmentFile`. Nothing here reads the store or writes a cell.
 */

import { faIcon } from '../../ui/faIcons.js';
import { anchorPanel, createPanelCard, wirePanelDismiss } from './select/panel.js';
import type { FieldDefinition } from '../../model/types.js';

/** The two entries, in order. Their labels are the issue's own words (SAD-356). */
export const CHOOSE_FILE_LABEL = 'Choose a file…';
export const ENTER_PATH_LABEL = 'Enter a URL or file path…';

export interface AttachmentMenuOptions {
  field: FieldDefinition;
  theme?: 'light' | 'dark';
  /** Open the device picker. The host resolves it, copies the file and writes the cell. */
  onChooseFile: () => void;
  /** Hand over to the existing path panel (`AttachmentPanel`), input focused. */
  onEnterPath: () => void;
  onDismiss?: () => void;
}

export class AttachmentMenu {
  private container: HTMLElement;
  private body: HTMLElement;
  private status: HTMLElement;
  private buttons: HTMLButtonElement[] = [];
  private unwireDismiss: (() => void) | null = null;

  constructor(private opts: AttachmentMenuOptions) {
    const theme = opts.theme ?? 'light';
    // The attachment panel's own body class and width class, so the card is the same box.
    const { card, body } = createPanelCard('tablify-attachment-menu', theme, 'tablify__attach');
    card.classList.add('tablify__panel--attach');
    card.setAttribute('aria-label', `Add an attachment to ${opts.field.name}`);
    this.container = card;
    this.body = body;

    const head = document.createElement('div');
    head.className = 'tablify__attach-head';
    const icon = document.createElement('span');
    icon.className = 'tablify__attach-icon';
    icon.innerHTML = faIcon('paperclip', 11);
    head.appendChild(icon);
    head.appendChild(document.createTextNode('Add an attachment'));

    const list = document.createElement('div');
    list.className = 'tablify__attach-menu';
    list.setAttribute('role', 'menu');
    this.buttons.push(
      this.item(list, 'plus', CHOOSE_FILE_LABEL, () => opts.onChooseFile()),
      this.item(list, 'link', ENTER_PATH_LABEL, () => opts.onEnterPath()),
    );

    // Hidden until the host has something to say (a refused picker, a failed copy).
    this.status = document.createElement('div');
    this.status.className = 'tablify__attach-msg';
    this.status.setAttribute('role', 'status');
    this.status.hidden = true;

    this.body.appendChild(head);
    this.body.appendChild(list);
    this.body.appendChild(this.status);
  }

  get element(): HTMLElement {
    return this.container;
  }

  /** Anchor under a cell and take over dismissal, like `AttachmentPanel.open()`. */
  open(anchor: HTMLElement): void {
    // Outside the grid, like the prototype's `#floatPanel`, so a grid re-render keeps it open.
    if (!this.container.isConnected) document.body.appendChild(this.container);
    anchorPanel(this.container, anchor);
    this.buttons[0]?.focus();
    this.unwireDismiss ??= wirePanelDismiss(this.container, () => {
      this.close();
      this.opts.onDismiss?.();
    });
  }

  /** The fallback message — e.g. this device did not open a file picker (owner decision D4). */
  setMessage(text: string): void {
    this.status.textContent = text;
    this.status.hidden = text === '';
  }

  /** While the copy runs: one label, every entry disabled, `aria-busy` for screen readers. */
  setBusy(label: string | null): void {
    this.container.setAttribute('aria-busy', label ? 'true' : 'false');
    for (const button of this.buttons) button.disabled = label !== null;
    if (label) this.setMessage(label);
  }

  close(): void {
    this.unwireDismiss?.();
    this.unwireDismiss = null;
    this.container.remove();
  }

  private item(list: HTMLElement, icon: 'plus' | 'link', label: string, run: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tablify__attach-menu-item';
    button.setAttribute('role', 'menuitem');
    const glyph = document.createElement('span');
    glyph.className = 'tablify__attach-menu-icon';
    // Generated glyph markup (src/ui/faIcons.ts), never user text.
    glyph.innerHTML = faIcon(icon, 11);
    button.appendChild(glyph);
    button.appendChild(document.createTextNode(label));
    button.addEventListener('click', () => run());
    list.appendChild(button);
    return button;
  }
}
