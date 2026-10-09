// Export test fixture: a table with 12 fields covering the types in FX-M (P4 scope), built in code.
// NOTE: FX-M is not a committed fixture file in this repo; this builder stands in for it (disclosed).
import type { FieldDefinition, Row, TablifyFile, ViewDefinition, SelectOption } from '../../src/model/types.js';
import { mulberry32 } from './rng.js';

export const STATUS_OPTS: SelectOption[] = [
  { id: 'opt_todo', name: 'Todo', color: 'gray' },
  { id: 'opt_doing', name: 'Doing', color: 'blue' },
  { id: 'opt_done', name: 'Done', color: 'green' },
];
export const TAG_OPTS: SelectOption[] = [
  { id: 'opt_a', name: 'Alpha', color: 'red' },
  { id: 'opt_b', name: 'Beta; x', color: 'purple' },
];

export const FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
  { id: 'fld_amount', name: 'Amount', type: 'number' },
  { id: 'fld_due', name: 'Due', type: 'date' },
  { id: 'fld_done', name: 'Done', type: 'checkbox' },
  { id: 'fld_status', name: 'Status', type: 'single_select', options: STATUS_OPTS },
  { id: 'fld_tags', name: 'Tags', type: 'multi_select', options: TAG_OPTS },
  { id: 'fld_note', name: 'Note', type: 'long_text' },
  { id: 'fld_link', name: 'Link', type: 'url' },
  { id: 'fld_hidden', name: 'Secret', type: 'number' },
  { id: 'fld_price', name: 'Price', type: 'currency' },
  { id: 'fld_pct', name: 'Share', type: 'percent' },
  { id: 'fld_rating', name: 'Rating', type: 'rating' },
];

export const VIEW: ViewDefinition = {
  id: 'viw_default',
  name: 'Default',
  sort: [{ fieldId: 'fld_amount', direction: 'desc' }],
  groupBy: null,
  hidden: ['fld_hidden'],
  frozenColumns: 1,
  rowHeight: 'medium',
  columnWidths: {},
  columnOrder: ['fld_name', 'fld_amount', 'fld_due', 'fld_done', 'fld_status', 'fld_tags', 'fld_note', 'fld_link', 'fld_hidden', 'fld_price', 'fld_pct', 'fld_rating'],
};

/** Deterministic rows. Names include commas, quotes, pipes, backslashes, and newlines. */
export function makeFile(n: number, seed = 99, view: ViewDefinition = VIEW): TablifyFile {
  const rand = mulberry32(seed);
  const rows: Row[] = [];
  for (let i = 1; i <= n; i++) {
    const amount = i % 13 === 0 ? null : Math.round(rand() * 100000) / 100;
    const tags = i % 5 === 0 ? [] : i % 2 === 0 ? ['opt_a', 'opt_b'] : ['opt_b'];
    rows.push({
      id: `row_${String(i).padStart(6, '0')}`,
      rev: 1,
      updatedAt: '2026-10-09T00:00:00.000Z',
      sync: null,
      values: {
        fld_name: `Item ${i}, "quoted" | pipe \\ back${i % 9 === 0 ? '\nsecond line' : ''}`,
        fld_amount: amount,
        fld_due: `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
        fld_done: i % 3 === 0 ? true : i % 3 === 1 ? false : null,
        fld_status: STATUS_OPTS[i % 3].id,
        fld_tags: tags,
        fld_note: i % 4 === 0 ? null : `note ${i}`,
        fld_link: `https://example.com/${i}`,
        fld_hidden: i,
        fld_price: 1234 + i,
        fld_pct: (i % 100) / 100, // percent is stored as a 0-1 decimal
        fld_rating: i % 6,
      },
    });
  }
  return { formatVersion: 1, tableId: 'tbl_export', name: 'Export Fixture', fields: FIELDS, rows, views: [view], syncLink: null };
}
