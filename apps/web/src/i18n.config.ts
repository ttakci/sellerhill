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

import { enTranslations, trTranslations } from '@repo/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
    tr: { translation: trTranslations },
  },
  lng: 'tr',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  defaultNS: 'translation',
});

export default i18n;
