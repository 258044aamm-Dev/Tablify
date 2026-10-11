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

  // ---- SAD-71 Step 2: the prototype surface ladder ----

  it('body text passes AA on every ladder surface in both themes', () => {
    for (const [name, t] of [
      ['light', lightTheme],
      ['dark', darkTheme],
    ] as const) {
      for (const surface of [t.bg, t.bgCard, t.bgInner, t.bgCapsule]) {
        const ratio = contrastRatio(t.text, surface);
        expect(ratio, `${name}: text on ${surface} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('muted small text passes AA on every surface it is painted on', () => {
    // The prototype's raw clay (#8C827A) is 3.55:1 on paper — too low for the 11px labels
    // that carry it — so the ladder ships the accessible variant instead.
    for (const [name, t] of [
      ['light', lightTheme],
      ['dark', darkTheme],
    ] as const) {
      for (const surface of [t.bg, t.bgCard, t.bgInner, t.bgCapsule]) {
        const ratio = contrastRatio(t.textMuted, surface);
        expect(ratio, `${name}: muted on ${surface} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('subtle borders stay subtle in both themes (documented 1.4.11 deviation)', () => {
    // Prototype language: surface step + shadow carry the boundary, borders are dividers,
    // not the sole identifier of a control. Focus/selection carry the ≥3:1 duty instead.
    for (const [name, t] of [
      ['light', lightTheme],
      ['dark', darkTheme],
    ] as const) {
      const ratio = contrastRatio(t.borderSubtle, t.bg);
      expect(ratio, `${name}: borderSubtle on bg = ${ratio.toFixed(2)}:1`).toBeLessThan(3);
    }
  });

  it('focus and selection meet the 3:1 non-text floor in both themes', () => {
    // SAD-69 left the light focus ring at 2.96:1; the ladder's terracotta clears 3:1.
    expect(contrastRatio(lightTheme.focus, lightTheme.bg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(darkTheme.focus, darkTheme.bg)).toBeGreaterThanOrEqual(3);
  });

  it('accent ink passes AA on its theme accent (active pills, CTAs)', () => {
    // The prototype paints active pills white-on-terracotta (2.83:1); the ladder uses a
    // dark ink instead so 12px labels stay readable.
    expect(contrastRatio(lightTheme.onAccent, lightTheme.accentPrimary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkTheme.onAccent, darkTheme.accentPrimary)).toBeGreaterThanOrEqual(4.5);
  });

  it('SAD-80: selection summary and Delete ink pass AA 4.5:1 on the card in both themes', () => {
    // The prototype's terracotta (#CC785C) and red-500 (#EF4444) are 3.28:1 and 3.76:1 on the
    // white card, and red-500 is 4.32:1 on the dark card — too low for 11px text — so the
    // nearest AA shades ship where needed (same rule as mutedLight).
    for (const [name, t] of [
      ['light', lightTheme],
      ['dark', darkTheme],
    ] as const) {
      for (const key of ['textSelected', 'textDanger'] as const) {
        const ratio = contrastRatio(t[key], t.bgCard);
        expect(ratio, `${name}: ${key} ${t[key]} on bgCard ${t.bgCard} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(darkTheme.textSelected).toBe(palette.terracotta); // prototype value kept where it passes
  });

  it('SAD-80: the row checkbox tint is the prototype terracotta, as the light accent already is', () => {
    // A native checkbox: Chrome draws an auto-contrast tick on the fill and a grey border when
    // unchecked, so state never rests on the tint alone. The tint is #CC785C in both themes
    // (prototype `accent-tablify-terracotta`) — 2.86:1 on the light inner surface, the same
    // value the light focus/selection accent already uses (docs/accessibility/audit.md).
    expect(lightTheme.accentCheck).toBe(palette.terracotta);
    expect(darkTheme.accentCheck).toBe(palette.terracotta);
    expect(lightTheme.accentCheck).toBe(lightTheme.focus);
    expect(contrastRatio(darkTheme.accentCheck, darkTheme.bgInner)).toBeGreaterThanOrEqual(3);
  });
});
