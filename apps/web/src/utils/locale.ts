/**
 * Locale Utilities
 *
 * Purpose:
 * - Provides locale-related utilities for the frontend
 * - Handles URL-based locale detection
 * - Browser language detection fallback
 * - Locale-aware navigation helpers
 */

import {
  DEFAULT_LOCALE,
  LOCALE_DISPLAY_NAMES,
  SUPPORTED_LOCALES,
  isValidLocale,
  type SupportedLocale,
} from '@repo/shared';

/**
 * Detect locale from browser language settings
 */
export const detectBrowserLocale = (): SupportedLocale => {
  const browserLangs = navigator.languages || [navigator.language];

  for (const lang of browserLangs) {
    const code = lang.toLowerCase().split('-')[0]; // e.g. 'tr-TR' -> 'tr'
    if (isValidLocale(code)) {
      return code;
    }
  }

  return DEFAULT_LOCALE;
};

/**
 * Extract locale from URL pathname
 * e.g. /en/register -> 'en', /tr/login -> 'tr'
 */
export const extractLocaleFromPath = (pathname: string): SupportedLocale | null => {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0) {
    const candidate = segments[0];
    if (isValidLocale(candidate)) {
      return candidate;
    }
  }
  return null;
};

/**
 * Get locale-aware path (strips locale prefix from path)
 * e.g. /en/register -> /register
 */
export const stripLocaleFromPath = (pathname: string): string => {
  const locale = extractLocaleFromPath(pathname);
  if (locale) {
    const withoutLocale = pathname.slice(`/${locale}`.length);
    return withoutLocale || '/';
  }
  return pathname;
};

/**
 * Build a locale-prefixed path
 * e.g. ('/register', 'en') -> '/en/register'
 */
export const buildLocalePath = (path: string, locale: SupportedLocale): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${cleanPath}`;
};

/**
 * Change locale in current URL
 * e.g. (/en/register, 'tr') -> /tr/register
 */
export const changeLocaleInPath = (pathname: string, newLocale: SupportedLocale): string => {
  const pathWithoutLocale = stripLocaleFromPath(pathname);
  return buildLocalePath(pathWithoutLocale, newLocale);
};

/**
 * Get all supported locales with their display info
 */
export const getSupportedLocales = () =>
  SUPPORTED_LOCALES.map((locale) => ({
    code: locale,
    displayName: LOCALE_DISPLAY_NAMES[locale],
  }));

/**
 * Store locale preference in localStorage
 */
export const storeLocalePreference = (locale: SupportedLocale): void => {
  localStorage.setItem('locale', locale);
};

/**
 * Get stored locale preference from localStorage
 */
export const getStoredLocalePreference = (): SupportedLocale | null => {
  const stored = localStorage.getItem('locale');
  if (stored && isValidLocale(stored)) {
    return stored;
  }
  return null;
};

/**
 * Resolve the best locale to use based on priority:
 * 1. URL locale (explicit user choice)
 * 2. localStorage preference (remembered choice)
 * 3. Browser language detection
 * 4. Default locale
 */
export const resolveLocale = (urlLocale?: SupportedLocale | null): SupportedLocale => {
  if (urlLocale && isValidLocale(urlLocale)) {
    return urlLocale;
  }

  const stored = getStoredLocalePreference();
  if (stored) {
    return stored;
  }

  return detectBrowserLocale();
};
