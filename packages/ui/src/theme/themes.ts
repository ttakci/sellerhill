import {
  colorTokens,
  radiusTokens,
  shadowTokens,
  spacingTokens,
  transitionTokens,
  typographyTokens,
} from './designTokens';
import type { AppTheme, ThemeColors } from './theme.types';

/**
 * Light Mode Colors
 */
const lightColors: ThemeColors = {
  background: {
    primary: colorTokens.neutral[50], // #F1F5F9
    secondary: colorTokens.neutral[0], // #FFFFFF
    tertiary: colorTokens.neutral[100], // #E2E8F0
  },

  surface: {
    primary: colorTokens.neutral[0], // #FFFFFF
    secondary: colorTokens.neutral[50], // #F1F5F9
  },

  text: {
    primary: colorTokens.neutral[700], // #1C2434 approximate (TailAdmin text)
    secondary: colorTokens.neutral[400], // #64748B
    tertiary: colorTokens.neutral[300], // #94A3B8
    disabled: colorTokens.neutral[200], // #CBD5E1
    inverse: colorTokens.neutral[0], // #FFFFFF
  },

  border: {
    primary: colorTokens.neutral[100], // #E2E8F0
    secondary: colorTokens.neutral[50], // #F1F5F9
    focus: colorTokens.primary[500], // #3C50E0
  },

  semantic: {
    success: colorTokens.success.main,
    error: colorTokens.error.main,
    warning: colorTokens.warning.main,
    info: colorTokens.info.main,
  },

  brand: {
    primary: colorTokens.primary[500],
    primaryHover: colorTokens.primary[700],
    secondary: colorTokens.primary[100],
  },
};

/**
 * Dark Mode Colors
 */
const darkColors: ThemeColors = {
  background: {
    primary: colorTokens.neutral[900], // #0f172a
    secondary: colorTokens.neutral[950], // #020617
    tertiary: colorTokens.neutral[800], // #1e293b
  },

  surface: {
    primary: colorTokens.neutral[1000], // #1e293b (Card background)
    secondary: colorTokens.neutral[700], // #334155 (Sub-border/lighter surface)
  },

  text: {
    primary: colorTokens.neutral[0], // #FFFFFF
    secondary: colorTokens.neutral[300], // #CBD5E1
    tertiary: colorTokens.neutral[400], // #94A3B8
    disabled: colorTokens.neutral[500], // #64748B
    inverse: colorTokens.neutral[1000], // #1e293b
  },

  border: {
    primary: colorTokens.neutral[700], // #334155
    secondary: colorTokens.neutral[600], // #475569
    focus: colorTokens.primary[500], // #3b82f6
  },

  semantic: {
    success: colorTokens.success.light,
    error: colorTokens.error.light,
    warning: colorTokens.warning.light,
    info: colorTokens.info.light,
  },

  brand: {
    primary: colorTokens.primary[500],
    primaryHover: colorTokens.primary[700],
    secondary: colorTokens.primary[900],
  },
};

/**
 * Light Theme
 */
export const lightTheme: AppTheme = {
  mode: 'light',
  colors: lightColors,
  spacing: spacingTokens,
  radius: radiusTokens,
  shadows: shadowTokens,
  typography: typographyTokens,
  transitions: transitionTokens,
};

/**
 * Dark Theme
 */
export const darkTheme: AppTheme = {
  mode: 'dark',
  colors: darkColors,
  spacing: spacingTokens,
  radius: radiusTokens,
  shadows: shadowTokens,
  typography: typographyTokens,
  transitions: transitionTokens,
};
