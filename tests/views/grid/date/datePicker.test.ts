/**
 * @vitest-environment jsdom
 *
 * COD-75 — the date & time panel itself: markup, keyboard, commit/cancel, accessibility.
 *
 * The panel replaces Chromium's own `<input type="date">` dialog. Everything here is about the
 * contract that dialog never gave us: a real DOM (so it can be themed and tested), Escape that
 * discards, a click outside that commits, Clear, Now, Today, and a calendar a keyboard can drive.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import axe from 'axe-core';
import { DatePicker, type DatePickerOptions } from '../../../../src/views/grid/date/DatePicker.js';
import type { CellValue, FieldDefinition } from '../../../../src/model/types.js';

/** Saturday 17 October 2026, 14:30 local — the panel's "today" and "now" in these tests. */
const NOW = () => new Date(2026, 9, 17, 14, 30, 0, 0);

const pad = (n: number): string => String(n).padStart(2, '0');

function field(type: 'date' | 'date_time'): FieldDefinition {
  return { id: 'fld_d', name: type === 'date' ? 'Due' : 'Review At', type } as FieldDefinition;
}

interface Harness {
  panel: DatePicker;
  card: HTMLElement;
  commits: CellValue[];
  cancels: ReturnType<typeof vi.fn>;
}

function mount(overrides: Partial<DatePickerOptions> = {}): Harness {
  const commits: CellValue[] = [];
  const cancels = vi.fn();
  const panel = new DatePicker({
    field: field('date_time'),
    value: '2026-10-16T09:30:00.000Z',
    weekStart: 1,
    now: NOW,
    onCommit: (v) => commits.push(v),
    onCancel: cancels,
    ...overrides,
  });
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  panel.open(anchor);
  return { panel, card: panel.element, commits, cancels };
}

const day = (card: HTMLElement, ymd: string): HTMLElement => {
  const el = card.querySelector(`[data-date="${ymd}"]`) as HTMLElement | null;
  if (!el) throw new Error(`no day ${ymd}`);
  return el;
};

const title = (card: HTMLElement): string => card.querySelector('.tablify__date-month')?.textContent ?? '';
const fieldInput = (card: HTMLElement): HTMLInputElement => card.querySelector('input.tablify__date-input') as HTMLInputElement;
const clock = (card: HTMLElement, which: 'Hours' | 'Minutes'): HTMLInputElement =>
  card.querySelector(`input[aria-label="${which}"]`) as HTMLInputElement;

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('COD-75 — the panel markup', () => {
  it('is a dialog anchored to the card', () => {
    const { card } = mount();
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-label')).toBe('Pick a date and time');
    expect(card.classList.contains('tablify__panel')).toBe(true);
    expect(card.dataset.testid).toBe('tablify-date-panel');
  });

  it('opens on the month of the value and names it', () => {
    const { card } = mount();
    expect(title(card)).toBe('October2026');
    expect(card.querySelectorAll('[role="columnheader"]')).toHaveLength(7);
    expect(Array.from(card.querySelectorAll('[role="columnheader"]')).map((h) => h.textContent)).toEqual([
      'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su',
    ]);
  });

  it('shows the value the cell shows', () => {
    const { card } = mount();
    const local = new Date('2026-10-16T09:30:00.000Z');
    expect(fieldInput(card).value).toBe(
      `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`,
    );
  });

  it('marks the stored day as selected', () => {
    const { card } = mount();
    const local = new Date('2026-10-16T09:30:00.000Z');
    const selected = card.querySelector('[aria-selected="true"]') as HTMLElement;
    expect(selected.dataset.date).toBe(
      `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`,
    );
    expect(selected.classList.contains('is-selected')).toBe(true);
  });

  it('rings today', () => {
    const { card } = mount({ value: null });
    expect(day(card, '2026-10-17').classList.contains('is-today')).toBe(true);
    expect(day(card, '2026-10-17').classList.contains('is-selected')).toBe(false);
  });

  it('draws only the weeks October 2026 needs, and still shows the neighbours', () => {
    const { card } = mount();
    expect(card.querySelectorAll('.tablify__date-day')).toHaveLength(35);
    expect(day(card, '2026-09-28').classList.contains('is-outside')).toBe(true);
    expect(day(card, '2026-11-01').classList.contains('is-outside')).toBe(true);
  });

  it('has no time row for a date field', () => {
    const { card } = mount({ field: field('date'), value: '2026-10-16' });
    expect(card.querySelector('.tablify__date-time')).toBeNull();
    expect(card.querySelector('input[aria-label="Hours"]')).toBeNull();
  });

  it('has a time row for a date_time field, ending in Now', () => {
    const { card } = mount();
    expect(card.querySelector('.tablify__date-time')).not.toBeNull();
    expect(clock(card, 'Hours').value).toBe(pad(new Date('2026-10-16T09:30:00.000Z').getHours()));
    expect(card.textContent).toContain('Now');
  });

  it('labels every day for a screen reader', () => {
    const { card } = mount();
    expect(day(card, '2026-10-17').getAttribute('aria-label')).toBe('Saturday 17 October 2026');
  });
});

describe('COD-75 — committing and dismissing', () => {
  it('a date field commits on the day it is given, and closes', () => {
    const { card, panel, commits } = mount({ field: field('date'), value: null });
    day(card, '2026-10-21').click();
    expect(commits).toEqual(['2026-10-21']);
    expect(panel.element.isConnected).toBe(false);
  });

  it('a date_time field keeps the panel open while a day is picked', () => {
    const { card, panel, commits } = mount();
    day(card, '2026-10-21').click();
    expect(commits).toEqual([]);
    expect(panel.element.isConnected).toBe(true);
    const stored = new Date('2026-10-16T09:30:00.000Z');
    expect(card.querySelector('[aria-selected="true"]')).toBe(day(card, '2026-10-21'));
    expect(clock(card, 'Hours').value).toBe(pad(stored.getHours()));
  });

  it('Done commits the draft', () => {
    const { card, commits, panel } = mount();
    day(card, '2026-10-21').click();
    (card.querySelector('.tablify__date-done') as HTMLElement).click();
    expect(commits).toHaveLength(1);
    const stored = new Date(String(commits[0]));
    expect([stored.getFullYear(), stored.getMonth(), stored.getDate()]).toEqual([2026, 9, 21]);
    expect(panel.element.isConnected).toBe(false);
  });

  it('Done without touching anything commits the value it was opened with', () => {
    const { card, commits } = mount();
    (card.querySelector('.tablify__date-done') as HTMLElement).click();
    expect(commits).toEqual(['2026-10-16T09:30:00.000Z']);
  });

  it('Escape cancels and writes nothing', () => {
    const { card, commits, cancels, panel } = mount();
    day(card, '2026-10-21').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(commits).toEqual([]);
    expect(cancels).toHaveBeenCalledTimes(1);
    expect(panel.element.isConnected).toBe(false);
  });

  it('a press outside commits, like clicking away from a cell editor', () => {
    const { card, commits } = mount();
    day(card, '2026-10-21').click();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(commits).toHaveLength(1);
  });

  it('a press inside does not dismiss', () => {
    const { card, commits } = mount();
    card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(commits).toEqual([]);
  });

  it('Clear empties the cell', () => {
    const { card, commits, panel } = mount();
    (card.querySelector('.tablify__date-quiet--danger') as HTMLElement).click();
    expect(commits).toEqual([null]);
    expect(panel.element.isConnected).toBe(false);
  });

  it('Enter in the value field commits', () => {
    const { card, commits } = mount();
    fieldInput(card).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(commits).toHaveLength(1);
  });
});

describe('COD-75 — the clock and the shortcuts', () => {
  it('Now takes the current minute and drops the seconds', () => {
    const { card, commits } = mount({ value: null, now: () => new Date(2026, 9, 17, 16, 42, 9, 500) });
    (card.querySelector('.tablify__date-now') as HTMLElement).click();
    expect(fieldInput(card).value).toBe('2026-10-17T16:42');
    expect(commits).toEqual([]);
    (card.querySelector('.tablify__date-done') as HTMLElement).click();
    const stored = new Date(String(commits[0]));
    expect([stored.getHours(), stored.getMinutes(), stored.getSeconds(), stored.getMilliseconds()]).toEqual([16, 42, 0, 0]);
  });

  it('Today moves the selection to today without committing', () => {
    const { card, commits } = mount();
    (card.querySelector('.tablify__date-quiet') as HTMLElement).click();
    expect(card.querySelector('[aria-selected="true"]')).toBe(day(card, '2026-10-17'));
    expect(commits).toEqual([]);
  });

  it('Today commits straight away in a date field', () => {
    const { commits } = mount({ field: field('date'), value: '2026-10-16' });
    (document.querySelector('.tablify__date-quiet') as HTMLElement).click();
    expect(commits).toEqual(['2026-10-17']);
  });

  it('the arrows step the month', () => {
    const { card } = mount();
    (card.querySelector('[aria-label="Next month"]') as HTMLElement).click();
    expect(title(card)).toBe('November2026');
    (card.querySelector('[aria-label="Previous month"]') as HTMLElement).click();
    (card.querySelector('[aria-label="Previous month"]') as HTMLElement).click();
    expect(title(card)).toBe('September2026');
  });

  it('picking a neighbouring month jumps the view to it', () => {
    const { card, commits } = mount();
    // The last cell of October's grid is 1 November; picking it opens November.
    day(card, '2026-11-01').click();
    expect(title(card)).toBe('November2026');
    expect(card.querySelector('[aria-selected="true"]')).toBe(day(card, '2026-11-01'));
    expect(commits).toEqual([]);
  });

  it('the hour input wraps at the top and the minute at the bottom', () => {
    const { card, commits } = mount();
    const hours = clock(card, 'Hours');
    hours.value = '23';
    hours.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(hours.value).toBe('00');
    const minutes = clock(card, 'Minutes');
    minutes.value = '00';
    minutes.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(minutes.value).toBe('59');
    (card.querySelector('.tablify__date-done') as HTMLElement).click();
    expect(commits).toHaveLength(1);
  });

  it('typing a time keeps it when the field is left', () => {
    const { card } = mount();
    const hours = clock(card, 'Hours');
    hours.value = '7';
    hours.dispatchEvent(new Event('input', { bubbles: true }));
    hours.dispatchEvent(new Event('change', { bubbles: true }));
    expect(hours.value).toBe('07');
    expect(fieldInput(card).value.endsWith('T07:30')).toBe(true);
  });
});

describe('COD-75 — the keyboard calendar', () => {
  const press = (el: HTMLElement, key: string, shiftKey = false): void => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
  };

  it('moves the focused day with the arrow keys', () => {
    const { card } = mount();
    const start = day(card, '2026-10-16');
    start.focus();
    press(start, 'ArrowRight');
    expect(document.activeElement).toBe(day(card, '2026-10-17'));
    press(document.activeElement as HTMLElement, 'ArrowDown');
    expect(document.activeElement).toBe(day(card, '2026-10-24'));
  });

  it('crosses month boundaries and re-renders the month', () => {
    const { card } = mount();
    const start = day(card, '2026-10-31');
    start.focus();
    press(start, 'ArrowRight');
    expect(title(card)).toBe('November2026');
    expect(document.activeElement).toBe(day(card, '2026-11-01'));
  });

  it('PageUp / PageDown change the month, Shift the year', () => {
    const { card } = mount();
    const start = day(card, '2026-10-16');
    start.focus();
    press(start, 'PageDown');
    expect(title(card)).toBe('November2026');
    press(document.activeElement as HTMLElement, 'PageUp', true);
    expect(title(card)).toBe('November2025');
  });

  it('Home and End jump to the ends of the week', () => {
    const { card } = mount();
    day(card, '2026-10-16').focus(); // a Friday
    press(day(card, '2026-10-16'), 'Home');
    expect(document.activeElement).toBe(day(card, '2026-10-12'));
    press(document.activeElement as HTMLElement, 'End');
    expect(document.activeElement).toBe(day(card, '2026-10-18'));
  });

  it('Enter picks the focused day', () => {
    const { card, commits } = mount({ field: field('date'), value: null });
    const target = day(card, '2026-10-22');
    target.focus();
    press(target, 'Enter');
    expect(commits).toEqual(['2026-10-22']);
  });
});

describe('COD-75 — the value field refuses bad text', () => {
  it('flags an unparseable value and refuses to commit it', () => {
    const { card, commits } = mount();
    const input = fieldInput(card);
    input.value = 'sometime next week';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const error = card.querySelector('.tablify__date-error') as HTMLElement;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('2026-10-17');
    (card.querySelector('.tablify__date-done') as HTMLElement).click();
    expect(commits).toEqual([]);
  });

  it('a valid entry moves the calendar and clears the message', () => {
    const { card } = mount();
    const input = fieldInput(card);
    input.value = '2026-12-24T18:45';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect((card.querySelector('.tablify__date-error') as HTMLElement).hidden).toBe(true);
    expect(title(card)).toBe('December2026');
    expect(card.querySelector('[aria-selected="true"]')).toBe(day(card, '2026-12-24'));
    expect(clock(card, 'Hours').value).toBe('18');
  });

  it('focus starts in the value field, selected', () => {
    const { card } = mount();
    expect(document.activeElement).toBe(fieldInput(card));
  });
});

describe('COD-75 — accessibility', () => {
  it('has no critical or serious axe violations', async () => {
    const { card } = mount();
    const results = await axe.run(card, {
      rules: {
        region: { enabled: false },
        'landmark-one-main': { enabled: false },
        'page-has-heading-one': { enabled: false },
        bypass: { enabled: false },
        'html-has-lang': { enabled: false },
        // jsdom has no layout; the panel's pairs are measured in tests/ui/contrast.test.ts.
        'color-contrast': { enabled: false },
      },
    } as unknown as Parameters<typeof axe.run>[1]);
    const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(blocking, JSON.stringify(blocking.map((v) => ({ id: v.id, help: v.help })))).toEqual([]);
  });
});
