/**
 * Design tokens — single source for Tablify table UI.
 *
 * SAD-71 Step 2 (owner decision D-6, 2026-10-10): the palette now follows the design source
 * `Prototype/Anthropic Table Workspace.html` — a four-step surface ladder (bg → card →
 * inner → capsule) with subtle warm borders per theme — replacing the two-step summary in
 * the old branding.md §5, whose single mid-gray border (#b0aea5) drew bright 1px frames in
 * dark mode and whose surfaces had no card/inner/capsule distinction.
 * `spec/branding.md §5` carries the same table; keep the two in sync (tests enforce the
 * values here and the "derived only from palette" rule).
 *
 * Philosophy: “Good software should feel inevitable.” — clarity over complexity, utility over hype, craftsmanship over shortcuts.
 * Tokens are the inevitable foundation: every color in the grid must come from here.
 */

export const palette = {
  /** #181715 — dark theme background (prototype `dark`) */
  dark: '#181715',
  /** #FAF7F2 — light theme background (prototype `paper`) */
  light: '#FAF7F2',
  /** #22201D — dark card surface (prototype `dark-card`) */
  cardDark: '#22201D',
  /** #FFFFFF — light card surface (prototype `paper-card`) */
  cardLight: '#FFFFFF',
  /** #1B1A17 — dark inner surface: grid shell (prototype `dark-inner`) */
  innerDark: '#1B1A17',
  /** #F4EFE6 — light inner surface: grid shell (prototype `paper-inner`) */
  innerLight: '#F4EFE6',
  /** #262420 — dark capsule surface: cells, header capsules, popovers */
  capsuleDark: '#262420',
  /** #FFFFFF — light capsule surface (prototype cell/header capsules) */
  capsuleLight: '#FFFFFF',
  /** #38342E — dark subtle border (prototype `dark-border`) */
  borderDark: '#38342E',
  /** #E6E0D5 — light subtle border (prototype `paper-border`) */
  borderLight: '#E6E0D5',
  /** #24221E — dark pill surface: toolbar buttons, search input, float panels (prototype `.pill-btn`) */
  pillDark: '#24221E',
  /** #2D2A25 — dark pill hover surface (prototype `.pill-btn:hover`) */
  pillHoverDark: '#2D2A25',
  /** #4A453E — dark pill hover border (prototype `.pill-btn:hover`) */
  pillBorderHoverDark: '#4A453E',
  /** #F6F2EA — light pill hover surface (prototype `.pill-btn:hover`) */
  pillHoverLight: '#F6F2EA',
  /** #D3CAB9 — light pill hover border (prototype `.pill-btn:hover`) */
  pillBorderHoverLight: '#D3CAB9',
  /** #3A3630 — dark header/cell capsule border (prototype `.header-capsule`, `.cell-capsule`) */
  capsuleBorderDark: '#3A3630',
  /** #ECE7E1 — body text on dark surfaces */
  textOnDark: '#ECE7E1',
  /** #1E1B18 — body text on light surfaces (prototype `charcoal`) */
  textOnLight: '#1E1B18',
  /** #9CA3AF — muted small text on dark (prototype dark `gray-400`) */
  mutedDark: '#9CA3AF',
  /**
   * #6E655C — muted small text on light. The prototype's clay (#8C827A) measures 3.55:1 on
   * its paper background — below AA for the 11px labels it carries — so the accessible
   * clay variant ships instead; see docs/evidence/P3-11.md (SAD-71 Step 2).
   */
  mutedLight: '#6E655C',
  /** #d97757 — primary accent on dark (prototype `terracotta-dark`), focus, selection */
  accentOrange: '#d97757',
  /** #CC785C — primary accent on light (prototype `terracotta`), focus, selection */
  terracotta: '#CC785C',
  /** #6a9bcc — secondary accent (links, info) */
  accentBlue: '#6a9bcc',
  /** #788c5d — success and tertiary accent */
  accentGreen: '#788c5d',
  /** #6B7280 — dark header grip glyph (prototype dark `gray-500`) */
  gripDark: '#6B7280',
  /** #B7B2AE — light header grip glyph: prototype `clay/50` composited on the white capsule */
  gripLight: '#B7B2AE',
  /** #4B5563 — dark empty-cell dash and row-number grip (prototype dark `gray-600`) */
  placeholderDark: '#4B5563',
  /** #C5C1BE — light empty-cell dash: prototype `clay/40` composited on the white capsule */
  placeholderLight: '#C5C1BE',
  /**
   * #B5573A — light "N selected" ink. The prototype's terracotta (#CC785C) is 3.28:1 on the
   * white card, below AA for its 11px text; this is the nearest AA shade (4.78:1), the same
   * rule as mutedLight (SAD-80).
   */
  terracottaTextLight: '#B5573A',
  /** #DC2626 — light Delete ink (Tailwind red-600, 4.83:1). Prototype red-500 is 3.76:1 (SAD-80). */
  dangerLight: '#DC2626',
  /** #F87171 — dark Delete ink (Tailwind red-400, 5.87:1). Prototype red-500 is 4.32:1 (SAD-80). */
  dangerDark: '#F87171',
  /** #D1D5DB — light switch track when off (prototype Options `bg-gray-300`, SAD-81) */
  switchOffLight: '#D1D5DB',
} as const;

/**
 * SAD-81: select-option chip colours — the prototype's `OPT_COLORS` (Tailwind 500 for the dot,
 * fill and border, 700 / 300 for the ink in light / dark). Each entry: [500, light ink, dark ink].
 *
 * AA variants: on light, emerald / amber / pink 700 over their 15 % tint measure 4.22 / 3.98 /
 * 4.44:1, short of 4.5:1 for 11 px text, so those three light inks are the 800 shade (5.91 /
 * 5.62 / 5.80:1). Every dark ink and the other light inks are the prototype's.
 */
const chipHues = {
  gray: ['#6B7280', '#4B5563', '#D1D5DB'],
  sky: ['#0EA5E9', '#0369A1', '#7DD3FC'],
  emerald: ['#10B981', '#065F46', '#6EE7B7'],
  rose: ['#F43F5E', '#BE123C', '#FDA4AF'],
  amber: ['#F59E0B', '#92400E', '#FCD34D'],
  purple: ['#A855F7', '#7E22CE', '#D8B4FE'],
  pink: ['#EC4899', '#9D174D', '#F9A8D4'],
} as const;

/** Prototype gray dot (`bg-gray-400`) — the only hue whose dot is not its 500 shade. */
const chipGrayDot = '#9CA3AF';

/**
 * Plugin option colours (FORMAT_SPEC §3.2) onto the prototype's chip hues. The prototype has no
 * brown / orange / yellow; all three take its one warm hue, amber.
 */
const chipHueFor: Record<string, keyof typeof chipHues> = {
  gray: 'gray',
  brown: 'amber',
  orange: 'amber',
  yellow: 'amber',
  green: 'emerald',
  blue: 'sky',
  purple: 'purple',
  pink: 'pink',
  red: 'rose',
};

export interface OptionChipColors {
  background: string;
  border: string;
  text: string;
  dot: string;
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * SAD-81: paint for a select-option chip (prototype `FT.single_select.fmt`): 15 % fill and 30 %
 * border of the hue, 700 / 300 ink, solid dot. Unknown colours fall back to gray, as
 * `optColor()` does.
 */
export function optionChipColors(color: string | undefined, theme: ThemeName): OptionChipColors {
  const hue = chipHueFor[color ?? ''] ?? 'gray';
  const [base, inkLight, inkDark] = chipHues[hue];
  return {
    background: withAlpha(base, 0.15),
    border: withAlpha(base, 0.3),
    text: theme === 'dark' ? inkDark : inkLight,
    dot: hue === 'gray' ? chipGrayDot : base,
  };
}

// Keep palette values as the only literals — tests enforce no hex outside this file.
export type Palette = typeof palette;

export interface Theme {
  bg: string;
  bgCard: string;
  bgInner: string;
  bgCapsule: string;
  /** Header / subtle surfaces. Kept for existing styles.css rules; maps into the ladder. */
  bgSubtle: string;
  /** Legacy striping slot; the capsule grid (SAD-71 Step 4) no longer stripes rows. */
  bgStripe: string;
  text: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  accentPrimary: string;
  accentSecondary: string;
  accentSuccess: string;
  selection: string;
  focus: string;
  /** Ink for text/glyphs painted on top of accentPrimary (AA-checked, unlike white). */
  onAccent: string;
  /** SAD-76: prototype `.pill-btn` / `.pill-input` surface (toolbar buttons, search, float panels). */
  bgPill: string;
  bgPillHover: string;
  borderPillHover: string;
  /** SAD-76: prototype `.header-capsule` / `.cell-capsule` border. */
  borderCapsule: string;
  /** SAD-77: prototype title ink (`text-tablify-charcoal dark:text-tablify-paper`). */
  textTitle: string;
  /** SAD-77: prototype title-link hover ink (`hover:text-tablify-charcoal dark:hover:text-white`). */
  textStrong: string;
  /**
   * SAD-79: decorative header grip glyph (prototype `text-tablify-clay/50 dark:text-gray-500`).
   * Decoration only — never carries text, so it is outside the AA text-contrast checks.
   */
  textFaint: string;
  /**
   * SAD-79: empty-cell em dash and row-number grip (prototype `text-tablify-clay/40
   * dark:text-gray-600`). A placeholder glyph, not content.
   */
  textPlaceholder: string;
  /** SAD-80: prototype `#selectionSummary` ink (`text-tablify-terracotta`), AA-adjusted on light. */
  textSelected: string;
  /** SAD-80: prototype Delete ink (`text-red-500`), AA-adjusted in both themes. */
  textDanger: string;
  /**
   * SAD-80: row checkbox tint (prototype `accent-tablify-terracotta`, no dark variant). A UI
   * control, so the 3:1 non-text bar applies — met by #CC785C in both themes.
   */
  accentCheck: string;
  /**
   * SAD-81: solid accent fill of the Options panel's active pills, Show buttons and switch
   * (prototype `bg-tablify-terracotta`, no dark variant). Text on it uses onAccent (AA), not
   * the prototype's white (3.28:1).
   */
  accentFill: string;
  /** SAD-81: switch track when off (prototype `bg-gray-300 dark:bg-gray-600`). */
  switchOff: string;
  /** SAD-81: switch knob (prototype `bg-white`, both themes). */
  switchKnob: string;
}

export const lightTheme: Theme = {
  bg: palette.light,
  bgCard: palette.cardLight,
  bgInner: palette.innerLight,
  bgCapsule: palette.capsuleLight,
  bgSubtle: palette.innerLight,
  bgStripe: palette.innerLight,
  text: palette.textOnLight,
  textMuted: palette.mutedLight,
  border: palette.borderLight,
  borderSubtle: palette.borderLight,
  accentPrimary: palette.terracotta,
  accentSecondary: palette.accentBlue,
  accentSuccess: palette.accentGreen,
  selection: palette.terracotta,
  focus: palette.terracotta,
  onAccent: palette.textOnLight,
  bgPill: palette.cardLight,
  bgPillHover: palette.pillHoverLight,
  borderPillHover: palette.pillBorderHoverLight,
  borderCapsule: palette.borderLight,
  textTitle: palette.textOnLight,
  textStrong: palette.textOnLight,
  textFaint: palette.gripLight,
  textPlaceholder: palette.placeholderLight,
  textSelected: palette.terracottaTextLight,
  textDanger: palette.dangerLight,
  accentCheck: palette.terracotta,
  accentFill: palette.terracotta,
  switchOff: palette.switchOffLight,
  switchKnob: palette.cardLight,
};

export const darkTheme: Theme = {
  bg: palette.dark,
  bgCard: palette.cardDark,
  bgInner: palette.innerDark,
  bgCapsule: palette.capsuleDark,
  bgSubtle: palette.capsuleDark,
  bgStripe: palette.cardDark,
  text: palette.textOnDark,
  textMuted: palette.mutedDark,
  border: palette.borderDark,
  borderSubtle: palette.borderDark,
  accentPrimary: palette.accentOrange,
  accentSecondary: palette.accentBlue,
  accentSuccess: palette.accentGreen,
  selection: palette.accentOrange,
  focus: palette.accentOrange,
  onAccent: palette.dark,
  bgPill: palette.pillDark,
  bgPillHover: palette.pillHoverDark,
  borderPillHover: palette.pillBorderHoverDark,
  borderCapsule: palette.capsuleBorderDark,
  textTitle: palette.light,
  textStrong: palette.cardLight,
  textFaint: palette.gripDark,
  textPlaceholder: palette.placeholderDark,
  textSelected: palette.terracotta,
  textDanger: palette.dangerDark,
  accentCheck: palette.terracotta,
  accentFill: palette.terracotta,
  switchOff: palette.placeholderDark,
  switchKnob: palette.cardLight,
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
} as const;

export type ThemeName = keyof typeof themes;

/**
 * CSS variable names for the theme. Single source so both JS and CSS stay in sync.
 */
export const cssVars = {
  bg: '--tablify-bg',
  bgCard: '--tablify-bg-card',
  bgInner: '--tablify-bg-inner',
  bgCapsule: '--tablify-bg-capsule',
  bgSubtle: '--tablify-bg-subtle',
  bgStripe: '--tablify-bg-stripe',
  text: '--tablify-text',
  textMuted: '--tablify-text-muted',
  border: '--tablify-border',
  borderSubtle: '--tablify-border-subtle',
  accentPrimary: '--tablify-accent-primary',
  accentSecondary: '--tablify-accent-secondary',
  accentSuccess: '--tablify-accent-success',
  selection: '--tablify-selection',
  focus: '--tablify-focus',
  onAccent: '--tablify-on-accent',
  bgPill: '--tablify-bg-pill',
  bgPillHover: '--tablify-bg-pill-hover',
  borderPillHover: '--tablify-border-pill-hover',
  borderCapsule: '--tablify-border-capsule',
  textTitle: '--tablify-text-title',
  textStrong: '--tablify-text-strong',
  textFaint: '--tablify-text-faint',
  textPlaceholder: '--tablify-text-placeholder',
  textSelected: '--tablify-text-selected',
  textDanger: '--tablify-text-danger',
  accentCheck: '--tablify-accent-check',
  accentFill: '--tablify-accent-fill',
  switchOff: '--tablify-switch-off',
  switchKnob: '--tablify-switch-knob',
} as const;

/**
 * Apply the active theme through a plugin-scoped CSS class on the table root.
 * Does NOT touch document.body or Obsidian's global theme.
 * Also sets CSS variables inline so styles.css can stay free of color literals.
 */
export function applyTheme(root: HTMLElement, theme: ThemeName): void {
  root.classList.remove('tablify--light', 'tablify--dark');
  root.classList.add('tablify', `tablify--${theme}`);
  const t = themes[theme];
  root.style.setProperty(cssVars.bg, t.bg);
  root.style.setProperty(cssVars.bgCard, t.bgCard);
  root.style.setProperty(cssVars.bgInner, t.bgInner);
  root.style.setProperty(cssVars.bgCapsule, t.bgCapsule);
  root.style.setProperty(cssVars.bgSubtle, t.bgSubtle);
  root.style.setProperty(cssVars.bgStripe, t.bgStripe);
  root.style.setProperty(cssVars.text, t.text);
  root.style.setProperty(cssVars.textMuted, t.textMuted);
  root.style.setProperty(cssVars.border, t.border);
  root.style.setProperty(cssVars.borderSubtle, t.borderSubtle);
  root.style.setProperty(cssVars.accentPrimary, t.accentPrimary);
  root.style.setProperty(cssVars.accentSecondary, t.accentSecondary);
  root.style.setProperty(cssVars.accentSuccess, t.accentSuccess);
  root.style.setProperty(cssVars.selection, t.selection);
  root.style.setProperty(cssVars.focus, t.focus);
  root.style.setProperty(cssVars.onAccent, t.onAccent);
  root.style.setProperty(cssVars.bgPill, t.bgPill);
  root.style.setProperty(cssVars.bgPillHover, t.bgPillHover);
  root.style.setProperty(cssVars.borderPillHover, t.borderPillHover);
  root.style.setProperty(cssVars.borderCapsule, t.borderCapsule);
  root.style.setProperty(cssVars.textTitle, t.textTitle);
  root.style.setProperty(cssVars.textStrong, t.textStrong);
  root.style.setProperty(cssVars.textFaint, t.textFaint);
  root.style.setProperty(cssVars.textPlaceholder, t.textPlaceholder);
  root.style.setProperty(cssVars.textSelected, t.textSelected);
  root.style.setProperty(cssVars.textDanger, t.textDanger);
  root.style.setProperty(cssVars.accentCheck, t.accentCheck);
  root.style.setProperty(cssVars.accentFill, t.accentFill);
  root.style.setProperty(cssVars.switchOff, t.switchOff);
  root.style.setProperty(cssVars.switchKnob, t.switchKnob);
}

/**
 * Helper for tests: every semantic token resolves to a non-empty hex value in both themes.
 */
export function allTokensResolved(): boolean {
  const keys = Object.keys(lightTheme) as (keyof Theme)[];
  return keys.every((k) => {
    const lv = lightTheme[k];
    const dv = darkTheme[k];
    return typeof lv === 'string' && lv.length > 0 && typeof dv === 'string' && dv.length > 0;
  });
}
