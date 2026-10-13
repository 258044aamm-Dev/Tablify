/**
 * SAD-115 — a row whose single-select status becomes "Done" moves to the bottom of its group.
 *
 * Pure rules: which option counts as Done, and where the row goes. The session and undo
 * behaviour is in doneMove.session.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { isDoneOption, doneMoveBefore, moveRowBefore } from '../../src/model/doneOrder.js';
import type { FieldDefinition, Row } from '../../src/model/types.js';

const STATUS: FieldDefinition = {
  id: 'fld_status',
  name: 'Status',
  type: 'single_select',
  options: [
    { id: 'o_todo', name: 'Todo', color: 'gray' },
    { id: 'o_done', name: 'Done', color: 'green' },
  ],
};

const TEAM: FieldDefinition = {
  id: 'fld_team',
  name: 'Team',
  type: 'text',
};

const CHECK: FieldDefinition = { id: 'fld_check', name: 'Done', type: 'checkbox' };

function row(id: string, values: Record<string, unknown>): Row {
  return { id, rev: 1, updatedAt: '2026-10-13T00:00:00.000Z', sync: null, values } as unknown as Row;
}

describe('SAD-115 — which option is Done', () => {
  it('matches the option named Done, ignoring case and surrounding spaces', () => {
    expect(isDoneOption(STATUS, 'o_done')).toBe(true);
    expect(isDoneOption(STATUS, 'o_todo')).toBe(false);
    const loose: FieldDefinition = {
      ...STATUS,
      options: [{ id: 'x', name: '  DONE ', color: 'green' }],
    };
    expect(isDoneOption(loose, 'x')).toBe(true);
  });

  it('never matches a non-single-select field, even one named Done (checkbox)', () => {
    expect(isDoneOption(CHECK, true as never)).toBe(false);
    expect(isDoneOption(CHECK, 'o_done' as never)).toBe(false);
  });

  it('a field with no Done option never matches', () => {
    const none: FieldDefinition = { ...STATUS, options: [{ id: 'o_todo', name: 'Todo', color: 'gray' }] };
    expect(isDoneOption(none, 'o_todo')).toBe(false);
  });
});

describe('SAD-115 — where a Done row goes', () => {
  const rows = [
    row('A', { fld_status: 'o_todo', fld_team: 'x' }),
    row('B', { fld_status: 'o_todo', fld_team: 'y' }),
    row('C', { fld_status: 'o_todo', fld_team: 'x' }),
    row('D', { fld_status: 'o_todo', fld_team: 'z' }),
  ];

  it('ungrouped: moves to the end of the stored order', () => {
    expect(doneMoveBefore({ rows, rowId: 'A', field: STATUS, oldValue: 'o_todo', newValue: 'o_done', groupField: null }))
      .toEqual({ beforeRowId: null });
  });

  it('grouped by another field: moves to the bottom of its own group only', () => {
    // Group x is A and C. Bottom of x, after C, is just before D (the next row that is not x).
    expect(doneMoveBefore({ rows, rowId: 'A', field: STATUS, oldValue: 'o_todo', newValue: 'o_done', groupField: TEAM }))
      .toEqual({ beforeRowId: 'D' });
  });

  it('grouped: a row that is the only one in its group does not move', () => {
    expect(doneMoveBefore({ rows, rowId: 'B', field: STATUS, oldValue: 'o_todo', newValue: 'o_done', groupField: TEAM }))
      .toBeNull();
  });

  it('grouped by the same status field: no move (grouping already separates Done)', () => {
    expect(doneMoveBefore({ rows, rowId: 'A', field: STATUS, oldValue: 'o_todo', newValue: 'o_done', groupField: STATUS }))
      .toBeNull();
  });

  it('a change that is not to Done does not move', () => {
    expect(doneMoveBefore({ rows, rowId: 'A', field: STATUS, oldValue: 'o_done', newValue: 'o_todo', groupField: null }))
      .toBeNull();
  });

  it('a row that was already Done does not move again', () => {
    expect(doneMoveBefore({ rows, rowId: 'A', field: STATUS, oldValue: 'o_done', newValue: 'o_done', groupField: null }))
      .toBeNull();
  });

  it('is a no-op for a field that is not single-select', () => {
    expect(doneMoveBefore({ rows, rowId: 'A', field: CHECK, oldValue: false, newValue: true, groupField: null }))
      .toBeNull();
  });
});

describe('SAD-115 — moveRowBefore', () => {
  it('moves a row before another row and reports its old index', () => {
    const moves: Array<[string, number]> = [];
    const order = ['A', 'B', 'C'];
    const store = {
      getDisplayOrder: () => [...order],
      moveRow: (id: string, index: number) => {
        moves.push([id, index]);
        const i = order.indexOf(id);
        order.splice(i, 1);
        order.splice(index, 0, id);
      },
    };
    expect(moveRowBefore(store as never, 'A', 'C')).toBe(0);
    expect(order).toEqual(['B', 'A', 'C']);
  });

  it('a null target sends the row to the end', () => {
    const order = ['A', 'B', 'C'];
    const store = {
      getDisplayOrder: () => [...order],
      moveRow: (id: string, index: number) => {
        order.splice(order.indexOf(id), 1);
        order.splice(index, 0, id);
      },
    };
    moveRowBefore(store as never, 'A', null);
    expect(order).toEqual(['B', 'C', 'A']);
  });
});
