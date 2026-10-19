/**
 * SAD-304 — the rating cell's panel: big stars, half-star zones, and a numeric field.
 *
 * The third editor of this shape, after the date picker (COD-75) and the phone panel (SAD-303),
 * and it follows the same three rules:
 *
 *  - it never touches the store; it reports the value the host should write, and the host writes
 *    it as one `setValue` (one undo step);
 *  - an untouched panel hands back the stored value verbatim, so opening and dismissing a cell
 *    writes nothing at all (COD-68);
 *  - the card is the shared `#floatPanel` (createPanelCard + anchorPanel), dismissed by a press
 *    outside or Escape.
 *
 * The star row is a real `role="slider"`: arrow keys walk halves, Page keys walk whole stars,
 * Home/End jump to the ends, Delete clears, and a digit sets that value. The numeric field is the
 * same draft in text form, so a `3.7` that no star can point at is still one keystroke away.
 */

import { faIcon } from '../../../ui/faIcons.js';
import type { CellValue, FieldDefinition } from '../../../model/types.js';
import { anchorPanel, createPanelCard } from '../select/panel.js';
import { ratingScale } from '../cellRender.js';
import {
  parseRatingInput,
  ratingNumber,
  ratingValueText,
  roundRating,
  starFills,
} from './scale.js';

export interface RatingPanelOptions {
  field: FieldDefinition;
  value: CellValue | undefined;
  theme?: 'light' | 'dark';
  /** The value to store (`null` clears). The host writes it and returns focus to the grid. */
  onCommit: (value: CellValue) => void;
  /** Escape, or a dismissal that must not write. */
  onCancel?: () => void;
}

let uid = 0;

function element(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function button(className: string, label: string): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = label;
  return node;
}

export class RatingPanel {
  private readonly opts: RatingPanelOptions;
  private readonly scale: number;
  private readonly card: HTMLElement;
  private readonly slider: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly hint: HTMLElement;
  private readonly clearBtn: HTMLButtonElement;
  private readonly doneBtn: HTMLButtonElement;
  private readonly ids = { hint: `tablify-rating-hint-${(uid += 1)}` };

  /** The value as it arrived — handed back untouched while the panel is clean. */
  private readonly original: CellValue;
  private draft: number | null;
  private invalid = false;
  private errorText = '';
  private closed = false;
  private dragging = false;
  private unwire: (() => void) | null = null;

  constructor(options: RatingPanelOptions) {
    this.opts = options;
    this.scale = ratingScale(options.field);
    this.original = options.value ?? null;
    this.draft = ratingNumber(options.value);

    const { card, body } = createPanelCard('tablify-rating-panel', options.theme ?? 'light', 'tablify__dropdown-body');
    card.classList.add('tablify__rating-panel');
    card.setAttribute('aria-label', `Rating: ${options.field.name}`);
    this.card = card;

    const head = element('div', 'tablify__rating-head');

    this.slider = element('div', 'tablify__rating-stars');
    this.slider.setAttribute('role', 'slider');
    this.slider.setAttribute('tabindex', '0');
    this.slider.setAttribute('aria-label', `Rating for ${options.field.name}`);
    this.slider.setAttribute('aria-valuemin', '0');
    this.slider.setAttribute('aria-valuemax', String(this.scale));
    this.slider.addEventListener('keydown', (event) => this.onSliderKey(event));
    this.slider.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    this.slider.addEventListener('pointermove', (event) => this.onPointerMove(event));
    this.slider.addEventListener('pointerup', () => {
      this.dragging = false;
    });
    this.slider.addEventListener('pointercancel', () => {
      this.dragging = false;
    });
    head.appendChild(this.slider);

    this.caption = element('div', 'tablify__rating-caption');
    this.caption.setAttribute('aria-live', 'polite');
    head.appendChild(this.caption);
    body.appendChild(head);

    const row = element('div', 'tablify__rating-row');
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'tablify__dropdown-input tablify__rating-input';
    this.input.inputMode = 'decimal';
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.input.setAttribute('aria-label', 'Rating value');
    this.input.setAttribute('aria-describedby', this.ids.hint);
    this.input.addEventListener('input', () => this.onInput());
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        if (!this.invalid) this.commit();
      }
    });
    row.appendChild(this.input);

    const scaleText = element('span', 'tablify__rating-scale');
    scaleText.textContent = `/ ${this.scale}`;
    scaleText.setAttribute('aria-hidden', 'true');
    row.appendChild(scaleText);
    body.appendChild(row);

    this.hint = element('div', 'tablify__rating-hint');
    this.hint.id = this.ids.hint;
    this.hint.hidden = true;
    body.appendChild(this.hint);

    const actions = element('div', 'tablify__rating-actions');
    this.clearBtn = button('tablify__rating-clear', 'Clear');
    this.clearBtn.addEventListener('click', () => {
      this.input.value = '';
      this.setDraft(null);
      this.input.focus();
    });
    this.doneBtn = button('tablify__rating-done tablify__pmodal-btn tablify__pmodal-btn--primary', 'Done');
    this.doneBtn.addEventListener('click', () => this.commit());
    actions.appendChild(this.clearBtn);
    actions.appendChild(this.doneBtn);
    body.appendChild(actions);

    this.paint();
    this.input.value = this.draft === null ? '' : String(this.draft);
  }

  /** The card, appended to `document.body` by {@link open}. */
  get element(): HTMLElement {
    return this.card;
  }

  open(anchor: HTMLElement): void {
    if (this.closed) return;
    document.body.appendChild(this.card);
    anchorPanel(this.card, anchor);

    const onPress = (ev: Event): void => {
      if (this.card.contains(ev.target as Node)) return;
      // Leaving the panel is a decision: keep a valid change, discard an invalid one, and write
      // nothing at all when the draft never moved (the COD-68 rule).
      if (this.invalid) this.cancel();
      else this.commit();
    };
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      ev.stopPropagation();
      this.cancel();
    };
    document.addEventListener('mousedown', onPress);
    document.addEventListener('touchstart', onPress, { passive: true } as EventListenerOptions);
    document.addEventListener('keydown', onKey, true);
    this.unwire = () => {
      document.removeEventListener('mousedown', onPress);
      document.removeEventListener('touchstart', onPress, { passive: true } as EventListenerOptions);
      document.removeEventListener('keydown', onKey, true);
    };

    this.slider.focus();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.unwire?.();
    this.unwire = null;
    this.card.remove();
  }

  // ---- draft --------------------------------------------------------------------------

  private setDraft(next: number | null): void {
    this.draft = next === null ? null : roundRating(next);
    this.invalid = false;
    this.errorText = '';
    this.paint();
  }

  private onInput(): void {
    const parsed = parseRatingInput(this.input.value, this.scale);
    if (!parsed.ok) {
      this.invalid = true;
      this.errorText = parsed.error;
      this.paint();
      return;
    }
    this.draft = parsed.value;
    this.invalid = false;
    this.errorText = '';
    this.paint();
  }

  private onSliderKey(event: KeyboardEvent): void {
    const current = this.draft ?? 0;
    let next: number | null | undefined;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.min(this.scale, current + 0.5);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.max(0, current - 0.5);
        break;
      case 'PageUp':
        next = Math.min(this.scale, current + 1);
        break;
      case 'PageDown':
        next = Math.max(0, current - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = this.scale;
        break;
      case 'Delete':
      case 'Backspace':
        next = null;
        break;
      case 'Enter':
        event.preventDefault();
        this.commit();
        return;
      default: {
        if (!/^[0-9]$/.test(event.key)) return;
        next = Math.min(this.scale, Number(event.key));
        break;
      }
    }
    event.preventDefault();
    this.input.value = next === null ? '' : String(next);
    this.setDraft(next);
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    this.dragging = true;
    try {
      this.slider.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic pointer (tests, some touch stacks) has no capture to take; dragging still works.
    }
    this.slider.focus();
    this.pickAt(event.clientX);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;
    this.pickAt(event.clientX);
  }

  private pickAt(clientX: number): void {
    const rect = this.slider.getBoundingClientRect();
    const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0;
    // Half-star zones: the left half of a star is x.5, the right half is x.
    const raw = Math.ceil((ratio * this.scale) / 0.5) * 0.5;
    const next = roundRating(Math.max(0.5, Math.min(this.scale, raw)));
    this.input.value = String(next);
    this.setDraft(next);
  }

  // ---- paint --------------------------------------------------------------------------

  private paint(): void {
    const fills = starFills(this.draft, this.scale);
    this.slider.replaceChildren();
    for (let i = 0; i < this.scale; i += 1) {
      const fill = fills[i] ?? 0;
      const star = element(
        'span',
        fill >= 1
          ? 'tablify__star tablify__star--on'
          : fill > 0
            ? 'tablify__star tablify__star--partial'
            : 'tablify__star',
      );
      const box = element('span', 'tablify__star-box');
      const base = element('span', 'tablify__star-base');
      base.innerHTML = faIcon('star', 20);
      const painted = element('span', 'tablify__star-fill');
      painted.style.width = `${Math.round(fill * 1000) / 10}%`;
      painted.innerHTML = faIcon('star', 20);
      box.appendChild(base);
      box.appendChild(painted);
      star.appendChild(box);
      this.slider.appendChild(star);
    }

    // `paint` never rewrites the input: the text is the user's while they type (`4.` and `04`
    // stay exactly as typed), and every other control writes the input before it calls here.
    this.slider.setAttribute('aria-valuenow', String(this.draft ?? 0));
    this.slider.setAttribute('aria-valuetext', ratingValueText(this.draft, this.scale));
    this.caption.textContent = ratingValueText(this.draft, this.scale);
    if (this.invalid) this.input.setAttribute('aria-invalid', 'true');
    else this.input.removeAttribute('aria-invalid');
    this.hint.hidden = !this.invalid;
    this.hint.textContent = this.invalid ? this.errorText : '';
    this.doneBtn.disabled = this.invalid;
    this.clearBtn.disabled = this.draft === null;
  }

  // ---- outcomes -----------------------------------------------------------------------

  private commit(): void {
    if (this.closed || this.invalid) return;
    const next = this.draft;
    this.close();
    this.opts.onCommit(next);
  }

  private cancel(): void {
    if (this.closed) return;
    this.close();
    this.opts.onCancel?.();
  }
}
