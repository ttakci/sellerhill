import {
  controlTokens,
  radiusTokens,
  shadowTokens,
  spacingTokens,
  transitionTokens,
  typographyTokens,
} from './designTokens';
import type { AppTheme, ThemeColors } from './theme.types';

/*
 * Color Hierarchy (Light) — clear contrast, crisp UI (user preference).
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
    overlay: 'rgba(0, 0, 0, 0.5)',
    loadingOverlay: 'rgba(255, 255, 255, 0.7)',
  },

  text: {
    // Strong readable ink — not washed/silky
    primary: '#0f172a',
    secondary: '#475569',
    tertiary: '#64748b',
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
    foreground: '#ffffff',
    text: '#ffffff',
    textMuted: 'rgba(255, 255, 255, 0.65)',
    hover: '#162b6e',
    active: '#162b6e',
    accent: '#2563eb',
    divider: '#ffffff14',
    logoGlow: 'rgba(37, 99, 235, 0.3)',
  },

  dashboard: {
    periodToday: '#5b7fd6',
    periodThisWeek: '#5b9bb8',
    periodThisMonth: '#2a9d8f',
    periodLastMonth: '#3d9b6e',
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

const darkColors: ThemeColors = {
  background: {
    primary: '#09090f',
    secondary: '#0c1018',
    tertiary: '#1c1f2e',
  },

  surface: {
    primary: '#111318',
    secondary: '#1c1f2e',
    overlay: 'rgba(0, 0, 0, 0.7)',
    loadingOverlay: 'rgba(0, 0, 0, 0.7)',
  },

  text: {
    primary: '#e2e8f0',
    secondary: '#94a3b8',
    tertiary: '#64748b',
    disabled: '#4b5563',
    inverse: '#1e293b',
  },

  border: {
    primary: '#ffffff12',
    secondary: '#ffffff0a',
    focus: '#6366f1',
  },

  semantic: {
    success: '#34d399',
    error: '#f87171',
    warning: '#fbbf24',
    info: '#60a5fa',
  },

  brand: {
    primary: '#4f6ef7',
    primaryHover: '#6b85f8',
    secondary: 'rgba(79, 110, 247, 0.14)',
  },

  accent: {
    primary: '#10b981',
    primaryHover: '#34d399',
    secondary: 'rgba(16, 185, 129, 0.12)',
    foreground: '#6ee7b7',
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

  dashboard: {
    periodToday: '#6b8fe8',
    periodThisWeek: '#6aadc4',
    periodThisMonth: '#34b3a4',
    periodLastMonth: '#4cba88',
  },

  sidebar: {
    background: '#0d0f18',
    foreground: '#f1f5f9',
    text: '#f1f5f9',
    textMuted: 'rgba(148, 163, 184, 0.7)',
    hover: '#1c1f2e',
    active: '#1c1f2e',
    accent: '#6366f1',
    divider: '#ffffff12',
    logoGlow: 'rgba(99, 102, 241, 0.3)',
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
  controls: controlTokens,
};

export const darkTheme: AppTheme = {
  mode: 'dark',
  colors: darkColors,
  spacing: spacingTokens,
  radius: radiusTokens,
  shadows: shadowTokens,
  typography: typographyTokens,
  transitions: transitionTokens,
  controls: controlTokens,
};
