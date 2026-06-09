/**
 * LanguageSwitcher Types
 */

export interface LocaleOption {
  /** Locale code (e.g. 'en', 'tr') */
  code: string;
  /** Display name (e.g. 'English', 'Türkçe') */
  displayName: string;
}

export interface LanguageSwitcherProps {
  /** Currently active locale code */
  currentLocale: string;
  /** Available locale options */
  locales: LocaleOption[];
  /** Callback when user selects a new locale */
  onLocaleChange: (locale: string) => void;
  /** Display variant */
  variant?: 'default' | 'compact';
}
