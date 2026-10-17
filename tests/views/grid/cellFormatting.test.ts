/**
 * @vitest-environment jsdom
 *
 * COD-71 — a cell shows what the value means, not what is stored.
 *
 * Six types store a form that is not their display text: single / multi select (option ids),
 * currency (minor units), percent (0…1), duration (ms) and checkbox (`true` / `false`). The grid
 * used to print the stored value; these tests pin the new contract and, just as importantly, pin
 * that every other type renders exactly as it did.
 */
import { describe, it, expect, vi } from 'vitest';
import { GridView, type GridOptions } from '../../../src/views/grid/GridView.js';
import { createDefaultView } from '../../../src/model/view.js';
import { buildTable } from '../../../src/io/import/build.js';
import { parse } from '../../../src/format/parse.js';
import type { FieldDefinition, Row } from '../../../src/model/types.js';

const NOW = '2026-10-17T00:00:00.000Z';

const OPTIONS = [
  { id: 'opt_a', name: 'Alpha', color: 'blue' },
  { id: 'opt_b', name: 'Beta', color: 'green' },
];

const FIELDS: FieldDefinition[] = [
  { id: 'f_text', name: 'Text', type: 'text', primary: true },
  { id: 'f_num', name: 'Number', type: 'number' },
  { id: 'f_cur', name: 'Currency', type: 'currency' },
  { id: 'f_pct', name: 'Percent', type: 'percent' },
  { id: 'f_dur', name: 'Duration', type: 'duration' },
  { id: 'f_rating', name: 'Rating', type: 'rating' },
  { id: 'f_check', name: 'Checkbox', type: 'checkbox' },
  { id: 'f_date', name: 'Date', type: 'date' },
  { id: 'f_dt', name: 'DateTime', type: 'date_time' },
  { id: 'f_url', name: 'Url', type: 'url' },
  { id: 'f_single', name: 'Single', type: 'single_select', options: OPTIONS },
  { id: 'f_multi', name: 'Multi', type: 'multi_select', options: OPTIONS },
  // COD-73
  { id: 'f_long', name: 'Long', type: 'long_text' },
  { id: 'f_email', name: 'Email', type: 'email' },
  { id: 'f_phone', name: 'Phone', type: 'phone' },
  { id: 'f_attach', name: 'Attach', type: 'attachment' },
  { id: 'f_created', name: 'Created', type: 'created_time' },
];

const VALUES: Record<string, unknown> = {
  f_text: 'Hello world',
  f_num: 1234567,
  f_cur: 123456,
  f_pct: 0.25,
  f_dur: 90000,
  f_rating: 4,
  f_check: true,
  f_date: '2026-10-17',
  f_dt: '2026-10-17T14:30:00.000Z',
  f_url: 'https://example.com/page',
  f_single: 'opt_a',
  f_multi: ['opt_a', 'opt_b'],
  // COD-73
  f_long: 'one line\ntwo lines',
  f_email: 'a@b.com',
  f_phone: '+15551234567',
  f_attach: ['Files/brief.pdf', 'Files/data.csv'],
  f_created: '2026-10-17T14:30:00.000Z',
};

const COL = Object.fromEntries(FIELDS.map((f, i) => [f.id, i])) as Record<string, number>;

function row(values: Record<string, unknown> = VALUES, id = 'row_0'): Row {
  return { id, rev: 1, createdAt: NOW, updatedAt: NOW, values: values as Row['values'], sync: null };
}

function mount(extra: Partial<GridOptions> = {}, rows: Row[] = [row()], fields: FieldDefinition[] = FIELDS): GridView {
  const grid = new GridView({
    rows,
    fields,
    view: createDefaultView(fields),
    theme: 'light',
    viewportHeight: 600,
    viewportWidth: 1200,
    ...extra,
  });
  document.body.appendChild(grid.root);
  return grid;
}

/** The rendered cell for a field on row 0 (the grid's own `.tablify__cell`, not the capsule). */
function cellOf(grid: GridView, fieldId: string): HTMLElement {
  const cell = grid.root.querySelector<HTMLElement>(
    `.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="${COL[fieldId]}"]`,
  );
  if (!cell) throw new Error(`no cell for ${fieldId}`);
  return cell;
}

const textOf = (grid: GridView, fieldId: string): string | null | undefined =>
  cellOf(grid, fieldId).querySelector('.tablify__cell-text')?.textContent;

describe('COD-71 — select cells render the option, not its id', () => {
  it('single select: one chip carrying the option name', () => {
    const grid = mount();
    const text = cellOf(grid, 'f_single').querySelector('.tablify__cell-text') as HTMLElement;
    const chips = text.querySelectorAll('.tablify__chip');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toBe('Alpha');
    expect(text.textContent).toBe('Alpha');
    grid.destroy();
  });

  it('single select: chip takes the option colour, with its dot', () => {
    const grid = mount();
    const chip = cellOf(grid, 'f_single').querySelector<HTMLElement>('.tablify__chip');
    expect(chip).toBeTruthy();
    // The palette comes from tokens.ts (never a literal here); assert it is painted, and that the
    // dot exists and is painted separately.
    expect(chip?.style.background).not.toBe('');
    expect(chip?.style.borderColor).not.toBe('');
    expect(chip?.style.color).not.toBe('');
    const dot = chip?.querySelector<HTMLElement>('.tablify__chip-dot');
    expect(dot).toBeTruthy();
    expect(dot?.style.background).not.toBe('');
    grid.destroy();
  });

  it('single select: the ink differs between light and dark, so the theme is really read', () => {
    const light = mount();
    const lightInk = cellOf(light, 'f_single').querySelector<HTMLElement>('.tablify__chip')?.style.color;
    light.destroy();
    document.body.innerHTML = '';
    const dark = mount({ theme: 'dark' });
    const darkInk = cellOf(dark, 'f_single').querySelector<HTMLElement>('.tablify__chip')?.style.color;
    expect(darkInk).toBeTruthy();
    expect(darkInk).not.toBe(lightInk);
    dark.destroy();
    document.body.innerHTML = '';
  });

  it('single select: no option id leaks into the cell', () => {
    const grid = mount();
    expect(cellOf(grid, 'f_single').textContent).not.toContain('opt_');
    grid.destroy();
  });

  it('multi select: one chip per id in stored order, no dot, spaced like the prototype', () => {
    const grid = mount();
    const text = cellOf(grid, 'f_multi').querySelector('.tablify__cell-text') as HTMLElement;
    const chips = Array.from(text.querySelectorAll<HTMLElement>('.tablify__chip'));
    expect(chips.map((c) => c.textContent)).toEqual(['Alpha', 'Beta']);
    expect(chips.every((c) => c.classList.contains('tablify__chip--multi'))).toBe(true);
    expect(text.querySelector('.tablify__chip-dot')).toBeNull();
    // The gap is a real space, so copy and screen readers read words, not "AlphaBeta".
    expect(text.textContent).toBe('Alpha Beta');
    expect(text.textContent).not.toContain('opt_');
    grid.destroy();
  });

  it('empty select cells render nothing, so the em dash is unchanged', () => {
    const grid = mount({}, [row({ ...VALUES, f_single: null, f_multi: [] })]);
    expect(textOf(grid, 'f_single')).toBe('');
    expect(textOf(grid, 'f_multi')).toBe('');
    expect(cellOf(grid, 'f_single').querySelector('.tablify__chip')).toBeNull();
    grid.destroy();
  });

  it('an id with no matching option renders nothing and never prints the id', () => {
    const grid = mount({}, [row({ ...VALUES, f_single: 'opt_deleted', f_multi: ['opt_deleted', 'opt_a'] })]);
    expect(textOf(grid, 'f_single')).toBe('');
    // The multi cell keeps the option it can resolve, and drops only the unknown one.
    expect(textOf(grid, 'f_multi')).toBe('Alpha');
    grid.destroy();
  });

  it('a value of the wrong shape (corrupt file) renders nothing instead of guessing', () => {
    const grid = mount({}, [row({ ...VALUES, f_single: ['opt_a'], f_multi: 'opt_a' })]);
    expect(textOf(grid, 'f_single')).toBe('');
    expect(textOf(grid, 'f_multi')).toBe('');
    grid.destroy();
  });
});

describe('COD-71 — unit-storing types show their unit', () => {
  it('currency renders major units and keeps the stored minor units', () => {
    const grid = mount();
    expect(textOf(grid, 'f_cur')).toBe('1234.56');
    expect(grid.rows[0].values.f_cur).toBe(123456);
    grid.destroy();
  });

  it('percent renders the percentage and keeps the stored fraction', () => {
    const grid = mount();
    expect(textOf(grid, 'f_pct')).toBe('25%');
    expect(grid.rows[0].values.f_pct).toBe(0.25);
    grid.destroy();
  });

  it('duration renders hours/minutes/seconds and keeps the stored milliseconds', () => {
    const grid = mount();
    expect(textOf(grid, 'f_dur')).toBe('1m 30s');
    expect(grid.rows[0].values.f_dur).toBe(90000);
    grid.destroy();
  });

  it('an empty unit cell is empty, not "0"', () => {
    const grid = mount({}, [row({ ...VALUES, f_cur: null, f_pct: null, f_dur: null })]);
    expect(textOf(grid, 'f_cur')).toBe('');
    expect(textOf(grid, 'f_pct')).toBe('');
    expect(textOf(grid, 'f_dur')).toBe('');
    grid.destroy();
  });
});

describe('COD-71 — a checkbox cell is a clickable box', () => {
  it('true is a ticked box, false and null are an empty box', () => {
    const grid = mount({ onToggleCheckbox: vi.fn() }, [
      row({ ...VALUES, f_check: true }, 'row_0'),
      row({ ...VALUES, f_check: false }, 'row_1'),
      row({ ...VALUES, f_check: null }, 'row_2'),
    ]);
    const at = (i: number) =>
      grid.root.querySelector<HTMLElement>(
        `.tablify__row[data-row-index="${i}"] .tablify__cell[data-col-index="${COL.f_check}"] .tablify__check`,
      );
    expect(at(0)?.getAttribute('aria-checked')).toBe('true');
    expect(at(0)?.classList.contains('tablify__check--on')).toBe(true);
    expect(at(1)?.getAttribute('aria-checked')).toBe('false');
    expect(at(1)?.classList.contains('tablify__check--on')).toBe(false);
    expect(at(2)?.getAttribute('aria-checked')).toBe('false');
    // The word "true" is gone from the cell.
    expect(textOf(grid, 'f_check')).toBe('');
    grid.destroy();
  });

  it('clicking the box reports the cell and leaves the selection alone', () => {
    const onToggleCheckbox = vi.fn();
    const grid = mount({ onToggleCheckbox });
    const button = cellOf(grid, 'f_check').querySelector<HTMLElement>('.tablify__check');
    expect(button?.tagName).toBe('BUTTON');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    button?.dispatchEvent(event);
    expect(onToggleCheckbox).toHaveBeenCalledTimes(1);
    expect(onToggleCheckbox).toHaveBeenCalledWith(0, COL.f_check);
    // The click was consumed by the box: the cell was not selected (so no editor can open).
    expect(grid.getSelection()).toBeNull();
    expect(event.defaultPrevented).toBe(true);
    grid.destroy();
  });

  it('a double click on the box never reaches the grid’s edit gesture', () => {
    const onToggleCheckbox = vi.fn();
    const onCellActivate = vi.fn();
    const grid = mount({ onToggleCheckbox, onCellActivate });
    const button = cellOf(grid, 'f_check').querySelector<HTMLElement>('.tablify__check');
    button?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    expect(onCellActivate).not.toHaveBeenCalled();
    grid.destroy();
  });

  it('without a handler the box is a read-only image, never a dead button', () => {
    const grid = mount();
    const box = cellOf(grid, 'f_check').querySelector<HTMLElement>('.tablify__check');
    expect(box?.tagName).toBe('SPAN');
    expect(box?.getAttribute('role')).toBe('img');
    expect(box?.getAttribute('aria-label')).toBe('Checkbox: checked');
    grid.destroy();
  });
});

describe('COD-71 — text and date render exactly as before', () => {
  // COD-73 then took number, rating, url, email, phone, attachment and the timestamps: their
  // stored text was only ever a placeholder. Text and date keep it (a date is already what a
  // person wrote), and the rest of this file pins the new contract.
  it('text and date keep their stored text', () => {
    const grid = mount();
    expect(textOf(grid, 'f_text')).toBe('Hello world');
    expect(textOf(grid, 'f_date')).toBe('2026-10-17');
    expect(cellOf(grid, 'f_date').textContent).not.toContain('T00:00');
    grid.destroy();
  });

  it('cell ARIA and the value host are untouched', () => {
    const grid = mount();
    const cell = cellOf(grid, 'f_single');
    expect(cell.getAttribute('role')).toBe('gridcell');
    expect(cell.getAttribute('aria-colindex')).toBe(String(COL.f_single + 1));
    expect(cell.querySelector('.tablify__capsule > .tablify__cell-text')).toBeTruthy();
    grid.destroy();
  });
});

describe('COD-71 — an imported CSV renders its own values', () => {
  it('chips read the distinct values from the file, none of them a preset', () => {
    const csv = [
      'Task,Status',
      'One,Alpha',
      'Two,Beta',
      'Three,Gamma',
      'Four,Alpha',
      'Five,Beta',
      'Six,Gamma',
    ];
    const rows = csv.map((line) => line.split(','));
    const built = buildTable({ tableName: 'Imported', rows, now: () => NOW });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const parsed = parse(built.content);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const fields = parsed.data.fields;
    const status = fields.find((f) => f.name === 'Status');
    expect(status?.type).toBe('single_select');
    expect(status?.options?.map((o) => o.name)).toEqual(['Alpha', 'Beta', 'Gamma']);

    const grid = mount({}, parsed.data.rows, fields);
    const chips = Array.from(
      grid.root.querySelectorAll<HTMLElement>(
        `.tablify__row .tablify__cell[data-col-index="${fields.indexOf(status as FieldDefinition)}"] .tablify__chip`,
      ),
    );
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.map((c) => c.textContent)).toEqual(['Alpha', 'Beta', 'Gamma', 'Alpha', 'Beta', 'Gamma']);
    expect(chips.every((c) => !c.textContent?.startsWith('opt_'))).toBe(true);
    grid.destroy();
  });
});

// ---- COD-73 ------------------------------------------------------------------

/** The local wall clock a stored instant should read as, computed without pinning a zone. */
function localStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

describe('COD-73 — a rating cell is stars plus the scale', () => {
  it('draws one star per point of the scale, filled up to the value, then `4/5`', () => {
    const grid = mount();
    const stars = cellOf(grid, 'f_rating').querySelectorAll('.tablify__star');
    expect(stars).toHaveLength(5);
    expect(cellOf(grid, 'f_rating').querySelectorAll('.tablify__star--on')).toHaveLength(4);
    expect(textOf(grid, 'f_rating')).toBe('4/5');
    // The stars are decoration; the label is the text.
    expect(cellOf(grid, 'f_rating').querySelector('.tablify__stars')?.getAttribute('aria-hidden')).toBe('true');
    grid.destroy();
  });

  it('an empty rating still draws the scale, but no `0/5` label', () => {
    const grid = mount({}, [row({ ...VALUES, f_rating: null })]);
    expect(cellOf(grid, 'f_rating').querySelectorAll('.tablify__star')).toHaveLength(5);
    expect(cellOf(grid, 'f_rating').querySelectorAll('.tablify__star--on')).toHaveLength(0);
    expect(textOf(grid, 'f_rating')).toBe('');
    grid.destroy();
  });

  it('the scale follows the field’s Max, like the group headings', () => {
    const fields = FIELDS.map((f) => (f.id === 'f_rating' ? { ...f, max: 10 } : f));
    const grid = mount({}, [row({ ...VALUES, f_rating: 7 })], fields);
    expect(cellOf(grid, 'f_rating').querySelectorAll('.tablify__star')).toHaveLength(10);
    expect(cellOf(grid, 'f_rating').querySelectorAll('.tablify__star--on')).toHaveLength(7);
    expect(textOf(grid, 'f_rating')).toBe('7/10');
    grid.destroy();
  });

  it('a value above the scale fills the scale, never more stars', () => {
    const grid = mount({}, [row({ ...VALUES, f_rating: 9 })]);
    expect(cellOf(grid, 'f_rating').querySelectorAll('.tablify__star--on')).toHaveLength(5);
    grid.destroy();
  });

  it('no longer prints the bare number', () => {
    const grid = mount();
    expect(textOf(grid, 'f_rating')).not.toBe('4');
    grid.destroy();
  });
});

describe('COD-73 — timestamps read as the local wall clock', () => {
  it('date_time renders local `YYYY-MM-DDTHH:mm`, and keeps the stored ISO instant', () => {
    const grid = mount();
    expect(textOf(grid, 'f_dt')).toBe(localStamp(String(VALUES.f_dt)));
    expect(grid.rows[0].values.f_dt).toBe(VALUES.f_dt);
    grid.destroy();
  });

  it('created_time renders the same way', () => {
    const grid = mount();
    expect(textOf(grid, 'f_created')).toBe(localStamp('2026-10-17T14:30:00.000Z'));
    grid.destroy();
  });

  it('a value that is not an instant is shown as stored, never "Invalid Date"', () => {
    const grid = mount({}, [row({ ...VALUES, f_dt: 'yesterday-ish' })]);
    expect(textOf(grid, 'f_dt')).toBe('yesterday-ish');
    grid.destroy();
  });

  it('an empty timestamp is empty, so the em dash shows', () => {
    const grid = mount({}, [row({ ...VALUES, f_dt: null, f_created: null })]);
    expect(textOf(grid, 'f_dt')).toBe('');
    expect(textOf(grid, 'f_created')).toBe('');
    grid.destroy();
  });
});

describe('COD-73 — a number cell groups its digits and sits right', () => {
  it('groups thousands for the reader and keeps the stored number', () => {
    const grid = mount();
    expect(textOf(grid, 'f_num')).toBe('1,234,567');
    expect(grid.rows[0].values.f_num).toBe(1234567);
    grid.destroy();
  });

  it('keeps decimals and the sign', () => {
    const grid = mount({}, [row({ ...VALUES, f_num: -1234.5 })]);
    expect(textOf(grid, 'f_num')).toBe('-1,234.5');
    grid.destroy();
  });

  it('small numbers are unchanged, and an empty cell stays empty', () => {
    const grid = mount({}, [row({ ...VALUES, f_num: 42 })]);
    expect(textOf(grid, 'f_num')).toBe('42');
    grid.destroy();
    document.body.innerHTML = '';
    const empty = mount({}, [row({ ...VALUES, f_num: null })]);
    expect(textOf(empty, 'f_num')).toBe('');
    empty.destroy();
  });

  it('a corrupt value is shown as stored instead of NaN', () => {
    const grid = mount({}, [row({ ...VALUES, f_num: 'twelve' })]);
    expect(textOf(grid, 'f_num')).toBe('twelve');
    grid.destroy();
  });

  it('numeric columns carry the alignment class; text-like columns do not', () => {
    const grid = mount();
    for (const id of ['f_num', 'f_cur', 'f_pct', 'f_dur']) {
      expect(cellOf(grid, id).classList.contains('tablify__cell--numeric'), id).toBe(true);
    }
    for (const id of ['f_text', 'f_dt', 'f_rating', 'f_single', 'f_long']) {
      expect(cellOf(grid, id).classList.contains('tablify__cell--numeric'), id).toBe(false);
    }
    grid.destroy();
  });
});

describe('COD-73 — url, email and phone cells are real links', () => {
  it('url points at the address itself', () => {
    const grid = mount();
    const link = cellOf(grid, 'f_url').querySelector<HTMLAnchorElement>('a.tablify__cell-link');
    expect(link?.getAttribute('href')).toBe('https://example.com/page');
    expect(link?.textContent).toBe('https://example.com/page');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noopener');
    grid.destroy();
  });

  it('email is a mailto: link and phone a tel: link', () => {
    const grid = mount();
    expect(cellOf(grid, 'f_email').querySelector('a')?.getAttribute('href')).toBe('mailto:a@b.com');
    expect(cellOf(grid, 'f_phone').querySelector('a')?.getAttribute('href')).toBe('tel:+15551234567');
    grid.destroy();
  });

  it('a value that is not a usable address stays plain text, with no link', () => {
    const grid = mount({}, [row({ ...VALUES, f_url: 'not-a-url', f_email: 'nope', f_phone: '12' })]);
    expect(cellOf(grid, 'f_url').querySelector('a')).toBeNull();
    expect(textOf(grid, 'f_url')).toBe('not-a-url');
    expect(cellOf(grid, 'f_email').querySelector('a')).toBeNull();
    expect(cellOf(grid, 'f_phone').querySelector('a')).toBeNull();
    grid.destroy();
  });

  it('the link owns its click: following it does not select the cell', () => {
    const grid = mount();
    const link = cellOf(grid, 'f_url').querySelector<HTMLAnchorElement>('a.tablify__cell-link');
    // Keep jsdom from attempting a navigation; the anchor's own stopPropagation still runs.
    window.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(grid.getSelection()).toBeNull();
    grid.destroy();
  });

  it('an empty address is an empty cell', () => {
    const grid = mount({}, [row({ ...VALUES, f_url: null, f_email: null, f_phone: null })]);
    expect(textOf(grid, 'f_url')).toBe('');
    expect(cellOf(grid, 'f_url').querySelector('a')).toBeNull();
    grid.destroy();
  });
});

describe('COD-73 — an attachment cell is one paperclip chip per file', () => {
  it('a list value draws a chip per path, in order', () => {
    const grid = mount();
    const chips = Array.from(cellOf(grid, 'f_attach').querySelectorAll('.tablify__chip--file'));
    expect(chips.map((c) => c.textContent)).toEqual(['Files/brief.pdf', 'Files/data.csv']);
    expect(chips[0].querySelector('.tablify__chip-icon')).toBeTruthy();
    expect(textOf(grid, 'f_attach')).toBe('Files/brief.pdf Files/data.csv');
    grid.destroy();
  });

  it('the single path a cell stores today is one chip', () => {
    const grid = mount({}, [row({ ...VALUES, f_attach: 'Files/brief.pdf' })]);
    const chips = cellOf(grid, 'f_attach').querySelectorAll('.tablify__chip--file');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toBe('Files/brief.pdf');
    grid.destroy();
  });

  it('an empty attachment cell draws nothing', () => {
    const grid = mount({}, [row({ ...VALUES, f_attach: null })]);
    expect(textOf(grid, 'f_attach')).toBe('');
    expect(cellOf(grid, 'f_attach').querySelector('.tablify__chip')).toBeNull();
    grid.destroy();
  });

  it('a corrupt value of the wrong shape still does not throw', () => {
    const grid = mount({}, [row({ ...VALUES, f_attach: 42 })]);
    expect(textOf(grid, 'f_attach')).toBe('');
    grid.destroy();
  });
});

describe('COD-73 — long text clamps to two lines', () => {
  it('the cell carries the clamp class, and plain text does not', () => {
    const grid = mount();
    expect(cellOf(grid, 'f_long').classList.contains('tablify__cell--long-text')).toBe(true);
    expect(cellOf(grid, 'f_text').classList.contains('tablify__cell--long-text')).toBe(false);
    grid.destroy();
  });

  it('line breaks are kept as text, not turned into markup', () => {
    const grid = mount();
    const text = cellOf(grid, 'f_long').querySelector('.tablify__cell-text');
    expect(text?.querySelector('*')).toBeNull();
    expect(text?.textContent).toBe('one line\ntwo lines');
    grid.destroy();
  });
});
