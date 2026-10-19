/**
 * @vitest-environment jsdom
 *
 * SAD-303 — the country control: the shared list, the popover in Add / Modify Field, and the
 * model rules behind it. The list is also what the phone cell panel opens in step 3, so these
 * tests are the behaviour of both hosts: search, keyboard, suggested group, ticked row, and the
 * guarantee that none of it leaks into the document after a close.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CountryList } from '../../../src/views/grid/phone/CountryList.js';
import { CountrySelect } from '../../../src/views/grid/phone/CountrySelect.js';
import { AddFieldModal } from '../../../src/views/grid/AddFieldModal.js';
import { App, Modal } from 'obsidian';
import { cleanupPickers, pickType } from './typePickerSupport.js';
import { createSession } from '../../../src/model/tableSession.js';
import { applyNewFieldExtras } from '../../../src/model/tableSession.js';
import { planTypeChange } from '../../../src/model/fieldChange.js';
import type { FieldDefinition, TablifyFile } from '../../../src/model/types.js';

// ---- model ------------------------------------------------------------------------------

const VIEW = {
  id: 'view_default',
  name: 'Default',
  sort: [],
  groupBy: null,
  hidden: [],
  columnOrder: ['fld_a'],
  frozenColumns: 1,
  rowHeight: 'medium' as const,
  columnWidths: {},
};

function makeFile(): TablifyFile {
  return {
    formatVersion: 1,
    tableId: 'tbl_TEST',
    name: 'Test',
    fields: [{ id: 'fld_a', name: 'A', type: 'text', primary: true }],
    rows: [],
    views: [VIEW],
    syncLink: null,
  };
}

describe('the model keeps phoneCountry on phone fields only (SAD-303)', () => {
  it('adds the default country to a new phone field and ignores it for other types', () => {
    const phone: FieldDefinition = { id: 'f', name: 'Phone', type: 'phone' };
    applyNewFieldExtras(phone, { phoneCountry: 'BD' });
    expect(phone.phoneCountry).toBe('BD');

    const text: FieldDefinition = { id: 'f', name: 'Text', type: 'text' };
    applyNewFieldExtras(text, { phoneCountry: 'BD' });
    expect(text).not.toHaveProperty('phoneCountry');
  });

  it('refuses an unsupported or lowercase code at creation', () => {
    for (const code of ['ZZ', 'bd', 'BGD', '']) {
      const field: FieldDefinition = { id: 'f', name: 'Phone', type: 'phone' };
      applyNewFieldExtras(field, { phoneCountry: code });
      expect(field, code).not.toHaveProperty('phoneCountry');
    }
  });

  it('sets, clears and rejects the country on an existing phone field', () => {
    const s = createSession(makeFile());
    const field = s.addField('Phone', 'phone');

    expect(s.editField(field.id, { name: 'Phone', phoneCountry: 'BD' })).toMatchObject({ ok: true });
    expect(s.toFile().fields.find((f) => f.id === field.id)?.phoneCountry).toBe('BD');

    // A lowercase code is normalised, not rejected.
    expect(s.editField(field.id, { name: 'Phone', phoneCountry: 'gb' })).toMatchObject({ ok: true });
    expect(s.toFile().fields.find((f) => f.id === field.id)?.phoneCountry).toBe('GB');

    expect(s.editField(field.id, { name: 'Phone', phoneCountry: null })).toMatchObject({ ok: true });
    expect(s.toFile().fields.find((f) => f.id === field.id)).not.toHaveProperty('phoneCountry');

    const refused = s.editField(field.id, { name: 'Phone', phoneCountry: 'ZZ' });
    expect(refused.ok).toBe(false);
    expect(s.toFile().fields.find((f) => f.id === field.id)).not.toHaveProperty('phoneCountry');
  });

  it('drops the key when the field stops being a phone field', () => {
    const s = createSession(makeFile());
    const field = s.addField('Phone', 'phone', undefined, undefined, { phoneCountry: 'BD' });
    expect(s.toFile().fields.find((f) => f.id === field.id)?.phoneCountry).toBe('BD');
    s.changeFieldType(field.id, 'text');
    expect(s.toFile().fields.find((f) => f.id === field.id)).not.toHaveProperty('phoneCountry');
  });

  it('a phoneCountry saved with another type is ignored on edit, and cannot linger', () => {
    const file = makeFile();
    file.fields.push({ id: 'fld_text', name: 'Text', type: 'text', phoneCountry: 'BD' });
    const s = createSession(file);
    // The key is not part of a text field's meaning: an edit drops it.
    s.editField('fld_text', { name: 'Text', regex: '^x' });
    expect(s.toFile().fields.find((f) => f.id === 'fld_text')).not.toHaveProperty('phoneCountry');
  });

  it('a type change through the planner drops the country too', () => {
    const before: FieldDefinition = { id: 'f', name: 'Phone', type: 'phone', phoneCountry: 'BD' };
    const plan = planTypeChange([], before, 'text');
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.field).not.toHaveProperty('phoneCountry');
  });

  it('undo restores the previous country', () => {
    const s = createSession(makeFile());
    const field = s.addField('Phone', 'phone', undefined, undefined, { phoneCountry: 'BD' });
    s.editField(field.id, { name: 'Phone', phoneCountry: 'GB' });
    expect(s.toFile().fields.find((f) => f.id === field.id)?.phoneCountry).toBe('GB');
    s.undo();
    expect(s.toFile().fields.find((f) => f.id === field.id)?.phoneCountry).toBe('BD');
  });
});

// ---- the list ---------------------------------------------------------------------------

function openList(options: Partial<ConstructorParameters<typeof CountryList>[0]> = {}) {
  const picked: string[] = [];
  const cancelled: string[] = [];
  const list = new CountryList({
    locale: 'en',
    suggested: ['BD', 'US'],
    onPick: (row) => picked.push(row.iso),
    onCancel: () => cancelled.push('cancel'),
    ...options,
  });
  document.body.appendChild(list.element);
  return { list, picked, cancelled };
}

function rows(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.tablify__country-row'));
}

describe('CountryList (SAD-303)', () => {
  afterEach(() => {
    document.body.textContent = '';
  });

  it('suggests a short list, then draws every country once', () => {
    const { list } = openList();
    const headings = Array.from(document.querySelectorAll('.tablify__country-heading')).map((h) => h.textContent);
    expect(headings).toEqual(['Suggested', 'All countries']);
    const isos = rows().map((r) => r.dataset.iso);
    expect(isos.slice(0, 2)).toEqual(['BD', 'US']);
    // Bangladesh is suggested, so it must not appear a second time below.
    expect(isos.filter((iso) => iso === 'BD')).toHaveLength(1);
    expect(isos).toHaveLength(245);
    list.destroy();
  });

  it('filters as the user types, by name, ISO or dial code', () => {
    const { list } = openList();
    const search = list.element.querySelector('input') as HTMLInputElement;

    search.value = 'bangla';
    search.dispatchEvent(new Event('input'));
    expect(rows().map((r) => r.dataset.iso)).toEqual(['BD']);

    search.value = '880';
    search.dispatchEvent(new Event('input'));
    expect(rows()[0]?.dataset.iso).toBe('BD');

    search.value = 'gb';
    search.dispatchEvent(new Event('input'));
    expect(rows()[0]?.dataset.iso).toBe('GB');

    search.value = 'nowhere';
    search.dispatchEvent(new Event('input'));
    expect(rows()).toHaveLength(0);
    expect(document.querySelector('.tablify__dropdown-empty')?.textContent).toContain('No country');
    list.destroy();
  });

  it('shows the dial code and ticks the selected country', () => {
    const { list } = openList({ selected: 'BD' });
    const bd = rows().find((r) => r.dataset.iso === 'BD') as HTMLButtonElement;
    expect(bd.textContent).toContain('+880');
    expect(bd.getAttribute('aria-selected')).toBe('true');
    expect(bd.querySelector('.tablify__dropdown-check')).not.toBeNull();
    expect(rows().filter((r) => r.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    list.destroy();
  });

  it('walks the list with the arrows and picks with Enter', () => {
    const { list, picked } = openList();
    const search = list.element.querySelector('input') as HTMLInputElement;

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(search.getAttribute('aria-activedescendant')).toBe(rows()[1]?.id);

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(picked).toEqual([rows()[2]?.dataset.iso]);
    list.destroy();
  });

  it('wraps at both ends and starts on the first row', () => {
    const { list, picked } = openList({ suggested: [] });
    const search = list.element.querySelector('input') as HTMLInputElement;
    expect(search.getAttribute('aria-activedescendant')).toBe(rows()[0]?.id);

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(search.getAttribute('aria-activedescendant')).toBe(rows().at(-1)?.id);

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(picked).toEqual([rows().at(-1)?.dataset.iso]);
    list.destroy();
  });

  it('Escape cancels, and a composing Enter is left to the IME', () => {
    const { list, picked, cancelled } = openList();
    const search = list.element.querySelector('input') as HTMLInputElement;
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
    expect(picked).toEqual([]);
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cancelled).toEqual(['cancel']);
    list.destroy();
  });

  it('a click picks and keeps the row ticked', () => {
    const { list, picked } = openList({ suggested: [] });
    (rows().find((r) => r.dataset.iso === 'JP') as HTMLButtonElement).click();
    expect(picked).toEqual(['JP']);
    expect(rows().find((r) => r.dataset.iso === 'JP')?.getAttribute('aria-selected')).toBe('true');
    list.destroy();
  });

  it('setSelected and setQuery repaint without picking anything', () => {
    const { list, picked } = openList({ suggested: [] });
    list.setSelected('BD');
    expect(rows().find((r) => r.dataset.iso === 'BD')?.getAttribute('aria-selected')).toBe('true');
    list.setQuery('bangla');
    expect(rows().map((r) => r.dataset.iso)).toEqual(['BD']);
    expect(picked).toEqual([]);
    list.destroy();
  });

  it('survives a locale the browser rejects', () => {
    const { list } = openList({ locale: '!!!', suggested: [] });
    expect(rows()).toHaveLength(245);
    expect(rows().find((r) => r.dataset.iso === 'AF')?.textContent).toContain('Afghanistan');
    list.destroy();
  });
});

// ---- the popover ------------------------------------------------------------------------

describe('CountrySelect (SAD-303)', () => {
  afterEach(() => {
    document.body.textContent = '';
  });

  function mount(value = '') {
    const changes: Array<string | null> = [];
    const select = new CountrySelect({ id: 'country-test', value, suggested: ['BD'], onChange: (iso) => changes.push(iso) });
    document.body.appendChild(select.element);
    return { select, changes };
  }

  function popover(): HTMLElement | null {
    return document.querySelector('.tablify__country-popover');
  }

  it('shows the chosen country, or the region fallback when empty', () => {
    const bd = mount('BD').select;
    expect(bd.element.textContent).toContain('Bangladesh');
    expect(bd.element.textContent).toContain('+880');
    bd.close();

    const none = mount('').select;
    expect(none.element.textContent).toContain('No default');
    expect(none.element.textContent).toContain('my region');
    none.close();
  });

  it('opens a popover on the body, with search focused and rows drawn', () => {
    const { select } = mount('BD');
    select.element.click();
    expect(popover()).not.toBeNull();
    expect(document.activeElement).toBe(popover()?.querySelector('input'));
    expect(select.element.getAttribute('aria-expanded')).toBe('true');
    expect(rows().length).toBeGreaterThan(200);
    select.close();
    expect(popover()).toBeNull();
    expect(select.element.getAttribute('aria-expanded')).toBe('false');
  });

  it('a pick reports once, closes, and returns focus to the trigger', () => {
    const { select, changes } = mount('');
    select.element.click();
    (rows().find((r) => r.dataset.iso === 'JP') as HTMLButtonElement).click();
    expect(changes).toEqual(['JP']);
    expect(select.getValue()).toBe('JP');
    expect(popover()).toBeNull();
    expect(document.activeElement).toBe(select.element);
    expect(select.element.textContent).toContain('Japan');
  });

  it('"No default" reports null and is disabled when already empty', () => {
    const { select, changes } = mount('BD');
    select.element.click();
    const clear = document.querySelector('.tablify__country-clear') as HTMLButtonElement;
    expect(clear.disabled).toBe(false);
    clear.click();
    expect(changes).toEqual([null]);
    expect(select.getValue()).toBe('');
    select.close();

    const empty = mount('').select;
    empty.element.click();
    expect((document.querySelector('.tablify__country-clear') as HTMLButtonElement).disabled).toBe(true);
    empty.close();
  });

  it('closes on a press outside, on Escape, and on a scroll', () => {
    const { select } = mount('BD');

    select.element.click();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(popover()).toBeNull();

    select.element.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(popover()).toBeNull();

    select.element.click();
    window.dispatchEvent(new Event('scroll'));
    expect(popover()).toBeNull();

    select.close();
  });

  it('a press inside the popover does not dismiss it', () => {
    const { select } = mount('BD');
    select.element.click();
    popover()?.querySelector('.tablify__country-list')?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(popover()).not.toBeNull();
    select.close();
  });

  it('toggling the trigger closes an open popover', () => {
    const { select } = mount('BD');
    select.element.click();
    select.element.click();
    expect(popover()).toBeNull();
  });
});

// ---- Add / Modify Field -----------------------------------------------------------------

function openModal(
  options: ConstructorParameters<typeof AddFieldModal>[2] = {},
  initialField?: FieldDefinition,
) {
  const calls: unknown[][] = [];
  const edits: Record<string, unknown>[] = [];
  const modal = new AddFieldModal(new App(), (...args: unknown[]) => calls.push(args), {
    ...options,
    ...(initialField
      ? {
          mode: 'edit' as const,
          initial: { field: initialField },
          onEdit: (edit) => edits.push(edit as Record<string, unknown>),
        }
      : {}),
  });
  modal.open();
  return { modal, calls, edits };
}

function setText(modal: Modal, selector: string, value: string, event = 'input'): void {
  const el = modal.contentEl.querySelector(selector) as HTMLInputElement;
  el.value = value;
  el.dispatchEvent(new Event(event));
}

function visible(modal: Modal, selector: string): boolean {
  let el = modal.contentEl.querySelector(selector) as HTMLElement | null;
  while (el && el !== modal.contentEl) {
    if (el.style.display === 'none') return false;
    el = el.parentElement as HTMLElement | null;
  }
  return el !== null;
}

describe('Add / Modify Field — default country (SAD-303)', () => {
  beforeEach(() => {
    Modal.reset();
    cleanupPickers();
  });

  afterEach(() => {
    document.body.textContent = '';
    cleanupPickers();
  });

  it('shows the country row for Phone only', () => {
    const { modal } = openModal();
    expect(visible(modal, '#tablify__af-country')).toBe(false);
    pickType('phone', modal.contentEl);
    expect(visible(modal, '#tablify__af-country')).toBe(true);
    pickType('text', modal.contentEl);
    expect(visible(modal, '#tablify__af-country')).toBe(false);
    (modal as unknown as { close(): void }).close();
  });

  it('does not send a country for a field that is not a phone field', () => {
    const { modal, calls } = openModal();
    pickType('phone', modal.contentEl);
    setText(modal, '#tablify__af-name', 'Phone');
    (modal.contentEl.querySelector('button.tablify__pmodal-btn--primary') as HTMLButtonElement).click();
    expect(calls).toEqual([['Phone', 'phone']]);
  });

  it('passes the picked country to the new field', () => {
    const { modal, calls } = openModal();
    setText(modal, '#tablify__af-name', 'Phone');
    pickType('phone', modal.contentEl);
    (modal.contentEl.querySelector('#tablify__af-country') as HTMLButtonElement).click();
    (rows().find((r) => r.dataset.iso === 'BD') as HTMLButtonElement).click();
    (modal.contentEl.querySelector('button.tablify__pmodal-btn--primary') as HTMLButtonElement).click();
    expect(calls).toEqual([['Phone', 'phone', undefined, undefined, { phoneCountry: 'BD' }]]);
  });

  it('offers a suggested row for the country already set (Modify Field)', () => {
    const initial: FieldDefinition = { id: 'fld_p', name: 'Phone', type: 'phone', phoneCountry: 'BD' };
    const { modal } = openModal({}, initial);
    (modal.contentEl.querySelector('#tablify__af-country') as HTMLButtonElement).click();
    const headings = Array.from(document.querySelectorAll('.tablify__country-heading')).map((h) => h.textContent);
    expect(headings[0]).toBe('Suggested');
    expect(rows()[0]?.dataset.iso).toBe('BD');
    (modal as unknown as { close(): void }).close();
  });

  it('a type change away from Phone clears the row and the saved key', () => {
    const initial: FieldDefinition = { id: 'fld_p', name: 'Phone', type: 'phone', phoneCountry: 'BD' };
    const { modal, edits } = openModal({}, initial);
    pickType('text', modal.contentEl);
    (modal.contentEl.querySelector('button.tablify__pmodal-btn--primary') as HTMLButtonElement).click();
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ type: 'text' });
    // A text field's row is hidden, so the patch must not carry a phone key at all.
    expect(edits[0]).not.toHaveProperty('phoneCountry');
  });

  it('closing the window closes an open country popover', () => {
    const { modal } = openModal();
    pickType('phone', modal.contentEl);
    (modal.contentEl.querySelector('#tablify__af-country') as HTMLButtonElement).click();
    expect(document.querySelector('.tablify__country-popover')).not.toBeNull();
    (modal as unknown as { close(): void }).close();
    expect(document.querySelector('.tablify__country-popover')).toBeNull();
  });
});
