/**
 * @vitest-environment jsdom
 *
 * P8-04: a link cell draws one chip per link. A broken link keeps its chip, marked dashed.
 */
import { describe, it, expect } from 'vitest';
import 'obsidian'; // installs the mock's element helpers (createSpan) on HTMLElement
import { GridView } from '../../src/views/grid/GridView.js';
import type { FieldDefinition } from '../../src/model/types.js';

describe('link chips (P8-04)', () => {
  const field: FieldDefinition = { id: 'fld_customer', name: 'Customer', type: 'link', linkTableId: 'tbl_c' } as FieldDefinition;

  function render(chips: Array<{ label: string; broken: boolean }>) {
    const grid = new GridView({
      rows: [{ id: 'row_1', values: { fld_customer: [{ tableId: 'tbl_c', rowId: 'a' }] } }] as never,
      fields: [field],
      view: { sort: [], groupBy: null, hidden: [], frozenColumns: 0, rowHeight: 'medium', columnWidths: {}, columnOrder: ['fld_customer'] } as never,
      theme: 'light',
      viewportHeight: 200,
      viewportWidth: 400,
      linkSummary: () => ({
        text: chips.map((c) => c.label).join(', '),
        broken: chips.filter((c) => c.broken).length,
        chips,
      }),
    });
    return grid.root;
  }

  it('draws one chip per link, with the resolved names', () => {
    const root = render([
      { label: 'Ada Lovelace', broken: false },
      { label: 'Grace Hopper', broken: false },
    ]);
    const chips = Array.from(root.querySelectorAll('.tablify-link-chip'));
    expect(chips.map((c) => c.textContent)).toEqual(['Ada Lovelace', 'Grace Hopper']);
    expect(chips.every((c) => !c.classList.contains('tablify-link-chip--broken'))).toBe(true);
  });

  it('keeps a broken link as a dashed chip, and marks the cell', () => {
    const root = render([
      { label: 'Ada Lovelace', broken: false },
      { label: 'Missing row', broken: true },
    ]);
    const broken = root.querySelectorAll('.tablify-link-chip--broken');
    expect(broken).toHaveLength(1);
    expect(broken[0].textContent).toBe('Missing row');
    const cell = root.querySelector('[data-broken-links]');
    expect(cell).not.toBeNull();
    expect(cell?.getAttribute('data-broken-links')).toBe('1');
    expect(cell?.classList.contains('tablify__cell--broken-link')).toBe(true);
  });
});
