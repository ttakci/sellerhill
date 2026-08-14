import { ThemeProvider as EmotionThemeProvider } from '@emotion/react';
import React, { createContext, useCallback, useMemo, useState } from 'react';

import type { ThemeMode } from '../theme/theme.types';
import { lightTheme } from '../theme/themes';

import type { ThemeContextValue } from './ThemeContext.types';

/**
 * Theme Context for dark/light mode
 * Platform-agnostic: Web & Mobile compatible
 */
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Phase 1: light mode only. Dark mode tokens (`darkTheme`) still exist but
 * have never been tested end-to-end, so switching is disabled here rather
 * than deleted — no localStorage read, no system-preference detection, no
 * toggle. Restore both once dark mode is actually verified.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode] = useState<ThemeMode>('light');

  const toggleTheme = useCallback(() => {
    // No-op: dark mode is disabled for phase 1.
  }, []);

  const setThemeMode = useCallback(() => {
    // No-op: dark mode is disabled for phase 1.
  }, []);

  const value = useMemo(
    () => ({
      theme: lightTheme,
      themeMode,
      toggleTheme,
      setThemeMode,
    }),
    [themeMode, toggleTheme, setThemeMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <EmotionThemeProvider theme={lightTheme}>{children}</EmotionThemeProvider>
    </ThemeContext.Provider>
  );
};
