import { radiusTokens, shadowTokens, spacingTokens, transitionTokens, typographyTokens } from './designTokens';
import type { AppTheme, ThemeColors } from './theme.types';

/**
 * TailAdmin-Inspired Light Mode
 * Based on: https://react-demo.tailadmin.com/
 */
const lightColors: ThemeColors = {
  background: {
    primary: '#F8FAFC', // Standard SaaS Light Gray Canvas
    secondary: '#FFFFFF', // Surfaces
    tertiary: '#F1F5F9', // Alternative subtle background
  },

  surface: {
    primary: '#FFFFFF', // Pure white panels
    secondary: '#F1F5F9',
    overlay: 'rgba(16, 24, 40, 0.4)',
  },

  text: {
    primary: '#1C2434', // TailAdmin Deep Dark Blue/Gray
    secondary: '#64748B', // Slates-500
    tertiary: '#94A3B8', // Slates-400
    disabled: '#E2E8F0',
    inverse: '#FFFFFF',
  },

  border: {
    primary: '#E2E8F0', // Neutral Slate Border
    secondary: '#F1F5F9',
    focus: '#3B82F6',
  },

  semantic: {
    success: '#10B981', // Emerald-500
    error: '#FB4141', // Red
    warning: '#F59E0B', // Amber-500
    info: '#3C50E0',
  },

  brand: {
    primary: '#3B82F6', // Vibrant Mesh Blue
    primaryHover: '#2563EB', // Hover state
    secondary: '#EFF6FF', // Lightest blue tint
  },
};

/**
 * TailAdmin-Inspired Dark Mode
 */
const darkColors: ThemeColors = {
  background: {
    primary: '#0c1427', // Main Deep Navy
    secondary: '#0c1427', // Sidebar same as background
    tertiary: '#15223F',
  },

  surface: {
    primary: '#15223F', // Lighter navy for panels
    secondary: '#0c1427',
    overlay: 'rgba(2, 6, 23, 0.8)',
  },

  text: {
    primary: '#FFFFFF', // Main text
    secondary: '#98A2B3', // Secondary text
    tertiary: '#667085', // Tertiary text
    disabled: '#475569',
    inverse: '#101828',
  },

  border: {
    primary: '#1E293B', // Standard Dark Border
    secondary: '#0F172A',
    focus: '#3B82F6',
  },

  semantic: {
    success: '#12B76A',
    error: '#F97066',
    warning: '#FDB022',
    info: '#6172F3',
  },

  brand: {
    primary: '#3B82F6', // Consistent with Mesh & Light mode
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
