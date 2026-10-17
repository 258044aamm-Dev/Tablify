/**
 * @vitest-environment jsdom
 *
 * COD-75 — the grid opens the date panel, and one commit is exactly one undo step.
 *
 * This is the wiring the panel tests cannot see: `startEdit` routing a `date` / `date_time` cell
 * to the panel instead of an inline editor, the value landing in the store through the command
 * stack, and the guarantees that pre-date this change staying intact (opening and dismissing a
 * cell writes nothing; Escape writes nothing).
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

/** A table with a date and a date_time column, both filled in row 1. */
function tableText(due: CellValue, reviewAt: CellValue): string {
  const doc = JSON.parse(newTableText('Untitled table')) as unknown as FileShape;
  const dueField = doc.fields.find((f) => f.name === 'Due date');
  if (!dueField) throw new Error('fixture has no Due date field');
  const review: FieldDefinition = { id: 'fld_review', name: 'Review At', type: 'date_time' } as FieldDefinition;
  doc.fields.push(review);
  doc.views[0].columnOrder.push(review.id);
  doc.rows[0].values[dueField.id] = due;
  doc.rows[0].values[review.id] = reviewAt;
  return JSON.stringify(doc);
}

let dueId = '';
let reviewId = '';

function doc(): string {
  const text = tableText('2026-10-16', '2026-10-16T09:30:00.000Z');
  const parsed = JSON.parse(text) as unknown as FileShape;
  dueId = parsed.fields.find((f) => f.name === 'Due date')?.id ?? '';
  reviewId = 'fld_review';
  return text;
}

async function openView(data: string): Promise<TableView> {
  const view = new TableView(new WorkspaceLeaf() as never);
  await view.onOpen();
  document.body.appendChild(view.contentEl);
  view.setViewData(data, false);
  return view;
}

/** The view's session, or a loud failure — keeps the non-null assertions out of the test. */
function sessionOf(view: TableView): NonNullable<ReturnType<TableView['syncSession']>> {
  const session = view.syncSession();
  if (!session) throw new Error('the view has no session');
  return session;
}

function columnOf(view: TableView, fieldId: string): number {
  const session = sessionOf(view);
  const index = session.getVisibleFields().findIndex((f) => f.id === fieldId);
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

const panel = (): HTMLElement | null => document.body.querySelector('[data-testid="tablify-date-panel"]');

function stored(view: TableView, fieldId: string): CellValue {
  const data = JSON.parse(view.getViewData()) as unknown as FileShape;
  return data.rows[0].values[fieldId] ?? null;
}

function dayButton(ymd: string): HTMLElement {
  const el = document.querySelector(`[data-testid="tablify-date-panel"] [data-date="${ymd}"]`) as HTMLElement | null;
  if (!el) throw new Error(`no day ${ymd}`);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('COD-75 — the grid opens the picker for date cells', () => {
  it('Enter on a date cell opens the panel, not an inline input', async () => {
    const view = await openView(doc());
    enterAt(view, columnOf(view, dueId));
    expect(view.contentEl.querySelector('input.tablify__editor')).toBeNull();
    expect(panel()).not.toBeNull();
  });

  it('Enter on a date_time cell opens the same panel with its time row', async () => {
    const view = await openView(doc());
    enterAt(view, columnOf(view, reviewId));
    expect(panel()).not.toBeNull();
    expect(panel()?.querySelector('.tablify__date-time')).not.toBeNull();
  });

  it('the panel lives in the document, not inside the grid', async () => {
    const view = await openView(doc());
    enterAt(view, columnOf(view, dueId));
    expect(view.contentEl.contains(panel())).toBe(false);
  });

  it('picking a day writes the value once and closes', async () => {
    const view = await openView(doc());
    const execute = vi.spyOn(sessionOf(view).stack, 'execute');
    enterAt(view, columnOf(view, dueId));
    dayButton('2026-10-21').click();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(stored(view, dueId)).toBe('2026-10-21');
    expect(panel()).toBeNull();
  });

  it('the write is one undo step', async () => {
    const view = await openView(doc());
    enterAt(view, columnOf(view, dueId));
    dayButton('2026-10-21').click();
    sessionOf(view).stack.undo();
    expect(stored(view, dueId)).toBe('2026-10-16');
  });

  it('a date_time edit keeps the stored time and writes ISO UTC', async () => {
    const view = await openView(doc());
    enterAt(view, columnOf(view, reviewId));
    dayButton('2026-10-21').click();
    (panel()?.querySelector('.tablify__date-done') as HTMLElement).click();
    const value = String(stored(view, reviewId));
    const before = new Date('2026-10-16T09:30:00.000Z');
    const after = new Date(value);
    expect([after.getFullYear(), after.getMonth(), after.getDate()]).toEqual([2026, 9, 21]);
    expect([after.getHours(), after.getMinutes(), after.getSeconds()]).toEqual([
      before.getHours(),
      before.getMinutes(),
      before.getSeconds(),
    ]);
    expect(value.endsWith('Z')).toBe(true);
  });
});

describe('COD-75 — opening a cell still writes nothing', () => {
  it('Escape leaves the value alone', async () => {
    const view = await openView(doc());
    const execute = vi.spyOn(sessionOf(view).stack, 'execute');
    enterAt(view, columnOf(view, dueId));
    dayButton('2026-10-21').click();
    // Re-open and cancel instead of committing.
    enterAt(view, columnOf(view, dueId));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(execute).toHaveBeenCalledTimes(1); // the pick above, not the cancel
    expect(stored(view, dueId)).toBe('2026-10-21');
  });

  it('Done without a change writes nothing', async () => {
    const view = await openView(doc());
    const execute = vi.spyOn(sessionOf(view).stack, 'execute');
    enterAt(view, columnOf(view, reviewId));
    (panel()?.querySelector('.tablify__date-done') as HTMLElement).click();
    expect(execute).not.toHaveBeenCalled();
    expect(stored(view, reviewId)).toBe('2026-10-16T09:30:00.000Z');
  });

  it('a click away without a change writes nothing', async () => {
    const view = await openView(doc());
    const execute = vi.spyOn(sessionOf(view).stack, 'execute');
    enterAt(view, columnOf(view, dueId));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(execute).not.toHaveBeenCalled();
    expect(stored(view, dueId)).toBe('2026-10-16');
  });

  it('Clear empties the cell in one undoable step', async () => {
    const view = await openView(doc());
    enterAt(view, columnOf(view, dueId));
    (panel()?.querySelector('.tablify__date-quiet--danger') as HTMLElement).click();
    expect(stored(view, dueId)).toBeNull();
    sessionOf(view).stack.undo();
    expect(stored(view, dueId)).toBe('2026-10-16');
  });
});
