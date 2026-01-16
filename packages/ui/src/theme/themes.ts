import {
  radiusTokens,
  shadowTokens,
  spacingTokens,
  transitionTokens,
  typographyTokens
} from './designTokens';
import type { AppTheme, ThemeColors } from './theme.types';

/**
 * TailAdmin-Inspired Light Mode
 * Based on: https://react-demo.tailadmin.com/
 */
const lightColors: ThemeColors = {
  background: {
    primary: '#F9FAFB',   // Page background (very light gray)
    secondary: '#FFFFFF', // Cards, Sidebar, Header
    tertiary: '#F2F4F7',  // Hover states, subtle backgrounds
  },

  surface: {
    primary: '#FFFFFF',   // Main surfaces
    secondary: '#F1F5F9', // Subtle background for layout elements
    overlay: 'rgba(16, 24, 40, 0.4)', // Modal overlays
  },

  text: {
    primary: '#1C2434',   // TailAdmin Deep Dark Blue/Gray
    secondary: '#64748B', // Slates-500
    tertiary: '#94A3B8',  // Slates-400
    disabled: '#E2E8F0',
    inverse: '#FFFFFF',
  },

  border: {
    primary: '#E2E8F0',   // Main borders
    secondary: '#F1F5F9', // Subtle dividers
    focus: '#3C50E0',     // TailAdmin Primary Blue
  },

  semantic: {
    success: '#10B981',   // Emerald-500
    error: '#FB4141',     // Red
    warning: '#F59E0B',   // Amber-500
    info: '#3C50E0',
  },

  brand: {
    primary: '#3C50E0',      // TailAdmin Core Blue
    primaryHover: '#3142B9', // Darker shade
    secondary: '#EFF4FB',    // Lightest blue tint
  },
};

/**
 * TailAdmin-Inspired Dark Mode
 */
const darkColors: ThemeColors = {
  background: {
    primary: '#101828',   // Main dark background
    secondary: '#101828', // Cards, Sidebar (same as primary for seamless look)
    tertiary: '#1D2939',  // Hover states
  },

  surface: {
    primary: '#101828',
    secondary: '#1D2939',
    overlay: 'rgba(2, 6, 23, 0.7)',
  },

  text: {
    primary: '#FFFFFF',   // Main text
    secondary: '#98A2B3', // Secondary text
    tertiary: '#667085',  // Tertiary text
    disabled: '#475569',
    inverse: '#101828',
  },

  border: {
    primary: '#1D2939',   // Dark borders
    secondary: '#334155',
    focus: '#465FFF',
  },

  semantic: {
    success: '#12B76A',
    error: '#F97066',
    warning: '#FDB022',
    info: '#6172F3',
  },

  brand: {
    primary: '#6172F3',      // Lighter brand for dark mode
    primaryHover: '#7A8AF9',
    secondary: 'rgba(97, 114, 243, 0.1)',
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