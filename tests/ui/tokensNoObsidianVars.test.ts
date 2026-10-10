/**
 * @vitest-environment jsdom
 *
 * SAD-69 D — the grid must be themed by Tablify tokens alone.
 *
 * P3-09 requires the table to be "independent of the Obsidian theme". Two places in GridView.ts
 * reached for Obsidian's own CSS variables instead of plugin tokens:
 *
 *   1. header.style.background = 'var(--background-primary)' — overrode
 *      styles.css .tablify__header { background: var(--tablify-bg-subtle) }, so the header
 *      colour came from whatever Obsidian theme the user had installed.
 *   2. selected cell outline = 'var(--interactive-accent)' — same leak for focus/selection.
 *
 * These tests fail while those inline styles are present and pass once they are removed.
 */

import { describe, it, expect } from 'vitest';
import { GridView } from '../../src/views/grid/GridView.js';
import { createDefaultView } from '../../src/model/view.js';
import type { FieldDefinition, Row } from '../../src/model/types.js';

function makeModel(rowCount = 4): { fields: FieldDefinition[]; rows: Row[] } {
  const fields: FieldDefinition[] = [
    { id: 'fld_name', name: 'Name', type: 'text', primary: true },
    { id: 'fld_score', name: 'Score', type: 'number' },
  ];
  const rows: Row[] = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push({
      id: `row_${i}`,
      rev: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      values: { fld_name: `Row ${i}`, fld_score: i },
      sync: null,
    });
  }
  return { fields, rows };
}

describe('SAD-69 D — grid is themed by Tablify tokens, not Obsidian variables', () => {
  it('header carries no inline background, so the token stylesheet wins', () => {
    const { fields, rows } = makeModel();
    const view = createDefaultView(fields);
    const grid = new GridView({ rows, fields, view, theme: 'dark', viewportHeight: 400, viewportWidth: 600 });
    document.body.appendChild(grid.root);

    // An inline background beats .tablify__header in styles.css, which is exactly the bug.
    expect(grid.header.style.background, 'header must not set an inline background').toBe('');
    expect(grid.header.style.backgroundColor, 'header must not set an inline background-color').toBe('');

    // The header element must still be the token-styled one from styles.css.
    expect(grid.header.classList.contains('tablify__header')).toBe(true);

    grid.destroy();
    document.body.innerHTML = '';
  });

  it('no element in the grid references an Obsidian theme variable', () => {
    const { fields, rows } = makeModel();
    const view = createDefaultView(fields);
    const grid = new GridView({ rows, fields, view, theme: 'light', viewportHeight: 400, viewportWidth: 600 });
    grid.setSelection({ row: 1, col: 0 });
    document.body.appendChild(grid.root);

    const offenders: string[] = [];
    grid.root.querySelectorAll<HTMLElement>('*').forEach((el) => {
      const inline = el.getAttribute('style') ?? '';
      for (const m of inline.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)) {
        const name = m[1];
        if (!name.startsWith('--tablify-')) offenders.push(`${el.className || el.tagName}: ${name}`);
      }
    });
    expect(offenders, `non-Tablify CSS variables found in grid: ${offenders.join('; ')}`).toEqual([]);

    grid.destroy();
    document.body.innerHTML = '';
  });

  it('selected cell is outlined with the Tablify selection token', () => {
    const { fields, rows } = makeModel();
    const view = createDefaultView(fields);
    const grid = new GridView({ rows, fields, view, theme: 'dark', viewportHeight: 400, viewportWidth: 600 });
    document.body.appendChild(grid.root);

    grid.setSelection({ row: 2, col: 1 });
    const selected = grid.root.querySelector<HTMLElement>('.tablify__cell--selected');
    expect(selected, 'a selected cell should be rendered').not.toBeNull();

    if (!selected) return;
    const outline = selected.style.outline;
    expect(outline).toContain('--tablify-selection');
    expect(outline).not.toContain('--interactive-accent');

    grid.destroy();
    document.body.innerHTML = '';
  });
});
