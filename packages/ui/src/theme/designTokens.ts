/**
 * Design System Color Tokens
 * Platform-agnostic color palette
 */
export const colorTokens = {
  // Brand Colors
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6', // Stitch Primary Blue
    700: '#1d4ed8',
    900: '#1e3a8a',
  },

  // Neutral Colors (Stitch Dark Mode focused)
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155', // Stitch Border Dark
    800: '#1e293b', // Stitch Card Background
    900: '#0f172a', // Stitch Main Background
    950: '#020617', // Sidebar Deep Dark
    1000: '#020617', // Consistent with 950 for deep surfaces
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
