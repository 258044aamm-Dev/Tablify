/**
 * SAD-115 — session behaviour: a status change to Done moves the row, and one undo restores
 * both the value and the position.
 */
import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/model/tableSession.js';
import { makeFile } from '../io/export.fixtures.js';

// makeFile(6): row i has status STATUS_OPTS[i % 3] → 1 Doing, 2 Done, 3 Todo, 4 Doing, 5 Done, 6 Todo.
/** Values of a row that must exist (fails the test otherwise). */
function valuesOf(s: ReturnType<typeof createSession>, id: string): Record<string, unknown> {
  const row = s.store.getRow(id);
  if (!row) throw new Error(`row ${id} missing`);
  return row.values;
}

const ORIGINAL = ['row_000001', 'row_000002', 'row_000003', 'row_000004', 'row_000005', 'row_000006'];

describe('SAD-115 — session: Done moves the row', () => {
  it('ungrouped: a row set to Done goes to the bottom of the table', () => {
    const s = createSession(makeFile(6));
    s.setValue('row_000001', 'fld_status', 'opt_done');
    expect(valuesOf(s, 'row_000001').fld_status).toBe('opt_done');
    expect(s.store.getDisplayOrder()).toEqual([...ORIGINAL.filter((id) => id !== 'row_000001'), 'row_000001']);
  });

  it('one undo restores both the value and the position', () => {
    const s = createSession(makeFile(6));
    s.setValue('row_000001', 'fld_status', 'opt_done');
    expect(s.undo()).toBe(true);
    expect(valuesOf(s, 'row_000001').fld_status).toBe('opt_doing');
    expect(s.store.getDisplayOrder()).toEqual(ORIGINAL);
    // Only one step was recorded: a second undo has nothing to undo.
    expect(s.undo()).toBe(false);
  });

  it('redo re-applies the value and the move together', () => {
    const s = createSession(makeFile(6));
    s.setValue('row_000001', 'fld_status', 'opt_done');
    s.undo();
    expect(s.redo()).toBe(true);
    expect(valuesOf(s, 'row_000001').fld_status).toBe('opt_done');
    expect(s.store.getDisplayOrder().at(-1)).toBe('row_000001');
  });

  it('a change that is not to Done does not move the row', () => {
    const s = createSession(makeFile(6));
    s.setValue('row_000001', 'fld_status', 'opt_todo');
    expect(s.store.getDisplayOrder()).toEqual(ORIGINAL);
  });

  it('the Done checkbox field (a different field named Done) does not move the row', () => {
    const s = createSession(makeFile(6));
    s.setValue('row_000001', 'fld_done', true);
    expect(s.store.getDisplayOrder()).toEqual(ORIGINAL);
  });

  it('grouped by another field: the row goes to the bottom of its own group', () => {
    const s = createSession(makeFile(6));
    // Ratings: r1=1, r2=1, r3=2, r4=1, r5=2, r6=1. Group by rating.
    const ratings = { row_000001: 1, row_000002: 1, row_000003: 2, row_000004: 1, row_000005: 2, row_000006: 1 };
    for (const [id, r] of Object.entries(ratings)) s.store.updateRow(id, { fld_rating: r });
    s.setView({ ...s.getView(), groupBy: 'fld_rating' });
    // row_000003 is rating 2. The rest of its group is row_000005. Bottom of that group is just
    // before row_000006, the next row outside the group.
    s.setValue('row_000003', 'fld_status', 'opt_done');
    expect(s.store.getDisplayOrder()).toEqual([
      'row_000001', 'row_000002', 'row_000004', 'row_000005', 'row_000003', 'row_000006',
    ]);
  });

  it('grouped by the status field itself: no move', () => {
    const s = createSession(makeFile(6));
    s.setView({ ...s.getView(), groupBy: 'fld_status' });
    s.setValue('row_000001', 'fld_status', 'opt_done');
    expect(s.store.getDisplayOrder()).toEqual(ORIGINAL);
  });
});

describe('SAD-115 — the Airtable pull path moves a pulled Done row', () => {
  it('a pulled Done status moves the row to the bottom (no undo entry, like the pull)', async () => {
    const { applyDoneMovesForChange } = await import('../../src/model/doneOrder.js');
    const s = createSession(makeFile(6));
    const before = valuesOf(s, 'row_000001');
    s.store.updateRow('row_000001', { fld_status: 'opt_done' });
    const moved = applyDoneMovesForChange(
      s.store, null, 'row_000001', before, { fld_status: 'opt_done' },
    );
    expect(moved).toBe(1);
    expect(s.store.getDisplayOrder().at(-1)).toBe('row_000001');
    expect(s.undo()).toBe(false);
  });

  it('a pulled change that is not to Done leaves the order alone', async () => {
    const { applyDoneMovesForChange } = await import('../../src/model/doneOrder.js');
    const s = createSession(makeFile(6));
    const before = valuesOf(s, 'row_000001');
    s.store.updateRow('row_000001', { fld_status: 'opt_todo' });
    expect(applyDoneMovesForChange(s.store, null, 'row_000001', before, { fld_status: 'opt_todo' })).toBe(0);
    expect(s.store.getDisplayOrder()).toEqual(ORIGINAL);
  });
});
