/**
 * Design tokens — single source for Tablify table UI.
 * Palette from spec/branding.md §5 (third-party summary, NOT verified against official Anthropic source).
 * G-B1 remains open; palette is labelled "unverified" until confirmed. See P3-11.
 *
 * Philosophy: “Good software should feel inevitable.” — clarity over complexity, utility over hype, craftsmanship over shortcuts.
 * Tokens are the inevitable foundation: every color in the grid must come from here.
 */

export const palette = {
  /** #141413 — primary text (light theme), dark theme background */
  dark: '#141413',
  /** #faf9f5 — light theme background, text on dark */
  light: '#faf9f5',
  /** #b0aea5 — secondary elements, borders */
  midGray: '#b0aea5',
  /** #e8e6dc — subtle backgrounds, row striping */
  lightGray: '#e8e6dc',
  /** #d97757 — primary accent, focus, selection */
  accentOrange: '#d97757',
  /** #6a9bcc — secondary accent (links, info) */
  accentBlue: '#6a9bcc',
  /** #788c5d — success and tertiary accent */
  accentGreen: '#788c5d',
  /**
   * #2a2926 — dark-theme row striping.
   * Added by Tablify; NOT part of the unverified third-party summary above.
   * The summary's mid-gray (#b0aea5) was reused for dark subtle/stripe surfaces and put
   * body text (#faf9f5) at 2.11:1 — a hard WCAG AA failure on every striped row.
   * This value gives 13.81:1 while staying a subtle step above the dark background.
   * See SAD-69 D and spec/branding.md §5.
   */
  darkSurface: '#2a2926',
  /**
   * #33322d — dark-theme header and subtle surfaces.
   * Added by Tablify for the same reason; 12.19:1 on body text, 1.44:1 against the
   * dark background so the header reads as a surface without becoming a divider.
   */
  darkHeader: '#33322d',
} as const;

// Keep palette values as the only literals — tests enforce no hex outside this file.
export type Palette = typeof palette;

export interface Theme {
  bg: string;
  bgSubtle: string;
  bgStripe: string;
  text: string;
  textMuted: string;
  border: string;
  accentPrimary: string;
  accentSecondary: string;
  accentSuccess: string;
  selection: string;
  focus: string;
}

export const lightTheme: Theme = {
  bg: palette.light,
  bgSubtle: palette.lightGray,
  bgStripe: palette.lightGray,
  text: palette.dark,
  textMuted: palette.midGray,
  border: palette.midGray,
  accentPrimary: palette.accentOrange,
  accentSecondary: palette.accentBlue,
  accentSuccess: palette.accentGreen,
  selection: palette.accentOrange,
  focus: palette.accentOrange,
};

export const darkTheme: Theme = {
  bg: palette.dark,
  // Was palette.midGray (#b0aea5) — 2.11:1 against body text. See SAD-69 D.
  bgSubtle: palette.darkHeader,
  bgStripe: palette.darkSurface,
  text: palette.light,
  textMuted: palette.midGray,
  border: palette.midGray,
  accentPrimary: palette.accentOrange,
  accentSecondary: palette.accentBlue,
  accentSuccess: palette.accentGreen,
  selection: palette.accentOrange,
  focus: palette.accentOrange,
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
  bgSubtle: '--tablify-bg-subtle',
  bgStripe: '--tablify-bg-stripe',
  text: '--tablify-text',
  textMuted: '--tablify-text-muted',
  border: '--tablify-border',
  accentPrimary: '--tablify-accent-primary',
  accentSecondary: '--tablify-accent-secondary',
  accentSuccess: '--tablify-accent-success',
  selection: '--tablify-selection',
  focus: '--tablify-focus',
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
  root.style.setProperty(cssVars.bgSubtle, t.bgSubtle);
  root.style.setProperty(cssVars.bgStripe, t.bgStripe);
  root.style.setProperty(cssVars.text, t.text);
  root.style.setProperty(cssVars.textMuted, t.textMuted);
  root.style.setProperty(cssVars.border, t.border);
  root.style.setProperty(cssVars.accentPrimary, t.accentPrimary);
  root.style.setProperty(cssVars.accentSecondary, t.accentSecondary);
  root.style.setProperty(cssVars.accentSuccess, t.accentSuccess);
  root.style.setProperty(cssVars.selection, t.selection);
  root.style.setProperty(cssVars.focus, t.focus);
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
