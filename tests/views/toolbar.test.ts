/**
 * @vitest-environment jsdom
 *
 * Toolbar unit tests (SAD-69 plan items A and B).
 *
 * src/views/grid/toolbar.ts is the file P3-08 specified as its output and that never
 * existed. These tests cover it directly, in jsdom, without Obsidian — which is why the
 * toolbar is built from document.createElement rather than Obsidian's createEl.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Toolbar, ROW_HEIGHTS, DEBOUNCE_MS, type ToolbarCallbacks, type ToolbarState } from '../../src/views/grid/toolbar.js';
import { createDefaultView } from '../../src/model/view.js';
import type { FieldDefinition } from '../../src/model/types.js';

const FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
  { id: 'fld_status', name: 'Status', type: 'single_select', options: [{ id: 'opt_a', name: 'Done', color: 'green' }] },
  { id: 'fld_score', name: 'Score', type: 'number' },
];

function makeCallbacks(): ToolbarCallbacks & { calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = {};
  const rec = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args.length === 1 ? args[0] : args);
  };
  return {
    calls,
    onSearch: rec('onSearch') as (t: string) => void,
    onQuery: rec('onQuery') as (q: string) => void,
    onAddRow: rec('onAddRow') as () => void,
    onAddField: rec('onAddField') as () => void,
    onRowHeight: rec('onRowHeight') as (h: never) => void,
    onFreezeColumns: rec('onFreezeColumns') as (n: number) => void,
    onShowField: rec('onShowField') as (id: string) => void,
    onClearFilters: rec('onClearFilters') as () => void,
    onUndo: rec('onUndo') as () => void,
    onRedo: rec('onRedo') as () => void,
  };
}

function makeState(overrides: Partial<ToolbarState> = {}): ToolbarState {
  const view = createDefaultView(FIELDS);
  return {
    fields: FIELDS,
    view,
    visibleRowCount: 10,
    totalRowCount: 10,
    search: '',
    query: '',
    queryError: null,
    theme: 'light',
    ...overrides,
  };
}

function mount(state: Partial<ToolbarState> = {}) {
  const callbacks = makeCallbacks();
  const full = makeState(state);
  const toolbar = new Toolbar({ ...full, callbacks });
  document.body.appendChild(toolbar.root);
  return { toolbar, callbacks, state: full };
}

const q = (root: HTMLElement, sel: string) => root.querySelector<HTMLElement>(sel);

/** Assert a node exists and return it, so tests avoid non-null assertions (lint warns on them). */
function need<T>(value: T | null | undefined, label: string): T {
  expect(value, label).not.toBeNull();
  if (value === null || value === undefined) throw new Error(`missing element: ${label}`);
  return value;
}

const buttonByAction = (root: HTMLElement, action: string) =>
  root.querySelector<HTMLElement>(`[data-action="${action}"]`);

describe('Toolbar — structure', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders every control the prototype calls for', () => {
    const { toolbar } = mount();
    expect(q(toolbar.root, '[data-testid="tablify-search"]')).not.toBeNull();
    expect(q(toolbar.root, '[data-testid="tablify-query"]')).not.toBeNull();
    expect(buttonByAction(toolbar.root, 'add-row'), 'Add row button').not.toBeNull();
    expect(buttonByAction(toolbar.root, 'add-field'), 'Add Field button').not.toBeNull();
    expect(buttonByAction(toolbar.root, 'options'), 'Options button').not.toBeNull();
    expect(buttonByAction(toolbar.root, 'undo')).not.toBeNull();
    expect(buttonByAction(toolbar.root, 'redo')).not.toBeNull();
  });

  it('uses plugin theme tokens, not Obsidian variables', () => {
    const { toolbar } = mount({ theme: 'dark' });
    expect(toolbar.root.classList.contains('tablify--dark')).toBe(true);
    expect(toolbar.root.style.getPropertyValue('--tablify-bg')).toBeTruthy();
    const html = toolbar.root.outerHTML;
    for (const m of html.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)) {
      expect(m[1].startsWith('--tablify-'), `${m[1]} is not a Tablify token`).toBe(true);
    }
  });

  it('labels the search and query inputs for assistive technology', () => {
    const { toolbar } = mount();
    expect(q(toolbar.root, '[data-testid="tablify-search"]')?.getAttribute('aria-label')).toBeTruthy();
    expect(q(toolbar.root, '[data-testid="tablify-query"]')?.getAttribute('aria-label')).toBeTruthy();
  });
});

describe('Toolbar — search debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not report the search immediately', () => {
    const { toolbar, callbacks } = mount();
    const input = q(toolbar.root, '[data-testid="tablify-search"]') as HTMLInputElement;
    input.value = 'alpha';
    input.dispatchEvent(new Event('input'));
    expect(callbacks.calls.onSearch).toBeUndefined();
  });

  it('reports after the debounce window with the final value', () => {
    const { toolbar, callbacks } = mount();
    const input = q(toolbar.root, '[data-testid="tablify-search"]') as HTMLInputElement;
    input.value = 'alpha';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(callbacks.calls.onSearch).toEqual(['alpha']);
  });

  it('collapses rapid typing into a single call', () => {
    const { toolbar, callbacks } = mount();
    const input = q(toolbar.root, '[data-testid="tablify-search"]') as HTMLInputElement;
    for (const v of ['a', 'al', 'alp', 'alph', 'alpha']) {
      input.value = v;
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(DEBOUNCE_MS - 50);
    }
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(callbacks.calls.onSearch).toEqual(['alpha']);
  });

  it('debounces is 200 ms per the P3-08 spec', () => {
    expect(DEBOUNCE_MS).toBe(200);
  });
});

describe('Toolbar — query input', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows an inline error with a position for an invalid query', () => {
    const { toolbar } = mount();
    const input = q(toolbar.root, '[data-testid="tablify-query"]') as HTMLInputElement;
    const error = q(toolbar.root, '[data-testid="tablify-query-error"]') as HTMLElement;
    input.value = 'Score:"unclosed';
    input.dispatchEvent(new Event('input'));
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('position');
    expect(input.classList.contains('tablify__query-input--invalid')).toBe(true);
  });

  it('clears the error once the query parses', () => {
    const { toolbar } = mount();
    const input = q(toolbar.root, '[data-testid="tablify-query"]') as HTMLInputElement;
    const error = q(toolbar.root, '[data-testid="tablify-query-error"]') as HTMLElement;
    input.value = 'Score:"unclosed';
    input.dispatchEvent(new Event('input'));
    input.value = 'Status:Done';
    input.dispatchEvent(new Event('input'));
    expect(error.hidden).toBe(true);
    expect(input.classList.contains('tablify__query-input--invalid')).toBe(false);
  });

  it('applies the query after the debounce', () => {
    const { toolbar, callbacks } = mount();
    const input = q(toolbar.root, '[data-testid="tablify-query"]') as HTMLInputElement;
    input.value = 'Status:Done';
    input.dispatchEvent(new Event('input'));
    expect(callbacks.calls.onQuery).toBeUndefined();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(callbacks.calls.onQuery).toEqual(['Status:Done']);
  });

  it('surfaces a persisted query error loaded from the file', () => {
    const { toolbar } = mount({
      query: 'Score:"unclosed',
      queryError: { message: 'Unclosed quote', position: 6, line: 1, column: 7, rawInput: 'Score:"unclosed' },
    });
    const error = q(toolbar.root, '[data-testid="tablify-query-error"]') as HTMLElement;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('Unclosed quote');
  });
});

describe('Toolbar — Options panel (view settings)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('starts closed and opens on click', () => {
    const { toolbar } = mount();
    expect(toolbar.isOptionsOpen()).toBe(false);
    buttonByAction(toolbar.root, 'options')?.click();
    expect(toolbar.isOptionsOpen()).toBe(true);
    expect(buttonByAction(toolbar.root, 'options')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes on Escape', () => {
    const { toolbar } = mount();
    buttonByAction(toolbar.root, 'options')?.click();
    expect(toolbar.isOptionsOpen()).toBe(true);
    toolbar.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(toolbar.isOptionsOpen()).toBe(false);
  });

  it('offers the three schema-legal row heights', () => {
    const { toolbar } = mount();
    buttonByAction(toolbar.root, 'options')?.click();
    const heights = Array.from(toolbar.root.querySelectorAll<HTMLElement>('[data-row-height]')).map(
      (b) => b.dataset.rowHeight,
    );
    expect(heights).toEqual(ROW_HEIGHTS);
    // 'compact' and 'tall' would be rejected by tablify.schema.json.
    expect(heights).not.toContain('compact');
    expect(heights).not.toContain('tall');
  });

  it('marks the active row height', () => {
    const { toolbar } = mount();
    buttonByAction(toolbar.root, 'options')?.click();
    const active = toolbar.root.querySelector<HTMLElement>('[data-row-height].is-active');
    expect(active?.dataset.rowHeight).toBe('medium'); // createDefaultView default
  });

  it('reports a row height choice', () => {
    const { toolbar, callbacks } = mount();
    buttonByAction(toolbar.root, 'options')?.click();
    toolbar.root.querySelector<HTMLElement>('[data-row-height="large"]')?.click();
    expect(callbacks.calls.onRowHeight).toEqual(['large']);
  });

  it('offers a freeze-column control bounded by the field count', () => {
    const { toolbar } = mount();
    buttonByAction(toolbar.root, 'options')?.click();
    const select = toolbar.root.querySelector<HTMLSelectElement>('.tablify__option-select');
    expect(select).not.toBeNull();
    // 0 through FIELDS.length inclusive.
    expect(Array.from(need(select, 'freeze select').options).map((o) => o.value)).toEqual(['0', '1', '2', '3']);
  });

  it('reports a freeze-column change', () => {
    const { toolbar, callbacks } = mount();
    buttonByAction(toolbar.root, 'options')?.click();
    const select = need(
      toolbar.root.querySelector<HTMLSelectElement>('.tablify__option-select'),
      'freeze select',
    );
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    expect(callbacks.calls.onFreezeColumns).toEqual([2]);
  });
});

describe('Toolbar — showing a hidden field (plan item B)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('lists hidden fields and reports Show with the right field id', () => {
    const view = createDefaultView(FIELDS);
    view.hidden = ['fld_score'];
    const { toolbar, callbacks } = mount({ view });
    buttonByAction(toolbar.root, 'options')?.click();

    const showBtn = toolbar.root.querySelector<HTMLElement>('[data-show-field]');
    expect(showBtn).not.toBeNull();
    expect(need(showBtn, 'show field button').dataset.showField).toBe('fld_score');

    need(showBtn, 'show field button').click();
    expect(callbacks.calls.onShowField).toEqual(['fld_score']);
  });

  it('shows "None" when no field is hidden', () => {
    const { toolbar } = mount();
    buttonByAction(toolbar.root, 'options')?.click();
    expect(toolbar.root.querySelector('[data-show-field]')).toBeNull();
    expect(toolbar.root.textContent).toContain('None');
  });

  it('still offers to unhide the primary field, so a corrupt file is recoverable', () => {
    // R-D13 forbids hiding the primary field and validateView rejects it, but a hand-edited
    // or corrupt file could still arrive with it hidden. With no way to unhide, the table
    // would be permanently stuck — so the recovery path stays available.
    const view = createDefaultView(FIELDS);
    view.hidden = ['fld_name'];
    const { toolbar, callbacks } = mount({ view });
    buttonByAction(toolbar.root, 'options')?.click();
    const btn = toolbar.root.querySelector<HTMLElement>('[data-show-field="fld_name"]');
    expect(btn, 'a way to unhide the primary field must exist').not.toBeNull();
    need(btn, 'primary field show button').click();
    expect(callbacks.calls.onShowField).toEqual(['fld_name']);
  });
});

describe('Toolbar — action buttons and row count', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('routes each button to its callback', () => {
    const { toolbar, callbacks } = mount();
    buttonByAction(toolbar.root, 'add-row')?.click();
    buttonByAction(toolbar.root, 'add-field')?.click();
    buttonByAction(toolbar.root, 'undo')?.click();
    buttonByAction(toolbar.root, 'redo')?.click();
    expect(callbacks.calls.onAddRow).toHaveLength(1);
    expect(callbacks.calls.onAddField).toHaveLength(1);
    expect(callbacks.calls.onUndo).toHaveLength(1);
    expect(callbacks.calls.onRedo).toHaveLength(1);
  });

  it('reports clear filters from the options panel', () => {
    const { toolbar, callbacks } = mount();
    buttonByAction(toolbar.root, 'options')?.click();
    buttonByAction(toolbar.root, 'clear-filters')?.click();
    expect(callbacks.calls.onClearFilters).toHaveLength(1);
  });

  it('shows a plain count when nothing is filtered', () => {
    const { toolbar } = mount({ visibleRowCount: 40, totalRowCount: 40 });
    expect(q(toolbar.root, '[data-testid="tablify-rowcount"]')?.textContent).toBe('40 rows');
  });

  it('shows "N of M rows" when a filter is active', () => {
    const { toolbar } = mount({ visibleRowCount: 12, totalRowCount: 40 });
    expect(q(toolbar.root, '[data-testid="tablify-rowcount"]')?.textContent).toBe('12 of 40 rows');
  });

  it('uses the singular for exactly one row', () => {
    const { toolbar } = mount({ visibleRowCount: 1, totalRowCount: 1 });
    expect(q(toolbar.root, '[data-testid="tablify-rowcount"]')?.textContent).toBe('1 row');
  });
});

describe('Toolbar — update() preserves user input', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('adopts an externally changed search value', () => {
    const { toolbar, state } = mount();
    toolbar.update({ ...state, search: 'from file' });
    expect((q(toolbar.root, '[data-testid="tablify-search"]') as HTMLInputElement).value).toBe('from file');
  });

  it('does not clobber the search box while it is focused', () => {
    // A re-render triggered by something else mid-keystroke must not wipe pending text.
    const { toolbar, state } = mount();
    const input = q(toolbar.root, '[data-testid="tablify-search"]') as HTMLInputElement;
    input.focus();
    input.value = 'half-typed';
    toolbar.update({ ...state, search: '' });
    expect(input.value).toBe('half-typed');
  });

  it('refreshing does not rebuild the inputs (focus is retained)', () => {
    const { toolbar, state } = mount();
    const input = q(toolbar.root, '[data-testid="tablify-search"]') as HTMLInputElement;
    input.focus();
    toolbar.update({ ...state, visibleRowCount: 5, totalRowCount: 40 });
    expect(document.activeElement).toBe(input);
  });

  it('switches theme in place', () => {
    const { toolbar, state } = mount({ theme: 'light' });
    toolbar.update({ ...state, theme: 'dark' });
    expect(toolbar.root.classList.contains('tablify--dark')).toBe(true);
    expect(toolbar.root.classList.contains('tablify--light')).toBe(false);
  });
});

describe('Toolbar — lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('destroy removes the root from the DOM', () => {
    const { toolbar } = mount();
    expect(document.body.contains(toolbar.root)).toBe(true);
    toolbar.destroy();
    expect(document.body.contains(toolbar.root)).toBe(false);
  });
});
