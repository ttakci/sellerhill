/**
 * Design System Color Tokens
 * Platform-agnostic color palette
 */
export const colorTokens = {
  // Brand Colors
  primary: {
    50: '#E0E7FF',
    100: '#C7D2FE',
    500: '#3C50E0', // TailAdmin Primary
    700: '#3143C9',
    900: '#1C2B91',
  },

  // Neutral Colors (Dark Mode focused)
  neutral: {
    0: '#FFFFFF',
    50: '#F1F5F9',
    100: '#E2E8F0',
    200: '#CBD5E1',
    300: '#94A3B8',
    400: '#64748B',
    500: '#475569',
    600: '#334155',
    700: '#1E293B',
    800: '#1C2434', // Secondary background (Sidebar)
    900: '#1A222C', // Main content background
    950: '#1B2430', // Surface secondary
    1000: '#24303F', // Surface primary (Cards)
  },

  // Semantic Colors
  success: {
    light: '#10B981',
    main: '#10B981',
    dark: '#047857',
  },

  error: {
    light: '#FB7185',
    main: '#F43F5E',
    dark: '#BE123C',
  },

  warning: {
    light: '#FBBF24',
    main: '#F59E0B',
    dark: '#B45309',
  },

  info: {
    light: '#60A5FA',
    main: '#3B82F6',
    dark: '#1D4ED8',
  },
} as const;

/**
 * Spacing tokens (rem-based)
 */
export const spacingTokens = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  xxl: '3rem', // 48px
  xxxl: '4rem', // 64px
} as const;

/**
 * Border radius tokens
 */
export const radiusTokens = {
  sm: '2px',
  md: '4px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
} as const;

/**
 * Shadow tokens
 */
export const shadowTokens = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  boxShadow: '0 11px 15px -7px rgba(0,0,0,.2),0 24px 38px 3px rgba(0,0,0,.14),0 9px 46px 8px rgba(0,0,0,.12)',
} as const;

/**
 * Typography tokens
 */
export const typographyTokens = {
  fontFamily: {
    sans: "'Inter', 'Lexend', sans-serif",
    mono: "'Fira Code', monospace",
  },
  fontSize: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    md: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    xxl: '1.5rem', // 24px
    xxxl: '1.75rem', // 28px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

/**
 * Transition tokens
 */
export const transitionTokens = {
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
} as const;
