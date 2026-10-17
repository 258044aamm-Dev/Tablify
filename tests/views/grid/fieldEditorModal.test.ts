/**
 * @vitest-environment jsdom
 *
 * FieldEditorModal tests (COD-67). Runs against the obsidian mock, like addFieldModal.test.ts.
 *
 * The ticket's first requirement is that changing a field and creating one are the SAME window, so
 * the editor is AddFieldModal in `mode: 'edit'` rather than a second dialog with its own copy of
 * the layout. These tests pin the differences and, more importantly, that create mode is unchanged.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AddFieldModal, FieldEditorModal } from '../../../src/views/grid/AddFieldModal.js';
import { App, Modal } from 'obsidian';
import { CHANGE_TARGET_TYPES } from '../../../src/menus/tableMenuModel.js';
import type { FieldTypeName } from '../../../src/model/types.js';

function openEdit(initial: { name: string; type: FieldTypeName }, canPickType?: (type: FieldTypeName) => boolean) {
  const app = new App();
  const edited: Array<{ name: string; type: string }> = [];
  const modal = new FieldEditorModal(
    app,
    () => {
      throw new Error('create-mode callback must not fire in edit mode');
    },
    {
      mode: 'edit',
      initial,
      onEdit: (name, type) => edited.push({ name, type }),
      canPickType,
    },
  );
  modal.open();
  return { modal, edited };
}

function textInput(modal: Modal): HTMLInputElement {
  return modal.contentEl.querySelector('input[type="text"]') as HTMLInputElement;
}

function dropdown(modal: Modal): HTMLSelectElement {
  return modal.contentEl.querySelector('select') as HTMLSelectElement;
}

function saveButton(modal: Modal): HTMLButtonElement {
  return modal.contentEl.querySelector('button.tablify__pmodal-btn--primary') as unknown as HTMLButtonElement;
}

function present(modal: Modal, selector: string): boolean {
  return modal.contentEl.querySelector(selector) !== null;
}

describe('FieldEditorModal (edit mode)', () => {
  beforeEach(() => {
    Modal.reset();
  });

  it('is the same class as AddFieldModal', () => {
    expect(FieldEditorModal).toBe(AddFieldModal);
  });

  it('opens titled Edit Field with the field’s name and type filled in', () => {
    const { modal } = openEdit({ name: 'Price', type: 'currency' });
    expect((modal as unknown as { title: string }).title).toBe('Edit Field');
    expect(textInput(modal).value).toBe('Price');
    expect(dropdown(modal).value).toBe('currency');
  });

  it('labels the primary button Save rather than Save Field', () => {
    const { modal } = openEdit({ name: 'Price', type: 'number' });
    expect(saveButton(modal).textContent).toBe('Save');
  });

  it('shows only the name and type rows', () => {
    const { modal } = openEdit({ name: 'Price', type: 'number' });
    expect(present(modal, '.tablify__af-rules')).toBe(false);
    expect(present(modal, 'textarea.tablify__af-formula')).toBe(false);
    expect(present(modal, 'textarea.tablify__af-options')).toBe(false);
    expect(textInput(modal)).toBeTruthy();
    expect(dropdown(modal)).toBeTruthy();
  });

  it('offers only types the caller allows, and always the current one', () => {
    const { modal } = openEdit({ name: 'Price', type: 'number' }, (t) => t === 'text');
    const options = Array.from(dropdown(modal).options).map((o) => o.value);
    expect(options).toContain('number'); // current type is always offered
    expect(options).toContain('text'); // allowed by canPickType
    expect(options).not.toContain('date');
  });

  it('reports the edited name and type, and does not call the create callback', () => {
    const { modal, edited } = openEdit({ name: 'Price', type: 'number' });
    textInput(modal).value = ' Unit Price ';
    textInput(modal).dispatchEvent(new Event('input'));
    dropdown(modal).value = 'currency';
    dropdown(modal).dispatchEvent(new Event('change'));
    saveButton(modal).click();
    expect(edited).toEqual([{ name: 'Unit Price', type: 'currency' }]);
    expect(modal.isOpen).toBe(false);
  });

  it('keeps the dialog open with a notice when the name is blank', () => {
    const { modal, edited } = openEdit({ name: 'Price', type: 'number' });
    textInput(modal).value = '   ';
    textInput(modal).dispatchEvent(new Event('input'));
    saveButton(modal).click();
    expect(edited).toEqual([]);
    expect(modal.isOpen).toBe(true);
  });
});

describe('AddFieldModal (create mode, unchanged)', () => {
  beforeEach(() => {
    Modal.reset();
  });

  it('still offers every change-target type and no edit rows', () => {
    const modal = new AddFieldModal(new App(), () => {});
    modal.open();
    const options = Array.from(dropdown(modal).options).map((o) => o.value);
    expect(options).toEqual([...CHANGE_TARGET_TYPES]);
    expect(textInput(modal).value).toBe('');
    expect(saveButton(modal).textContent).toBe('Save Field');
  });
});
