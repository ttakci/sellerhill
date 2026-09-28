/**
 * Common constants used across the application
 */

export const EMPTY_STRING = '';

/**
 * Supported locales / languages
 */
export const SUPPORTED_LOCALES = ['en', 'tr', 'ru', 'hi', 'ur', 'ar', 'az'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Display names for supported locales (used by LanguageSwitcher)
 */
export const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  tr: 'Türkçe',
  ru: 'Русский',
  hi: 'हिन्दी',
  ur: 'اردو',
  ar: 'العربية',
  az: 'Azərbaycanca',
};

/**
 * Locales written right-to-left. The document direction, the Emotion style
 * cache and the icon mirroring all key off this one list.
 */
export const RTL_LOCALES: readonly SupportedLocale[] = ['ur', 'ar'];

export const isRtlLocale = (locale: string): boolean =>
  (RTL_LOCALES as readonly string[]).includes(locale.toLowerCase().split('-')[0]);

/**
 * Check if a string is a valid supported locale
 */
export const isValidLocale = (locale: string): locale is SupportedLocale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(locale);
