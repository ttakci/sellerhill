import { ThemeProvider as EmotionThemeProvider } from '@emotion/react';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import type { ThemeMode } from '../theme/theme.types';
import { darkTheme, lightTheme } from '../theme/themes';

import type { ThemeContextValue } from './ThemeContext.types';

/**
 * Theme Context for dark/light mode
 * Platform-agnostic: Web & Mobile compatible
 */
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'app-theme-mode';

/**
 * Get initial theme from localStorage or system preference
 */
const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  // Check localStorage
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);

  const theme = themeMode === 'light' ? lightTheme : darkTheme;

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(THEME_STORAGE_KEY, themeMode);

    // Update document class for global styles
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(themeMode);
  }, [themeMode]);

  // Listen to system preference changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent): void => {
      const newMode = e.matches ? 'dark' : 'light';
      setThemeMode(newMode);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      themeMode,
      toggleTheme,
      setThemeMode,
    }),
    [theme, themeMode, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      <EmotionThemeProvider theme={theme}>{children}</EmotionThemeProvider>
    </ThemeContext.Provider>
  );
};
