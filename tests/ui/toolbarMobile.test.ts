/**
 * SAD-92 Step 10 — phone-width toolbar parity (owner decision D-1, 2026-10-11: match the
 * prototype exactly).
 *
 * At 390 px the prototype's toolbar buttons are plain flex items: they shrink and their labels
 * wrap ("Add Row" becomes two lines, so the pill is 74×54 and the row is 102 px tall, which is
 * what makes the card 588 px). The plugin pinned every button with `white-space: nowrap;
 * flex: 0 0 auto`, so the pills kept their intrinsic size and the row scrolled sideways
 * instead — the card measured 572 px and twelve mobile regions sat 26–61 % off the prototype.
 *
 * The fix is scoped to the phone breakpoint; the actions row keeps `overflow-x: auto` so a
 * shrunk row that still exceeds the viewport stays reachable (the prototype simply clips it).
 *
 * Fails on 6dbdf00 (no such rules inside the 639 px block).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

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
  const re = new RegExp(`([^{}]*\\${selector}[^{}]*)\\{([^}]*)\\}`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) out.push(m[2].replace(/\s+/g, ' ').trim());
  return out;
}

describe('SAD-92 — the phone toolbar shrinks and wraps like the prototype', () => {
  const block = phoneBlock(css);

  it('has a phone-width block that touches the toolbar buttons', () => {
    expect(block).not.toBe('');
    expect(bodies(block, '.tablify__toolbar-button').length).toBeGreaterThan(0);
  });

  it('lets the labelled buttons wrap their text instead of forcing one line', () => {
    const all = bodies(block, '.tablify__toolbar-button').join(' ');
    expect(all).toContain('white-space: normal');
    expect(all).not.toContain('white-space: nowrap');
  });

  it('lets the buttons shrink (flex 0 1 auto), never pins them (flex 0 0 auto)', () => {
    const all = bodies(block, '.tablify__toolbar-button').join(' ');
    expect(all).toContain('flex: 0 1 auto');
    expect(all).not.toContain('flex: 0 0 auto');
  });

  it('keeps the actions row scrollable so every control stays reachable', () => {
    const actions = bodies(css, '.tablify__toolbar-actions');
    expect(actions.join(' ')).toContain('overflow-x: auto');
  });

  it('does not change the desktop button rule (the pin stays outside the phone block)', () => {
    const desktop = bodies(css.replace(block, ''), '.tablify__toolbar-button').join(' ');
    expect(desktop).toContain('flex: 0 0 auto');
  });
});
