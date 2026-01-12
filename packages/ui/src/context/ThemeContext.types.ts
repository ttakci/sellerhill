import type { AppTheme, ThemeMode } from '../theme/theme.types';

export interface ThemeContextValue {
  theme: AppTheme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}
