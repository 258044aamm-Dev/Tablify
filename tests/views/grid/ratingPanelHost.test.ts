/**
 * @vitest-environment jsdom
 *
 * SAD-304 — the wiring the panel's own tests cannot see: Enter on a rating cell opens the panel,
 * a click on a star in the grid writes a value, and every path is exactly one undo step or none.
 *
 * The promises that predate this change are asserted here too: opening and dismissing a cell
 * writes nothing, Escape writes nothing, and a read-only rating offers no way in at all.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { WorkspaceLeaf } from 'obsidian';
import { TableView } from '../../../src/views/tableView.js';
import { newTableText } from '../../../src/menus/fileMenuModel.js';
import type { CellValue, FieldDefinition } from '../../../src/model/types.js';

interface FileShape {
  fields: FieldDefinition[];
  rows: Array<{ id: string; rev: number; values: Record<string, CellValue> }>;
  views: Array<{ columnOrder: string[] }>;
}

const RATING_ID = 'fld_quality';
const LOCKED_ID = 'fld_locked';

/** The generated table plus a rating column (value 2) and a read-only one. */
function doc(): string {
  const parsed = JSON.parse(newTableText('Untitled table')) as unknown as FileShape;
  const rating: FieldDefinition = { id: RATING_ID, name: 'Quality', type: 'rating', max: 5 } as FieldDefinition;
  const locked: FieldDefinition = {
    id: LOCKED_ID,
    name: 'Locked',
    type: 'rating',
    airtable: { id: 'fldRemote', type: 'rating', readOnly: true },
  } as FieldDefinition;
  parsed.fields.push(rating, locked);
  parsed.views[0].columnOrder.push(RATING_ID, LOCKED_ID);
  parsed.rows[0].values[RATING_ID] = 2;
  parsed.rows[0].values[LOCKED_ID] = 3;
  return JSON.stringify(parsed);
}

async function openView(data: string): Promise<TableView> {
  const view = new TableView(new WorkspaceLeaf() as never);
  await view.onOpen();
  document.body.appendChild(view.contentEl);
  view.setViewData(data, false);
  return view;
}

function sessionOf(view: TableView): NonNullable<ReturnType<TableView['syncSession']>> {
  const session = view.syncSession();
  if (!session) throw new Error('the view has no session');
  return session;
}

function columnOf(view: TableView, fieldId: string): number {
  const index = sessionOf(view).getVisibleFields().findIndex((f) => f.id === fieldId);
  if (index < 0) throw new Error(`field ${fieldId} not visible`);
  return index;
}

function enterAt(view: TableView, col: number): void {
  const root = view.contentEl.querySelector('.tablify--grid') as HTMLElement | null;
  if (!root) throw new Error('no grid root');
  root.focus();
  for (let i = 0; i < col; i += 1) {
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  }
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

const panel = (): HTMLElement | null => document.body.querySelector('[data-testid="tablify-rating-panel"]');

function starInCell(view: TableView, col: number, k: number): HTMLElement {
  const el = view.contentEl.querySelector(
    `.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="${col}"] [data-rating-star="${k}"]`,
  ) as HTMLElement | null;
  if (!el) throw new Error(`no star ${k} in column ${col}`);
  return el;
}

function stored(view: TableView, fieldId: string): CellValue {
  const data = JSON.parse(view.getViewData()) as unknown as FileShape;
  return data.rows[0].values[fieldId] ?? null;
}

const doneButton = (): HTMLElement => panel()?.querySelector('.tablify__rating-done') as HTMLElement;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('SAD-304 — Enter opens the rating panel', () => {
  it('opens the panel instead of an inline input', async () => {
    const view = await openView(doc());
    enterAt(view, columnOf(view, RATING_ID));
    expect(view.contentEl.querySelector('input.tablify__editor')).toBeNull();
    expect(panel()).not.toBeNull();
  });

  it('the panel lives in the document, not inside the grid', async () => {
    const view = await openView(doc());
    enterAt(view, columnOf(view, RATING_ID));
    expect(view.contentEl.contains(panel())).toBe(false);
  });

  it('a keyboard change writes once and closes', async () => {
    const view = await openView(doc());
    const execute = vi.spyOn(sessionOf(view).stack, 'execute');
    enterAt(view, columnOf(view, RATING_ID));
    const slider = panel()?.querySelector('.tablify__rating-stars') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    doneButton().click();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(stored(view, RATING_ID)).toBe(5);
    expect(panel()).toBeNull();
  });

  it('the write is one undo step', async () => {
    const view = await openView(doc());
    enterAt(view, columnOf(view, RATING_ID));
    const slider = panel()?.querySelector('.tablify__rating-stars') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    doneButton().click();
    expect(stored(view, RATING_ID)).toBe(2.5);
    sessionOf(view).stack.undo();
    expect(stored(view, RATING_ID)).toBe(2);
  });

  it('Escape writes nothing', async () => {
    const view = await openView(doc());
    const execute = vi.spyOn(sessionOf(view).stack, 'execute');
    enterAt(view, columnOf(view, RATING_ID));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(execute).not.toHaveBeenCalled();
    expect(stored(view, RATING_ID)).toBe(2);
    expect(panel()).toBeNull();
  });

  it('Done without a change writes nothing', async () => {
    const view = await openView(doc());
    const execute = vi.spyOn(sessionOf(view).stack, 'execute');
    enterAt(view, columnOf(view, RATING_ID));
    doneButton().click();
    expect(execute).not.toHaveBeenCalled();
    expect(stored(view, RATING_ID)).toBe(2);
  });
});

describe('SAD-304 — a star in the cell is a one-click edit', () => {
  it('clicking the third star writes 3 and opens nothing', async () => {
    const view = await openView(doc());
    const execute = vi.spyOn(sessionOf(view).stack, 'execute');
    starInCell(view, columnOf(view, RATING_ID), 3).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(stored(view, RATING_ID)).toBe(3);
    expect(panel()).toBeNull();
  });

  it('it is one undo step', async () => {
    const view = await openView(doc());
    starInCell(view, columnOf(view, RATING_ID), 4).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    sessionOf(view).stack.undo();
    expect(stored(view, RATING_ID)).toBe(2);
  });

  it('clicking the star that already holds the value writes nothing', async () => {
    const view = await openView(doc());
    const execute = vi.spyOn(sessionOf(view).stack, 'execute');
    starInCell(view, columnOf(view, RATING_ID), 2).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(execute).not.toHaveBeenCalled();
  });

  it('hovering a star previews the value a click would write', async () => {
    const view = await openView(doc());
    const col = columnOf(view, RATING_ID);
    starInCell(view, col, 3).dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    const previewed = Array.from(
      view.contentEl.querySelectorAll(
        `.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="${col}"] .tablify__star--preview`,
      ),
    ).map((el) => (el as HTMLElement).dataset.ratingStar);
    expect(previewed).toEqual(['1', '2', '3']);
    const row = view.contentEl.querySelector(
      `.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="${col}"] .tablify__stars`,
    ) as HTMLElement;
    row.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }));
    expect(row.querySelectorAll('.tablify__star--preview')).toHaveLength(0);
  });

  it('the stars carry the value they stand for', async () => {
    const view = await openView(doc());
    const col = columnOf(view, RATING_ID);
    const values = Array.from(
      view.contentEl.querySelectorAll(`.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="${col}"] [data-rating-star]`),
    ).map((el) => (el as HTMLElement).dataset.ratingStar);
    expect(values).toEqual(['1', '2', '3', '4', '5']);
  });
});

describe('SAD-304 — a read-only rating offers no way in', () => {
  it('draws no clickable stars', async () => {
    const view = await openView(doc());
    const col = columnOf(view, LOCKED_ID);
    const stars = view.contentEl.querySelectorAll(
      `.tablify__row[data-row-index="0"] .tablify__cell[data-col-index="${col}"] [data-rating-star]`,
    );
    expect(stars).toHaveLength(0);
  });

  it('Enter opens no panel and the stored value stays', async () => {
    const view = await openView(doc());
    enterAt(view, columnOf(view, LOCKED_ID));
    expect(panel()).toBeNull();
    expect(stored(view, LOCKED_ID)).toBe(3);
  });
});
