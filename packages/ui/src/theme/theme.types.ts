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
  spacing: typeof import('./designTokens').spacingTokens;
  radius: typeof import('./designTokens').radiusTokens;
  shadows: typeof import('./designTokens').shadowTokens;
  typography: typeof import('./designTokens').typographyTokens;
  transitions: typeof import('./designTokens').transitionTokens;
}
