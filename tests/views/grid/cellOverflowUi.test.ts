/**
 * @vitest-environment jsdom
 *
 * SAD-376 — the in-cell control and the expanded panel, on a real GridView.
 *
 * The contracts that matter, and why:
 *  - the control appears only over the limit, and never changes what the cell *is*
 *    (`cell.textContent`, the empty-cell em dash, the ellipsis box);
 *  - clicking it must not also run the cell's own click path (select, reselect, edit) — that is the
 *    single most likely way this feature could regress the grid;
 *  - the panel is read-only: no store, no write, no undo step, and it closes when the row it is
 *    anchored to is rebuilt, recycled or destroyed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GridView } from '../../../src/views/grid/GridView.js';
import {
  CellOverflowCard,
  CellOverflowPanel,
  COPY_CONFIRM_MS,
  createExpandControl,
} from '../../../src/views/grid/cellOverflowUi.js';
import {
  CARD_EXIT_GRACE_MS,
  CARD_OPEN_DELAY_MS,
  DEFAULT_OVERFLOW_CONFIG,
  type CellOverflowConfig,
} from '../../../src/views/grid/cellOverflow.js';
import { createDefaultView } from '../../../src/model/view.js';
import type { FieldDefinition, Row } from '../../../src/model/types.js';

const LONG = 'A'.repeat(200);
const SHORT = 'short value';

function fields(): FieldDefinition[] {
  return [
    { id: 'fld_name', name: 'Name', type: 'text', primary: true },
    { id: 'fld_notes', name: 'Notes', type: 'long_text' },
    { id: 'fld_status', name: 'Status', type: 'single_select', options: [{ id: 'opt_a', name: 'Alpha' }] },
  ];
}

function rows(): Row[] {
  return [
    {
      id: 'row_1',
      rev: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      values: { fld_name: LONG, fld_notes: LONG, fld_status: 'opt_a' },
      sync: null,
    },
    {
      id: 'row_2',
      rev: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      values: { fld_name: SHORT, fld_notes: SHORT, fld_status: 'opt_a' },
      sync: null,
    },
  ];
}

interface Mounted {
  grid: GridView;
  onCellClick: ReturnType<typeof vi.fn>;
  onCellReselect: ReturnType<typeof vi.fn>;
  onCellActivate: ReturnType<typeof vi.fn>;
}

function mount(overflow: CellOverflowConfig = DEFAULT_OVERFLOW_CONFIG): Mounted {
  const onCellClick = vi.fn();
  const onCellReselect = vi.fn();
  const onCellActivate = vi.fn();
  const f = fields();
  const grid = new GridView({
    rows: rows(),
    fields: f,
    view: createDefaultView(f),
    theme: 'light',
    viewportHeight: 600,
    viewportWidth: 800,
    overflow,
    onCellClick,
    onCellReselect,
    onCellActivate,
  });
  grid.root.tabIndex = 0;
  document.body.appendChild(grid.root);
  return { grid, onCellClick, onCellReselect, onCellActivate };
}

function cellAt(grid: GridView, row: number, col: number): HTMLElement {
  return grid.content.querySelector<HTMLElement>(
    `.tablify__row[data-row-index="${row}"] .tablify__cell[data-col-index="${col}"]`,
  ) as HTMLElement;
}

function controlAt(grid: GridView, row: number, col: number): HTMLButtonElement | null {
  return cellAt(grid, row, col).querySelector<HTMLButtonElement>('.tablify__cell-expand');
}

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function panel(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[data-testid="tablify-cell-overflow-panel"]');
}

function card(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[data-testid="tablify-cell-overflow-card"]');
}

/** A mouse pointer event of the kind the grid's hover wiring listens for. */
function pointer(type: 'pointerover' | 'pointerout', on: Element, related: Element | null = null): void {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  Object.defineProperty(event, 'relatedTarget', { value: related });
  on.dispatchEvent(event);
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('SAD-376 — the expand control in a cell', () => {
  it('appears only on a cell whose display text is over the limit', () => {
    const { grid } = mount();
    // 200 characters against the default 80: over — on a text and on a long-text cell alike.
    expect(controlAt(grid, 0, 0)).not.toBeNull();
    expect(controlAt(grid, 0, 1)).not.toBeNull();
    // 'short value', and the select cell's single chip label: under.
    expect(controlAt(grid, 1, 0)).toBeNull();
    expect(controlAt(grid, 1, 1)).toBeNull();
    expect(controlAt(grid, 1, 2)).toBeNull();
  });

  it('covers every field type from one rule — the select cell whose labels are long', () => {
    const f = fields();
    f[2] = {
      id: 'fld_status',
      name: 'Status',
      type: 'single_select',
      options: [{ id: 'opt_a', name: 'A'.repeat(200) }],
    };
    const grid = new GridView({
      rows: rows(),
      fields: f,
      view: createDefaultView(f),
      theme: 'light',
      viewportHeight: 600,
      viewportWidth: 800,
    });
    document.body.appendChild(grid.root);
    expect(controlAt(grid, 0, 2)).not.toBeNull();
  });

  it('never appears when the feature is off, however long the value', () => {
    const { grid } = mount({ ...DEFAULT_OVERFLOW_CONFIG, enabled: false });
    expect(grid.content.querySelector('.tablify__cell-expand')).toBeNull();
    expect(grid.root.classList.contains('tablify--overflow')).toBe(false);
  });

  it('honours a changed limit', () => {
    const { grid } = mount({ ...DEFAULT_OVERFLOW_CONFIG, maxChars: 500 });
    expect(grid.content.querySelector('.tablify__cell-expand')).toBeNull();
    grid.setOverflow({ ...DEFAULT_OVERFLOW_CONFIG, maxChars: 100 });
    expect(grid.content.querySelector('.tablify__cell-expand')).not.toBeNull();
  });

  it('leaves the cell itself exactly as it was', () => {
    const { grid } = mount();
    const cell = cellAt(grid, 0, 0);
    const text = cell.querySelector('.tablify__cell-text') as HTMLElement;
    // The value span still holds the value and nothing else: no label, no badge, no icon text.
    expect(text.textContent).toBe(LONG);
    expect(text.children.length).toBe(0);
    expect(cell.textContent).toBe(LONG);
    // The control is a sibling of the value span, never a child of it.
    expect(cell.querySelector('.tablify__cell-text .tablify__cell-expand')).toBeNull();
  });

  it('keeps an empty cell empty — the em dash is CSS, not a child', () => {
    const f = fields();
    const emptyRow: Row = {
      id: 'row_3',
      rev: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      values: { fld_name: '', fld_notes: '', fld_status: null },
      sync: null,
    };
    const grid = new GridView({
      rows: [emptyRow],
      fields: f,
      view: createDefaultView(f),
      theme: 'light',
      viewportHeight: 600,
      viewportWidth: 800,
    });
    document.body.appendChild(grid.root);
    const text = cellAt(grid, 0, 0).querySelector('.tablify__cell-text') as HTMLElement;
    expect(text.childNodes.length).toBe(0);
    expect(text.textContent).toBe('');
    expect(controlAt(grid, 0, 0)).toBeNull();
  });

  it('names the column for assistive tech and carries no tooltip', () => {
    const { grid } = mount();
    const control = controlAt(grid, 0, 0) as HTMLElement;
    expect(control.getAttribute('aria-label')).toBe('Show full content of Name');
    expect(control.getAttribute('aria-haspopup')).toBe('dialog');
    // SAD-109: never both — that shows two tooltips.
    expect(control.hasAttribute('title')).toBe(false);
  });

  it('marks the root so the stylesheet can branch without measuring cells', () => {
    const { grid } = mount();
    expect(grid.root.classList.contains('tablify--overflow')).toBe(true);
    expect(grid.root.classList.contains('tablify--overflow-touch')).toBe(true);
    grid.setOverflow({ ...DEFAULT_OVERFLOW_CONFIG, touchReveal: false });
    expect(grid.root.classList.contains('tablify--overflow-touch')).toBe(false);
  });
});

describe('SAD-376 — clicking the control', () => {
  it('opens the panel and does not also select or activate the cell', () => {
    const { grid, onCellClick, onCellReselect, onCellActivate } = mount();
    click(controlAt(grid, 0, 0) as HTMLElement);

    expect(panel()).not.toBeNull();
    // The whole point of stopping the click: the grid's own handlers never run.
    expect(onCellClick).not.toHaveBeenCalled();
    expect(onCellReselect).not.toHaveBeenCalled();
    expect(onCellActivate).not.toHaveBeenCalled();
    expect(grid.getSelection()).toBeNull();
  });

  it('shows the field name and the complete text, not the truncated prefix', () => {
    const { grid } = mount();
    click(controlAt(grid, 0, 0) as HTMLElement);
    const card = panel() as HTMLElement;
    expect(card.querySelector('.tablify__overflow-title')?.textContent).toBe('Name');
    expect(card.querySelector('.tablify__overflow-text')?.textContent).toBe(LONG);
    expect(card.getAttribute('role')).toBe('dialog');
  });

  it('opens a panel per cell, replacing the previous one', () => {
    const { grid } = mount();
    click(controlAt(grid, 0, 0) as HTMLElement);
    click(controlAt(grid, 0, 1) as HTMLElement);
    expect(document.body.querySelectorAll('[data-testid="tablify-cell-overflow-panel"]').length).toBe(1);
    expect(panel()?.querySelector('.tablify__overflow-title')?.textContent).toBe('Notes');
  });
});

describe('SAD-376 — the panel closes and collapses back', () => {
  it('closes on Escape', () => {
    const { grid } = mount();
    click(controlAt(grid, 0, 0) as HTMLElement);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel()).toBeNull();
  });

  it('closes on a press outside it', () => {
    const { grid } = mount();
    click(controlAt(grid, 0, 0) as HTMLElement);
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(panel()).toBeNull();
  });

  it('closes from its own × button', () => {
    mount();
    click(document.querySelector('.tablify__cell-expand') as HTMLElement);
    click(panel()?.querySelector('.tablify__overflow-close') as HTMLElement);
    expect(panel()).toBeNull();
  });

  it('closes when the grid re-renders, so it cannot hang over a recycled row', () => {
    const { grid } = mount();
    click(controlAt(grid, 0, 0) as HTMLElement);
    expect(panel()).not.toBeNull();
    grid.setModel(rows(), fields(), createDefaultView(fields()));
    expect(panel()).toBeNull();
  });

  it('is removed with the grid', () => {
    const { grid } = mount();
    click(controlAt(grid, 0, 0) as HTMLElement);
    grid.destroy();
    expect(panel()).toBeNull();
  });
});

describe('SAD-376 — reading and copying the content', () => {
  it('writes the full text to the clipboard and confirms it', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.useFakeTimers();

    mount();
    click(document.querySelector('.tablify__cell-expand') as HTMLElement);
    const copy = panel()?.querySelector('[data-testid="tablify-cell-overflow-copy"]') as HTMLElement;
    const label = copy.querySelector('.tablify__overflow-copy-label') as HTMLElement;

    click(copy);
    expect(writeText).toHaveBeenCalledWith(LONG);
    expect(label.textContent).toBe('Copied');
    // The panel stays open: copying is not a dismissal.
    expect(panel()).not.toBeNull();

    vi.advanceTimersByTime(COPY_CONFIRM_MS);
    expect(label.textContent).toBe('Copy content');
  });

  it('gives focus back to the grid when it closes', () => {
    const { grid } = mount();
    click(controlAt(grid, 0, 0) as HTMLElement);
    expect(document.activeElement?.classList.contains('tablify__overflow-text')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.activeElement).toBe(grid.root);
  });
});

describe('SAD-376 — the hover preview card', () => {
  it('opens only after the pointer has rested on the control', () => {
    vi.useFakeTimers();
    const { grid } = mount();
    const control = controlAt(grid, 0, 0) as HTMLElement;

    pointer('pointerover', control);
    expect(card()).toBeNull();
    vi.advanceTimersByTime(CARD_OPEN_DELAY_MS - 1);
    expect(card()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(card()).not.toBeNull();
  });

  it('shows the copy and expand tools from the reference screenshot and the full text', () => {
    vi.useFakeTimers();
    const { grid } = mount();
    pointer('pointerover', controlAt(grid, 0, 0) as HTMLElement);
    vi.advanceTimersByTime(CARD_OPEN_DELAY_MS);

    const el = card() as HTMLElement;
    expect(el.querySelector('[data-testid="tablify-cell-overflow-card-copy"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="tablify-cell-overflow-card-expand"]')).not.toBeNull();
    expect(el.querySelector('.tablify__cellcard-body')?.textContent).toBe(LONG);
    // Pointer-only furniture: no tooltip, and it is not a dialog.
    expect(el.getAttribute('role')).toBe('group');
    expect(el.hasAttribute('title')).toBe(false);
  });

  it('is never shown when the setting is off', () => {
    vi.useFakeTimers();
    const { grid } = mount({ ...DEFAULT_OVERFLOW_CONFIG, hoverCard: false });
    pointer('pointerover', controlAt(grid, 0, 0) as HTMLElement);
    vi.advanceTimersByTime(CARD_OPEN_DELAY_MS * 4);
    expect(card()).toBeNull();
  });

  it('ignores a touch press, which has no hover', () => {
    vi.useFakeTimers();
    const { grid } = mount();
    const control = controlAt(grid, 0, 0) as HTMLElement;
    const event = new MouseEvent('pointerover', { bubbles: true });
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
    control.dispatchEvent(event);
    vi.advanceTimersByTime(CARD_OPEN_DELAY_MS * 4);
    expect(card()).toBeNull();
  });

  it('survives the gap between the cell and the card, then closes', () => {
    vi.useFakeTimers();
    const { grid } = mount();
    const control = controlAt(grid, 0, 0) as HTMLElement;
    pointer('pointerover', control);
    vi.advanceTimersByTime(CARD_OPEN_DELAY_MS);
    const el = card() as HTMLElement;

    // Leaving the control towards the card starts the grace period...
    pointer('pointerout', control, el);
    vi.advanceTimersByTime(CARD_EXIT_GRACE_MS - 1);
    expect(card()).not.toBeNull();

    // ...and reaching the card cancels it.
    el.dispatchEvent(new MouseEvent('pointerenter'));
    vi.advanceTimersByTime(CARD_EXIT_GRACE_MS * 4);
    expect(card()).not.toBeNull();

    // Walking away from the card closes it after the same grace.
    el.dispatchEvent(new MouseEvent('pointerleave'));
    vi.advanceTimersByTime(CARD_EXIT_GRACE_MS);
    expect(card()).toBeNull();
  });

  it('closes when the pointer leaves the control and never reaches the card', () => {
    vi.useFakeTimers();
    const { grid } = mount();
    const control = controlAt(grid, 0, 0) as HTMLElement;
    pointer('pointerover', control);
    vi.advanceTimersByTime(CARD_OPEN_DELAY_MS);
    pointer('pointerout', control);
    vi.advanceTimersByTime(CARD_EXIT_GRACE_MS);
    expect(card()).toBeNull();
  });

  it('hands over to the panel from its expand button', () => {
    vi.useFakeTimers();
    const { grid } = mount();
    pointer('pointerover', controlAt(grid, 0, 1) as HTMLElement);
    vi.advanceTimersByTime(CARD_OPEN_DELAY_MS);
    click(card()?.querySelector('[data-testid="tablify-cell-overflow-card-expand"]') as HTMLElement);

    expect(card()).toBeNull();
    expect(panel()).not.toBeNull();
    expect(panel()?.querySelector('.tablify__overflow-title')?.textContent).toBe('Notes');
  });

  it('copies from the card without opening the panel', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.useFakeTimers();
    mount();
    pointer('pointerover', document.querySelector('.tablify__cell-expand') as HTMLElement);
    vi.advanceTimersByTime(CARD_OPEN_DELAY_MS);
    click(card()?.querySelector('[data-testid="tablify-cell-overflow-card-copy"]') as HTMLElement);

    expect(writeText).toHaveBeenCalledWith(LONG);
    expect(panel()).toBeNull();
    expect(card()).not.toBeNull();
  });

  it('disappears when the grid re-renders or is destroyed', () => {
    vi.useFakeTimers();
    const { grid } = mount();
    pointer('pointerover', controlAt(grid, 0, 0) as HTMLElement);
    vi.advanceTimersByTime(CARD_OPEN_DELAY_MS);
    expect(card()).not.toBeNull();
    grid.setModel(rows(), fields(), createDefaultView(fields()));
    expect(card()).toBeNull();

    pointer('pointerover', controlAt(grid, 0, 0) as HTMLElement);
    vi.advanceTimersByTime(CARD_OPEN_DELAY_MS);
    expect(card()).not.toBeNull();
    grid.destroy();
    expect(card()).toBeNull();
  });

  it('cannot fire a card after the grid is gone (no timer outlives it)', () => {
    vi.useFakeTimers();
    const { grid } = mount();
    pointer('pointerover', controlAt(grid, 0, 0) as HTMLElement);
    grid.destroy();
    vi.advanceTimersByTime(CARD_OPEN_DELAY_MS * 4);
    expect(card()).toBeNull();
  });

  it('opens a card for the cell under the pointer, one at a time', () => {
    vi.useFakeTimers();
    const { grid } = mount();
    pointer('pointerover', controlAt(grid, 0, 0) as HTMLElement);
    vi.advanceTimersByTime(CARD_OPEN_DELAY_MS);
    const first = card();
    pointer('pointerout', controlAt(grid, 0, 0) as HTMLElement);
    pointer('pointerover', controlAt(grid, 0, 1) as HTMLElement);
    vi.advanceTimersByTime(CARD_OPEN_DELAY_MS);

    expect(document.body.querySelectorAll('[data-testid="tablify-cell-overflow-card"]').length).toBe(1);
    expect(card()).not.toBe(first);
    expect(card()?.querySelector('.tablify__cellcard-body')?.textContent).toBe(LONG);
  });
});

describe('SAD-376 — the panel on its own', () => {
  it('leaves the document clean after close, however often it is called', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const panelInstance = new CellOverflowPanel({ text: 'hello', fieldName: 'Name', theme: 'light' });
    panelInstance.open(anchor);
    expect(panelInstance.isOpen).toBe(true);
    panelInstance.close();
    panelInstance.close();
    expect(panelInstance.isOpen).toBe(false);
    expect(document.body.querySelector('[data-testid="tablify-cell-overflow-panel"]')).toBeNull();
  });

  it('carries the theme it was built with', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const panelInstance = new CellOverflowPanel({ text: 'hello', fieldName: 'Name', theme: 'dark' });
    panelInstance.open(anchor);
    expect(panel()?.classList.contains('tablify--dark')).toBe(true);
    panelInstance.close();
  });

  it('the card closes idempotently and holds the theme it was built with', () => {
    const anchorEl = document.createElement('div');
    document.body.appendChild(anchorEl);
    const preview = new CellOverflowCard({ text: 'hello', theme: 'dark', onExpand: () => undefined });
    preview.open(anchorEl);
    expect(preview.isOpen).toBe(true);
    expect(preview.contains(document.body.querySelector('.tablify__cellcard'))).toBe(true);
    expect(document.body.querySelector('.tablify__cellcard')?.classList.contains('tablify--dark')).toBe(true);
    preview.close();
    preview.close();
    expect(preview.isOpen).toBe(false);
    expect(document.body.querySelector('.tablify__cellcard')).toBeNull();
  });

  it('builds a control with no text node and no tooltip', () => {
    const control = createExpandControl('Notes');
    expect(control.textContent).toBe('');
    expect(control.tagName).toBe('BUTTON');
    expect(control.querySelector('svg')).not.toBeNull();
    expect(control.hasAttribute('title')).toBe(false);
  });
});
