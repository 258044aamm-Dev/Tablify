/**
 * SAD-376 — what a long cell draws, and where "Expand" opens.
 *
 * Two pieces, both plain DOM:
 *  - `createExpandControl()` is the 20px button the grid puts in the capsule of a cell whose text
 *    is over the limit. It carries no text node, so the cell's `textContent`, the empty-cell em
 *    dash (`:empty::before`) and the ellipsis geometry are exactly what they were.
 *  - `CellOverflowPanel` is the expanded view. It reuses the prototype's float-panel card
 *    (`select/panel.ts`): the same 220–320 px themed box, the same `openPanel()` placement with its
 *    viewport clamp and vertical flip, and the same press-outside / Escape dismissal every other
 *    cell panel has.
 *
 * Nothing here touches the store, the command stack or the file. The panel reads text that is
 * already on screen, so opening it cannot change a value, add an undo step or mark the file dirty.
 */

import { faIcon } from '../../ui/faIcons.js';
import { applyTheme } from '../../ui/theme/tokens.js';
import { anchorPanel, createPanelCard, wirePanelDismiss } from './select/panel.js';

/** How long the "Copied" confirmation stays on the button. */
export const COPY_CONFIRM_MS = 1200;

/** Marker the grid's delegated click handler looks for. */
export const EXPAND_CONTROL_ATTRIBUTE = 'data-overflow-expand';

/** Marker for the preview card, so the grid's own hover wiring can recognise it. */
export const CARD_CLASS = 'tablify__cellcard';

/**
 * The expand affordance for one cell. `fieldName` is the only thing read out to assistive tech, so
 * the control says *which* column it belongs to. Deliberately no `title`: an element carrying both
 * `title` and `aria-label` shows two tooltips (SAD-109, `tests/views/grid/duplicateTooltips`).
 */
export function createExpandControl(fieldName: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tablify__cell-expand';
  button.setAttribute(EXPAND_CONTROL_ATTRIBUTE, '1');
  button.setAttribute('aria-label', `Show full content of ${fieldName}`);
  button.setAttribute('aria-haspopup', 'dialog');
  // Generated SVG markup (src/ui/faIcons.ts) — never user text.
  button.innerHTML = faIcon('up-right-and-down-left-from-center');
  return button;
}

/** Write text to the system clipboard. Best effort: a refused or missing clipboard is silent, like
 *  every other copy in this plugin (`TableView.copyText`). */
export function copyToClipboard(text: string): void {
  void navigator.clipboard?.writeText(text).catch(() => undefined);
}

export interface CellOverflowCardOptions {
  /** The cell's full display text. */
  text: string;
  theme: 'light' | 'dark';
  /** The card's ⤢ button: hand over to the expanded panel. */
  onExpand: () => void;
}

/**
 * SAD-376 — the hover preview card (the reference screenshot): the value wrapped over a few lines
 * with `copy` and `expand` in its top-right corner.
 *
 * Pointer-only and never in the tab order — the panel is the keyboard path. It is anchored and
 * clamped by the same `anchorPanel()` the panels use, so it cannot end up off-screen. The grid owns
 * its lifetime (open delay, exit grace, closing on scroll/render); this class owns its markup.
 */
export class CellOverflowCard {
  private card: HTMLElement | null = null;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly opts: CellOverflowCardOptions) {}

  get isOpen(): boolean {
    return this.card !== null;
  }

  /** The card element while it is open, so the owner can attach its own hover listeners. */
  get element(): HTMLElement | null {
    return this.card;
  }

  /** True when `node` is inside the card — the grid asks this before closing it on a pointer-out. */
  contains(node: Node | null): boolean {
    return !!node && !!this.card && this.card.contains(node);
  }

  open(anchor: HTMLElement): void {
    if (this.card) return;
    const card = document.createElement('div');
    card.className = `${CARD_CLASS} tablify__panel`;
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', 'Cell content preview');
    card.dataset.testid = 'tablify-cell-overflow-card';
    // The panel's theme variables, because the card lives on document.body like every panel.
    applyTheme(card, this.opts.theme);

    const tools = document.createElement('div');
    tools.className = 'tablify__cellcard-tools';
    const copy = this.tool('Copy content', 'copy');
    copy.dataset.testid = 'tablify-cell-overflow-card-copy';
    copy.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(this.opts.text);
      this.confirmCopied(copy);
    });
    const expand = this.tool('Expand cell', 'up-right-and-down-left-from-center');
    expand.dataset.testid = 'tablify-cell-overflow-card-expand';
    expand.setAttribute('aria-haspopup', 'dialog');
    expand.addEventListener('click', (e) => {
      e.stopPropagation();
      this.opts.onExpand();
    });
    tools.append(copy, expand);

    const body = document.createElement('div');
    body.className = 'tablify__cellcard-body';
    body.textContent = this.opts.text;

    card.append(tools, body);
    document.body.appendChild(card);
    anchorPanel(card, anchor);
    this.card = card;
  }

  close(): void {
    if (this.copyTimer !== null) {
      clearTimeout(this.copyTimer);
      this.copyTimer = null;
    }
    this.card?.remove();
    this.card = null;
  }

  private tool(label: string, glyph: 'copy' | 'check' | 'up-right-and-down-left-from-center'): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tablify__cellcard-tool';
    // aria-label only, never with title (SAD-109: two tooltips).
    button.setAttribute('aria-label', label);
    button.innerHTML = faIcon(glyph);
    return button;
  }

  /** Tick the copy button for a moment; the card is too small for a notice. */
  private confirmCopied(button: HTMLButtonElement): void {
    if (this.copyTimer !== null) clearTimeout(this.copyTimer);
    button.innerHTML = faIcon('check');
    this.copyTimer = setTimeout(() => {
      button.innerHTML = faIcon('copy');
      this.copyTimer = null;
    }, COPY_CONFIRM_MS);
  }
}

export interface CellOverflowPanelOptions {
  /** The cell's full display text, exactly as the grid rendered it. */
  text: string;
  /** The field's name — the panel's title. */
  fieldName: string;
  theme: 'light' | 'dark';
  /** Called after the panel is gone. `hadFocus` is true when the keyboard focus was inside it, so
   *  the caller only restores focus to the grid when the panel actually took it. */
  onClosed?: (hadFocus: boolean) => void;
}

/**
 * The expanded view of one cell.
 *
 * The text is wrapped (`pre-wrap`, `overflow-wrap: anywhere`) and capped in height with an internal
 * scroll, so a 5,000-character value stays readable and never runs past the viewport. "Collapse" is
 * simply closing: the cell was never modified.
 */
export class CellOverflowPanel {
  private card: HTMLElement | null = null;
  private unwireDismiss: (() => void) | null = null;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly opts: CellOverflowPanelOptions) {}

  get isOpen(): boolean {
    return this.card !== null;
  }

  /** Anchor the panel under the cell's capsule and take over dismissal. */
  open(anchor: HTMLElement): void {
    if (this.card) return;
    const { card, body } = createPanelCard('tablify-cell-overflow-panel', this.opts.theme, 'tablify__overflow-body');
    card.classList.add('tablify__panel--overflow');

    const head = document.createElement('div');
    head.className = 'tablify__overflow-head';

    const title = document.createElement('span');
    title.className = 'tablify__overflow-title';
    title.textContent = this.opts.fieldName;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tablify__overflow-close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = faIcon('xmark');
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    head.append(title, close);

    const text = document.createElement('div');
    text.className = 'tablify__overflow-text';
    text.setAttribute('tabindex', '-1');
    text.textContent = this.opts.text;

    const foot = document.createElement('div');
    foot.className = 'tablify__overflow-foot';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'tablify__overflow-copy';
    copy.dataset.testid = 'tablify-cell-overflow-copy';
    const copyLabel = document.createElement('span');
    copyLabel.className = 'tablify__overflow-copy-label';
    copyLabel.textContent = 'Copy content';
    copy.appendChild(copyLabel);
    copy.insertAdjacentHTML('afterbegin', faIcon('copy'));
    copy.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(this.opts.text);
      this.confirmCopied(copyLabel);
    });
    foot.appendChild(copy);

    body.append(head, text, foot);
    document.body.appendChild(card);
    anchorPanel(card, anchor);
    // The text takes focus, not a button: Enter then cannot trigger an action the reader did not
    // ask for, and a screen reader starts on the value itself.
    text.focus({ preventScroll: true });
    this.unwireDismiss = wirePanelDismiss(card, () => this.close());
    this.card = card;
  }

  close(): void {
    if (!this.card) return;
    this.unwireDismiss?.();
    this.unwireDismiss = null;
    if (this.copyTimer !== null) {
      clearTimeout(this.copyTimer);
      this.copyTimer = null;
    }
    const hadFocus = this.card.contains(document.activeElement);
    this.card.remove();
    this.card = null;
    this.opts.onClosed?.(hadFocus);
  }

  /** Swap the button's label for a moment so the copy is visible without a Notice. */
  private confirmCopied(label: HTMLElement): void {
    if (this.copyTimer !== null) clearTimeout(this.copyTimer);
    label.textContent = 'Copied';
    this.copyTimer = setTimeout(() => {
      label.textContent = 'Copy content';
      this.copyTimer = null;
    }, COPY_CONFIRM_MS);
  }
}
