/**
 * Design System Color Tokens
 * Platform-agnostic color palette
 */
export const colorTokens = {
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    500: '#4263EB', // Insure Design System Primary
    600: '#3B5BD9', // Hover state
    650: '#3658D9', // Pressed state
    700: '#1D4ED8',
    900: '#1e3a8a',
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
  '2xs': '0.125rem', // 2px
  '2xs+': '0.1875rem', // 3px
  xs: '0.25rem', // 4px
  'xs+': '0.375rem', // 6px
  sm: '0.5rem', // 8px
  'sm+': '0.625rem', // 10px
  'sm-md': '0.75rem', // 12px
  'sm-md+': '0.875rem', // 14px
  md: '1rem', // 16px
  'md+': '1.25rem', // 20px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  xxl: '3rem', // 48px
  xxxl: '4rem', // 64px
} as const;

/**
 * Crisp corners (user preference) — uniform square surfaces.
 */
export const radiusTokens = {
  sm: '0.25rem', // 4px
  md: '0.25rem',
  lg: '0.25rem',
  xl: '0.25rem',
  '2xl': '0.25rem',
  full: '9999px',
} as const;

export const shadowTokens = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
  md: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
  lg: '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
  xl: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
} as const;

/**
 * Single UI typeface — Source Sans 3 (corporate / insurance-grade readability).
 * Chosen over Inter for a calmer institutional feel (TR-friendly, open counters).
 * Mono stays JetBrains Mono for codes / IDs only.
 */
export const typographyTokens = {
  fontFamily: {
    heading: "'Source Sans 3', 'Segoe UI', system-ui, -apple-system, sans-serif",
    body: "'Source Sans 3', 'Segoe UI', system-ui, -apple-system, sans-serif",
    sans: "'Source Sans 3', 'Segoe UI', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  fontSize: {
    '2xs': '0.625rem', // 10px - Micro labels, tiny badges
    xs: '0.75rem', // 12px - Captions, meta, helper
    sm: '0.875rem', // 14px - Dense UI / table cells
    md: '1rem', // 16px - Primary body (comfortable reading)
    lg: '1.125rem', // 18px - Section titles (h3)
    xl: '1.25rem', // 20px - Sub-section (h2)
    xxl: '1.5rem', // 24px - Page titles (h1)
    xxxl: '1.875rem', // 30px - Hero headings
    '3xl': '2.25rem', // 36px - Large hero headings
    '4xl': '3rem', // 48px - Display headings
    '5xl': '3.75rem', // 60px - Hero display
    '6xl': '4.5rem', // 72px - Massive hero
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.3,
    normal: 1.55,
    relaxed: 1.65,
  },
  letterSpacing: {
    tighter: '-0.015em',
    tight: '-0.01em',
    normal: '0.005em',
    wide: '0.02em',
    wider: '0.03em',
    widest: '0.06em',
  },
} as const;

/**
 * Shared form-control geometry. TextInput, Select, SearchField, Button medium
 * must resolve to the same heights so filter bars and forms align.
 *
 * - compact: no floating label (search, compact filters)
 * - labeled: floating label present (default forms)
 */
export const controlTokens = {
  height: {
    small: '2.5rem', // 40px compact
    medium: '2.75rem', // 44px compact default
    large: '3rem', // 48px compact
    smallLabeled: '3rem', // 48px
    mediumLabeled: '3.25rem', // 52px default forms
    largeLabeled: '3.75rem', // 60px
  },
  paddingX: '1rem', // 16px
  iconWidth: '2.75rem', // 44px
  fontSize: '0.875rem', // 14px — always match body/sm
  radius: '0.25rem',
} as const;

export const transitionTokens = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;
