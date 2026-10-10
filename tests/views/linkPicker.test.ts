/**
 * @vitest-environment jsdom
 *
 * P8-04 (SAD-63): the row picker for link cells, and the integrity report modal.
 * Runs against the obsidian mock (see tests/__mocks__/obsidian.ts).
 */
import { describe, it, expect } from 'vitest';
import { App, Modal } from 'obsidian';
import { LinkPickerModal } from '../../src/views/grid/LinkPickerModal.js';
import { LinkIntegrityModal } from '../../src/commands/linkIntegrity.js';
import { createLinkIndex, snapshotTable, checkIntegrity } from '../../src/links/linkModel.js';
import { parse } from '../../src/format/parse.js';
import type { FieldDefinition, LinkRef, TablifyFile } from '../../src/model/types.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CUSTOMERS_ID = 'tbl_01J9B7CUST';

function customers(): TablifyFile {
  const text = readFileSync(join(process.cwd(), 'samples', 'v2', 'customers.tablify'), 'utf-8');
  const parsed = parse(text);
  if (!parsed.ok) throw new Error('sample');
  return parsed.data;
}

function linkField(linkTableId: string = CUSTOMERS_ID): FieldDefinition {
  return { id: 'fld_customer', name: 'Customer', type: 'link', linkTableId };
}

function indexWithCustomers() {
  const index = createLinkIndex();
  index.put(snapshotTable(customers(), 'samples/v2/customers.tablify'));
  return index;
}

function openPicker(current: LinkRef[], index = indexWithCustomers(), field = linkField()) {
  const app = new App();
  const saved: Array<LinkRef[] | null> = [];
  const modal = new LinkPickerModal({ app: app as never, field, current, index, onSave: (refs) => saved.push(refs) });
  modal.open();
  return { modal, saved };
}

function checkboxes(modal: Modal): HTMLInputElement[] {
  return Array.from(modal.contentEl.querySelectorAll('input[type="checkbox"]')) as unknown as HTMLInputElement[];
}

function button(modal: Modal, label: string): HTMLButtonElement {
  const found = Array.from(modal.contentEl.querySelectorAll('button')).find((b) => b.textContent === label);
  if (!found) throw new Error(`no button "${label}"`);
  return found as unknown as HTMLButtonElement;
}

describe('LinkPickerModal (P8-04)', () => {
  it('lists the target table rows, with the current picks checked', () => {
    const { modal } = openPicker([{ tableId: CUSTOMERS_ID, rowId: 'row_01J9B9C001' }]);
    const labels = Array.from(modal.contentEl.querySelectorAll('.tablify-link-picker__row')).map((r) => r.textContent);
    expect(labels).toEqual(['Ada Lovelace', 'Grace Hopper']);
    expect(checkboxes(modal).map((c) => c.checked)).toEqual([true, false]);
  });

  it('a link to a deleted row is listed as Missing and stays checked until unchecked', () => {
    const current = [{ tableId: CUSTOMERS_ID, rowId: 'row_gone' }];
    const { modal, saved } = openPicker(current);
    // Missing section first, then the two live rows.
    expect(checkboxes(modal).map((c) => c.checked)).toEqual([true, false, false]);
    button(modal, 'Save').click();
    expect(saved).toEqual([[{ tableId: CUSTOMERS_ID, rowId: 'row_gone' }]]);
  });

  it('pick and unpick, then Save: the new value keeps other-table links and the existing order', () => {
    const current: LinkRef[] = [
      { tableId: CUSTOMERS_ID, rowId: 'row_01J9B9C001' },
      { tableId: 'tbl_other', rowId: 'x' },
      { tableId: CUSTOMERS_ID, rowId: 'row_gone' },
    ];
    const { modal, saved } = openPicker(current);
    const boxes = checkboxes(modal); // [missing row_gone, Ada, Grace]
    boxes[0].checked = false;
    boxes[0].dispatchEvent(new Event('change'));
    boxes[2].checked = true;
    boxes[2].dispatchEvent(new Event('change'));
    button(modal, 'Save').click();
    expect(saved).toEqual([
      [
        { tableId: CUSTOMERS_ID, rowId: 'row_01J9B9C001' },
        { tableId: 'tbl_other', rowId: 'x' },
        { tableId: CUSTOMERS_ID, rowId: 'row_01J9B9C002' },
      ],
    ]);
  });

  it('the note reports links to other tables, which are kept', () => {
    const { modal } = openPicker([{ tableId: 'tbl_other', rowId: 'x' }]);
    expect(modal.contentEl.textContent).toContain('1 link to another table is kept.');
  });

  it('search filters rows by name, case-insensitively', () => {
    const { modal } = openPicker([]);
    const search = modal.contentEl.querySelector('input[type="text"]') as unknown as HTMLInputElement;
    search.value = 'GRACE';
    search.dispatchEvent(new Event('input'));
    const labels = Array.from(modal.contentEl.querySelectorAll('.tablify-link-picker__row')).map((r) => r.textContent);
    expect(labels).toEqual(['Grace Hopper']);
  });

  it('Clear sets the cell to empty (null)', () => {
    const { modal, saved } = openPicker([{ tableId: CUSTOMERS_ID, rowId: 'row_01J9B9C001' }]);
    button(modal, 'Clear').click();
    expect(saved).toEqual([null]);
  });

  it('when the linked table is not in the vault, the picker says so and offers only Clear or Cancel', () => {
    const { modal, saved } = openPicker([{ tableId: 'tbl_gone', rowId: 'x' }], createLinkIndex());
    expect(modal.contentEl.textContent).toContain('The table this field links to is not in this vault.');
    expect(checkboxes(modal)).toHaveLength(0);
    button(modal, 'Clear links').click();
    expect(saved).toEqual([null]);
  });

  it('Cancel closes without saving', () => {
    const { modal, saved } = openPicker([]);
    button(modal, 'Cancel').click();
    expect(saved).toEqual([]);
    expect((modal as unknown as { isOpen: boolean }).isOpen).toBe(false);
  });
});

describe('LinkIntegrityModal (P8-04)', () => {
  it('shows the count and each broken link with where it is and what is missing', () => {
    const index = createLinkIndex();
    index.put(snapshotTable(customers(), 'samples/v2/customers.tablify'));
    const report = checkIntegrity(index);
    expect(report.broken).toHaveLength(0);
    const modal = new LinkIntegrityModal(new App() as never, report);
    modal.open();
    expect(modal.contentEl.textContent).toContain('No broken links.');

    const broken = createLinkIndex();
    // The customers table exists, but row_gone is not in it: a missing row, not a missing table.
    broken.put(snapshotTable(customers(), 'samples/v2/customers.tablify'));
    broken.put({
      tableId: 'tbl_src',
      name: 'Orders',
      path: 'Orders.tablify',
      rows: [{ id: 'o1', label: 'Pen set' }],
      linkCells: [
        {
          rowId: 'o1',
          rowLabel: 'Pen set',
          fieldId: 'fld_customer',
          fieldName: 'Customer',
          refs: [{ tableId: CUSTOMERS_ID, rowId: 'row_gone' }],
        },
      ],
    });
    const modal2 = new LinkIntegrityModal(new App() as never, checkIntegrity(broken));
    modal2.open();
    expect(modal2.contentEl.textContent).toContain('1 broken of 1 link checked.');
    expect(modal2.contentEl.textContent).toContain('The linked row was deleted.');
    expect(modal2.contentEl.textContent).toContain('row row_gone');
  });
});
