/**
 * @vitest-environment jsdom
 *
 * SAD-71 Step 6 — the workspace card. The prototype wraps the whole table workspace in a
 * single rounded card (card surface, subtle border, shadow, generous padding) sitting on
 * the app background; v1.0.1 let the toolbar and grid float directly on the host theme.
 *
 * Fails on the pre-Step-6 code.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TableView } from '../../src/views/tableView.js';
import { WorkspaceLeaf } from 'obsidian';

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
        values: { fld_name: 'Alpha' },
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
        frozenColumns: 0,
        rowHeight: 'medium',
        columnWidths: {},
        columnOrder: ['fld_name'],
        warnings: [],
      },
    ],
    syncLink: null,
  });
}

async function openView(): Promise<TableView> {
  const view = new TableView(new WorkspaceLeaf() as never);
  await view.onOpen();
  document.body.appendChild(view.contentEl);
  view.setViewData(sampleFile(), false);
  return view;
}

describe('SAD-71 Step 6 — workspace card', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('wraps toolbar and grid in one .tablify__card', async () => {
    const view = await openView();
    const card = view.contentEl.querySelector<HTMLElement>('.tablify__card');
    expect(card, 'card wrapper').not.toBeNull();
    expect(card?.querySelector('.tablify__toolbar'), 'toolbar inside card').not.toBeNull();
    expect(card?.querySelector('.tablify--grid'), 'grid inside card').not.toBeNull();
  });

  it('themes the view surface so the card resolves tokens even before a session', async () => {
    const view = new TableView(new WorkspaceLeaf() as never);
    await view.onOpen();
    document.body.appendChild(view.contentEl);
    expect(view.contentEl.classList.contains('tablify--light')).toBe(true);
    expect(view.contentEl.style.getPropertyValue('--tablify-bg-card')).toBeTruthy();
    // plugin-scoped, never global
    expect(document.body.classList.contains('tablify--light')).toBe(false);
  });

  it('styles the card and scrollbars from tokens in styles.css', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');
    const at = css.indexOf('.tablify__card {');
    expect(at).toBeGreaterThan(-1);
    const card = css.slice(at, css.indexOf('}', at));
    expect(card).toContain('var(--tablify-bg-card)');
    expect(card).toContain('border-radius');
    const sb = css.indexOf('.tablify ::-webkit-scrollbar {');
    expect(sb, 'themed scrollbars').toBeGreaterThan(-1);
    const sbRule = css.slice(sb, css.indexOf('}', sb));
    expect(sbRule).toContain('6px');
  });
});
