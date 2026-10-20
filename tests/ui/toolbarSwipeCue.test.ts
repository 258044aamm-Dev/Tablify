/**
 * @vitest-environment jsdom
 *
 * SAD-375 — swipe discoverability for the mobile tool row: card-coloured edge fades.
 *
 * The phone toolbar already scrolls horizontally three tools at a time (SAD-308); this ticket
 * adds a subtle, scroll-aware gradient fade at each scroll edge so the gesture is discoverable.
 * These tests pin the stylesheet half of that work:
 *
 *   - The fade overlays live on `.tablify__toolbar-actions-wrap::before/::after` inside the
 *     existing `@media (max-width: 639px)` block — a non-scrolling wrapper is required because
 *     the fade must paint above the scrolling pills (plan §3.2).
 *   - Visibility is class-gated (`is-fade-start` / `is-fade-end` toggled by Toolbar.syncFade);
 *     the fades default to `opacity: 0`, are `pointer-events: none`, and use token colours only.
 *   - Nothing leaks to desktop: outside the phone block the wrapper carries no painting rules
 *     (the `prefers-reduced-motion` exception only kills the transition).
 *   - The SAD-308 declarations this ticket must not influence are still in place.
 *
 * Selectors are matched exactly (against each rule's selector list, comments stripped), so a
 * wrapper rule can never satisfy an assertion meant for the scroller — the substring helpers in
 * toolbarMobile.test.ts deliberately cannot tell `.tablify__toolbar-actions` from
 * `.tablify__toolbar-actions-wrap`.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');

/** The whole first at-rule block whose header contains `condition` — header included. */
function firstAtBlock(source: string, condition: string): string {
  const start = source.indexOf(condition);
  if (start < 0) return '';
  const open = source.indexOf('{', start);
  if (open < 0) return '';
  let depth = 1;
  for (let i = open + 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return '';
}

/** Inner text of every at-rule block whose header contains `condition` (e.g. all reduced-motion). */
function atBlockInners(source: string, condition: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const at = source.indexOf(condition, from);
    if (at < 0) break;
    const open = source.indexOf('{', at);
    if (open < 0) break;
    let depth = 1;
    let close = open + 1;
    while (close < source.length && depth > 0) {
      if (source[close] === '{') depth++;
      else if (source[close] === '}') depth--;
      close++;
    }
    out.push(source.slice(open + 1, close - 1));
    from = close;
  }
  return out;
}

interface Rule {
  selectors: string[];
  body: string;
}

/**
 * All rules of a CSS chunk, flattening nested at-rule blocks (their inner rules are collected,
 * the at-rule header itself is not a selector). Comments stripped first so they can never glue
 * onto a selector. Bodies are whitespace-normalised with trailing semicolons removed.
 */
function rulesOf(chunk: string): Rule[] {
  const clean = chunk.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Rule[] = [];
  let i = 0;
  while (i < clean.length) {
    const open = clean.indexOf('{', i);
    if (open < 0) break;
    const header = clean.slice(i, open).replace(/\s+/g, ' ').trim();
    let depth = 1;
    let j = open + 1;
    while (j < clean.length && depth > 0) {
      if (clean[j] === '{') depth++;
      else if (clean[j] === '}') depth--;
      j++;
    }
    if (depth > 0) break;
    const body = clean.slice(open + 1, j - 1);
    if (body.includes('{')) {
      out.push(...rulesOf(body)); // at-rule block — recurse to the real rules inside
    } else if (header) {
      out.push({
        selectors: header.split(',').map((s) => s.trim()).filter(Boolean),
        body: body.replace(/\s+/g, ' ').trim().replace(/;+$/, ''),
      });
    }
    i = j;
  }
  return out;
}

/** Declaration bodies of rules whose selector list contains `selector` exactly. */
function bodiesExact(chunk: string, selector: string): string[] {
  return rulesOf(chunk)
    .filter((r) => r.selectors.includes(selector))
    .map((r) => r.body);
}

/** Every selector in the chunk that contains `needle` as a substring. */
function selectorsContaining(chunk: string, needle: string): string[] {
  return rulesOf(chunk).flatMap((r) => r.selectors).filter((s) => s.includes(needle));
}

const phoneBlock = firstAtBlock(css, '@media (max-width: 639px)');
const phoneInner = phoneBlock.slice(phoneBlock.indexOf('{') + 1, phoneBlock.lastIndexOf('}'));
const desktopCss = css.replace(phoneBlock, '');

describe('SAD-375 — phone edge fades exist and are class-gated', () => {
  it('paints both fade overlays on the wrapper inside the phone block', () => {
    for (const sel of ['.tablify__toolbar-actions-wrap::before', '.tablify__toolbar-actions-wrap::after']) {
      const bodies = bodiesExact(phoneInner, sel);
      // The shared overlay rule plus the edge-specific geometry/gradient rule.
      const shared = bodies.find((b) => b.includes('content:'));
      expect(shared, `${sel} shared overlay rule`).toBeTruthy();
      expect(shared).toContain('position: absolute');
      expect(shared).toContain('pointer-events: none');
      expect(shared).toContain('opacity: 0');
      expect(shared).toContain('z-index: 1');
      expect(shared).toContain('transition: opacity 0.15s');
    }
    // The shared rule must carry BOTH pseudo selectors — one rule, two overlays.
    const sharedRule = rulesOf(phoneInner).find((r) => r.body.includes('content:'));
    expect(sharedRule?.selectors).toEqual([
      '.tablify__toolbar-actions-wrap::before',
      '.tablify__toolbar-actions-wrap::after',
    ]);
  });

  it('fades are card-token gradients — left to right on the start edge, right to left on the end edge', () => {
    const before = bodiesExact(phoneInner, '.tablify__toolbar-actions-wrap::before').find((b) =>
      b.includes('background'),
    );
    const after = bodiesExact(phoneInner, '.tablify__toolbar-actions-wrap::after').find((b) =>
      b.includes('background'),
    );
    expect(before).toContain('left: 0');
    expect(before).toContain('background: linear-gradient(to right, var(--tablify-bg-card) 30%, transparent)');
    expect(after).toContain('right: 0');
    expect(after).toContain('background: linear-gradient(to left, var(--tablify-bg-card) 30%, transparent)');
    // Token + transparent only — the no-hex test in theme.test.ts covers the whole stylesheet,
    // but pin the intent here so a future literal cannot sneak into these two rules either.
    expect(`${before} ${after}`).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('shows each fade only under its scroll-state class', () => {
    const bodies = [
      ...bodiesExact(phoneInner, '.tablify__toolbar-actions-wrap.is-fade-start::before'),
      ...bodiesExact(phoneInner, '.tablify__toolbar-actions-wrap.is-fade-end::after'),
    ];
    expect(bodies).toHaveLength(2);
    for (const body of bodies) expect(body).toBe('opacity: 1');
  });

  it('defaults to no fade state on the wrapper — classes come from Toolbar.syncFade', () => {
    // The wrapper's phone rule sizes the row and nothing else; painting lives on the pseudos.
    const body = bodiesExact(phoneInner, '.tablify__toolbar-actions-wrap')[0] ?? '';
    expect(body).toContain('flex: 1 1 100%');
    expect(body).toContain('width: 100%');
    expect(body).not.toContain('opacity: 1');
    expect(body).not.toContain('background');
  });

  it('prefers-reduced-motion turns the fade transition off (outside the phone block)', () => {
    const reducedInners = atBlockInners(css, '@media (prefers-reduced-motion: reduce)');
    expect(reducedInners.length).toBeGreaterThan(0);
    const bodies = reducedInners.flatMap((inner) => [
      ...bodiesExact(inner, '.tablify__toolbar-actions-wrap::before'),
      ...bodiesExact(inner, '.tablify__toolbar-actions-wrap::after'),
    ]);
    // Exactly one reduce-motion rule per overlay — and it only kills the transition.
    expect(bodies).toHaveLength(2);
    for (const body of bodies) expect(body).toBe('transition: none');
  });
});

describe('SAD-375 — the fade never leaks to desktop', () => {
  it('outside the phone block the wrapper has no painting rules — sizing only', () => {
    const body = bodiesExact(desktopCss, '.tablify__toolbar-actions-wrap')[0] ?? '';
    expect(body).toContain('position: relative');
    expect(body).toContain('display: flex');
    expect(body).toContain('flex: 0 1 auto');
    expect(body).not.toContain('background');
    expect(body).not.toContain('opacity');
    expect(body).not.toContain('content');
  });

  it('is-fade-start / is-fade-end selectors exist only inside the phone block', () => {
    expect(selectorsContaining(phoneInner, 'is-fade-start')).toHaveLength(1);
    expect(selectorsContaining(phoneInner, 'is-fade-end')).toHaveLength(1);
    expect(selectorsContaining(desktopCss, 'is-fade-start')).toEqual([]);
    expect(selectorsContaining(desktopCss, 'is-fade-end')).toEqual([]);
  });

  it('no gradient is painted for the wrapper outside the phone block (reduce-motion is transition-only)', () => {
    for (const rule of rulesOf(desktopCss).filter((r) =>
      r.selectors.some((s) => s.includes('tablify__toolbar-actions-wrap')),
    )) {
      expect(rule.body, rule.selectors.join(', ')).not.toContain('linear-gradient');
    }
  });
});

describe('SAD-375 — SAD-308 declarations are untouched', () => {
  it('the scroller still scrolls: overflow-x auto on desktop, smooth touch scrolling on phones', () => {
    const desktopScroller = bodiesExact(desktopCss, '.tablify__toolbar-actions')[0] ?? '';
    expect(desktopScroller).toContain('overflow-x: auto');
    expect(desktopScroller).toContain('flex: 0 1 auto');
    const phoneScroller = bodiesExact(phoneInner, '.tablify__toolbar-actions')[0] ?? '';
    expect(phoneScroller).toContain('flex: 1 1 100%');
    expect(phoneScroller).toContain('width: 100%');
    expect(phoneScroller).toContain('scroll-behavior: smooth');
  });

  it('phone tools are still sized to one third of the row — 3 tools at a time', () => {
    const button = bodiesExact(phoneInner, '.tablify button.tablify__toolbar-button')[0] ?? '';
    expect(button).toContain('flex: 0 0 calc((100% - 16px) / 3)');
    expect(button).toContain('min-width: calc((100% - 16px) / 3)');
    expect(button).toContain('max-width: calc((100% - 16px) / 3)');
  });
});
