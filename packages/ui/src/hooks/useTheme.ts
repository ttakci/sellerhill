import { useContext } from 'react';

import { ThemeContext } from '../context/ThemeContext';
import type { ThemeContextValue } from '../context/ThemeContext.types';

/**
 * Hook to access Theme context
 * Platform-agnostic: Works on Web & Mobile
 *
 * @throws Error if used outside ThemeProvider
 * @returns ThemeContextValue
 *
 * @example
 * ```typescript
 * const { theme, themeMode, toggleTheme } = useTheme();
 *
 * toggleTheme(); // Switch between light/dark
 * console.log(themeMode); // 'light' or 'dark'
 * ```
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
