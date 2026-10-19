/**
 * The phone cell's panel (SAD-303) — the fourth screen in the anchored `#floatPanel` card, after
 * select, attachment and the date picker (COD-75).
 *
 * Two views, one card: the number view (country trigger, number field, live preview) and the
 * country view (the searchable list). They share a card on purpose — a second panel would make
 * dismissal race with the first.
 *
 * The panel never touches the store. It reports the value the host should write, and the host does
 * that as one `setValue` (one undo step). An untouched panel returns the stored value verbatim, so
 * opening and dismissing a cell writes nothing at all (COD-68).
 *
 * The stored form is the model's rule, not the panel's: `toE164()` when the number is valid, the
 * typed text when it is not (`phoneType.parse`). The panel only decides what to *show*.
 */

import { faIcon } from '../../../ui/faIcons.js';
import type { CellValue, FieldDefinition } from '../../../model/types.js';
import { anchorPanel, createPanelCard } from '../select/panel.js';
import { CountryList } from './CountryList.js';
import { countryRow, type CountryRow } from '../../../model/phone/countries.js';
import {
  defaultCountryFor,
  formatAsYouType,
  formatPhoneDisplay,
  parsePhone,
  regionOfLocale,
  splitStored,
  toE164,
} from '../../../model/phone/phoneValue.js';

export interface PhonePanelOptions {
  field: FieldDefinition;
  value: CellValue | undefined;
  theme?: 'light' | 'dark';
  /** BCP-47 tag for country names and the reader's fallback. Defaults to the platform's. */
  locale?: string;
  /** The value to store (null clears). The host writes it and returns focus to the grid. */
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
  node.setAttribute('aria-label', label);
  return node;
}

export class PhonePanel {
  private readonly opts: PhonePanelOptions;
  private readonly locale: string;
  private readonly card: HTMLElement;
  private readonly body: HTMLElement;
  private readonly numberView: HTMLElement;
  private readonly countryView: HTMLElement;
  private readonly trigger: HTMLButtonElement;
  private readonly triggerBadge: HTMLElement;
  private readonly triggerText: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly preview: HTMLElement;
  private readonly clearBtn: HTMLButtonElement;
  private readonly backBtn: HTMLButtonElement;
  private readonly ids = { number: `tablify-phone-number-${(uid += 1)}`, preview: `tablify-phone-preview-${uid}` };

  /** The country the national text is being read in. */
  private country: string;
  /** The stored value as it arrived — returned untouched while the panel is clean. */
  private readonly original: CellValue;
  private dirty = false;
  private showCountry = false;
  private list: CountryList | null = null;
  private closed = false;
  private unwire: (() => void) | null = null;

  constructor(options: PhonePanelOptions) {
    this.opts = options;
    this.locale = options.locale ?? '';
    this.original = options.value ?? null;

    const { card, body } = createPanelCard('tablify-phone-panel', options.theme ?? 'light', 'tablify__dropdown-body');
    card.setAttribute('aria-label', `Phone: ${options.field.name}`);
    card.classList.add('tablify__phone-panel');
    this.card = card;
    this.body = body;

    // ---- number view -------------------------------------------------------------------
    this.numberView = element('div', 'tablify__phone-view tablify__phone-view--number');
    const row = element('div', 'tablify__phone-row');

    this.trigger = button('tablify__phone-country', 'Change country');
    this.trigger.setAttribute('aria-haspopup', 'listbox');
    this.trigger.setAttribute('aria-expanded', 'false');
    this.triggerBadge = element('span', 'tablify__country-badge');
    this.triggerBadge.setAttribute('aria-hidden', 'true');
    this.triggerText = element('span', 'tablify__phone-country-text');
    this.trigger.appendChild(this.triggerBadge);
    this.trigger.appendChild(this.triggerText);
    const chevron = element('span', 'tablify__phone-country-chevron');
    chevron.innerHTML = faIcon('chevron-down', 11);
    chevron.setAttribute('aria-hidden', 'true');
    this.trigger.appendChild(chevron);
    this.trigger.addEventListener('click', () => this.openCountryView());

    this.input = document.createElement('input');
    this.input.type = 'tel';
    this.input.className = 'tablify__dropdown-input tablify__phone-input';
    this.input.id = this.ids.number;
    this.input.autocomplete = 'tel-national';
    this.input.spellcheck = false;
    this.input.setAttribute('aria-label', 'Phone number');
    this.input.setAttribute('aria-describedby', this.ids.preview);

    row.appendChild(this.trigger);
    row.appendChild(this.input);
    this.numberView.appendChild(row);

    this.preview = element('div', 'tablify__phone-preview');
    this.preview.id = this.ids.preview;
    this.preview.setAttribute('role', 'status');
    this.preview.setAttribute('aria-live', 'polite');
    this.numberView.appendChild(this.preview);

    const foot = element('div', 'tablify__phone-foot');
    this.clearBtn = button('tablify__phone-clear', 'Clear');
    this.clearBtn.textContent = 'Clear';
    this.clearBtn.addEventListener('click', () => this.clear());
    const done = button('tablify__phone-done tablify__pmodal-btn tablify__pmodal-btn--primary', 'Done');
    done.textContent = 'Done';
    done.addEventListener('click', () => this.commit());
    foot.appendChild(this.clearBtn);
    foot.appendChild(done);
    this.numberView.appendChild(foot);

    // ---- country view ------------------------------------------------------------------
    this.countryView = element('div', 'tablify__phone-view tablify__phone-view--country');
    this.countryView.hidden = true;
    const head = element('div', 'tablify__phone-country-head');
    this.backBtn = button('tablify__phone-back', 'Back to the number');
    this.backBtn.innerHTML = faIcon('chevron-left', 12);
    this.backBtn.addEventListener('click', () => this.closeCountryView());
    const headTitle = element('span', 'tablify__phone-country-title');
    headTitle.textContent = 'Country';
    head.appendChild(this.backBtn);
    head.appendChild(headTitle);
    this.countryView.appendChild(head);

    this.body.appendChild(this.numberView);
    this.body.appendChild(this.countryView);

    this.input.addEventListener('compositionstart', () => (this.composing = true));
    this.input.addEventListener('compositionend', () => {
      this.composing = false;
      this.onInput();
    });
    this.input.addEventListener('input', () => {
      if (!this.composing) this.onInput();
    });
    this.input.addEventListener('keydown', (event) => this.onKey(event));

    // Where the value belongs: its own country, else the field's default, else the reader's.
    const parts = splitStored(this.original, options.field, this.locale);
    this.country = parts.country ?? defaultCountryFor(options.field, this.locale);
    if (this.original !== null && this.original !== '') {
      // A stored E.164 opens in the national form, ready to extend; anything else opens verbatim.
      this.input.value = parts.e164 ? parts.national : String(this.original);
    }
    this.paintCountry();
    this.paintPreview();
  }

  private composing = false;

  get element(): HTMLElement {
    return this.card;
  }

  /** Anchor under the cell and take the dismiss bindings. Focus lands in the number field. */
  open(anchor: HTMLElement): void {
    if (this.closed) return;
    document.body.appendChild(this.card);
    anchorPanel(this.card, anchor);

    const onPress = (ev: Event): void => {
      if (this.card.contains(ev.target as Node)) return;
      // The old inline editor committed on blur; a panel left untouched writes nothing.
      if (this.dirty) this.commit();
      else this.cancel();
    };
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      if (this.showCountry) {
        this.closeCountryView();
        return;
      }
      this.cancel();
    };
    document.addEventListener('mousedown', onPress);
    document.addEventListener('touchstart', onPress, { passive: true });
    document.addEventListener('keydown', onKey);
    this.unwire = () => {
      document.removeEventListener('mousedown', onPress);
      document.removeEventListener('touchstart', onPress, { passive: true } as EventListenerOptions);
      document.removeEventListener('keydown', onKey);
    };

    this.input.focus();
    const end = this.input.value.length;
    try {
      this.input.setSelectionRange(end, end);
    } catch {
      // No selection ranges without a layout; focus is enough.
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.unwire?.();
    this.unwire = null;
    this.list?.destroy();
    this.list = null;
    this.card.remove();
  }

  // ---- number view -------------------------------------------------------------------

  private onInput(): void {
    this.dirty = true;
    // A pasted or typed international number moves the country to the one it names. A national
    // number never does: guessing a country is how a value gets corrupted.
    const text = this.input.value.trim();
    if (text.startsWith('+')) {
      const parsed = parsePhone(text, this.country);
      if (parsed.e164 && parsed.country && parsed.country !== this.country) {
        this.country = parsed.country;
        this.paintCountry();
      }
    }
    const formatted = formatAsYouType(this.input.value, this.country);
    if (formatted !== this.input.value) {
      const end = formatted.length;
      this.input.value = formatted;
      try {
        this.input.setSelectionRange(end, end);
      } catch {
        // See open().
      }
    }
    this.paintPreview();
  }

  private onKey(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commit();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.showCountry) this.closeCountryView();
      else this.cancel();
      return;
    }
    if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      this.openCountryView();
    }
  }

  private paintCountry(): void {
    const row = countryRow(this.country, this.locale);
    this.triggerBadge.textContent = row ? row.iso : '—';
    this.triggerText.textContent = row ? `+${row.dial}` : '';
    this.trigger.title = row ? `${row.name} (+${row.dial})` : 'Choose a country';
  }

  private paintPreview(): void {
    const text = this.input.value.trim();
    this.clearBtn.disabled = this.original === null && text === '';
    if (text === '') {
      this.preview.textContent = 'Empty — the cell will be cleared.';
      this.preview.dataset.state = 'empty';
      return;
    }
    const parsed = parsePhone(text, this.country);
    if (parsed.e164) {
      this.preview.textContent = `${formatPhoneDisplay(parsed.e164)}  ✓`;
      this.preview.dataset.state = 'valid';
      return;
    }
    const row = countryRow(this.country, this.locale);
    this.preview.textContent = row ? `Not a valid number for ${row.name}.` : 'Not a valid number.';
    this.preview.dataset.state = 'invalid';
  }

  /** What a commit would store, following the field type's own parse rule. */
  private storedNow(): CellValue {
    const text = this.input.value.trim();
    if (text === '') return null;
    return toE164(text, this.country) ?? text;
  }

  private commit(): void {
    if (this.closed) return;
    const next = this.dirty ? this.storedNow() : this.original;
    this.close();
    this.opts.onCommit(next ?? null);
  }

  private clear(): void {
    if (this.closed) return;
    this.dirty = true;
    this.input.value = '';
    this.paintPreview();
    this.commit();
  }

  private cancel(): void {
    if (this.closed) return;
    this.close();
    this.opts.onCancel?.();
  }

  // ---- country view ------------------------------------------------------------------

  private openCountryView(): void {
    if (this.closed || this.showCountry) return;
    this.showCountry = true;
    this.numberView.hidden = true;
    this.countryView.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true');

    if (!this.list) {
      const suggested = [this.country, defaultCountryFor(this.opts.field, this.locale)]
        .concat(regionOfLocale(this.locale || (typeof navigator !== 'undefined' ? navigator.language : '')) ?? []);
      this.list = new CountryList({
        locale: this.locale || 'en',
        suggested,
        selected: this.country,
        idPrefix: `tablify-phone-countries-${uid}`,
        onPick: (row) => this.pickCountry(row),
        // Escape inside the list leaves the country view, then the panel handles its own Escape.
        onCancel: () => this.closeCountryView(),
      });
      this.countryView.appendChild(this.list.element);
    } else {
      this.list.setSelected(this.country);
    }
    this.list.focus();
  }

  private closeCountryView(): void {
    if (!this.showCountry) return;
    this.showCountry = false;
    this.countryView.hidden = true;
    this.numberView.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'false');
    this.input.focus();
  }

  private pickCountry(row: CountryRow): void {
    this.country = row.iso;
    this.dirty = true;
    this.paintCountry();
    this.list?.setSelected(row.iso);
    this.closeCountryView();
    // The same digits read in a new country: show what they now mean.
    this.input.value = formatAsYouType(this.input.value, this.country);
    this.paintPreview();
  }
}
