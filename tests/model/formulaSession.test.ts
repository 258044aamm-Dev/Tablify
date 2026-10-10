/**
 * P8-03 (SAD-62) T-E tests: formula fields in the table session.
 * Formula results are display-only: they are computed from the cells, shown in getDisplayRows(),
 * and never written to the file. Edits go through the command stack, so undo works.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSession } from '../../src/model/tableSession.js';
import { parse } from '../../src/format/parse.js';
import { serialize } from '../../src/format/serialize.js';
import { getFieldType } from '../../src/model/fieldTypes/registry.js';
import { ERROR_MESSAGES } from '../../src/model/formulaRuntime.js';
import type { TablifyFile } from '../../src/model/types.js';

function loadSample(): TablifyFile {
  const text = readFileSync(join(process.cwd(), 'samples', 'v2', 'formula-link.tablify'), 'utf-8');
  const result = parse(text);
  if (!result.ok) throw new Error(`sample did not parse: ${result.error}`);
  return result.data;
}

function totalOf(session: ReturnType<typeof createSession>, rowIndex: number): unknown {
  return session.getDisplayRows()[rowIndex].values['fld_total'];
}

describe('P8-03 formula fields (T-E)', () => {
  it('computes a formula from its input cells on load', () => {
    const session = createSession(loadSample());
    expect(totalOf(session, 0)).toBe(13.5); // 4.5 * 3
    expect(totalOf(session, 1)).toBe(24); // 12 * 2
  });

  it('dependency edit: changing an input cell updates the formula display', () => {
    const session = createSession(loadSample());
    const rowId = session.getDisplayRows()[0].id;
    session.setValue(rowId, 'fld_price', 10);
    expect(totalOf(session, 0)).toBe(30); // 10 * 3
  });

  it('dependency edit is undoable: undo restores the previous formula value', () => {
    const session = createSession(loadSample());
    const rowId = session.getDisplayRows()[0].id;
    session.setValue(rowId, 'fld_price', 10);
    expect(totalOf(session, 0)).toBe(30);
    expect(session.undo()).toBe(true);
    expect(totalOf(session, 0)).toBe(13.5);
    expect(session.redo()).toBe(true);
    expect(totalOf(session, 0)).toBe(30);
  });

  it('formula is read-only: setValue on a formula cell is refused and changes nothing', () => {
    const session = createSession(loadSample());
    const rowId = session.getDisplayRows()[0].id;
    session.setValue(rowId, 'fld_total', 999);
    expect(totalOf(session, 0)).toBe(13.5);
    expect(getFieldType('formula').readOnly).toBe(true);
  });

  it('cycle error: a formula that depends on itself shows #CYCLE! on the cell', () => {
    const session = createSession(loadSample());
    const rowId = session.getDisplayRows()[0].id;
    const result = session.setFormula('fld_total', '{Total} + 1');
    expect(result.ok).toBe(true);
    const err = session.getFormulaError(rowId, 'fld_total');
    expect(err?.code).toBe('#CYCLE!');
    expect(err?.message).toBe(ERROR_MESSAGES['#CYCLE!']);
    expect(totalOf(session, 0)).toBe('#CYCLE!');
  });

  it('P8-04: a formula that reads a link field gives #VALUE! (formula-spec §4.1, §12.2)', () => {
    const session = createSession(loadSample());
    const result = session.setFormula('fld_total', '{Customer} & "x"');
    expect(result.ok).toBe(true);
    expect(totalOf(session, 0)).toBe('#VALUE!');
  });

  it('unknown field name shows #NAME? on the cell', () => {
    const session = createSession(loadSample());
    const rowId = session.getDisplayRows()[0].id;
    expect(session.setFormula('fld_total', '{Nope} * 2').ok).toBe(true);
    expect(session.getFormulaError(rowId, 'fld_total')?.code).toBe('#NAME?');
  });

  it('syntax error is refused with a message and the old formula is kept', () => {
    const session = createSession(loadSample());
    const result = session.setFormula('fld_total', '{Price} * (');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(ERROR_MESSAGES['#PARSE!']);
    expect(session.getField('fld_total')?.formula).toBe('{Price} * {Quantity}');
  });

  it('setFormula on a non-formula field is refused', () => {
    const session = createSession(loadSample());
    const result = session.setFormula('fld_price', '1 + 1');
    expect(result.ok).toBe(false);
  });

  it('addField with a formula adds a computed column', () => {
    const session = createSession(loadSample());
    session.addField('Double', 'formula', '{Price} * 2');
    const added = session.getFields().find((f) => f.name === 'Double');
    expect(added?.type).toBe('formula');
    expect(session.getDisplayRows()[0].values[added?.id ?? '']).toBe(9); // 4.5 * 2
  });

  it('save strips formula results: the file has no computed values, and stays formatVersion 2', () => {
    const session = createSession(loadSample());
    const file = session.toFile();
    expect(file.formatVersion).toBe(2);
    for (const row of file.rows) expect(row.values).not.toHaveProperty('fld_total');
    const text = serialize(file);
    expect(JSON.parse(text).formatVersion).toBe(2);
    expect(text).not.toContain('13.5');
  });

  it('link cell formats as a count, never [object Object] (P8-04: edited in the picker)', () => {
    const session = createSession(loadSample());
    const row = session.getDisplayRows()[0];
    const linkType = getFieldType('link');
    expect(linkType.readOnly).toBe(false);
    expect(linkType.format(row.values['fld_customer'] ?? null, {} as never)).toBe('1 linked');
    expect(linkType.format(null, {} as never)).toBe('');
  });

  it('P8-04: a new link field defaults to this table, and a link value goes through the command path', () => {
    const session = createSession(loadSample());
    const linkId = session.addField('Parent', 'link').id;
    expect(session.getField(linkId)?.linkTableId).toBe('tbl_01J9B7ORDR');
    const rowId = session.getDisplayRows()[0].id;
    const ref = { tableId: 'tbl_01J9B7CUST', rowId: 'row_01J9B9C002' };
    session.setValue(rowId, linkId, [ref]);
    expect(session.toFile().rows[0].values[linkId]).toEqual([ref]);
    expect(session.toFile().formatVersion).toBe(2);
    expect(session.undo()).toBe(true);
    expect(session.toFile().rows[0].values[linkId] ?? null).toBeNull();
  });

  it('a plain table without formula or link fields keeps formatVersion 1', () => {
    const file: TablifyFile = {
      ...loadSample(),
      fields: loadSample().fields.filter((f) => f.type !== 'formula' && f.type !== 'link'),
      rows: [],
      views: [{ ...loadSample().views[0], columnOrder: ['fld_item', 'fld_price', 'fld_qty'] }],
      formatVersion: 1,
    };
    const session = createSession(file);
    expect(session.toFile().formatVersion).toBe(1);
  });
});
