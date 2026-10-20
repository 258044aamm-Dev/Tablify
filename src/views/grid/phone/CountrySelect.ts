/**
 * The phone field's "Default country" control (SAD-303), for Add / Modify Field.
 *
 * A trigger row inside the window, and a popover on `document.body` — the pattern
 * `FieldTypePicker` established (COD-76): the window is an `overflow: auto` Obsidian modal that
 * would clip an in-flow list, and the popover has to sit above the modal's own layer, so it is
 * attached to the body, anchored to the trigger's rect, and closed on a press outside, Escape,
 * a resize or any scroll.
 *
 * What it may change: the ISO code the window later saves. It never touches the model, the
 * save path or the file: the caller receives the pick and decides.
 */

import { CountryList } from './CountryList.js';
import { paintCountryMark } from './countryMark.js';
import { countryRow, type CountryRow } from '../../../model/phone/countries.js';
import { applyTheme } from '../../../ui/theme/tokens.js';
import { faIcon } from '../../../ui/faIcons.js';

export interface CountrySelectOptions {
  /** The window's id for the row, e.g. `tablify__af-country`. */
  id: string;
  /** Current ISO code, or '' for "no default". */
  value: string;
  /** ISO codes drawn first in the list. Order is kept. */
  suggested?: readonly string[];
  locale?: string;
  theme?: 'light' | 'dark';
  /** A country was chosen, or null when "No default" was picked. */
  onChange: (iso: string | null) => void;
}

export class CountrySelect {
  private readonly opts: CountrySelectOptions;
  private readonly locale: string;
  private readonly trigger: HTMLButtonElement;
  private readonly triggerLabel: HTMLElement;
  /** SAD-355: the flag/monogram in front of the label. */
  private readonly triggerMark: HTMLElement;
  private panel: HTMLElement | null = null;
  private list: CountryList | null = null;
  private unwire: (() => void) | null = null;
  private value: string;

  constructor(options: CountrySelectOptions) {
    this.opts = options;
    this.locale = options.locale ?? 'en';
    this.value = options.value;

    this.trigger = document.createElement('button');
    this.trigger.type = 'button';
    this.trigger.className = 'tablify__pmodal-input tablify__country-trigger';
    this.trigger.id = options.id;
    this.trigger.setAttribute('aria-haspopup', 'listbox');
    this.trigger.setAttribute('aria-expanded', 'false');

    // SAD-355: the trigger leads with the country's flag too — one country, one mark.
    this.triggerMark = document.createElement('span');
    this.triggerMark.setAttribute('aria-hidden', 'true');
    this.trigger.appendChild(this.triggerMark);

    this.triggerLabel = document.createElement('span');
    this.triggerLabel.className = 'tablify__country-trigger-label';
    this.trigger.appendChild(this.triggerLabel);

    const chevron = document.createElement('span');
    chevron.className = 'tablify__country-trigger-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = faIcon('chevron-down', 11);
    this.trigger.appendChild(chevron);

    this.trigger.addEventListener('click', () => {
      if (this.panel) this.close();
      else this.open();
    });
    this.paint();
  }

  /** The trigger element to place in the window. */
  get element(): HTMLElement {
    return this.trigger;
  }

  /** The chosen ISO code ('' when there is no default). */
  getValue(): string {
    return this.value;
  }

  /** Set the value from outside (edit mode pre-fill, reset). */
  setValue(iso: string | null): void {
    this.value = iso ?? '';
    this.paint();
  }

  /** True while the popover is open — the window uses it to keep Escape for the popover. */
  get isOpen(): boolean {
    return this.panel !== null;
  }

  close(): void {
    this.unwire?.();
    this.unwire = null;
    this.list?.destroy();
    this.list = null;
    this.panel?.remove();
    this.panel = null;
    this.trigger.setAttribute('aria-expanded', 'false');
  }

  // ---- internals ----------------------------------------------------------------------

  private paint(): void {
    const row = this.value ? countryRow(this.value, this.locale) : undefined;
    paintCountryMark(this.triggerMark, row ? row.iso : null);
    this.triggerLabel.textContent = row ? `${row.name}  +${row.dial}` : 'No default — use my region';
    this.trigger.classList.toggle('tablify__country-trigger--empty', !row);
  }

  private open(): void {
    const card = document.createElement('div');
    card.className = 'tablify__panel tablify__country-popover';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Default country');
    applyTheme(card, this.opts.theme ?? 'light');

    const body = document.createElement('div');
    body.className = 'tablify__dropdown-body tablify__country-popover-body';
    card.appendChild(body);

    this.list = new CountryList({
      locale: this.locale,
      suggested: this.opts.suggested,
      selected: this.value || null,
      onPick: (row) => {
        this.setValue(row.iso);
        this.opts.onChange(row.iso);
        this.close();
        this.trigger.focus();
      },
      onCancel: () => {
        this.close();
        this.trigger.focus();
      },
      idPrefix: `${this.opts.id}-list`,
    });
    body.appendChild(this.list.element);

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'tablify__dropdown-clear tablify__country-clear';
    clear.textContent = 'No default (use my region)';
    clear.disabled = this.value === '';
    clear.addEventListener('click', () => {
      this.setValue(null);
      this.opts.onChange(null);
      this.close();
      this.trigger.focus();
    });
    body.appendChild(clear);

    document.body.appendChild(card);
    this.panel = card;
    this.trigger.setAttribute('aria-expanded', 'true');
    this.position();
    this.list.focus();
    this.wireDismiss();
  }

  /** Trigger width, 6 px below, flipped above when there is no room, and never off screen. */
  private position(): void {
    const card = this.panel;
    if (!card) return;
    const r = this.trigger.getBoundingClientRect();
    const vw = window.innerWidth || 1024;
    const vh = window.innerHeight || 768;
    const width = Math.min(Math.max(r.width, 260), vw - 32);
    const left = Math.max(8, Math.min(r.left, vw - width - 12));

    card.style.position = 'fixed';
    card.style.width = `${width}px`;
    card.style.left = `${left}px`;
    card.style.zIndex = '1000';

    const height = card.getBoundingClientRect().height;
    const below = r.bottom + 6;
    const flip = below + height > vh - 8 && r.top - height - 6 > 8;
    card.style.top = `${Math.max(8, flip ? r.top - height - 6 : below)}px`;
  }

  private wireDismiss(): void {
    const onPress = (ev: Event): void => {
      const target = ev.target as Node;
      if (this.panel?.contains(target) || this.trigger.contains(target)) return;
      this.close();
    };
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') {
        // Escape closes the popover first; the window keeps its own Escape handling after that.
        ev.stopPropagation();
        this.close();
        this.trigger.focus();
      }
    };
    const onMove = (): void => this.position();
    // A scroll anywhere but inside the list moves the trigger out from under the popover, so the
    // popover closes (scrolling the list itself must not).
    const onScroll = (ev: Event): void => {
      // The scroll of a document or of the window itself has no Node target (the event's target
      // is the window), so the containment test is guarded rather than cast.
      if (ev.target instanceof Node && this.panel?.contains(ev.target)) return;
      this.close();
    };
    document.addEventListener('pointerdown', onPress, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onScroll, true);
    this.unwire = () => {
      document.removeEventListener('pointerdown', onPress, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onScroll, true);
    };
  }
}

export type { CountryRow };
