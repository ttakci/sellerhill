import { radiusTokens, shadowTokens, spacingTokens, transitionTokens, typographyTokens } from './designTokens';
import type { AppTheme, ThemeColors } from './theme.types';

/*
 * Color Hierarchy (Light):
 * Canvas:        background.primary   (#F8FAFC) — page background
 * Panel:         surface.primary      (#FFFFFF) — cards, tables, inputs
 * Panel accent:  surface.secondary    (#F9FAFB) — subtle panel sections
 * Inner element: background.tertiary  (#F1F5F9) — stat rows, nested boxes, table headers
 * Divider:       background.secondary (#FFFFFF) + border.primary (#E5E7EB)
 */
const lightColors: ThemeColors = {
  background: {
    primary: '#F8FAFC',   // Canvas - page background
    secondary: '#FFFFFF',  // Clean white divider areas
    tertiary: '#F1F5F9',  // Inner elements - stat rows, table headers
  },

  surface: {
    primary: '#FFFFFF',    // Panels - cards, tables, inputs
    secondary: '#F9FAFB',  // Panel accent - subtle section backgrounds
    overlay: 'rgba(16, 24, 40, 0.4)',
  },

  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    disabled: '#D1D5DB',
    inverse: '#FFFFFF',
  },

  border: {
    primary: '#E5E7EB',
    secondary: '#F3F4F6',
    focus: '#3B82F6',
  },

  semantic: {
    success: '#059669',
    error: '#DC2626',
    warning: '#D97706',
    info: '#2563EB',
  },

  brand: {
    primary: '#3B82F6',
    primaryHover: '#2563EB',
    secondary: '#EFF6FF',
  },

  semanticTint: {
    success: '#ECFDF5',
    error: '#FEF2F2',
    warning: '#FFFBEB',
    info: '#EFF6FF',
    neutral: '#F3F4F6',
  },

  semanticTintBorder: {
    success: '#A7F3D0',
    error: '#FECACA',
    warning: '#FDE68A',
    info: '#BFDBFE',
    neutral: '#E5E7EB',
  },
};

/**
 * TailAdmin-Inspired Dark Mode
 */
const darkColors: ThemeColors = {
  background: {
    primary: '#0F172A',
    secondary: '#0F172A',
    tertiary: '#1E293B',
  },

  surface: {
    primary: '#1E293B',
    secondary: '#0F172A',
    overlay: 'rgba(2, 6, 23, 0.8)',
  },

  text: {
    primary: '#F9FAFB',
    secondary: '#9CA3AF',
    tertiary: '#6B7280',
    disabled: '#4B5563',
    inverse: '#111827',
  },

  border: {
    primary: '#374151',
    secondary: '#1F2937',
    focus: '#3B82F6',
  },

  semantic: {
    success: '#34D399',
    error: '#F87171',
    warning: '#FBBF24',
    info: '#60A5FA',
  },

  brand: {
    primary: '#3B82F6',
    primaryHover: '#60A5FA',
    secondary: 'rgba(59, 130, 246, 0.1)',
  },

  semanticTint: {
    success: 'rgba(52, 211, 153, 0.1)',
    error: 'rgba(248, 113, 113, 0.1)',
    warning: 'rgba(251, 191, 36, 0.1)',
    info: 'rgba(96, 165, 250, 0.1)',
    neutral: 'rgba(107, 114, 128, 0.1)',
  },

  semanticTintBorder: {
    success: 'rgba(52, 211, 153, 0.2)',
    error: 'rgba(248, 113, 113, 0.2)',
    warning: 'rgba(251, 191, 36, 0.2)',
    info: 'rgba(96, 165, 250, 0.2)',
    neutral: 'rgba(107, 114, 128, 0.2)',
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
