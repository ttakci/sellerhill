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
    primary: '#f4f7ff',
    secondary: '#FFFFFF',
    tertiary: '#eef3ff',
    gradient: 'linear-gradient(180deg, #FFFFFF 0%, #EEF2FF 40%, #F0F4FF 100%)',
  },

  surface: {
    primary: '#FFFFFF',
    secondary: '#f8fafc',
    overlay: 'rgba(16, 24, 40, 0.4)',
  },

  text: {
    primary: '#0d1526',
    secondary: '#475569',
    tertiary: '#94a3b8',
    disabled: '#cbd5e1',
    inverse: '#FFFFFF',
  },

  border: {
    primary: '#00000014',
    secondary: '#0000000a',
    focus: '#2563eb',
  },

  semantic: {
    success: '#059669',
    error: '#dc2626',
    warning: '#d97706',
    info: '#2563eb',
  },

  brand: {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    secondary: '#eef3ff',
  },

  accent: {
    primary: '#10b981',
    primaryHover: '#059669',
    secondary: '#ecfdf5',
    foreground: '#047857',
  },

  semanticTint: {
    success: '#ecfdf5',
    error: '#fef2f2',
    warning: '#fffbeb',
    info: '#eff6ff',
    neutral: '#f3f4f6',
  },

  semanticTintBorder: {
    success: '#a7f3d0',
    error: '#fecaca',
    warning: '#fde68a',
    info: '#bfdbfe',
    neutral: '#e5e7eb',
  },

  sidebar: {
    background: '#0c1f52',
    foreground: '#93c5fd',
    text: '#93c5fd',
    textMuted: 'rgba(147, 197, 253, 0.7)',
    hover: '#162b6e',
    active: '#162b6e',
    accent: '#2563eb',
    divider: '#ffffff14',
  },

  landing: {
    heroGradient: 'linear-gradient(135deg, #4263EB 0%, #6366F1 50%, #818CF8 100%)',
    heroBg: '#070B1A',
    heroGlow: 'rgba(66, 99, 235, 0.45)',
    heroGlowAlt: 'rgba(129, 140, 248, 0.32)',
    heroGrid: 'rgba(148, 163, 184, 0.08)',
    heroText: '#F8FAFC',
    heroTextMuted: 'rgba(226, 232, 240, 0.72)',
    heroBorder: 'rgba(148, 163, 184, 0.16)',
    statsBg: '#0B1226',
    accentPurple: '#818CF8',
    accentCyan: '#22D3EE',
    gradientText: 'linear-gradient(135deg, #60A5FA 0%, #818CF8 50%, #A78BFA 100%)',
    cardGlow: 'rgba(66, 99, 235, 0.08)',
    cardBorder: 'rgba(15, 23, 42, 0.08)',
    cardBorderHover: 'rgba(66, 99, 235, 0.35)',
    chipBg: 'rgba(66, 99, 235, 0.10)',
    chipBorder: 'rgba(66, 99, 235, 0.25)',
    sectionAlt: '#F8FAFC',
    sectionDeep: '#F1F5F9',
    ring: 'rgba(66, 99, 235, 0.40)',
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

  sidebar: {
    background: '#0c1427',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.6)',
    hover: 'rgba(255, 255, 255, 0.1)',
    active: 'rgba(255, 255, 255, 0.15)',
    accent: '#4263EB',
    divider: 'rgba(255, 255, 255, 0.1)',
  },

  landing: {
    heroGradient: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #818CF8 100%)',
    heroBg: '#050816',
    heroGlow: 'rgba(59, 130, 246, 0.40)',
    heroGlowAlt: 'rgba(129, 140, 248, 0.28)',
    heroGrid: 'rgba(148, 163, 184, 0.07)',
    heroText: '#F8FAFC',
    heroTextMuted: 'rgba(226, 232, 240, 0.70)',
    heroBorder: 'rgba(148, 163, 184, 0.14)',
    statsBg: '#020617',
    accentPurple: '#A78BFA',
    accentCyan: '#22D3EE',
    gradientText: 'linear-gradient(135deg, #60A5FA 0%, #A78BFA 50%, #22D3EE 100%)',
    cardGlow: 'rgba(96, 165, 250, 0.06)',
    cardBorder: 'rgba(148, 163, 184, 0.14)',
    cardBorderHover: 'rgba(99, 102, 241, 0.45)',
    chipBg: 'rgba(99, 102, 241, 0.14)',
    chipBorder: 'rgba(129, 140, 248, 0.30)',
    sectionAlt: '#0B1226',
    sectionDeep: '#070B1A',
    ring: 'rgba(99, 102, 241, 0.45)',
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
