/**
 * @vitest-environment jsdom
 *
 * SAD-79 — prototype grid geometry and header capsules.
 *
 * Covers: fill-mode widths (prototype `table-layout: fixed; width: 100%`), the header capsule
 * (grip, key, sortable name, sort arrow + index, type badge, ⋮, resize handle), the leading
 * checkbox / `#` slots, the pure sort-cycle and drop helpers, and the TableView wiring through
 * undoable setView() calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkspaceLeaf, Menu } from 'obsidian';
import {
  GridView,
  fillWidths,
  LEAD_CHECK_WIDTH,
  LEAD_NUM_WIDTH,
  COLUMN_GAP,
  RESIZE_MIN_WIDTH,
  RESIZE_MAX_WIDTH,
  type GridOptions,
} from '../../../src/views/grid/GridView.js';
import { cycleHeaderSort, moveColumnOnto } from '../../../src/views/grid/columns.js';
import { typeIcon, typeLabel } from '../../../src/views/grid/fieldTypeBadge.js';
import { TableView } from '../../../src/views/tableView.js';
import { createDefaultView } from '../../../src/model/view.js';
import type { FieldDefinition, Row, ViewDefinition } from '../../../src/model/types.js';

const FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
  { id: 'fld_status', name: 'Status', type: 'single_select', options: [] },
  { id: 'fld_due', name: 'Due date', type: 'date' },
];

function rows(n: number, values: (i: number) => Record<string, unknown> = () => ({})): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `row_${i}`,
    rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    values: values(i) as Row['values'],
    sync: null,
  }));
}

function mount(extra: Partial<GridOptions> = {}, view?: ViewDefinition, r: Row[] = rows(3)): GridView {
  const grid = new GridView({
    rows: r,
    fields: FIELDS,
    view: view ?? createDefaultView(FIELDS),
    theme: 'dark',
    viewportHeight: 600,
    viewportWidth: 800,
    ...extra,
  });
  document.body.appendChild(grid.root);
  return grid;
}

const headerCells = (g: GridView) => Array.from(g.header.querySelectorAll<HTMLElement>('.tablify__header-cell'));

function pointer(type: string, init: { clientX?: number; clientY?: number; shiftKey?: boolean } = {}): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('SAD-79 fill mode (prototype table-layout: fixed; width: 100%)', () => {
  it('keeps natural widths when the shell width is unknown or too narrow', () => {
    const natural = [32, 40, 160, 160];
    expect(fillWidths(natural, 0)).toEqual(natural);
    expect(fillWidths(natural, 300)).toEqual(natural);
    // Exactly the natural line width (sum + 5 gaps) is not a fill either.
    expect(fillWidths(natural, 392 + 5 * COLUMN_GAP)).toEqual(natural);
  });

  it('scales every slot by one factor — matching the measured prototype owner viewport', () => {
    // New-table fixture at the owner viewport: 5 fields, shell content box 1436px. The
    // prototype measured th widths 50.9 / 63.7 / 254.7 ×5 (tests/visual, SAD-79 evidence).
    const out = fillWidths([32, 40, 160, 160, 160, 160, 160], 1436);
    expect(out[0]).toBeCloseTo(50.9, 1);
    expect(out[1]).toBeCloseTo(63.7, 1);
    for (const w of out.slice(2)) expect(w).toBeCloseTo(254.7, 1);
    // Floored, so the line never exceeds the shell and never adds a horizontal scrollbar.
    const line = out.reduce((a, b) => a + b, 0) + COLUMN_GAP * (out.length + 1);
    expect(line).toBeLessThanOrEqual(1436);
    expect(line).toBeGreaterThan(1435.9);
  });
});

describe('SAD-79 header capsule markup', () => {
  it('renders grip, key (primary only), name button, badge and ⋮ — textContent stays the name', () => {
    const grid = mount({ onSortClick: vi.fn(), onHeaderMenu: vi.fn(), onColumnResize: vi.fn(), onColumnMove: vi.fn() });
    const [name, status] = headerCells(grid);
    expect(name.querySelector('.tablify__hc-grip svg')).not.toBeNull();
    expect(name.querySelector('.tablify__hc-key svg')).not.toBeNull();
    expect(status.querySelector('.tablify__hc-key')).toBeNull();
    const btn = name.querySelector<HTMLButtonElement>('button.tablify__hc-name');
    expect(btn?.textContent).toBe('Name');
    expect(btn?.type).toBe('button');
    expect(status.querySelector('.tablify__hc-badge')?.getAttribute('data-type')).toBe('single_select');
    expect(status.querySelector<HTMLElement>('.tablify__hc-badge')?.title).toBe('Single select');
    const menu = name.querySelector<HTMLButtonElement>('button.tablify__hc-menu');
    expect(menu?.getAttribute('aria-label')).toBe('Field menu: Name');
    expect(name.querySelector('.tablify__hc-resize')).not.toBeNull();
    // Existing contract: header textContent / labels are exactly the field names.
    expect(headerCells(grid).map((c) => c.textContent)).toEqual(['Name', 'Status', 'Due date']);
    expect(grid.getHeaderLabels()).toEqual(['Name', 'Status', 'Due date']);
    expect(name.getAttribute('aria-label')).toBe('Name');
    grid.destroy();
  });

  it('renders no dead controls when the host wires none (embeds)', () => {
    const grid = mount();
    const [name] = headerCells(grid);
    expect(name.querySelector('button')).toBeNull();
    expect(name.querySelector('.tablify__hc-grip')).toBeNull();
    expect(name.querySelector('.tablify__hc-resize')).toBeNull();
    expect(name.querySelector('.tablify__hc-name--static')?.textContent).toBe('Name');
    expect(grid.insertWrap).toBeNull();
    expect(grid.root.querySelector('[data-testid="tablify-insert-row"]')).toBeNull();
    grid.destroy();
  });

  it('shows the sort arrow, with the key index only for multi-key sorts', () => {
    const single = mount({}, { ...createDefaultView(FIELDS), sort: [{ fieldId: 'fld_status', direction: 'desc' }] });
    expect(headerCells(single)[1].querySelector('.tablify__hc-sort')?.getAttribute('data-sort')).toBe('▼');
    expect(headerCells(single)[0].querySelector('.tablify__hc-sort')).toBeNull();
    single.destroy();
    const multi = mount({}, {
      ...createDefaultView(FIELDS),
      sort: [
        { fieldId: 'fld_due', direction: 'asc' },
        { fieldId: 'fld_name', direction: 'desc' },
      ],
    });
    const cells = headerCells(multi);
    expect(cells[2].querySelector('.tablify__hc-sort')?.getAttribute('data-sort')).toBe('▲1');
    expect(cells[0].querySelector('.tablify__hc-sort')?.getAttribute('data-sort')).toBe('▼2');
    multi.destroy();
  });

  it('maps every field type to a prototype badge icon and label', () => {
    expect(typeIcon('text')).toBe('font');
    expect(typeIcon('attachment')).toBe('paperclip');
    expect(typeIcon('auto_number')).toBe('arrow-down-1-9');
    expect(typeIcon('nonsense')).toBe('font');
    expect(typeLabel('long_text')).toBe('Long text');
    expect(typeLabel('modified_time')).toBe('Last modified');
  });
});

describe('SAD-79 header interactions', () => {
  it('name click sorts (Shift = additive) without selecting a cell', () => {
    const onSortClick = vi.fn();
    const onCellClick = vi.fn();
    const grid = mount({ onSortClick, onCellClick });
    const btn = headerCells(grid)[1].querySelector<HTMLElement>('.tablify__hc-name');
    btn?.dispatchEvent(pointer('click'));
    btn?.dispatchEvent(pointer('click', { shiftKey: true }));
    expect(onSortClick.mock.calls).toEqual([
      [1, false],
      [1, true],
    ]);
    expect(onCellClick).not.toHaveBeenCalled();
    expect(grid.getSelection()).toBeNull();
    grid.destroy();
  });

  it('⋮ opens the header menu for its column, anchored under the button', () => {
    const onHeaderMenu = vi.fn();
    const grid = mount({ onHeaderMenu });
    headerCells(grid)[2].querySelector<HTMLElement>('.tablify__hc-menu')?.click();
    expect(onHeaderMenu).toHaveBeenCalledWith(2, { x: expect.any(Number), y: expect.any(Number) });
    grid.destroy();
  });

  it('keeps Enter on a header button away from the grid keyboard handler', () => {
    const grid = mount({ onSortClick: vi.fn() });
    const onRootKey = vi.fn();
    grid.root.addEventListener('keydown', onRootKey);
    headerCells(grid)[0]
      .querySelector('.tablify__hc-name')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onRootKey).not.toHaveBeenCalled();
    // Keys on the grid itself still reach it.
    grid.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(onRootKey).toHaveBeenCalledTimes(1);
    grid.destroy();
  });

  it('resize previews live and commits one clamped width on release', () => {
    const onColumnResize = vi.fn();
    const grid = mount({ onColumnResize });
    const handle = headerCells(grid)[1].querySelector<HTMLElement>('.tablify__hc-resize');
    handle?.dispatchEvent(pointer('pointerdown', { clientX: 100 }));
    handle?.dispatchEvent(pointer('pointermove', { clientX: 150 }));
    // Live: header and body cells of that column follow the drag before anything is saved.
    expect(headerCells(grid)[1].style.width).toBe('210px');
    const bodyCell = grid.content.querySelector<HTMLElement>('.tablify__row .tablify__cell[data-col-index="1"]');
    expect(bodyCell?.style.width).toBe('210px');
    expect(onColumnResize).not.toHaveBeenCalled();
    handle?.dispatchEvent(pointer('pointermove', { clientX: 2000 }));
    handle?.dispatchEvent(pointer('pointerup', { clientX: 2000 }));
    expect(onColumnResize).toHaveBeenCalledTimes(1);
    expect(onColumnResize).toHaveBeenCalledWith('fld_status', RESIZE_MAX_WIDTH);
    grid.destroy();
  });

  it('clamps resizes at the prototype minimum, and a cancelled drag commits nothing', () => {
    const onColumnResize = vi.fn();
    const grid = mount({ onColumnResize });
    const handle = headerCells(grid)[0].querySelector<HTMLElement>('.tablify__hc-resize');
    handle?.dispatchEvent(pointer('pointerdown', { clientX: 500 }));
    handle?.dispatchEvent(pointer('pointermove', { clientX: 0 }));
    expect(headerCells(grid)[0].style.width).toBe(`${RESIZE_MIN_WIDTH}px`);
    handle?.dispatchEvent(pointer('pointercancel', { clientX: 0 }));
    expect(onColumnResize).not.toHaveBeenCalled();
    expect(headerCells(grid)[0].style.width).toBe('160px');
    grid.destroy();
  });

  it('grip drag moves a column onto the header under the pointer', () => {
    const onColumnMove = vi.fn();
    const grid = mount({ onColumnMove });
    const cells = headerCells(grid);
    const original = document.elementFromPoint;
    document.elementFromPoint = () => cells[2].querySelector('.tablify__hc-badge');
    try {
      const grip = cells[0].querySelector<HTMLElement>('.tablify__hc-grip');
      grip?.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }));
      grip?.dispatchEvent(pointer('pointermove', { clientX: 300, clientY: 12 }));
      expect(cells[2].classList.contains('tablify__header-cell--drop-target')).toBe(true);
      expect(cells[0].classList.contains('tablify__header-cell--dragging')).toBe(true);
      grip?.dispatchEvent(pointer('pointerup', { clientX: 300, clientY: 12 }));
    } finally {
      document.elementFromPoint = original;
    }
    expect(onColumnMove).toHaveBeenCalledWith('fld_name', 'fld_due');
    expect(cells[2].classList.contains('tablify__header-cell--drop-target')).toBe(false);
    grid.destroy();
  });

  it('a grip press without travel is not a drag', () => {
    const onColumnMove = vi.fn();
    const grid = mount({ onColumnMove });
    const grip = headerCells(grid)[0].querySelector<HTMLElement>('.tablify__hc-grip');
    grip?.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }));
    grip?.dispatchEvent(pointer('pointermove', { clientX: 12, clientY: 11 }));
    grip?.dispatchEvent(pointer('pointerup', { clientX: 12, clientY: 11 }));
    expect(onColumnMove).not.toHaveBeenCalled();
    grid.destroy();
  });
});

describe('SAD-79 lead slots and body capsules', () => {
  it('renders the checkbox and # slots: header "#", row numbers, hidden from the grid semantics', () => {
    const grid = mount();
    const leads = Array.from(grid.header.querySelectorAll<HTMLElement>('.tablify__lead'));
    expect(leads.map((l) => l.textContent)).toEqual(['', '#']);
    const nums = Array.from(grid.content.querySelectorAll<HTMLElement>('.tablify__lead--num')).map((l) => l.textContent);
    expect(nums).toEqual(['1', '2', '3']);
    for (const l of grid.root.querySelectorAll('.tablify__lead')) expect(l.getAttribute('aria-hidden')).toBe('true');
    // Row selection is SAD-80: no inert checkbox control ships before it works.
    expect(grid.root.querySelector('input[type="checkbox"]')).toBeNull();
    // ARIA column count is still the field count.
    expect(grid.root.getAttribute('aria-colcount')).toBe('3');
    expect(leads[0].style.width).toBe(`${LEAD_CHECK_WIDTH}px`);
    expect(leads[1].style.width).toBe(`${LEAD_NUM_WIDTH}px`);
    grid.destroy();
  });

  it('wraps every value in a capsule; empty values keep textContent empty (dash is CSS)', () => {
    const grid = mount({}, undefined, rows(1, () => ({ fld_name: 'Alpha' })));
    const cells = Array.from(grid.content.querySelectorAll<HTMLElement>('.tablify__cell'));
    expect(cells.map((c) => c.querySelector('.tablify__capsule > .tablify__cell-text') !== null)).toEqual([true, true, true]);
    expect(cells.map((c) => c.textContent)).toEqual(['Alpha', '', '']);
    grid.destroy();
  });

  it('tags the root with the row-height key for capsule CSS', () => {
    const grid = mount({}, { ...createDefaultView(FIELDS), rowHeight: 'large' });
    expect(grid.root.classList.contains('tablify--rh-large')).toBe(true);
    grid.setModel(rows(1), FIELDS, { ...createDefaultView(FIELDS), rowHeight: 'small' });
    expect(grid.root.classList.contains('tablify--rh-small')).toBe(true);
    expect(grid.root.classList.contains('tablify--rh-large')).toBe(false);
    grid.destroy();
  });

  it('puts the Insert Row pill after the viewport inside the shell', () => {
    const onInsertRow = vi.fn();
    const grid = mount({ onInsertRow });
    const btn = grid.root.querySelector<HTMLElement>('[data-testid="tablify-insert-row"]');
    expect(btn?.textContent).toBe('Insert Row');
    expect(grid.root.lastElementChild).toBe(grid.insertWrap);
    expect(grid.viewport.nextElementSibling).toBe(grid.insertWrap);
    btn?.click();
    expect(onInsertRow).toHaveBeenCalledTimes(1);
    expect(grid.getSelection()).toBeNull();
    grid.destroy();
  });
});

describe('SAD-79 pure helpers', () => {
  const base = createDefaultView(FIELDS);

  it('cycleHeaderSort: plain click cycles asc → desc → off, and collapses a multi-sort', () => {
    const a = cycleHeaderSort({ ...base, sort: [] }, 'fld_name', false, FIELDS);
    expect(a.sort).toEqual([{ fieldId: 'fld_name', direction: 'asc' }]);
    const d = cycleHeaderSort(a, 'fld_name', false, FIELDS);
    expect(d.sort).toEqual([{ fieldId: 'fld_name', direction: 'desc' }]);
    expect(cycleHeaderSort(d, 'fld_name', false, FIELDS).sort).toEqual([]);
    const multi = {
      ...base,
      sort: [
        { fieldId: 'fld_name', direction: 'asc' as const },
        { fieldId: 'fld_due', direction: 'desc' as const },
      ],
    };
    expect(cycleHeaderSort(multi, 'fld_due', false, FIELDS).sort).toEqual([{ fieldId: 'fld_due', direction: 'asc' }]);
  });

  it('cycleHeaderSort: Shift-click appends, flips, then removes one key', () => {
    const one = { ...base, sort: [{ fieldId: 'fld_name', direction: 'asc' as const }] };
    const two = cycleHeaderSort(one, 'fld_due', true, FIELDS);
    expect(two.sort).toEqual([
      { fieldId: 'fld_name', direction: 'asc' },
      { fieldId: 'fld_due', direction: 'asc' },
    ]);
    const flipped = cycleHeaderSort(two, 'fld_due', true, FIELDS);
    expect(flipped.sort[1]).toEqual({ fieldId: 'fld_due', direction: 'desc' });
    expect(cycleHeaderSort(flipped, 'fld_due', true, FIELDS).sort).toEqual([{ fieldId: 'fld_name', direction: 'asc' }]);
  });

  it('moveColumnOnto: right lands after the target, left lands before it; hidden columns keep place', () => {
    const order = { ...base, columnOrder: ['fld_name', 'fld_status', 'fld_due'] };
    expect(moveColumnOnto(order, 'fld_name', 'fld_status', FIELDS).columnOrder).toEqual(['fld_status', 'fld_name', 'fld_due']);
    expect(moveColumnOnto(order, 'fld_due', 'fld_name', FIELDS).columnOrder).toEqual(['fld_due', 'fld_name', 'fld_status']);
    expect(moveColumnOnto(order, 'fld_due', 'fld_due', FIELDS)).toBe(order);
    expect(moveColumnOnto(order, 'fld_due', 'missing', FIELDS)).toBe(order);
  });
});

describe('SAD-79 TableView wiring (undoable, through setView)', () => {
  function file(): string {
    const mk = (id: string, name: string) => ({
      id,
      rev: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      values: { fld_name: name },
      sync: null,
    });
    return JSON.stringify({
      formatVersion: 1,
      tableId: 'tbl_t',
      name: 'T',
      fields: [
        { id: 'fld_name', name: 'Name', type: 'text', primary: true },
        { id: 'fld_notes', name: 'Notes', type: 'long_text' },
      ],
      rows: [mk('r1', 'Beta'), mk('r2', 'Alpha'), mk('r3', 'Gamma')],
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
          columnOrder: ['fld_name', 'fld_notes'],
          warnings: [],
        },
      ],
      syncLink: null,
    });
  }

  async function open(): Promise<TableView> {
    const view = new TableView(new WorkspaceLeaf() as never);
    await view.onOpen();
    document.body.appendChild(view.contentEl);
    view.setViewData(file(), false);
    return view;
  }
  const saved = (v: TableView) => JSON.parse(v.getViewData()).views[0];
  const names = (v: TableView) =>
    Array.from(v.contentEl.querySelectorAll('.tablify__row .tablify__cell[data-col-index="0"]')).map((c) => c.textContent);
  const nameBtn = (v: TableView, i: number) =>
    v.contentEl.querySelectorAll<HTMLElement>('.tablify__header-cell .tablify__hc-name')[i];
  const undo = (v: TableView) => v.contentEl.querySelector<HTMLElement>('[data-action="undo"]')?.click();

  it('header name click sorts the rows and persists, and one undo restores the order', async () => {
    const view = await open();
    expect(names(view)).toEqual(['Beta', 'Alpha', 'Gamma']);
    nameBtn(view, 0).click();
    expect(saved(view).sort).toEqual([{ fieldId: 'fld_name', direction: 'asc' }]);
    expect(names(view)).toEqual(['Alpha', 'Beta', 'Gamma']);
    nameBtn(view, 0).click();
    expect(names(view)).toEqual(['Gamma', 'Beta', 'Alpha']);
    undo(view);
    expect(saved(view).sort).toEqual([{ fieldId: 'fld_name', direction: 'asc' }]);
  });

  it('⋮ opens the existing header menu', async () => {
    const view = await open();
    const spy = vi.spyOn(Menu.prototype, 'showAtPosition').mockImplementation(() => undefined);
    view.contentEl.querySelectorAll<HTMLElement>('.tablify__hc-menu')[1].click();
    expect(spy).toHaveBeenCalledTimes(1);
    const menu = spy.mock.instances[0] as unknown as Menu | undefined;
    if (!menu) throw new Error('menu not shown');
    const titles = menu.items.flatMap((i) => (i.type === 'item' ? [i.api.title] : []));
    expect(titles).toContain('Sort ascending');
    spy.mockRestore();
  });

  it('a committed resize writes columnWidths once, undoably', async () => {
    const view = await open();
    const handle = view.contentEl.querySelectorAll<HTMLElement>('.tablify__hc-resize')[1];
    handle.dispatchEvent(pointer('pointerdown', { clientX: 100 }));
    handle.dispatchEvent(pointer('pointermove', { clientX: 140 }));
    handle.dispatchEvent(pointer('pointerup', { clientX: 140 }));
    expect(saved(view).columnWidths).toEqual({ fld_notes: 200 });
    undo(view);
    expect(saved(view).columnWidths).toEqual({});
  });

  it('a grip drop reorders columns, undoably', async () => {
    const view = await open();
    const cells = Array.from(view.contentEl.querySelectorAll<HTMLElement>('.tablify__header-cell'));
    const original = document.elementFromPoint;
    document.elementFromPoint = () => cells[1];
    try {
      const grip = cells[0].querySelector<HTMLElement>('.tablify__hc-grip');
      grip?.dispatchEvent(pointer('pointerdown', { clientX: 0, clientY: 0 }));
      grip?.dispatchEvent(pointer('pointermove', { clientX: 200, clientY: 0 }));
      grip?.dispatchEvent(pointer('pointerup', { clientX: 200, clientY: 0 }));
    } finally {
      document.elementFromPoint = original;
    }
    expect(saved(view).columnOrder).toEqual(['fld_notes', 'fld_name']);
    expect(
      Array.from(view.contentEl.querySelectorAll('.tablify__header-cell')).map((c) => c.textContent),
    ).toEqual(['Notes', 'Name']);
    undo(view);
    expect(saved(view).columnOrder).toEqual(['fld_name', 'fld_notes']);
  });
});
