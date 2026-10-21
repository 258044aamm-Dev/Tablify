/**
 * @vitest-environment jsdom
 *
 * SAD-376 — the view-level wiring of the cell overflow feature.
 *
 * The grid only knows what it is told: `TableView` reads the plugin settings through its hooks and
 * hands them to `GridView`, and `refreshGrid()` is what a settings save calls so an open table
 * repaints without closing and reopening the file. Both directions are asserted here.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TableView } from '../../src/views/tableView.js';
import { WorkspaceLeaf } from 'obsidian';
import type { TablifySettings } from '../../src/settings.js';

function settings(patch: Partial<TablifySettings> = {}): TablifySettings {
  return {
    airtableToken: '',
    exportVaultFallback: false,
    cellOverflowEnabled: true,
    cellOverflowMaxChars: 80,
    cellOverflowHoverCard: true,
    cellOverflowTouchReveal: true,
    ...patch,
  };
}

function sampleFile(): string {
  return JSON.stringify({
    formatVersion: 1,
    tableId: 'tbl_test',
    name: 'Test',
    fields: [{ id: 'fld_name', name: 'Name', type: 'text', primary: true }],
    rows: [
      {
        id: 'row_1',
        rev: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        values: { fld_name: 'A'.repeat(200) },
        sync: null,
      },
    ],
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
        columnOrder: ['fld_name'],
        warnings: [],
      },
    ],
    syncLink: null,
  });
}

interface Mounted {
  view: TableView;
  current: { value: TablifySettings };
}

async function openView(initial: TablifySettings): Promise<Mounted> {
  const current = { value: initial };
  const view = new TableView(new WorkspaceLeaf() as never, { readSettings: () => current.value });
  await view.onOpen();
  document.body.appendChild(view.contentEl);
  view.setViewData(sampleFile(), false);
  return { view, current };
}

const control = (view: TableView): HTMLElement | null =>
  view.contentEl.querySelector<HTMLElement>('.tablify__cell-expand');

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('SAD-376 — TableView reads the plugin settings', () => {
  it('offers Expand when the value is over the configured limit', async () => {
    const { view } = await openView(settings({ cellOverflowMaxChars: 80 }));
    expect(control(view)).not.toBeNull();
    expect(view.contentEl.querySelector('.tablify--overflow')).not.toBeNull();
  });

  it('offers nothing when the limit is high enough, or the feature is off', async () => {
    const wide = await openView(settings({ cellOverflowMaxChars: 2000 }));
    expect(control(wide.view)).toBeNull();

    document.body.innerHTML = '';
    const off = await openView(settings({ cellOverflowEnabled: false }));
    expect(control(off.view)).toBeNull();
    expect(off.view.contentEl.querySelector('.tablify--overflow')).toBeNull();
  });

  it('falls back to the defaults when the host supplies no settings at all', async () => {
    const view = new TableView(new WorkspaceLeaf() as never);
    await view.onOpen();
    document.body.appendChild(view.contentEl);
    view.setViewData(sampleFile(), false);
    // Default limit 80, enabled: a 200-character value overflows.
    expect(control(view)).not.toBeNull();
  });

  it('follows a settings change on refreshGrid(), without saving anything', async () => {
    const { view, current } = await openView(settings({ cellOverflowMaxChars: 80 }));
    expect(control(view)).not.toBeNull();

    const savesBefore = view.saveRequests;
    current.value = settings({ cellOverflowMaxChars: 2000 });
    view.refreshGrid();

    expect(control(view)).toBeNull();
    // A repaint is not a write: no save was requested, so the file stays untouched.
    expect(view.saveRequests).toBe(savesBefore);
  });

  it('picks the card and touch switches up on the next render', async () => {
    const { view, current } = await openView(settings());
    const grid = view.contentEl.querySelector('.tablify--overflow') as HTMLElement;
    expect(grid.classList.contains('tablify--overflow-touch')).toBe(true);

    current.value = settings({ cellOverflowTouchReveal: false });
    view.refreshGrid();
    expect(
      (view.contentEl.querySelector('.tablify--overflow') as HTMLElement).classList.contains(
        'tablify--overflow-touch',
      ),
    ).toBe(false);
  });
});
