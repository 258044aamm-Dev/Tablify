/**
 * @vitest-environment jsdom
 *
 * SAD-303 — the phone panel: markup, live formatting, commit/cancel, the country view, and the
 * one promise that matters most: a panel opened and dismissed writes nothing.
 *
 * The card is the same `#floatPanel` the select/attachment/date panels use, so these tests check
 * the inside only — where the value comes from, what it becomes, and what the host is told.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { PhonePanel, type PhonePanelOptions } from '../../../src/views/grid/phone/PhonePanel.js';
import type { CellValue, FieldDefinition } from '../../../src/model/types.js';

function field(phoneCountry?: string): FieldDefinition {
  return { id: 'fld_p', name: 'Phone', type: 'phone', ...(phoneCountry ? { phoneCountry } : {}) } as FieldDefinition;
}

interface Harness {
  panel: PhonePanel;
  card: HTMLElement;
  commits: CellValue[];
  cancels: ReturnType<typeof vi.fn>;
  input: HTMLInputElement;
  trigger: HTMLButtonElement;
  preview: HTMLElement;
}

function mount(overrides: Partial<PhonePanelOptions> = {}): Harness {
  const commits: CellValue[] = [];
  const cancels = vi.fn();
  const panel = new PhonePanel({
    field: field('BD'),
    value: null,
    locale: 'en-GB',
    onCommit: (v) => commits.push(v),
    onCancel: cancels,
    ...overrides,
  });
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  panel.open(anchor);
  const card = panel.element;
  return {
    panel,
    card,
    commits,
    cancels,
    input: card.querySelector('input.tablify__phone-input') as HTMLInputElement,
    trigger: card.querySelector('button.tablify__phone-country') as HTMLButtonElement,
    preview: card.querySelector('.tablify__phone-preview') as HTMLElement,
  };
}

function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

function view(card: HTMLElement, which: 'number' | 'country'): HTMLElement {
  return card.querySelector(`.tablify__phone-view--${which}`) as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('SAD-303 — the panel is the fourth #floatPanel screen', () => {
  it('opens as a dialog on the body, focused in the number field', () => {
    const { card, input } = mount();
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.dataset.testid).toBe('tablify-phone-panel');
    expect(card.parentElement).toBe(document.body);
    expect(document.activeElement).toBe(input);
    expect(input.type).toBe('tel');
  });

  it('starts in the field default country and shows its badge and dial code', () => {
    const { card, trigger } = mount();
    expect(trigger.textContent).toContain('BD');
    expect(trigger.textContent).toContain('+880');
    expect(card.querySelector('.tablify__country-badge')?.textContent).toBe('BD');
  });

  it('falls back to the reader region when the field has no default', () => {
    const { trigger } = mount({ field: field(), locale: 'en-GB' });
    expect(trigger.textContent).toContain('+44');
  });

  it('opens a stored E.164 in its national form', () => {
    const { input, preview } = mount({ value: '+8801712345678' });
    expect(input.value).toBe('01712-345678');
    expect(preview.textContent).toContain('+880 1712 345678');
    expect(preview.dataset.state).toBe('valid');
  });

  it('opens a value it cannot parse exactly as stored', () => {
    const { input } = mount({ value: 'call me maybe' });
    expect(input.value).toBe('call me maybe');
  });
});

describe('SAD-303 — typing, preview and countries', () => {
  it('formats a national number as it is typed and previews the international form', () => {
    const { input, preview } = mount();
    type(input, '01712345678');
    expect(input.value).toBe('01712-345678');
    expect(preview.textContent).toContain('+880 1712 345678');
    expect(preview.dataset.state).toBe('valid');
  });

  it('says honestly when a number is not valid for the country', () => {
    const { input, preview } = mount();
    type(input, '12345');
    expect(preview.dataset.state).toBe('invalid');
    expect(preview.textContent).toContain('Bangladesh');
  });

  it('moves to the country an international number names, and never guesses for a national one', () => {
    const { input, trigger } = mount();
    type(input, '+14155552671');
    expect(trigger.textContent).toContain('US');
    expect(trigger.textContent).toContain('+1');

    type(input, '01712345678');
    expect(trigger.textContent).toContain('US');
  });

  it('the country view filters, and picking one re-reads the same digits', () => {
    const { card, input, trigger } = mount();
    type(input, '4155552671');
    trigger.click();
    expect(view(card, 'country').hidden).toBe(false);
    expect(view(card, 'number').hidden).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const search = card.querySelector('.tablify__country-list')?.previousElementSibling as HTMLInputElement;
    search.value = 'united states';
    search.dispatchEvent(new Event('input'));
    const row = Array.from(card.querySelectorAll<HTMLButtonElement>('.tablify__country-row')).find(
      (r) => r.dataset.iso === 'US',
    );
    row?.click();

    expect(view(card, 'number').hidden).toBe(false);
    expect(trigger.textContent).toContain('US');
    expect(input.value).toBe('(415) 555-2671');
  });

  it('Escape leaves the country view before it cancels the panel', () => {
    const { card, trigger, cancels } = mount();
    trigger.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(view(card, 'number').hidden).toBe(false);
    expect(cancels).not.toHaveBeenCalled();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cancels).toHaveBeenCalledTimes(1);
  });

  it('the back button returns to the number', () => {
    const { card, trigger } = mount();
    trigger.click();
    (card.querySelector('button.tablify__phone-back') as HTMLButtonElement).click();
    expect(view(card, 'number').hidden).toBe(false);
  });
});

describe('SAD-303 — what leaves the panel', () => {
  it('Enter commits the E.164 form', () => {
    const { input, commits } = mount();
    type(input, '01712345678');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(commits).toEqual(['+8801712345678']);
  });

  it('Done commits too, and the card is gone', () => {
    const { card, input, commits } = mount();
    type(input, '01712345678');
    (card.querySelector('button.tablify__phone-done') as HTMLButtonElement).click();
    expect(commits).toEqual(['+8801712345678']);
    expect(document.querySelector('.tablify__phone-panel')).toBeNull();
  });

  it('a value it cannot validate is stored as typed, never reshaped', () => {
    const { input, commits } = mount();
    type(input, '12345');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(commits).toEqual(['12345']);
  });

  it('an untouched panel reports the stored value verbatim', () => {
    const { card, commits } = mount({ value: '+8801712345678' });
    (card.querySelector('button.tablify__phone-done') as HTMLButtonElement).click();
    expect(commits).toEqual(['+8801712345678']);
  });

  it('Escape cancels; a press outside commits when dirty and cancels when untouched', () => {
    const first = mount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(first.cancels).toHaveBeenCalledTimes(1);
    expect(first.commits).toEqual([]);

    const second = mount();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(second.cancels).toHaveBeenCalledTimes(1);
    expect(second.commits).toEqual([]);

    const third = mount();
    type(third.input, '01712345678');
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(third.commits).toEqual(['+8801712345678']);
  });

  it('Clear writes null and closes', () => {
    const { card, commits } = mount({ value: '+8801712345678' });
    (card.querySelector('button.tablify__phone-clear') as HTMLButtonElement).click();
    expect(commits).toEqual([null]);
  });

  it('Clear is disabled only when there is nothing to clear', () => {
    const empty = mount();
    expect((empty.card.querySelector('button.tablify__phone-clear') as HTMLButtonElement).disabled).toBe(true);

    const filled = mount({ value: '+8801712345678' });
    expect((filled.card.querySelector('button.tablify__phone-clear') as HTMLButtonElement).disabled).toBe(false);
  });

  it('an empty number previews that the cell will be cleared', () => {
    const { input, preview } = mount();
    type(input, '');
    expect(preview.dataset.state).toBe('empty');
    expect(preview.textContent).toContain('cleared');
  });

  it('close() removes the listeners: a later Escape reaches nothing', () => {
    const { panel, cancels } = mount();
    panel.close();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(cancels).not.toHaveBeenCalled();
  });

  it('reads a national value in the field default, and leaves it alone when untouched', () => {
    const { card, input, trigger, commits } = mount({ value: '01712345678', field: field('BD') });
    expect(input.value).toBe('01712-345678');
    expect(trigger.textContent).toContain('BD');
    (card.querySelector('button.tablify__phone-done') as HTMLButtonElement).click();
    // No edit, so the stored text goes back exactly as it came — the host writes nothing.
    expect(commits).toEqual(['01712345678']);
  });

  it('typing in that field commits the E.164 form', () => {
    const { input, commits } = mount({ value: '01712345678', field: field('BD') });
    type(input, '01712345679');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(commits).toEqual(['+8801712345679']);
  });
});
