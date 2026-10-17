/**
 * COD-69 — the field patch behind the shared "Modify Field" window.
 *
 * The window renders the same rows the create dialog does and saves them in one go, so
 * session.editField takes a patch instead of (name, type?). The rules that matter:
 *
 *   - only keys the caller sends are written (a row the window hid must not clear anything),
 *   - a rule set to false / null / '' is removed,
 *   - a formula is compile-checked before ANY of the edit lands,
 *   - a save that changes nothing adds no undo entry and bumps no row revision,
 *   - options are never touched here — they belong to createSetFieldOptionsCommand.
 */

import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/model/tableSession.js';
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
    columnOrder: ['fld_text', 'fld_num', 'fld_total', 'fld_tags', 'fld_link'],
    warnings: [],
    ...overrides,
  };
}

function mkFile(view: ViewDefinition = mkView()): TablifyFile {
  return {
    formatVersion: 2,
    tableId: 'tbl_edit',
    name: 'Edit Fixture',
    fields: [
      {
        id: 'fld_text',
        name: 'Title',
        type: 'text',
        primary: true,
        required: true,
        unique: true,
        regex: '^[A-Z]',
      },
      { id: 'fld_num', name: 'Amount', type: 'number', min: 0, max: 100 },
      { id: 'fld_total', name: 'Total', type: 'formula', formula: '{Amount} * 2' },
      {
        id: 'fld_tags',
        name: 'Tags',
        type: 'multi_select',
        options: [
          { id: 'opt_a', name: 'Alpha', color: 'blue' },
          { id: 'opt_b', name: 'Beta', color: 'green' },
        ],
      },
      { id: 'fld_link', name: 'Linked', type: 'link', linkTableId: 'tbl_other' },
    ],
    rows: [
      {
        id: 'row_1',
        rev: 7,
        updatedAt: '2026-01-01T00:00:00.000Z',
        values: { fld_text: 'Alpha', fld_num: 10, fld_tags: ['opt_a'] },
        sync: null,
      },
    ],
    views: [view],
    syncLink: null,
  };
}

const field = (session: ReturnType<typeof createSession>, id: string) => session.getField(id);

describe('editField — validation rules', () => {
  it('saves every rule in one undo step', () => {
    const session = createSession(mkFile());
    const result = session.editField('fld_num', {
      required: true,
      unique: true,
      min: 5,
      max: 50,
    });

    expect(result.ok).toBe(true);
    expect(field(session, 'fld_num')).toMatchObject({
      required: true,
      unique: true,
      min: 5,
      max: 50,
    });

    expect(session.undo()).toBe(true);
    expect(field(session, 'fld_num')).toMatchObject({ min: 0, max: 100 });
    expect(field(session, 'fld_num')?.required).toBeUndefined();
  });

  it('switching a rule off removes the key instead of storing false', () => {
    const session = createSession(mkFile());
    session.editField('fld_text', { required: false, unique: false, regex: '' });

    const next = field(session, 'fld_text');
    expect(next).toBeDefined();
    expect('required' in (next as object)).toBe(false);
    expect('unique' in (next as object)).toBe(false);
    expect('regex' in (next as object)).toBe(false);
  });

  it('refuses an invalid regex without changing anything', () => {
    const session = createSession(mkFile());
    const result = session.editField('fld_text', { name: 'Heading', regex: '^[A-' });

    expect(result).toMatchObject({ ok: false, reason: 'The regex is not valid.' });
    expect(field(session, 'fld_text')?.name).toBe('Title');
    expect(field(session, 'fld_text')?.regex).toBe('^[A-Z]');
    expect(session.stack.canUndo()).toBe(false);
  });

  it('leaves keys the caller did not send exactly as they were', () => {
    const session = createSession(mkFile());
    session.editField('fld_text', { name: 'Heading' });

    const next = field(session, 'fld_text');
    expect(next?.required).toBe(true);
    expect(next?.unique).toBe(true);
    expect(next?.regex).toBe('^[A-Z]');
  });
});

describe('editField — formula', () => {
  it('saves a formula in the same undo step as a rename', () => {
    const session = createSession(mkFile());
    session.editField('fld_total', { name: 'Doubled', formula: '{Amount} * 3' });

    expect(field(session, 'fld_total')).toMatchObject({ name: 'Doubled', formula: '{Amount} * 3' });
    expect(field(session, 'fld_num')?.name).toBe('Amount');

    expect(session.undo()).toBe(true);
    expect(field(session, 'fld_total')).toMatchObject({ name: 'Total', formula: '{Amount} * 2' });
  });

  it('refuses an unparseable expression and keeps the rename out with it', () => {
    const session = createSession(mkFile());
    const result = session.editField('fld_total', { name: 'Doubled', formula: '{Amount} *' });

    expect(result.ok).toBe(false);
    expect(field(session, 'fld_total')).toMatchObject({ name: 'Total', formula: '{Amount} * 2' });
    expect(session.stack.canUndo()).toBe(false);
  });

  it('cannot inject a formula key into a field that is not a formula field', () => {
    const session = createSession(mkFile());
    session.editField('fld_num', { formula: '1 + 1' });
    expect('formula' in (field(session, 'fld_num') as object)).toBe(false);
  });
});

describe('editField — type changes still own their keys', () => {
  it('keeps a rule that still applies when retyping, and drops one that does not', () => {
    const session = createSession(mkFile());
    session.editField('fld_num', { type: 'text', max: null });

    const next = field(session, 'fld_num');
    expect(next?.type).toBe('text');
    expect('max' in (next as object)).toBe(false);
    expect(next?.min).toBe(0);
  });

  it('drops the formula key when a formula field stops being a formula field', () => {
    const session = createSession(mkFile());
    session.editField('fld_total', { type: 'text' });
    expect('formula' in (field(session, 'fld_total') as object)).toBe(false);
  });

  it('blocks the whole edit when the type change would lose values', () => {
    const session = createSession(mkFile());
    // 'Alpha' cannot become a number; the rename must not land on its own.
    const result = session.editField('fld_text', { name: 'Heading', type: 'number', required: false });

    expect(result).toMatchObject({ ok: false });
    expect(field(session, 'fld_text')?.name).toBe('Title');
    expect(field(session, 'fld_text')?.required).toBe(true);
    expect(session.stack.canUndo()).toBe(false);
  });
});

describe('editField — no-ops and untouched state', () => {
  it('adds no undo entry and does not bump a revision when nothing changed', () => {
    const session = createSession(mkFile());
    const before = session.store.getRow('row_1');

    const result = session.editField('fld_text', {
      name: 'Title',
      required: true,
      unique: true,
      regex: '^[A-Z]',
    });

    expect(result).toMatchObject({ ok: true, updatedFormulas: 0 });
    expect(session.stack.canUndo()).toBe(false);
    expect(session.store.getRow('row_1')?.rev).toBe(before?.rev);
  });

  it('never touches options — they belong to the Manage options command', () => {
    const session = createSession(mkFile());
    const before = field(session, 'fld_tags')?.options?.map((o) => ({ ...o }));

    session.editField('fld_tags', { name: 'Labels', required: true });

    expect(field(session, 'fld_tags')?.options).toEqual(before);
    expect(session.store.getRow('row_1')?.values.fld_tags).toEqual(['opt_a']);
  });

  it('reports a missing field instead of throwing', () => {
    const session = createSession(mkFile());
    expect(session.editField('fld_nope', { name: 'X' })).toMatchObject({ ok: false });
  });

  it('sets a link target only on a link field', () => {
    const session = createSession(mkFile());
    session.editField('fld_link', { linkTableId: 'tbl_third' });
    expect(field(session, 'fld_link')?.linkTableId).toBe('tbl_third');

    session.editField('fld_num', { linkTableId: 'tbl_third' });
    expect('linkTableId' in (field(session, 'fld_num') as object)).toBe(false);
  });
});
