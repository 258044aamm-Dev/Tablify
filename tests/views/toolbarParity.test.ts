/**
 * @vitest-environment jsdom
 *
 * SAD-71 Step 3 — toolbar & Options restyle toward the prototype's component language.
 *
 * The prototype's surfaces for floating UI are cards (rounded, card background, subtle
 * border, shadow); v1.0.1 rendered the view-settings panel as a full-width inline block
 * inside the toolbar flow, pushing the grid down (owner screenshot). Active controls in
 * the prototype are solid terracotta pills, not outlined ones, and every action button
 * carries a leading glyph. These tests fail on the pre-Step-3 code.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Toolbar, type ToolbarCallbacks, type ToolbarState } from '../../src/views/grid/toolbar.js';
import { createDefaultView } from '../../src/model/view.js';
import type { FieldDefinition } from '../../src/model/types.js';

const FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
  { id: 'fld_status', name: 'Status', type: 'single_select', options: [] },
];

function makeCallbacks(): ToolbarCallbacks {
  const noop = (): void => undefined;
  return {
    onSearch: noop,
    onQuery: noop,
    onAddRow: noop,
    onAddField: noop,
    onRowHeight: noop,
    onFreezeColumns: noop,
    onShowField: noop,
    onClearFilters: noop,
    onUndo: noop,
    onRedo: noop,
  };
}

function mount(overrides: Partial<ToolbarState> = {}) {
  const state: ToolbarState = {
    fields: FIELDS,
    view: createDefaultView(FIELDS),
    visibleRowCount: 3,
    totalRowCount: 3,
    search: '',
    query: '',
    queryError: null,
    theme: 'light',
    ...overrides,
  };
  const toolbar = new Toolbar({ ...state, callbacks: makeCallbacks() });
  document.body.appendChild(toolbar.root);
  return toolbar;
}

const action = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLElement>(`[data-action="${name}"]`);

describe('SAD-71 Step 3 — Options is an anchored popover card', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('styles the options panel as an absolutely positioned card', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');
    const block = css.slice(css.indexOf('.tablify__options {'));
    const rule = block.slice(0, block.indexOf('}'));
    expect(rule, 'popover must not sit in the toolbar flow').toContain('position: absolute');
    expect(rule).toContain('var(--tablify-bg-card)');
    expect(rule).toContain('var(--tablify-border-subtle)');
  });

  it('closes on a pointerdown outside the toolbar', () => {
    const toolbar = mount();
    action(toolbar.root, 'options')?.click();
    expect(toolbar.isOptionsOpen()).toBe(true);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(toolbar.isOptionsOpen(), 'outside press must close the popover').toBe(false);
  });

  it('stays open on a pointerdown inside the toolbar', () => {
    const toolbar = mount();
    action(toolbar.root, 'options')?.click();
    toolbar.root.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(toolbar.isOptionsOpen()).toBe(true);
  });
});

describe('SAD-71 Step 3 — prototype component language', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('every action button carries a leading glyph', () => {
    const toolbar = mount();
    for (const a of ['add-row', 'add-field', 'options', 'undo', 'redo']) {
      const btn = action(toolbar.root, a);
      expect(btn, `${a} button`).not.toBeNull();
      expect(btn?.querySelector('.tablify__btn-icon'), `${a} leading glyph`).not.toBeNull();
    }
  });

  it('the search capsule carries an svg magnifier, not a text glyph', () => {
    const toolbar = mount();
    const icon = toolbar.root.querySelector('.tablify__search-icon');
    expect(icon?.querySelector('svg'), 'search icon svg').not.toBeNull();
  });

  it('active row height is a solid accent pill in styles.css', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');
    const at = css.indexOf('.tablify__option-button.is-active');
    expect(at).toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf('}', at));
    expect(rule).toContain('var(--tablify-accent-primary)');
    expect(rule).toContain('var(--tablify-on-accent)');
    expect(rule, 'no outline-style active state').not.toContain('border-width: 2px');
  });

  it('row count uses the mono stack and muted token', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');
    const at = css.indexOf('.tablify__rowcount');
    expect(at).toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf('}', at));
    expect(rule).toContain('JetBrains Mono');
    expect(rule).toContain('var(--tablify-text-muted)');
  });
});
