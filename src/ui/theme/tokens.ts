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
} as const;

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
