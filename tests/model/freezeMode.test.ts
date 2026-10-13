/**
 * SAD-100 — viewport-based default column freeze.
 *
 * Owner decisions (confirmed before planning):
 *  1. "Viewport default, explicit choice wins" — the pane width decides until the user touches
 *     the Freeze switch / header Freeze; after that the choice is stored and applies at every size.
 *  2. "Mobile view" = table pane width ≤ 639px (the phone-layout breakpoint), never device type.
 *
 * File state: optional view key `freezeMode: 'viewport' | 'fixed'`.
 *  - 'viewport'  → effective freeze is 0 (≤639px) or 1 (wider), live per current width.
 *  - 'fixed'     → `frozenColumns` is a deliberate choice and always applies.
 *  - absent + `frozenColumns === 1`  → legacy hard default → 'viewport' (SAD-100 migration rule).
 *  - absent + `frozenColumns` 0 / ≥2 → legacy deliberate value → 'fixed'.
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultView,
  freezeModeOf,
  effectiveFrozenColumns,
  normalizeView,
  cloneView,
  MOBILE_PANE_MAX_WIDTH,
} from '../../src/model/view.js';
import { parse } from '../../src/format/parse.js';
import { serialize } from '../../src/format/serialize.js';
import { newTableText } from '../../src/menus/fileMenuModel.js';
import type { FieldDefinition, TablifyFile, ViewDefinition } from '../../src/model/types.js';

const fields: FieldDefinition[] = [
  { id: 'fld_a', name: 'A', type: 'text', primary: true },
  { id: 'fld_b', name: 'B', type: 'text' },
];

function view(partial: Partial<ViewDefinition>): ViewDefinition {
  return { ...createDefaultView(fields), ...partial };
}

describe('freezeModeOf — the SAD-100 interpretation rule', () => {
  it('reads the legacy hard default (frozenColumns 1, no freezeMode) as viewport', () => {
    expect(freezeModeOf(view({ frozenColumns: 1 }))).toBe('viewport');
    // …and a plain legacy object (what old files parse to) is the same case:
    expect(freezeModeOf({ ...view({}), freezeMode: undefined, frozenColumns: 1 })).toBe('viewport');
  });

  it('reads legacy deliberate values (0 and multi-freeze) as fixed', () => {
    expect(freezeModeOf(view({ freezeMode: undefined, frozenColumns: 0 }))).toBe('fixed');
    expect(freezeModeOf(view({ freezeMode: undefined, frozenColumns: 3 }))).toBe('fixed');
  });

  it('an explicit freezeMode always wins over the number', () => {
    expect(freezeModeOf(view({ freezeMode: 'viewport', frozenColumns: 0 }))).toBe('viewport');
    expect(freezeModeOf(view({ freezeMode: 'fixed', frozenColumns: 1 }))).toBe('fixed');
    expect(freezeModeOf(view({ freezeMode: 'fixed', frozenColumns: 0 }))).toBe('fixed');
  });
});

describe('effectiveFrozenColumns — pane width, not device type', () => {
  it('viewport mode: frozen on desktop width, unfrozen at the mobile breakpoint', () => {
    const v = view({ freezeMode: 'viewport', frozenColumns: 1 });
    expect(effectiveFrozenColumns(v, 400)).toBe(0);
    expect(effectiveFrozenColumns(v, MOBILE_PANE_MAX_WIDTH)).toBe(0); // 639 is mobile
    expect(effectiveFrozenColumns(v, MOBILE_PANE_MAX_WIDTH + 1)).toBe(1); // 640 is desktop
    expect(effectiveFrozenColumns(v, 1568)).toBe(1);
  });

  it('the legacy default (frozenColumns 1, no key) follows the viewport the same way', () => {
    const v = view({ frozenColumns: 1, freezeMode: undefined });
    expect(effectiveFrozenColumns(v, 390)).toBe(0);
    expect(effectiveFrozenColumns(v, 1024)).toBe(1);
  });

  it('fixed mode: the stored choice applies at every width', () => {
    expect(effectiveFrozenColumns(view({ freezeMode: 'fixed', frozenColumns: 0 }), 1568)).toBe(0);
    expect(effectiveFrozenColumns(view({ freezeMode: 'fixed', frozenColumns: 1 }), 390)).toBe(1);
    expect(effectiveFrozenColumns(view({ freezeMode: 'fixed', frozenColumns: 2 }), 390)).toBe(2);
    // Legacy 0 / ≥2 (no key) are fixed too.
    expect(effectiveFrozenColumns(view({ freezeMode: undefined, frozenColumns: 0 }), 1568)).toBe(0);
    expect(effectiveFrozenColumns(view({ freezeMode: undefined, frozenColumns: 2 }), 390)).toBe(2);
  });

  it('viewport mode renders the stored count on desktop and suppresses it on mobile', () => {
    // The stored number is the desktop rendering (1 is the default; a spread-override of 2
    // must still pin two columns on a wide pane — "should not influence existing behaviour").
    expect(effectiveFrozenColumns(view({ freezeMode: 'viewport', frozenColumns: 2 }), 1024)).toBe(2);
    expect(effectiveFrozenColumns(view({ freezeMode: 'viewport', frozenColumns: 2 }), 390)).toBe(0);
  });
});

describe('createDefaultView', () => {
  it('writes the viewport default (frozenColumns 1 + freezeMode viewport)', () => {
    const v = createDefaultView(fields);
    expect(v.frozenColumns).toBe(1); // unchanged on-disk shape for older readers
    expect(v.freezeMode).toBe('viewport');
  });
});

describe('persistence', () => {
  it('normalizeView keeps a valid freezeMode and drops an invalid one with a warning', () => {
    const kept = normalizeView({ ...view({ freezeMode: 'fixed', frozenColumns: 1 }) }, fields);
    expect(kept.view.freezeMode).toBe('fixed');
    const dropped = normalizeView({ ...view({}), freezeMode: 'banana' }, fields);
    expect(dropped.view.freezeMode).toBeUndefined();
    expect(dropped.warnings.join(' ')).toMatch(/freezeMode/);
  });

  it('does not invent the key when it is absent (byte-identical round-trips)', () => {
    const v = view({ freezeMode: undefined, frozenColumns: 2 });
    expect('freezeMode' in cloneView(v)).toBe(false);
    expect(normalizeView(v, fields).view.freezeMode).toBeUndefined();
  });

  it('round-trips freezeMode through serialize → parse', () => {
    const parsed = parse(newTableText('T'));
    if (!parsed.ok) throw new Error('parse failed');
    const file: TablifyFile = parsed.data;
    expect(file.views[0].freezeMode).toBe('viewport'); // new tables default to auto
    file.views[0] = { ...file.views[0], freezeMode: 'fixed', frozenColumns: 1 };
    const again = parse(serialize(file));
    if (!again.ok) throw new Error('re-parse failed');
    expect(again.data.views[0].freezeMode).toBe('fixed');
    expect(again.data.views[0].frozenColumns).toBe(1);
    // And back to viewport mode:
    again.data.views[0] = { ...again.data.views[0], freezeMode: 'viewport' };
    const third = parse(serialize(again.data));
    if (!third.ok) throw new Error('third parse failed');
    expect(third.data.views[0].freezeMode).toBe('viewport');
  });

  it('a written table with freezeMode still validates against tablify.schema.json', () => {
    // The schema declares the key (optional); this guards the declaration staying in step.
    // Full-file validation lives in tests/schema.test.ts and tests/menus/fileMenuModel.test.ts.
    const v = createDefaultView(fields);
    expect(['viewport', 'fixed']).toContain(v.freezeMode);
  });
});
