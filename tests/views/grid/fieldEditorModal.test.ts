/**
 * @vitest-environment jsdom
 *
 * The shared field window in edit mode (COD-67, extended by COD-69).
 *
 * The ticket's point is that creating a field and modifying one are the SAME window, so the
 * editor is AddFieldModal in `mode: 'edit'` — not a second dialog. COD-69 adds the rest of the
 * create rows: an existing field now shows its options, validation rules, formula and linked
 * table, pre-filled, and Save hands over one patch built from the rows that were visible.
 *
 * Create mode is asserted here too: it must stay exactly as it was.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddFieldModal, FieldEditorModal } from '../../../src/views/grid/AddFieldModal.js';
import { App, Modal, Notice } from 'obsidian';
import { CHANGE_TARGET_TYPES } from '../../../src/menus/tableMenuModel.js';
import type { FieldDefinition, FieldTypeName } from '../../../src/model/types.js';
import type { FieldEdit } from '../../../src/model/tableSession.js';
import { cleanupPickers, openPicker, pickType, typeRow, typeRows } from './typePickerSupport.js';

function field(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return { id: 'fld_1', name: 'Price', type: 'text', ...overrides };
}

function openEdit(initial: FieldDefinition, extra: Record<string, unknown> = {}) {
  const app = new App();
  const edited: FieldEdit[] = [];
  const modal = new FieldEditorModal(app, () => {
    throw new Error('create-mode callback must not fire in edit mode');
  }, {
    mode: 'edit',
    initial: { field: initial },
    onEdit: (edit) => edited.push(edit),
    ...extra,
  } as never);
  modal.open();
  return { modal, edited };
}

const textInput = (modal: Modal): HTMLInputElement =>
  modal.contentEl.querySelector('#tablify__af-name') as HTMLInputElement;
/** The picker's trigger — `#tablify__af-type` is the same id the native select carried. */
const triggerLabel = (modal: Modal): string =>
  modal.contentEl.querySelector('#tablify__af-type')?.getAttribute('aria-label') ?? '';
const saveButton = (modal: Modal): HTMLButtonElement =>
  modal.contentEl.querySelector('button.tablify__pmodal-btn--primary') as unknown as HTMLButtonElement;
const rules = (modal: Modal): HTMLElement =>
  modal.contentEl.querySelector('.tablify__af-rules') as HTMLElement;
const byId = (modal: Modal, id: string): HTMLElement | null =>
  modal.contentEl.querySelector(`#${id}`);
const shown = (el: HTMLElement | null): boolean => el !== null && el.style.display !== 'none';

function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
}

describe('FieldEditorModal (edit mode)', () => {
  beforeEach(() => {
    Modal.reset();
    Notice.reset();
    cleanupPickers();
  });

  it('is the same class as AddFieldModal', () => {
    expect(FieldEditorModal).toBe(AddFieldModal);
  });

  it('opens titled Modify Field with the field’s name and type filled in', () => {
    const { modal } = openEdit(field({ name: 'Price', type: 'currency' }));
    expect((modal as unknown as { title: string }).title).toBe('Modify Field');
    expect(textInput(modal).value).toBe('Price');
    // The field's own type shows on the trigger as soon as the window opens.
    expect(triggerLabel(modal)).toContain('Currency');
  });

  it('keeps the create window’s Save Field button', () => {
    const { modal } = openEdit(field());
    expect(saveButton(modal).textContent).toBe('Save Field');
  });

  it('shows the validation rules pre-filled for a text field', () => {
    const { modal } = openEdit(field({ required: true, unique: false, regex: '^[A-Z]' }));
    expect(shown(rules(modal))).toBe(true);
    const required = modal.contentEl.querySelector('.tablify__af-check input') as HTMLInputElement;
    expect(required.checked).toBe(true);
    expect((byId(modal, 'tablify__af-regex-input') as HTMLInputElement).value).toBe('^[A-Z]');
    // Min / Max belong to number and date types only.
    expect((byId(modal, 'tablify__af-min') as HTMLInputElement).closest('.tablify__af-grid')?.getAttribute('style')).toContain('none');
  });

  it('shows Min and Max for a number field, and no regex', () => {
    const { modal } = openEdit(field({ name: 'Amount', type: 'number', min: 5, max: 100 }));
    expect((byId(modal, 'tablify__af-min') as HTMLInputElement).value).toBe('5');
    expect((byId(modal, 'tablify__af-max') as HTMLInputElement).value).toBe('100');
    expect((byId(modal, 'tablify__af-regex-input') as HTMLInputElement).closest('.tablify__af-regex')?.getAttribute('style')).toContain('none');
  });

  it('shows the formula and its live preview for a formula field', () => {
    const preview = vi.fn(() => '2');
    const { modal } = openEdit(field({ name: 'Total', type: 'formula', formula: '{Amount} * 2' }), {
      formulaPreview: preview,
    });
    const box = modal.contentEl.querySelector('textarea.tablify__af-formula') as HTMLTextAreaElement;
    expect(box.value).toBe('{Amount} * 2');
    expect(box.closest('div')?.parentElement?.style.display).not.toBe('none');
    expect(modal.contentEl.querySelector('.tablify__af-preview')?.textContent).toContain('2');
  });

  it('shows the linked table for a link field', () => {
    const { modal } = openEdit(field({ name: 'Linked', type: 'link', linkTableId: 'tbl_b' }), {
      linkTargets: [
        { tableId: 'tbl_a', name: 'A' },
        { tableId: 'tbl_b', name: 'B' },
      ],
    });
    const select = byId(modal, 'tablify__af-link') as HTMLSelectElement;
    expect(select.value).toBe('tbl_b');
  });

  it('shows an options summary and Manage options for a select field, never a textarea', () => {
    const onManageOptions = vi.fn();
    const select = field({
      name: 'Status',
      type: 'single_select',
      options: [
        { id: 'opt_a', name: 'To do', color: 'blue' },
        { id: 'opt_b', name: 'Done', color: 'green' },
      ],
    });
    const { modal } = openEdit(select, { onManageOptions });

    expect(modal.contentEl.querySelector('textarea.tablify__af-options, #tablify__af-options')).toBeNull();
    expect(modal.contentEl.querySelector('.tablify__af-options-summary')?.textContent).toBe(
      '2 options: To do, Done',
    );
    (modal.contentEl.querySelector('.tablify__af-manage') as HTMLButtonElement).click();
    expect(onManageOptions).toHaveBeenCalledTimes(1);
  });

  it('refreshes the options summary from the live field', () => {
    let live = field({
      name: 'Status',
      type: 'single_select',
      options: [{ id: 'opt_a', name: 'To do', color: 'blue' }],
    });
    const { modal } = openEdit(live, { getField: () => live });
    expect(modal.contentEl.querySelector('.tablify__af-options-summary')?.textContent).toBe(
      '1 option: To do',
    );

    live = { ...live, options: [...(live.options ?? []), { id: 'opt_c', name: 'Doing', color: 'red' }] };
    (modal as unknown as { refreshOptionSummary(): void }).refreshOptionSummary();
    expect(modal.contentEl.querySelector('.tablify__af-options-summary')?.textContent).toBe(
      '2 options: To do, Doing',
    );
  });

  it('sends only the rows it showed: a text field carries no min/max/formula/link', () => {
    const { modal, edited } = openEdit(field({ required: true, regex: '^A' }), {
      linkTargets: [{ tableId: 'tbl_a', name: 'A' }],
    });
    saveButton(modal).click();

    expect(edited).toHaveLength(1);
    expect(edited[0]).toEqual({ name: 'Price', type: 'text', required: true, unique: false, regex: '^A' });
    expect(modal.isOpen).toBe(false);
  });

  it('sends the formula for a formula field and the target for a link field', () => {
    const formula = openEdit(field({ name: 'Total', type: 'formula', formula: '{A} + 1' }));
    saveButton(formula.modal).click();
    expect(formula.edited[0]).toMatchObject({ name: 'Total', type: 'formula', formula: '{A} + 1' });

    const link = openEdit(field({ name: 'L', type: 'link', linkTableId: 'tbl_a' }), {
      linkTargets: [{ tableId: 'tbl_a', name: 'A' }],
    });
    saveButton(link.modal).click();
    expect(link.edited[0]).toMatchObject({ type: 'link', linkTableId: 'tbl_a' });
  });

  it('sends the trimmed name and the chosen type', () => {
    const { modal, edited } = openEdit(field({ name: 'Price', type: 'number' }), {
      canPickType: () => true,
    });
    setValue(textInput(modal), '  Unit Price ');
    pickType('currency', modal.contentEl);
    saveButton(modal).click();

    expect(edited[0]).toMatchObject({ name: 'Unit Price', type: 'currency' });
  });

  it('clears a rule that was emptied instead of sending an empty string', () => {
    const { modal, edited } = openEdit(field({ name: 'Amount', type: 'number', min: 5, max: 9 }));
    setValue(byId(modal, 'tablify__af-min') as HTMLInputElement, '');
    saveButton(modal).click();

    expect(edited[0]).toMatchObject({ min: null });
    expect(edited[0]?.max).toBe(9);
  });

  it('keeps the dialog open with a notice when the name is blank', () => {
    const { modal, edited } = openEdit(field());
    setValue(textInput(modal), '   ');
    saveButton(modal).click();
    expect(edited).toEqual([]);
    expect(modal.isOpen).toBe(true);
  });

  it('keeps the dialog open when the regex does not compile', () => {
    const { modal, edited } = openEdit(field({ regex: '^a' }));
    setValue(byId(modal, 'tablify__af-regex-input') as HTMLInputElement, '^[A-');
    saveButton(modal).click();
    expect(edited).toEqual([]);
    expect(modal.isOpen).toBe(true);
  });

  it('keeps the dialog open when the formula does not parse', () => {
    const { modal, edited } = openEdit(field({ name: 'Total', type: 'formula', formula: '1' }));
    setValue(modal.contentEl.querySelector('textarea.tablify__af-formula') as HTMLTextAreaElement, '{');
    saveButton(modal).click();
    expect(edited).toEqual([]);
    expect(modal.isOpen).toBe(true);
  });

  it('greys the types the caller refuses instead of hiding them — COD-76', () => {
    const { modal } = openEdit(field({ name: 'Amount', type: 'number' }), {
      canPickType: (t: FieldTypeName) => t === 'text',
    });
    const panel = openPicker(modal.contentEl);
    const rows = typeRows(panel);
    // Every change-target type still has a row: nothing silently vanishes from the list.
    expect(rows.map((r) => r.dataset.type)).toEqual([...CHANGE_TARGET_TYPES]);
    const date = typeRow('date', panel);
    expect(date?.getAttribute('aria-disabled')).toBe('true');
    expect(date?.textContent).toContain('Not available for this field');
    // The current type and the allowed one stay selectable.
    expect(typeRow('number', panel)?.getAttribute('aria-disabled')).toBeNull();
    expect(typeRow('text', panel)?.getAttribute('aria-disabled')).toBeNull();
  });

  it('uses the model’s own sentence when the caller passes typeBlockReason', () => {
    const { modal } = openEdit(field({ name: 'Amount', type: 'number' }), {
      typeBlockReason: (t: FieldTypeName) => (t === 'text' ? '3 values cannot convert to text' : null),
    });
    const panel = openPicker(modal.contentEl);
    expect(typeRow('text', panel)?.textContent).toContain('3 values cannot convert to text');
    expect(typeRow('currency', panel)?.getAttribute('aria-disabled')).toBeNull();
  });

  it('keeps the type the window opened with pickable after switching away', () => {
    const { modal } = openEdit(field({ name: 'Amount', type: 'number' }), {
      typeBlockReason: (t: FieldTypeName) => (t === 'number' ? '5 values are numbers' : null),
    });
    pickType('currency', modal.contentEl);
    const panel = openPicker(modal.contentEl);
    // The field's own type is the one place a "would lose values" verdict cannot apply.
    expect(typeRow('number', panel)?.getAttribute('aria-disabled')).toBeNull();
    expect(typeRow('number', panel)?.textContent).not.toContain('5 values are numbers');
  });

  it('shows a read-only type (auto number) even though it is not a change target', () => {
    const { modal } = openEdit(field({ name: 'Row', type: 'auto_number' }));
    expect(triggerLabel(modal)).toContain('Auto number');
    const panel = openPicker(modal.contentEl);
    const row = typeRow('auto_number', panel);
    expect(row).not.toBeNull();
    expect(row?.getAttribute('aria-selected')).toBe('true');
  });
});

describe('AddFieldModal (create mode, unchanged)', () => {
  beforeEach(() => {
    Modal.reset();
    Notice.reset();
    cleanupPickers();
  });

  it('still offers every change-target type, an empty name and Save Field', () => {
    const modal = new AddFieldModal(new App(), () => {});
    modal.open();
    // Create mode offers every change-target type, and blocks none of them.
    const rows = typeRows(openPicker(modal.contentEl));
    expect(rows.map((r) => r.dataset.type)).toEqual([...CHANGE_TARGET_TYPES]);
    expect(rows.every((r) => r.getAttribute('aria-disabled') === null)).toBe(true);
    expect(textInput(modal).value).toBe('');
    expect(saveButton(modal).textContent).toBe('Save Field');
    expect((modal as unknown as { title: string }).title).toBe('Add New Field');
  });

  it('still has the options textarea and no Manage options button', () => {
    const modal = new AddFieldModal(new App(), () => {});
    modal.open();
    expect(modal.contentEl.querySelector('#tablify__af-options')).not.toBeNull();
    expect(modal.contentEl.querySelector('.tablify__af-manage')).toBeNull();
    expect(modal.contentEl.querySelector('.tablify__af-options-summary')).toBeNull();
  });
});
