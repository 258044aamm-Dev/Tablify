/**
 * COD-75 — the rules of the date panel's draft.
 *
 * Every data-loss bug this panel could have lives in one of these rules, so each one is pinned:
 * an untouched draft writes nothing, changing a day keeps the time (seconds and milliseconds
 * included), typing a time means whole minutes, and a corrupt stored value survives.
 */
import { describe, it, expect } from 'vitest';
import { DateDraft, equivalentStored } from '../../../../src/views/grid/date/draft.js';

/** A fixed "now": Saturday 17 October 2026, 14:30 local. */
const NOW = () => new Date(2026, 9, 17, 14, 30, 0, 0);

const pad = (n: number): string => String(n).padStart(2, '0');

/** The local wall clock of an instant, as `YYYY-MM-DDTHH:mm:ss.mmm`. */
function localStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

describe('COD-75 — an untouched draft never writes (the COD-68 rule)', () => {
  it('returns the stored value verbatim, milliseconds included', () => {
    const stored = '2026-10-16T09:30:00.123Z';
    const draft = DateDraft.fromStored('date_time', stored, NOW);
    expect(draft.toStored()).toBe(stored);
    expect(draft.touched).toBe(false);
  });

  it('returns a date string verbatim', () => {
    const draft = DateDraft.fromStored('date', '2026-10-16', NOW);
    expect(draft.toStored()).toBe('2026-10-16');
    expect(draft.text).toBe('2026-10-16');
  });

  it('keeps an unreadable stored value instead of replacing it with null', () => {
    const draft = DateDraft.fromStored('date_time', 'not-a-date', NOW);
    expect(draft.text).toBe('not-a-date');
    expect(draft.toStored()).toBe('not-a-date');
  });

  it('shows the local wall clock the cell shows', () => {
    const stored = '2026-10-16T09:30:00.000Z';
    const draft = DateDraft.fromStored('date_time', stored, NOW);
    const local = new Date(stored);
    expect(draft.text).toBe(
      `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`,
    );
  });

  it('an empty cell is empty', () => {
    const draft = DateDraft.fromStored('date_time', null, NOW);
    expect(draft.hasDate).toBe(false);
    expect(draft.text).toBe('');
    expect(draft.toStored()).toBeNull();
  });
});

describe('COD-75 — picking a day keeps the time', () => {
  it('keeps hours, minutes, seconds and milliseconds', () => {
    const stored = '2026-10-16T09:30:45.123Z';
    const draft = DateDraft.fromStored('date_time', stored, NOW);
    draft.pickDay(2026, 11, 24);
    const next = String(draft.toStored());
    expect(localStamp(next).endsWith(localStamp(stored).slice(10))).toBe(true);
    const d = new Date(next);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 11, 24]);
  });

  it('a date cell stores the day alone', () => {
    const draft = DateDraft.fromStored('date', null, NOW);
    draft.pickDay(2026, 9, 21);
    expect(draft.toStored()).toBe('2026-10-21');
  });

  it('picking the day the value already has produces the same instant', () => {
    const stored = '2026-10-16T09:30:00.000Z';
    const draft = DateDraft.fromStored('date_time', stored, NOW);
    const local = new Date(stored);
    draft.pickDay(local.getFullYear(), local.getMonth(), local.getDate());
    expect(equivalentStored('date_time', draft.toStored(), stored)).toBe(true);
  });
});

describe('COD-75 — typing a time means whole minutes', () => {
  it('setTime clears seconds and milliseconds', () => {
    const draft = DateDraft.fromStored('date_time', '2026-10-16T09:30:45.123Z', NOW);
    draft.setTime(18, 45);
    const d = new Date(String(draft.toStored()));
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([18, 45, 0, 0]);
  });

  it('retyping the same clock keeps the seconds the value already had', () => {
    const stored = '2026-10-16T09:30:45.000Z';
    const draft = DateDraft.fromStored('date_time', stored, NOW);
    const d = new Date(stored);
    const typed = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    expect(draft.setText(typed)).toEqual({ ok: true });
    expect(new Date(String(draft.toStored())).getSeconds()).toBe(45);
  });

  it('typing a different clock drops the seconds', () => {
    const draft = DateDraft.fromStored('date_time', '2026-10-16T09:30:45.000Z', NOW);
    const d = new Date('2026-10-16T09:30:45.000Z');
    const typed = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:45`;
    expect(draft.setText(typed)).toEqual({ ok: true });
    const stored = new Date(String(draft.toStored()));
    expect([stored.getHours(), stored.getMinutes(), stored.getSeconds()]).toEqual([18, 45, 0]);
  });

  it('a typed string that spells out seconds keeps them', () => {
    const draft = DateDraft.fromStored('date_time', '2026-10-16T09:30:45.000Z', NOW);
    draft.setText('2026-10-20T11:15:30');
    const stored = new Date(String(draft.toStored()));
    expect([stored.getSeconds(), stored.getMilliseconds()]).toEqual([30, 0]);
  });

  it('Now zeroes seconds and milliseconds', () => {
    const draft = DateDraft.fromStored('date_time', null, () => new Date(2026, 9, 17, 14, 30, 7, 512));
    draft.setNow();
    expect(draft.text).toBe('2026-10-17T14:30');
    const stored = new Date(String(draft.toStored()));
    expect([stored.getSeconds(), stored.getMilliseconds()]).toEqual([0, 0]);
  });

  it('Today moves the day and keeps the clock', () => {
    const draft = DateDraft.fromStored('date_time', '2026-10-16T09:30:45.000Z', NOW);
    draft.setToday();
    expect(draft.text.startsWith('2026-10-17T')).toBe(true);
    expect(new Date(String(draft.toStored())).getSeconds()).toBe(45);
  });

  it('setting a time on an empty cell gives it today', () => {
    const draft = DateDraft.fromStored('date_time', null, NOW);
    draft.setTime(8, 5);
    expect(draft.text).toBe('2026-10-17T08:05');
  });
});

describe('COD-75 — the text field', () => {
  it('accepts the stored shapes and reports the local clock', () => {
    const draft = DateDraft.fromStored('date', '2026-10-16', NOW);
    expect(draft.setText('2026-12-24')).toEqual({ ok: true });
    expect(draft.text).toBe('2026-12-24');
    expect(draft.toStored()).toBe('2026-12-24');
  });

  it('accepts a pasted date and time', () => {
    const draft = DateDraft.fromStored('date_time', null, NOW);
    expect(draft.setText('2026-12-24T18:45')).toEqual({ ok: true });
    const stored = new Date(String(draft.toStored()));
    expect([stored.getFullYear(), stored.getMonth(), stored.getDate(), stored.getHours(), stored.getMinutes()]).toEqual([
      2026, 11, 24, 18, 45,
    ]);
  });

  it('refuses what the field type refuses, and changes nothing', () => {
    const draft = DateDraft.fromStored('date', '2026-10-16', NOW);
    const result = draft.setText('sometime next week');
    expect(result.ok).toBe(false);
    expect(draft.text).toBe('2026-10-16');
    expect(draft.toStored()).toBe('2026-10-16');
  });

  it('empties the cell when the field is cleared', () => {
    const draft = DateDraft.fromStored('date_time', '2026-10-16T09:30:00.000Z', NOW);
    expect(draft.setText('   ')).toEqual({ ok: true });
    expect(draft.toStored()).toBeNull();
    expect(draft.hasDate).toBe(false);
  });
});

describe('COD-75 — clearing and equivalence', () => {
  it('Clear empties the cell', () => {
    const draft = DateDraft.fromStored('date', '2026-10-16', NOW);
    draft.clear();
    expect(draft.toStored()).toBeNull();
  });

  it('treats null, undefined and "" as the same empty value', () => {
    expect(equivalentStored('date', null, undefined)).toBe(true);
    expect(equivalentStored('date', null, '')).toBe(true);
    expect(equivalentStored('date', '2026-10-16', null)).toBe(false);
  });

  it('compares timestamps as instants, not as strings', () => {
    expect(equivalentStored('date_time', '2026-10-16T09:30:00Z', '2026-10-16T09:30:00.000Z')).toBe(true);
    expect(equivalentStored('date_time', '2026-10-16T09:30:00.000Z', '2026-10-16T09:31:00.000Z')).toBe(false);
  });

  it('compares dates as text', () => {
    expect(equivalentStored('date', '2026-10-16', '2026-10-16')).toBe(true);
    expect(equivalentStored('date', '2026-10-16', '2026-10-17')).toBe(false);
  });
});
