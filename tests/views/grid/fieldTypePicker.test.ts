/**
 * @vitest-environment jsdom
 *
 * The field type picker (COD-76).
 *
 * The Field type row used to be a native `<select>` with `<optgroup>`s, so the list that opened was
 * the platform's: unthemeable, one word per row, and (in Modify) missing every type that would drop
 * values. These tests pin the replacement: the catalogue and its order, the trigger's state, the
 * search, the keyboard, the blocked rows, and — the part that matters for the rest of the plugin —
 * that picking a type still runs the window's own `showTypeRows()` and nothing else.
 *
 * The panel lives on `document.body` (the window is an overflow:auto modal that would clip it), so
 * the helpers in ./typePickerSupport.ts are the one place that knows where to look.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axe from 'axe-core';
import { FieldTypePicker, FIELD_TYPE_META, TYPE_GROUPS } from '../../../src/views/grid/fieldTypePicker.js';
import { CHANGE_TARGET_TYPES, TYPE_LABELS } from '../../../src/menus/tableMenuModel.js';
import type { FieldTypeName } from '../../../src/model/types.js';

const ALL: FieldTypeName[] = [...CHANGE_TARGET_TYPES];

interface Harness {
  picker: FieldTypePicker;
  host: HTMLElement;
  picked: FieldTypeName[];
  panel: () => HTMLElement;
  rows: () => HTMLElement[];
  row: (type: FieldTypeName) => HTMLElement;
  trigger: () => HTMLButtonElement;
  search: () => HTMLInputElement;
}

/** Mount the picker's trigger in a detached host, as the window does inside its Field type row. */
function mount(opts: Partial<ConstructorParameters<typeof FieldTypePicker>[0]> = {}): Harness {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const picked: FieldTypeName[] = [];
  const picker = new FieldTypePicker({
    value: 'text',
    onChange: (t) => picked.push(t),
    ...opts,
  });
  host.appendChild(picker.element);

  const panel = (): HTMLElement => {
    const p = document.querySelector('[data-testid="tablify-field-type-panel"]') as HTMLElement | null;
    if (!p) throw new Error('the panel is not open');
    return p;
  };
  const rows = (): HTMLElement[] => Array.from(panel().querySelectorAll<HTMLElement>('[data-type]'));
  const row = (type: FieldTypeName): HTMLElement => {
    const r = panel().querySelector<HTMLElement>(`[data-type="${type}"]`);
    if (!r) throw new Error(`no row for ${type}`);
    return r;
  };
  const trigger = (): HTMLButtonElement => host.querySelector('.tablify__tp-trigger') as HTMLButtonElement;
  const search = (): HTMLInputElement => panel().querySelector('.tablify__tp-input') as HTMLInputElement;

  return { picker, host, picked, panel, rows, row, trigger, search };
}

/** Press a key on whatever has focus in the panel (the search box is the focus holder). */
function press(h: Harness, key: string): void {
  h.search().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('COD-76 — the catalogue', () => {
  it('draws every change-target type, in the model’s order', () => {
    const h = mount();
    h.trigger().click();
    expect(h.rows().map((r) => r.dataset.type)).toEqual([...CHANGE_TARGET_TYPES]);
  });

  it('groups them exactly as TYPE_GROUPS does, and TYPE_GROUPS is still the whole target list', () => {
    const h = mount();
    h.trigger().click();
    const headings = Array.from(h.panel().querySelectorAll('.tablify__tp-group')).map((g) => g.textContent);
    expect(headings).toEqual(TYPE_GROUPS.map(([label]) => label));
    expect(TYPE_GROUPS.flatMap(([, types]) => types)).toEqual([...CHANGE_TARGET_TYPES]);
  });

  it('every offered type has a label, an icon, a description and search keywords', () => {
    for (const type of ALL) {
      const meta = FIELD_TYPE_META[type];
      expect(TYPE_LABELS[type], `label for ${type}`).toBeTruthy();
      expect(meta, `meta for ${type}`).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.description.length, `description for ${type}`).toBeGreaterThan(8);
      expect(meta.keywords.split(' ').length, `keywords for ${type}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('has meta for the three system types too (a field can already be one)', () => {
    for (const type of ['auto_number', 'created_time', 'modified_time'] as FieldTypeName[]) {
      expect(FIELD_TYPE_META[type].icon).toBeTruthy();
      expect(TYPE_LABELS[type]).toBeTruthy();
    }
  });

  it('each group is named by its own heading, not by itself', () => {
    const h = mount();
    h.trigger().click();
    for (const group of Array.from(h.panel().querySelectorAll('.tablify__tp-group'))) {
      const id = group.getAttribute('aria-labelledby');
      expect(id).toBeTruthy();
      expect(id).not.toBe(group.id);
      expect(h.panel().querySelector(`#${id}`)?.textContent).toBe(group.textContent);
    }
  });

  it('marks the current type selected, and only it', () => {
    const h = mount();
    h.trigger().click();
    const selected = h.rows().filter((r) => r.getAttribute('aria-selected') === 'true');
    expect(selected.map((r) => r.dataset.type)).toEqual(['text']);
    expect(selected[0].classList.contains('tablify__tp-row--current')).toBe(true);
  });
});

describe('COD-76 — pressing the trigger', () => {
  it('a press on the trigger leaves the toggling to its click', () => {
    const h = mount();
    h.trigger().click();
    // A real press arrives as pointerdown then click; the pointerdown must not dismiss first,
    // or the click would reopen the panel and it could never be toggled shut.
    h.trigger().dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(h.picker.isOpen).toBe(true);
    h.trigger().click();
    expect(h.picker.isOpen).toBe(false);
  });
});

describe('COD-76 — the closed trigger', () => {
  it('shows the type’s icon, name and a chevron', () => {
    const h = mount({ value: 'date_time' });
    expect(h.trigger().querySelector('.tablify__tp-glyph svg')).not.toBeNull();
    expect(h.trigger().querySelector('.tablify__tp-name')?.textContent).toBe('Date and time');
    expect(h.trigger().querySelector('.tablify__tp-chevron svg')).not.toBeNull();
  });

  it('names itself "Field type: …" — a label cannot point at a button', () => {
    const h = mount({ value: 'currency' });
    expect(h.trigger().getAttribute('aria-label')).toBe('Field type: Currency');
  });

  it('has the popup semantics and starts collapsed', () => {
    const h = mount();
    expect(h.trigger().getAttribute('aria-haspopup')).toBe('dialog');
    expect(h.trigger().getAttribute('aria-expanded')).toBe('false');
    expect(h.trigger().getAttribute('aria-controls')).toBeNull();
  });

  it('keeps the id the native select carried, so tests and capture routes still find it', () => {
    const h = mount({ id: 'tablify__af-type' });
    expect(h.trigger().id).toBe('tablify__af-type');
  });

  it('repaints after a pick', () => {
    const h = mount();
    h.trigger().click();
    h.row('rating').click();
    expect(h.trigger().querySelector('.tablify__tp-name')?.textContent).toBe('Rating');
    expect(h.trigger().getAttribute('aria-label')).toBe('Field type: Rating');
  });

  it('shows a system type by its label, not its key', () => {
    const h = mount({ value: 'auto_number', edit: true });
    expect(h.trigger().querySelector('.tablify__tp-name')?.textContent).toBe('Auto number');
  });
});

describe('COD-76 — opening and closing', () => {
  it('opens on click and reports expanded', () => {
    const h = mount();
    h.trigger().click();
    expect(h.picker.isOpen).toBe(true);
    expect(h.trigger().getAttribute('aria-expanded')).toBe('true');
    expect(h.trigger().getAttribute('aria-controls')).toBe('tablify__tp-list');
  });

  it.each(['Enter', ' ', 'ArrowDown', 'ArrowUp'])('opens on %s from the trigger', (key) => {
    const h = mount();
    h.trigger().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    expect(h.picker.isOpen).toBe(true);
  });

  it('opens with a printable character already in the search', () => {
    const h = mount();
    h.trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true }));
    expect(h.search().value).toBe('m');
    expect(h.rows().map((r) => r.dataset.type)).toContain('number');
  });

  it('focuses the search on a fine pointer', () => {
    const h = mount();
    h.trigger().click();
    expect(document.activeElement).toBe(h.search());
  });

  it('does not focus the search on a coarse pointer (the keyboard would cover the list)', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('coarse'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    try {
      const h = mount();
      h.trigger().click();
      expect(document.activeElement).not.toBe(h.search());
    } finally {
      window.matchMedia = original;
    }
  });

  it('closes on Escape without picking anything, and says so', () => {
    const h = mount();
    h.trigger().click();
    press(h, 'Escape');
    expect(h.picker.isOpen).toBe(false);
    expect(h.picked).toEqual([]);
    expect(document.querySelector('[data-testid="tablify-field-type-panel"]')).toBeNull();
  });

  it('never lets Escape reach the window it sits in — Obsidian closes the modal on it', () => {
    const h = mount();
    h.trigger().click();
    const seen = vi.fn();
    document.addEventListener('keydown', seen);
    try {
      press(h, 'Escape');
      expect(seen).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', seen);
    }
  });

  it('closes on a press outside, and stays open on a press inside', () => {
    const h = mount();
    h.trigger().click();
    h.search().dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(h.picker.isOpen).toBe(true);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(h.picker.isOpen).toBe(false);
  });

  it('closes on Tab and lets focus carry on', () => {
    const h = mount();
    h.trigger().click();
    press(h, 'Tab');
    expect(h.picker.isOpen).toBe(false);
  });

  it('removes the panel and its listeners on close — opening twice leaves nothing behind', () => {
    const h = mount();
    h.trigger().click();
    h.trigger().click(); // the trigger toggles
    expect(document.querySelectorAll('[data-testid="tablify-field-type-panel"]')).toHaveLength(0);
    h.trigger().click();
    expect(document.querySelectorAll('[data-testid="tablify-field-type-panel"]')).toHaveLength(1);
  });
});

describe('COD-76 — searching', () => {
  const search = (h: Harness, text: string): void => {
    const input = h.search();
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('matches the type name', () => {
    const h = mount();
    h.trigger().click();
    search(h, 'curr');
    expect(h.rows().map((r) => r.dataset.type)).toEqual(['currency']);
  });

  it.each([
    ['money', ['currency']],
    ['stars', ['rating']],
    ['clock', ['date_time']],
    ['vault', ['attachment']],
    ['relation', ['link']],
    ['calculate', ['formula']],
    ['call', ['phone']],
  ])('finds a type by the word a user has in mind: %s', (word, expected) => {
    const h = mount();
    h.trigger().click();
    search(h, word);
    expect(h.rows().map((r) => r.dataset.type).sort()).toEqual([...expected].sort());
  });

  it('is case-insensitive and ignores surrounding spaces', () => {
    const h = mount();
    h.trigger().click();
    search(h, '  MONEY  ');
    expect(h.rows().map((r) => r.dataset.type)).toEqual(['currency']);
  });

  it('drops the group headings that have no match', () => {
    const h = mount();
    h.trigger().click();
    search(h, 'clock');
    const headings = Array.from(h.panel().querySelectorAll('.tablify__tp-group')).map((g) => g.textContent);
    expect(headings).toEqual(['Date']);
  });

  it('follows the count in the hint bar', () => {
    const h = mount();
    h.trigger().click();
    expect(h.panel().querySelector('.tablify__tp-count')?.textContent).toBe('18 types');
    search(h, 'date');
    const count = h.panel().querySelector('.tablify__tp-count')?.textContent ?? '';
    expect(count).toMatch(/^\d+ types?$/);
    expect(Number(count.split(' ')[0])).toBeLessThan(18);
  });

  it('says so when nothing matches, and offers Clear search', () => {
    const h = mount();
    h.trigger().click();
    search(h, 'zzz');
    expect(h.panel().textContent).toContain('No field type matches');
    expect(h.panel().querySelector('.tablify__tp-count')?.textContent).toBe('no match');
    (h.panel().querySelector('[data-clear]') as HTMLElement).click();
    expect(h.rows().length).toBe(18);
  });

  it('clears the search back to the full list from the little x', () => {
    const h = mount();
    h.trigger().click();
    search(h, 'money');
    const clear = h.panel().querySelector('.tablify__tp-clear') as HTMLButtonElement;
    expect(clear.hidden).toBe(false);
    clear.click();
    expect(h.search().value).toBe('');
    expect(h.rows().length).toBe(18);
    expect(clear.hidden).toBe(true);
  });
});

describe('COD-76 — the keyboard', () => {
  it('moves with ↓ and ↑ and wraps at both ends', () => {
    const h = mount();
    h.trigger().click();
    expect(h.search().getAttribute('aria-activedescendant')).toBe('tablify__tp-text');
    press(h, 'ArrowDown');
    expect(h.search().getAttribute('aria-activedescendant')).toBe('tablify__tp-long_text');
    press(h, 'ArrowUp');
    expect(h.search().getAttribute('aria-activedescendant')).toBe('tablify__tp-text');
    press(h, 'ArrowUp');
    expect(h.search().getAttribute('aria-activedescendant')).toBe('tablify__tp-link');
  });

  it('skips blocked rows', () => {
    const h = mount({ edit: true, typeBlockReason: (t) => (t === 'long_text' ? 'cannot convert' : null) });
    h.trigger().click();
    press(h, 'ArrowDown');
    expect(h.search().getAttribute('aria-activedescendant')).toBe('tablify__tp-number');
  });

  it('Home and End go to the ends', () => {
    const h = mount();
    h.trigger().click();
    press(h, 'End');
    expect(h.search().getAttribute('aria-activedescendant')).toBe('tablify__tp-link');
    press(h, 'Home');
    expect(h.search().getAttribute('aria-activedescendant')).toBe('tablify__tp-text');
  });

  it('PageDown and PageUp jump five rows and clamp', () => {
    const h = mount();
    h.trigger().click();
    press(h, 'PageDown');
    expect(h.search().getAttribute('aria-activedescendant')).toBe('tablify__tp-duration');
    for (let i = 0; i < 10; i += 1) press(h, 'PageDown');
    expect(h.search().getAttribute('aria-activedescendant')).toBe('tablify__tp-link'); // clamped at the end
    press(h, 'PageUp');
    expect(h.search().getAttribute('aria-activedescendant')).toBe('tablify__tp-phone'); // five rows up
  });

  it('Enter picks the highlighted row and returns focus to the trigger', () => {
    const h = mount();
    h.trigger().click();
    press(h, 'ArrowDown');
    press(h, 'Enter');
    expect(h.picked).toEqual(['long_text']);
    expect(h.picker.isOpen).toBe(false);
    expect(document.activeElement).toBe(h.trigger());
  });

  it('never lets Enter reach the window — AddFieldModal submits on Enter in an input', () => {
    const h = mount();
    h.trigger().click();
    const seen = vi.fn();
    document.addEventListener('keydown', seen);
    try {
      press(h, 'Enter');
      expect(seen).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', seen);
    }
  });

  it('with every other type blocked, Enter still works on the field’s own type', () => {
    const h = mount({ edit: true, value: 'text', typeBlockReason: () => 'cannot convert' });
    h.trigger().click();
    // ↓ skips the blocked rows, so the cursor never leaves the one type that is allowed.
    press(h, 'ArrowDown');
    expect(h.search().getAttribute('aria-activedescendant')).toBe('tablify__tp-text');
    press(h, 'Enter');
    expect(h.picked).toEqual(['text']);
  });
});

describe('COD-76 — Modify mode and the blocked rows', () => {
  it('shows every change-target type even when most would drop values', () => {
    const h = mount({ edit: true, value: 'text', typeBlockReason: (t) => (t === 'text' ? null : '3 values cannot convert') });
    h.trigger().click();
    expect(h.rows()).toHaveLength(18);
  });

  it('marks a blocked row aria-disabled and keeps it in place', () => {
    const h = mount({ edit: true, typeBlockReason: (t) => (t === 'number' ? '3 values cannot convert' : null) });
    h.trigger().click();
    const row = h.row('number');
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.textContent).toContain('3 values cannot convert');
    expect(row.classList.contains('tablify__tp-row--blocked')).toBe(true);
  });

  it('the field’s own type is never blocked, even when the rule says so', () => {
    const h = mount({ edit: true, value: 'number', typeBlockReason: () => 'cannot convert' });
    h.trigger().click();
    expect(h.row('number').getAttribute('aria-disabled')).toBeNull();
  });

  it('clicking a blocked row changes nothing', () => {
    const h = mount({ edit: true, typeBlockReason: (t) => (t === 'formula' ? 'Formula fields are created with Add field' : null) });
    h.trigger().click();
    h.row('formula').click();
    expect(h.picked).toEqual([]);
    expect(h.picker.isOpen).toBe(true);
  });

  it('create mode never blocks a type, whatever the caller does', () => {
    const h = mount({ canPickType: () => false });
    h.trigger().click();
    expect(h.rows().every((r) => r.getAttribute('aria-disabled') === null)).toBe(true);
  });

  it('falls back to a generic reason when only the old boolean is supplied', () => {
    const h = mount({ edit: true, canPickType: (t) => t === 'text' });
    h.trigger().click();
    expect(h.row('date').textContent).toContain('Not available for this field');
  });
});

describe('COD-76 — in the window', () => {
  it('picking runs onChange exactly once, with the picked type', () => {
    const h = mount();
    h.trigger().click();
    h.row('multi_select').click();
    expect(h.picked).toEqual(['multi_select']);
  });

  it('setValue keeps an external change in sync (the window calls it after showTypeRows)', () => {
    const h = mount();
    h.picker.setValue('checkbox');
    expect(h.trigger().querySelector('.tablify__tp-name')?.textContent).toBe('Checkbox');
    expect(h.picker.value).toBe('checkbox');
  });

  it('reads back the committed type', () => {
    const h = mount({ value: 'percent' });
    expect(h.picker.value).toBe('percent');
    h.trigger().click();
    h.row('duration').click();
    expect(h.picker.value).toBe('duration');
  });

  it('closing the picker twice is harmless (the window closes right after a pick)', () => {
    const h = mount();
    h.trigger().click();
    h.picker.close();
    expect(() => h.picker.close()).not.toThrow();
  });
});

describe('COD-76 — placement', () => {
  /** jsdom has no layout: give the trigger the geometry the case is about. */
  function place(trigger: HTMLElement, top: number, height = 39, left = 24, width = 320): void {
    trigger.getBoundingClientRect = () =>
      ({ top, bottom: top + height, left, right: left + width, width, height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
  }
  const viewport = (height: number): void => {
    Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
  };
  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
  });

  it('hangs 6 px under the trigger when there is room below', () => {
    const h = mount();
    place(h.trigger(), 100);
    h.trigger().click();
    expect(h.panel().style.top).toBe('145px');
    expect(h.panel().style.position).toBe('fixed');
  });

  it('flips above the trigger when the bottom of the screen is close', () => {
    const h = mount();
    place(h.trigger(), 700);
    h.trigger().click();
    // The panel's own height is zero in jsdom, so it sits 6 px above the trigger's top edge.
    expect(parseFloat(h.panel().style.top)).toBeLessThan(700);
  });

  it('never gives the list more height than the side it opened on has', () => {
    viewport(300);
    const h = mount();
    place(h.trigger(), 120);
    h.trigger().click();
    const list = h.panel().querySelector('.tablify__tp-list') as HTMLElement;
    // 300 px of screen, a trigger at 120..159, the panel's 86 px of chrome and a 8 px edge: the
    // list is held at its 120 px floor rather than pushed off the bottom.
    expect(list.style.maxHeight).toBe('120px');
  });
});

describe('COD-76 — accessibility', () => {
  it('exposes the combobox / listbox model', () => {
    const h = mount();
    h.trigger().click();
    const input = h.search();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe('tablify__tp-list');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    const list = h.panel().querySelector('.tablify__tp-list') as HTMLElement;
    expect(list.getAttribute('role')).toBe('listbox');
    expect(h.rows().every((r) => r.getAttribute('role') === 'option')).toBe(true);
    expect(h.rows().every((r) => r.hasAttribute('aria-selected'))).toBe(true);
    expect(h.panel().querySelectorAll('[role="group"]').length).toBe(5);
  });

  it('has no critical or serious axe violations', async () => {
    const h = mount({ edit: true, typeBlockReason: (t) => (t === 'number' ? '3 values cannot convert' : null) });
    h.trigger().click();
    const results = await axe.run(h.panel(), {
      rules: {
        region: { enabled: false },
        'landmark-one-main': { enabled: false },
        'page-has-heading-one': { enabled: false },
        bypass: { enabled: false },
        'html-has-lang': { enabled: false },
        // jsdom has no layout; the pairs are measured in tests/ui/contrast.test.ts.
        'color-contrast': { enabled: false },
      },
    } as unknown as Parameters<typeof axe.run>[1]);
    const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(serious.map((v) => v.id)).toEqual([]);
  });
});
