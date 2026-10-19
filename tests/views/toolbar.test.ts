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
import { Toolbar, ROW_HEIGHTS, DEBOUNCE_MS, SEARCH_PLACEHOLDER, type ToolbarCallbacks, type ToolbarState } from '../../src/views/grid/toolbar.js';
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
    onFilter: rec('onFilter') as (s: string, q: string) => void,
    onSync: rec('onSync') as () => void,
    onOpenFilter: rec('onOpenFilter') as () => void,
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
    expect(q(toolbar.root, '[data-testid="tablify-query"]'), 'one box, no second query input').toBeNull();
    expect(buttonByAction(toolbar.root, 'sync'), 'Sync button').not.toBeNull();
    expect(buttonByAction(toolbar.root, 'filter'), 'Filter button').not.toBeNull();
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

  it('labels the search-or-query box for assistive technology, with the prototype placeholder', () => {
    const { toolbar } = mount();
    const box = q(toolbar.root, '[data-testid="tablify-search"]') as HTMLInputElement;
    expect(box.getAttribute('aria-label')).toBe('Search or query rows');
    expect(box.placeholder).toBe(SEARCH_PLACEHOLDER);
    expect(SEARCH_PLACEHOLDER).toBe('Search or query — e.g. Status:Done Amount:>10');
  });

  it('orders the buttons per SAD-308: ↶ · ↷ · Add Field · Add Row · Filter · Sync · Options', () => {
    const { toolbar } = mount();
    const actions = [...toolbar.root.querySelectorAll<HTMLElement>('.tablify__toolbar-actions > button')].map(
      (b) => b.dataset.action,
    );
    expect(actions).toEqual(['undo', 'redo', 'add-field', 'add-row', 'filter', 'sync', 'options']);
    const label = (a: string) => buttonByAction(toolbar.root, a)?.querySelector('.tablify__btn-label')?.textContent;
    expect([label('add-field'), label('add-row'), label('filter'), label('sync'), label('options')]).toEqual([
      'Add Field',
      'Add Row',
      'Filter',
      'Sync',
      'Options',
    ]);
    expect(buttonByAction(toolbar.root, 'undo')?.querySelector('.tablify__btn-label')).toBeNull();
    expect(buttonByAction(toolbar.root, 'redo')?.querySelector('.tablify__btn-label')).toBeNull();
    for (const a of actions) {
      expect(buttonByAction(toolbar.root, a ?? '')?.querySelector('svg.tablify__fa'), `${a} glyph`).not.toBeNull();
    }
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
    expect(callbacks.calls.onFilter).toBeUndefined();
  });

  it('reports after the debounce window with the final value', () => {
    const { toolbar, callbacks } = mount();
    const input = q(toolbar.root, '[data-testid="tablify-search"]') as HTMLInputElement;
    input.value = 'alpha';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(callbacks.calls.onFilter).toEqual([['alpha', '']]);
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
    expect(callbacks.calls.onFilter).toEqual([['alpha', '']]);
  });

  it('debounces is 200 ms per the P3-08 spec', () => {
    expect(DEBOUNCE_MS).toBe(200);
  });
});

describe('Toolbar — query terms in the box', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const box = (toolbar: Toolbar) => q(toolbar.root, '[data-testid="tablify-search"]') as HTMLInputElement;
  const errorEl = (toolbar: Toolbar) => q(toolbar.root, '[data-testid="tablify-query-error"]') as HTMLElement;

  it('starts with no error shown', () => {
    const { toolbar } = mount();
    expect(errorEl(toolbar).hidden).toBe(true);
  });

  it('shows an inline error with a position in the box for an invalid term', () => {
    const { toolbar } = mount();
    const input = box(toolbar);
    input.value = 'alpha Score:>';
    input.dispatchEvent(new Event('input'));
    expect(errorEl(toolbar).hidden).toBe(false);
    expect(errorEl(toolbar).textContent).toBe("Expected value after '>' (position 13)");
    expect(input.classList.contains('tablify__search-input--invalid')).toBe(true);
  });

  it('free words alone are never an error', () => {
    const { toolbar } = mount();
    const input = box(toolbar);
    input.value = 'just some words, even "quoted';
    input.dispatchEvent(new Event('input'));
    expect(errorEl(toolbar).hidden).toBe(true);
  });

  it('clears the error once the query parses', () => {
    const { toolbar } = mount();
    const input = box(toolbar);
    input.value = 'Score:>';
    input.dispatchEvent(new Event('input'));
    input.value = 'Status:Done';
    input.dispatchEvent(new Event('input'));
    expect(errorEl(toolbar).hidden).toBe(true);
    expect(input.classList.contains('tablify__search-input--invalid')).toBe(false);
  });

  it('applies the split halves after the debounce', () => {
    const { toolbar, callbacks } = mount();
    const input = box(toolbar);
    input.value = 'alpha Status:Done beta';
    input.dispatchEvent(new Event('input'));
    expect(callbacks.calls.onFilter).toBeUndefined();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(callbacks.calls.onFilter).toEqual([['alpha beta', 'Status:Done']]);
  });

  it('surfaces a persisted query error loaded from the file', () => {
    const { toolbar } = mount({
      queryError: { message: 'Unclosed quote', position: 6, line: 1, column: 7, rawInput: 'Score:"unclosed' },
    });
    expect(errorEl(toolbar).hidden).toBe(false);
    expect(errorEl(toolbar).textContent).toContain('Unclosed quote');
  });

  it('setFilterText applies at once and cancels pending typing', () => {
    const { toolbar, callbacks } = mount();
    const input = box(toolbar);
    input.value = 'stale';
    input.dispatchEvent(new Event('input'));
    toolbar.setFilterText('Gam Status:done');
    expect(input.value).toBe('Gam Status:done');
    expect(callbacks.calls.onFilter).toEqual([['Gam', 'Status:done']]);
    vi.advanceTimersByTime(DEBOUNCE_MS * 2);
    expect(callbacks.calls.onFilter, 'the stale debounce never fires').toHaveLength(1);
    expect(toolbar.getFilterText()).toBe('Gam Status:done');
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

  // COD-72: the switch is the only freeze control, and it reads the 0/1 flag.
  it('offers a freeze switch that reads the flag', () => {
    const { toolbar } = mount();
    buttonByAction(toolbar.root, 'options')?.click();
    const sw = need(toolbar.root.querySelector<HTMLElement>('[role="switch"]'), 'freeze switch');
    expect(sw.getAttribute('aria-checked')).toBe('true'); // createDefaultView freezes the primary
    expect(sw.hasAttribute('disabled')).toBe(false);
    expect(toolbar.root.querySelector('[data-testid="option-freeze"]')?.textContent).toContain('Freeze primary column');

    // A legacy count from an older file still reads as simply "on".
    const view = createDefaultView(FIELDS);
    view.frozenColumns = 3;
    const wide = mount({ view });
    buttonByAction(wide.toolbar.root, 'options')?.click();
    expect(wide.toolbar.root.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
  });

  // COD-72: a pane that cannot render the freeze must not offer an enabled switch.
  it('disables the freeze switch on a narrow pane, with the reason in the label', () => {
    const { toolbar, callbacks } = mount({ freezeUnavailable: true });
    buttonByAction(toolbar.root, 'options')?.click();
    const sw = need(toolbar.root.querySelector<HTMLElement>('[role="switch"]'), 'freeze switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.hasAttribute('disabled')).toBe(true);
    expect(sw.getAttribute('aria-label')).toBe('Freeze primary column. Not available in a narrow window');
    // A disabled button does not fire the toggle.
    sw.click();
    expect(callbacks.calls.onFreezeColumns).toBeUndefined();
  });

  it('reports freeze off (0) when on, and on (1) when off', () => {
    const { toolbar, callbacks } = mount();
    buttonByAction(toolbar.root, 'options')?.click();
    toolbar.root.querySelector<HTMLElement>('[role="switch"]')?.click();
    expect(callbacks.calls.onFreezeColumns).toEqual([0]);

    const view = createDefaultView(FIELDS);
    view.frozenColumns = 0;
    const off = mount({ view });
    buttonByAction(off.toolbar.root, 'options')?.click();
    expect(off.toolbar.root.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false');
    off.toolbar.root.querySelector<HTMLElement>('[role="switch"]')?.click();
    expect(off.callbacks.calls.onFreezeColumns).toEqual([1]);
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

  it('shows "(0 hidden)" and no Show button when no field is hidden (SAD-81)', () => {
    const { toolbar } = mount();
    buttonByAction(toolbar.root, 'options')?.click();
    expect(toolbar.root.querySelector('[data-show-field]')).toBeNull();
    expect(toolbar.root.querySelector('[data-testid="tablify-hidden-fields"]')?.textContent).toContain('(0 hidden)');
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
    buttonByAction(toolbar.root, 'sync')?.click();
    buttonByAction(toolbar.root, 'filter')?.click();
    buttonByAction(toolbar.root, 'add-row')?.click();
    buttonByAction(toolbar.root, 'add-field')?.click();
    buttonByAction(toolbar.root, 'undo')?.click();
    buttonByAction(toolbar.root, 'redo')?.click();
    expect(callbacks.calls.onSync).toHaveLength(1);
    expect(callbacks.calls.onOpenFilter).toHaveLength(1);
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
    expect(q(toolbar.root, '[data-testid="tablify-rowcount"]')?.textContent).toBe('12 rows (of 40)');
  });

  it('uses the singular for exactly one row', () => {
    const { toolbar } = mount({ visibleRowCount: 1, totalRowCount: 1 });
    expect(q(toolbar.root, '[data-testid="tablify-rowcount"]')?.textContent).toBe('1 row');
  });
});

// SAD-113: the field count sits beside the row count in its own element, so the row-count text
// (and every test that reads it) is unchanged.
describe('Toolbar — field count (SAD-113)', () => {
  const fieldText = (root: HTMLElement) => q(root, '[data-testid="tablify-fieldcount"]');

  it('shows the total field count next to the row count', () => {
    const { toolbar } = mount({ visibleRowCount: 12, totalRowCount: 40, totalFieldCount: 7 });
    expect(fieldText(toolbar.root)?.textContent).toBe('7 fields');
    expect(q(toolbar.root, '[data-testid="tablify-rowcount"]')?.textContent).toBe('12 rows (of 40)');
  });

  it('uses the singular for exactly one field', () => {
    const { toolbar } = mount({ totalFieldCount: 1 });
    expect(fieldText(toolbar.root)?.textContent).toBe('1 field');
  });

  it('is hidden when no field count is supplied', () => {
    const { toolbar } = mount({});
    expect(fieldText(toolbar.root)?.hidden ?? true).toBe(true);
  });

  it('updates when the count changes, and does not change for a row filter', () => {
    const { toolbar } = mount({ visibleRowCount: 10, totalRowCount: 10, totalFieldCount: 3 });
    toolbar.update(makeState({ visibleRowCount: 4, totalRowCount: 10, totalFieldCount: 5 }));
    expect(fieldText(toolbar.root)?.textContent).toBe('5 fields');
    expect(q(toolbar.root, '[data-testid="tablify-rowcount"]')?.textContent).toBe('4 rows (of 10)');
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

  it('shows persisted search and query together, search first', () => {
    const { toolbar, state } = mount();
    toolbar.update({ ...state, search: 'Gam', query: 'Status:done' });
    expect((q(toolbar.root, '[data-testid="tablify-search"]') as HTMLInputElement).value).toBe('Gam Status:done');
  });

  it("keeps the user's own spacing when the persisted halves already match", () => {
    const { toolbar, state } = mount();
    const input = q(toolbar.root, '[data-testid="tablify-search"]') as HTMLInputElement;
    input.value = 'Status:done   Gam';
    toolbar.update({ ...state, search: 'Gam', query: 'Status:done' });
    expect(input.value).toBe('Status:done   Gam');
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
