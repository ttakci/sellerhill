/**
 * Design System Color Tokens
 * Platform-agnostic color palette
 */
export const colorTokens = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#2563EB', // Brand Primary Blue
    700: '#1D4ED8',
    900: '#1E3A8A',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155', // Borders
    800: '#1E293B', // Dark Cards
    900: '#0F172A', // Dark Background
    950: '#020617', // Sidebar Deep Dark
    1000: '#020617',
  },
  success: {
    light: '#34D399',
    main: '#10B981',
    dark: '#059669',
  },
  error: {
    light: '#FB7185',
    main: '#F43F5E',
    dark: '#E11D48',
  },
  warning: {
    light: '#FBBF24',
    main: '#F59E0B',
    dark: '#D97706',
  },
  info: {
    light: '#60A5FA',
    main: '#3B82F6',
    dark: '#2563EB',
  },
} as const;

export const spacingTokens = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  xxl: '3rem', // 48px
  xxxl: '4rem', // 64px
} as const;

export const radiusTokens = {
  sm: '4px', // Badges
  md: '8px', // Buttons & Inputs
  lg: '12px', // Cards & Modals
  xl: '16px', // Large containers
  full: '9999px',
} as const;

export const shadowTokens = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -1px rgba(15, 23, 42, 0.06)',
  lg: '0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
  xl: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 10px 10px -5px rgba(15, 23, 42, 0.04)',
} as const;

export const typographyTokens = {
  fontFamily: {
    sans: "'Inter', 'Lexend', -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    xxl: '1.5rem',
    xxxl: '1.875rem',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.625,
  },
} as const;

export const transitionTokens = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;