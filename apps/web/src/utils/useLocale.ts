/**
 * useLocale Hook
 *
 * Purpose:
 * - Provides locale context based on URL params
 * - Syncs i18next language with URL locale
 * - Provides locale-aware navigation helpers
 */

import { DEFAULT_LOCALE, isValidLocale, type SupportedLocale } from '@repo/shared';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { buildLocalePath, changeLocaleInPath, storeLocalePreference } from './locale';

export interface UseLocaleReturn {
  /** Current locale from URL */
  locale: string;
  /** Navigate to a path with current locale prefix */
  localeNavigate: (path: string, options?: { replace?: boolean }) => void;
  /** Change locale (navigates to same page with new locale) */
  changeLocale: (newLocale: string) => void;
  /** Build a locale-prefixed path */
  buildPath: (path: string) => string;
}

export const useLocale = (): UseLocaleReturn => {
  const { locale: urlLocale } = useParams<{ locale: string }>();
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  // Resolve locale from URL, fallback to default
  const locale: SupportedLocale =
    urlLocale && isValidLocale(urlLocale) ? (urlLocale as SupportedLocale) : DEFAULT_LOCALE;

  // Sync i18next language with URL locale (compare language only — ignore region tags)
  const activeLang = (i18n.language || '').split('-')[0];
  if (activeLang !== locale) {
    void i18n.changeLanguage(locale);
  }

  const localeNavigate = (path: string, options?: { replace?: boolean }): void => {
    const fullPath = buildLocalePath(path, locale);
    void navigate(fullPath, options);
  };

  const changeLocale = (newLocale: string): void => {
    // Validate locale before applying
    if (!isValidLocale(newLocale)) {
      return;
    }

    storeLocalePreference(newLocale as SupportedLocale);
    void i18n.changeLanguage(newLocale);

    // Navigate to same page with new locale
    const currentPath = window.location.pathname;
    const newPath = changeLocaleInPath(currentPath, newLocale as SupportedLocale);
    void navigate(newPath, { replace: true });
  };

  const buildPath = (path: string): string => {
    return buildLocalePath(path, locale);
  };

  return { locale, localeNavigate, changeLocale, buildPath };
};
