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
    neutral: string;
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
    heroGlow: string;
    heroGlowAlt: string;
    heroGrid: string;
    heroText: string;
    heroTextMuted: string;
    heroBorder: string;
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