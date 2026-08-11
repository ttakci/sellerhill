import {
  breakpointTokens,
  controlTokens,
  radiusPxTokens,
  radiusTokens,
  shadowTokens,
  spacingTokens,
  transitionTokens,
  typographyTokens,
  zIndexTokens,
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
    // Softened 2026-08 (live user feedback: the near-black slate read too
    // harsh/cold). Was '#0f172a' (slate-900, blue-tinted near-black) — moved
    // to a neutral, slightly lighter charcoal so body/heading ink reads as a
    // soft black rather than a navy-tinted one. Still >=15:1 on every light
    // surface, well past AA.
    primary: '#27272a',
    secondary: '#475569',
    // Darkened from #64748b: the old value fell to 4.28:1 on background.tertiary
    // (#eef3ff), below AA. Now >=4.88:1 on every surface it is used over.
    tertiary: '#5d6b7f',
    disabled: '#cbd5e1',
    inverse: '#FFFFFF',
  },

  border: {
    primary: '#00000014',
    secondary: '#0000000a',
    control: '#cbd5e1',
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
    infoStrong: '#dbeafe',
    neutral: '#f3f4f6',
  },

  /* Zebra is neutral (was the blue-tinted `#eef3ff`, which competed with the
     blue selection); hover is a real step down from BOTH stripes (was `#FFFFFF`,
     identical to the odd row); selection is unmistakably chromatic. */
  table: {
    rowZebra: '#f8fafc',
    rowHover: '#eef2f7',
    rowSelected: '#dbeafe',
    rowSelectedHover: '#c7dcfd',
    rowSelectedAccent: '#2563eb',
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
  },

  dashboard: {
    /*
     * Period bands are conceptually ALWAYS-DARK (like the landing hero), so the
     * gradients are identical in both themes — a band that flips lightness would
     * need two sets of foreground tokens. Stops darkened from the original set:
     * white ink measured 3.08–3.85:1 on the light stops (below AA even for large
     * text on "This Week"). Now every stop is >=5.39:1 for `periodForeground`
     * and >=4.73:1 for `periodForegroundMuted`.
     */
    periodTodayGradient: 'linear-gradient(135deg, #3f63c2 0%, #2d4aa0 100%)',
    periodThisWeekGradient: 'linear-gradient(135deg, #33718e 0%, #245a73 100%)',
    periodThisMonthGradient: 'linear-gradient(135deg, #16766c 0%, #0e5d55 100%)',
    periodThisYearGradient: 'linear-gradient(135deg, #227249 0%, #175c39 100%)',
    periodForeground: '#ffffff',
    periodForegroundMuted: 'rgba(255, 255, 255, 0.9)',
    seriesProfit: '#10b981',
    seriesSales: '#2563eb',
    seriesUnits: '#8b5cf6',
    seriesRefunds: '#f59e0b',
    heatPositive: '#10b981',
    heatNegative: '#dc2626',
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
    // Lightened from #64748b: it measured 3.43:1 on surface.secondary and
    // 3.90:1 on surface.primary — failing AA in dark while passing in light.
    // Now >=4.61:1 on both, and still visibly dimmer than text.secondary.
    tertiary: '#7c899d',
    disabled: '#4b5563',
    inverse: '#1e293b',
  },

  border: {
    primary: '#ffffff12',
    secondary: '#ffffff0a',
    control: '#475569',
    // Must equal brand.primary. It was left at the old indigo #6366f1 when the
    // brand blue was retuned, so a focused Textarea/IconButton/ThemeToggle rang
    // in a different colour than a focused TextInput/Select in dark mode only.
    focus: '#4f6ef7',
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
    infoStrong: 'rgba(96, 165, 250, 0.18)',
    neutral: 'rgba(107, 114, 128, 0.1)',
  },

  /* Dark mirrors light: hover lifts UP from the row (it used to be `#0c1018`,
     darker than the odd row, so hover read as the row receding). */
  table: {
    rowZebra: '#15181f',
    rowHover: '#1e2331',
    rowSelected: 'rgba(96, 165, 250, 0.2)',
    rowSelectedHover: 'rgba(96, 165, 250, 0.28)',
    rowSelectedAccent: '#4f6ef7',
  },

  semanticTintBorder: {
    success: 'rgba(52, 211, 153, 0.2)',
    error: 'rgba(248, 113, 113, 0.2)',
    warning: 'rgba(251, 191, 36, 0.2)',
    info: 'rgba(96, 165, 250, 0.2)',
    neutral: 'rgba(107, 114, 128, 0.2)',
  },

  dashboard: {
    /* Identical to light — the bands are always-dark by design (see light block). */
    periodTodayGradient: 'linear-gradient(135deg, #3f63c2 0%, #2d4aa0 100%)',
    periodThisWeekGradient: 'linear-gradient(135deg, #33718e 0%, #245a73 100%)',
    periodThisMonthGradient: 'linear-gradient(135deg, #16766c 0%, #0e5d55 100%)',
    periodThisYearGradient: 'linear-gradient(135deg, #227249 0%, #175c39 100%)',
    periodForeground: '#ffffff',
    periodForegroundMuted: 'rgba(255, 255, 255, 0.9)',
    seriesProfit: '#34d399',
    seriesSales: '#60a5fa',
    seriesUnits: '#a78bfa',
    seriesRefunds: '#fbbf24',
    heatPositive: '#34d399',
    heatNegative: '#f87171',
  },

  sidebar: {
    background: '#0d0f18',
    foreground: '#f1f5f9',
    text: '#f1f5f9',
    textMuted: 'rgba(148, 163, 184, 0.7)',
    hover: '#1c1f2e',
    active: '#1c1f2e',
    accent: '#4f6ef7', // tracks brand.primary — was stale indigo #6366f1
    divider: '#ffffff12',
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
  radiusPx: radiusPxTokens,
  shadows: shadowTokens,
  typography: typographyTokens,
  transitions: transitionTokens,
  controls: controlTokens,
  zIndex: zIndexTokens,
  breakpoints: breakpointTokens,
};

export const darkTheme: AppTheme = {
  mode: 'dark',
  colors: darkColors,
  spacing: spacingTokens,
  radius: radiusTokens,
  radiusPx: radiusPxTokens,
  shadows: shadowTokens,
  typography: typographyTokens,
  transitions: transitionTokens,
  controls: controlTokens,
  zIndex: zIndexTokens,
  breakpoints: breakpointTokens,
};
