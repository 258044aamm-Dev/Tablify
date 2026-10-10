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

// Mirrors src/ui/theme/tokens.ts. Kept in sync by hand; the vitest suite is the authority
// (tests/ui/contrast.test.ts imports the real tokens, so a drift fails the build).
const palette = {
  dark: '#181715',
  light: '#FAF7F2',
  midGray: '#b0aea5',
  lightGray: '#e8e6dc',
  accentOrange: '#d97757',
  terracotta: '#CC785C',
  accentBlue: '#6a9bcc',
  accentGreen: '#788c5d',
  // SAD-71 Step 2: prototype surface ladder (owner-approved D-6). Replaces the SAD-69 D
  // darkSurface/darkHeader stopgaps and the mid-gray border; see spec/branding.md §5.
  cardDark: '#22201D',
  cardLight: '#FFFFFF',
  innerDark: '#1B1A17',
  innerLight: '#F4EFE6',
  capsuleDark: '#262420',
  capsuleLight: '#FFFFFF',
  borderDark: '#38342E',
  borderLight: '#E6E0D5',
  textOnDark: '#ECE7E1',
  textOnLight: '#1E1B18',
  mutedDark: '#9CA3AF',
  mutedLight: '#6E655C',
};

const pairs = [
  // Body-text pairs. `required` means the script exits non-zero if any of them fails AA.
  { name: 'light: text on bg', fg: palette.textOnLight, bg: palette.light, use: 'body text', required: true },
  { name: 'light: text on card', fg: palette.textOnLight, bg: palette.cardLight, use: 'body text on card', required: true },
  { name: 'light: text on inner/shell', fg: palette.textOnLight, bg: palette.innerLight, use: 'body text on grid shell & header capsules', required: true },
  { name: 'light: text on capsule', fg: palette.textOnLight, bg: palette.capsuleLight, use: 'body text on cell capsules', required: true },
  { name: 'dark: text on bg', fg: palette.textOnDark, bg: palette.dark, use: 'body text', required: true },
  { name: 'dark: text on card', fg: palette.textOnDark, bg: palette.cardDark, use: 'body text on card', required: true },
  { name: 'dark: text on inner/shell', fg: palette.textOnDark, bg: palette.innerDark, use: 'body text on grid shell', required: true },
  { name: 'dark: text on capsule', fg: palette.textOnDark, bg: palette.capsuleDark, use: 'body text on cell/header capsules', required: true },
  // Muted small text (row counts, header labels, badges) — required since SAD-71 Step 2.
  { name: 'light: muted on bg', fg: palette.mutedLight, bg: palette.light, use: 'muted 11px labels', required: true },
  { name: 'light: muted on inner', fg: palette.mutedLight, bg: palette.innerLight, use: 'muted 11px labels on shell', required: true },
  { name: 'dark: muted on bg', fg: palette.mutedDark, bg: palette.dark, use: 'muted 11px labels', required: true },
  { name: 'dark: muted on capsule', fg: palette.mutedDark, bg: palette.capsuleDark, use: 'muted 11px labels on capsules', required: true },
  // Accent ink on accent (active pills, CTAs) — required since SAD-71 Step 2.
  { name: 'light: ink on terracotta', fg: palette.textOnLight, bg: palette.terracotta, use: 'active pill / CTA ink', required: true },
  { name: 'dark: ink on accent', fg: palette.dark, bg: palette.accentOrange, use: 'active pill / CTA ink', required: true },
  // Secondary and accent pairs — recorded, not gating.
  { name: 'orange on light', fg: palette.accentOrange, bg: palette.light, use: 'accent — selection/focus, not body text if <4.5' },
  { name: 'orange on dark', fg: palette.accentOrange, bg: palette.dark, use: 'accent on dark' },
  { name: 'terracotta on light', fg: palette.terracotta, bg: palette.light, use: 'light accent — focus/selection ≥3:1 non-text' },
  { name: 'blue on light', fg: palette.accentBlue, bg: palette.light, use: 'secondary accent — non-text only on light' },
  { name: 'blue on dark', fg: palette.accentBlue, bg: palette.dark, use: 'secondary accent on dark' },
  { name: 'green on light', fg: palette.accentGreen, bg: palette.light, use: 'success accent — non-text if <4.5' },
  { name: 'green on dark', fg: palette.accentGreen, bg: palette.dark, use: 'success accent on dark' },
  { name: 'light border on light bg', fg: palette.borderLight, bg: palette.light, use: 'subtle border — divider by design (D-6 deviation)' },
  { name: 'dark border on dark bg', fg: palette.borderDark, bg: palette.dark, use: 'subtle border — divider by design (D-6 deviation)' },
];

console.log('Tablify contrast check — WCAG 2.1 AA\n');
let ok = true;
const failed = [];
for (const p of pairs) {
  const r = ratio(p.fg, p.bg);
  const passAA = r >= 4.5;
  const passLarge = r >= 3;
  console.log(`${p.name}: ${p.fg} on ${p.bg} → ${r.toFixed(2)}:1 — AA ${passAA ? 'PASS' : 'FAIL'} / Large ${passLarge ? 'PASS' : 'FAIL'} — ${p.use}`);
  // hard requirement: every body-text surface must pass AA, not just the base background.
  if (p.required && !passAA) { ok = false; failed.push(p.name); }
}

// P6-03 — focus indicator visibility (WCAG 2.1 1.4.11 non-text contrast, ≥ 3:1).
// The focus ring token is --tablify-focus (src/ui/theme/tokens.ts) = accentOrange
// in both themes; the cell focus outline uses it (styles.css .tablify__cell:focus).
// Informational: the light-theme result is recorded in docs/accessibility/audit.md;
// changing the palette belongs to P3-11/branding, not here.
console.log('\nFocus indicator (WCAG 1.4.11 — UI component ≥ 3:1):');
for (const [theme, accent] of [['light', palette.terracotta], ['dark', palette.accentOrange]]) {
  const bg = palette[theme];
  const r = ratio(accent, bg);
  console.log(`focus (${accent}) on ${theme} (${bg}) → ${r.toFixed(2)}:1 — 1.4.11 ${r >= 3 ? 'PASS' : 'FAIL (marginal)'}`);
}

console.log('\n' + (ok
  ? 'All body-text surfaces PASS AA (4.5:1) — accents documented as non-body-text where they fail.'
  : `FAIL — body text does not meet AA on: ${failed.join(', ')}`));
process.exit(ok ? 0 : 1);
