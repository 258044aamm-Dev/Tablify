/**
 * @vitest-environment jsdom
 *
 * AddFieldModal tests (SAD-70). Runs against the obsidian mock, so the modal is covered
 * even though it is Obsidian-facing — see the note in tests/__mocks__/obsidian.ts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AddFieldModal, DEFAULT_NEW_FIELD_TYPE } from '../../src/views/grid/AddFieldModal.js';
import { App, Modal, Notice } from 'obsidian';
import { CHANGE_TARGET_TYPES } from '../../src/menus/tableMenuModel.js';

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

/** The second text box: the formula expression, after the name (P8-03). */
function secondTextInput(modal: Modal): HTMLInputElement {
  return modal.contentEl.querySelectorAll('input[type="text"]')[1] as unknown as HTMLInputElement;
}

function dropdown(modal: Modal): HTMLSelectElement {
  return modal.contentEl.querySelector('select') as HTMLSelectElement;
}

function addButton(modal: Modal): HTMLButtonElement {
  return modal.contentEl.querySelector('button') as HTMLButtonElement;
}

describe('AddFieldModal', () => {
  beforeEach(() => {
    Notice.reset();
    Modal.reset();
  });

  it('opens with a title and an empty name', () => {
    const { modal } = open();
    expect(modal.isOpen).toBe(true);
    expect((modal as unknown as { title: string }).title).toBe('Add field');
    expect(textInput(modal).value).toBe('');
  });

  it('offers the same field types as the header menu', () => {
    const { modal } = open();
    const options = Array.from(dropdown(modal).options).map((o) => o.value);
    expect(options).toEqual([...CHANGE_TARGET_TYPES]);
  });

  it('preselects the default type', () => {
    const { modal } = open();
    expect(dropdown(modal).value).toBe(DEFAULT_NEW_FIELD_TYPE);
  });

  it('confirms with the typed name and chosen type', () => {
    const { modal, confirmed } = open();
    const input = textInput(modal);
    input.value = 'Score';
    input.dispatchEvent(new Event('input'));
    dropdown(modal).value = 'number';
    dropdown(modal).dispatchEvent(new Event('change'));
    addButton(modal).click();
    expect(confirmed).toEqual([{ name: 'Score', type: 'number' }]);
  });

  it('P8-03: a formula field takes an expression and passes it to onConfirm', () => {
    const { modal, confirmed } = open();
    const input = textInput(modal);
    input.value = 'Double';
    input.dispatchEvent(new Event('input'));
    dropdown(modal).value = 'formula';
    dropdown(modal).dispatchEvent(new Event('change'));
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
    dropdown(modal).value = 'formula';
    dropdown(modal).dispatchEvent(new Event('change'));
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
    dropdown(modal).value = 'link';
    dropdown(modal).dispatchEvent(new Event('change'));
    const targetSelect = modal.contentEl.querySelectorAll('select')[1] as unknown as HTMLSelectElement;
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
    dropdown(modal).value = 'link';
    dropdown(modal).dispatchEvent(new Event('change'));
    addButton(modal).click();
    expect(got).toHaveLength(0);
    expect((modal as unknown as { isOpen: boolean }).isOpen).toBe(true);
    expect((Notice as unknown as { messages: string[] }).messages.at(-1)).toBe('Choose a table to link to.');
  });
});
