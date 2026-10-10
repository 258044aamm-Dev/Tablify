import { describe, it, expect } from 'vitest';
import { contrastRatio, meetsAA } from '../../src/ui/theme/contrast.js';
import { palette, lightTheme, darkTheme } from '../../src/ui/theme/tokens.js';

describe('P3-11 — Contrast and visual verification', () => {
  it('light theme body text on bg passes AA 4.5:1', () => {
    const ratio = contrastRatio(lightTheme.text, lightTheme.bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(meetsAA(ratio)).toBe(true);
  });

  it('dark theme body text on bg passes AA 4.5:1', () => {
    const ratio = contrastRatio(darkTheme.text, darkTheme.bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(meetsAA(ratio)).toBe(true);
  });

  it('accent orange on light fails AA for body text — documented as non-text (selection/focus only)', () => {
    const ratio = contrastRatio(palette.accentOrange, palette.light);
    // 2.96, so <4.5 — must NOT be used for body text on light
    expect(ratio).toBeLessThan(4.5);
    // but passes on dark
    expect(contrastRatio(palette.accentOrange, palette.dark)).toBeGreaterThanOrEqual(4.5);
  });

  it('accent blue on light fails AA — non-text only on light, passes on dark', () => {
    expect(contrastRatio(palette.accentBlue, palette.light)).toBeLessThan(4.5);
    expect(contrastRatio(palette.accentBlue, palette.dark)).toBeGreaterThanOrEqual(4.5);
  });

  it('accent green on light fails AA body but passes large text (3:1) — still non-body-text', () => {
    const rLight = contrastRatio(palette.accentGreen, palette.light);
    expect(rLight).toBeLessThan(4.5);
    expect(rLight).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(palette.accentGreen, palette.dark)).toBeGreaterThanOrEqual(4.5);
  });

  it('body text on bgSubtle passes AA 4.5:1 in both themes (header and subtle surfaces)', () => {
    // SAD-69 D: styles.css paints .tablify__header with --tablify-bg-subtle, so body text
    // must be readable on that surface, not only on the base background.
    for (const [name, t] of [
      ['light', lightTheme],
      ['dark', darkTheme],
    ] as const) {
      const ratio = contrastRatio(t.text, t.bgSubtle);
      expect(ratio, `${name}: text ${t.text} on bgSubtle ${t.bgSubtle} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      expect(meetsAA(ratio), `${name}: bgSubtle fails AA`).toBe(true);
    }
  });

  it('body text on bgStripe passes AA 4.5:1 in both themes (striped rows)', () => {
    // SAD-69 D: odd rows are painted with --tablify-bg-stripe. Dark used the mid-gray
    // #b0aea5, which put body text at 2.11:1 — a hard AA failure on every other row.
    for (const [name, t] of [
      ['light', lightTheme],
      ['dark', darkTheme],
    ] as const) {
      const ratio = contrastRatio(t.text, t.bgStripe);
      expect(ratio, `${name}: text ${t.text} on bgStripe ${t.bgStripe} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      expect(meetsAA(ratio), `${name}: bgStripe fails AA`).toBe(true);
    }
  });

  it('muted/border on light fails AA — used for borders/striping, not body text', () => {
    const r = contrastRatio(palette.midGray, palette.light);
    expect(r).toBeLessThan(4.5);
    // UI components need 3:1; border on light is 2.11 <3, so it is used for secondary/border where contrast is not required for text
    expect(r).toBeLessThan(3);
  });
});
