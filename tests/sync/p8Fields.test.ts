/**
 * @vitest-environment jsdom
 */
/**
 * P8 (formula and link) under Airtable sync. Neither type is sent to Airtable, created there, or
 * read from it. These tests pin that rule, which P8-03 and P8-04 rely on.
 */
import { describe, it, expect } from 'vitest';
import { planAutoCreate } from '../../src/sync/autoCreate.js';
import { remoteToLocal, writePayload } from '../../src/sync/values.js';
import type { FieldDefinition, Row } from '../../src/model/types.js';

const formulaField = { id: 'fld_total', name: 'Total', type: 'formula', formula: '{Price} * 2' } as FieldDefinition;
const linkField = { id: 'fld_cust', name: 'Customer', type: 'link', linkTableId: 'tbl_c' } as FieldDefinition;
const textField = { id: 'fld_item', name: 'Item', type: 'text' } as FieldDefinition;

describe('P8 fields under Airtable sync', () => {
  it('auto-create skips formula and link fields with a reason, and creates nothing for them', () => {
    const plan = planAutoCreate([textField, formulaField, linkField], []);
    const created = plan.items.map((i) => i.fieldId);
    expect(created).toContain('fld_item');
    expect(created).not.toContain('fld_total');
    expect(created).not.toContain('fld_cust');
    const skipped = Object.fromEntries(plan.skipped.map((s) => [s.fieldId, s.reason]));
    expect(skipped['fld_total']).toBe('computed in Tablify; never sent to Airtable');
    expect(skipped['fld_cust']).toBe('links are not created in Airtable from Tablify');
  });

  it('a write payload never contains formula or link values', () => {
    const row = {
      values: { fld_item: 'Pen', fld_total: 9, fld_cust: [{ tableId: 'tbl_c', rowId: 'r1' }] },
    } as unknown as Pick<Row, 'values'>;
    const payload = writePayload([textField, formulaField, linkField], row);
    expect(Object.keys(payload)).toEqual([]);
  });

  it('remote values never become formula or link values', () => {
    expect(remoteToLocal(formulaField, 'anything')).toBeNull();
    expect(remoteToLocal(linkField, ['rec1'])).toBeNull();
  });

  it('a formula or link field that somehow carries an Airtable link is still never written', () => {
    const linkedFormula = { ...formulaField, airtable: { id: 'fldAT1', type: 'formula', readOnly: false } } as unknown as FieldDefinition;
    const linkedLink = { ...linkField, airtable: { id: 'fldAT2', type: 'multipleRecordLinks', readOnly: false } } as unknown as FieldDefinition;
    const row = {
      values: { fld_total: 9, fld_cust: [{ tableId: 'tbl_c', rowId: 'r1' }] },
    } as unknown as Pick<Row, 'values'>;
    expect(writePayload([linkedFormula, linkedLink], row)).toEqual({});
  });

  it('localToRemote is only reached for synced, writable fields (text is still sent)', () => {
    const linkedText = { ...textField, airtable: { id: 'fldAT3', type: 'singleLineText', readOnly: false } } as unknown as FieldDefinition;
    const row = { values: { fld_item: 'Pen' } } as unknown as Pick<Row, 'values'>;
    expect(writePayload([linkedText], row)).toEqual({ fldAT3: 'Pen' });
  });
});
