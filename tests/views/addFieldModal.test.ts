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
    const expr = modal.contentEl.querySelectorAll('input[type="text"]')[1] as HTMLInputElement;
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
    const expr = modal.contentEl.querySelectorAll('input[type="text"]')[1] as HTMLInputElement;
    expr.value = '{Price} * (';
    expr.dispatchEvent(new Event('input'));
    addButton(modal).click();
    expect(confirmed).toHaveLength(0);
    expect(modal.isOpen).toBe(true);
    expect(Notice.messages.at(-1)).toBe('The formula has a syntax error.');
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
