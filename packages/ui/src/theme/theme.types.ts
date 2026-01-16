import * as tokens from './designTokens';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // Background
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
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