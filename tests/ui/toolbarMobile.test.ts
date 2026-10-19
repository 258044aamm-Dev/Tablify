/**
 * @vitest-environment jsdom
 *
 * SAD-308 — scrollable mobile toolbar below the search input box & desktop/mobile tool order.
 *
 * Mobile (`@media (max-width: 639px)`):
 *   - `.tablify__toolbar-actions` spans full width below `.tablify__search` and scrolls
 *     horizontally (`overflow-x: auto`, `scroll-behavior: smooth`).
 *   - Each `.tablify button.tablify__toolbar-button` is sized to `calc((100% - 16px) / 3)`
 *     (`flex: 0 0 calc((100% - 16px) / 3)`, `white-space: nowrap`) so only 3 tools are
 *     visible at a time while the remaining tools are reachable by horizontal scrolling.
 *   - `Sync` and `Options` hide their text labels on mobile so they render as icon-only pills.
 *
 * Desktop (outside `@media (max-width: 639px)`):
 *   - Preserves existing desktop layout, spacing, and sizing (`flex: 0 0 auto`, no 1/3 width cap,
 *     and `Options` keeps its label visible).
 *   - Both desktop and mobile arrange the 7 tools in the SAD-308 order:
 *     Undo · Redo · Add Field · Add Row · Filter · Sync · Options.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Toolbar, type ToolbarCallbacks } from '../../src/views/grid/toolbar.js';
import { createDefaultView } from '../../src/model/view.js';
import type { FieldDefinition } from '../../src/model/types.js';

const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');

/** Body of the first `@media (max-width: 639px)` block, or '' when absent. */
function phoneBlock(source: string): string {
  const start = source.indexOf('@media (max-width: 639px)');
  if (start < 0) return '';
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return '';
}

/** Every declaration body of a rule whose selector list contains `selector`. */
function bodies(block: string, selector: string): string[] {
  const out: string[] = [];
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`([^{}]*${escaped}[^{}]*)\\{([^}]*)\\}`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) out.push(m[2].replace(/\s+/g, ' ').trim());
  return out;
}

const FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
];

function makeCallbacks(): ToolbarCallbacks {
  const noop = (): void => undefined;
  return {
    onFilter: noop,
    onSync: noop,
    onOpenFilter: noop,
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

describe('SAD-308 — mobile 3-tools-at-a-time scrollable toolbar and desktop preservation', () => {
  const block = phoneBlock(css);
  const desktopCss = css.replace(block, '');

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has a phone-width block that configures both .tablify__toolbar-actions and .tablify__toolbar-button', () => {
    expect(block).not.toBe('');
    expect(bodies(block, '.tablify__toolbar-actions').length).toBeGreaterThan(0);
    expect(bodies(block, '.tablify__toolbar-button').length).toBeGreaterThan(0);
  });

  it('sizes each mobile toolbar button to 1/3 of the row width so only 3 tools are visible at a time', () => {
    const all = bodies(block, '.tablify__toolbar-button').join(' ');
    expect(all).toContain('flex: 0 0 calc((100% - 16px) / 3)');
    expect(all).toContain('min-width: calc((100% - 16px) / 3)');
    expect(all).toContain('max-width: calc((100% - 16px) / 3)');
    expect(all).toContain('box-sizing: border-box');
    expect(all).toContain('white-space: nowrap');
    expect(all).not.toContain('white-space: normal');
  });

  it('makes the mobile actions bar full-width below the search input and smoothly horizontally scrollable', () => {
    const baseActions = bodies(desktopCss, '.tablify__toolbar-actions').join(' ');
    const mobileActions = bodies(block, '.tablify__toolbar-actions').join(' ');
    expect(baseActions).toContain('overflow-x: auto');
    expect(mobileActions).toContain('flex: 1 1 100%');
    expect(mobileActions).toContain('width: 100%');
    expect(mobileActions).toContain('scroll-behavior: smooth');
  });

  it('hides the text label on Sync and Options on mobile so they render as icon-only buttons', () => {
    const syncLabel = bodies(block, ".tablify button.tablify__toolbar-button[data-action='sync'] .tablify__btn-label").join(' ');
    const optionsLabel = bodies(block, ".tablify button.tablify__toolbar-button[data-action='options'] .tablify__btn-label").join(' ');
    expect(syncLabel).toContain('display: none');
    expect(optionsLabel).toContain('display: none');
  });

  it('preserves the desktop toolbar layout and does not leak the 3-tool width cap or Options label hiding to desktop', () => {
    const desktopButton = bodies(desktopCss, '.tablify__toolbar-button').join(' ');
    const desktopActions = bodies(desktopCss, '.tablify__toolbar-actions').join(' ');
    const desktopOptionsLabel = bodies(
      desktopCss,
      ".tablify button.tablify__toolbar-button[data-action='options'] .tablify__btn-label",
    ).join(' ');

    expect(desktopButton).toContain('flex: 0 0 auto');
    expect(desktopButton).toContain('white-space: nowrap');
    expect(desktopButton).not.toContain('calc((100% - 16px) / 3)');
    expect(desktopActions).toContain('flex: 0 1 auto');
    expect(desktopOptionsLabel).toBe('');
  });

  it('renders all 7 tools in the SAD-308 order with accessible labels on both mobile and desktop', () => {
    const toolbar = new Toolbar({
      fields: FIELDS,
      view: createDefaultView(FIELDS),
      visibleRowCount: 5,
      totalRowCount: 5,
      search: '',
      query: '',
      queryError: null,
      theme: 'light',
      callbacks: makeCallbacks(),
    });
    document.body.appendChild(toolbar.root);

    const buttons = [...toolbar.root.querySelectorAll<HTMLButtonElement>('.tablify__toolbar-actions > button')];
    expect(buttons.map((b) => b.dataset.action)).toEqual([
      'undo',
      'redo',
      'add-field',
      'add-row',
      'filter',
      'sync',
      'options',
    ]);
    for (const btn of buttons) {
      expect(btn.getAttribute('aria-label'), `${btn.dataset.action} aria-label`).toBeTruthy();
      expect(btn.querySelector('svg.tablify__fa'), `${btn.dataset.action} icon`).not.toBeNull();
    }

    toolbar.destroy();
  });
});
