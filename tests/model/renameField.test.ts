/**
 * Rename Field — COD-67.
 *
 * Tablify had no way to rename a field at all: there was no session method, no command and no
 * menu entry, so this is new model functionality. Clicking a header has to open the same window
 * used to create a field, and that window edits the name; this is the model half of it.
 *
 * The reason this needs its own file is undo. Formulas and saved queries address fields by name,
 * not by id (`{Price}`, `Price:>100`), so a rename that only touched `field.name` would leave
 * every reference pointing at nothing. The rewrite has to happen in the SAME undo step: two
 * steps would let the user undo the name but keep the rewritten formulas, which parse to #NAME?
 * and cannot be recovered by a second undo if the user then edits anything.
 */

import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/model/tableSession.js';
import { renameInFormula, renameInQuery } from '../../src/model/renameRefs.js';
import type { TablifyFile, ViewDefinition } from '../../src/model/types.js';

function mkView(overrides: Partial<ViewDefinition> = {}): ViewDefinition {
  return {
    id: 'view_1',
    name: 'Default',
    sort: [],
    groupBy: null,
    hidden: [],
    frozenColumns: 0,
    rowHeight: 'medium',
    columnWidths: {},
    columnOrder: ['fld_price', 'fld_tax', 'fld_total', 'fld_label'],
    warnings: [],
    ...overrides,
  };
}

function mkFile(view: ViewDefinition = mkView()): TablifyFile {
  return {
    formatVersion: 1,
    tableId: 'tbl_rename',
    name: 'Rename Fixture',
    fields: [
      { id: 'fld_price', name: 'Price', type: 'number', primary: true },
      { id: 'fld_tax', name: 'Tax', type: 'number' },
      { id: 'fld_note', name: 'Note', type: 'text' },
      { id: 'fld_total', name: 'Total', type: 'formula', formula: '{Price} + {Tax}' },
      { id: 'fld_label', name: 'Label', type: 'formula', formula: '"Price: " & {Price}' },
    ],
    rows: [
      {
        id: 'row_1',
        rev: 4,
        updatedAt: '2026-01-01T00:00:00.000Z',
        values: { fld_price: 100, fld_tax: 5, fld_note: 'alpha' },
        sync: null,
      },
    ],
    views: [view],
    syncLink: null,
  };
}

const byId = (session: ReturnType<typeof createSession>, id: string) =>
  session.store.getFields().find((f) => f.id === id);

describe('session.renameField', () => {
  it('renames the field without touching its values or the row revision', () => {
    const file = mkFile();
    const session = createSession(file);

    const result = session.renameField('fld_price', 'Unit Price');

    expect(result.ok).toBe(true);
    expect(byId(session, 'fld_price')?.name).toBe('Unit Price');
    expect(session.store.getRow('row_1')?.values.fld_price).toBe(100);
    expect(session.store.getRow('row_1')?.rev).toBe(4);
  });

  it('rewrites {Old} in this table’s formulas in the same undo step', () => {
    const session = createSession(mkFile());

    const result = session.renameField('fld_price', 'Unit Price');

    expect(result).toMatchObject({ ok: true, updatedFormulas: 2 });
    expect(byId(session, 'fld_total')?.formula).toBe('{Unit Price} + {Tax}');
    expect(byId(session, 'fld_label')?.formula).toBe('"Price: " & {Unit Price}');

    // One undo puts the name and both formulas back together.
    expect(session.undo()).toBe(true);
    expect(byId(session, 'fld_price')?.name).toBe('Price');
    expect(byId(session, 'fld_total')?.formula).toBe('{Price} + {Tax}');
    expect(byId(session, 'fld_label')?.formula).toBe('"Price: " & {Price}');

    // …and redo re-applies the whole thing.
    expect(session.redo()).toBe(true);
    expect(byId(session, 'fld_price')?.name).toBe('Unit Price');
    expect(byId(session, 'fld_total')?.formula).toBe('{Unit Price} + {Tax}');
  });

  it('rewrites the saved view query, and undo restores it', () => {
    const view = mkView({ query: 'Price:>100 Tax:>5' });
    const session = createSession(mkFile(view));

    session.renameField('fld_price', 'Unit Price');

    expect(session.getView().query).toBe('"Unit Price":>100 Tax:>5');
    session.undo();
    expect(session.getView().query).toBe('Price:>100 Tax:>5');
  });

  it('does not touch a query or formula that never mentioned the field', () => {
    const view = mkView({ query: 'Tax:>5' });
    const session = createSession(mkFile(view));

    session.renameField('fld_price', 'Unit Price');

    expect(session.getView().query).toBe('Tax:>5');
    // The string literal keeps its text; the reference beside it still moves.
    expect(byId(session, 'fld_label')?.formula).toBe('"Price: " & {Unit Price}');
    expect(byId(session, 'fld_total')?.formula).toBe('{Unit Price} + {Tax}');
  });

  it('blocks an empty name and a duplicate name without changing anything', () => {
    const session = createSession(mkFile());

    expect(session.renameField('fld_price', '   ')).toMatchObject({
      ok: false,
      reason: 'Field name cannot be empty',
    });
    expect(session.renameField('fld_price', ' tax ')).toMatchObject({ ok: false });
    expect(byId(session, 'fld_price')?.name).toBe('Price');
    expect(session.stack.canUndo()).toBe(false);
  });

  it('reports a missing field instead of throwing', () => {
    const session = createSession(mkFile());
    expect(session.renameField('fld_nope', 'X')).toMatchObject({ ok: false });
    expect(session.stack.canUndo()).toBe(false);
  });
});

describe('session.editField', () => {
  it('renames and retypes in one undo step', () => {
    const session = createSession(mkFile());

    const result = session.editField('fld_price', 'Unit Price', 'text');

    expect(result.ok).toBe(true);
    expect(byId(session, 'fld_price')?.name).toBe('Unit Price');
    expect(byId(session, 'fld_price')?.type).toBe('text');
    expect(typeof session.store.getRow('row_1')?.values.fld_price).toBe('string');
    // References follow the new name, not the new type.
    expect(byId(session, 'fld_total')?.formula).toBe('{Unit Price} + {Tax}');

    expect(session.undo()).toBe(true);
    expect(byId(session, 'fld_price')?.name).toBe('Price');
    expect(byId(session, 'fld_price')?.type).toBe('number');
    expect(session.store.getRow('row_1')?.values.fld_price).toBe(100);
    expect(byId(session, 'fld_total')?.formula).toBe('{Price} + {Tax}');
  });

  it('blocks both halves when the type change would lose values', () => {
    const session = createSession(mkFile());
    // Note holds 'alpha', which cannot become a number. The rename must not slip through on its
    // own: the user asked for one edit, and half of it landing would be a silent surprise.
    const result = session.editField('fld_note', 'Comment', 'number');
    expect(result).toMatchObject({ ok: false });
    expect(byId(session, 'fld_note')?.name).toBe('Note');
    expect(byId(session, 'fld_note')?.type).toBe('text');
    expect(session.stack.canUndo()).toBe(false);
  });

  it('leaves the name alone on a type-only edit', () => {
    const session = createSession(mkFile());
    session.editField('fld_price', 'Price', 'currency');
    expect(byId(session, 'fld_price')?.name).toBe('Price');
    expect(byId(session, 'fld_price')?.type).toBe('currency');
    expect(byId(session, 'fld_total')?.formula).toBe('{Price} + {Tax}');
  });
});

describe('renameInFormula', () => {
  it('leaves text inside a string literal alone', () => {
    expect(renameInFormula('"{Price}" & {Price}', 'Price', 'Cost')).toBe('"{Price}" & {Cost}');
  });

  it('honours escaped braces and backslashes in the reference', () => {
    expect(renameInFormula('{a\\}b} & {A}', 'a}b', 'C')).toBe('{C} & {A}');
    expect(renameInFormula('{a\\\\b}', 'a\\b', 'C')).toBe('{C}');
  });

  it('returns the source unchanged when the name does not appear', () => {
    expect(renameInFormula('{A} + 1', 'B', 'C')).toBe('{A} + 1');
  });
});

describe('renameInQuery', () => {
  it('rewrites only the field-name span and keeps the rest of the text', () => {
    expect(renameInQuery('Price:>100  Tax:>5', 'Price', 'Unit Price')).toBe(
      '"Unit Price":>100  Tax:>5',
    );
  });

  it('matches like the engine does — trimmed and case-insensitive', () => {
    expect(renameInQuery('price:Done', 'Price', 'Cost')).toBe('Cost:Done');
  });

  it('leaves an unparseable query untouched', () => {
    expect(renameInQuery('Price:>', 'Price', 'Cost')).toBe('Price:>');
  });
});
