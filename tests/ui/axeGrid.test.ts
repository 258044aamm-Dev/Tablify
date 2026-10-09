/**
 * @vitest-environment jsdom
 * P6-03 — Automated DOM accessibility checks (axe-core, devDependency only).
 * Runs axe on the grid + a validation-invalid cell. jsdom has no layout engine,
 * so layout-dependent rules are disabled explicitly (documented in
 * docs/accessibility/audit.md); everything else must produce no critical or
 * serious violations. New violations fail this test.
 */
import { describe, it, expect } from 'vitest';
import axe from 'axe-core';
import { GridView } from '../../src/views/grid/GridView.js';
import { applyValidationState } from '../../src/views/grid/validationDisplay.js';
import { createDefaultView } from '../../src/model/view.js';
import type { Row, FieldDefinition, ViewDefinition } from '../../src/model/types.js';

// Rules that cannot produce meaningful results for a component-scoped run in
// jsdom (no page landmarks, no layout/paint). Disabled explicitly, not ignored.
const DISABLED_RULES = [
  'region', // document-level: component fragment has no landmarks by design
  'landmark-one-main',
  'page-has-heading-one',
  'bypass',
  'html-has-lang',
  'color-contrast', // jsdom cannot compute rendered colors; measured via scripts/check-contrast.mjs instead
];

describe('P6-03 — axe-core automated DOM checks', () => {
  it('grid + invalid cell: no critical or serious violations', async () => {
    const fields: FieldDefinition[] = [
      { id: 'fld_name', name: 'Name', type: 'text', primary: true },
      { id: 'fld_qty', name: 'Qty', type: 'number' },
    ];
    const rows: Row[] = Array.from({ length: 20 }, (_, i) => ({
      id: `row_${i}`,
      rev: 1,
      updatedAt: '2026-10-09T08:00:00Z',
      values: { fld_name: i === 0 ? '' : `Item ${i}`, fld_qty: i },
      sync: null,
    }));
    const view: ViewDefinition = createDefaultView(fields);
    view.rowHeight = 'medium';

    const container = document.createElement('div');
    document.body.appendChild(container);

    const grid = new GridView({ rows, fields, view, theme: 'light', viewportHeight: 600, viewportWidth: 800 });
    container.appendChild(grid.root);

    // a cell with a visible validation failure (aria-invalid + title)
    const invalid = document.createElement('div');
    invalid.className = 'tablify__cell';
    invalid.textContent = '';
    container.appendChild(invalid);
    applyValidationState(invalid, { id: 'fld_name', name: 'Name', type: 'text', required: true } as FieldDefinition, rows[0], rows);

    const results = await axe.run(container, {
      rules: Object.fromEntries(DISABLED_RULES.map((r) => [r, { enabled: false }])),
    } as unknown as Parameters<typeof axe.run>[1]);

    const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    const others = results.violations.filter((v) => v.impact !== 'critical' && v.impact !== 'serious');
    // keep the record honest: print everything axe found for the audit doc
    console.log(
      '[axe] blocking:', JSON.stringify(blocking.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))),
      '| other:', JSON.stringify(others.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))),
    );
    expect(blocking, JSON.stringify(blocking.map((v) => ({ id: v.id, help: v.help })))).toEqual([]);
    grid.destroy();
  });
});
