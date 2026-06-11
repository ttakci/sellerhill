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
    text: string;
    textMuted: string;
    hover: string;
    active: string;
    accent: string;
    divider: string;
  };

  // Landing page specific tokens
  landing: {
    heroGradient: string;
    statsBg: string;
    accentPurple: string;
    gradientText: string;
    cardGlow: string;
    sectionAlt: string;
  };
}

export interface AppTheme {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: typeof tokens.spacingTokens;
  radius: typeof tokens.radiusTokens;
  shadows: typeof tokens.shadowTokens;
  typography: typeof tokens.typographyTokens;
  transitions: typeof tokens.transitionTokens;
}