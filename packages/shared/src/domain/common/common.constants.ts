/**
 * Common constants used across the application
 */

export const EMPTY_STRING = '';

/**
 * Supported locales / languages
 */
export const SUPPORTED_LOCALES = ['en', 'tr'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Display names for supported locales (used by LanguageSwitcher)
 */
export const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  tr: 'Türkçe',
};

/**
 * Check if a string is a valid supported locale
 */
export const isValidLocale = (locale: string): locale is SupportedLocale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(locale);
