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

    if (newLocale === locale) {
      return;
    }

    storeLocalePreference(newLocale as SupportedLocale);
    /*
     * Resources are bundled at init, so `changeLanguage` resolves and emits
     * `languageChanged` synchronously. Firing it in the same click handler as
     * the navigation lets React batch both into ONE commit — awaiting it first
     * would split the switch into two full-tree renders.
     */
    void i18n.changeLanguage(newLocale);

    /*
     * Same page, new locale — query string and hash carry the page's own state
     * (dashboard tab/period, list filters, drawer flags). Dropping them turned
     * a language switch into a silent page reset plus a refetch.
     */
    const { pathname, search, hash } = window.location;
    const newPath = changeLocaleInPath(pathname, newLocale as SupportedLocale);
    void navigate(`${newPath}${search}${hash}`, { replace: true });
  };

  const buildPath = (path: string): string => {
    return buildLocalePath(path, locale);
  };

  return { locale, localeNavigate, changeLocale, buildPath };
};
