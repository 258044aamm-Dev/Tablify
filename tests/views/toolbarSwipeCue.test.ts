/**
 * @vitest-environment jsdom
 *
 * SAD-375 — the phone edge fades follow the tool row's scroll position (Toolbar.syncFade).
 *
 * jsdom performs no layout, so scrollWidth / clientWidth are faked per test (the same approach
 * tests/views/toolbar.test.ts uses for window.innerWidth). What is real here is the wiring: the
 * class contract on `.tablify__toolbar-actions-wrap`, the scroll/resize/update entry points, and
 * the teardown. The stylesheet half is pinned in tests/ui/toolbarSwipeCue.test.ts.
 *
 * Class semantics: `is-fade-end` = tools remain past the right edge (fade the right edge);
 * `is-fade-start` = the row is scrolled away from its start (fade the left edge). Both off when
 * everything fits. A 1px tolerance absorbs subpixel rounding at the exact ends.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Toolbar, type ToolbarCallbacks, type ToolbarState } from '../../src/views/grid/toolbar.js';
import { createDefaultView } from '../../src/model/view.js';
import type { FieldDefinition } from '../../src/model/types.js';

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

function mount(overrides: Partial<ToolbarState> = {}) {
  const state: ToolbarState = {
    fields: FIELDS,
    view: createDefaultView(FIELDS),
    visibleRowCount: 5,
    totalRowCount: 5,
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

/** Fake the scroller's layout metrics (jsdom has none) and set the scroll position. */
function setScroll(el: HTMLElement, scrollWidth: number, clientWidth: number, scrollLeft: number): void {
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
  el.scrollLeft = scrollLeft;
}

function parts(toolbar: Toolbar) {
  const wrap = toolbar.root.querySelector<HTMLElement>('.tablify__toolbar-actions-wrap');
  const actions = toolbar.root.querySelector<HTMLElement>('.tablify__toolbar-actions');
  expect(wrap, 'fade wrapper').not.toBeNull();
  expect(actions, 'tool-row scroller').not.toBeNull();
  return { wrap: wrap as HTMLElement, actions: actions as HTMLElement };
}

describe('SAD-375 — scroll-aware fade classes on the fade wrapper', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('at the start of an overflowing row: end fade only', () => {
    const toolbar = mount();
    const { wrap, actions } = parts(toolbar);
    setScroll(actions, 900, 330, 0);
    actions.dispatchEvent(new Event('scroll'));

    expect(wrap.classList.contains('is-fade-end'), 'right fade while tools remain').toBe(true);
    expect(wrap.classList.contains('is-fade-start'), 'no left fade at the start').toBe(false);
    toolbar.destroy();
  });

  it('scrolled to the end of the row: start fade only', () => {
    const toolbar = mount();
    const { wrap, actions } = parts(toolbar);
    setScroll(actions, 900, 330, 570); // scrollLeft == scrollWidth - clientWidth
    actions.dispatchEvent(new Event('scroll'));

    expect(wrap.classList.contains('is-fade-start'), 'left fade once scrolled').toBe(true);
    expect(wrap.classList.contains('is-fade-end'), 'no right fade at the end').toBe(false);
    toolbar.destroy();
  });

  it('mid-row: both edges fade', () => {
    const toolbar = mount();
    const { wrap, actions } = parts(toolbar);
    setScroll(actions, 900, 330, 200);
    actions.dispatchEvent(new Event('scroll'));

    expect(wrap.classList.contains('is-fade-start')).toBe(true);
    expect(wrap.classList.contains('is-fade-end')).toBe(true);
    toolbar.destroy();
  });

  it('when everything fits, neither fade shows', () => {
    const toolbar = mount();
    const { wrap, actions } = parts(toolbar);
    setScroll(actions, 330, 330, 0);
    actions.dispatchEvent(new Event('scroll'));

    expect(wrap.classList.contains('is-fade-start')).toBe(false);
    expect(wrap.classList.contains('is-fade-end')).toBe(false);
    toolbar.destroy();
  });

  it('the 1px tolerance keeps subpixel rounding from flickering at the exact ends', () => {
    const toolbar = mount();
    const { wrap, actions } = parts(toolbar);
    // overflow = 1px: not scrollable; scrollLeft 1px into a 100px overflow: already at the end.
    setScroll(actions, 331, 330, 0);
    actions.dispatchEvent(new Event('scroll'));
    expect(wrap.classList.contains('is-fade-end')).toBe(false);

    setScroll(actions, 430, 330, 99); // overflow 100, at 99 → within 1px of the end
    actions.dispatchEvent(new Event('scroll'));
    expect(wrap.classList.contains('is-fade-end')).toBe(false);
    expect(wrap.classList.contains('is-fade-start')).toBe(true);
    toolbar.destroy();
  });

  it('a window resize re-evaluates the fades without a scroll event', () => {
    const toolbar = mount();
    const { wrap, actions } = parts(toolbar);
    setScroll(actions, 330, 330, 0); // everything fits → no fades
    actions.dispatchEvent(new Event('scroll'));
    expect(wrap.classList.contains('is-fade-end')).toBe(false);

    // The pane grew content (e.g. labels reflowed) — metrics changed, resize fires (SAD-375 wiring).
    setScroll(actions, 900, 330, 0);
    window.dispatchEvent(new Event('resize'));

    expect(wrap.classList.contains('is-fade-end'), 'resize picks up new overflow').toBe(true);
    toolbar.destroy();
  });

  it('update() re-evaluates the fades — construction and model updates both sync', () => {
    const toolbar = mount();
    const { wrap, actions } = parts(toolbar);
    setScroll(actions, 900, 330, 570);
    toolbar.update({
      fields: FIELDS,
      view: createDefaultView(FIELDS),
      visibleRowCount: 5,
      totalRowCount: 5,
      search: '',
      query: '',
      queryError: null,
      theme: 'light',
    });
    expect(wrap.classList.contains('is-fade-start')).toBe(true);
    expect(wrap.classList.contains('is-fade-end')).toBe(false);
    toolbar.destroy();
  });

  it('destroy() detaches cleanly — a late scroll event on the removed scroller does not throw', () => {
    const toolbar = mount();
    const { actions } = parts(toolbar);
    toolbar.destroy();
    expect(() => actions.dispatchEvent(new Event('scroll'))).not.toThrow();
  });

  it('the wrapper wraps the scroller and every tool stays a direct button of the scroller', () => {
    const toolbar = mount();
    const { wrap, actions } = parts(toolbar);
    expect(actions.parentElement, 'scroller must sit inside the fade wrapper').toBe(wrap);
    const buttons = [...actions.querySelectorAll(':scope > button')];
    expect(buttons.map((b) => b.dataset.action)).toEqual([
      'undo',
      'redo',
      'add-field',
      'add-row',
      'filter',
      'sync',
      'options',
    ]);
    toolbar.destroy();
  });
});
