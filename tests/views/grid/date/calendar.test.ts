/**
 * COD-75 — month arithmetic behind the date panel.
 *
 * These are the calculations that silently go wrong (leap years, December → January, a week
 * starting on Sunday), so they are pinned here rather than discovered in the panel.
 */
import { describe, it, expect } from 'vitest';
import {
  addDays,
  addMonths,
  dayLabel,
  daysInMonth,
  formatYmd,
  gridFor,
  leadingDays,
  localeWeekStart,
  monthLabel,
  parseYmd,
  sameDay,
  weekdayLabels,
} from '../../../../src/views/grid/date/calendar.js';

describe('COD-75 — month arithmetic', () => {
  it('knows how long a month is, leap years included', () => {
    expect(daysInMonth(2026, 9)).toBe(31); // October
    expect(daysInMonth(2026, 1)).toBe(28); // February 2026
    expect(daysInMonth(2028, 1)).toBe(29); // February 2028 — leap
    expect(daysInMonth(2100, 1)).toBe(28); // 2100 is not a leap year
  });

  it('rolls the year when stepping months', () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(addMonths(2026, 0, -13)).toEqual({ year: 2024, month: 11 });
    expect(addMonths(2026, 5, 18)).toEqual({ year: 2027, month: 11 });
  });

  it('rolls days across month and year boundaries', () => {
    expect(addDays({ year: 2026, month: 11, day: 31 }, 1)).toEqual({ year: 2027, month: 0, day: 1 });
    expect(addDays({ year: 2026, month: 0, day: 1 }, -1)).toEqual({ year: 2025, month: 11, day: 31 });
    expect(addDays({ year: 2028, month: 1, day: 28 }, 1)).toEqual({ year: 2028, month: 1, day: 29 });
  });

  it('draws October 2026 as five Monday-first weeks', () => {
    // 1 October 2026 is a Thursday, so a Monday-start grid opens on 28 September.
    expect(leadingDays(2026, 9, 1)).toBe(3);
    const weeks = gridFor(2026, 9, 1);
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(formatYmd(weeks[0][0])).toBe('2026-09-28');
    expect(formatYmd(weeks[4][6])).toBe('2026-11-01');
  });

  it('shifts the whole grid when the week starts on Sunday', () => {
    const weeks = gridFor(2026, 9, 0);
    expect(formatYmd(weeks[0][0])).toBe('2026-09-27'); // a Sunday
    expect(weeks[0][0].month).toBe(8);
    expect(weeks[0][0].day).toBe(27);
  });

  it('never pads a sixth row the month does not need', () => {
    // August 2026 starts on a Saturday and has 31 days: 5 leading + 31 = 36 → 6 rows.
    expect(gridFor(2026, 7, 1)).toHaveLength(6);
    // February 2027 starts on a Monday and has 28 days: exactly 4 rows.
    expect(gridFor(2027, 1, 1)).toHaveLength(4);
  });

  it('covers every day of the month exactly once', () => {
    for (const [year, month] of [
      [2026, 1],
      [2028, 1],
      [2026, 7],
      [2026, 11],
    ] as const) {
      const days = gridFor(year, month, 1).flat().filter((d) => d.month === month);
      expect(days, `${year}-${month}`).toHaveLength(daysInMonth(year, month));
      expect(days[0].day).toBe(1);
      expect(days[days.length - 1].day).toBe(daysInMonth(year, month));
      const unique = new Set(days.map((d) => d.day));
      expect(unique.size).toBe(days.length);
    }
  });

  it('formats and parses the stored date shape', () => {
    expect(formatYmd({ year: 2026, month: 9, day: 7 })).toBe('2026-10-07');
    expect(parseYmd('2026-10-07')).toEqual({ year: 2026, month: 9, day: 7 });
    expect(parseYmd(' 2026-10-07 ')).toEqual({ year: 2026, month: 9, day: 7 });
  });

  it('rejects impossible and foreign date strings', () => {
    expect(parseYmd('2026-02-30')).toBeNull();
    expect(parseYmd('2026-13-01')).toBeNull();
    expect(parseYmd('17/10/2026')).toBeNull();
    expect(parseYmd('2026-2-3')).toBeNull();
    expect(parseYmd('')).toBeNull();
  });

  it('labels the week the way the grid draws it', () => {
    expect(weekdayLabels(1)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
    expect(weekdayLabels(0)).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
  });

  it('gives every day a spoken label, not a bare number', () => {
    expect(dayLabel({ year: 2026, month: 9, day: 17 })).toBe('Saturday 17 October 2026');
    expect(monthLabel(9)).toBe('October');
    expect(monthLabel(0)).toBe('January');
    expect(monthLabel(12)).toBe('January');
  });

  it('recognises the same day', () => {
    expect(sameDay({ year: 2026, month: 9, day: 17 }, { year: 2026, month: 9, day: 17 })).toBe(true);
    expect(sameDay({ year: 2026, month: 9, day: 17 }, { year: 2026, month: 9, day: 18 })).toBe(false);
    expect(sameDay(null, { year: 2026, month: 9, day: 17 })).toBe(false);
  });

  it('defaults the week to Monday when the engine cannot say', () => {
    // en-GB starts on Monday in every ICU build, and is the documented fallback.
    expect(localeWeekStart('en-GB')).toBe(1);
    // en-US reports Sunday where `Intl.Locale.weekInfo` exists, Monday where it does not.
    expect([0, 1]).toContain(localeWeekStart('en-US'));
    // A malformed tag must not throw: the panel still opens, on Monday.
    expect(localeWeekStart('not a language tag!!')).toBe(1);
  });
});
