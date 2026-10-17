/**
 * @vitest-environment jsdom
 *
 * AddFieldModal tests (SAD-70). Runs against the obsidian mock, so the modal is covered
 * even though it is Obsidian-facing — see the note in tests/__mocks__/obsidian.ts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AddFieldModal, DEFAULT_NEW_FIELD_TYPE, TYPE_GROUPS } from '../../src/views/grid/AddFieldModal.js';
import { App, Modal, Notice } from 'obsidian';
import { CHANGE_TARGET_TYPES, TYPE_LABELS } from '../../src/menus/tableMenuModel.js';
import { cleanupPickers, openPicker, pickType, typeRows } from './grid/typePickerSupport.js';

function open() {
  const app = new App();
  const confirmed: Array<{ name: string; type: string; formula?: string }> = [];
  const modal = new AddFieldModal(app, (name, type, formula) => confirmed.push({ name, type, formula }));
  modal.open();
  return { modal, confirmed };
}

function textInput(modal: Modal): HTMLInputElement {
  return modal.contentEl.querySelector('input[type="text"]') as HTMLInputElement;
}

/** The formula expression box (P8-03) — a two-row mono textarea since SAD-86 (prototype layout). */
function secondTextInput(modal: Modal): HTMLTextAreaElement {
  return modal.contentEl.querySelector('textarea.tablify__af-formula') as unknown as HTMLTextAreaElement;
}

/** "Save Field" — the primary footer button; Cancel comes first since SAD-86 (prototype order). */
function addButton(modal: Modal): HTMLButtonElement {
  return modal.contentEl.querySelector('button.tablify__pmodal-btn--primary') as unknown as HTMLButtonElement;
}

// The picker's panel lives on `document.body`; a test that leaves one open must not leak into the
// next (every panel would answer to the same selector).
beforeEach(() => cleanupPickers());

describe('AddFieldModal', () => {
  beforeEach(() => {
    Notice.reset();
    Modal.reset();
  });

  it('opens with a title and an empty name', () => {
    const { modal } = open();
    expect(modal.isOpen).toBe(true);
    expect((modal as unknown as { title: string }).title).toBe('Add New Field');
    expect(textInput(modal).value).toBe('');
  });

  it('offers the same field types as the header menu', () => {
    const { modal } = open();
    const options = typeRows(openPicker(modal.contentEl)).map((r) => r.dataset.type);
    expect(options).toEqual([...CHANGE_TARGET_TYPES]);
  });

  it('preselects the default type', () => {
    const { modal } = open();
    expect(modal.contentEl.querySelector('#tablify__af-type')?.getAttribute('aria-label')).toContain(TYPE_LABELS[DEFAULT_NEW_FIELD_TYPE]);
  });

  it('confirms with the typed name and chosen type', () => {
    const { modal, confirmed } = open();
    const input = textInput(modal);
    input.value = 'Score';
    input.dispatchEvent(new Event('input'));
    pickType('number', modal.contentEl);
    addButton(modal).click();
    expect(confirmed).toEqual([{ name: 'Score', type: 'number' }]);
  });

  it('P8-03: a formula field takes an expression and passes it to onConfirm', () => {
    const { modal, confirmed } = open();
    const input = textInput(modal);
    input.value = 'Double';
    input.dispatchEvent(new Event('input'));
    pickType('formula', modal.contentEl);
    // The expression input is the second text box (after the name).
    const expr = secondTextInput(modal);
    expr.value = '{Price} * 2';
    expr.dispatchEvent(new Event('input'));
    addButton(modal).click();
    expect(confirmed).toEqual([{ name: 'Double', type: 'formula', formula: '{Price} * 2' }]);
  });

  it('P8-03: a formula with a syntax error warns and stays open', () => {
    const { modal, confirmed } = open();
    const input = textInput(modal);
    input.value = 'Broken';
    input.dispatchEvent(new Event('input'));
    pickType('formula', modal.contentEl);
    const expr = secondTextInput(modal);
    expr.value = '{Price} * (';
    expr.dispatchEvent(new Event('input'));
    addButton(modal).click();
    expect(confirmed).toHaveLength(0);
    expect((modal as unknown as { isOpen: boolean }).isOpen).toBe(true);
    expect((Notice as unknown as { messages: string[] }).messages.at(-1)).toBe('The formula has a syntax error.');
  });

  it('trims whitespace from the name', () => {
    const { modal, confirmed } = open();
    const input = textInput(modal);
    input.value = '  Score  ';
    input.dispatchEvent(new Event('input'));
    addButton(modal).click();
    expect(confirmed[0].name).toBe('Score');
  });

  it('refuses an empty name, warns, and stays open', () => {
    const { modal, confirmed } = open();
    addButton(modal).click();
    expect(confirmed).toHaveLength(0);
    expect(Notice.messages.join(' ')).toContain('cannot be empty');
    expect(modal.isOpen).toBe(true);
  });

  it('refuses a whitespace-only name', () => {
    const { modal, confirmed } = open();
    const input = textInput(modal);
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    addButton(modal).click();
    expect(confirmed).toHaveLength(0);
    expect(modal.isOpen).toBe(true);
  });

  it('submits when Enter is pressed in the name field', () => {
    const { modal, confirmed } = open();
    const input = textInput(modal);
    input.value = 'Note';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(confirmed).toEqual([{ name: 'Note', type: DEFAULT_NEW_FIELD_TYPE }]);
  });
});

describe('AddFieldModal link type (P8-04)', () => {
  it('a link field asks for a target table, defaults to this table, and passes the chosen ID', () => {
    const app = new App();
    const got: unknown[][] = [];
    const modal = new AddFieldModal(
      app,
      (...args) => got.push(args),
      {
        linkTargets: [
          { tableId: 'tbl_self', name: 'Orders' },
          { tableId: 'tbl_c', name: 'Customers' },
        ],
        defaultLinkTableId: 'tbl_self',
      },
    );
    modal.open();
    textInput(modal).value = 'Customer';
    textInput(modal).dispatchEvent(new Event('input'));
    pickType('link', modal.contentEl);
    const targetSelect = modal.contentEl.querySelector('select') as unknown as HTMLSelectElement;
    expect(Array.from(targetSelect.options).map((o) => o.value)).toEqual(['tbl_self', 'tbl_c']);
    expect(targetSelect.value).toBe('tbl_self');
    targetSelect.value = 'tbl_c';
    targetSelect.dispatchEvent(new Event('change'));
    addButton(modal).click();
    expect(got).toEqual([['Customer', 'link', undefined, 'tbl_c']]);
  });

  it('with no table to link to, it warns and stays open', () => {
    const app = new App();
    const got: unknown[][] = [];
    const modal = new AddFieldModal(app, (...args) => got.push(args), { linkTargets: [] });
    modal.open();
    textInput(modal).value = 'Customer';
    textInput(modal).dispatchEvent(new Event('input'));
    pickType('link', modal.contentEl);
    addButton(modal).click();
    expect(got).toHaveLength(0);
    expect((modal as unknown as { isOpen: boolean }).isOpen).toBe(true);
    expect((Notice as unknown as { messages: string[] }).messages.at(-1)).toBe('Choose a table to link to.');
  });
});

// ---- SAD-86: prototype layout — type groups, options, validation rules, formula preview ----

/** The obsidian mock's test hooks (tsc resolves the real `obsidian` types, which lack them). */
const mockNotice = Notice as unknown as { reset(): void; messages: string[] };
const mockModal = Modal as unknown as { reset(): void };
const isOpen = (m: unknown): boolean => (m as { isOpen: boolean }).isOpen;

function openRaw(options: ConstructorParameters<typeof AddFieldModal>[2] = {}) {
  const calls: unknown[][] = [];
  const modal = new AddFieldModal(new App(), (...args: unknown[]) => calls.push(args), options);
  modal.open();
  const q = <T,>(sel: string): T => modal.contentEl.querySelector(sel) as unknown as T;
  const set = (sel: string, value: string, event = 'input') => {
    const el = q<HTMLInputElement>(sel);
    el.value = value;
    el.dispatchEvent(new Event(event));
  };
  const check = (index: number) => {
    const box = modal.contentEl.querySelectorAll('.tablify__af-check input')[index] as unknown as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
  };
  const shown = (sel: string) => {
    let el = q<HTMLElement | null>(sel);
    while (el && (el as unknown) !== modal.contentEl) {
      if (el.style.display === 'none') return false;
      el = el.parentElement as unknown as HTMLElement | null;
    }
    return true;
  };
  const save = () => q<HTMLButtonElement>('button.tablify__pmodal-btn--primary').click();
  return { modal, calls, q, set, check, shown, save };
}

describe('AddFieldModal — prototype layout (SAD-86)', () => {
  beforeEach(() => {
    mockNotice.reset();
    mockModal.reset();
    cleanupPickers();
  });

  it('groups the types like the prototype, in the header menu order', () => {
    const { modal } = openRaw();
    const panel = openPicker(modal.contentEl);
    const headings = Array.from(panel.querySelectorAll('.tablify__tp-group')).map((g) => g.textContent);
    expect(headings).toEqual(TYPE_GROUPS.map(([label]) => label));
    // The rows are the same types, in the same order, as the model's change-target list.
    expect(typeRows(panel).map((r) => r.dataset.type)).toEqual([...CHANGE_TARGET_TYPES]);
    expect(TYPE_GROUPS.flatMap(([, types]) => types)).toEqual([...CHANGE_TARGET_TYPES]);
  });

  it('no native select is left in the window (COD-76)', () => {
    const { modal } = openRaw();
    // The linked-table row still has its own native select; the TYPE row must not.
    expect(modal.contentEl.querySelectorAll('.tablify__typepicker select')).toHaveLength(0);
  });

  it('has Cancel then Save Field; Cancel closes without adding', () => {
    const { modal, calls, q } = openRaw();
    const buttons = Array.from(modal.contentEl.querySelectorAll('.tablify__af-footer button')).map((b) => b.textContent);
    expect(buttons).toEqual(['Cancel', 'Save Field']);
    q<HTMLButtonElement>('.tablify__af-footer button').click();
    expect(isOpen(modal)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('a field with nothing extra confirms with the old arguments only', () => {
    const { calls, set, save } = openRaw();
    set('#tablify__af-name', 'Plain');
    save();
    expect(calls).toEqual([['Plain', 'text']]);
  });

  it('shows the options box for select types only and passes the non-empty lines', () => {
    const { modal, calls, set, shown, save } = openRaw();
    expect(shown('#tablify__af-options')).toBe(false);
    pickType('single_select', modal.contentEl);
    expect(shown('#tablify__af-options')).toBe(true);
    set('#tablify__af-name', 'Stage');
    set('#tablify__af-options', 'Backlog\n\n  Doing \nDone');
    save();
    expect(calls).toEqual([['Stage', 'single_select', undefined, undefined, { options: ['Backlog', 'Doing', 'Done'] }]]);
  });

  it('shows Min / Max for number-like types and the regex for text-like types', () => {
    const { modal, shown } = openRaw();
    expect([shown('#tablify__af-min'), shown('#tablify__af-regex-input')]).toEqual([false, true]);
    pickType('number', modal.contentEl);
    expect([shown('#tablify__af-min'), shown('#tablify__af-regex-input')]).toEqual([true, false]);
    pickType('checkbox', modal.contentEl);
    expect([shown('#tablify__af-min'), shown('#tablify__af-regex-input')]).toEqual([false, false]);
  });

  it('passes required / unique and min / max in the type\'s stored form', () => {
    const { modal, calls, set, check, save } = openRaw();
    pickType('number', modal.contentEl);
    set('#tablify__af-name', 'Score');
    check(0);
    check(1);
    set('#tablify__af-min', '0');
    set('#tablify__af-max', '10');
    save();
    expect(calls).toEqual([['Score', 'number', undefined, undefined, { required: true, unique: true, min: 0, max: 10 }]]);
  });

  it('a date bound is stored as YYYY-MM-DD', () => {
    const { modal, calls, set, save } = openRaw();
    pickType('date', modal.contentEl);
    set('#tablify__af-name', 'Due');
    set('#tablify__af-min', '2026-01-05');
    save();
    expect(calls).toEqual([['Due', 'date', undefined, undefined, { min: '2026-01-05' }]]);
  });

  it('an invalid bound warns and keeps the dialog open', () => {
    const { modal, calls, set, save } = openRaw();
    pickType('number', modal.contentEl);
    set('#tablify__af-name', 'Score');
    set('#tablify__af-max', 'lots');
    save();
    expect(isOpen(modal)).toBe(true);
    expect(calls).toEqual([]);
    expect(mockNotice.messages.join(' ')).toContain('Max is not a valid');
  });

  it('an invalid regex warns and keeps the dialog open; a valid one is passed', () => {
    const { modal, calls, set, save } = openRaw();
    set('#tablify__af-name', 'Code');
    set('#tablify__af-regex-input', '[A-Z');
    save();
    expect(isOpen(modal)).toBe(true);
    expect(mockNotice.messages.join(' ')).toContain('regex is not valid');
    set('#tablify__af-regex-input', '^[A-Z]+$');
    save();
    expect(calls).toEqual([['Code', 'text', undefined, undefined, { regex: '^[A-Z]+$' }]]);
  });

  it('rules hidden for the chosen type are not passed', () => {
    const { modal, calls, set, save } = openRaw();
    set('#tablify__af-regex-input', '^x');
    pickType('number', modal.contentEl);
    set('#tablify__af-name', 'N');
    save();
    expect(calls).toEqual([['N', 'number']]);
  });

  it('previews the formula live with the supplied evaluator', () => {
    const seen: string[] = [];
    const { modal, q, set } = openRaw({ formulaPreview: (e) => (seen.push(e), `=${e.length}`) });
    pickType('formula', modal.contentEl);
    set('#tablify__af-formula', '1 + 2');
    expect(seen).toContain('1 + 2');
    expect(q<HTMLElement>('.tablify__af-preview').textContent).toBe('Preview (row 1): =5');
  });

  it('without an evaluator the preview shows a dash', () => {
    const { modal, q, set } = openRaw();
    pickType('formula', modal.contentEl);
    set('#tablify__af-formula', '1 + 2');
    expect(q<HTMLElement>('.tablify__af-preview').textContent).toBe('Preview (row 1): —');
  });
});
