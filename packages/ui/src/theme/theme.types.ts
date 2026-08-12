import * as tokens from './designTokens';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // Background
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    gradient?: string;
  };

  // Surface (cards, modals)
  surface: {
    primary: string;
    secondary: string;
    overlay: string;
    loadingOverlay: string;
  };

  // Text
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    inverse: string;
  };

  // Border
  border: {
    primary: string;
    secondary: string;
    control: string;
    focus: string;
  };

  // Semantic
  semantic: {
    success: string;
    error: string;
    warning: string;
    info: string;
  };

  // Brand
  brand: {
    primary: string;
    primaryHover: string;
    secondary: string;
  };

  // Accent (emerald — for "Active" status, success emphasis, distinct from semantic.success)
  accent: {
    primary: string;
    primaryHover: string;
    secondary: string;
    foreground: string;
  };

  // Semantic tint backgrounds (for badges, tags)
  semanticTint: {
    success: string;
    error: string;
    warning: string;
    info: string;
    infoStrong: string;
    neutral: string;
  };

  /*
   * Data-table row states. These are their own tokens because the three states
   * must stay separable from each other: zebra striping, hover, and selection
   * were previously borrowed from `background.*` / `semanticTint.info`, which put
   * the selected row within ~3/255 of the even-row stripe and made hover in light
   * theme pure white — i.e. identical to the odd row.
   */
  table: {
    /** Even-row stripe. Neutral on purpose: selection is the chromatic state. */
    rowZebra: string;
    rowHover: string;
    rowSelected: string;
    /** Selected AND hovered — a selected row must still answer the pointer. */
    rowSelectedHover: string;
    /** Left accent bar on a selected row; carries the state without relying on hue. */
    rowSelectedAccent: string;
  };

  // Semantic border tints
  semanticTintBorder: {
    success: string;
    error: string;
    warning: string;
    info: string;
    neutral: string;
  };

  // Sidebar-specific (dark panel tokens)
  sidebar: {
    background: string;
    foreground: string;     // NEW — sidebar primary text color
    text: string;           // Alias of foreground (legacy compat — same value)
    textMuted: string;
    hover: string;
    active: string;
    accent: string;
    divider: string;
  };

  // Dashboard period card headers (Sellerboard-style bands) + chart/P&L palette
  dashboard: {
    /** Gradient band backgrounds for the period card headers (always-dark, theme-identical) */
    periodTodayGradient: string;
    periodThisWeekGradient: string;
    periodThisMonthGradient: string;
    periodThisYearGradient: string;
    /** Text on the (always dark) period bands — fixed in both themes */
    periodForeground: string;
    periodForegroundMuted: string;
    /** Chart series colors (net profit bars + sales/units/refunds lines) */
    seriesProfit: string;
    seriesSales: string;
    seriesUnits: string;
    seriesRefunds: string;
    /** P&L heat-map cell tints (applied through an opacity overlay) */
    heatPositive: string;
    heatNegative: string;
  };

  // Landing page specific tokens
  landing: {
    heroGradient: string;
    heroBg: string;
    /**
     * Base for the always-dark animated aurora panel (`MeshBackground`, used by
     * the auth pages). It draws white particles, so it must stay dark in BOTH
     * themes. It used to borrow `heroBg`, which was safe only while the hero
     * was itself unconditionally dark — the hero now follows the theme, so this
     * has its own token and the two must not be merged again.
     */
    auroraBg: string;
    heroGlow: string;
    heroGlowAlt: string;
    heroGrid: string;
    heroText: string;
    heroTextMuted: string;
    heroBorder: string;
    /**
     * Ink for text/icons sitting ON a brand-coloured surface (primary buttons,
     * filled badges). Always light in BOTH themes — unlike `heroText`, which
     * follows the hero surface and is dark ink in the light theme. Using
     * `heroText` on a blue button was correct only while the hero was
     * unconditionally dark; it is not anymore.
     */
    onAccent: string;
    /**
     * Elevation for landing surfaces. Tinted toward the brand rather than pure
     * black in the light theme — a neutral grey drop-shadow on a near-white
     * page is what makes a layout read as flat and generic, and the tint is
     * most of the difference between "template" and "premium".
     */
    shadowSoft: string;
    shadowStrong: string;
    /**
     * Marketing accent hues, landing-only.
     *
     * The landing is deliberately more saturated than the app: the app is a
     * tool someone stares at all day and stays near-monochrome for that reason,
     * while this page has about four seconds to look alive. Feature cards cycle
     * through these so the grid does not read as one blue wall; each card's
     * icon plate derives its tint from its own accent via `color-mix`, so
     * adding a hue never needs a second background token.
     */
    accentBlue: string;
    accentViolet: string;
    accentEmerald: string;
    accentAmber: string;
    accentRose: string;
    statsBg: string;
    accentPurple: string;
    accentCyan: string;
    gradientText: string;
    cardGlow: string;
    cardBorder: string;
    cardBorderHover: string;
    chipBg: string;
    chipBorder: string;
    sectionAlt: string;
    sectionDeep: string;
    ring: string;
  };
}

export interface AppTheme {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: typeof tokens.spacingTokens;
  radius: typeof tokens.radiusTokens;
  /** Pixel radii for SVG/canvas consumers (charts) — mirrors `radius`. */
  radiusPx: typeof tokens.radiusPxTokens;
  shadows: typeof tokens.shadowTokens;
  typography: typeof tokens.typographyTokens;
  transitions: typeof tokens.transitionTokens;
  controls: typeof tokens.controlTokens;
  /** Overlay stacking order — never hardcode a z-index. */
  zIndex: typeof tokens.zIndexTokens;
  /** Responsive tiers — never hardcode a breakpoint literal. */
  breakpoints: typeof tokens.breakpointTokens;
}