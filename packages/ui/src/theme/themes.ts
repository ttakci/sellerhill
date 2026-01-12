import {
  colorTokens,
  spacingTokens,
  radiusTokens,
  shadowTokens,
  typographyTokens,
  transitionTokens,
} from './designTokens';
import type { AppTheme, ThemeColors } from './theme.types';

/**
 * Light Mode Colors
 */
const lightColors: ThemeColors = {
  background: {
    primary: colorTokens.neutral[0], // #FFFFFF
    secondary: colorTokens.neutral[50], // #FAFAFA
    tertiary: colorTokens.neutral[100], // #F5F5F5
  },

  surface: {
    primary: colorTokens.neutral[0], // #FFFFFF
    secondary: colorTokens.neutral[50], // #FAFAFA
  },

  text: {
    primary: colorTokens.neutral[900], // #212121
    secondary: colorTokens.neutral[600], // #757575
    tertiary: colorTokens.neutral[500], // #9E9E9E
    disabled: colorTokens.neutral[400], // #BDBDBD
    inverse: colorTokens.neutral[0], // #FFFFFF
  },

  border: {
    primary: colorTokens.neutral[300], // #E0E0E0
    secondary: colorTokens.neutral[200], // #EEEEEE
    focus: colorTokens.primary[500], // #2196F3
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
    primary: colorTokens.neutral[900], // #212121
    secondary: colorTokens.neutral[800], // #424242
    tertiary: colorTokens.neutral[700], // #616161
  },

  surface: {
    primary: colorTokens.neutral[800], // #424242
    secondary: colorTokens.neutral[700], // #616161
  },

  text: {
    primary: colorTokens.neutral[0], // #FFFFFF
    secondary: colorTokens.neutral[300], // #E0E0E0
    tertiary: colorTokens.neutral[400], // #BDBDBD
    disabled: colorTokens.neutral[600], // #757575
    inverse: colorTokens.neutral[900], // #212121
  },

  border: {
    primary: colorTokens.neutral[700], // #616161
    secondary: colorTokens.neutral[800], // #424242
    focus: colorTokens.primary[500], // #2196F3
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
