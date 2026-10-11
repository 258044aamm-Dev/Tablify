/**
 * @vitest-environment jsdom
 *
 * SAD-81 — Options panel Group by / Sort / Fields and collapsible group rows (prototype
 * `renderOptionsPanel`, `renderGrid` group rows and `toggleGroup`).
 *
 * Covers the pure grouping helpers, the GridView grouped layout (headers, ARIA, numbering,
 * collapse, windowing, flat mode untouched), the TableView wiring (group-by / sort / hide /
 * clear and collapse persistence), the `collapsedGroups` format round-trip, and the contrast of
 * the new accent fill and option chips.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axe from 'axe-core';
import { WorkspaceLeaf, Notice } from 'obsidian';
import { GridView, type GridOptions } from '../../../src/views/grid/GridView.js';
import {
  groupRows,
  groupKeyOf,
  toggleCollapsed,
  isGroupable,
  EMPTY_GROUP_LABEL,
} from '../../../src/views/grid/grouping.js';
import { setGroupBy, setSort, hideField } from '../../../src/views/grid/columns.js';
import { TableView } from '../../../src/views/tableView.js';
import { createDefaultView, validateView, normalizeView } from '../../../src/model/view.js';
import { parse } from '../../../src/format/parse.js';
import { serialize } from '../../../src/format/serialize.js';
import { contrastRatio } from '../../../src/ui/theme/contrast.js';
import { lightTheme, darkTheme, optionChipColors } from '../../../src/ui/theme/tokens.js';
import type { CellValue, FieldDefinition, Row, ViewDefinition } from '../../../src/model/types.js';

const STATUS: FieldDefinition = {
  id: 'fld_status',
  name: 'Status',
  type: 'single_select',
  options: [
    { id: 'opt_todo', name: 'Todo', color: 'gray' },
    { id: 'opt_prog', name: 'In progress', color: 'blue' },
    { id: 'opt_done', name: 'Done', color: 'green' },
  ],
};
const FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
  { id: 'fld_notes', name: 'Notes', type: 'long_text' },
  STATUS,
  { id: 'fld_done', name: 'Done?', type: 'checkbox' },
];

/** Status per row: Todo, In progress, Todo, Done, (empty), In progress, Todo, Done. */
const PLAN: Array<string | null> = ['opt_todo', 'opt_prog', 'opt_todo', 'opt_done', null, 'opt_prog', 'opt_todo', 'opt_done'];

function rows(plan: Array<string | null> = PLAN): Row[] {
  return plan.map((status, i) => ({
    id: `row_${i}`,
    rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    values: { fld_name: `Task ${i + 1}`, ...(status ? { fld_status: status } : {}) } as Row['values'],
    sync: null,
  }));
}

// ---------------------------------------------------------------------------------------------
describe('SAD-81 grouping helpers', () => {
  it('groups in order of first occurrence, with the empty group where it first appears', () => {
    const g = groupRows(rows(), STATUS);
    expect(g.groups.map((x) => x.label)).toEqual(['Todo', 'In progress', 'Done', EMPTY_GROUP_LABEL]);
    expect(g.groups.map((x) => x.count)).toEqual([3, 2, 2, 1]);
    expect(g.groups.map((x) => x.key)).toEqual(['opt_todo', 'opt_prog', 'opt_done', '']);
    // Rows are regrouped contiguously: Todo rows first, in their sorted order.
    expect(g.rows.map((r) => r.id)).toEqual(['row_0', 'row_2', 'row_6', 'row_1', 'row_5', 'row_3', 'row_7', 'row_4']);
  });

  it('select groups carry the option colour (chip); the empty group is text-only', () => {
    const g = groupRows(rows(), STATUS);
    expect(g.groups.map((x) => x.color)).toEqual(['gray', 'blue', 'green', null]);
  });

  it('row numbers run on across groups; rowStart indexes the grouped rows', () => {
    const g = groupRows(rows(), STATUS);
    expect(g.groups.map((x) => x.firstNumber)).toEqual([1, 4, 6, 8]);
    expect(g.groups.map((x) => x.rowStart)).toEqual([0, 3, 5, 7]);
  });

  it('a collapsed group keeps header and count, drops its rows, and its numbers are skipped', () => {
    const g = groupRows(rows(), STATUS, ['opt_prog']);
    expect(g.groups[1]).toMatchObject({ key: 'opt_prog', collapsed: true, count: 2, firstNumber: 4, rowStart: 3 });
    expect(g.rows).toHaveLength(6);
    expect(g.rows.map((r) => r.id)).not.toContain('row_1');
    // Done still numbers from 6 and starts right after Todo in the grouped rows.
    expect(g.groups[2]).toMatchObject({ firstNumber: 6, rowStart: 3, collapsed: false });
  });

  it('a key for a deleted option still groups and shows its raw value', () => {
    const g = groupRows(rows(['opt_gone', 'opt_todo']), STATUS);
    expect(g.groups[0]).toMatchObject({ key: 'opt_gone', label: 'opt_gone', color: null });
  });

  it('checkbox groups are true / false (never empty), keyed by raw value', () => {
    const field = FIELDS[3];
    expect(groupKeyOf(true, field)).toBe('true');
    expect(groupKeyOf(undefined, field)).toBe('false');
    expect(groupKeyOf(null as unknown as CellValue, field)).toBe('false');
  });

  it('text groups use the stored string; empty text joins the empty group', () => {
    const field = FIELDS[0];
    expect(groupKeyOf('A', field)).toBe('A');
    expect(groupKeyOf(null as unknown as CellValue, field)).toBe('');
  });

  it('only prototype-groupable types are offered', () => {
    expect(FIELDS.map(isGroupable)).toEqual([true, false, true, true]);
  });

  it('toggleCollapsed adds then removes a key without mutating its input', () => {
    const start = ['a'];
    const added = toggleCollapsed(start, 'b');
    expect(added).toEqual(['a', 'b']);
    expect(start).toEqual(['a']);
    expect(toggleCollapsed(added, 'a')).toEqual(['b']);
    expect(toggleCollapsed(undefined, '')).toEqual(['']);
  });
});

// ---------------------------------------------------------------------------------------------
describe('SAD-81 view helpers (columns.ts)', () => {
  const base = (): ViewDefinition => createDefaultView(FIELDS);

  it('setGroupBy sets a groupable field and drops collapsedGroups; null clears', () => {
    const v = setGroupBy({ ...base(), collapsedGroups: ['x'] }, 'fld_status', FIELDS);
    expect(v.groupBy).toBe('fld_status');
    expect(v.collapsedGroups).toBeUndefined();
    expect(setGroupBy(v, null, FIELDS).groupBy).toBeNull();
  });

  it('setGroupBy refuses unknown and non-groupable fields (view unchanged)', () => {
    const v = base();
    expect(setGroupBy(v, 'fld_nope', FIELDS)).toBe(v);
    expect(setGroupBy(v, 'fld_notes', FIELDS)).toBe(v);
  });

  it('setSort keeps order and directions; unknown fields are refused', () => {
    const v = setSort(base(), [{ fieldId: 'fld_status', direction: 'desc' }, { fieldId: 'fld_name', direction: 'asc' }], FIELDS);
    expect(v.sort).toEqual([{ fieldId: 'fld_status', direction: 'desc' }, { fieldId: 'fld_name', direction: 'asc' }]);
    const before = base();
    expect(setSort(before, [{ fieldId: 'fld_nope', direction: 'asc' }], FIELDS)).toBe(before);
  });

  it('hideField hides a non-primary field and refuses the primary', () => {
    const v = base();
    expect(hideField(v, 'fld_notes', FIELDS).hidden).toEqual(['fld_notes']);
    expect(hideField(v, 'fld_name', FIELDS)).toBe(v);
  });
});

// ---------------------------------------------------------------------------------------------
describe('SAD-81 GridView grouped layout', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mount(collapsed: string[] = [], extra: Partial<GridOptions> = {}, plan = PLAN): GridView {
    const g = groupRows(rows(plan), STATUS, collapsed);
    const view = { ...createDefaultView(FIELDS), groupBy: 'fld_status' };
    const grid = new GridView({
      rows: g.rows,
      fields: FIELDS,
      view,
      theme: 'dark',
      viewportHeight: 2000,
      viewportWidth: 900,
      groups: g.groups,
      ...extra,
    });
    document.body.appendChild(grid.root);
    return grid;
  }
  const headers = (g: GridView) => Array.from(g.root.querySelectorAll<HTMLElement>('.tablify__group-row'));
  const dataRows = (g: GridView) => Array.from(g.root.querySelectorAll<HTMLElement>('.tablify__row[data-row-id]'));

  it('draws one header per group: chip for options, text for (empty), count, chevron', () => {
    const grid = mount();
    const hs = headers(grid);
    expect(hs).toHaveLength(4);
    expect(hs[0].querySelector('.tablify__group-chip')?.textContent).toBe('Todo');
    expect(hs[0].querySelector('.tablify__group-count')?.textContent).toBe('3');
    expect(hs[3].querySelector('.tablify__group-chip')).toBeNull();
    expect(hs[3].querySelector('.tablify__group-label')?.textContent).toBe(EMPTY_GROUP_LABEL);
    expect(hs[0].querySelector('.tablify__group-chevron svg')).not.toBeNull();
  });

  it('chip paint comes from optionChipColors for the grid theme', () => {
    const grid = mount();
    const chip = headers(grid)[1].querySelector<HTMLElement>('.tablify__group-chip');
    const want = optionChipColors('blue', 'dark');
    // jsdom normalises hex to rgb(); compare against the same normalisation.
    const probe = document.createElement('span');
    probe.style.color = want.text;
    expect(chip?.style.color).toBe(probe.style.color);
    expect(chip?.style.background).toContain(want.background.replace(/\s/g, '').replace('rgba(', '').split(',')[0]);
  });

  it('header rows are not data rows: no cells, no row id, so selection and drag ignore them', () => {
    const grid = mount();
    for (const h of headers(grid)) {
      expect(h.querySelector('.tablify__cell')).toBeNull();
      expect(h.dataset.rowId).toBeUndefined();
    }
  });

  it('ARIA: aria-rowcount counts headers + rows + the header row; headers span every column', () => {
    const grid = mount();
    const table = grid.root.querySelector('[role="grid"]') ?? grid.root;
    expect(table.getAttribute('aria-rowcount')).toBe(String(4 + 8 + 1));
    const cell = headers(grid)[0].querySelector('[role="gridcell"]');
    expect(Number(cell?.getAttribute('aria-colspan'))).toBeGreaterThanOrEqual(FIELDS.length);
    const toggle = headers(grid)[0].querySelector('button.tablify__group-toggle');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
  });

  it('row numbers use firstNumber and run across groups', () => {
    const grid = mount();
    const nums = dataRows(grid).map((r) => r.querySelector('.tablify__lead--num')?.textContent?.replace(/\D/g, ''));
    expect(nums).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('collapsed: header stays with aria-expanded=false and a right chevron; its rows are gone', () => {
    const grid = mount(['opt_prog']);
    expect(headers(grid)).toHaveLength(4);
    const prog = headers(grid)[1].querySelector('button.tablify__group-toggle');
    expect(prog?.getAttribute('aria-expanded')).toBe('false');
    expect(prog?.getAttribute('title')).toBe('Expand group');
    expect(dataRows(grid)).toHaveLength(6);
    const nums = dataRows(grid).map((r) => r.querySelector('.tablify__lead--num')?.textContent?.replace(/\D/g, ''));
    expect(nums).toEqual(['1', '2', '3', '6', '7', '8']);
  });

  it('clicking a header calls onToggleGroup with the raw key and does not select a cell', () => {
    const onToggleGroup = vi.fn();
    const onSelect = vi.fn();
    const grid = mount([], { onToggleGroup, onSelectionChange: onSelect } as Partial<GridOptions>);
    headers(grid)[3].querySelector<HTMLButtonElement>('button.tablify__group-toggle')?.click();
    expect(onToggleGroup).toHaveBeenCalledWith('');
    headers(grid)[0].querySelector<HTMLButtonElement>('button.tablify__group-toggle')?.click();
    expect(onToggleGroup).toHaveBeenLastCalledWith('opt_todo');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Enter on a header button does not reach the grid editor shortcut', () => {
    const grid = mount();
    const btn = headers(grid)[0].querySelector<HTMLButtonElement>('button.tablify__group-toggle');
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const parentSpy = vi.fn();
    grid.root.addEventListener('keydown', parentSpy);
    btn?.dispatchEvent(ev);
    expect(parentSpy).not.toHaveBeenCalled();
  });

  it('windowing: a long grouped grid renders only the visible window, positioned by layout', () => {
    const many = Array.from({ length: 400 }, (_, i) => (i % 3 === 0 ? 'opt_todo' : i % 3 === 1 ? 'opt_prog' : 'opt_done'));
    const grid = mount([], { viewportHeight: 400 }, many);
    const rendered = dataRows(grid).length + headers(grid).length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(60);
  });

  it('setModel(..., null) returns to the flat grid with no headers', () => {
    const grid = mount();
    grid.setModel(rows(), FIELDS, createDefaultView(FIELDS), null);
    expect(headers(grid)).toHaveLength(0);
    expect(dataRows(grid)).toHaveLength(8);
    const table = grid.root.querySelector('[role="grid"]') ?? grid.root;
    expect(table.getAttribute('aria-rowcount')).toBe(String(8 + 1));
  });

  it('axe: no critical or serious violations with group headers (one collapsed)', async () => {
    const grid = mount(['opt_prog'], { onToggleGroup: vi.fn() });
    const results = await axe.run(grid.root, {
      rules: Object.fromEntries(
        ['region', 'landmark-one-main', 'page-has-heading-one', 'bypass', 'html-has-lang', 'color-contrast'].map((r) => [
          r,
          { enabled: false },
        ]),
      ),
    } as unknown as Parameters<typeof axe.run>[1]);
    const bad = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(bad.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  it('flat grid (no groups option) is unchanged: no header rows at all', () => {
    const grid = new GridView({
      rows: rows(),
      fields: FIELDS,
      view: createDefaultView(FIELDS),
      theme: 'dark',
      viewportHeight: 2000,
      viewportWidth: 900,
    });
    document.body.appendChild(grid.root);
    expect(grid.root.querySelector('.tablify__group-row')).toBeNull();
    expect(grid.root.querySelectorAll('.tablify__row[data-row-id]')).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------------------------
describe('SAD-81 TableView wiring', () => {
  function file(view: Partial<ViewDefinition> = {}): string {
    return JSON.stringify({
      formatVersion: 1,
      tableId: 'tbl_t',
      name: 'T',
      fields: FIELDS,
      rows: rows(),
      views: [
        {
          id: 'view_1',
          name: 'Default',
          sort: [],
          groupBy: null,
          hidden: [],
          frozenColumns: 1,
          rowHeight: 'medium',
          columnWidths: {},
          columnOrder: FIELDS.map((f) => f.id),
          warnings: [],
          ...view,
        },
      ],
      syncLink: null,
    });
  }

  async function open(data = file()): Promise<TableView> {
    const view = new TableView(new WorkspaceLeaf() as never);
    await view.onOpen();
    document.body.appendChild(view.contentEl);
    view.setViewData(data, false);
    return view;
  }
  const q = <T extends HTMLElement>(v: TableView, sel: string) => v.contentEl.querySelector<T>(sel);
  const saved = (v: TableView) => (JSON.parse(v.getViewData()).views[0] as ViewDefinition);
  const headers = (v: TableView) => Array.from(v.contentEl.querySelectorAll<HTMLElement>('.tablify__group-row'));
  const openOptions = (v: TableView) => q<HTMLButtonElement>(v, 'button[data-action="options"]')?.click();
  const select = (v: TableView, option: string, value: string) => {
    const el = q<HTMLSelectElement>(v, `select[data-option="${option}"]`);
    if (!el) throw new Error(`no select ${option}`);
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  beforeEach(() => {
    Notice.messages = [];
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Group by (panel select) groups the grid and persists groupBy', async () => {
    const v = await open();
    openOptions(v);
    select(v, 'group-by', 'fld_status');
    expect(saved(v).groupBy).toBe('fld_status');
    expect(headers(v)).toHaveLength(4);
  });

  it('Group by offers only groupable fields, plus None', async () => {
    const v = await open();
    openOptions(v);
    const opts = Array.from(v.contentEl.querySelectorAll<HTMLOptionElement>('select[data-option="group-by"] option')).map((o) => o.textContent);
    expect(opts).toEqual(['None', 'Name', 'Status', 'Done?']);
  });

  it('a stored groupBy opens grouped; Group by None returns to the flat grid', async () => {
    const v = await open(file({ groupBy: 'fld_status' }));
    expect(headers(v)).toHaveLength(4);
    openOptions(v);
    select(v, 'group-by', '');
    expect(saved(v).groupBy).toBeNull();
    expect(headers(v)).toHaveLength(0);
  });

  it('clicking a header collapses it and persists collapsedGroups; again expands and omits it', async () => {
    const v = await open(file({ groupBy: 'fld_status' }));
    headers(v)[1].querySelector<HTMLButtonElement>('button.tablify__group-toggle')?.click();
    expect(saved(v).collapsedGroups).toEqual(['opt_prog']);
    expect(v.contentEl.querySelectorAll('.tablify__row[data-row-id]')).toHaveLength(6);
    headers(v)[1].querySelector<HTMLButtonElement>('button.tablify__group-toggle')?.click();
    expect(saved(v).collapsedGroups).toBeUndefined();
    expect(v.contentEl.querySelectorAll('.tablify__row[data-row-id]')).toHaveLength(8);
  });

  it('a stored collapsedGroups opens collapsed; changing groupBy clears it', async () => {
    const v = await open(file({ groupBy: 'fld_status', collapsedGroups: ['opt_todo'] }));
    expect(v.contentEl.querySelectorAll('.tablify__row[data-row-id]')).toHaveLength(5);
    openOptions(v);
    select(v, 'group-by', 'fld_done');
    expect(saved(v).groupBy).toBe('fld_done');
    expect(saved(v).collapsedGroups).toBeUndefined();
  });

  it('Add sort, reverse and remove drive view.sort through the panel', async () => {
    const v = await open();
    openOptions(v);
    select(v, 'add-sort', 'fld_name');
    expect(saved(v).sort).toEqual([{ fieldId: 'fld_name', direction: 'asc' }]);
    q<HTMLButtonElement>(v, 'button[data-sort-dir="0"]')?.click();
    expect(saved(v).sort).toEqual([{ fieldId: 'fld_name', direction: 'desc' }]);
    const firstName = v.contentEl.querySelector('.tablify__row[data-row-index="0"] [data-field-id="fld_name"]')?.textContent;
    expect(firstName).toContain('Task 8');
    q<HTMLButtonElement>(v, 'button[data-sort-remove="0"]')?.click();
    expect(saved(v).sort).toEqual([]);
  });

  it('Hide / Show in the Fields list round-trips view.hidden; the primary Hide is disabled', async () => {
    const v = await open();
    openOptions(v);
    expect(q<HTMLButtonElement>(v, 'button[data-hide-field="fld_name"]')?.disabled).toBe(true);
    q<HTMLButtonElement>(v, 'button[data-hide-field="fld_notes"]')?.click();
    expect(saved(v).hidden).toEqual(['fld_notes']);
    const show = q<HTMLButtonElement>(v, 'button[data-show-field="fld_notes"]');
    expect(show?.textContent).toBe('Show');
    expect(show?.closest('.tablify__field-row')?.classList.contains('is-hidden')).toBe(true);
    show?.click();
    expect(saved(v).hidden).toEqual([]);
  });

  it('Clear search & filters empties the search and shows the prototype notice', async () => {
    const v = await open();
    const search = q<HTMLInputElement>(v, 'input.tablify__search-input');
    if (search) {
      search.value = 'Task 1';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    openOptions(v);
    q<HTMLButtonElement>(v, 'button.tablify__option-clear')?.click();
    expect(q<HTMLInputElement>(v, 'input.tablify__search-input')?.value).toBe('');
    expect(Notice.messages).toContain('Search & filters cleared');
  });

  it('the panel keeps focus on the control that re-rendered it (keyboard users)', async () => {
    const v = await open();
    openOptions(v);
    const btn = q<HTMLButtonElement>(v, 'button[data-hide-field="fld_notes"]');
    btn?.focus();
    btn?.click();
    expect((document.activeElement as HTMLElement | null)?.dataset.focusKey).toBe('field-fld_notes');
  });
});

// ---------------------------------------------------------------------------------------------
describe('SAD-81 collapsedGroups format', () => {
  const view = (extra: Record<string, unknown>) => ({ ...createDefaultView(FIELDS), groupBy: 'fld_status', ...extra });

  it('round-trips through serialize / parse', () => {
    const text = JSON.stringify({
      formatVersion: 1,
      tableId: 'tbl_t',
      name: 'T',
      fields: FIELDS,
      rows: [],
      views: [view({ collapsedGroups: ['opt_todo', ''] })],
      syncLink: null,
    });
    const first = parse(text);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.views[0].collapsedGroups).toEqual(['opt_todo', '']);
    const again = parse(serialize(first.data));
    expect(again.ok && again.data.views[0].collapsedGroups).toEqual(['opt_todo', '']);
  });

  it('is omitted when absent (existing files unchanged)', () => {
    const text = JSON.stringify({
      formatVersion: 1,
      tableId: 'tbl_t',
      name: 'T',
      fields: FIELDS,
      rows: [],
      views: [view({})],
      syncLink: null,
    });
    const r = parse(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect('collapsedGroups' in r.data.views[0]).toBe(false);
    expect(serialize(r.data)).not.toContain('collapsedGroups');
  });

  it('validate keeps string entries and drops the rest with a warning', () => {
    const res = validateView(view({ collapsedGroups: ['a', 3, null, 'b'] }) as ViewDefinition, FIELDS);
    expect(res.view.collapsedGroups).toEqual(['a', 'b']);
    expect(res.warnings.join(' ')).toMatch(/collapsedGroups/);
  });

  it('a non-array value is dropped with a warning', () => {
    const res = normalizeView(view({ collapsedGroups: 'opt_todo' }), FIELDS);
    expect(res.view.collapsedGroups).toBeUndefined();
    expect(res.warnings.join(' ')).toMatch(/collapsedGroups/);
  });
});

// ---------------------------------------------------------------------------------------------
describe('SAD-81 contrast', () => {
  it('ink on the accent fill (active pills, Show) meets AA 4.5:1 in both themes', () => {
    expect(contrastRatio(lightTheme.onAccent, lightTheme.accentFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkTheme.onAccent, darkTheme.accentFill)).toBeGreaterThanOrEqual(4.5);
  });

  it('the switch (on) is a 3:1 non-text control against the panel in both themes', () => {
    expect(contrastRatio(lightTheme.accentFill, lightTheme.bgPill)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(darkTheme.accentFill, darkTheme.bgPill)).toBeGreaterThanOrEqual(3);
  });

  it('option chip text meets AA on its tinted fill over the grid surface, every colour, both themes', () => {
    const colors = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
    const blend = (rgba: string, under: string): string => {
      const [r, g, b, a] = rgba.replace(/rgba\(|\)/g, '').split(',').map((s) => Number(s.trim()));
      const n = parseInt(under.slice(1), 16);
      const mix = (c: number, u: number) => Math.round(c * a + u * (1 - a));
      const hex = (x: number) => x.toString(16).padStart(2, '0');
      return `#${hex(mix(r, (n >> 16) & 255))}${hex(mix(g, (n >> 8) & 255))}${hex(mix(b, n & 255))}`;
    };
    for (const [name, theme] of [['light', lightTheme], ['dark', darkTheme]] as const) {
      for (const c of colors) {
        const chip = optionChipColors(c, name);
        const ratio = contrastRatio(chip.text, blend(chip.background, theme.bgInner));
        expect(ratio, `${name} ${c}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
