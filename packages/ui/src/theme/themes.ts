import {
  colorTokens,
  radiusTokens,
  shadowTokens,
  spacingTokens,
  transitionTokens,
  typographyTokens,
} from './designTokens';
import type { AppTheme, ThemeColors } from './theme.types';

const lightColors: ThemeColors = {
  background: { primary: '#F1F5F9', secondary: '#FFFFFF', tertiary: '#F8FAFC' },
  surface: { primary: '#FFFFFF', secondary: '#F1F5F9', overlay: 'rgba(15, 23, 42, 0.1)' },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    tertiary: '#94A3B8',
    disabled: '#CBD5E1',
    inverse: '#FFFFFF',
  },
  border: {
    primary: '#E2E8F0',
    secondary: '#F1F5F9',
    focus: colorTokens.primary[500],
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
    secondary: '#EFF6FF',
  },
};

const darkColors: ThemeColors = {
  background: { primary: '#020617', secondary: '#0F172A', tertiary: '#1E293B' },
  surface: { primary: '#0F172A', secondary: '#1E293B', overlay: 'rgba(2, 6, 23, 0.7)' },
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    tertiary: '#64748B',
    disabled: '#475569',
    inverse: '#0F172A',
  },
  border: {
    primary: '#1E293B',
    secondary: '#334155',
    focus: colorTokens.primary[500],
  },
  semantic: {
    success: colorTokens.success.light,
    error: colorTokens.error.light,
    warning: colorTokens.warning.light,
    info: colorTokens.info.light,
  },
  brand: {
    primary: '#3B82F6',
    primaryHover: '#60A5FA',
    secondary: 'rgba(59, 130, 246, 0.1)',
  },
};

export const lightTheme: AppTheme = {
  mode: 'light',
  colors: lightColors,
  spacing: spacingTokens,
  radius: radiusTokens,
  shadows: shadowTokens,
  typography: typographyTokens,
  transitions: transitionTokens,
};

export const darkTheme: AppTheme = {
  mode: 'dark',
  colors: darkColors,
  spacing: spacingTokens,
  radius: radiusTokens,
  shadows: shadowTokens,
  typography: typographyTokens,
  transitions: transitionTokens,
};