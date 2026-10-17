/**
 * COD-72 — primary-column freeze.
 *
 * The field-by-field freeze is gone: `frozenColumns` is a 0/1 flag for the primary column
 * (1 = frozen). `effectiveFrozenColumns` renders it at every pane width except the phone
 * breakpoint (≤ 639px), where nothing is filtered — the primary column would otherwise eat
 * most of the width and hide the rest of the table.
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultView,
  effectiveFrozenColumns,
  normalizeView,
  cloneView,
  validateView,
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

describe('effectiveFrozenColumns — pane width, not device type', () => {
  it('freezes the primary column on a desktop pane and suppresses it at the phone breakpoint', () => {
    const v = view({ frozenColumns: 1 });
    expect(effectiveFrozenColumns(v, 400)).toBe(0);
    expect(effectiveFrozenColumns(v, MOBILE_PANE_MAX_WIDTH)).toBe(0); // 639 is mobile
    expect(effectiveFrozenColumns(v, MOBILE_PANE_MAX_WIDTH + 1)).toBe(1); // 640 is desktop
    expect(effectiveFrozenColumns(v, 1568)).toBe(1);
  });

  it('never freezes when the flag is 0, whatever the width', () => {
    const v = view({ frozenColumns: 0 });
    expect(effectiveFrozenColumns(v, 390)).toBe(0);
    expect(effectiveFrozenColumns(v, 1568)).toBe(0);
  });

  it('renders a legacy multi-column count as the primary column only', () => {
    // A file from the multi-column freeze still evaluates to a single frozen column.
    expect(effectiveFrozenColumns(view({ frozenColumns: 4 }), 1024)).toBe(1);
    expect(effectiveFrozenColumns(view({ frozenColumns: 4 }), 390)).toBe(0);
  });
});

describe('createDefaultView', () => {
  it('writes the frozen-primary default and no freezeMode key', () => {
    const v = createDefaultView(fields);
    expect(v.frozenColumns).toBe(1);
    expect('freezeMode' in v).toBe(false);
  });
});

describe('validateView — the flag is 0 or 1', () => {
  it('clamps a legacy count to 1 with a warning', () => {
    const res = validateView(view({ frozenColumns: 4 }), fields);
    expect(res.view.frozenColumns).toBe(1);
    expect(res.warnings.join(' ')).toMatch(/only the primary column can be frozen/);
  });

  it('keeps 0 and 1 unchanged', () => {
    expect(validateView(view({ frozenColumns: 0 }), fields).view.frozenColumns).toBe(0);
    expect(validateView(view({ frozenColumns: 1 }), fields).view.frozenColumns).toBe(1);
  });

  it('clamps negative and non-numeric values to 0', () => {
    expect(validateView(view({ frozenColumns: -1 }), fields).view.frozenColumns).toBe(0);
    expect(
      validateView(view({ frozenColumns: 'yes' as unknown as number }), fields).view.frozenColumns,
    ).toBe(0);
  });

  it('drops a legacy freezeMode key instead of carrying it', () => {
    const legacy = { ...view({ frozenColumns: 1 }), freezeMode: 'fixed' } as unknown as ViewDefinition;
    const res = validateView(legacy, fields);
    expect('freezeMode' in cloneView(res.view)).toBe(false);
  });
});

describe('persistence', () => {
  it('round-trips the flag through serialize → parse', () => {
    const parsed = parse(newTableText('T'));
    if (!parsed.ok) throw new Error('parse failed');
    const file: TablifyFile = parsed.data;
    expect(file.views[0].frozenColumns).toBe(1); // new tables freeze the primary column
    expect('freezeMode' in file.views[0]).toBe(false);

    file.views[0] = { ...file.views[0], frozenColumns: 0 };
    const again = parse(serialize(file));
    if (!again.ok) throw new Error('re-parse failed');
    expect(again.data.views[0].frozenColumns).toBe(0);
  });

  it('loads an old file: multi-column count becomes 1 and freezeMode disappears', () => {
    const text = newTableText('T').replace('"frozenColumns": 1', '"frozenColumns": 4');
    const withMode = text.replace('"frozenColumns": 4,', '"frozenColumns": 4,\n      "freezeMode": "fixed",');
    const parsed = parse(withMode);
    if (!parsed.ok) throw new Error(`parse failed: ${parsed.error}`);
    expect(parsed.data.views[0].frozenColumns).toBe(1);
    expect('freezeMode' in (parsed.data.views[0] as unknown as Record<string, unknown>)).toBe(false);

    // …and the next save does not write the removed key back.
    const saved = serialize(parsed.data);
    expect(saved).not.toContain('freezeMode');
  });

  it('normalizeView drops a legacy freezeMode key', () => {
    const legacy = { ...view({ frozenColumns: 1 }), freezeMode: 'fixed' } as unknown as ViewDefinition;
    expect(normalizeView(legacy, fields).view.freezeMode).toBeUndefined();
  });
});
