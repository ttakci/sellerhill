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
    // Ramp deepened one step (was #f4f7ff / #eef3ff, both a hair off white) so
    // borderless white cards and drawer surfaces (surface.primary #fff) read
    // clearly against the page/drawer ground. Tint tracks the brand/sidebar
    // blue (#2563eb / sidebar #0c1f52) — R < G < B with G close to B, so it
    // reads as a cool azure, never lavender/purple. Ramp order: tertiary < primary.
    primary: '#e9f0fb',
    secondary: '#FFFFFF',
    tertiary: '#e0e9f7',
    /*
     * Page wash: clearly blue at the top, fading to near-white at the bottom —
     * the deep-navy sidebar reads as the top of one continuous surface instead
     * of a rail glued onto a flat page. The old ramp ran the other way (lightest
     * at the top, deepest at the bottom) and was too narrow to be seen at all.
     *
     * EVERY stop sits at hue ~213-216 (a clean azure: R < G < B with a wide
     * R->B spread). Do not raise R toward B here — the moment R meets B the wash
     * turns lavender, which is the one thing this gradient was rejected for.
     * The bottom stop stays a hair off #FFFFFF so white cards (surface.primary)
     * still lift off the page down there.
     */
    gradient:
      'linear-gradient(165deg, #d7e5fb 0%, #e3edfc 30%, #edf4fd 62%, #f4f8fe 100%)',
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
    // Darkened from #64748b: the old value fell to 4.28:1 on background.tertiary,
    // below AA. Darkened again when the background ramp was deepened (tertiary
    // #eef3ff -> #e0e9f7) so it still clears AA (4.85:1) on the new
    // background.tertiary and >=5:1 on every other surface it is used over.
    tertiary: '#586576',
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
    /* A hair darker than blue-100 (#dbeafe) — ~25% toward blue-200 — so an
       InfoMessage still reads as a distinct block on the near-white drawer
       canvas (background.primary ≈ #f4f7ff) without a white card behind it. */
    infoStrong: '#d4e6fe',
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
    /*
     * The hero used to be unconditionally dark in BOTH themes. It is now a
     * light, airy surface in the light theme — the landing follows the app's
     * theme like every other page, and `heroText` is real ink here. Anything
     * that sits on a brand-coloured fill must use `onAccent` instead.
     */
    /*
     * A hair off pure white. Cards are `surface.primary` (#FFFFFF), so they
     * lift off the page instead of dissolving into it — the cheapest and most
     * reliable way to make a light layout read as layered rather than flat.
     */
    heroBg: '#FBFCFE',
    auroraBg: '#070B1A',
    heroGlow: 'rgba(37, 99, 235, 0.17)',
    heroGlowAlt: 'rgba(124, 58, 237, 0.13)',
    heroGrid: 'rgba(15, 23, 42, 0.045)',
    heroText: '#27272a',
    heroTextMuted: '#475569',
    heroBorder: 'rgba(15, 23, 42, 0.07)',
    onAccent: '#FFFFFF',
    shadowSoft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 28px -10px rgba(37, 99, 235, 0.13)',
    shadowStrong: '0 2px 6px rgba(15, 23, 42, 0.05), 0 28px 56px -18px rgba(37, 99, 235, 0.22)',
    /* Marketing accents — feature cards cycle these so the grid doesn't read as one blue wall. */
    accentBlue: '#3B82F6',
    accentViolet: '#8B5CF6',
    accentEmerald: '#10B981',
    accentAmber: '#F59E0B',
    accentRose: '#F43F5E',
    statsBg: '#F5F8FD',
    accentPurple: '#818CF8',
    accentCyan: '#22D3EE',
    gradientText: 'linear-gradient(135deg, #60A5FA 0%, #818CF8 50%, #A78BFA 100%)',
    cardGlow: 'rgba(66, 99, 235, 0.08)',
    cardBorder: 'rgba(15, 23, 42, 0.06)',
    cardBorderHover: 'rgba(37, 99, 235, 0.32)',
    chipBg: 'rgba(37, 99, 235, 0.07)',
    chipBorder: 'rgba(37, 99, 235, 0.16)',
    /* Blue-tinted rather than neutral slate — reads warmer next to the brand. */
    sectionAlt: '#F5F8FD',
    sectionDeep: '#EFF4FB',
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
    infoStrong: 'rgba(96, 165, 250, 0.22)',
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
    auroraBg: '#050816',
    heroGlow: 'rgba(59, 130, 246, 0.34)',
    heroGlowAlt: 'rgba(139, 92, 246, 0.26)',
    heroGrid: 'rgba(148, 163, 184, 0.07)',
    heroText: '#F8FAFC',
    heroTextMuted: 'rgba(226, 232, 240, 0.70)',
    heroBorder: 'rgba(148, 163, 184, 0.14)',
    onAccent: '#FFFFFF',
    /* Dark elevation is real shadow, not a brand tint — a coloured glow on a
       near-black surface reads as haze rather than depth. */
    shadowSoft: '0 1px 2px rgba(0, 0, 0, 0.4), 0 10px 28px -10px rgba(0, 0, 0, 0.6)',
    shadowStrong: '0 2px 6px rgba(0, 0, 0, 0.45), 0 28px 56px -18px rgba(0, 0, 0, 0.7)',
    /* Same marketing accents as light — slightly lifted for contrast on near-black. */
    accentBlue: '#60A5FA',
    accentViolet: '#A78BFA',
    accentEmerald: '#34D399',
    accentAmber: '#FBBF24',
    accentRose: '#FB7185',
    statsBg: '#020617',
    accentPurple: '#A78BFA',
    accentCyan: '#22D3EE',
    gradientText: 'linear-gradient(135deg, #60A5FA 0%, #A78BFA 50%, #22D3EE 100%)',
    cardGlow: 'rgba(96, 165, 250, 0.06)',
    cardBorder: 'rgba(148, 163, 184, 0.13)',
    cardBorderHover: 'rgba(99, 102, 241, 0.45)',
    chipBg: 'rgba(99, 102, 241, 0.14)',
    chipBorder: 'rgba(129, 140, 248, 0.28)',
    sectionAlt: '#0A1020',
    sectionDeep: '#070B18',
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
