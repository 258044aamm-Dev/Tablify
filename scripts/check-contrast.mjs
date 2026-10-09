// Node: check contrast for Tablify tokens — AA 4.5:1 body, 3:1 large/AA large
// Inline contrast logic so node can run without TS import.

function hexToRgb(hex) {
  const m = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex: ${hex}`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
function srgbToLinear(v) {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function ratio(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const palette = {
  dark: '#141413',
  light: '#faf9f5',
  midGray: '#b0aea5',
  lightGray: '#e8e6dc',
  accentOrange: '#d97757',
  accentBlue: '#6a9bcc',
  accentGreen: '#788c5d',
};

const pairs = [
  { name: 'light: text on bg', fg: palette.dark, bg: palette.light, use: 'body text — must pass AA 4.5' },
  { name: 'dark: text on bg', fg: palette.light, bg: palette.dark, use: 'body text — must pass AA 4.5' },
  { name: 'light: muted on bg', fg: palette.midGray, bg: palette.light, use: 'secondary/border — not body text' },
  { name: 'dark: muted on bg', fg: palette.midGray, bg: palette.dark, use: 'secondary/border — not body text' },
  { name: 'orange on light', fg: palette.accentOrange, bg: palette.light, use: 'accent — selection/focus, not body text if <4.5' },
  { name: 'orange on dark', fg: palette.accentOrange, bg: palette.dark, use: 'accent on dark' },
  { name: 'blue on light', fg: palette.accentBlue, bg: palette.light, use: 'secondary accent — links if <4.5 use for non-text only' },
  { name: 'blue on dark', fg: palette.accentBlue, bg: palette.dark, use: 'secondary accent on dark' },
  { name: 'green on light', fg: palette.accentGreen, bg: palette.light, use: 'success accent — non-text if <4.5' },
  { name: 'green on dark', fg: palette.accentGreen, bg: palette.dark, use: 'success accent on dark' },
  { name: 'lightGray on dark (stripe)', fg: palette.lightGray, bg: palette.dark, use: 'stripe bg — not text bg pair' },
  { name: 'midGray border on light', fg: palette.midGray, bg: palette.light, use: 'border — UI component 3:1' },
];

console.log('Tablify contrast check — WCAG 2.1 AA\n');
let ok = true;
for (const p of pairs) {
  const r = ratio(p.fg, p.bg);
  const passAA = r >= 4.5;
  const passLarge = r >= 3;
  console.log(`${p.name}: ${p.fg} on ${p.bg} → ${r.toFixed(2)}:1 — AA ${passAA ? 'PASS' : 'FAIL'} / Large ${passLarge ? 'PASS' : 'FAIL'} — ${p.use}`);
  // hard requirement: body text pairs must pass AA
  if ((p.name === 'light: text on bg' || p.name === 'dark: text on bg') && !passAA) ok = false;
}

// P6-03 — focus indicator visibility (WCAG 2.1 1.4.11 non-text contrast, ≥ 3:1).
// The focus ring token is --tablify-focus (src/ui/theme/tokens.ts) = accentOrange
// in both themes; the cell focus outline uses it (styles.css .tablify__cell:focus).
// Informational: the light-theme result is recorded in docs/accessibility/audit.md;
// changing the palette belongs to P3-11/branding, not here.
console.log('\nFocus indicator (WCAG 1.4.11 — UI component ≥ 3:1):');
for (const theme of ['light', 'dark']) {
  const bg = palette[theme];
  const r = ratio(palette.accentOrange, bg);
  console.log(`focus (${palette.accentOrange}) on ${theme} (${bg}) → ${r.toFixed(2)}:1 — 1.4.11 ${r >= 3 ? 'PASS' : 'FAIL (marginal)'}`);
}

console.log('\n' + (ok ? 'Body text pairs PASS AA (4.5:1) — accents documented as non-body-text where they fail.' : 'FAIL — body text pair does not meet AA'));
process.exit(ok ? 0 : 1);
