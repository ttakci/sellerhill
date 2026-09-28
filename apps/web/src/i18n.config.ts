/**
 * Web App i18n Configuration
 *
 * Purpose:
 * - Web-specific i18next setup
 * - Uses shared translation resources from @repo/shared
 * - Can override or extend translations if needed
 *
 * Platform Setup:
 * - Web uses react-i18next
 * - Mobile would use a different i18next setup
 * - But both use the same translation resources
 */

import { SUPPORTED_LOCALES, i18nResources } from '@repo/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { detectBrowserLocale, getStoredLocalePreference } from './utils/locale';

// Resolve initial locale: stored preference > browser detection > default
const initialLocale = getStoredLocalePreference() || detectBrowserLocale();

void i18n.use(initReactI18next).init({
  resources: i18nResources,
  lng: initialLocale,
  // A key (or a whole namespace — `admin`, `legal`) a locale does not carry
  // resolves in English rather than rendering a raw key.
  fallbackLng: 'en',
  // Keep language as bare codes (en / tr / ru …), never en-US / tr-TR
  load: 'languageOnly',
  supportedLngs: [...SUPPORTED_LOCALES],
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false },
  defaultNS: 'translation',
  // Missing keys: try other loaded namespaces only when using ns:key form;
  // feature hooks must put their domain ns first in useTranslation([...]).
  returnNull: false,
});

export default i18n;
